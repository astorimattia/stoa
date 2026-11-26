import React, { useState } from 'react'
import { ArrowRight } from 'lucide-react'

import { issues, featured } from '../shared/issues'
import { historyFor, type Progress } from '../shared/reading'
import { Wordmark } from '../shared/Logo'
import { AccountMenu } from './components/AccountMenu'

export const args = {
  state: 'returning',
  name: 'Mara',
  email: 'mara@kiln.co',
  lastVisit: '12 Oct',
}

export const argTypes = {
  state: { control: 'radio', options: ['returning', 'first-visit', 'caught-up'] },
  name: { control: 'text' },
  email: { control: 'text' },
  lastVisit: { control: 'text' },
}

type Props = Partial<typeof args> & {
  onOpen?: (slug: string) => void
  onSignOut?: () => void
  onInvite?: (email: string) => void
}

const LANDSCAPE =
  'https://cdn.magicpatterns.com/patterns/generated-images/b0bf13ef-f12a-4c62-a389-1006db7fc300.jpg'

export default function ReaderHome(props: Props) {
  const { state, name, email, lastVisit, onOpen, onSignOut, onInvite } = { ...args, ...props }
  const [colleague, setColleague] = useState('')
  const [invited, setInvited] = useState(false)
  const history = historyFor(state)
  const firstVisit = state === 'first-visit'

  const fresh = issues.filter((i) => history[i.slug]?.status === 'new')
  const startedSlug = Object.keys(history).find((s) => history[s].status === 'started')
  const started = issues.find((i) => i.slug === startedSlug)
  const caughtUp = !firstVisit && fresh.length === 0 && !started

  /** The piece the page leads with: the newest new one, or a place to start. Nothing, once they've read it all. */
  const lead = caughtUp ? undefined : issues.find((i) => i.slug === (fresh[0]?.slug ?? featured))
  const alsoNew = fresh.filter((i) => i.slug !== lead?.slug)

  /** Everything not already shown above it, so no piece appears twice. */
  const shown = new Set([lead?.slug, started?.slug, ...alsoNew.map((i) => i.slug)])
  const archive = issues.filter((i) => !shown.has(i.slug))

  const greeting = firstVisit ? `Welcome to Stoa, ${name}.` : `Welcome back, ${name}.`
  const summary = firstVisit
    ? `Your access is approved. All ${count(issues.length).toLowerCase()} pieces are open to you.`
    : fresh.length > 0
      ? `${count(fresh.length)} new ${fresh.length === 1 ? 'piece' : 'pieces'} since ${lastVisit}.`
      : `Last here ${lastVisit}.`

  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      {/* Masthead: the wordmark moves into the strip once you're inside; the account sits opposite */}
      <header className="relative z-30 flex select-none items-center gap-4 bg-ink px-4 py-2.5 text-[13px] text-paper sm:px-6">
        <h1 className="min-w-0 flex-1">
          <Wordmark className="text-[22px]" />
        </h1>
        <AccountMenu email={email} onSignOut={onSignOut} onInvite={onInvite} />
      </header>

      {/* The painting, kept as a thin band: the same place as the front door, without the front door */}
      <div className="relative h-20 overflow-hidden sm:h-28">
        <img
          src={LANDSCAPE}
          alt=""
          className="absolute inset-0 h-full w-full object-cover object-[60%_42%]"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 shadow-[inset_0_2px_10px_rgba(0,0,0,0.4)]"
        />
      </div>

      {/* Greeting and what's new */}
      <section className="mx-auto max-w-6xl px-6 pt-10 lg:px-10 lg:pt-14">
        <div className="flex flex-wrap items-baseline justify-between gap-x-8 gap-y-2 border-b border-rule pb-5">
          <h2 className="text-3xl font-light tracking-tight sm:text-4xl">{greeting}</h2>
          <p className="font-sans text-sm text-muted">{summary}</p>
        </div>

        <div className="grid gap-12 pt-10 lg:grid-cols-[minmax(0,1fr)_300px] lg:gap-20">
          {caughtUp && (
            <div className="min-w-0">
              <p className="max-w-3xl text-4xl font-light leading-[1.08] tracking-tight sm:text-5xl">
                You’ve read everything in Stoa.
              </p>
              <p className="mt-5 max-w-2xl text-xl leading-relaxed text-ink/75">
                The next piece, on who controls the nuclear fuel supply chain, is due in early December. We’ll
                email you the day it’s published.
              </p>
            </div>
          )}

          {lead && (
          <article className="min-w-0">
            <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
              {fresh[0]?.slug === lead.slug ? (
                <span className="font-medium text-accent">New</span>
              ) : (
                <span className="font-medium text-ink">Start here</span>
              )}
              <span>{lead.market}</span>
              <span>{lead.date}</span>
            </p>
            <button onClick={() => onOpen?.(lead.slug)} className="group mt-4 block text-left">
              <span className="block max-w-3xl text-4xl font-light leading-[1.08] tracking-tight decoration-rule decoration-1 underline-offset-[6px] group-hover:underline sm:text-5xl lg:text-[56px]">
                {lead.title}
              </span>
            </button>
            <p className="mt-5 max-w-2xl text-xl leading-relaxed text-ink/75">{lead.dek}</p>
            <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 font-sans text-sm">
              <button
                onClick={() => onOpen?.(lead.slug)}
                className="group inline-flex items-center gap-2 whitespace-nowrap bg-ink px-5 py-2.5 font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100"
              >
                Read
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-soft motion-safe:group-hover:translate-x-0.5" />
              </button>
              <span className="text-muted">{lead.readTime} read</span>
            </div>

            {alsoNew.map((i) => (
              <button
                key={i.slug}
                onClick={() => onOpen?.(i.slug)}
                className="group mt-12 block w-full border-t border-rule pt-6 text-left"
              >
                <span className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
                  <span className="font-medium text-accent">Also new</span>
                  <span>{i.market}</span>
                  <span>{i.readTime} read</span>
                </span>
                <span className="mt-2 block max-w-2xl text-2xl font-light leading-snug decoration-rule decoration-1 underline-offset-4 group-hover:underline sm:text-3xl">
                  {i.title}
                </span>
                <span className="mt-2 block max-w-2xl text-lg leading-relaxed text-ink/70">{i.dek}</span>
              </button>
            ))}
          </article>
          )}

          {/* Caught up: the one useful thing left to do here is bring someone in */}
          {caughtUp && (
            <aside className="self-start border-t border-ink pt-5">
              <h3 className="font-sans text-sm text-muted">While you wait</h3>
              {invited ? (
                <>
                  <p className="mt-3 text-2xl font-light leading-snug">Invite sent.</p>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
                    {colleague} will hear from research@stoacap.com, mentioning you.
                  </p>
                  <button
                    onClick={() => {
                      setColleague('')
                      setInvited(false)
                    }}
                    className="mt-4 font-sans text-sm font-medium underline decoration-rule underline-offset-4 transition-[text-decoration-color] duration-150 ease-soft hover:decoration-ink"
                  >
                    Invite someone else
                  </button>
                </>
              ) : (
                <form
                  onSubmit={(e) => {
                    e.preventDefault()
                    onInvite?.(colleague)
                    setInvited(true)
                  }}
                >
                  <p className="mt-3 text-2xl font-light leading-snug">Invite a colleague</p>
                  <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
                    They skip the queue, with your name beside their request.
                  </p>
                  <label htmlFor="home-invite" className="sr-only">
                    Their work email
                  </label>
                  <input
                    id="home-invite"
                    type="email"
                    required
                    value={colleague}
                    onChange={(e) => setColleague(e.target.value)}
                    placeholder="their@company.com"
                    className="mt-4 w-full border-b border-rule bg-transparent py-2 font-sans text-sm outline-none transition-[border-color] duration-150 ease-soft placeholder:text-muted/70 focus:border-ink"
                  />
                  <button
                    type="submit"
                    className="mt-5 whitespace-nowrap bg-ink px-4 py-2 font-sans text-sm font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98]"
                  >
                    Send invite
                  </button>
                </form>
              )}
            </aside>
          )}

          {/* Where they left off */}
          {started && (
            <aside className="self-start border-t border-ink pt-5 lg:sticky lg:top-8">
              <h3 className="font-sans text-sm text-muted">Continue reading</h3>
              <button onClick={() => onOpen?.(started.slug)} className="group mt-3 block text-left">
                <span className="block text-2xl font-light leading-snug decoration-rule decoration-1 underline-offset-4 group-hover:underline">
                  {started.title}
                </span>
              </button>
              <div
                className="mt-5 h-[2px] w-full bg-rule"
                role="progressbar"
                aria-valuenow={Math.round((history[started.slug].progress ?? 0) * 100)}
                aria-valuemin={0}
                aria-valuemax={100}
                aria-label="Reading progress"
              >
                <div className="h-full bg-ink" style={{ width: `${(history[started.slug].progress ?? 0) * 100}%` }} />
              </div>
              <p className="mt-3 font-sans text-sm text-muted">
                {history[started.slug].minutesLeft} min left · at {history[started.slug].section}
              </p>
              <button
                onClick={() => onOpen?.(started.slug)}
                className="group mt-5 inline-flex items-center gap-1.5 font-sans text-sm font-medium"
              >
                Pick up where you stopped
                <ArrowRight className="h-4 w-4 transition-transform duration-200 ease-soft motion-safe:group-hover:translate-x-0.5" />
              </button>
            </aside>
          )}
        </div>
      </section>

      {/* The rest of Stoa: only what isn't already above */}
      <section className="mx-auto max-w-6xl px-6 pb-24 pt-20 lg:px-10">
        <div className="flex flex-wrap items-baseline justify-between gap-4 border-b border-ink pb-4">
          <h2 className="text-3xl font-light tracking-tight">
            {caughtUp ? 'Everything you’ve read' : firstVisit ? 'Everything else' : 'Earlier pieces'}
          </h2>
          <p className="font-sans text-sm text-muted">Newest first</p>
        </div>

        <ul>
          {archive.map((i) => {
            const p = history[i.slug]
            return (
              <li key={i.slug} className="border-b border-rule">
                <button
                  onClick={() => onOpen?.(i.slug)}
                  className="group grid w-full grid-cols-[2rem_minmax(0,1fr)] items-baseline gap-x-4 gap-y-1 py-5 text-left md:grid-cols-[2.5rem_minmax(0,1fr)_7rem_5.5rem_7.5rem] md:gap-x-6"
                >
                  <span className="font-sans text-sm tabular-nums text-muted">{i.number}</span>
                  <span className="min-w-0">
                    <span
                      className={`block text-xl leading-snug decoration-rule decoration-1 underline-offset-4 group-hover:underline ${p?.status === 'read' ? 'font-light text-ink/60' : 'font-normal'}`}
                    >
                      {i.title}
                    </span>
                    <span className="mt-1 flex flex-wrap gap-x-4 font-sans text-xs text-muted md:hidden">
                      <span>{i.market}</span>
                      <span>{i.date}</span>
                      {firstVisit ? <span>{i.readTime}</span> : <Status p={p} />}
                    </span>
                  </span>
                  <span className="hidden font-sans text-sm text-muted md:block">{i.market}</span>
                  <span className="hidden whitespace-nowrap font-sans text-sm text-muted md:block">{i.date}</span>
                  <span className="hidden whitespace-nowrap text-right font-sans text-sm text-muted md:block">
                    {firstVisit ? i.readTime : <Status p={p} />}
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      </section>

      <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 bg-ink px-4 py-2.5 font-sans text-xs text-paper/70 sm:px-5">
        <span>© 2026 Stoa</span>
        <span>Nothing here is investment advice.</span>
      </footer>
    </div>
  )
}

function Status({ p }: { p?: Progress }) {
  if (!p) return null
  if (p.status === 'new') return <span className="font-medium text-accent">New</span>
  if (p.status === 'started') return <span className="whitespace-nowrap text-ink">{p.minutesLeft} min left</span>
  if (p.status === 'read') return <span className="text-muted">Read</span>
  return null
}

function count(n: number) {
  return ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six'][n] ?? String(n)
}
