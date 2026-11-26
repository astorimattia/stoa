import { useEffect, useState } from 'react'
// Reuses the existing Stoa paper/wordmark confirmation layout.
export default function Unsubscribe() {
  const [token] = useState(() => window.location.hash.slice(1))
  const [done,setDone]=useState(false)
  const [error,setError]=useState('')
  useEffect(()=>{window.history.replaceState({},'', '/unsubscribe')},[])
  async function unsubscribe(){
    setError('')
    try{const r=await fetch('/api/publications',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});if(!r.ok)throw new Error();setDone(true)}catch{setError('This link could not be used. No change was confirmed.')}
  }
  return <div className="min-h-screen bg-paper px-6 py-16 font-serif text-ink"><main className="mx-auto max-w-xl"><p className="mb-12 text-3xl font-light uppercase tracking-[-.02em]">Stoa</p><h1 className="text-4xl font-light">{done?'Unsubscribed.':'Stop new-piece emails?'}</h1><p className="mt-5 font-sans text-sm leading-relaxed text-muted">{done?'You will not receive new-piece announcements. Your reader access and requested sign-in emails are unchanged.':'Confirm to stop new-piece announcements. Opening this page alone does not change your subscription.'}</p>{!done&&token&&<button onClick={unsubscribe} className="mt-8 inline-block bg-ink px-5 py-3 font-sans text-sm text-paper">Unsubscribe</button>}{!token&&!done&&<p className="mt-5 font-sans text-sm text-muted">Open the unsubscribe link in a Stoa announcement.</p>}{error&&<p className="mt-5 font-sans text-sm text-muted">{error}</p>}<p className="mt-6 font-sans text-sm"><a href="/" className="underline underline-offset-4">Back to Stoa</a></p></main></div>
}
