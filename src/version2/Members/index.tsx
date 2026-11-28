// The "Members" frame of the Stoa prototype in Magic Patterns: what a signed-in member sees.
import React, { useEffect, useState } from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { IndexTitle } from '../shared/components/stoa/IndexList'
import { Colophon } from '../shared/components/stoa/Colophon'
import { stoaNotes } from '../shared/stoaData'

type Props = Partial<typeof args> & {
  onNavigate?: (page: StoaPage) => void
  onSignOut?: () => void
  onOpenNote?: (slug: string) => void
  /** Live site: the new-note email switch reads and saves the member's real preference. */
  live?: boolean
  /** Live site: still finding out who is signed in. */
  checking?: boolean
}

export default function Members(props: Props) {
  const { state, member, newPieceEmails, onNavigate, onSignOut, onOpenNote, live, checking } = { ...args, ...props }
  const [emails, setEmails] = useState(newPieceEmails)
  const [emailsNote, setEmailsNote] = useState<string | null>(null)
  const signedIn = state === 'signed-in'

  // Live: load the member's real new-note email preference.
  useEffect(() => {
    if (!live || !signedIn) return
    fetch('/api/publications?preferences=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => d && setEmails(d.subscribed === true))
      .catch(() => {})
  }, [live, signedIn])

  const toggleEmails = async () => {
    if (!live) return setEmails((v) => !v)
    const next = !emails
    setEmails(next)
    setEmailsNote(null)
    const ok = await fetch('/api/publications', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: next ? 'subscribe' : 'stop', consent: true }),
    })
      .then((r) => r.ok)
      .catch(() => false)
    if (!ok) {
      setEmails(!next)
      setEmailsNote('That didn’t save. Please try again.')
    }
  }

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="members" signedIn={signedIn} onNavigate={onNavigate} />

      {signedIn ? (
        <main className="mx-auto grid max-w-[1360px] grid-cols-1 gap-16 px-5 md:px-10 lg:grid-cols-[minmax(0,8fr)_minmax(0,4fr)] lg:gap-20">
          <div>
          <IndexTitle>Members</IndexTitle>
          <p className="mt-5 max-w-[560px] text-[18px] leading-[1.5] text-ink/75">
            You’re signed in. The latest notes and your account are on the right.
          </p>
          </div>

          {/* Secondary: what to read next, and the account, one glance each */}
          <aside className="flex flex-col gap-14 lg:pt-28">
            <section>
              <h2 className="text-[15px] text-quiet">Latest notes</h2>
              <ul className="mt-4 flex flex-col gap-5">
                {stoaNotes.slice(0, 3).map((n) => (
                  <li key={n.slug}>
                    <button onClick={() => onOpenNote?.(n.slug)} className="group text-left">
                      <span className="block text-[18px] leading-[1.3] tracking-[-0.01em] decoration-1 underline-offset-4 group-hover:underline">
                        {n.title}
                      </span>
                      <span className="mt-1 block text-[14px] tabular-nums text-quiet">{n.date}</span>
                    </button>
                  </li>
                ))}
              </ul>
              <button
                onClick={() => onNavigate?.('research')}
                className="mt-5 text-[15px] underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
              >
                All research
              </button>
            </section>

            <section>
              <h2 className="text-[15px] text-quiet">Account</h2>
              <p className="mt-4 break-all text-[17px]">{member}</p>
              <label className="mt-5 flex cursor-pointer items-start justify-between gap-6">
                <span className="text-[16px] leading-[1.45]">
                  Email me new notes
                  <span className="block text-[14px] text-quiet">Your access doesn’t change either way.</span>
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={emails}
                  onClick={toggleEmails}
                  className={`relative mt-1 h-6 w-11 shrink-0 transition-colors duration-150 ${emails ? 'bg-olive' : 'bg-rule'}`}
                >
                  <span
                    className={`absolute left-0 top-1 h-4 w-4 bg-paper transition-transform duration-150 ease-out ${emails ? 'translate-x-6' : 'translate-x-1'}`}
                  />
                </button>
              </label>
              {emailsNote && <p role="alert" className="mt-3 text-[14px] text-ink">{emailsNote}</p>}
              <button
                onClick={onSignOut}
                className="mt-6 text-[15px] text-quiet underline decoration-1 underline-offset-4 transition-colors duration-150 hover:text-ink"
              >
                Sign out
              </button>
            </section>
          </aside>
        </main>
      ) : (
        <main className="mx-auto max-w-[1360px] px-5 md:px-10">
          <IndexTitle>Members</IndexTitle>
          <p className="mt-6 max-w-[560px] text-[18px] leading-[1.5] text-ink/75">
            {checking ? 'Checking your account…' : 'Sign in to see your account.'}
          </p>
          {!checking && (
            <button
              onClick={() => onNavigate?.('signin')}
              className="mt-8 bg-olive px-6 py-3.5 text-[17px] font-medium text-paper transition-opacity duration-150 hover:opacity-90"
            >
              Sign in
            </button>
          )}
        </main>
      )}

      <Colophon />
    </div>
  )
}

export const args = {
  state: 'signed-in',
  member: 'eleanor@harlowfamily.com',
  newPieceEmails: true,
}

export const argTypes = {
  state: { control: 'radio', options: ['signed-out', 'signed-in'] },
  member: { control: 'text' },
  newPieceEmails: { control: 'boolean' },
}
