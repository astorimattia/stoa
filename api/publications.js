// Isolated staging notification workflow. No production audience or transport.
import { readAdminSession } from './_admin-session.js'
import { createHash, createHmac, timingSafeEqual } from 'node:crypto'
import { getSql } from './_stoa-db.js'
import { getAuth } from './_auth.js'
import {dispatchPublication} from './_publication-outbox.js'
import {createResendTransport} from './_mail-outbox.js'
import {BRAND_FROM} from './_stoa-emails.js'
import { newIssue } from './_stoa-emails.js'
const hash = v => createHash('sha256').update(v).digest('hex')
const equal = (a,b) => timingSafeEqual(Buffer.from(hash(a)),Buffer.from(hash(b)))
const review=()=>process.env.STOA_ACCOUNT_REVIEW==='1'
const table=n=>(review()?'stoa_test_':'stoa_')+n
const validEmail=e=>/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e)
const identityEmail=e=>review()?testEmail(e):validEmail(e)
const testEmail = e => /^[^\s@]+@stoa-test\.invalid$/.test(e)
export const tokenFor = email => `${Buffer.from(email).toString('base64url')}.${createHmac('sha256',process.env.BETTER_AUTH_SECRET || 'stoa-preview-only-token-fallback').update('stoa-news:'+email).digest('base64url')}`
function tokenEmail(token) {
  try { const [encoded,signature,...extra]=token.split('.'); if(extra.length||!encoded||!signature)return null;const email=Buffer.from(encoded,'base64url').toString();return identityEmail(email)&&equal(tokenFor(email),token)?email:null } catch{return null}
}
export async function ensurePublications(sql) {
  await sql`create table if not exists ${sql.unsafe(table('subscriptions'))}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`
  await sql`create table if not exists ${sql.unsafe(table('publications'))}(id text primary key,title text not null,summary text not null,url text not null,created_at timestamptz not null default now())`
  await sql`create table if not exists ${sql.unsafe(table('notifications'))}(publication_id text not null,email text not null,state text not null default 'queued',captured_at timestamptz,primary key(publication_id,email))`
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store')
  if(!review()&&process.env.STOA_ACCOUNT_LIVE!=='1')return res.status(404).json({error:'Not found'})
  const sql=getSql();if(!sql)return res.status(503).json({error:'Not configured'})
  await ensurePublications(sql)
  let body=req.body||{};if(typeof body==='string'){try{body=JSON.parse(body)}catch{body=Object.fromEntries(new URLSearchParams(body))}}
  const origin=new URL(process.env.BETTER_AUTH_URL).origin
  const token=req.query?.token||body.token||''
  if(req.method==='GET'&&req.query?.preferences==='1'){
    const session=await getAuth().api.getSession({headers:new Headers(req.headers)});const email=session?.user?.email
    if(!email||!session.user.emailVerified||!identityEmail(email))return res.status(401).json({error:'Verified reader identity required'})
    const active=await sql`select email from ${sql.unsafe(table('readers'))} where email=${email} and status='approved' and revoked_at is null and (expires_at is null or expires_at>now())`
    if(!active.length)return res.status(403).json({error:'Reader approval required'})
    const rows=await sql`select email from ${sql.unsafe(table('subscriptions'))} where email=${email} and unsubscribed_at is null`
    return res.status(200).json({subscribed:!!rows.length,review:review(),deliveryEnabled:review()||process.env.STOA_SUBSCRIPTIONS_ENABLE==='1'})
  }
  if(req.method==='GET')return res.status(200).json({confirmationRequired:true,valid:!!tokenEmail(token)})
  if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
  if(token){
    const email=tokenEmail(token);if(!email)return res.status(400).json({error:'Invalid link'})
    // One-click unsubscribe may omit Origin; ordinary browser requests must match.
    if(req.headers.origin&&req.headers.origin!==origin)return res.status(403).json({error:'Invalid origin'})
    await sql`update ${sql.unsafe(table('subscriptions'))} set unsubscribed_at=now() where email=${email}`
    await sql`update ${sql.unsafe(table('notifications'))} set state='suppressed' where email=${email} and state='queued'`
    return res.status(200).json({unsubscribed:true})
  }
  if(req.headers.origin!==origin)return res.status(403).json({error:'Invalid origin'})
  if(body.action==='subscribe'||body.action==='stop'){
    const session=await getAuth().api.getSession({headers:new Headers(req.headers)})
    const email=session?.user?.email
    if(!email||!session.user.emailVerified||!identityEmail(email))return res.status(401).json({error:'Verified reader identity required'})
    const active=await sql`select email from ${sql.unsafe(table('readers'))} where email=${email} and status='approved' and revoked_at is null and (expires_at is null or expires_at>now())`
    if(!active.length)return res.status(403).json({error:'Reader approval required'})
    if(body.action==='stop'){await sql`update ${sql.unsafe(table('subscriptions'))} set unsubscribed_at=now() where email=${email}`;await sql`update ${sql.unsafe(table('notifications'))} set state='suppressed' where email=${email} and state='queued'`;return res.status(200).json({unsubscribed:true})}
    if(!review()&&process.env.STOA_SUBSCRIPTIONS_ENABLE!=='1')return res.status(409).json({error:'New-piece email subscriptions are not enabled'})
    if(body.consent!==true)return res.status(400).json({error:'Explicit subscription choice required'})
    await sql`insert into ${sql.unsafe(table('subscriptions'))}(email) values(${email}) on conflict(email) do update set subscribed_at=now(),unsubscribed_at=null`
    return res.status(200).json({subscribed:true})
  }
  const presented=(req.headers.authorization||'').replace(/^Bearer /,'')
  if((!presented||!process.env.STOA_ADMIN_SECRET||!equal(presented,process.env.STOA_ADMIN_SECRET))&&!(await readAdminSession(sql, req)))return res.status(401).json({error:'Unauthorized'})
  if(body.action==='status'){
    if(!review())return res.status(200).json({publications:[],delivery:'disabled'})
    const publications=await sql`select p.id,p.title,p.created_at,count(n.email)::int as total,count(n.email) filter(where n.state='captured')::int as captured,count(n.email) filter(where n.state='suppressed')::int as suppressed from ${sql.unsafe(table('publications'))} p left join ${sql.unsafe(table('notifications'))} n on n.publication_id=p.id group by p.id order by p.created_at desc limit 50`
    return res.status(200).json({publications,delivery:'capture-only'})
  }
  if(!review()&&process.env.STOA_ANNOUNCEMENTS_SEND!=='1')return res.status(409).json({error:'Announcement sending is not enabled'})
  if(body.action!=='publish')return res.status(400).json({error:'Unknown action'})
  const id=String(body.id||''),title=String(body.title||'').trim(),summary=String(body.summary||'').trim()
  let url;try{url=new URL(body.url)}catch{return res.status(400).json({error:'Invalid URL'})}
  if(!/^[a-z0-9-]{1,80}$/.test(id)||!title||title.length>200||summary.length>1000||url.origin!==origin||!url.pathname.startsWith('/research/'))return res.status(400).json({error:'Invalid test publication'})
  await sql`insert into ${sql.unsafe(table('publications'))}(id,title,summary,url) values(${id},${title},${summary},${url.href}) on conflict(id) do nothing`
  const existing=await sql`select title,summary,url from ${sql.unsafe(table('publications'))} where id=${id}`
  if(existing.length&&(existing[0].title!==title||existing[0].summary!==summary||existing[0].url!==url.href))return res.status(409).json({error:'Publication ID already has different content'})

  if(!review()){
    const allowlist=(process.env.STOA_MAIL_RECIPIENT_ALLOWLIST||'').split(',').map(e=>e.trim().toLowerCase()).filter(Boolean)
    // Separate announcement flag never inherits transactional authority.
    const transport=createResendTransport({apiKey:process.env.RESEND_API_KEY,from:BRAND_FROM,replyTo:'research@stoacap.com',allowlist,allowLive:process.env.STOA_ANNOUNCEMENTS_SEND==='1'})
    try{return res.status(200).json(await dispatchPublication({sql,id,title,summary,url:url.href,allowlist,encryptionKey:process.env.STOA_MAIL_ENCRYPTION_KEY,transport,unsubscribeURL:email=>`${origin}/unsubscribe#${tokenFor(email)}`}))}
    catch{return res.status(503).json({error:'Announcement delivery could not complete. Retry this same publication ID; accepted messages are not repeated.'})}
  }

  await sql`insert into ${sql.unsafe(table('notifications'))}(publication_id,email) select ${id},s.email from ${sql.unsafe(table('subscriptions'))} s join ${sql.unsafe(table('readers'))} r on r.email=s.email where s.unsubscribed_at is null and r.status='approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at>now()) and s.email like '%@stoa-test.invalid' on conflict do nothing`
  // Atomically claim each capture. A repeat publication cannot duplicate mail.
  // Real transport is deliberately absent; later provider handoff needs an outbox.
  const queued=await sql`select email from ${sql.unsafe(table('notifications'))} where publication_id=${id} and state='queued'`
  let captured=0
  for(const {email} of queued){
    const unsubscribeURL=`${origin}/unsubscribe#${tokenFor(email)}`
    const tpl=newIssue(title,summary,url.href,unsubscribeURL)
    const result=await sql`with claimed as (update ${sql.unsafe(table('notifications'))} n set state='captured',captured_at=now() where n.publication_id=${id} and n.email=${email} and n.state='queued' and exists(select 1 from ${sql.unsafe(table('subscriptions'))} s join ${sql.unsafe(table('readers'))} r on r.email=s.email where s.email=n.email and s.unsubscribed_at is null and r.status='approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at>now())) returning email) insert into ${sql.unsafe(table('mail'))}(to_addr,subject,body) select email,${tpl.subject},${tpl.text} from claimed returning id`
    captured+=result.length
  }
  return res.status(200).json({id,captured,delivery:'capture-only'})
}
