import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'

import { issues } from '../shared/issues'
import { RoleChoice, type Role } from '../shared/RoleChoice'

export const args = {
  state: 'default',
  access: 'signed-out',
  email: '',
}

export const argTypes = {
  state: {
    control: 'select',
    options: ['default', 'research', 'request', 'requested', 'signin', 'link-sent', 'pending', 'unknown'],
  },
  access: { control: 'radio', options: ['signed-out', 'member'] },
  email: { control: 'text' },
}

/** What a sign-in attempt comes back with: a link on its way, a request not yet approved, or no record. */
export type SignInResult = 'link-sent' | 'pending' | 'unknown'

type Props = Partial<typeof args> & {
  onRequest?: (email: string, piece: string | null, role: Role | null, note: string) => void
  onSignIn?: (email: string) => SignInResult
  onSignOut?: () => void
  onOpen?: (slug: string) => void
}

const LANDSCAPE =
  'https://cdn.magicpatterns.com/patterns/generated-images/b0bf13ef-f12a-4c62-a389-1006db7fc300.jpg'

export default function StoaHome(props: Props) {
  const { state, access, email, onRequest, onSignIn, onSignOut, onOpen } = { ...args, ...props }
  const member = access === 'member'
  const [panel, setPanel] = useState(state)
  const [piece, setPiece] = useState<string | null>(null)
  const [value, setValue] = useState(email)
  const [role, setRole] = useState<Role | null>(null)
  const [note, setNote] = useState('')
  const reduce = useReducedMotion()
  const stage = useRef<HTMLElement>(null)
  const cover = useCover(stage)

  useEffect(() => setPanel(state), [state])

  // Once the emailed link signs the reader in, open the list they can now read.
  useEffect(() => {
    if (member) setPanel((p) => (p === 'link-sent' ? 'research' : p))
  }, [member])

  useEffect(() => {
    if (panel === 'default') return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setPanel('default')
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [panel])

  const freePiece = issues.find((i) => i.free)

  const toggle = (next: string) => setPanel((p) => (p === next ? 'default' : next))

  return (
    <div className="flex h-screen flex-col bg-ink font-sans text-ink">
      {/* Notice strip */}
      <div className="flex select-none items-center gap-3 px-4 py-2 text-[13px] text-paper sm:px-5">
        <span className="min-w-0 flex-1 truncate text-paper/75">
          Built on conversations with experts.
        </span>
        {member ? (
          <span className="flex shrink-0 items-center gap-3">
            <span className="hidden text-paper/50 sm:inline">{email || 'Signed in'}</span>
            <button
              onClick={onSignOut}
              className="whitespace-nowrap text-paper/75 underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline"
            >
              Sign out
            </button>
          </span>
        ) : (
          <button
            onClick={() => toggle('signin')}
            aria-expanded={panel === 'signin'}
            className="shrink-0 whitespace-nowrap text-paper/75 underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline aria-expanded:text-paper aria-expanded:underline"
          >
            Sign in
          </button>
        )}
      </div>

      {/* Landscape, edge to edge between the ink strips above and below */}
      <div className="flex min-h-0 flex-1">
      <main ref={stage} className="relative min-w-0 flex-1 overflow-hidden">
        {/* Painting, always filling the space; cropped to keep the stoa and harbour in view */}
        <div className="absolute" style={cover}>
          <img
            src={LANDSCAPE}
            alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
            className="absolute inset-0 h-full w-full"
          />
        </div>

        {/* Recessed edge where the canvas meets the frame */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_0_0_1px_rgba(255,255,255,0.08),inset_0_2px_12px_rgba(0,0,0,0.45)]"
        />

        {/* Top row */}
        <div className="relative z-10 flex items-start justify-end gap-4 p-4 sm:p-6">
          <div className="relative flex items-center gap-2">
            <button
              onClick={() => toggle('research')}
              aria-expanded={panel === 'research'}
              className="whitespace-nowrap bg-paper/80 px-3.5 py-2 text-sm text-ink shadow-sm backdrop-blur-sm transition-[background-color,box-shadow,transform] duration-200 ease-soft hover:bg-paper hover:shadow-md active:scale-[0.97] active:duration-100 aria-expanded:bg-paper motion-safe:hover:-translate-y-px motion-safe:active:translate-y-0"
            >
              Research
            </button>
            {!member && (
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
                  className="absolute inset-y-0 right-0 z-20 flex w-[86%] flex-col overflow-y-auto bg-ink px-6 pb-8 pt-6 text-paper sm:w-[420px] sm:px-8"
                >
                  {panel === 'research' && (
                    <ul className="-mt-3">
                      {issues.map((issue) => {
                        const locked = !member && !issue.free
                        return (
                        <li key={issue.slug} className="border-t border-paper/10 first:border-t-0">
                          <button
                            onClick={() => {
                              if (!locked) return onOpen?.(issue.slug)
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
                            {locked && (
                              <Lock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-paper/30 transition-colors duration-150 ease-soft group-hover:text-paper/80" strokeWidth={1.5} />
                            )}
                          </button>
                        </li>
                        )
                      })}
                    </ul>
                  )}

                  {panel === 'request' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        onRequest?.(value, piece, role, note.trim())
                        setPanel('requested')
                      }}
                    >
                      <h2 className="font-serif text-2xl font-light">Request access</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        {piece ? (
                          <>
                            For <span className="text-paper">{piece}</span>. We read every request and reply personally.
                          </>
                        ) : (
                          'Stoa circulates privately. We read every request and reply personally.'
                        )}
                      </p>
                      <RoleChoice value={role} onChange={setRole} tone="dark" />
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
                      <label htmlFor="stoa-note" className="sr-only">Anything we should know (optional)</label>
                      <div className="mt-4 flex items-start gap-3 border-b border-paper/25 transition-[border-color] duration-150 ease-soft hover:border-paper/45 focus-within:border-paper">
                        <textarea
                          id="stoa-note"
                          rows={1}
                          maxLength={280}
                          value={note}
                          onChange={(e) => setNote(e.target.value)}
                          placeholder="Anything we should know?"
                          className="block max-h-32 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-sm leading-6 text-paper outline-none [field-sizing:content] placeholder:text-paper/35"
                        />
                        <span aria-hidden className="shrink-0 py-2.5 text-xs leading-6 text-paper/40">Optional</span>
                      </div>
                      <button
                        type="submit"
                        className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100"
                      >
                        Send request
                      </button>
                      <p className="mt-5 text-sm text-paper/55">
                        Already have access?{' '}
                        <button
                          type="button"
                          onClick={() => setPanel('signin')}
                          className="text-paper underline decoration-paper/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-paper"
                        >
                          Sign in
                        </button>
                      </p>
                    </form>
                  )}

                  {panel === 'signin' && (
                    <form
                      onSubmit={(e) => {
                        e.preventDefault()
                        setPanel(onSignIn?.(value) ?? 'link-sent')
                      }}
                    >
                      <h2 className="font-serif text-2xl font-light">Sign in</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        For readers with access. We'll email you a link to sign in, so there's no password to keep.
                      </p>
                      <label htmlFor="stoa-signin-email" className="sr-only">Email</label>
                      <input
                        id="stoa-signin-email"
                        type="email"
                        required
                        autoFocus
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        placeholder="you@company.com"
                        className="mt-6 w-full border-b border-paper/25 bg-transparent py-2.5 text-sm text-paper outline-none transition-[border-color] duration-150 ease-soft placeholder:text-paper/35 hover:border-paper/45 focus:border-paper"
                      />
                      <button
                        type="submit"
                        className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100"
                      >
                        Email me a link
                      </button>
                      <p className="mt-5 text-sm text-paper/55">
                        No access yet?{' '}
                        <button
                          type="button"
                          onClick={() => {
                            setPiece(null)
                            setPanel('request')
                          }}
                          className="text-paper underline decoration-paper/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-paper"
                        >
                          Request access
                        </button>
                      </p>
                    </form>
                  )}

                  {panel === 'link-sent' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">Check your inbox.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        We sent a sign-in link to <span className="text-paper">{value || 'your email'}</span>. It works
                        once, for the next 15 minutes.
                      </p>
                      <button
                        onClick={() => setPanel('signin')}
                        className="mt-6 text-sm text-paper underline decoration-paper/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-paper"
                      >
                        Use a different email
                      </button>
                    </div>
                  )}

                  {panel === 'pending' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">Your request is with us.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        <span className="text-paper">{value || 'Your email'}</span> hasn't been approved yet. We read
                        every request and will reply personally from research@stoacap.com.
                      </p>
                      <button
                        onClick={() => setPanel('signin')}
                        className="mt-6 text-sm text-paper underline decoration-paper/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-paper"
                      >
                        Use a different email
                      </button>
                    </div>
                  )}

                  {panel === 'unknown' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">We don't have that email.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        <span className="text-paper">{value || 'That address'}</span> isn't on the reader list. Stoa
                        circulates privately, so ask and we'll reply personally.
                      </p>
                      <button
                        onClick={() => {
                          setPiece(null)
                          setPanel('request')
                        }}
                        className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100"
                      >
                        Request access
                      </button>
                      <button
                        onClick={() => setPanel('signin')}
                        className="mt-5 text-sm text-paper underline decoration-paper/30 underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-paper"
                      >
                        Try another email
                      </button>
                    </div>
                  )}

                  {panel === 'requested' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">Thank you. We read every request.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        You'll hear from one of us within a few days, from{' '}
                        <span className="text-paper">research@stoacap.com</span>. Add it to your contacts so the reply
                        doesn't land in spam.
                      </p>
                      {freePiece && (
                        <div className="mt-8 border-t border-paper/10 pt-5">
                          <p className="text-xs text-paper/50">Open to everyone while you wait</p>
                          <button
                            onClick={() => onOpen?.(freePiece.slug)}
                            className="group mt-2 flex w-full items-start gap-3 text-left"
                          >
                            <span className="min-w-0 flex-1 font-serif text-xl font-light leading-snug text-paper/85 transition-colors duration-150 ease-soft group-hover:text-paper">
                              {freePiece.title}
                            </span>
                            <ArrowRight className="mt-1.5 h-4 w-4 shrink-0 text-paper/50 transition-[color,transform] duration-200 ease-soft group-hover:text-paper motion-safe:group-hover:translate-x-0.5" />
                          </button>
                        </div>
                      )}
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
      </div>

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
/** The band of the painting to keep in view: the sea, the stoa and its olives, in % of the image. */
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
