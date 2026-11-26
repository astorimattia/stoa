import { useMemo, useState } from 'react'

type PieceFull = { slug: string; title: string; mode: string; number: number; market: string; source: string; requestsFromLock: number; opens?: { opens: number; readers: number; last_opened_at: string } | null }
type Draft = { id: string; title: string; summary: string; market: string; body: string; updated_at: string }
type SubstackPost = { slug: string; title: string; subtitle: string; date: string; paid: boolean; imported: boolean }
type LinkPreview = { url: string; source: string; title: string; author: string; body: string; review: string; note: string }
type AnnouncePreview = { recipients: string[]; readerCount?: number; subject: string; text: string; html?: string; sending: string }

const btn = 'bg-ink px-5 py-2.5 font-sans text-sm text-paper transition-colors hover:bg-ink/85 disabled:opacity-50'
const field = 'w-full border border-rule bg-white/50 px-3 py-2.5 text-sm outline-none focus:border-ink'
const MARKETS = ['Venture', 'Space', 'Fintech', 'Energy', 'Defense', 'Compute', 'Robotics', 'Materials', 'Other']
const MODES: { id: string; label: string; hint: string }[] = [
  { id: 'open', label: 'Open', hint: 'Anyone can read it in full.' },
  { id: 'readers', label: 'Readers', hint: 'Everyone else sees the summary, a lock, and the request form.' },
]

// Clipboard HTML -> the plain-text editor format, so images, headings, lists
// and tables pasted from Substack, Google Docs or a web page survive. Images
// become one-line Markdown image lines (the same form the importer writes);
// table rows become text lines with cells split by " | ". Returns '' when the
// HTML holds nothing richer than text, so a normal text paste is untouched.
function htmlToEditorText(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  if (!doc.body.querySelector('img, table, h1, h2, h3, h4, li')) return ''
  const out: string[] = []
  const clean = (t: string) => t.replace(/\s+/g, ' ').trim()
  const walk = (el: Element) => {
    const tag = el.tagName.toLowerCase()
    if (tag === 'img') {
      const src = el.getAttribute('src') || el.getAttribute('data-src') || ''
      if (/^https:\/\//i.test(src)) out.push('![' + clean(el.getAttribute('alt') || '').replace(/[\]]/g, ' ') + '](' + src.replace(/\s/g, '%20') + ')')
      return
    }
    if (tag === 'figure') {
      const cap = clean(el.querySelector('figcaption')?.textContent || '')
      const img = el.querySelector('img')
      const src = img?.getAttribute('src') || ''
      if (img && /^https:\/\//i.test(src)) out.push('![' + clean(img.getAttribute('alt') || '').replace(/[\]]/g, ' ') + '](' + src.replace(/\s/g, '%20') + (cap ? ' "' + cap.replace(/"/g, "'") + '"' : '') + ')')
      return
    }
    if (tag === 'table') {
      for (const row of el.querySelectorAll('tr')) {
        const cells = [...row.children].map((c) => clean(c.textContent || '')).filter(Boolean)
        if (cells.length) out.push(cells.join(' | '))
      }
      return
    }
    if (/^h[1-4]$/.test(tag)) { const t = clean(el.textContent || ''); if (t) out.push('## ' + t); return }
    if (tag === 'li') { const t = clean(el.textContent || ''); if (t) out.push('- ' + t); return }
    if (tag === 'p' || tag === 'blockquote') {
      if (el.querySelector('img')) { [...el.children].forEach(walk); const t = clean(el.textContent || ''); if (t) out.push(t); return }
      const t = clean(el.textContent || ''); if (t) out.push(t); return
    }
    if (el.children.length) [...el.children].forEach(walk)
    else { const t = clean(el.textContent || ''); if (t) out.push(t) }
  }
  ;[...doc.body.children].forEach(walk)
  return out.join('\n\n')
}

// Shows the image lines in the body as pictures, fitted to the column, so an
// image line reads as an image and a bad link is easy to spot.
function BodyPreview({ body }: { body: string }) {
  const images = useMemo(() => [...body.matchAll(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/gm)].map((m) => ({ alt: m[1], src: m[2], caption: m[3] || '' })), [body])
  if (!images.length) return null
  return <div className="mt-6 border-t border-rule pt-4">
    <p className="text-sm text-muted">Images in this piece ({images.length})</p>
    <div className="mt-3 grid gap-4 sm:grid-cols-2">
      {images.map((im, i) => <figure key={i + im.src} className="border border-rule bg-white/40 p-2">
        <img src={im.src} alt={im.alt} loading="lazy" className="h-auto w-full max-w-full" onError={(e) => { e.currentTarget.style.display = 'none'; (e.currentTarget.nextElementSibling as HTMLElement | null)?.removeAttribute('hidden') }} />
        <p hidden className="text-xs text-red-700">This image link does not load.</p>
        {im.caption && <figcaption className="mt-1 text-xs text-muted">{im.caption}</figcaption>}
      </figure>)}
    </div>
  </div>
}

export default function PiecesAdmin({ secret, pieces, drafts, review, onChanged }: {
  secret: string
  pieces: PieceFull[]
  drafts: Draft[]
  review: boolean
  onChanged: () => Promise<void>
}) {
  const [tab, setTab] = useState<'all' | 'open' | 'closed'>('all')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [editing, setEditing] = useState<null | { draftId?: string; title: string; summary: string; market: string; body: string; mode: string; emailReaders: boolean }>(null)
  const [confirmingDelete, setConfirmingDelete] = useState<string | null>(null)
  const [confirmingPiece, setConfirmingPiece] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)
  const [importHost, setImportHost] = useState('stoaresearch.substack.com')
  const [posts, setPosts] = useState<SubstackPost[] | null>(null)
  const [linkPreview, setLinkPreview] = useState<LinkPreview | null>(null)
  const [importNote, setImportNote] = useState('')
  const [importResult, setImportResult] = useState<null | { imported: string[]; skipped: { slug: string; reason: string }[] }>(null)
  const [pieceNotice, setPieceNotice] = useState('')
  const [chosen, setChosen] = useState<Record<string, boolean>>({}) // slug -> selected
  const [announce, setAnnounce] = useState<null | { slug: string; preview?: AnnouncePreview; result?: string }>(null)

  const auth = { Authorization: `Bearer ${secret}`, 'Content-Type': 'application/json' }
  async function act(body: Record<string, unknown>) {
    setBusy(true); setErr('')
    try {
      const res = await fetch('/api/account-admin', { method: 'POST', headers: auth, body: JSON.stringify(body) })
      const j = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(j.error || 'The action did not complete')
      await onChanged()
      return j
    } catch (e: any) { setErr(e?.message || 'The action did not complete'); return null } finally { setBusy(false) }
  }
  async function getJson(path: string) {
    const res = await fetch(path, { headers: { Authorization: `Bearer ${secret}` } })
    const j = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(j.error || 'The request did not complete')
    return j
  }

  const removing = pieces.find(p => p.slug === confirmingPiece)
  const shown = useMemo(() => pieces.filter((p) => tab === 'all' ? true : tab === 'open' ? p.mode === 'open' : p.mode !== 'open'), [pieces, tab])
  const counts = useMemo(() => ({ all: pieces.length, open: pieces.filter((p) => p.mode === 'open').length, closed: pieces.filter((p) => p.mode !== 'open').length }), [pieces])

  async function changeMode(p: PieceFull, mode: string) {
    if (mode === p.mode) return
    await act({ action: 'setpiece', slug: p.slug, mode })
  }

  async function findPosts() {
    setBusy(true); setErr(''); setPosts(null); setImportNote(''); setImportResult(null); setLinkPreview(null)
    const host = importHost.trim().toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0]
    if (['x.com','www.x.com','twitter.com','www.twitter.com','mobile.twitter.com','docs.google.com'].includes(host)) {
      try { setLinkPreview(await getJson('/api/dashboard?link-preview=' + encodeURIComponent(importHost.trim()))) } catch (e: any) { setErr(e?.message || 'This link could not be read') } finally { setBusy(false) }
      return
    }
    const wanted = (importHost.match(/\/p\/([a-z0-9-]{1,120})/i) || [])[1]?.toLowerCase() || ''
    if (!host) { setImportNote('Enter a Substack address like stoaresearch.substack.com'); setBusy(false); return }
    try {
      const j = await getJson('/api/dashboard?substack=&host=' + encodeURIComponent(host))
      if (!j.posts) setImportNote(j.note || 'Nothing found at that address.')
      else {
        setPosts(j.posts)
        const hit = wanted && j.posts.find((p) => p.slug === wanted && !p.imported)
        setChosen(hit ? { [hit.slug]: true } : {})
        if (wanted && !hit) setImportNote(j.posts.some((p) => p.slug === wanted) ? 'That post is already on Stoa.' : 'That post is not in the latest posts at this address. Find it, then tick it.')
      }
    } catch (e: any) { setErr(e?.message || 'The import list did not load') } finally { setBusy(false) }
  }

  async function importSelected() {
    const picked = (posts || []).filter((p) => !p.imported && chosen[p.slug]).map((p) => ({ slug: p.slug }))
    if (!picked.length) return
    const r = await act({ action: 'import-substack', host: importHost, posts: picked })
    if (r) { setImportResult({ imported: r.imported || [], skipped: r.skipped || [] }); setPosts(null); setChosen({}) }
  }

  async function publish() {
    if (!editing) return
    const r = await act({ action: 'publish-piece', title: editing.title, summary: editing.summary, market: editing.market, body: editing.body, mode: editing.mode, draftId: editing.draftId })
    if (!r) return
    const slug = r.slug
    if (editing.emailReaders) {
      setEditing(null)
      setAnnounce({ slug })
      try { setAnnounce({ slug, preview: await getJson('/api/dashboard?announce-preview=' + encodeURIComponent(slug)) }) } catch { setAnnounce({ slug }) }
    } else {
      setEditing(null)
    }
  }

  async function queueAnnouncement() {
    if (!announce?.preview) return
    const r = await act({ action: 'announce-piece', slug: announce.slug, review: announce.preview.review })
    if (r) {
      setAnnounce({ slug: announce.slug, result: r.sending === 'attempted' ? `Announcement sent to ${r.queued} subscriber${r.queued === 1 ? '' : 's'}.` : r.queued ? `Announcement recorded as held for ${r.queued} subscriber${r.queued === 1 ? '' : 's'}. Sending is off: nothing was delivered, and held copies cannot be sent later.` : (r.note || 'No subscribed readers to announce to.') })
    } else {
      // The review may have gone stale: reload the exact current audience and message.
      try { setAnnounce({ slug: announce.slug, preview: await getJson('/api/dashboard?announce-preview=' + encodeURIComponent(announce.slug)) }) } catch { setAnnounce(null) }
    }
  }

  const words = editing ? editing.body.split(/\s+/).filter(Boolean).length : 0

  // ---------- editor ----------
  if (editing) {
    return <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-5xl px-5 py-8 lg:px-10">
        <div className="mb-6 flex items-center justify-between gap-4 text-sm text-muted">
          <button className="underline" onClick={() => setEditing(null)}>&larr; Pieces</button>
          <span>{words} words · {Math.max(1, Math.round(words / 200))} min</span>
        </div>
        {drafts.length > 0 && !editing.draftId && <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
          <span className="text-muted">Load a draft:</span>
          {drafts.map((d) => <button key={d.id} className="underline" onClick={() => setEditing({ draftId: d.id, title: d.title, summary: d.summary, market: d.market, body: d.body, mode: 'readers', emailReaders: false })}>{d.title || 'Untitled'} <span className="text-muted">({new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})</span></button>)}
        </div>}
        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <input className="w-full border-0 bg-transparent font-serif text-4xl font-light leading-tight tracking-tight outline-none placeholder:text-muted/60" placeholder="Title" value={editing.title} onChange={(e) => setEditing({ ...editing, title: e.target.value })} />
            <input className="mt-4 w-full border-0 bg-transparent font-serif text-lg italic text-ink/75 outline-none placeholder:text-muted/60" placeholder="One-line summary" value={editing.summary} onChange={(e) => setEditing({ ...editing, summary: e.target.value })} />
            <textarea className="mt-8 min-h-[420px] w-full border-0 bg-transparent font-serif text-base leading-relaxed outline-none placeholder:text-muted/60" placeholder="Write the piece, or paste from Substack, Google Docs or the web. Images come over as image lines. Blank line between paragraphs; ## for a heading; - for a list item." value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} onPaste={(e) => {
              const ta = e.currentTarget
              const html = e.clipboardData.getData('text/html')
              const pasted = html ? htmlToEditorText(html) : ''
              if (!pasted) {
                if (!e.clipboardData.getData('text/plain') && [...e.clipboardData.files].some((f) => f.type.startsWith('image/'))) {
                  e.preventDefault()
                  setErr('Image files from your computer cannot be pasted yet. Copy the image from a web page (Substack, Docs) instead, so it keeps its link.')
                }
                return
              }
              e.preventDefault()
              setErr('')
              const before = editing.body.slice(0, ta.selectionStart), after = editing.body.slice(ta.selectionEnd)
              setEditing({ ...editing, body: before + pasted + after })
            }} />
            <BodyPreview body={editing.body} />
          </div>
          <aside className="space-y-6 border-t border-rule pt-6 lg:border-0 lg:pt-0">
            <label className="block text-sm text-muted">Market
              <select className={field + ' mt-2'} value={editing.market} onChange={(e) => setEditing({ ...editing, market: e.target.value })}>
                <option value="">None</option>
                {MARKETS.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </label>
            <fieldset className="text-sm">
              <legend className="text-muted">Who can read it</legend>
              <div className="mt-2 space-y-2">
                {MODES.map((m) => <label key={m.id} className={`block cursor-pointer border px-4 py-3 ${editing.mode === m.id ? 'border-ink bg-white/40' : 'border-rule'}`}>
                  <span className="flex items-center gap-2"><input type="radio" name="piece-mode" checked={editing.mode === m.id} onChange={() => setEditing({ ...editing, mode: m.id })} />{m.label}</span>
                  <span className="mt-1 block text-xs text-muted">{m.hint}</span>
                </label>)}
              </div>
            </fieldset>
            <label className="flex cursor-pointer items-start gap-3 text-sm">
              <input type="checkbox" className="mt-1" checked={editing.emailReaders} onChange={(e) => setEditing({ ...editing, emailReaders: e.target.checked })} />
              <span>Email readers about it<span className="mt-1 block text-xs text-muted">Off by default. If ticked, you review the exact message and recipients after publishing, before anything is queued. {review ? 'Test announcements are captured, never sent.' : 'Announcement sending stays off until you deliberately enable it.'}</span></span>
            </label>
            <div className="flex flex-wrap gap-3">
              <button disabled={busy} className={btn} onClick={publish}>{review ? 'Publish test piece' : 'Publish'}</button>
              <button disabled={busy} className="border border-rule px-5 py-2.5 text-sm" onClick={async () => { const r = await act({ action: 'save-draft', id: editing.draftId, title: editing.title, summary: editing.summary, market: editing.market, body: editing.body }); if (r) setEditing({ ...editing, draftId: r.id }) }}>Save draft</button>
            </div>
            {err && <p className="text-sm text-red-800">{err}</p>}
          </aside>
        </div>
      </div>
    </div>
  }

  // ---------- list ----------
  return <div className="flex min-h-0 flex-1 flex-col">
    <header className="flex flex-wrap items-end justify-between gap-x-6 gap-y-3 border-b border-rule px-5 pt-6 lg:px-8">
      <h1 className="pb-3 font-serif text-3xl font-light tracking-tight">Pieces</h1>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
        <div role="tablist" className="flex gap-x-5">
          {([['all', 'All'], ['open', 'Open'], ['closed', 'Readers']] as const).map(([t, label]) => <button key={t} role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`-mb-px border-b-2 pb-3 ${tab === t ? 'border-ink' : 'border-transparent text-muted'}`}>{label} <span className="tabular-nums text-muted">{counts[t]}</span></button>)}
        </div>
        <button className="mb-3 border border-rule px-4 py-2" onClick={() => { setImporting(true); setLinkPreview(null); setErr(''); setPosts(null); setImportNote(''); setImportResult(null) }}>Import</button>
        <button className={btn + ' mb-3'} onClick={() => setEditing({ title: '', summary: '', market: '', body: '', mode: 'readers', emailReaders: false })}>New</button>
      </div>
    </header>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {drafts.length > 0 && <div className="border-b border-rule px-5 py-4 lg:px-8">
        <h2 className="text-xs uppercase tracking-[0.14em] text-muted">Drafts</h2>
        <ul className="mt-1 divide-y divide-rule/70">
          {drafts.map((d) => <li key={d.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2.5">
            <button className="flex min-w-0 flex-1 items-baseline gap-4 text-left" onClick={() => setEditing({ draftId: d.id, title: d.title, summary: d.summary, market: d.market, body: d.body, mode: 'readers', emailReaders: false })}>
              <span className="min-w-0 flex-1 truncate font-serif text-lg">{d.title || 'Untitled'}</span>
              <span className="shrink-0 text-xs text-muted">Saved {new Date(d.updated_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
            </button>
            {confirmingDelete === d.id
              ? <span className="flex w-full shrink-0 items-baseline gap-3 text-xs sm:w-auto">
                  <span className="text-muted">Delete this draft?</span>
                  <button disabled={busy} className="underline" onClick={async () => { const r = await act({ action: 'delete-draft', id: d.id }); if (r) setConfirmingDelete(null) }}>Delete</button>
                  <button className="text-muted underline" onClick={() => setConfirmingDelete(null)}>Keep</button>
                </span>
              : <button className="shrink-0 text-xs text-muted underline hover:text-ink" onClick={() => setConfirmingDelete(d.id)}>Delete</button>}
          </li>)}
        </ul>
      </div>}
      <ul className="divide-y divide-rule">
        {shown.map((p) => <li key={p.slug} className="flex flex-wrap items-center gap-x-6 gap-y-3 px-5 py-4 lg:px-8">
          <span className="w-8 text-sm text-muted tabular-nums">{p.number}</span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-serif text-lg">{p.title}</span>
            <span className="mt-0.5 flex flex-wrap gap-x-3 text-xs text-muted">
              {p.market && <span>{p.market}</span>}
              {p.opens && p.opens.opens > 0 && <span>{p.opens.opens} open{p.opens.opens === 1 ? '' : 's'} · {p.opens.readers} reader{p.opens.readers === 1 ? '' : 's'}</span>}
              {p.source === 'substack' && <span>From Substack</span>}
              {p.mode !== 'open' && p.requestsFromLock > 0 && <span>{p.requestsFromLock} request{p.requestsFromLock === 1 ? '' : 's'} from its lock</span>}
            </span>
          </span>
          <span className="flex overflow-hidden border border-rule text-sm">
            {MODES.map((m) => <button key={m.id} disabled={busy} onClick={() => changeMode(p, m.id)} aria-pressed={p.mode === m.id} className={`px-3 py-1.5 ${p.mode === m.id ? 'bg-ink text-paper' : 'text-muted hover:text-ink'}`}>{m.label}</button>)}
          </span>
          {p.source === 'editor' && <button disabled={busy} className="text-xs text-muted underline hover:text-ink" onClick={async () => { setPieceNotice(''); const r = await act({ action: 'repair-piece-media', slug: p.slug, host: importHost || 'stoaresearch.substack.com', confirmTitle: p.title }); if (r) setPieceNotice(r.added ? `Restored ${r.added} image${r.added === 1 ? '' : 's'} from the Substack source. Text, slug, access and analytics were not changed.` : 'No missing source images found for this piece.') }}>Restore images</button>}
          <button disabled={busy} className="text-xs text-muted underline hover:text-ink" onClick={() => setConfirmingPiece(p.slug)}>Delete</button>
        </li>)}
        {!shown.length && <li className="px-5 py-16 text-center font-serif text-xl text-muted lg:px-8">No pieces here yet.</li>}
      </ul>
    </div>
    {pieceNotice && <p className="px-5 py-3 text-sm text-muted lg:px-8">{pieceNotice}</p>}
    {err && <p className="px-5 py-3 text-sm text-red-800 lg:px-8">{err}</p>}

    {removing && <div role="dialog" aria-label="Remove piece from site" className="fixed inset-0 z-40 flex items-center justify-center overflow-y-auto bg-ink/60 px-4 py-6"><div className="mx-auto w-full max-w-lg bg-paper p-6">
      <h2 className="font-serif text-2xl font-light">Remove piece from site?</h2>
      <p className="mt-4 break-words font-serif text-xl">{removing.title}</p>
      <div className="mt-6 flex flex-wrap gap-5"><button disabled={busy} className={btn} onClick={async () => { const r = await act({ action: 'delete-piece', slug: removing.slug, confirmTitle: removing.title }); if (r) setConfirmingPiece(null) }}>Remove from site</button><button disabled={busy} onClick={() => setConfirmingPiece(null)}>Keep</button></div>
    </div></div>}

    {importing && <div role="dialog" aria-label="Import" className="fixed inset-0 z-40 overflow-y-auto bg-ink/60 px-4 py-6">
      <div className="mx-auto max-w-2xl bg-paper p-6 [overflow-wrap:anywhere]">
        <h2 className="font-serif text-2xl font-light">Import</h2>
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <label className="flex-1 text-sm text-muted">Source link or Substack address<input className={field + ' mt-1'} value={importHost} onChange={(e) => { setImportHost(e.target.value); setLinkPreview(null); setPosts(null); setImportResult(null); setImportNote(''); setErr('') }} /></label>
          <button disabled={busy} className={btn} onClick={findPosts}>{busy ? 'Loading…' : 'Preview source'}</button>
        </div>
        {err && <p role="alert" className="mt-4 text-sm text-red-800">{err}</p>}
        {linkPreview && <section className="mt-5 border border-rule bg-white/40 p-4">
          <p className="text-xs uppercase tracking-wider text-muted">{linkPreview.source} · Unpublished draft preview</p>
          <h3 className="mt-2 break-words font-serif text-xl">{linkPreview.title}</h3>
          {linkPreview.author && <p className="mt-1 text-sm text-muted">By {linkPreview.author}</p>}
          <a className="mt-3 block break-all text-xs underline" href={linkPreview.url} target="_blank" rel="noreferrer">{linkPreview.url}</a>
          <p className="mt-3 text-sm text-muted">{linkPreview.note}</p>
          <pre className="mt-4 max-h-80 overflow-y-auto whitespace-pre-wrap break-words border-t border-rule pt-4 font-sans text-sm leading-relaxed">{linkPreview.body}</pre>
          <p className="mt-4 text-sm text-muted">Saving creates a draft only. It does not publish anything or email readers.</p>
        </section>}
        {importNote && <p className="mt-4 text-sm text-muted">{importNote}</p>}
        {importResult && <div className="mt-5 border border-rule bg-white/40 p-4 text-sm">
      <p>{importResult.imported.length} post{importResult.imported.length === 1 ? '' : 's'} saved as unpublished draft{importResult.imported.length === 1 ? '' : 's'}. {importResult.imported.length ? 'Open them from New piece and publish when ready.' : ''}</p>
      {importResult.skipped.length > 0 && <ul className="mt-2 space-y-1 text-muted">{importResult.skipped.map((s) => <li key={s.slug}>Skipped {s.slug}: {s.reason}</li>)}</ul>}
    </div>}
    {posts && <ul className="mt-5 divide-y divide-rule border-y border-rule">
          {posts.map((p) => <li key={p.slug} className={`flex flex-wrap items-center gap-3 py-3 ${p.imported ? 'opacity-45' : ''}`}>
            <input type="checkbox" disabled={p.imported} checked={!!chosen[p.slug]} onChange={(e) => setChosen((c) => ({ ...c, [p.slug]: e.target.checked }))} />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm">{p.title}</span>
              <span className="text-xs text-muted">{p.date}{p.paid ? ' · paid on Substack' : ''}{p.imported ? ' · already on Stoa' : ''}</span>
            </span>
          </li>)}
          {!posts.length && <li className="py-6 text-center text-sm text-muted">No posts found.</li>}
        </ul>}
        <div className="mt-5 flex gap-4">
          {!importResult && linkPreview && <button disabled={busy} className={btn} onClick={async () => { const r = await act({ action: 'import-link', url: linkPreview.url, review: linkPreview.review }); if (r) { setImportResult({ imported: r.imported || [], skipped: r.skipped || [] }); setLinkPreview(null) } }}>Save as draft</button>}
          {!importResult && !linkPreview && <button disabled={busy || !posts || !posts.some((p) => !p.imported && chosen[p.slug])} className={btn} onClick={importSelected}>Import selected</button>}
          <button onClick={() => { setImporting(false); setLinkPreview(null); setPosts(null); setImportResult(null) }}>{importResult ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>}

    {announce && <div role="dialog" aria-label="Review announcement" className="fixed inset-0 z-40 overflow-y-auto overflow-x-hidden bg-ink/60 px-4 py-6">
      <div className="mx-auto max-w-2xl bg-paper p-6 [overflow-wrap:anywhere]">
        <h2 className="font-serif text-2xl font-light">Review the announcement</h2>
        {announce.result ? <p className="mt-4 text-sm">{announce.result}</p> : !announce.preview ? <p className="mt-4 text-sm text-muted">Preparing the exact message and recipients…</p> : <>
          <p className="mt-4 text-sm text-muted">To {announce.preview.recipients.length} approved reader{announce.preview.recipients.length === 1 ? '' : 's'} with new-piece emails on{typeof announce.preview.readerCount === 'number' ? ` (${announce.preview.readerCount} approved total; anyone who stopped these emails is excluded)` : ''}:</p>
          <ul className="mt-2 max-h-32 overflow-y-auto text-sm">{announce.preview.recipients.map((r) => <li key={r} className="break-all">{r}</li>)}</ul>
          <div className="mt-4 border border-rule bg-white/40 p-4">
            <p className="text-xs text-muted">Subject</p>
            <p className="text-sm">{announce.preview.subject}</p>
            <p className="mt-3 text-xs text-muted">Designed HTML message</p>
            {announce.preview.html
              ? <iframe title="Announcement HTML preview" sandbox="" className="mt-1 h-[650px] w-full border border-rule bg-white" srcDoc={announce.preview.html} />
              : <pre className="mt-1 max-w-full whitespace-pre-wrap break-all font-sans text-sm leading-relaxed">{announce.preview.text}</pre>}
            {announce.preview.html && <details className="mt-3 text-sm"><summary className="cursor-pointer text-muted">Plain-text version</summary><pre className="mt-2 max-h-64 max-w-full overflow-y-auto whitespace-pre-wrap break-all border-t border-rule pt-3 font-sans text-sm leading-relaxed">{announce.preview.text}</pre></details>}
          </div>
          <p className="mt-3 text-xs text-muted">{announce.preview.sending === 'enabled' ? 'Queueing sends these emails. This cannot be undone once sent.' : 'Sending is off. Queueing saves these exact emails as held; held emails are never delivered, and turning sending on later will not send them. Sending always requires a fresh review like this one.'} Each subscriber gets their own unsubscribe link.</p>
          {err && <p className="mt-3 text-sm text-red-800">{err}</p>}
        </>}
        <div className="mt-5 flex gap-4">
          {!announce.result && <button disabled={busy || !announce.preview || !announce.preview.recipients.length} className={btn} onClick={queueAnnouncement}>{announce.preview?.sending === 'enabled' ? 'Send announcement' : 'Queue announcement'}</button>}
          <button onClick={() => setAnnounce(null)}>{announce.result ? 'Close' : 'Cancel'}</button>
        </div>
      </div>
    </div>}
  </div>
}
