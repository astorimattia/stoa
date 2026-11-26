// Durable payloads are encrypted because sign-in URLs are secrets.
// Callers separately gate live transport and exact recipient scope.
import {createHash,randomBytes,createCipheriv,createDecipheriv} from 'node:crypto'
const digest=v=>createHash('sha256').update(v).digest('hex')
const email=v=>String(v||'').trim().toLowerCase()
function encrypt(value,key){const iv=randomBytes(12),c=createCipheriv('aes-256-gcm',Buffer.from(key,'hex'),iv);return [iv.toString('base64url'),Buffer.concat([c.update(JSON.stringify(value)),c.final()]).toString('base64url'),c.getAuthTag().toString('base64url')].join('.')}
function decrypt(value,key){const [iv,body,tag]=value.split('.');const d=createDecipheriv('aes-256-gcm',Buffer.from(key,'hex'),Buffer.from(iv,'base64url'));d.setAuthTag(Buffer.from(tag,'base64url'));return JSON.parse(Buffer.concat([d.update(Buffer.from(body,'base64url')),d.final()]).toString())}
export function createOutbox({sql,encryptionKey,test=true,clock=()=>Date.now()}){
 if(!/^[a-f0-9]{64}$/i.test(encryptionKey||''))throw Error('A separate 32-byte encryption key is required')
 const table=n=>sql.unsafe((test?'stoa_test_':'stoa_')+'mail_'+n)
 async function ensure(){
  await sql`create table if not exists ${table('outbox')}(key text primary key,recipient text not null,kind text not null,content_hash text not null,payload text not null,state text not null default 'queued',created_at timestamptz not null default now(),first_attempt_at timestamptz,attempt_at timestamptz,lease text,attempts integer not null default 0,provider_id text unique,delivered_at timestamptz)`
  await sql`create table if not exists ${table('suppressions')}(email text primary key,reason text not null,at timestamptz not null default now())`
  await sql`create table if not exists ${table('events')}(id text primary key,provider_id text not null,type text not null,at timestamptz not null default now())`
 }
 async function enqueue({key,to,kind,subject,text,html,headers={},state='queued'}){
  to=email(to)
  if(!/^[a-z0-9:_-]{1,120}$/i.test(key)||!['transactional','announcement'].includes(kind)||!to.includes('@')||!subject||!text)throw Error('Invalid mail job')
  // 'held' rows are reviewable records only: dispatch claims 'queued'/'retry',
  // so a held row can never be sent by flipping a flag later.
  if(state!=='queued'&&state!=='held')throw Error('Invalid mail job state')
  if(test&&!to.endsWith('@stoa-test.invalid'))throw Error('Test recipient required')
  const payload={to,subject,text,...(html?{html}:{}),headers},hash=digest(JSON.stringify(payload))
  await sql`insert into ${table('outbox')}(key,recipient,kind,content_hash,payload,state) values(${key},${to},${kind},${hash},${encrypt(payload,encryptionKey)},${state}) on conflict do nothing`
  const rows=await sql`select content_hash,kind from ${table('outbox')} where key=${key}`
  if(rows[0]?.content_hash!==hash||rows[0]?.kind!==kind)throw Error('Mail key already has different content')
  return {key}
 }
 async function suppress(to,reason){
  to=email(to);if(!['unsubscribe','bounce','complaint'].includes(reason))throw Error('Invalid suppression')
  await sql`insert into ${table('suppressions')}(email,reason) values(${to},${reason}) on conflict(email) do update set reason=case when ${table('suppressions')}.reason in ('bounce','complaint') then ${table('suppressions')}.reason else excluded.reason end,at=now()`
  await sql`update ${table('outbox')} set state='suppressed' where recipient=${to} and state in ('queued','retry') and (${reason}<>'unsubscribe' or kind='announcement')`
 }
 // eligible is rechecked on every attempt for announcements, before transport.
 async function dispatch(key,{transport,eligible=async()=>false}){
  const now=clock(),lease=randomBytes(16).toString('hex')
  const rows=await sql`update ${table('outbox')} set state='sending',lease=${lease},attempt_at=${new Date(now)},first_attempt_at=coalesce(first_attempt_at,${new Date(now)}),attempts=attempts+1 where key=${key} and (state in ('queued','retry') or (state='sending' and attempt_at<${new Date(now-5*60000)})) returning *`
  const row=rows[0];if(!row){const existing=await sql`select state,provider_id from ${table('outbox')} where key=${key}`;return {claimed:false,...(existing[0]||{})}}
  const finish=async state=>{await sql`update ${table('outbox')} set state=${state},lease=null where key=${key} and lease=${lease}`;return {claimed:true,state}}
  // Provider deduplication is retained 24h. Stop automatic retry well before it
  // expires rather than risk repeating an accepted-but-lost response.
  if(now-new Date(row.first_attempt_at).getTime()>20*3600000)return finish('review')
  const suppressed=await sql`select reason from ${table('suppressions')} where email=${row.recipient}`
  if(suppressed.some(s=>s.reason!=='unsubscribe'||row.kind==='announcement'))return finish('suppressed')
  if(row.kind==='announcement'&&!await eligible(row.recipient))return finish('suppressed')
  try{
   const payload=decrypt(row.payload,encryptionKey)
   const result=await transport(payload,{idempotencyKey:'stoa/'+digest(key)})
   if(result.captured)return finish('captured')
   if(!result.id)throw Error('No provider acceptance ID')
   // API acceptance is not delivery. Only a verified webhook can mark delivered.
   await sql`update ${table('outbox')} set state='accepted',provider_id=${result.id},lease=null where key=${key} and lease=${lease}`
   // A webhook can arrive before the provider response is persisted. Replay
   // already-verified durable events after associating the acceptance ID.
   await reconcileEvents(result.id)
   const final=await sql`select state from ${table('outbox')} where key=${key}`
   return {claimed:true,state:final[0]?.state||'accepted',provider_id:result.id}
  }catch(error){return finish(error.permanent?'failed':'retry')}
 }
 // Only the signature-verifying HTTP adapter may call this with provider data.
 // Do not expose it directly as an unauthenticated endpoint.
 async function reconcileEvents(provider_id){
  const rows=await sql`select recipient,state from ${table('outbox')} where provider_id=${provider_id}`
  if(!rows.length)return false
  const events=await sql`select type from ${table('events')} where provider_id=${provider_id}`
  const complaint=events.some(e=>e.type==='email.complained'),bounce=events.some(e=>e.type==='email.bounced')
  if(complaint||bounce){await suppress(rows[0].recipient,complaint?'complaint':'bounce');await sql`update ${table('outbox')} set state=${complaint?'complained':'bounced'} where provider_id=${provider_id}`}
  else if(events.some(e=>e.type==='email.delivered'))await sql`update ${table('outbox')} set delivered_at=coalesce(delivered_at,now()),state=case when state='accepted' then 'delivered' else state end where provider_id=${provider_id}`
  return true
 }
 async function recordVerifiedEvent({id,provider_id,type}){
  if(!id||!provider_id||!['email.delivered','email.bounced','email.complained'].includes(type))throw Error('Unsupported event')
  const recorded=await sql`insert into ${table('events')}(id,provider_id,type) values(${id},${provider_id},${type}) on conflict do nothing returning id`
  return {matched:await reconcileEvents(provider_id),recorded:!!recorded.length}
 }
 return {ensure,enqueue,dispatch,suppress,recordVerifiedEvent}
}
export function createResendTransport({apiKey,from,replyTo,allowlist=[],allowLive=false,fetchImpl=fetch}){
 return async(payload,{idempotencyKey})=>{
  if(!allowLive)throw Object.assign(Error('Live transport is disabled'),{permanent:true})
  if(!apiKey||!from||!replyTo||!allowlist.map(email).includes(email(payload.to)))throw Object.assign(Error('Reviewed sender and recipient allowlist required'),{permanent:true})
  const r=await fetchImpl('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+apiKey,'Content-Type':'application/json','Idempotency-Key':idempotencyKey},body:JSON.stringify({...payload,from,reply_to:replyTo}),signal:AbortSignal.timeout(15000)})
  if(!r.ok)throw Object.assign(Error('Provider request failed'),{permanent:r.status>=400&&r.status<500&&![408,429].includes(r.status)})
  const d=await r.json();if(typeof d.id!=='string')throw Error('Missing provider ID');return {id:d.id}
 }
}
