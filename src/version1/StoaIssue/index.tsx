import React, { useEffect, useState } from 'react'
import { ArrowLeft, Lock } from 'lucide-react'

import { featured, issues } from '../shared/issues'
import { RoleChoice, type Role } from '../shared/RoleChoice'

export const args = {
  state: 'default',
  access: 'signed-out',
  authors: 'Dinki & Mattia Astori',
  sources: 'Drawn from conversations with operators and founders across autonomy, trucking and defense.',
  disclosure: 'Astori Ventures holds no position in Applied Intuition at the time of publication.',
}

export const argTypes = {
  state: { control: 'radio', options: ['default', 'requested'] },
  access: { control: 'radio', options: ['signed-out', 'member'] },
  authors: { control: 'text' },
  sources: { control: 'text' },
  disclosure: { control: 'text' },
}

type Props = Partial<typeof args> & {
  onBack?: () => void
  onSignIn?: () => void
  onRequest?: (email: string, role: Role | null, note: string) => void
}

const PLATE =
  'https://cdn.magicpatterns.com/patterns/generated-images/6579bbdd-4b99-4830-927f-21b69b59f1db.jpg'

export default function StoaIssue(props: Props) {
  const { state, access, authors, sources, disclosure, onBack, onSignIn, onRequest } = { ...args, ...props }
  const member = access === 'member'
  const [requested, setRequested] = useState(state === 'requested')
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role | null>(null)
  const [note, setNote] = useState('')
  const issue = issues.find((i) => i.slug === featured)!
  const others = issues.filter((i) => i.slug !== featured)
  /** Signed-out readers of a members' piece get the opening section, then the request form. */
  const locked = !member && !issue.free
  const shown = locked ? sections.slice(0, 1) : sections

  useEffect(() => setRequested(state === 'requested'), [state])

  return (
    <div className="min-h-full bg-paper font-serif text-ink">
      {/* Notice strip, as on the home */}
      <div className="flex select-none items-center gap-3 bg-ink px-4 py-2 text-[13px] text-paper sm:px-5">
        <button
          onClick={onBack}
          aria-label="Back to Stoa"
          className="group -ml-1 inline-flex shrink-0 items-center p-1"
        >
          <ArrowLeft className="h-3.5 w-3.5 text-paper/60 transition-[color,transform] duration-200 ease-soft group-hover:text-paper motion-safe:group-hover:-translate-x-0.5" />
        </button>
        <span className="min-w-0 flex-1 truncate text-paper/75">
          Built on conversations with experts.
        </span>
        {!member && (
          <button
            onClick={onSignIn}
            className="shrink-0 whitespace-nowrap text-paper/75 underline-offset-4 transition-colors duration-150 ease-soft hover:text-paper hover:underline"
          >
            Sign in
          </button>
        )}
      </div>

      {/* Painted plate */}
      <figure className="relative">
        <img
          src={PLATE}
          alt="An oil study of stone-walled terraces, olives and cypresses on a hillside above the sea."
          className="aspect-[16/9] w-full object-cover object-[50%_65%] sm:aspect-[21/9] lg:max-h-[460px]"
        />
      </figure>

      {/* Title block */}
      <section className="mx-auto max-w-6xl px-6 pb-12 pt-12 lg:px-10 lg:pt-16">
        <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
          <span>{issue.market}</span>
          <span>{issue.date}</span>
        </p>
        <h1 className="mt-5 max-w-4xl text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-[68px]">
          {issue.title}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink/75 lg:text-2xl">
          {issue.dek}
        </p>
        <div className="mt-10 max-w-3xl border-t border-rule pt-4 font-sans text-sm text-muted">
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <span className="text-ink">{authors}</span>
            <span>{issue.readTime} read</span>
          </p>
          <p className="mt-1 font-serif text-base">{sources}</p>
        </div>
      </section>

      {/* Body */}
      <div className="mx-auto grid max-w-6xl gap-12 px-6 pb-24 lg:grid-cols-[200px_minmax(0,680px)] lg:gap-20 lg:px-10">
        <nav className="hidden lg:block">
          <ol className="sticky top-8 space-y-3 font-sans text-sm text-muted">
            {sections.map((s, i) => (
              <li key={s.id}>
                {locked && i > 0 ? (
                  <span className="inline-flex items-center gap-1.5 text-muted/70">
                    {s.title}
                    <Lock className="h-3 w-3 shrink-0" strokeWidth={1.5} />
                  </span>
                ) : (
                <a href={`#${s.id}`} className="inline-block transition-[color,transform] duration-200 ease-soft hover:text-ink motion-safe:hover:translate-x-0.5">
                  {s.title}
                </a>
                )}
              </li>
            ))}
          </ol>
        </nav>

        <article className="min-w-0">
          <aside className="border-y border-rule py-6">
            <h2 className="font-sans text-sm text-muted">The short version</h2>
            <ul className="mt-3 space-y-3 text-lg leading-relaxed">
              <li>Applied Intuition began by selling simulation to carmakers; it now sells the autonomy stack itself.</li>
              <li>The same software is moving into trucks, mining, agriculture and defense, where the buyer cares less about the brand of the vehicle than the brain inside it.</li>
              <li>That shift creates room for startups building the sensors, data and integration layers around it.</li>
            </ul>
          </aside>

          {shown.map((s) => (
            <section key={s.id} id={s.id} className="mt-14">
              <h2 className="text-3xl font-light tracking-tight">{s.title}</h2>
              {s.body.map((p, i) => (
                <p key={i} className="mt-5 text-xl leading-[1.65] text-ink/90">
                  {p}
                </p>
              ))}
            </section>
          ))}

          {locked && (
            <div className="relative mt-2">
              <div aria-hidden className="pointer-events-none -mt-24 h-24 bg-[linear-gradient(to_bottom,transparent,var(--color-paper))]" />
              <div className="border-t border-rule pt-8">
                <p className="text-2xl font-light leading-snug">
                  {sections.length - 1} more sections, for Stoa readers.
                </p>
                <p className="mt-2 font-sans text-sm text-muted">
                  {sections.slice(1).map((s) => s.title).join(', ')}.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3 font-sans text-sm">
                  <a
                    href="#request"
                    className="whitespace-nowrap bg-ink px-5 py-2.5 font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100"
                  >
                    Request access
                  </a>
                  <button onClick={onSignIn} className="whitespace-nowrap underline decoration-rule underline-offset-4 hover:decoration-ink">
                    I already have access
                  </button>
                </div>
              </div>
            </div>
          )}

          <p className="mt-16 border-t border-rule pt-5 font-sans text-xs leading-relaxed text-muted">
            Disclosure: {disclosure} Stoa is published by Astori Ventures for information only and
            is not investment advice.
          </p>
        </article>
      </div>

      {/* Private circulation */}
      <section id="request" className="bg-ink text-paper">
        <div className="mx-auto grid max-w-6xl gap-12 px-6 py-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)] lg:gap-20 lg:px-10 lg:py-20">
          {member ? (
            <div className="lg:col-span-2">
              <h2 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">Also in Stoa</h2>
              <ul className="mt-6 grid border-t border-paper/15 md:grid-cols-2 md:gap-x-12">
                {others.map((o) => (
                  <li key={o.slug} className="border-b border-paper/15 py-4">
                    <span className="block text-lg leading-snug">{o.title}</span>
                    <span className="mt-1 flex gap-4 font-sans text-xs text-paper/55">
                      <span>{o.market}</span>
                      <span>{o.date}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ) : (
          <>
          <div>
            <h2 className="text-3xl font-light leading-tight tracking-tight sm:text-4xl">
              Stoa circulates privately.
            </h2>
            <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-paper/70">
              Each piece is shared with the founders, operators and LPs who help us write it. We read
              every request and reply personally.
            </p>

            <h3 className="mt-12 font-sans text-sm text-paper/60">Also in Stoa</h3>
            <ul className="mt-3 border-t border-paper/15">
              {others.map((o) => (
                <li key={o.slug} className="flex items-start gap-3 border-b border-paper/15 py-3">
                  <span className="min-w-0 flex-1">
                    <span className="block text-lg leading-snug">{o.title}</span>
                    <span className="mt-1 flex gap-4 font-sans text-xs text-paper/55">
                      <span>{o.market}</span>
                      <span>{o.date}</span>
                    </span>
                  </span>
                  {!o.free && <Lock className="mt-1.5 h-3.5 w-3.5 shrink-0 text-paper/50" />}
                </li>
              ))}
            </ul>
          </div>

          <div className="self-start bg-paper p-6 text-ink">
            {requested ? (
              <div>
                <h3 className="text-2xl">Thank you. We read every request.</h3>
                <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
                  You'll hear from one of us within a few days, from{' '}
                  <span className="text-ink">research@stoacap.com</span>. Add it to your contacts so the reply
                  doesn't land in spam.
                </p>
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault()
                  onRequest?.(email, role, note.trim())
                  setRequested(true)
                }}
              >
                <h3 className="text-2xl">Request access</h3>
                <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
                  For the next issue and the archive.
                </p>
                <div className="font-sans">
                  <RoleChoice value={role} onChange={setRole} />
                </div>
                <label htmlFor="issue-email" className="sr-only">Work email</label>
                <input
                  id="issue-email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@company.com"
                  className="mt-4 w-full border border-rule bg-white/60 px-3 py-2.5 font-sans text-sm outline-none transition-[border-color,background-color] duration-150 ease-soft placeholder:text-muted/70 hover:border-muted/60 focus:border-ink focus:bg-white/80"
                />
                <label htmlFor="issue-note" className="sr-only">Anything we should know (optional)</label>
                <textarea
                  id="issue-note"
                  rows={2}
                  maxLength={280}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Anything we should know? (optional)"
                  className="mt-2 w-full resize-none border border-rule bg-white/60 px-3 py-2.5 font-sans text-sm outline-none transition-[border-color,background-color] duration-150 ease-soft placeholder:text-muted/70 hover:border-muted/60 focus:border-ink focus:bg-white/80"
                />
                <button
                  type="submit"
                  className="mt-3 w-full bg-ink px-4 py-2.5 font-sans text-sm font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100"
                >
                  Send request
                </button>
                <p className="mt-4 font-sans text-sm text-muted">
                  Already have access?{' '}
                  <button
                    type="button"
                    onClick={onSignIn}
                    className="text-ink underline decoration-rule underline-offset-4 hover:decoration-ink"
                  >
                    Sign in
                  </button>
                </p>
              </form>
            )}
          </div>
          </>
          )}
        </div>
      </section>

      {/* Footer, as on the home */}
      <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-paper/10 bg-ink px-4 py-2.5 font-sans text-xs text-paper/70 sm:px-5">
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

const sections = [
  {
    id: 'simulation',
    title: 'From simulation to stack',
    body: [
      'Applied Intuition was founded in 2017 to solve a narrow problem: automakers building driver assistance needed to test software across millions of miles they could not physically drive. Simulation was the wedge, and it put the company inside the engineering organisations of most major OEMs.',
      'That position turned out to be the valuable part. Once you are the system an autonomy team tests against, selling them the components being tested is a short step. Over the last three years the company has added a vehicle operating system and its own autonomy software, moving from tooling vendor to supplier of the stack.',
    ],
  },
  {
    id: 'beyond-cars',
    title: 'Why it matters beyond cars',
    body: [
      'Passenger cars are a slow market with entrenched suppliers. The faster-moving buyers are operators of trucks, mining equipment, farm machinery and defense platforms, who need autonomy but will never build it themselves.',
      'For them, a vendor that already works across vehicle types is the obvious choice. That is the bet: autonomy becomes a software layer bought like an operating system, and the hardware underneath becomes interchangeable.',
    ],
  },
  {
    id: 'watching',
    title: 'What we are watching',
    body: [
      'If the stack consolidates around a few providers, value moves to the edges: sensors built for harsh environments, data pipelines for rare edge cases, and the integrators who retrofit existing fleets. We are tracking early-stage companies in each.',
    ],
  },
  {
    id: 'open-questions',
    title: 'What we still don\u2019t know',
    body: [
      'Whether defense customers will accept a dual-use vendor at scale, and how margins hold up as the company sells more hardware-adjacent work. We will return to both as the year develops.',
    ],
  },
]
