import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'

import { issues, isGated } from '../shared/stoa/issues'
import type { Issue } from '../shared/stoa/issues'
import { fetchAccessibleSlugs } from '../shared/stoa/readerToken'
import { authClient } from '../shared/stoa/authClient'

export const args = {
  state: 'default',
  email: '',
}

export const argTypes = {
  state: { control: 'select', options: ['default', 'research', 'request', 'requested', 'signin'] },
  email: { control: 'text' },
}

type Props = Partial<typeof args> & {
  onRequest?: (email: string, piece: string | null, role: string | null) => void
}


type ListedIssue = Issue & { number: number; slug: string; title: string; dek: string; market: string; date: string; readTime: string; public: boolean }

/** Approved reader home: the wordmark moves into the strip once you're inside,
 * the painting becomes a thin band, then the latest piece leads and the rest
 * of the library follows in library order. It uses only current list and sign-in
 * state - no invented reader name, progress, cadence or read status. */
function ReaderHome({ listed, email, onSignOut, newest }: { listed: ListedIssue[]; email: string; onSignOut: () => void; newest?: ListedIssue }) {
  const archive = listed.filter((issue) => issue.slug !== newest?.slug).slice().sort((a, b) => b.number - a.number)
  return (
    <div className="min-h-screen bg-paper font-serif text-ink">
      {/* Masthead: the wordmark moves into the strip once you're inside; the account sits opposite */}
      <header className="relative z-30 flex select-none items-center gap-4 bg-ink px-4 py-2.5 font-sans text-[13px] text-paper sm:px-6">
        <h1 className="min-w-0 flex-1">
          <span role="img" aria-label="Stoa" className="inline-block select-none font-serif text-[22px] font-light uppercase leading-none tracking-[-0.02em]">Stoa</span>
        </h1>
        <span className="min-w-0 max-w-[40vw] truncate text-paper/75 sm:max-w-none" title={email}>Signed in as {email}</span>
        <button onClick={onSignOut} className="shrink-0 whitespace-nowrap text-paper/75 underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline">Sign out</button>
      </header>

      {/* The painting, kept as a thin band: the same place as the front door, without the front door */}
      <div className="relative h-20 overflow-hidden sm:h-28">
        <img
          src={LANDSCAPE}
          draggable={false}
          alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
          className="absolute inset-0 h-full w-full object-cover object-[60%_42%]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)]"
        />
      </div>

      {/* Greeting and the latest piece */}
      <section className="mx-auto max-w-6xl px-6 pt-10 lg:px-10 lg:pt-14">
        <div className="border-b border-rule pb-5">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">Welcome.</h2>
        </div>

        {newest && (
          <article className="min-w-0 pt-10">
            <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
              <span className="font-medium text-accent">Latest</span>
              {newest.market && <span>{newest.market}</span>}
              {newest.date && <span>{newest.date}</span>}
            </p>
            <a href={`/research/${newest.slug}`} className="group mt-4 block">
              <span className="block max-w-3xl text-4xl font-light leading-[1.08] tracking-tight decoration-rule decoration-1 underline-offset-[6px] group-hover:underline sm:text-5xl lg:text-[56px]">
                {newest.title}
              </span>
            </a>
            {newest.dek && <p className="mt-5 max-w-2xl text-xl leading-relaxed text-ink/75">{newest.dek}</p>}
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-sans text-sm">
              <a
                href={`/research/${newest.slug}`}
                className="group inline-flex items-center gap-2 whitespace-nowrap bg-ink px-5 py-2.5 font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100"
              >
                Read
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-soft motion-safe:group-hover:translate-x-0.5" />
              </a>
              {newest.readTime && <span className="text-muted">{newest.readTime} read</span>}
            </div>
          </article>
        )}
      </section>

      {/* The rest of Stoa: everything not already shown above, in library order */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 lg:px-10">
        <div className="border-b border-ink pb-4">
          <h2 className="text-3xl font-light tracking-tight">Everything else</h2>
        </div>

        <ul>
          {archive.map((issue) => (
            <li key={issue.slug} className="border-b border-rule">
              <a
                href={`/research/${issue.slug}`}
                className="group grid w-full grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-5 md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5.5rem_7.5rem] md:gap-x-6"
              >
                <span className="font-sans text-sm tabular-nums text-muted">{issue.number}</span>
                <span className="min-w-0">
                  <span className="block text-xl leading-snug decoration-rule decoration-1 underline-offset-4 group-hover:underline">
                    {issue.title}
                  </span>
                  <span className="mt-1 flex flex-wrap gap-x-4 font-sans text-xs text-muted md:hidden">
                    {issue.market && <span>{issue.market}</span>}
                    {issue.date && <span>{issue.date}</span>}
                    {issue.readTime && <span>{issue.readTime}</span>}
                  </span>
                </span>
                <span className="hidden font-sans text-sm text-muted md:block">{issue.market}</span>
                <span className="hidden whitespace-nowrap font-sans text-sm text-muted md:block">{issue.date}</span>
                <span className="hidden whitespace-nowrap text-right font-sans text-sm text-muted md:block">{issue.readTime}</span>
              </a>
            </li>
          ))}
        </ul>
      </section>

      <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-ink px-4 py-2.5 font-sans text-xs text-paper/70 sm:px-5">
        <span>© 2026 Stoa</span>
        <span>Nothing here is investment advice.</span>
      </footer>
    </div>
  )
}

const LANDSCAPE = '/1-stoa-home.jpg'

export default function StoaHome(props: Props) {
  const { state, email, onRequest } = { ...args, ...props }
  const [panel, setPanel] = useState(state)
  const [piece, setPiece] = useState<string | null>(null)
  const [value, setValue] = useState(email)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const reduce = useReducedMotion()
  const stage = useRef<HTMLElement>(null)
  const cover = useCover(stage)
  // Gated pieces this device's reading link opens (all of them for an active
  // reader). They open directly; other gated pieces go to the request form.
  const [access, setAccess] = useState<Set<string>>(() => new Set())
  const { data: session } = authClient.useSession()
  const signOutTop = async () => { await authClient.signOut().catch(() => {}); window.location.reload() }
  useEffect(() => { if (session && panel === 'signin') setPanel('default') }, [session, panel])
  const [isReader, setIsReader] = useState(false)
  useEffect(() => {
    let cancelled = false
    setIsReader(false)
    if (session?.user?.email) fetch('/api/article?access=1&identity=1').then(r => r.ok ? r.json() : null).then(d => { if (!cancelled) setIsReader(d?.readerApproved === true) }).catch(() => {})
    return () => { cancelled = true }
  }, [session?.user?.email])
  useEffect(() => {
    let cancelled = false
    fetchAccessibleSlugs().then((slugs) => !cancelled && setAccess(new Set(slugs)))
    return () => {
      cancelled = true
    }
  }, [])

  // Live index (code + admin-published pieces, with current access modes).
  // Falls back to the bundled list while it loads or if it fails.
  const [liveIssues, setLiveIssues] = useState<Issue[] | null>(null)
  useEffect(() => {
    let cancelled = false
    fetch('/api/article?index=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (cancelled || !d?.pieces) return
        setLiveIssues(
          d.pieces.map((p: any) => ({
            number: p.number ?? 0,
            slug: p.slug,
            title: p.title,
            dek: p.dek || '',
            market: p.market || '',
            date: p.date || '',
            readTime: p.readTime || '',
            public: p.mode === 'open',
          }))
        )
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])
  const listed = liveIssues || []

  useEffect(() => setPanel(state), [state])

  // A scroll offset can accumulate on the stage itself (focus or chained scroll while a sheet is open);
  // it survives a panel switch and pushes the fresh sheet under the strips. Reset it on every panel change.
  useEffect(() => {
    if (stage.current) stage.current.scrollTop = 0
  }, [panel])

  useEffect(() => {
    if (panel === 'default') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel('default')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  const toggle = (next: string) => setPanel((p) => (p === next ? 'default' : next))

  const submitRequest = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setSendError(null)
    try {
      onRequest?.(value, piece, null)
      {
        const res = await fetch('/api/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: value, role: null, piece }),
        })
        if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      }
      setPanel('requested')
    } catch {
      setSendError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const freePiece = listed.find((i) => !isGated(i))
  const newest = listed.slice().sort((a, b) => b.number - a.number)[0]
  if (isReader && session?.user?.email) return <ReaderHome listed={listed} email={session.user.email} onSignOut={signOutTop} newest={newest} />

  return (
    <div className="stoa-fill flex flex-col bg-ink font-sans text-ink">
      {/* Notice strip */}
      <div className="flex select-none items-center gap-3 px-4 py-2 text-[13px] text-paper sm:px-5">
        <span className={session ? "hidden min-w-0 truncate text-paper/75 sm:block" : "min-w-0 truncate text-paper/75"}>
          Built on conversations with experts.
        </span>
        {session ? (
          <span className="ml-auto flex min-w-0 items-center gap-3 whitespace-nowrap text-paper/75">
            <span className="min-w-0 truncate">Signed in as {session.user?.email}</span>
            <button onClick={signOutTop} className="underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline">Sign out</button>
          </span>
        ) : (
        <button
          onClick={() => toggle('signin')}
          aria-expanded={panel === 'signin'}
          className="ml-auto shrink-0 whitespace-nowrap text-paper/75 underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline"
        >
          Sign in
        </button>
        )}
      </div>

      {/* Landscape */}
      <main ref={stage} className="relative min-h-0 flex-1 overflow-x-clip overflow-y-hidden">
        {/* Painting, always filling the space; cropped to keep the stoa and harbour in view */}
        <div className="absolute" style={cover}>
          <img
            src={LANDSCAPE}
            draggable={false}
            alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Top row */}
        <div className="relative z-10 flex items-start justify-end gap-4 p-4 sm:p-6">
          <div className="relative flex items-center gap-4">
            <button
              onClick={() => toggle('research')}
              aria-expanded={panel === 'research'}
              className="whitespace-nowrap bg-paper/80 px-3.5 py-2 text-sm text-ink shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,transform] duration-200 ease-soft hover:bg-paper hover:shadow-md active:scale-[0.97] active:duration-100 aria-expanded:bg-paper motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0"
            >
              Research
            </button>
            {!isReader && (
            <button
              onClick={() => {
                setPiece(null)
                toggle(panel === 'requested' ? 'requested' : 'request')
              }}
              className="group inline-flex items-center gap-1.5 whitespace-nowrap bg-paper px-3.5 py-2 text-sm font-medium text-ink shadow-sm transition-[box-shadow,transform] duration-200 ease-soft hover:shadow-md active:scale-[0.97] active:duration-100 motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0"
            >
              Request access{' '}
              <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-soft motion-safe:group-hover:translate-x-0.5" />
            </button>
            )}
          </div>
        </div>

            {/* Clicking anywhere outside the sheet closes it */}
            {panel !== 'default' && (
              <div aria-hidden="true" className="absolute inset-0 z-[15]" onClick={() => setPanel('default')} />
            )}

            {/* Sheet: a dark leaf from the right, of a piece with the strips above and below */}
            <AnimatePresence mode="wait">
              {panel !== 'default' && (
                <motion.div
                  key={panel}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={reduce ? { opacity: 0 } : { opacity: 0, x: 24 }}
                  transition={{ duration: 0.24, ease: [0.23, 1, 0.32, 1] }}
                  className="absolute inset-y-0 right-0 z-20 flex w-[86%] flex-col overflow-y-auto overscroll-contain bg-ink px-6 pb-8 pt-6 text-paper sm:w-[420px] sm:px-8"
                >
                  {panel === 'research' && (
                    <ul className="-mt-3">
                      {listed.map((issue) => (
                        <li key={issue.slug} className="border-t border-paper/10 first:border-t-0">
                          <button
                            onClick={() => {
                              if (!isGated(issue) || access.has(issue.slug)) {
                                window.location.href = `/research/${issue.slug}`
                                return
                              }
                              setPiece(issue.title)
                              setPanel('request')
                            }}
                            className="group flex w-full items-start gap-4 py-5 text-left"
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block font-serif text-xl font-light leading-snug text-paper/85 transition-colors duration-150 ease-soft group-hover:text-paper">
                                {issue.title}
                              </span>
                              <span className="mt-2 flex gap-4 text-xs text-paper/45">
                                <span>{issue.market}</span>
                                <span>{issue.date}</span>
                              </span>
                            </span>
                            {isGated(issue) && !access.has(issue.slug) && (
                              <Lock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-paper/30 transition-colors duration-150 ease-soft group-hover:text-paper/80" strokeWidth={1.5} />
                            )}
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {panel === 'request' && (
                    <form onSubmit={submitRequest}>
                      <h2 className="font-serif text-2xl font-light">Request access</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        {piece ? (
                          <>
                            For <span className="text-paper">{piece}</span> and the research library. We read every
                            request and reply personally.
                          </>
                        ) : (
                          'Stoa circulates privately. One request covers the whole research library. We read every request and reply personally.'
                        )}
                      </p>
                      <label htmlFor="stoa-email" className="sr-only">Work email</label>
                      <input
                        id="stoa-email"
                        type="email"
                        required
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="you@company.com"
                        className="mt-6 block w-full border-b border-paper/25 bg-transparent py-2.5 text-sm leading-6 text-paper outline-none transition-[border-color] duration-150 ease-soft placeholder:text-paper/35 hover:border-paper/45 focus:border-paper"
                      />
                      <button
                        type="submit"
                        className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100 disabled:opacity-60"
                      >
                        {sending ? 'Sending…' : 'Send request'}
                      </button>
                      {sendError && <p className="mt-3 text-sm leading-relaxed text-paper/60">{sendError}</p>}
                    </form>
                  )}

                  {panel === 'signin' && (
                    <DarkSignIn onRequestAccess={() => { setPiece(null); setPanel('request') }} />
                  )}

                  {panel === 'requested' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">Thank you. We read every request.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        We'll be in touch.
                      </p>
                      {freePiece && <div className="mt-8 border-t border-paper/10 pt-5"><p className="text-xs text-paper/50">Open to everyone while you wait</p><a href={`/research/${freePiece.slug}`} className="group mt-2 flex w-full items-start gap-3 text-left"><span className="min-w-0 flex-1 font-serif text-xl font-light leading-snug text-paper/85">{freePiece.title}</span><ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-paper/50" /></a></div>}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>

        {/* Wordmark */}
        <h1
          aria-label="Stoa"
          className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-[14%] select-none text-center font-serif text-[34vw] font-light uppercase leading-[0.78] tracking-[-0.02em] text-white/75"
        >
          Stoa
        </h1>
      </main>

      {/* Footer */}
      <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 px-4 py-2.5 text-xs text-paper/70 sm:px-5">
        <span>© 2026 Stoa</span>
        <span>Nothing here is investment advice.</span>
      </footer>
    </div>
  )
}

/** The painting's aspect ratio. */
const RATIO = 16 / 9
/** The band of the painting to keep in view: the stoa, the fields and the harbour, in % of the image. */
const BAND = { x0: 30, x1: 90, y0: 25, y1: 65 }

/** Size the painting to cover the stage, choosing the crop so that band stays visible. */
function useCover(ref: React.RefObject<HTMLElement | null>): React.CSSProperties {
  const [box, setBox] = useState({ w: 1280, h: 720 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => setBox({ w: el.clientWidth, h: el.clientHeight })
    measure()
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])

  const width = Math.max(box.w, box.h * RATIO)
  const height = width / RATIO
  const left = -crop(width - box.w, width, box.w, BAND.x0, BAND.x1)
  const top = -crop(height - box.h, height, box.h, BAND.y0, BAND.y1)
  return { width, height, left, top }
}

/** How much to cut off the start: centred if the band fits either way, else shifted to keep it. */
function crop(over: number, size: number, view: number, a: number, b: number) {
  if (over <= 0) return 0
  const min = Math.max(0, (b / 100) * size - view)
  const max = Math.min(over, (a / 100) * size)
  if (min <= max) return Math.min(Math.max(over / 2, min), max)
  const mid = ((a + b) / 200) * size - view / 2
  return Math.min(Math.max(mid, 0), over)
}

/** Dark sign-in leaf for the home sheet. Same working methods as the
 *  /signin page (email link or code, Google, passkey), restyled for the
 *  dark panel; the page stays for direct links. Sign-in never grants
 *  access by itself - approval stays account-wide on the server. */
function DarkSignIn({ onRequestAccess }: { onRequestAccess: () => void }) {
  const { data: session } = authClient.useSession()
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'sent'>('email')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [googleOn, setGoogleOn] = useState(false)
  const [emailOn, setEmailOn] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth-config')
      .then((r) => (r.ok ? r.json() : {}))
      .then((c) => {
        if (cancelled) return
        setGoogleOn(!!c.google)
        setEmailOn(!!c.email)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const done = () => window.location.reload()
  const signOut = async () => {
    await authClient.signOut().catch(() => {})
    window.location.reload()
  }
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || !emailOn) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.signIn.magicLink({ email, callbackURL: window.location.href })
      if (err) throw new Error(err.message)
      setStep('sent')
    } catch {
      setError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }
  const sendCode = async () => {
    if (sending || !emailOn) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
      if (err) throw new Error(err.message)
      setStep('code')
    } catch {
      setError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }
  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email, otp: code.trim() })
      if (err) throw new Error(err.message)
      done()
    } catch {
      setError("That code didn't work - check it and try again, or request a fresh one.")
      setSending(false)
    }
  }
  const google = async () => {
    const { error: err } = await authClient.signIn.social({ provider: 'google', callbackURL: window.location.href })
    if (err) setError('Google sign-in is not available right now - use your email instead.')
  }
  const passkey = async () => {
    const { error: err } = await authClient.signIn.passkey()
    if (err) setError('No passkey found for this device - use your email instead.')
    else done()
  }

  const input =
    'mt-6 block w-full border-b border-paper/25 bg-transparent py-2.5 text-sm leading-6 text-paper outline-none transition-[border-color] duration-150 ease-soft placeholder:text-paper/35 hover:border-paper/45 focus:border-paper'
  const primary =
    'mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100 disabled:opacity-60'
  const secondary =
    'w-full border border-paper/25 bg-transparent px-4 py-2.5 text-sm text-paper transition-colors hover:border-paper/45 disabled:opacity-60'

  return (
    <div>
      {session?.user?.email && (
        <p className="mb-4 border-b border-paper/15 pb-3 text-xs leading-relaxed text-paper/60">
          Signed in as {session.user.email}.{' '}
          <button type="button" onClick={signOut} className="underline underline-offset-2 transition-colors hover:text-paper">
            Sign out
          </button>
        </p>
      )}
      {step === 'sent' ? (
        <div>
          <h2 className="font-serif text-2xl font-light">Check your inbox.</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper/60">
            Look for a sign-in link at {email}. It works once, for the next 15 minutes. Nothing there? Check spam,
            then go back and try again.
          </p>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="mt-4 text-sm text-paper underline decoration-paper/40 underline-offset-4 transition-colors hover:decoration-paper"
          >
            Use a different email
          </button>
        </div>
      ) : step === 'code' ? (
        <form onSubmit={verifyCode}>
          <h2 className="font-serif text-2xl font-light">Check your inbox.</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper/60">
            Look for a sign-in code at {email}. It works once, for the next 15 minutes.
          </p>
          <label htmlFor="stoa-signin-code" className="sr-only">Sign-in code</label>
          <input
            id="stoa-signin-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={input}
          />
          <button type="submit" disabled={sending} className={primary}>
            {sending ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="mt-3 text-sm leading-relaxed text-paper/70">{error}</p>}
        </form>
      ) : (
        <form onSubmit={sendLink}>
          <h2 className="font-serif text-2xl font-light">Sign in</h2>
          <p className="mt-2 text-sm leading-relaxed text-paper/60">
            For readers with access. We'll email you a link to sign in, so there's no password to keep.
          </p>
          <label htmlFor="stoa-signin-email" className="sr-only">Email</label>
          <input
            id="stoa-signin-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={input}
          />
          <button type="submit" disabled={sending || !emailOn} className={primary}>
            {sending ? 'Sending…' : 'Email me a link'}
          </button>
          <p className="mt-3 text-xs leading-relaxed text-paper/60">
            Opening it on another device?{' '}
            <button type="button" onClick={sendCode} disabled={sending || !emailOn} className="underline underline-offset-2 transition-colors hover:text-paper">
              Send a code instead
            </button>
          </p>
          <div className="my-4 flex items-center gap-3 text-xs text-paper/50">
            <span className="h-px flex-1 bg-paper/25" />
            or
            <span className="h-px flex-1 bg-paper/25" />
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={google} disabled={!googleOn} className={secondary}>
              Continue with Google
            </button>
            <button type="button" onClick={passkey} className={secondary}>
              Sign in with a passkey
            </button>
          </div>
          {error && <p className="mt-3 text-sm leading-relaxed text-paper/70">{error}</p>}
          <p className="mt-6 text-sm text-paper/60">
            No access yet?{' '}
            <button type="button" onClick={onRequestAccess} className="underline underline-offset-2 transition-colors hover:text-paper">
              Request access
            </button>
          </p>
        </form>
      )}
    </div>
  )
}

