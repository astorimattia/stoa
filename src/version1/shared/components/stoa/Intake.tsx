import React, { useEffect, useState } from 'react'

type Props = {
  sent?: boolean
  /** The line under the field: what membership gets you, in this context. */
  promise?: string
  onRequestAccess?: (email: string) => void
}

/** The one action on Stoa: an email, a button, and a line on what members get. */
export function Intake({ sent: sentProp = false, promise = 'Membership is free. We review every request by hand, so everyone inside has been vetted.', onRequestAccess }: Props) {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(sentProp)
  useEffect(() => setSent(sentProp), [sentProp])

  if (sent) {
    return (
      <div className="bg-olive px-5 py-5 text-paper">
        <p className="text-[18px] font-medium">Request received.</p>
        <p className="mt-1 text-[15px] leading-[1.5] text-olive-soft">
          We read every request ourselves. We’ll write to {email || 'you'} within a week.
        </p>
      </div>
    )
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        setSent(true)
        onRequestAccess?.(email)
      }}
    >
      <label htmlFor="intake-email" className="sr-only">
        Email
      </label>
      <div className="flex flex-col gap-2 sm:flex-row">
        <input
          id="intake-email"
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@firm.com"
          className="min-w-0 flex-1 bg-stone px-4 py-3.5 text-[17px] text-ink outline-none placeholder:text-quiet focus:bg-rule"
        />
        <button
          type="submit"
          className="whitespace-nowrap bg-olive px-6 py-3.5 text-[17px] font-medium text-paper transition-opacity duration-150 hover:opacity-90"
        >
          Request access
        </button>
      </div>
      <p className="mt-3 text-[14px] text-quiet">{promise}</p>
    </form>
  )
}
