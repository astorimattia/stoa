import { useEffect, useState } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import { legacyHeaders } from './legacyBridge'
import { authClient } from './authClient'
import { SignInCard, RequestAccessCard } from './SignIn'

/** Account-based access: a Better Auth session proves the email; the
 *  server decides per piece what that account may read. */

type MemoItem = { title: string; body: string }
type MemoLink = { text: string; href: string }
type MemoBlock =
  | { type: 'p'; text: string; links?: MemoLink[] }
  | { type: 'img'; src: string; minWidth?: number; alt?: string; caption?: string; links?: MemoLink[] }
  | { type: 'h3'; text: string }
  | { type: 'li'; text: string; links?: MemoLink[] }
  | { type: 'table'; head: string[]; rows: string[][] }

/** Renders text with its source links, replacing each link's text (first
 *  occurrence, in order) with an anchor. Links absent from the text are
 *  skipped, so a missing phrase never corrupts the paragraph. */
function renderLinked(text: string, links?: MemoLink[]): React.ReactNode {
  if (!links || links.length === 0) return text
  const nodes: React.ReactNode[] = []
  let rest = text
  let key = 0
  for (const l of links) {
    const idx = rest.indexOf(l.text)
    if (idx === -1) continue
    if (idx > 0) nodes.push(rest.slice(0, idx))
    nodes.push(
      <a
        key={key++}
        href={l.href}
        target="_blank"
        rel="noreferrer"
        className="underline decoration-rule underline-offset-4 transition-colors hover:text-ink/70"
      >
        {l.text}
      </a>,
    )
    rest = rest.slice(idx + l.text.length)
  }
  nodes.push(rest)
  return nodes
}
type MemoSection = {
  id: string
  label: string | null
  paragraphs: string[]
  items?: MemoItem[]
  blocks?: MemoBlock[]
}
export type Memo = {
  slug: string
  title: string
  entity: string
  author: string
  date: string
  subtitle?: string
  disclosure?: string
  sections: MemoSection[]
}

type ReaderMeta = {
  slug: string
  title: string
  entity: string
  author: string
  /** When set, the byline links to /research/authors/<slug>. */
  authorSlug?: string
  date: string
  subtitle?: string
  /** Public pieces render without sign-in and can swap the plate image. */
  public?: boolean
  cover?: string
}

type LoadState =
  | { kind: 'gate'; accessDenied: boolean }
  | { kind: 'loading' }
  | { kind: 'ready'; memo: Memo }
  | { kind: 'unavailable' }
  | { kind: 'removed' }

const PLATE = '/2-stoa-issue.jpg'

/** Notice strip, as on the home. */
function Strip({ onBack }: { onBack?: () => void }) {
  return (
    <div className="flex select-none items-center gap-3 bg-ink px-4 py-2 font-sans text-[13px] text-paper sm:px-5">
      {onBack && (
        <button onClick={onBack} aria-label="Back to Stoa" className="group -ml-1 inline-flex shrink-0 items-center p-1">
          <ArrowLeft className="h-3.5 w-3.5 text-paper/60 transition-[color,transform] duration-200 ease-soft group-hover:text-paper motion-safe:group-hover:-translate-x-0.5" />
        </button>
      )}
      <span className="min-w-0 flex-1 truncate text-paper/75">Built on conversations with experts.</span>
    </div>
  )
}

function Footer() {
  return (
    <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-paper/10 bg-ink px-4 py-2.5 font-sans text-xs text-paper/70 sm:px-5">
      <span>© 2026 Stoa</span>
      <span>Nothing here is investment advice.</span>
    </footer>
  )
}

/** Closing Stoa mark from the exported Magic Patterns design. */
function BottomMark() {
  return (
    <section aria-hidden="true" className="relative min-h-[calc(100svh-32px)] overflow-hidden bg-ink">
      <img src="/1-stoa-home.jpg" alt="" className="absolute inset-0 h-full w-full object-cover object-[60%_45%]" />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[14%] select-none text-center font-serif text-[34vw] font-light uppercase leading-[0.78] tracking-[-0.02em] text-white/75">Stoa</div>
    </section>
  )
}

type RelatedPiece = { slug: string; title: string; market?: string; date?: string; mode: string }

/** The current research index supplies links only. Article access stays server-side. */
function IssueBottom({ meta }: { meta: ReaderMeta }) {
  const { data: session } = authClient.useSession()
  const [readerApproved, setReaderApproved] = useState(false)
  const [pieces, setPieces] = useState<RelatedPiece[]>([])
  useEffect(() => {
    let cancelled = false
    fetch('/api/article?index=1').then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled && Array.isArray(d?.pieces)) setPieces(d.pieces.filter((p: RelatedPiece) => p.slug !== meta.slug)) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [meta.slug])
  useEffect(() => {
    let cancelled = false
    setReaderApproved(false)
    legacyHeaders().then(headers => fetch('/api/article?access=1&identity=1', { headers }))
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (!cancelled) setReaderApproved(d?.readerApproved === true) })
      .catch(() => {})
    return () => { cancelled = true }
  }, [session?.user?.email])
  return (
    <section className="bg-ink text-paper">
      <div className={readerApproved ? 'mx-auto max-w-6xl px-6 py-16 lg:px-10 lg:py-20' : 'mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-20 lg:px-10 lg:py-20'}>
        <div>
          {!readerApproved && <>
            <h2 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">Stoa circulates privately.</h2>
            <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-paper/70">Each piece is shared with the founders, operators and LPs who help us write it. We read every request and reply personally.</p>
          </>}
          <h2 className={readerApproved ? 'text-3xl font-light leading-tight tracking-tight sm:text-4xl' : 'mt-12 font-sans text-sm text-paper/55'}>Also in Stoa</h2>
          <ul className={readerApproved ? 'mt-6 grid border-t border-paper/15 md:grid-cols-2 md:gap-x-12' : 'mt-3 border-t border-paper/15'}>
            {pieces.map(piece => <li key={piece.slug} className="border-b border-paper/15 py-4">
              <a href={`/research/${piece.slug}`} className="group block">
                <span className="flex items-start justify-between gap-4 text-lg leading-snug"><span className="decoration-paper/40 underline-offset-4 group-hover:underline">{piece.title}</span>{!readerApproved && piece.mode !== 'open' && <Lock aria-label="Readers only" className="mt-1 h-3.5 w-3.5 shrink-0 text-paper/50" />}</span>
                <span className="mt-2 flex flex-wrap gap-x-5 font-sans text-xs text-paper/55">{piece.market && <span>{piece.market}</span>}{piece.date && <span>{piece.date}</span>}</span>
              </a>
            </li>)}
          </ul>
        </div>
        {!readerApproved && <div className="self-start">{session?.user?.email ? <RequestAccessCard pieceSlug={meta.slug} pieceTitle={meta.title} /> : <SignInCard heading="Sign in to Stoa" onSignedIn={() => window.location.reload()} />}</div>}
      </div>
    </section>
  )
}

function Plate({ src }: { src?: string }) {
  return (
    <figure className="relative">
      <img
        src={src || PLATE}
        alt={src ? 'Cover image for this piece.' : 'An oil study of stone-walled terraces, olives and cypresses on a hillside above the sea.'}
        className="aspect-[16/9] w-full object-cover object-[50%_65%] sm:aspect-[21/9] lg:max-h-[460px]"
      />
    </figure>
  )
}

function TitleBlock({ meta }: { meta: ReaderMeta }) {
  return (
    <section className="mx-auto max-w-[680px] px-6 pb-12 pt-12 lg:pt-16">
      <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
        <span>{meta.entity}</span>
        <span>{meta.date}</span>
      </p>
      <h1 className="mt-5 max-w-4xl text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-[68px]">
        {meta.title}
      </h1>
      {meta.subtitle && (
        <p className="mt-6 max-w-3xl text-xl italic leading-relaxed text-ink/75 lg:text-2xl">{meta.subtitle}</p>
      )}
      <div className="mt-10 max-w-3xl border-t border-rule pt-4 font-sans text-sm text-muted">
        <p className="flex flex-wrap gap-x-5 gap-y-1">
          {meta.authorSlug ? (
            <a href={`/research/authors/${meta.authorSlug}`} className="text-ink underline decoration-rule underline-offset-4 transition-colors hover:text-ink/70">
              {meta.author}
            </a>
          ) : (
            <span className="text-ink">{meta.author}</span>
          )}
        </p>
      </div>
    </section>
  )
}

/** Account gate: no article text ships in the bundle; the server only
 *  releases content to a session whose email is an active reader. Sign-in
 *  proves an email (link, code, Google or passkey); approval is
 *  account-wide on the server - one approval opens the whole library. */
export function Gate({ meta, onBack, accessDenied }: { meta: ReaderMeta; onBack?: () => void; accessDenied: boolean }) {
  // Signed out on a gated piece: minimal sign-in ("Sign in to read").
  // Signed in without the piece: identity + request access, kept separate
  // from sign-in. No role chips, no application framing anywhere here.
  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      <Strip onBack={onBack} />
      <Plate />
      <TitleBlock meta={meta} />
      <section className="bg-ink text-paper">
        <div className="mx-auto max-w-xl px-6 py-16 lg:px-10 lg:py-24">
          {accessDenied ? (
            <RequestAccessCard pieceSlug={meta.slug} pieceTitle={meta.title} />
          ) : (
            <SignInCard heading="Sign in to read this piece." onSignedIn={() => window.location.reload()} />
          )}
        </div>
      </section>
      <Footer />
    </div>
  )
}


export default function ArticleReader({ meta, onBack }: { meta: ReaderMeta; onBack?: () => void }) {
  const [state, setState] = useState<LoadState>({ kind: 'loading' })

  useEffect(() => {
    let cancelled = false
    legacyHeaders().then(headers => fetch(`/api/article?piece=${encodeURIComponent(meta.slug)}`, { headers }))
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setState({ kind: 'ready', memo: data.article as Memo })
        } else if (res.status === 404 || res.status === 410) {
          setState({ kind: 'removed' })
        } else if (res.status === 401) {
          setState({ kind: 'gate', accessDenied: false })
        } else if (res.status === 403) {
          // Signed in, but this account has no entitlement to this piece.
          setState({ kind: 'gate', accessDenied: true })
        } else {
          setState({ kind: 'unavailable' })
        }
      })
      .catch(() => !cancelled && setState({ kind: 'unavailable' }))
    return () => {
      cancelled = true
    }
  }, [meta.slug])

  if (state.kind === 'loading') {
    return (
      <div className="min-h-full bg-paper font-serif text-ink">
        <Strip onBack={onBack} />
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10">
          <p className="font-sans text-sm text-muted">Opening…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (state.kind === 'removed') {
    return <div className="min-h-full bg-paper font-serif text-ink"><Strip onBack={onBack} /><div className="mx-auto max-w-6xl px-6 py-24 lg:px-10"><h1 className="text-3xl font-light">This piece is no longer available.</h1><a href="/research" className="mt-6 inline-block font-sans text-sm underline">Back to research</a></div><Footer /></div>
  }

  if (state.kind === 'unavailable') {
    return (
      <div className="min-h-full bg-paper font-serif text-ink">
        <Strip onBack={onBack} />
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10">
          <h1 className="text-3xl font-light tracking-tight">The reader is temporarily unavailable.</h1>
          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
            Please try again in a moment.
          </p>
        </div>
        <Footer />
      </div>
    )
  }

  if (state.kind === 'gate') {
    return <Gate meta={meta} onBack={onBack} accessDenied={state.accessDenied} />
  }

  const memo = state.memo
  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      <Strip onBack={onBack} />
      <Plate src={meta.cover} />
      <TitleBlock meta={{ ...meta, subtitle: memo.subtitle ?? meta.subtitle }} />

      <div className="mx-auto max-w-6xl px-6 pb-24 lg:px-10">
        <article className="mx-auto min-w-0 max-w-[680px]">
          {memo.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-14 first:mt-0">
              {s.label && <h2 className="text-3xl font-light tracking-tight">{s.label}</h2>}
              {s.blocks
                ? s.blocks.map((b, i) => {
                    if (b.type === 'img')
                      return (
                        <figure key={i} className="mt-8 overflow-x-auto">
                          <img src={b.src} alt={b.alt || 'Chart from the article.'} className="w-full" style={b.minWidth ? { minWidth: b.minWidth } : undefined} loading="lazy" />
                          {b.caption && (
                            <figcaption className="mt-2 font-sans text-xs leading-relaxed text-muted">
                              {renderLinked(b.caption, b.links)}
                            </figcaption>
                          )}
                        </figure>
                      )
                    if (b.type === 'h3')
                      return (
                        <h3 key={i} className="mt-8 text-xl font-medium tracking-tight">
                          {b.text}
                        </h3>
                      )
                    if (b.type === 'table')
                      return (
                        <div key={i} className="mt-8 overflow-x-auto">
                          <table className="w-full min-w-[560px] border-collapse font-sans text-sm">
                            <thead>
                              <tr>
                                {b.head.map((h, j) => (
                                  <th key={j} className="border-b border-ink/20 pb-2 pr-4 text-left font-medium text-ink last:pr-0">
                                    {h}
                                  </th>
                                ))}
                              </tr>
                            </thead>
                            <tbody>
                              {b.rows.map((r, j) => (
                                <tr key={j} className="border-b border-rule last:border-0">
                                  {r.map((c, k) => (
                                    <td key={k} className="py-2 pr-4 align-top text-ink/85 last:pr-0">{c}</td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )
                    if (b.type === 'li')
                      return (
                        <p key={i} className="mt-5 text-xl leading-[1.65] text-ink/90">
                          {renderLinked(b.text, b.links)}
                        </p>
                      )
                    return (
                      <p key={i} className="mt-5 text-xl leading-[1.65] text-ink/90">
                        {renderLinked(b.text, b.links)}
                      </p>
                    )
                  })
                : (s.paragraphs || []).map((p, i) => (
                    <p key={i} className="mt-5 text-xl leading-[1.65] text-ink/90">
                      {p}
                    </p>
                  ))}
              {s.items?.map((it) => (
                <div key={it.title} className="mt-8">
                  <h3 className="text-xl font-medium tracking-tight">{it.title}</h3>
                  <p className="mt-2 text-xl leading-[1.65] text-ink/90">{it.body}</p>
                </div>
              ))}
            </section>
          ))}

          <p className="mt-16 border-t border-rule pt-5 font-sans text-xs leading-relaxed text-muted">
            {memo.disclosure ? `Disclosure: ${memo.disclosure} ` : ''}Stoa is published for information only and is not investment advice.
          </p>
        </article>
      </div>
      <IssueBottom meta={meta} />
      <BottomMark />
      <Footer />
    </div>
  )
}
