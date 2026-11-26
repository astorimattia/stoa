// Read-only compatibility policy. Not routed or enabled by this preparation.
// A legacy token preserves its original scope; it never creates identity/session,
// changes rows, widens access or bypasses an authoritative revocation/expiry.
import {createHash} from 'node:crypto'
const active=(r,now)=>!!r&&r.status==='approved'&&!r.revoked_at&&(!r.expires_at||new Date(r.expires_at).getTime()>now)
export function legacyReaderAllows(reader,slug,mode,grants=new Set(),exclusions=new Set(),now=Date.now()){
  if(mode==='open')return true
  if(!active(reader,now))return false
  if(mode==='selected'||reader.access_mode==='selected')return grants.has(slug)
  if(reader.access_mode==='except')return !exclusions.has(slug)
  return reader.access_mode==='all'||!reader.access_mode
}
// Resolve a reading-link token to its approved reader row (readers table
// only), so an open through the link can be recorded under that reader.
// Read-only: it never creates or changes rows. Returns null for unknown,
// expired or revoked links, and for request-only links with no reader row.
export async function legacyReaderByToken(sql,{token,test=false,now=Date.now()}){
  if(typeof token!=='string'||token.length<16||token.length>200)return null
  const table=n=>sql.unsafe((test?'stoa_test_':'stoa_')+n)
  const digest=createHash('sha256').update(token).digest('hex')
  const readers=await sql`select email,status,access_mode,expires_at,revoked_at from ${table('readers')} where token_hash=${digest} limit 1`
  return active(readers[0],now)?readers[0]:null
}
export async function legacyAccess(sql,{token,slug,title,mode,test=false,now=Date.now()}){
  if(mode==='open')return true
  if(typeof token!=='string'||token.length<16||token.length>200||!slug||!title)return false
  const table=n=>sql.unsafe((test?'stoa_test_':'stoa_')+n)
  const digest=createHash('sha256').update(token).digest('hex')
  const readers=await sql`select email,status,access_mode,expires_at,revoked_at from ${table('readers')} where token_hash=${digest} limit 1`
  if(readers.length){
    const reader=readers[0]
    if(!active(reader,now))return false
    const grants=await sql`select piece from ${table('grants')} where email=${reader.email}`
    const exclusions=await sql`select piece from ${table('exclusions')} where email=${reader.email}`
    return legacyReaderAllows(reader,slug,mode,new Set(grants.map(r=>r.piece)),new Set(exclusions.map(r=>r.piece)),now)
  }
  if(mode!=='readers')return false
  const requests=await sql`select lower(email) as email,status,expires_at,revoked_at from ${table('requests')} where token_hash=${digest} and piece=${title} limit 1`
  if(!active(requests[0],now))return false
  // The presence of ANY reader row for this address supersedes old requests.
  const owners=await sql`select 1 from ${table('readers')} where lower(email)=${requests[0].email} limit 1`
  return owners.length===0
}
