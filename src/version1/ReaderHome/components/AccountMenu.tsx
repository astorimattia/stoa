import React, { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { ChevronDown } from 'lucide-react'

type Props = {
  email: string
  onSignOut?: () => void
  onInvite?: (email: string) => void
}

/** The reader's account, behind their email in the notice strip: email cadence, invite a colleague, sign out. */
export function AccountMenu({ email, onSignOut, onInvite }: Props) {
  const [open, setOpen] = useState(false)
  const [view, setView] = useState<'menu' | 'invite' | 'invited'>('menu')
  const [cadence, setCadence] = useState<Cadence>('each')
  const [colleague, setColleague] = useState('')
  const reduce = useReducedMotion()
  const root = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    const onDown = (e: MouseEvent) => !root.current?.contains(e.target as Node) && setOpen(false)
    window.addEventListener('keydown', onKey)
    window.addEventListener('mousedown', onDown)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('mousedown', onDown)
    }
  }, [open])

  return (
    <div ref={root} className="relative shrink-0">
      <button
        onClick={() => {
          setView('menu')
          setOpen((o) => !o)
        }}
        aria-expanded={open}
        aria-haspopup="menu"
        className="inline-flex items-center gap-1.5 whitespace-nowrap font-sans text-paper/75 transition-colors duration-150 ease-soft hover:text-paper aria-expanded:text-paper"
      >
        <span className="max-w-[40vw] truncate">{email}</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform duration-200 ease-soft ${open ? 'rotate-180' : ''}`}
          strokeWidth={1.5}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduce ? { opacity: 0 } : { opacity: 0, y: -4, scale: 0.98 }}
            transition={{ duration: 0.16, ease: [0.23, 1, 0.32, 1] }}
            className="absolute right-0 top-full mt-3 w-[min(19rem,calc(100vw-2rem))] origin-top-right border border-rule bg-paper font-sans text-sm text-ink shadow-[0_12px_32px_rgba(27,25,21,0.18)]"
          >
            {view === 'menu' && (
              <>
                <div className="border-b border-rule px-4 py-4">
                  <p className="text-xs text-muted">New pieces by email</p>
                  <div role="radiogroup" aria-label="New pieces by email" className="mt-2.5 space-y-1.5">
                    {CADENCES.map((c) => (
                      <label key={c.id} className="flex items-center gap-2.5">
                        <input
                          type="radio"
                          name="cadence"
                          checked={cadence === c.id}
                          onChange={() => setCadence(c.id)}
                          className="h-3.5 w-3.5 accent-ink"
                        />
                        <span className={cadence === c.id ? 'text-ink' : 'text-muted'}>{c.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <button
                  role="menuitem"
                  onClick={() => setView('invite')}
                  className="block w-full px-4 py-3 text-left transition-colors duration-150 ease-soft hover:bg-paper-deep"
                >
                  Invite a colleague
                </button>
                <button
                  role="menuitem"
                  onClick={() => {
                    setOpen(false)
                    onSignOut?.()
                  }}
                  className="block w-full border-t border-rule px-4 py-3 text-left text-muted transition-colors duration-150 ease-soft hover:bg-paper-deep hover:text-ink"
                >
                  Sign out
                </button>
              </>
            )}

            {view === 'invite' && (
              <form
                className="px-4 py-4"
                onSubmit={(e) => {
                  e.preventDefault()
                  onInvite?.(colleague)
                  setView('invited')
                }}
              >
                <p className="font-serif text-lg leading-snug">Invite a colleague</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  They go to the front of the queue, with your name beside the request.
                </p>
                <label htmlFor="invite-email" className="sr-only">Their work email</label>
                <input
                  id="invite-email"
                  type="email"
                  required
                  autoFocus
                  value={colleague}
                  onChange={(e) => setColleague(e.target.value)}
                  placeholder="their@company.com"
                  className="mt-3 w-full border-b border-rule bg-transparent py-2 outline-none transition-[border-color] duration-150 ease-soft placeholder:text-muted/70 focus:border-ink"
                />
                <div className="mt-4 flex items-center gap-4">
                  <button
                    type="submit"
                    className="bg-ink px-4 py-2 font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98]"
                  >
                    Send invite
                  </button>
                  <button type="button" onClick={() => setView('menu')} className="text-muted hover:text-ink">
                    Back
                  </button>
                </div>
              </form>
            )}

            {view === 'invited' && (
              <div className="px-4 py-4">
                <p className="font-serif text-lg leading-snug">Invite sent.</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">
                  {colleague} will hear from research@stoacap.com, mentioning you.
                </p>
                <button
                  onClick={() => {
                    setColleague('')
                    setView('menu')
                  }}
                  className="mt-4 text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                >
                  Done
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

type Cadence = 'each' | 'monthly' | 'off'

const CADENCES: { id: Cadence; label: string }[] = [
  { id: 'each', label: 'As each one is published' },
  { id: 'monthly', label: 'Once a month' },
  { id: 'off', label: 'Don\u2019t email me' },
]
