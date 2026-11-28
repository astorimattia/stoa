import React, { useEffect, useState } from 'react'

type Props = {
  sent?: boolean
  /** The line under the field: what membership gets you, in this context. */
  promise?: string
  /** Resolves false when the request could not be stored, so the form can say so. */
  onRequestAccess?: (email: string) => void | boolean | Promise<boolean | void>
  /** Keeps the field's id unique when a page shows the form twice. */
  idSuffix?: string
}

/** The one action on Stoa: an email, a button, and a line on what members get. */
export function Intake({ sent: sentProp = false, promise = 'Free. We read every request ourselves, so we know who’s reading.', onRequestAccess, idSuffix }: Props) {
  const [email, setEmail] = useState('')
  const fieldId = idSuffix ? `intake-email-${idSuffix}` : 'intake-email'
  const [sent, setSent] = useState(sentProp)
  const [sending, setSending] = useState(false)
  const [failed, setFailed] = useState(false)
  useEffect(() => setSent(sentProp), [sentProp])

  if (sent) {
    return (
      <div className="bg-olive px-5 py-5 text-paper">
        <p className="text-[18px] font-medium">Got it.</p>
        <p className="mt-1 text-[15px] leading-[1.5] text-olive-soft">
          We read every request ourselves, and we’ll write to {email || 'you'} within two business days.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault()
        if (sending) return
        setSending(true)
        setFailed(false)
        const ok = await Promise.resolve(onRequestAccess?.(email)).catch(() => false)
        setSending(false)
        if (ok === false) setFailed(true)
        else setSent(true)
      }}
    >
      <label htmlFor={fieldId} className="sr-only">
        Email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id={fieldId}
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          className="min-w-0 flex-1 border border-rule bg-paper px-4 py-3.5 text-[17px] text-ink outline-none transition-colors duration-150 placeholder:text-quiet focus:border-ink"
        />
        <button
          type="submit"
          disabled={sending}
          className="whitespace-nowrap bg-olive disabled:opacity-60 px-6 py-3.5 text-[17px] font-medium text-paper transition-opacity duration-150 hover:opacity-90"
        >
          {sending ? 'Sending…' : 'Request access'}
        </button>
      </div>
      {failed ? (
        <p role="alert" className="mt-3 text-[14px] text-ink">
          That didn’t go through. Please try again in a moment.
        </p>
      ) : (
        <p className="mt-3 text-[14px] text-quiet">{promise}</p>
      )}
    </form>
  )
}
