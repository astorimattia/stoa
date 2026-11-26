import {createHmac,timingSafeEqual} from 'node:crypto'
// Verify the exact raw bytes before parsing. No endpoint is enabled by this file.
export function verifyResendEvent(raw,headers,secret,now=Date.now()){
 const id=headers['svix-id'],timestamp=headers['svix-timestamp'],signatures=headers['svix-signature']
 if(typeof raw!=='string'||raw.length>262144||typeof id!=='string'||!/^\d+$/.test(timestamp||'')||!signatures||!secret?.startsWith('whsec_'))throw Error('Invalid webhook')
 if(Math.abs(now/1000-Number(timestamp))>300)throw Error('Stale webhook')
 const key=Buffer.from(secret.slice(6),'base64'),expected=createHmac('sha256',key).update(id+'.'+timestamp+'.'+raw).digest()
 const valid=signatures.split(' ').some(part=>{const [version,sig]=part.split(',');if(version!=='v1'||!sig)return false;const actual=Buffer.from(sig,'base64');return actual.length===expected.length&&timingSafeEqual(actual,expected)})
 if(!valid)throw Error('Invalid webhook signature')
 const event=JSON.parse(raw)
 return {id,provider_id:event.data?.email_id,type:event.type}
}
