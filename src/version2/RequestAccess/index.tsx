import React, { useEffect, useState } from 'react'

import type { StoaPage } from '../shared/components/stoa/Masthead'
import { AuthLayout, fieldCls, primaryCls, textLinkCls } from '../shared/components/stoa/AuthLayout'

type Props = Partial<typeof args> & {
  onNavigate?: (page: StoaPage) => void
  /** Resolves false when the request could not be stored, so the form can say so. */
  onRequestAccess?: (email: string, note?: string) => void | boolean | Promise<boolean | void>
}

// The "Request Access" frame of the Stoa prototype in Magic Patterns: an email, an optional
// line up to 280 characters, and one approval opens the whole library.
export default function RequestAccess(props: Props) {
  const { state, onNavigate, onRequestAccess } = { ...args, ...props }
  const [sent, setSent] = useState(state === 'sent')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setSent(state === 'sent'), [state])

  if (sent) {
    return (
      <AuthLayout active="request" onNavigate={onNavigate}>
        <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">Thank you. We read every request.</h1>
        <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">
          We’ll write to {email ? <span className="text-ink">{email}</span> : 'you'}. The reply comes from{' '}
          <span className="text-ink">research@stoacap.com</span>, so add it to your contacts and it won’t land in spam.
        </p>
        <button onClick={() => onNavigate?.('research')} className={`${primaryCls} mt-10 sm:w-auto`}>
          Read the research
        </button>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout active="request" onNavigate={onNavigate}>
      <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">Request access</h1>
      <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">Free. We read every request ourselves, so we know who’s reading.</p>

      {/* What one approval opens, said once, plainly */}
      <ul className="mt-8 flex flex-col gap-2 text-[16px] leading-[1.5]">
        {perks.map((p) => (
          <li key={p} className="flex gap-3">
            <span className="mt-[9px] size-1.5 shrink-0 bg-olive" aria-hidden="true" />
            {p}
          </li>
        ))}
      </ul>

      <form
        className="mt-10 flex flex-col gap-3"
        onSubmit={async (e) => {
          e.preventDefault()
          if (busy) return
          setBusy(true)
          setFailed(false)
          const ok = await Promise.resolve(onRequestAccess?.(email, note.trim() || undefined)).catch(() => false)
          setBusy(false)
          if (ok === false) setFailed(true)
          else setSent(true)
        }}
      >
        <label htmlFor="request-email" className="text-[15px] font-medium">
          Email
        </label>
        <input
          id="request-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          className={fieldCls}
        />
        <label htmlFor="request-note" className="mt-3 flex items-baseline justify-between gap-4 text-[15px] font-medium">
          Anything we should know?
          <span className="text-[14px] font-normal text-quiet">Optional</span>
        </label>
        <textarea
          id="request-note"
          rows={3}
          maxLength={280}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What you work on, or who sent you."
          className={`${fieldCls} resize-none leading-[1.5]`}
        />
        <p className="text-right text-[13px] tabular-nums text-quiet">{280 - note.length} left</p>
        <button type="submit" disabled={busy} className={`${primaryCls} mt-2`}>
          {busy ? 'Sending…' : 'Request access'}
        </button>
        {failed && (
          <p role="alert" className="text-[15px] text-ink">
            That didn’t go through. Please try again in a moment.
          </p>
        )}
      </form>

      <p className="mt-10 text-[16px]">
        Already a member?{' '}
        <button onClick={() => onNavigate?.('signin')} className={textLinkCls}>
          Sign in
        </button>
      </p>
    </AuthLayout>
  )
}

export const args = {
  state: 'form',
}

export const argTypes = {
  state: { control: 'radio', options: ['form', 'sent'] },
}

const perks = [
  'Every note in full, and the archive.',
  'Allocations, before anyone else hears about them.',
  'A reply from a person, not a queue.',
]
