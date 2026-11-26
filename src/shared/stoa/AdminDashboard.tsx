import { useEffect, useMemo, useState } from 'react'
import PublicationAdmin from './PublicationAdmin'
import PiecesAdmin from './PiecesAdmin'
import { approved, declined, customEmail } from '../../../api/_stoa-emails.js'

const fitFrame = (e: any) => { const d = e.currentTarget.contentDocument; if (d) e.currentTarget.style.height = Math.min(d.documentElement.scrollHeight + 4, 720) + 'px' }

type Request = { id: string; email: string; piece?: string; note?: string; team_note?: string; source?: string; created_at: string; status: string }
type Reader = { email: string; active: boolean; status: string; approved_at?: string; expires_at?: string; access_mode?:string; opened?: number; last_opened_at?: string }
type Data = { requests: Request[]; readers: Reader[]; capabilities?: {review:boolean; mailCapture:boolean; announcements:boolean;transactionalMail?:boolean;manualLinks?:boolean}; piecesFull?: any[]; drafts?: any[] }
const CUSTOM_EMAIL_SEND_ENABLED = true
const LEGACY_ADMIN_KEY = 'stoa_admin_secret'
const btn = 'bg-ink px-5 py-2.5 font-sans text-sm text-paper transition-colors hover:bg-ink/85 disabled:opacity-50'
const field = 'w-full border border-rule bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-ink'
const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : '—'

/** MP paper workspace + dark rail; isolated test-data mutations only. */
export default function AdminDashboard() {
  const [signedIn, setSignedIn] = useState(false)
  const [draft, setDraft] = useState('')
  const [data, setData] = useState<Data | null>(null)
  const [error, setError] = useState('')
  const [view, setView] = useState<'requests' | 'readers' | 'announcements' | 'pieces'>('requests')
  const [tab, setTab] = useState('pending')
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [teamNote, setTeamNote] = useState('')
  const [preview, setPreview] = useState<'approved' | 'declined' | null>(null)
  const [toast, setToast] = useState<{ before: Data; text: string } | null>(null)
  const [query, setQuery] = useState('')
  const [inviting, setInviting] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [sendEmail, setSendEmail] = useState<string | null>(null)
  const [sendMode, setSendMode] = useState<'welcome' | 'custom'>('welcome')
  const [customSubject, setCustomSubject] = useState('')
  const [customText, setCustomText] = useState('')
  const [customReview, setCustomReview] = useState<null | {to:string;subject:string;text:string;html:string;reviewToken:string;expiresAt:number}>(null)
  const [approveFor, setApproveFor] = useState<string | null>(null)
  const [approveMsg, setApproveMsg] = useState('')
  const [revoke, setRevoke] = useState<string | null>(null)
  const [issued,setIssued]=useState<{url:string;email:string;expiresAt?:string}|null>(null)
  const [lookup, setLookup] = useState<{email:string;loading:boolean;result?:any;error?:string}|null>(null)
  async function runLookup(email: string) {
    setLookup({ email, loading: true })
    try {
      const res = await fetch('/api/dashboard?lookup=' + encodeURIComponent(email))
      const r = await res.json()
      if (!res.ok) throw new Error(r.error || 'The lookup did not complete.')
      setLookup({ email, loading: false, result: r })
    } catch (e: any) { setLookup({ email, loading: false, error: e?.message || 'The lookup did not complete.' }) }
  }
  useEffect(() => {
    sessionStorage.removeItem(LEGACY_ADMIN_KEY)
    localStorage.removeItem(LEGACY_ADMIN_KEY)
  }, [])
  useEffect(() => {
    let cancelled = false
    fetch('/api/dashboard').then(async r => {
      if (r.status === 401) { if (!cancelled) { setSignedIn(false); setData(null) }; return }
      if (!r.ok) throw new Error('The dashboard could not be opened.')
      const d = await r.json()
      if (!cancelled) { setSignedIn(true); setData({ requests: d.requests || [], readers: d.readers || [], capabilities:d.capabilities, piecesFull: d.piecesFull || [], drafts: d.drafts || [] }) }
    }).catch(() => { if (!cancelled) setError('The dashboard is unavailable. No changes were made.') })
    return () => { cancelled = true }
  }, [signedIn])
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 6000); return () => clearTimeout(t) }, [toast])
  const review = data?.capabilities?.review !== false
  const mailOn = review || data?.capabilities?.transactionalMail === true
  const counts = useMemo(() => Object.fromEntries(['pending', 'approved', 'declined', 'handled'].map(t => [t, data?.requests.filter(r => r.status === t).length || 0])), [data])
  const list = data?.requests.filter(r => r.status === tab) || []
  const current = list.find(r => r.id === selected) || null
  const readers = data?.readers.filter(r => r.email.toLowerCase().includes(query.toLowerCase())) || []
  async function signOut() { await fetch('/api/account-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'admin-session-stop' }) }).catch(() => {}); setSignedIn(false); setData(null); setError('') }
  async function refresh() {
    const res = await fetch('/api/dashboard')
    if (!res.ok) throw new Error('Dashboard refresh failed')
    const d = await res.json(); setData({ requests: d.requests || [], readers: d.readers || [], capabilities:d.capabilities, piecesFull: d.piecesFull || [], drafts: d.drafts || [] })
  }
  async function mutate(action: string, email: string, extras = {}) {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/account-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action, email, ...extras }) })
      const result = await res.json()
      if (!res.ok) throw new Error(result.error || 'The action did not complete')
      if(result.url)setIssued({url:result.url,email:result.email,expiresAt:result.expiresAt})
      await refresh()
      setToast(data ? { before: data, text: `${result.emailError || ((action === 'approve' || action === 'resend-welcome') ? ('Reader access saved. ' + (result.emailed ? (review ? 'Welcome email captured, not sent.' : 'Welcome email accepted for delivery.') : 'No welcome email sent.')) : action === 'decline' ? ('Request declined. ' + (result.emailed ? (review ? 'Email captured, not sent.' : 'Email accepted for delivery.') : 'No email sent.')) : action === 'send-custom-email' ? (result.emailed ? (review ? 'Email captured, not sent.' : 'Email accepted for delivery.') : 'No email sent.') : action === 'revoke' ? 'Reader access revoked.' : action === 'note' ? 'Team note saved.' : 'Request returned to pending. Reader access unchanged.')}` } : null)
      return true
    } catch (e) { setError(e instanceof Error ? e.message : 'The action did not complete'); return false }
    finally { setBusy(false) }
  }
  async function decide(status: 'approved' | 'declined') {
    if (!current) return
    if (await mutate(status === 'approved' ? 'approve' : 'decline', current.email, { personalLine: note })) {
      setSelected(null); setNote(''); setPreview(null)
    }
  }
  if (!data) return <div className="flex min-h-screen items-center justify-center bg-ink px-6 font-sans text-paper"><form className="w-full max-w-sm" onSubmit={async e => { e.preventDefault(); setBusy(true); setError(''); try { const res = await fetch('/api/account-admin', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'admin-session-start', secret: draft }) }); const j = await res.json().catch(() => ({})); if (!res.ok) throw new Error(j.error || 'The dashboard could not be opened.'); setDraft(''); setData(null); setSignedIn(true) } catch (e: any) { setError(e?.message || 'The dashboard could not be opened.') } finally { setBusy(false) } }}>
    <h1 className="font-serif text-3xl font-light">Stoa admin</h1><label className="mt-8 block text-sm" htmlFor="admin-secret">Admin secret</label><input id="admin-secret" className="mt-2 w-full border-b border-paper/30 bg-transparent py-3 outline-none" required type="password" value={draft} onChange={e => setDraft(e.target.value)} /><button disabled={busy} className="mt-6 w-full bg-paper px-5 py-3 text-ink">Open dashboard</button>{error && <p role="alert" className="mt-3 text-sm">{error}</p>}
  </form></div>
  return <div className="flex h-screen flex-col bg-paper font-sans text-ink md:flex-row">
    <aside className="flex shrink-0 flex-wrap items-center gap-x-5 gap-y-2 bg-ink px-4 py-3 text-paper md:w-56 md:flex-col md:items-stretch md:px-0 md:py-5">
      <div className="font-serif text-xl font-light uppercase tracking-[-.02em] md:px-5">Stoa</div>
      <nav className="order-3 flex basis-full gap-1 md:order-none md:mt-8 md:basis-auto md:flex-col md:gap-0">{(['requests', 'readers', 'pieces', 'announcements'] as const).filter(v => v !== 'announcements' || data?.capabilities?.announcements !== false).map(v => <button key={v} onClick={() => { setView(v); setSelected(null) }} aria-current={view === v ? 'page' : undefined} className={`flex justify-between gap-3 px-3 py-2 text-sm capitalize md:px-5 ${view === v ? 'bg-paper/10 text-paper' : 'text-paper/60 hover:text-paper'}`}>{v}{v === 'requests' && !!counts.pending && <span>{counts.pending}</span>}</button>)}</nav>
      <div className="ml-auto text-xs text-paper/50 md:ml-0 md:mt-auto md:px-5"><p>{review?'Test-data admin':'Stoa admin'}</p><button onClick={() => { void signOut() }} className="mt-2 underline underline-offset-4">Sign out</button></div>
    </aside>
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      {(review || !mailOn) && <p className="border-b border-rule bg-paper-deep px-5 py-2 text-xs text-muted lg:px-8">{review?'Isolated test data: decisions persist here. Emails are captured, not sent. Live readers are untouched.':'Email delivery is not enabled. New readers get a manual reading link; no email is sent.'}</p>}
      {toast && <p role="status" className="border-b border-rule bg-paper-deep px-5 py-2.5 text-sm lg:px-8">{toast.text} <button className="ml-2 underline" onClick={() => setToast(null)}>Dismiss</button></p>}
      {error && <p className="px-5 py-3 text-sm text-accent">{error}</p>}
      {view !== 'pieces' && <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule px-5 pt-6 lg:px-8"><h1 className="pb-3 font-serif text-3xl font-light tracking-tight capitalize">{view}</h1>{view === 'requests' ? <div role="tablist" className="flex flex-wrap gap-x-5 gap-y-3 text-sm">{['pending', 'approved', 'declined', 'handled'].filter(t=>t!=='handled'||counts.handled>0).map(t => <button key={t} role="tab" aria-selected={tab === t} onClick={() => { setTab(t); setSelected(null) }} className={`-mb-px border-b-2 pb-3 capitalize ${tab === t ? 'border-ink' : 'border-transparent text-muted'}`}>{t} <span className="tabular-nums text-muted">{counts[t]}</span></button>)}</div> : view === 'readers' ? <div className="mb-4 flex flex-wrap gap-3">{!inviting&&<input className={field + ' sm:w-60'} aria-label="Search readers" placeholder="Search by email" value={query} onChange={e => setQuery(e.target.value)} />}<button className={btn} onClick={() => setInviting(!inviting)}>{inviting?'Cancel':mailOn?'Add reader':'Add reader'}</button></div> : null}</header>}
      {view === 'pieces' ? <PiecesAdmin secret="" pieces={data.piecesFull || []} drafts={data.drafts || []} review={review} onChanged={refresh} /> : view === 'announcements' ? <PublicationAdmin secret="" /> : view === 'requests' ? <div className="flex min-h-0 flex-1">
        <ul className={`min-h-0 w-full shrink-0 overflow-y-auto border-rule md:w-[340px] md:border-r lg:w-[380px] ${current ? 'hidden md:block' : ''}`}>
          {!list.length && <li className="px-6 py-16 text-center"><p className="font-serif text-xl font-light">{tab === 'pending' ? 'Nothing waiting.' : `No ${tab} requests yet.`}</p><p className="mt-2 text-sm text-muted">New requests and decisions appear here.</p></li>}
          {list.map(r => <li key={r.id} className="border-b border-rule/70"><button onClick={() => { setSelected(r.id); setNote(''); setTeamNote(r.team_note || '') }} className={`flex w-full flex-col gap-1 px-5 py-4 text-left lg:px-8 ${current?.id === r.id ? 'bg-paper-deep' : 'hover:bg-paper-deep/50'}`}><span className="break-all text-sm font-medium">{r.email}</span><span className="text-xs text-muted">{date(r.created_at)}</span>{r.piece && <span className="mt-1 truncate font-serif text-sm text-ink/75">{r.piece}</span>}</button></li>)}
        </ul>
        <section className={`min-h-0 min-w-0 flex-1 overflow-y-auto ${current ? '' : 'hidden md:block'}`}>
          {current ? <div className="max-w-2xl px-5 py-8 lg:px-12 lg:py-10"><button className="mb-6 text-sm text-muted md:hidden" onClick={() => setSelected(null)}>Back to requests</button><h2 className="break-all font-serif text-3xl font-light leading-tight tracking-tight">{current.email}</h2>{current.note && <blockquote className="mt-8 border-l-2 border-ink pl-4 font-serif text-lg leading-relaxed">{current.note}</blockquote>}
            <dl className="mt-8 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-6 gap-y-3 border-t border-rule pt-6 text-sm"><dt className="text-muted">Asked for</dt><dd>{current.piece || 'Stoa in general'}</dd><dt className="text-muted">Sent from</dt><dd>{current.source || 'Not recorded'}</dd><dt className="text-muted">Received</dt><dd>{date(current.created_at)}</dd><dt className="text-muted">Access</dt><dd>Whole locked library on approval</dd><dt className="text-muted">Who they might be</dt><dd><button className="underline" disabled={lookup?.loading} onClick={() => runLookup(current.email)}>{lookup?.loading && lookup?.email === current.email ? 'Looking up…' : 'Look up their domain'}</button>{lookup && !lookup.loading && lookup.email === current.email && (lookup.error ? <span className="mt-1 block text-xs text-muted">{lookup.error}</span> : <span className="mt-1 block text-xs leading-relaxed text-ink/80">{lookup.result?.kind === 'domain' ? <><strong className="font-medium">{lookup.result.site || lookup.result.title || lookup.result.domain}</strong>{lookup.result.description ? ` — ${lookup.result.description}` : ''} <span className="text-muted">({lookup.result.domain})</span></> : lookup.result?.note}</span>)}<span className="mt-2 block"><a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent('"' + current.email + '"')}`}>Search this email</a>{!['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','proton.me','protonmail.com','me.com'].includes((current.email.split('@')[1] || '').toLowerCase()) && <> {'·'} <a className="underline" target="_blank" rel="noreferrer" href={`https://www.google.com/search?q=${encodeURIComponent(current.email.split('@')[1] || '')}`}>Search {(current.email.split('@')[1] || '').toLowerCase()}</a></>}</span></dd><dt className="text-muted">Team note</dt><dd><textarea rows={2} maxLength={2000} aria-label="Team note" className={field} value={teamNote} onChange={e => setTeamNote(e.target.value)} /><button disabled={busy} className="mt-2 text-xs underline" onClick={() => mutate('note', current.email, { teamNote })}>Save team note</button></dd></dl>
            {current.status === 'pending' ? <div className="mt-10 border-t border-rule pt-6"><label hidden={true} htmlFor="reply-line" className="text-sm text-muted">A line from you, added to the email (optional)</label><textarea hidden={true} id="reply-line" rows={3} maxLength={1000} value={note} onChange={e => setNote(e.target.value)} className={field + ' mt-2 font-serif text-base'} /><div className="mt-4 flex flex-wrap gap-3"><button disabled={busy} className={btn} onClick={() => { setApproveFor(current.email); setApproveMsg('') }}>{review?'Approve test reader':'Approve reader'}</button><button className="border border-rule px-5 py-2.5 text-sm" onClick={() => decide('declined')}>{review?'Decline test request':'Decline request'}</button>{mailOn&&<button className="px-2 py-2.5 text-sm text-muted underline underline-offset-4" onClick={() => setPreview('approved')}>Preview email</button>}</div><p className="mt-3 text-xs leading-relaxed text-muted">{mailOn?'Approving opens a confirmation with the exact welcome email. New access is permanent until you revoke it; the sign-in link in the email works once, within 24 hours.':'A new reader receives a manual library reading link. Existing reader expiry, scope and link stay unchanged. No email is sent.'}</p></div> : <div className="mt-10 border-t border-rule pt-6 text-sm text-muted">{current.status==='handled'?'Historical handled request. Reader access is shown under Readers.':current.status === 'approved' ? (review?'Approved test reader.':'Approved reader.') : (review?'Declined test request.':'Declined request.')}<button className="ml-4 underline" onClick={() => mutate('reopen', current.email)}>Move back to pending</button></div>}
          </div> : <div className="flex h-full items-center justify-center px-8 text-center font-serif text-xl font-light text-muted">{list.length ? 'Pick a request to review it.' : 'All caught up.'}</div>}
        </section>
      </div> : <>
        {inviting && <form className="flex flex-wrap items-end gap-3 border-b border-rule bg-paper-deep/60 px-5 py-5 lg:px-8" onSubmit={async e => { e.preventDefault(); setApproveFor(inviteEmail); setApproveMsg('') }}><label className="text-sm">Email<input className={field + ' mt-2'} type="email" required value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder={review?'reader@stoa-test.invalid':'reader@example.com'} /></label><button disabled={busy} className={btn}>{review?'Invite test reader':mailOn?'Add reader':'Add reader'}</button><p className="w-full text-xs text-muted">{review?'Only @stoa-test.invalid addresses. Approval persists in the isolated test library; the welcome email is captured, not delivered.':mailOn?'New readers get permanent research access. Next, review the welcome email and confirm before access is approved or email is sent. Existing scope and expiry stay unchanged.':'A new reader gets permanent access and a manual reading link. You choose whether to share it. Existing expiry and scope stay unchanged. No email is sent.'}</p></form>}
        <div className="min-h-0 flex-1 overflow-auto"><div className="divide-y divide-rule md:hidden">{readers.map(r=><article key={r.email} className="px-5 py-5"><h2 className="break-all text-sm font-medium">{r.email}</h2><dl className="mt-4 grid grid-cols-[max-content_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm"><dt className="text-muted">Access</dt><dd>{r.active?(r.access_mode==='selected'?'Selected research':r.access_mode==='except'?'Research with exclusions':'All research'):r.status==='approved'?'Expired':r.status}</dd><dt className="text-muted">Access until</dt><dd className="break-words">{r.expires_at?new Date(r.expires_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'No expiry'}</dd><dt className="text-muted">Reader since</dt><dd>{date(r.approved_at)}</dd><dt className="text-muted">Opens</dt><dd>{r.opened||0}</dd></dl>{r.active&&<div className="mt-5 flex flex-wrap gap-5">{mailOn&&<button className="text-sm underline underline-offset-4" onClick={()=>{setSendEmail(r.email);setCustomReview(null);setSendMode('welcome');setCustomSubject('');setCustomText('')}}>Send email</button>}<button className="text-sm underline underline-offset-4" onClick={()=>setRevoke(r.email)}>Revoke access</button></div>}</article>)}</div><table className="hidden w-full min-w-[900px] text-left text-sm md:table"><thead className="sticky top-0 bg-paper text-xs text-muted"><tr className="border-b border-rule"><th className="min-w-[260px] px-5 py-3 font-normal lg:pl-8">Reader</th><th className="px-3 py-3 font-normal">Reader since</th><th className="px-3 py-3 font-normal">Access</th><th className="px-3 py-3 font-normal">Access until</th><th className="px-3 py-3 font-normal">Last opened</th><th className="px-3 py-3 font-normal">Piece opens</th><th className="px-5 py-3 font-normal" /></tr></thead><tbody>{readers.map(r => <tr key={r.email} className="border-b border-rule/70"><td className="break-all px-5 py-4 lg:pl-8">{r.email}</td><td className="px-3 py-4 text-muted">{date(r.approved_at)}</td><td className="px-3 py-4 text-muted">{r.active ? (r.access_mode==='selected'?'Selected research':r.access_mode==='except'?'Research with exclusions':'All research') : r.status==='approved'?'Expired':r.status}</td><td className="whitespace-nowrap px-3 py-4 text-muted">{r.expires_at?new Date(r.expires_at).toLocaleString('en-US',{timeZone:'America/New_York',month:'short',day:'numeric',year:'numeric',hour:'numeric',minute:'2-digit',timeZoneName:'short'}):'No expiry'}</td><td className="px-3 py-4 text-muted">{date(r.last_opened_at)}</td><td className="px-3 py-4 text-muted">{r.opened || 0}</td><td className="px-5 py-4 text-right">{r.active && <div className="flex flex-wrap justify-end gap-x-4 gap-y-2">{mailOn&&<button disabled={busy} className="text-xs text-muted underline underline-offset-4" onClick={() => {setSendEmail(r.email);setCustomReview(null);setSendMode('welcome');setCustomSubject('');setCustomText('')}}>Send email</button>}<button className="text-xs text-muted underline underline-offset-4" onClick={() => setRevoke(r.email)}>Revoke</button></div>}</td></tr>)}</tbody></table>{!readers.length && <p className="p-12 text-center font-serif text-xl text-muted">No readers yet.</p>}</div>
      </>}
    </div>
    {issued&&<div role="dialog" aria-label="Reading link created" className="fixed inset-0 z-50 overflow-y-auto bg-ink/60 px-4 py-6"><div className="mx-auto max-w-xl bg-paper p-6"><h2 className="font-serif text-2xl">Reading link created</h2><p className="mt-4 break-all text-sm">{issued.email}</p><p className="mt-3 text-sm text-muted">No email was sent. Share this link only with the reader. It expires {issued.expiresAt?new Date(issued.expiresAt).toLocaleString('en-US',{timeZone:'America/New_York',timeZoneName:'short'}):'as shown in access settings'}. This link is shown only now.</p><input aria-label="Reading link" readOnly className={field+' mt-5'} value={issued.url} onFocus={e=>e.currentTarget.select()}/><div className="mt-5 flex gap-5"><button className={btn} onClick={async()=>{try{await navigator.clipboard.writeText(issued.url)}catch{setError('Select the reading link and copy it.')}}}>Copy link</button><button onClick={()=>setIssued(null)}>Close</button></div></div></div>}
    {approveFor && <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/60 px-4 py-6"><div className="mx-auto max-w-[680px] bg-paper p-5"><h2 className="font-serif text-2xl font-light">Approve and send welcome?</h2><p className="mt-3 break-all text-sm text-muted">{approveFor}</p><p className="mt-2 text-sm text-muted">Approving gives this reader permanent access to the whole locked library{mailOn ? ' and sends this email' : ''}. Access lasts until you revoke it. The sign-in link in the email works once, within 24 hours.{mailOn ? ' Nothing sends before you confirm.' : ''} {review?'This test email will be captured, not sent.':''}</p><label className="mt-4 block text-sm text-muted" htmlFor="approve-line">A line from you, added to the top of the email (optional)</label><textarea id="approve-line" rows={2} maxLength={1000} value={approveMsg} onChange={e => setApproveMsg(e.target.value)} className={field + ' mt-2 font-serif text-base'} />{mailOn && <iframe title="Welcome email preview" sandbox="allow-same-origin" className="mt-4 w-full border border-rule" style={{ height: 220 }} onLoad={fitFrame} srcDoc={approved(approveFor, null, 'https://example.invalid/preview-only', approveMsg, {scopeNeutral:true}).html} />}<div className="mt-5 flex gap-4"><button disabled={busy} className={btn} onClick={async () => { if (await mutate('approve', approveFor, { personalLine: approveMsg })) { setApproveFor(null); setApproveMsg(''); setInviting(false); setInviteEmail(''); setSelected(null); setNote(''); setPreview(null) } }}>{review ? 'Approve and capture' : mailOn ? 'Approve and send' : 'Approve reader'}</button><button disabled={busy} onClick={() => setApproveFor(null)}>Cancel</button></div></div></div>}
    {sendEmail && <div role="dialog" aria-label="Send email" className="fixed inset-0 z-40 overflow-y-auto bg-ink/60 px-4 py-6"><div className="mx-auto max-w-[680px] bg-paper p-5">
      <h2 className="font-serif text-2xl font-light">Send email</h2>
      <p className="mt-3 break-all text-sm text-muted">To {sendEmail}</p>
      <div className="mt-3 flex gap-5 text-sm"><button disabled={busy} className={sendMode==='welcome'?'underline underline-offset-4':'text-muted underline underline-offset-4'} onClick={()=>{setSendMode('welcome');setCustomReview(null)}}>Welcome</button><button disabled={busy} className={sendMode==='custom'?'underline underline-offset-4':'text-muted underline underline-offset-4'} onClick={()=>{setSendMode('custom');setCustomReview(null)}}>Custom</button></div>
      {sendMode==='welcome' ? <>
        <p className="mt-3 text-sm text-muted">A new one-time sign-in link lasts 24 hours. Existing access scope and expiry stay unchanged. {review?'This test email will be captured, not sent.':''}</p>
        <iframe title="Welcome email preview" sandbox="allow-same-origin" className="mt-5 w-full border border-rule" style={{ height: 220 }} onLoad={fitFrame} srcDoc={approved(sendEmail, data?.readers.find(r => r.email === sendEmail)?.expires_at || null, 'https://example.invalid/preview-only', '', {scopeNeutral:true}).html}/>
        <div className="mt-5 flex gap-4"><button disabled={busy} className={btn} onClick={async () => {if(await mutate('resend-welcome',sendEmail))setSendEmail(null)}}>{review?'Capture test welcome':'Send welcome'}</button><button disabled={busy} onClick={() => setSendEmail(null)}>Cancel</button></div>
      </> : <>
        <label className="mt-4 block text-sm text-muted">Subject<input disabled={busy} className={field + ' mt-1'} maxLength={200} value={customSubject} onChange={(e)=>{setCustomSubject(e.target.value);setCustomReview(null)}} /></label>
        <label className="mt-3 block text-sm text-muted">Message<textarea disabled={busy} rows={5} maxLength={10000} className={field + ' mt-1'} value={customText} onChange={(e)=>{setCustomText(e.target.value);setCustomReview(null)}} /></label>
        <p className="mt-3 text-xs text-muted">{customReview ? 'Final reviewed email. Confirm below to send exactly this message.' : 'Live preview. Next, review the final email before sending.'}</p>
        {customReview && <p className="mt-3 break-words text-sm">To {customReview.to}<br/>Subject: {customReview.subject}</p>}
        <iframe title="Custom email preview" sandbox="allow-same-origin" className="mt-2 w-full border border-rule" style={{ height: 220 }} onLoad={fitFrame} srcDoc={customReview?.html || customEmail(customSubject || '(No subject)', customText).html}/>
        {customReview && <details open className="mt-4 text-sm"><summary>Plain-text version</summary><pre className="mt-2 whitespace-pre-wrap break-words font-serif">{customReview.text}</pre></details>}
        <p className="mt-3 text-sm text-muted">{CUSTOM_EMAIL_SEND_ENABLED ? 'One reader only. Editing the subject or message requires a new review. Review expires after 15 minutes.' : 'Custom sending is not available yet. You can prepare and review a message, but no custom email will be sent.'}</p>
        {error && <p role="alert" className="mt-3 text-sm text-red-800">{error}</p>}
        <div className="mt-5 flex flex-wrap items-center gap-4">
          {!customReview ? <button disabled={busy || !customSubject.trim() || !customText.trim()} className={btn} onClick={async()=>{
            setBusy(true);setError('');try {
              const res=await fetch('/api/account-admin',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'preview-custom-email',email:sendEmail,subject:customSubject,text:customText})});
              const j=await res.json();if(!res.ok)throw Error(j.error||'The review could not be prepared.');setCustomReview(j);
            } catch(e){setError(e instanceof Error?e.message:'The review could not be prepared.')} finally{setBusy(false)}
          }}>Review email</button> : <button disabled={!CUSTOM_EMAIL_SEND_ENABLED || busy} className={btn} onClick={async()=>{
            if(await mutate('send-custom-email',sendEmail,{reviewToken:customReview.reviewToken})){setSendEmail(null);setCustomSubject('');setCustomText('');setCustomReview(null)}
          }}>{review?'Capture reviewed test email':'Send to ' + customReview.to}</button>}
          <button disabled={busy} onClick={()=>{setSendEmail(null);setCustomReview(null);setError('')}}>Cancel</button>
        </div>
      </>}
    </div></div>}
    {revoke && <div className="fixed inset-0 z-40 flex items-center justify-center bg-ink/60 px-5"><div className="w-full max-w-md bg-paper p-8"><h2 className="font-serif text-2xl font-light">Revoke reader access?</h2><p className="mt-4 break-all text-sm text-muted">{revoke} will lose access to locked research immediately, including in existing sessions. {review?'Live readers are untouched.':''}</p><div className="mt-6 flex gap-4"><button className={btn} onClick={async () => { if (await mutate('revoke', revoke)) setRevoke(null) }}>{review?'Revoke test reader':'Revoke reader'}</button><button onClick={() => setRevoke(null)}>Cancel</button></div></div></div>}
    {preview && current && <div className="fixed inset-0 z-40 overflow-y-auto bg-ink/60 px-4 py-6"><div className="mx-auto max-w-[680px]"><div className="mb-3 flex gap-5 text-sm text-paper"><button onClick={() => setPreview('approved')}>Approval</button><button onClick={() => setPreview('declined')}>Decline</button><button className="ml-auto" onClick={() => setPreview(null)}>Close</button></div><iframe title="Test email preview" sandbox="allow-same-origin" className="w-full border-0" style={{ height: 220 }} onLoad={(e) => { const d = e.currentTarget.contentDocument; if (d) e.currentTarget.style.height = Math.min(d.documentElement.scrollHeight + 4, 780) + 'px' }} srcDoc={(preview === 'approved' ? approved(current.email, null, 'https://example.invalid/test-welcome', note) : declined(note)).html} /></div></div>}
  </div>
}
