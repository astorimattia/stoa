import { useEffect, useState } from 'react'
const button = 'bg-ink px-5 py-3 text-sm text-paper disabled:opacity-50'
export default function EmailPreferences() {
  const [subscribed, setSubscribed] = useState<boolean | null>(null)
  const [message, setMessage] = useState('')
  const [review,setReview] = useState(false)
  const [enabled,setEnabled] = useState<boolean | null>(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { fetch('/api/publications?preferences=1').then(async r => { if (!r.ok) throw Error(); const d = await r.json(); setSubscribed(d.subscribed);setReview(!!d.review);setEnabled(d.deliveryEnabled===true) }).catch(() => setMessage('Sign in with an approved reader account to manage emails.')) }, [])
  async function choose() {
    setBusy(true); setMessage('')
    try { const r = await fetch('/api/publications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: subscribed ? 'stop' : 'subscribe', consent: true }) }); if (!r.ok) throw Error(); setSubscribed(!subscribed); setMessage(subscribed ? 'New-piece emails stopped. Reader access is unchanged.' : (review?'Subscribed. This test site captures emails without sending them.':'Subscribed. You can stop new-piece emails here at any time.')) } catch { setMessage('The change could not be saved. Try again.') } finally { setBusy(false) }
  }
  return <main className="min-h-screen bg-paper px-6 py-14 font-sans text-ink"><div className="mx-auto max-w-xl"><a href="/" className="font-serif text-3xl font-light uppercase tracking-tight">Stoa</a><h1 className="mt-12 font-serif text-4xl font-light tracking-tight">New-piece emails</h1><p className="mt-6 text-sm leading-relaxed text-muted">{enabled === null ? 'Reader access and requested sign-in emails are separate from new-piece emails.' : enabled ? 'Approved Stoa readers receive a short note when Stoa publishes new research. You can stop these emails here at any time; reader access and requested sign-in emails are unchanged.' : 'New-piece emails are not enabled. Reader access and requested sign-in emails are separate.'}</p>{subscribed !== null && <><p className="mt-6 text-sm">{subscribed ? 'You are subscribed.' : 'You are not subscribed.'}</p><button disabled={busy || (!enabled && !subscribed)} onClick={choose} className={button + ' mt-6'}>{subscribed ? 'Stop new-piece emails' : enabled ? 'Subscribe to new-piece emails' : 'Subscriptions not enabled'}</button></>}{message && <p role="status" className="mt-5 text-sm text-muted">{message}</p>}{review&&<p className="mt-8 text-xs text-muted">Test site: emails captured, not sent.</p>}<a href="/research" className="mt-8 block w-fit text-sm underline underline-offset-4">Back to Stoa</a></div></main>
}
