import {createHash} from 'node:crypto'
import {resolvePublicHost,fetchPinned} from './_stoa-lookup.js'
import {htmlToMemo,memoToText} from './_stoa-content.js'
const unavailable='Stoa cannot read this Google Doc link. It may require sign-in, have restricted access, or disallow export. No sharing settings were changed.'
const decode=s=>String(s).replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos|nbsp);/gi,(m,k)=>{const map={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'",nbsp:' '};if(map[k.toLowerCase()])return map[k.toLowerCase()];const n=k[1]?.toLowerCase()==='x'?parseInt(k.slice(2),16):parseInt(k.slice(1),10);return Number.isFinite(n)&&n>=0&&n<=0x10ffff?String.fromCodePoint(n):m})
const textOf=html=>decode(String(html).replace(/<(script|style|head)[\s\S]*?<\/\1>/gi,'').replace(/<br\s*\/?\s*>/gi,'\n').replace(/<\/(?:p|div|h[1-6]|li|tr)>/gi,'\n\n').replace(/<[^>]*>/g,'')).replace(/\r/g,'').replace(/\n[ \t]+/g,'\n').replace(/\n{3,}/g,'\n\n').trim()
export function parseImportSource(input){
 let u;try{const raw=String(input||'').trim();u=new URL(raw.includes('://')?raw:'https://'+raw)}catch{throw Error('Use a Substack address, one X post link, or a Google Docs link.')}
 if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error('Use a normal HTTPS source link without a username, password or custom port.')
 const host=u.hostname.toLowerCase()
 if(['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com'].includes(host)){
  const m=u.pathname.match(/^\/(?:([A-Za-z0-9_]{1,15})|(i\/web))\/status\/(\d{1,25})\/?$/)
  if(!m)throw Error('Use one public X post link. Profiles, searches, full threads and X Articles are not supported.')
  const url='https://x.com/'+(m[1]||m[2])+'/status/'+m[3]
  return {kind:'x',url,fetchURL:'https://publish.x.com/oembed?omit_script=1&hide_thread=1&url='+encodeURIComponent(url)}
 }
 if(host==='docs.google.com'){
  const published=u.pathname.match(/^\/document\/d\/e\/([A-Za-z0-9_-]{15,200})\/pub\/?$/)
  if(published){const url='https://docs.google.com/document/d/e/'+published[1]+'/pub';return {kind:'docs-published',url,fetchURL:url+'?embedded=true'}}
  const m=u.pathname.match(/^\/document\/(?:u\/\d+\/)?d\/([A-Za-z0-9_-]{15,200})(?:\/(?:edit|view|preview|export))?\/?$/)
  if(!m)throw Error('Use a Google Docs document link. Sheets, Slides, folders and other Drive files are not supported.')
  const key=u.searchParams.get('resourcekey');if(key&&!/^[A-Za-z0-9_-]{1,200}$/.test(key))throw Error('This Google Docs resource key is invalid.');const suffix=key?'&resourcekey='+encodeURIComponent(key):'';const url='https://docs.google.com/document/d/'+m[1]+'/edit'+(key?'?resourcekey='+encodeURIComponent(key):'');return{kind:'docs',url,fetchURL:'https://docs.google.com/document/d/'+m[1]+'/export?format=html'+suffix}
 }
 throw Error('This link is not supported. Use one public X post link or a Google Docs document link; Substack uses the address field.')
}
export async function readImportLink(input,{resolve=resolvePublicHost,read=fetchPinned}={}){
 const source=parseImportSource(input);let current=source.fetchURL,response;const deadline=Date.now()+12000
 for(let hop=0;hop<4;hop++){
  const u=new URL(current),h=u.hostname.toLowerCase()
  const allowed=source.kind==='x'?h==='publish.x.com':h==='docs.google.com'||h.endsWith('.googleusercontent.com')
  if(!allowed||u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443'))throw Error(source.kind==='x'?'This X post cannot be read without signing in.':unavailable)
  if(Date.now()>=deadline)throw Error('The source took too long to respond. Try again later.');const addresses=await resolve(h);if(!addresses?.length)throw Error('The source could not be reached. Try again later.')
  response=await read(u.href,addresses[0],deadline,1024*1024,true)
  if(!response)throw Error(source.kind==='x'?'The X post could not be loaded. It may be private, deleted or unavailable.':unavailable)
  if(response.status>=300&&response.status<400&&response.headers.location){if(hop===3)throw Error('The source redirected too many times.');current=new URL(response.headers.location,u).href;continue}
  break
 }
 if(response.status!==200)throw Error(source.kind==='x'?'The X post could not be loaded. It may be private, deleted or unavailable.':unavailable)
 const type=String(response.headers['content-type']||'').toLowerCase();let title='',author='',body=''
 if(source.kind==='x'){
  if(!type.includes('json'))throw Error('X did not return readable post text.')
  let data;try{data=JSON.parse(response.body.toString('utf8'))}catch{throw Error('X did not return readable post text.')}
  const p=String(data.html||'').match(/<p\b[^>]*>([\s\S]*?)<\/p>/i);body=p?textOf(p[1]):'';author=String(data.author_name||'').slice(0,200)
  if(!body)throw Error('No post text was available. Private, deleted, media-only or unsupported posts cannot be imported.')
  title=(author?author+': ':'')+body.split('\n')[0]
 }else{
  if(!type.includes('text/html'))throw Error(unavailable)
  const html=response.body.toString('utf8')
  title=textOf((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i)||[])[1]||'Imported Google Doc').replace(/\s*[-–]\s*Google Docs$/,'')
  const bodyHtml=(html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)||[])[1]||html.replace(/^[\s\S]*?<\/head>/i,'')
  const memo=htmlToMemo({slug:'import',title,html:bodyHtml})
  body=memoToText(memo)
 }
 if(!body||body.length>198000)throw Error(body?'This source is too large to import. Use a shorter document.':'No readable text was found at this link.')
 title=title.trim().slice(0,200);const text='Source: '+source.url+(author?'\nAuthor: '+author:'')+'\n\n'+body
 const review=createHash('sha256').update(JSON.stringify([source.url,title,author,text])).digest('hex')
 return {url:source.url,source:source.kind.startsWith('docs')?'Google Docs':'X',title,author,body:text,review,note:source.kind==='x'?'One post, text only. Threads, linked pages and media are not imported.':'Text and available images. Source sharing is unchanged; check formatting before publishing.'}
}
