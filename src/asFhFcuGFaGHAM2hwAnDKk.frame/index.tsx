import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ArrowRight, Lock } from 'lucide-react'

import { issues } from '../shared/stoa/issues'
import { markets } from '../shared/stoa/markets'
import { RoleChoice, type Role } from '../shared/stoa/RoleChoice'

export const args = {
  state: 'default',
  email: '',
}

export const argTypes = {
  state: { control: 'select', options: ['default', 'research', 'request', 'requested'] },
  email: { control: 'text' },
}

type Props = Partial<typeof args> & {
  onRequest?: (email: string, piece: string | null, role: Role | null) => void
}

const LANDSCAPE = '/landscape.jpg'

export default function StoaHome(props: Props) {
  const { state, email, onRequest } = { ...args, ...props }
  const [panel, setPanel] = useState(state)
  const [piece, setPiece] = useState<string | null>(null)
  const [value, setValue] = useState(email)
  const [hovered, setHovered] = useState<string | null>(null)
  const [role, setRole] = useState<Role | null>(null)
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState<string | null>(null)
  const reduce = useReducedMotion()
  const stage = useRef<HTMLElement>(null)
  const cover = useCover(stage)

  useEffect(() => setPanel(state), [state])

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
      onRequest?.(value, piece, role)
      const res = await fetch('/api/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: value, role, piece }),
      })
      if (!res.ok) throw new Error(`Request failed: ${res.status}`)
      setPanel('requested')
    } catch {
      setSendError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="flex h-screen flex-col bg-ink font-sans text-ink">
      {/* Notice strip */}
      <div className="flex select-none items-center gap-3 px-4 py-2 text-[13px] text-paper sm:px-5">
        <span className="min-w-0 truncate text-paper/75">
          Built on conversations with experts.
        </span>

      </div>

      {/* Landscape */}
      <main ref={stage} className="relative min-h-0 flex-1 overflow-hidden">
        {/* Painting, always filling the space; cropped so every market spot stays in view */}
        <div className="absolute" style={cover} onPointerUp={(e) => e.pointerType !== 'mouse' && setHovered(null)}>
          <img
            src={LANDSCAPE}
            alt="A painted valley around a stoa, above the sea."
            className="absolute inset-0 h-full w-full"
          />
          {/* Unmarked until hovered; then a fine leader line rises from the spot to its name, like a map annotation */}
          {markets.map((m) => (
            <div
              key={m.id}
              aria-hidden="true"
              className="absolute"
              style={{ left: `${m.x}%`, top: `${m.y}%`, width: `${m.w}%`, height: `${m.h}%` }}
              onPointerEnter={(e) => e.pointerType === 'mouse' && setHovered(m.id)}
              onPointerLeave={(e) => e.pointerType === 'mouse' && setHovered((h) => (h === m.id ? null : h))}
              onPointerUp={(e) => {
                if (e.pointerType === 'mouse') return
                e.stopPropagation()
                setHovered((h) => (h === m.id ? null : m.id))
              }}
            >
              <AnimatePresence>
                {hovered === m.id && (
                  <div className="pointer-events-none absolute bottom-[55%] left-1/2 flex -translate-x-1/2 flex-col items-center">
                    <motion.span
                      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0, transition: { duration: 0.2, delay: reduce ? 0 : 0.06, ease: [0.23, 1, 0.32, 1] } }}
                      exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
                      className="whitespace-nowrap font-serif text-[17px] font-medium leading-none text-white [text-shadow:0_1px_2px_rgba(27,25,21,0.6),0_0_14px_rgba(27,25,21,0.45)]"
                    >
                      {m.name}
                    </motion.span>
                    <motion.span
                      initial={reduce ? { opacity: 0 } : { scaleY: 0, opacity: 0 }}
                      animate={{ scaleY: 1, opacity: 1, transition: { duration: 0.2, ease: [0.23, 1, 0.32, 1] } }}
                      exit={{ opacity: 0, transition: { duration: 0.12, ease: [0.23, 1, 0.32, 1] } }}
                      style={{ transformOrigin: 'bottom' }}
                      className="mt-2 block h-8 w-px bg-white/85 shadow-[0_0_3px_rgba(27,25,21,0.5)]"
                    />
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1, transition: { duration: 0.12 } }}
                      exit={{ opacity: 0, transition: { duration: 0.12 } }}
                      className="block h-1.5 w-1.5 rounded-full bg-white shadow-[0_0_0_2px_rgba(27,25,21,0.25)]"
                    />
                  </div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>

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
                      {issues.map((issue) => (
                        <li key={issue.slug} className="border-t border-paper/10 first:border-t-0">
                          <button
                            onClick={() => {
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
                            <Lock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-paper/30 transition-colors duration-150 ease-soft group-hover:text-paper/80" strokeWidth={1.5} />
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
                        className="mt-6 w-full border-b border-paper/25 bg-transparent py-2.5 text-sm text-paper outline-none transition-[border-color] duration-150 ease-soft placeholder:text-paper/35 hover:border-paper/45 focus:border-paper"
                      />
                      <button
                        type="submit"
                        disabled
                        className="mt-6 w-full bg-paper px-4 py-2.5 text-sm font-medium text-ink transition-[background-color,transform] duration-150 ease-soft hover:bg-paper/90 active:scale-[0.98] active:duration-100 disabled:opacity-60"
                      >
                        {sending ? 'Sending…' : 'Send request'}
                      </button>
                      <p className="mt-3 text-sm leading-relaxed text-paper/45">Requests are temporarily unavailable.</p>
                    </form>
                  )}

                  {panel === 'requested' && (
                    <div>
                      <h2 className="font-serif text-2xl font-light">Thank you.</h2>
                      <p className="mt-2 text-sm leading-relaxed text-paper/60">
                        We'll be in touch from research@stoacap.com.
                      </p>
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
        <span>
          © 2026 Stoa by{' '}
          <a
            href="https://astori.vc"
            target="_blank"
            rel="noreferrer"
            className="text-paper/90 underline decoration-paper/30 underline-offset-2 transition-colors duration-150 hover:decoration-paper"
          >
            Astori Ventures
          </a>
        </span>
        <span>Nothing here is investment advice.</span>
      </footer>
    </div>
  )
}

/** The painting's aspect ratio. */
const RATIO = 16 / 9
/** The band of the painting the market spots sit in, in % of the image, with a little margin. */
const BAND = {
  x0: Math.min(...markets.map((m) => m.x)) - 1,
  x1: Math.max(...markets.map((m) => m.x + m.w)) + 1,
  y0: Math.min(...markets.map((m) => m.y)) - 2,
  y1: Math.max(...markets.map((m) => m.y + m.h)) + 2,
}

/** Size the painting to cover the stage, choosing the crop so the market band stays visible. */
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
