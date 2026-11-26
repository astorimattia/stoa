// Single delivery boundary. Live sends require a separately configured switch,
// exact recipient allowlist and encryption key. Never enabled by routing alone.
import {randomUUID} from 'node:crypto'
import {createOutbox,createResendTransport} from './_mail-outbox.js'
import {BRAND_FROM} from './_stoa-emails.js'
import {verifyCustomReview} from './_custom-mail-review.js'
const reviewedSubjects = {'request-received':'We have your request','sign-in-link':'Your sign-in link','sign-in-code':'Your Stoa sign-in code','approved-welcome':"You're in: your link to Stoa"}
export function transactionalRecipientScope({to,template,kind='transactional',workflow,reviewToken},env=process.env){
 const recipient=String(to||'').trim().toLowerCase()
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)||kind!=='transactional')throw Error('Reviewed transactional scope required')
 const allow=(env.STOA_MAIL_RECIPIENT_ALLOWLIST||'').split(',').map(x=>x.trim().toLowerCase()).filter(Boolean)
 if(allow.length){if(!allow.includes(recipient))throw Error('Recipient is not in the reviewed send scope');return allow}
 if(env.STOA_TRANSACTIONAL_RECIPIENT_POLICY==='requested-workflows' && workflow==='admin-confirmed-custom'){ verifyCustomReview(reviewToken,recipient,template,env); return [recipient] }
 if(env.STOA_TRANSACTIONAL_RECIPIENT_POLICY!=='requested-workflows'||!reviewedSubjects[workflow]||template?.subject!==reviewedSubjects[workflow])throw Error('Reviewed requested workflow required')
 return [recipient]
}
export async function deliverTemplate({sql,to,template,kind='transactional',workflow,key,reviewToken}){
 const review=process.env.STOA_ACCOUNT_REVIEW==='1'
 if(review){
  if(process.env.STOA_MAIL_CAPTURE!=='1'||!to.endsWith('@stoa-test.invalid'))throw Error('Review mail requires a synthetic recipient')
  await sql`insert into stoa_test_mail(to_addr,subject,body) values(${to},${template.subject},${template.text})`
  return {captured:true,accepted:false}
 }
 if(process.env.STOA_TRANSACTIONAL_SEND!=='1')throw Error('Live transactional delivery is disabled')
 const allow=transactionalRecipientScope({to,template,kind,workflow,reviewToken})
 const outbox=createOutbox({sql,test:false,encryptionKey:process.env.STOA_MAIL_ENCRYPTION_KEY});await outbox.ensure()
 const jobKey=key||'transactional:'+randomUUID()
 await outbox.enqueue({key:jobKey,to,kind,...template})
 const transport=createResendTransport({apiKey:process.env.RESEND_API_KEY,from:BRAND_FROM,replyTo:'research@stoacap.com',allowlist:allow,allowLive:true})
 const result=await outbox.dispatch(jobKey,{transport})
 if(result.state!=='accepted'&&result.state!=='delivered')throw Error('Message was not accepted by the delivery service')
 return {captured:false,accepted:true,key:jobKey}
}
