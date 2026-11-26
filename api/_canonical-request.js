// Once delivery is enabled, only canonical-site traffic may issue mail or
// change account state. Immutable deployment hosts remain read-only.
export function canonicalRequestAllowed(req,{readOnly=false}={},env=process.env){
 if(env.STOA_CANONICAL_REQUESTS_ONLY!=='1')return true
 let canonical;try{canonical=new URL(env.BETTER_AUTH_URL)}catch{return false}
 const host=String(req.headers?.host||'').toLowerCase()
 if(host!==canonical.host.toLowerCase())return false
 if(readOnly||['GET','HEAD'].includes(req.method))return true
 return req.headers?.origin===canonical.origin
}
