// Dormant until exact webhook endpoint/signing-secret setup is reviewed.
import {getSql} from './_stoa-db.js'
import {createOutbox} from './_mail-outbox.js'
import {verifyResendEvent} from './_mail-webhook.js'
export const config={api:{bodyParser:false}}
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 if(process.env.STOA_MAIL_EVENTS_ENABLED!=='1')return res.status(404).json({error:'Not found'})
 if(req.method!=='POST')return res.status(405).json({error:'Method not allowed'})
 let raw='',event
 try{
  const chunks=[];let size=0
  for await(const chunk of req){const bytes=Buffer.from(chunk);size+=bytes.length;if(size>262144)return res.status(413).json({error:'Payload too large'});chunks.push(bytes)}
  raw=Buffer.concat(chunks).toString('utf8')
  event=verifyResendEvent(raw,req.headers,process.env.RESEND_WEBHOOK_SECRET)
 }catch{return res.status(400).json({error:'Invalid event'})}
 try{
  if(!['email.delivered','email.bounced','email.complained'].includes(event.type))return res.status(200).json({ignored:true})
  const sql=getSql();if(!sql)throw Error('Missing database')
  const outbox=createOutbox({sql,encryptionKey:process.env.STOA_MAIL_ENCRYPTION_KEY,test:process.env.STOA_ACCOUNT_REVIEW==='1'})
  await outbox.ensure();await outbox.recordVerifiedEvent(event)
  return res.status(200).json({received:true})
 }catch{return res.status(503).json({error:'Event could not be stored'})}
}
