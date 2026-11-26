// Dormant production integration. Caller must verify the independent send flag,
// exact reviewed recipient allowlist and immutable publication content first.
// Dispatch always rechecks consent, reader validity and notification state.
import {createHash} from 'node:crypto'
import {createOutbox} from './_mail-outbox.js'
import {newIssue} from './_stoa-emails.js'
export async function dispatchPublication({sql,id,title,summary,url,allowlist,encryptionKey,transport,unsubscribeURL}){
 const outbox=createOutbox({sql,test:false,encryptionKey});await outbox.ensure()
 const allowed=[...new Set(allowlist.map(e=>e.trim().toLowerCase()).filter(Boolean))]
 if(!allowed.length||allowed.length>100)throw Error('Reviewed recipient scope required, maximum100')
 await sql`insert into stoa_notifications(publication_id,email)
  select ${id},s.email from stoa_subscriptions s join stoa_readers r on r.email=s.email
  where s.email=any(${allowed}) and s.unsubscribed_at is null and r.status='approved'
    and r.revoked_at is null and (r.expires_at is null or r.expires_at>now()) on conflict do nothing`
 const queued=await sql`select email from stoa_notifications where publication_id=${id} and email=any(${allowed}) and state in ('queued','retry')`
 const eligible=async email=>{
  const rows=await sql`select 1 from stoa_notifications n join stoa_subscriptions s on s.email=n.email join stoa_readers r on r.email=n.email
   where n.publication_id=${id} and n.email=${email} and n.state in ('queued','retry') and s.unsubscribed_at is null
     and r.status='approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at>now())`
  return allowed.includes(email)&&rows.length>0
 }
 for(const{email}of queued){
  const key='publication:'+createHash('sha256').update(JSON.stringify([id,email])).digest('hex')
  const unsub=unsubscribeURL(email),template=newIssue(title,summary,url,unsub)
  await outbox.enqueue({key,to:email,kind:'announcement',...template})
  const result=await outbox.dispatch(key,{transport,eligible})
  if(result.claimed||['accepted','delivered','suppressed','captured','failed','review','bounced','complained'].includes(result.state))await sql`update stoa_notifications set state=${result.state} where publication_id=${id} and email=${email} and state in ('queued','retry')`
 }
 const rows=await sql`select state,count(*)::int as count from stoa_notifications where publication_id=${id} and email=any(${allowed}) group by state`
 return {id,delivery:'provider-acceptance',states:Object.fromEntries(rows.map(r=>[r.state,r.count]))}
}
