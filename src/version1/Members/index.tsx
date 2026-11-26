import React, { useState } from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { IndexTitle } from '../shared/components/stoa/IndexList'
import { Intake } from '../shared/components/stoa/Intake'
import { Colophon } from '../shared/components/stoa/Colophon'

type Props = Partial<typeof args> & {
  onNavigate?: (page: StoaPage) => void
  onSignIn?: () => void
  /** Live site: send sign-in to this page instead of the mock link. */
  signInHref?: string
  onSignOut?: () => void
  onRequestAccess?: (email: string) => void
}

export default function Members(props: Props) {
  const { state, member, onNavigate, onSignIn, onSignOut, onRequestAccess, signInHref } = { ...args, ...props }
  const [signInEmail, setSignInEmail] = useState('')
  const [linkSent, setLinkSent] = useState(false)
  const [interest, setInterest] = useState<string[]>([])
  const signedIn = state === 'signed-in'

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="members" signedIn={signedIn} onNavigate={onNavigate} />

      {signedIn ? (
        <main className="px-5 md:px-10">
          <IndexTitle>Allocations</IndexTitle>

          {/* Open allocations lead: the reason a member signs in */}
          <ul className="mt-12 flex max-w-[960px] flex-col gap-12 md:mt-16">
            {openAllocations.map((a) => {
              const noted = interest.includes(a.company)
              return (
                <li key={a.company}>
                  <p className="text-[24px] leading-[1.2] tracking-[-0.025em] md:text-[32px]">{a.company}</p>
                  <p className="mt-2 text-[14px] tabular-nums text-quiet">
                    Closes {a.closes}
                    <span className="ml-5">Minimum {a.minimum}</span>
                  </p>
                  <p className="mt-2 max-w-[620px] text-[16px] leading-[1.5] text-ink/75">{a.terms}</p>
                  <button
                    onClick={() => setInterest((list) => (noted ? list : [...list, a.company]))}
                    disabled={noted}
                    className="mt-5 bg-olive px-5 py-2.5 text-[16px] text-paper transition-opacity duration-150 hover:opacity-90 disabled:bg-stone disabled:text-ink"
                  >
                    {noted ? 'Noted. We’ll send the documents.' : 'I’m interested'}
                  </button>
                </li>
              )
            })}
          </ul>

          <h2 className="mt-20 text-[15px] text-quiet">Closed</h2>
          <ul className="mt-4 flex max-w-[420px] flex-col gap-2">
            {closedAllocations.map((a) => (
              <li key={a.company} className="flex items-baseline justify-between gap-6 text-[17px]">
                <span>{a.company}</span>
                <span className="tabular-nums text-quiet">{a.closed}</span>
              </li>
            ))}
          </ul>

          <p className="mt-16 text-[14px] text-quiet">
            Signed in as {member}.{' '}
            <button onClick={onSignOut} className="underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink">
              Sign out
            </button>
          </p>
        </main>
      ) : (
        <main className="grid grid-cols-1 gap-16 px-5 md:grid-cols-2 md:gap-14 md:px-10">
          <section>
            <IndexTitle>Request access</IndexTitle>
            <div className="mt-10 max-w-[480px] md:mt-12">
              <Intake sent={state === 'requested'} onRequestAccess={onRequestAccess} />
            </div>
          </section>

          <section>
            <IndexTitle>Sign in</IndexTitle>
            {linkSent ? (
              <p className="mt-10 max-w-[420px] text-[17px] leading-[1.5] md:mt-12">
                A sign-in link is on its way to {signInEmail}.{' '}
                <button onClick={onSignIn} className="underline decoration-1 underline-offset-4">
                  Open it
                </button>
              </p>
            ) : (
              <form
                className="mt-10 flex max-w-[480px] flex-col gap-2 sm:flex-row md:mt-12"
                onSubmit={(e) => {
                  e.preventDefault()
                  if (signInHref) {
                    window.location.href = signInHref
                    return
                  }
                  setLinkSent(true)
                }}
              >
                <label htmlFor="signin-email" className="sr-only">
                  Email
                </label>
                <input
                  id="signin-email"
                  type="email"
                  required
                  value={signInEmail}
                  onChange={(e) => setSignInEmail(e.target.value)}
                  placeholder="you@firm.com"
                  className="min-w-0 flex-1 bg-stone px-4 py-3.5 text-[17px] text-ink outline-none placeholder:text-quiet focus:bg-rule"
                />
                <button
                  type="submit"
                  className="whitespace-nowrap bg-ink px-6 py-3.5 text-[17px] text-paper transition-opacity duration-150 hover:opacity-85"
                >
                  Email me a link
                </button>
              </form>
            )}
          </section>
        </main>
      )}

      <Colophon />
    </div>
  )
}

export const args = {
  state: 'signed-in',
  member: 'eleanor@harlowfamily.com',
}

export const argTypes = {
  state: { control: 'radio', options: ['signed-out', 'requested', 'signed-in'] },
  member: { control: 'text' },
}

const openAllocations = [
  {
    company: 'Fluidstack',
    closes: '12 Dec 2026',
    terms: 'Secondary common through a single-purpose vehicle. Price and documents are in the data room.',
    minimum: '$25,000',
  },
  {
    company: 'Unannounced',
    closes: '9 Jan 2027',
    terms: 'Series B, fintech infrastructure. A note on the company goes to members before the round is public.',
    minimum: '$50,000',
  },
]

const closedAllocations = [
  { company: 'Erebor', closed: 'Nov 2026' },
  { company: 'Kalshi', closed: 'Jun 2026' },
  { company: 'AMI Labs', closed: 'Apr 2026' },
]
