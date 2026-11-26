import{createHash,timingSafeEqual}from'node:crypto'
import{databaseURL,getSql}from'./_stoa-db.js'
const digest=v=>createHash('sha256').update(v).digest('hex')
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store')
 const presented=String(req.headers['x-stoa-isolation-proof']||''),gate=process.env.STOA_ISOLATION_PROOF_GATE
 if(process.env.STOA_ISOLATED_MAIL_TEST!=='1'||!gate||!timingSafeEqual(Buffer.from(digest(presented)),Buffer.from(digest(gate))))return res.status(404).json({error:'Not found'})
 if(req.method!=='GET')return res.status(405).json({error:'Method not allowed'})
 try{const url=databaseURL(),sql=getSql(),readers=await sql`select email,status,access_mode,expires_at from stoa_readers order by email`,requests=await sql`select id,email,status from stoa_requests order by id`;return res.status(200).json({hostHash:digest(new URL(url).hostname),readersHash:digest(JSON.stringify(readers)),requestsHash:digest(JSON.stringify(requests)),readers:readers.length,requests:requests.length,hasProductionReaders:readers.some(r=>['mattiastori@gmail.com','dinki@stoacap.com'].includes(r.email)),mailEnabled:process.env.STOA_TRANSACTIONAL_SEND==='1'})}catch{return res.status(503).json({error:'Isolation could not be verified'})}
}
