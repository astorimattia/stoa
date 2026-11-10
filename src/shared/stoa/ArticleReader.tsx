import { useEffect, useState } from 'react'
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

const sectionLabel = (s: MemoSection, index: number) =>
  s.label ?? (index === 0 ? 'Overview' : `Section ${index + 1}`)

function ReaderHeader({ onBack }: { onBack: () => void }) {
  return (
    <header className="flex w-full items-center justify-between border-b border-paper/10 px-6 py-5 md:px-12">
      <button
        onClick={onBack}
        className="text-[13px] uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-paper"
      >
        Stoa
      </button>
      <span className="text-[13px] uppercase tracking-[0.2em] text-paper/60">Research</span>
    </header>
  )
}

function Masthead({ meta }: { meta: ReaderMeta }) {
  return (
    <div className="mb-10">
      <div className="mb-4 text-[12px] uppercase tracking-[0.25em] text-paper/50">{meta.entity}</div>
      <h1 className="mb-6 font-serif text-4xl leading-tight md:text-5xl">{meta.title}</h1>
      <div className="mb-6 flex flex-wrap items-center gap-3 text-[13px] text-paper/60">
        <span>{meta.author}</span>
        <span className="inline-block h-1 w-1 rounded-full bg-paper/40"></span>
        <span>{meta.date}</span>
      </div>
      {meta.subtitle && <p className="leading-relaxed text-paper/70">{meta.subtitle}</p>}
    </div>
  )
}

/** Request-approved gate: no article text ships in the bundle; the server
 *  only releases content to a valid approval token. */
function Gate({ meta, linkRejected }: { meta: ReaderMeta; linkRejected: boolean }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [sending, setSending] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const submit = async () => {
    if (sending || done) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role, piece: meta.title }),
      })
      if (!res.ok) {
        if (res.status === 503) throw new Error('Requests are temporarily unavailable.')
        throw new Error('Could not send the request. Try again.')
      }
      setDone(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the request. Try again.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      {linkRejected && (
        <p className="mb-6 text-[14px] leading-relaxed text-paper/70">
          This reading link isn't active. Request access below.
        </p>
      )}
      <p className="mb-8 text-[16px] leading-[1.8] text-paper/75">
        This piece is shared with approved readers. Request access below; if your request is
        approved, we'll be in touch.
      </p>
      {done ? (
        <p className="text-[15px] leading-relaxed text-paper/80">
          Thank you. If your request is approved, we'll be in touch.
        </p>
      ) : (
        <div className="space-y-5">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@firm.com"
            className="w-full border border-paper/20 bg-transparent px-4 py-3 text-[15px] text-paper placeholder:text-paper/35 focus:border-paper/60 focus:outline-none"
          />
          <RoleChoice value={role} onChange={setRole} tone="dark" />
          <button
            onClick={submit}
            disabled={sending || !email}
            className="bg-paper px-5 py-2.5 text-sm font-medium text-ink transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {sending ? 'Sending...' : 'Request access'}
          </button>
          {error && <p className="text-[14px] text-paper/60">{error}</p>}
        </div>
      )}
    </div>
  )
}

function ArticleBody({ memo }: { memo: Memo }) {
  const [tocOpen, setTocOpen] = useState(false)
  return (
    <>
      <div className="mb-12 border-t border-paper/10 pt-6">
        <button
          onClick={() => setTocOpen(!tocOpen)}
          className="text-[12px] uppercase tracking-[0.2em] text-paper/50 transition-colors hover:text-paper"
        >
          {tocOpen ? 'Hide contents' : 'Contents'}
        </button>
        {tocOpen && (
          <nav className="mt-5">
            <ul className="space-y-3">
              {memo.sections.map((s, i) => (
                <li key={s.id}>
                  <a
                    href={`#section-${s.id}`}
                    className="text-[13px] uppercase tracking-[0.12em] text-paper/70 transition-colors hover:text-paper"
                  >
                    {sectionLabel(s, i)}
                  </a>
                </li>
              ))}
            </ul>
          </nav>
        )}
      </div>

      {memo.sections.map((s, i) => (
        <section key={s.id} id={`section-${s.id}`} className="mb-16 scroll-mt-24">
          <h2 className="mb-8 font-serif text-2xl leading-tight md:text-3xl">{sectionLabel(s, i)}</h2>
          {s.paragraphs && s.paragraphs.map((p, pi) => (
            <p key={pi} className="mb-6 text-[16px] leading-[1.8] text-paper/75">
              {p}
            </p>
          ))}
          {s.items && (
            <div className="mt-8 space-y-6">
              {s.items.map((item) => (
                <div key={item.title} className="border-l border-paper/15 pl-5">
                  <div className="mb-1 font-medium text-paper">{item.title}</div>
                  <p className="text-[14px] leading-[1.7] text-paper/60">{item.body}</p>
                </div>
              ))}
            </div>
          )}
        </section>
      ))}
    </>
  )
}

export default function ArticleReader({ meta, onBack }: { meta: ReaderMeta; onBack: () => void }) {
  const [state, setState] = useState<LoadState>(() => {
    if (typeof window === 'undefined') return { kind: 'gate', linkRejected: false }
    const t = new URLSearchParams(window.location.search).get('t')
    return t ? { kind: 'loading' } : { kind: 'gate', linkRejected: false }
  })

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('t')
    if (!t) return
    let cancelled = false
    fetch(`/api/article?piece=${encodeURIComponent(meta.slug)}&t=${encodeURIComponent(t)}`, {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
    })
      .then(async (res) => {
        if (cancelled) return
        if (res.status === 403 || res.status === 401) {
          setState({ kind: 'gate', linkRejected: true })
          return
        }
        if (!res.ok) {
          setState({ kind: 'unavailable' })
          return
        }
        const data = await res.json()
        if (!cancelled && data && data.article) {
          setState({ kind: 'ready', memo: data.article as Memo })
        } else if (!cancelled) {
          setState({ kind: 'unavailable' })
        }
      })
      .catch(() => {
        if (!cancelled) setState({ kind: 'unavailable' })
      })
    return () => {
      cancelled = true
    }
  }, [meta.slug])

  return (
    <div className="min-h-screen bg-ink font-sans text-paper">
      <ReaderHeader onBack={onBack} />
      <main className="mx-auto max-w-[680px] px-6 py-16 md:py-24">
        <Masthead meta={meta} />
        {state.kind === 'loading' && (
          <p className="text-[14px] uppercase tracking-[0.2em] text-paper/50">Checking access...</p>
        )}
        {state.kind === 'unavailable' && (
          <p className="text-[15px] leading-relaxed text-paper/70">
            The reader is temporarily unavailable. Try again shortly.
          </p>
        )}
        {state.kind === 'gate' && <Gate meta={meta} linkRejected={state.linkRejected} />}
        {state.kind === 'ready' && <ArticleBody memo={state.memo} />}
        <footer className="mt-20 border-t border-paper/10 pt-8">
          <button
            onClick={onBack}
            className="text-[13px] uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-paper"
          >
            Back to Stoa
          </button>
        </footer>
      </main>
    </div>
  )
}
