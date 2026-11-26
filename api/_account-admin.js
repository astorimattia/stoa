import {randomBytes,createHash} from 'node:crypto'
// Production-domain preparation. The HTTP routes remain review-only until
// integration, transport and preservation tests pass. No callers enable this.
// SQL is injected so the exact domain operations can run on isolated tables.
export function accountAdmin({sql,tables}){
 const T=name=>sql.unsafe(tables[name])
 for(const key of ['readers','requests','audit'])if(!/^[a-z][a-z0-9_]+$/.test(tables[key]||''))throw Error('Invalid account table')
 const active=r=>r&&r.status==='approved'&&!r.revoked_at&&(!r.expires_at||new Date(r.expires_at)>new Date())
 async function approve(email,{role=null}={}){
  email=String(email).trim().toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email')
  // Re-approving an active reader must never reset their exact expiry, token,
  // exclusions or scope. Explicit extend/revoke is a separate admin operation.
  const before=(await sql`select email,status,access_mode,expires_at,revoked_at from ${T('readers')} where email=${email}`)[0]
  if(before&&!active(before))return {requiresReactivation:true,reader:before,created:false,welcome:false}
  const inserted=await sql`insert into ${T('readers')}(email,role,status,access_mode,approved_at) values(${email},${role},'approved','all',now()) on conflict(email) do nothing returning email`
  const rows=await sql`select email,status,access_mode,expires_at,revoked_at from ${T('readers')} where email=${email}`
  if(!active(rows[0]))return {requiresReactivation:true,reader:rows[0],created:false,welcome:false}
  const answered=await sql`update ${T('requests')} set status='approved',approved_at=coalesce(approved_at,now()) where lower(email)=${email} and status='pending' returning id`
  return {reader:rows[0],created:!!inserted.length,welcome:!!inserted.length,approvedRequests:answered.length}
 }
 async function approveManual(email,{role=null,days=null,baseURL='https://www.stoacap.com'}={}){
  email=String(email).trim().toLowerCase()
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw Error('Invalid email')
  days=days==null?null:Math.min(365,Math.max(1,parseInt(days,10)||30))
  const token=randomBytes(24).toString('base64url'),digest=createHash('sha256').update(token).digest('hex')
  // No conflict update: concurrent approval cannot extend, rotate or broaden.
  const inserted=await sql`insert into ${T('readers')}(email,role,status,access_mode,approved_at,expires_at,token_hash) values(${email},${role},'approved','all',now(),${days==null?null:sql`now()+make_interval(days=>${days})`},${digest}) on conflict(email) do nothing returning email`
  const reader=(await sql`select email,status,access_mode,expires_at,revoked_at from ${T('readers')} where email=${email}`)[0]
  if(!active(reader))return {requiresReactivation:true,reader,created:false}
  const answered=await sql`update ${T('requests')} set status='approved',approved_at=coalesce(approved_at,now()) where lower(email)=${email} and status='pending' returning id`
  return {reader,created:!!inserted.length,approvedRequests:answered.length,url:inserted.length?new URL('/research?t='+token,baseURL).href:null}
 }
 async function revoke(email){
  email=String(email).trim().toLowerCase()
  // Authoritative revoked row also closes historical request-only links.
  const changed=await sql`insert into ${T('readers')}(email,status,access_mode,revoked_at) values(${email},'revoked','all',now()) on conflict(email) do update set status='revoked',revoked_at=coalesce(${T('readers')}.revoked_at,now()) returning email`
  return {changed:changed.length}
 }
 async function note(email,text){await sql`update ${T('requests')} set team_note=${String(text||'').trim().slice(0,2000)} where lower(email)=${String(email).trim().toLowerCase()}`;return {saved:true}}
 return {approve,approveManual,revoke,note}
}
