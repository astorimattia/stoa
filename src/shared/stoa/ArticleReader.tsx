import { useEffect, useState } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'
import { RoleChoice, type Role } from './RoleChoice'

type MemoItem = { title: string; body: string }
type MemoSection = { id: string; label: string | null; paragraphs: string[]; items?: MemoItem[] }
export type Memo = {
  slug: string
  title: string
  entity: string
  author: string
  date: string
  subtitle?: string
  sections: MemoSection[]
}

type ReaderMeta = {
  slug: string
  title: string
  entity: string
  author: string
  date: string
  subtitle?: string
}

type LoadState =
  | { kind: 'gate'; linkRejected: boolean }
  | { kind: 'loading' }
  | { kind: 'ready'; memo: Memo }
  | { kind: 'unavailable' }

const PLATE = '/landscape.jpg'

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
      <span>
        © 2026 Stoa by{' '}
        <a href="https://astori.vc" target="_blank" rel="noreferrer" className="text-paper/90 underline decoration-paper/30 underline-offset-2 transition-colors duration-150 hover:decoration-paper">
          Astori Ventures
        </a>
      </span>
      <span>Nothing here is investment advice.</span>
    </footer>
  )
}

function Plate() {
  return (
    <figure className="relative">
      <img src={PLATE} alt="A painted valley around a stoa, above the sea." className="aspect-[16/9] w-full object-cover sm:aspect-[21/9] lg:max-h-[460px]" />
    </figure>
  )
}

function TitleBlock({ meta }: { meta: ReaderMeta }) {
  return (
    <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 lg:px-10 lg:pt-16">
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
          <span className="text-ink">{meta.author}</span>
        </p>
      </div>
    </section>
  )
}

/** Request-approved gate: no article text ships in the bundle; the server
 *  only releases content to a valid approval token. */
function Gate({ meta, onBack, linkRejected }: { meta: ReaderMeta; onBack?: () => void; linkRejected: boolean }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || done) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, piece: meta.title }),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      setDone(true)
    } catch {
      setError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      <Strip onBack={onBack} />
      <Plate />
      <TitleBlock meta={meta} />

      <section className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-20 lg:px-10 lg:py-20">
          <div>
            <h2 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">Stoa circulates privately.</h2>
            <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-paper/70">
              Each piece is shared with the founders, operators and LPs who help us write it. We read
              every request and reply personally.
            </p>
            <p className="mt-6 max-w-md font-sans text-sm leading-relaxed text-paper/70">
              <Lock className="mr-2 inline h-3.5 w-3.5 -translate-y-px text-paper/50" />
              This piece opens with a personal reading link.
            </p>
          </div>

          <div className="self-start bg-paper p-6 text-ink">
            {done ? (
              <div>
                <h3 className="text-2xl">Thank you.</h3>
                <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                  We'll be in touch from research@stoacap.com.
                </p>
              </div>
            ) : (
              <form onSubmit={submit}>
                <h3 className="text-2xl">Request access</h3>
                <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                  For this piece and the archive.
                </p>
                {linkRejected && (
                  <p className="mt-3 font-sans text-sm leading-relaxed text-accent">
                    This reading link is not active. You can request a new one below.
                  </p>
                )}
                <div className="font-sans">
                  <RoleChoice value={role} onChange={setRole} />
                </div>
                <label htmlFor="reader-email" className="sr-only">Work email</label>
                <input
                  id="reader-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-4 w-full border border-rule bg-white/60 px-3 py-2.5 font-sans text-sm outline-none transition-[border-color,background-color] duration-150 ease-soft placeholder:text-muted/70 hover:border-muted/60 focus:border-ink focus:bg-white/80"
                />
                <button
                  type="submit"
                  disabled={sending}
                  className="mt-3 w-full bg-ink px-4 py-2.5 font-sans text-sm font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100 disabled:opacity-60"
                >
                  {sending ? 'Sending…' : 'Send request'}
                </button>
                {error && <p className="mt-3 font-sans text-sm leading-relaxed text-accent">{error}</p>}
              </form>
            )}
          </div>
        </div>
      </section>
      <Footer />
    </div>
  )
}

export default function ArticleReader({ meta, onBack }: { meta: ReaderMeta; onBack?: () => void }) {
  const [state, setState] = useState<LoadState>(() => {
    if (typeof window === 'undefined') return { kind: 'gate', linkRejected: false }
    const t = new URLSearchParams(window.location.search).get('t')
    return t ? { kind: 'loading' } : { kind: 'gate', linkRejected: false }
  })

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    if (!t) return
    let cancelled = false
    fetch(`/api/article?piece=${encodeURIComponent(meta.slug)}&t=${encodeURIComponent(t)}`)
      .then(async (res) => {
        if (cancelled) return
        if (res.ok) {
          const data = await res.json()
          setState({ kind: 'ready', memo: data.article as Memo })
        } else if (res.status === 403 || res.status === 400) {
          setState({ kind: 'gate', linkRejected: true })
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
          <p className="font-sans text-sm text-muted">Opening your reading link…</p>
        </div>
        <Footer />
      </div>
    )
  }

  if (state.kind === 'unavailable') {
    return (
      <div className="min-h-full bg-paper font-serif text-ink">
        <Strip onBack={onBack} />
        <div className="mx-auto max-w-6xl px-6 py-24 lg:px-10">
          <h1 className="text-3xl font-light tracking-tight">The reader is temporarily unavailable.</h1>
          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
            Please try your reading link again in a moment.
          </p>
        </div>
        <Footer />
      </div>
    )
  }

  if (state.kind === 'gate') {
    return <Gate meta={meta} onBack={onBack} linkRejected={state.linkRejected} />
  }

  const memo = state.memo
  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      <Strip onBack={onBack} />
      <Plate />
      <TitleBlock meta={{ ...meta, subtitle: memo.subtitle ?? meta.subtitle }} />

      <div className="mx-auto max-w-6xl px-6 pb-24 lg:px-10">
        <article className="min-w-0 lg:max-w-[680px]">
          {memo.sections.map((s) => (
            <section key={s.id} id={s.id} className="mt-14 first:mt-0">
              {s.label && <h2 className="text-3xl font-light tracking-tight">{s.label}</h2>}
              {(s.paragraphs || []).map((p, i) => (
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
            Stoa is published by Astori Ventures for information only and is not investment advice.
          </p>
        </article>
      </div>
      <Footer />
    </div>
  )
}
