import {canonicalRequestAllowed} from './_canonical-request.js'
// Vercel Node adapter. Worker keeps its own native Request/Response route.
export async function runAuthNode(req,res,auth,{welcome=false}={}){
 if(!canonicalRequestAllowed(req))return res.status(403).json({error:'Use the canonical Stoa website'})
 const base=new URL(process.env.BETTER_AUTH_URL)
 const inbound=new URL(req.url,base)
 const route=req.query?.route
 const routed=typeof route==='string'?route:Array.isArray(route)?route.join('/'):null
 const path=routed!==null ? (welcome?'/api/welcome-auth/':'/api/auth/')+routed : inbound.pathname
 inbound.searchParams.delete('route')
 const url=new URL(path+inbound.search,base)
 // Never let the inbound Host header choose callback origin.
 if(welcome&&(url.pathname!=='/api/welcome-auth/magic-link/verify'||req.method!=='GET'))return res.status(404).json({error:'Not found'})
 const headers=new Headers()
 for(const [key,value] of Object.entries(req.headers||{}))if(value!==undefined)headers.set(key,Array.isArray(value)?value.join(', '):value)
 const method=req.method||'GET'
 const options={method,headers}
 if(method!=='GET'&&method!=='HEAD')options.body=typeof req.body==='string'?req.body:JSON.stringify(req.body||{})
 const response=await auth.handler(new Request(url,options))
 res.status(response.status)
 response.headers.forEach((value,key)=>{if(key.toLowerCase()!=='set-cookie')res.setHeader(key,value)})
 const cookies=response.headers.getSetCookie();if(cookies.length)res.setHeader('Set-Cookie',cookies)
 res.send(Buffer.from(await response.arrayBuffer()))
}
