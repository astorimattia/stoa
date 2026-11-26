// Minimal account sign-in surface for Stoa: email link or code, Google or
// passkey. This surface proves an email only - it never asks for a role,
// never frames access as an application, and never grants anything by
// itself. Access is account-wide on the server (see api/recover.js and
// api/admin.js). Every email gets the same web response, so the surface
// never reveals whether an address is on the reader list.
import React, { useEffect, useState } from 'react'
import { authClient } from './authClient'

const inputCls =
  'mt-4 w-full border border-rule bg-white/60 px-3 py-2.5 font-sans text-sm outline-none transition-[border-color,background-color] duration-150 ease-soft placeholder:text-muted/70 hover:border-muted/60 focus:border-ink focus:bg-white/80'
const primaryBtn =
  'mt-3 w-full bg-ink px-4 py-2.5 font-sans text-sm font-medium text-paper transition-[background-color,transform] duration-150 ease-soft hover:bg-ink/85 active:scale-[0.98] active:duration-100 disabled:opacity-60'
const secondaryBtn =
  'w-full border border-rule bg-white/60 px-4 py-2.5 font-sans text-sm text-ink transition-colors hover:border-muted/60 hover:bg-white/80 disabled:opacity-60'

// Which sign-in methods THIS deployment actually has configured comes from
// the server (/api/auth-config), never from the hostname: a staging OAuth
// client enables Google on staging, and production without a client shows
// it unavailable. Until the answer loads, Google stays disabled.

export function SignInCard({
  heading = 'Sign in to Stoa',
  sub = 'Email link or code, Google or passkey. No password.',
  onSignedIn,
}: {
  heading?: string
  sub?: string
  onSignedIn: () => void
}) {
  const [email, setEmail] = useState('')
  const [step, setStep] = useState<'email' | 'code' | 'sent'>('email')
  const [code, setCode] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: session } = authClient.useSession()
  const [googleOn, setGoogleOn] = useState(false)
  const [emailOn, setEmailOn] = useState(false)
  const [reviewOnly, setReviewOnly] = useState(false)
  const [configLoaded, setConfigLoaded] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth-config')
      .then((r) => (r.ok ? r.json() : { google: false }))
      .then((c) => {
        if (cancelled) return
        setGoogleOn(!!c.google)
        setEmailOn(!!c.email)
        setReviewOnly(!!c.reviewOnly)
        setConfigLoaded(true)
      })
      .catch(() => !cancelled && setConfigLoaded(true))
    return () => {
      cancelled = true
    }
  }, [])

  const signOut = async () => {
    await authClient.signOut().catch(() => {})
    window.location.reload()
  }

  // Primary path: a one-time sign-in link (15 minutes). The web response
  // is identical for every address - it never confirms list membership.
  const sendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || !emailOn) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.signIn.magicLink({
        email,
        callbackURL: ['/welcome', '/research/sign-in', '/signin'].includes(window.location.pathname)
          ? new URL('/research', window.location.origin).href : window.location.href,
      })
      if (err) throw new Error(err.message)
      setStep('sent')
    } catch {
      setError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const sendCode = async () => {
    if (sending || !emailOn) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.emailOtp.sendVerificationOtp({ email, type: 'sign-in' })
      if (err) throw new Error(err.message)
      setStep('code')
    } catch {
      setError('Something went wrong - please try again in a moment.')
    } finally {
      setSending(false)
    }
  }

  const verifyCode = async (e: React.FormEvent) => {
    e.preventDefault()
    if (sending || !emailOn) return
    setSending(true)
    setError(null)
    try {
      const { error: err } = await authClient.signIn.emailOtp({ email, otp: code.trim() })
      if (err) throw new Error(err.message)
      onSignedIn()
    } catch {
      setError("That code didn't work - check it and try again, or request a fresh one.")
      setSending(false)
    }
  }

  const google = async () => {
    setError(null)
    const { error: err } = await authClient.signIn.social({ provider: 'google', callbackURL: ['/welcome', '/research/sign-in', '/signin'].includes(window.location.pathname) ? new URL('/research', window.location.origin).href : window.location.href })
    if (err) setError('Google sign-in is not available yet - use your email instead.')
  }

  const passkey = async () => {
    setError(null)
    const { error: err } = await authClient.signIn.passkey()
    if (err) setError('No passkey found for this device - use your email instead.')
    else onSignedIn()
  }

  return (
    <div className="bg-paper p-6 text-ink">
      {reviewOnly && <p className="mb-4 border-b border-rule pb-3 font-sans text-xs text-muted">Test site: sign-in emails are captured, not sent.</p>}
      {session?.user?.email && (
        <p className="mb-4 border-b border-rule pb-3 font-sans text-xs leading-relaxed text-muted">
          Signed in as {session.user.email}.{' '}
          <button type="button" onClick={signOut} className="underline underline-offset-2 transition-colors hover:text-ink">
            Sign out
          </button>
        </p>
      )}
      {step === 'sent' ? (
        <div>
          <h3 className="text-2xl">Check your inbox.</h3>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
            Look for a sign-in link at {email}. It works once, for the next 15 minutes.
            Nothing there? Check spam, then go back and try again.
          </p>
          <button
            type="button"
            onClick={() => setStep('email')}
            className="mt-4 font-sans text-sm text-ink underline decoration-rule underline-offset-4 transition-colors hover:decoration-ink"
          >
            Use a different email
          </button>
        </div>
      ) : step === 'code' ? (
        <form onSubmit={verifyCode}>
          <h3 className="text-2xl">Check your inbox.</h3>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
            Look for a sign-in code at {email}. It works once, for the next 15 minutes.
            Nothing there? Check spam, then go back and try again.
          </p>
          <label htmlFor="reader-code" className="sr-only">
            Sign-in code
          </label>
          <input
            id="reader-code"
            inputMode="numeric"
            autoComplete="one-time-code"
            required
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="6-digit code"
            className={inputCls}
          />
          <button type="submit" disabled={sending} className={primaryBtn}>
            {sending ? 'Signing in…' : 'Sign in'}
          </button>
          {error && <p className="mt-3 font-sans text-sm leading-relaxed text-accent">{error}</p>}
        </form>
      ) : (
        <form onSubmit={sendLink}>
          <h3 className="text-2xl">{heading}</h3>
          <p className="mt-1 font-sans text-sm leading-relaxed text-muted">{sub}</p>
          <label htmlFor="reader-email" className="sr-only">
            Email
          </label>
          <input
            id="reader-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
            className={inputCls}
          />
          <button type="submit" disabled={sending || !emailOn} className={primaryBtn}>
            {sending ? 'Sending…' : 'Email me a link'}
          </button>
          <p className="mt-3 font-sans text-xs leading-relaxed text-muted">
            {configLoaded && !emailOn && <span className="mb-2 block">Email sign-in is not available yet. Existing approved reading links still work.</span>}
            Opening it on another device?{' '}
            <button type="button" onClick={sendCode} disabled={sending || !emailOn} className="underline underline-offset-2 transition-colors hover:text-ink">
              Send a code instead
            </button>
          </p>
          <div className="my-4 flex items-center gap-3 font-sans text-xs text-muted">
            <span className="h-px flex-1 bg-rule" />
            or
            <span className="h-px flex-1 bg-rule" />
          </div>
          <div className="grid gap-2">
            <button type="button" onClick={google} disabled={!googleOn} className={secondaryBtn}>
              Continue with Google
              {configLoaded && !googleOn
                ? window.location.hostname.endsWith('.workers.dev')
                  ? ' (not available on this test site yet)'
                  : ' (temporarily unavailable)'
                : ''}
            </button>
            <button type="button" onClick={passkey} className={secondaryBtn}>
              Sign in with a passkey
            </button>
          </div>
          {error && <p className="mt-3 font-sans text-sm leading-relaxed text-accent">{error}</p>}
          <a href="/privacy" className="mt-6 block font-sans text-xs text-muted underline">Privacy at Stoa</a>
        </form>
      )}
    </div>
  )
}

/** Signed-in account without access: identity and the request action,
 *  kept separate from sign-in. Approval is account-wide - one approval
 *  opens the whole locked library; the piece here is a demand signal.
 *  One button plus an optional personal line, no role chips, no
 *  application form. */
export function RequestAccessCard({ pieceSlug, pieceTitle }: { pieceSlug: string; pieceTitle: string }) {
  const [state, setState] = useState<'idle' | 'sending' | 'done'>('idle')
  const [note, setNote] = useState('')
  const [error, setError] = useState<string | null>(null)
  const { data: session } = authClient.useSession()
  const email = session?.user?.email || ''

  const signOut = async () => {
    await authClient.signOut().catch(() => {})
    window.location.reload()
  }

  const request = async () => {
    if (state !== 'idle' || !email) return
    setState('sending')
    setError(null)
    try {
      const res = await fetch('/api/recover', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, piece: pieceSlug || pieceTitle, note: note.trim() || undefined, source: 'locked-piece' }),
      })
      if (!res.ok) throw new Error(`Send failed: ${res.status}`)
      setState('done')
    } catch {
      setError('Something went wrong - please try again in a moment.')
      setState('idle')
    }
  }

  return (
    <div className="bg-paper p-6 text-ink">
      {email && (
        <p className="mb-4 border-b border-rule pb-3 font-sans text-xs leading-relaxed text-muted">
          Signed in as {email}.{' '}
          <button type="button" onClick={signOut} className="underline underline-offset-2 transition-colors hover:text-ink">
            Sign out
          </button>
        </p>
      )}
      {state === 'done' ? (
        <div>
          <h3 className="text-2xl">Thank you. We read every request.</h3>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
            Either way, you hear from research@stoacap.com. Add it to your contacts so the reply
            doesn't land in spam.
          </p>
        </div>
      ) : (
        <div>
          <h3 className="text-2xl">Request access</h3>
          <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
            Stoa circulates privately. One approval opens every piece and the archive; we read
            every request and reply personally.
          </p>
          <label htmlFor="request-note" className="sr-only">
            Anything we should know (optional)
          </label>
          <textarea
            id="request-note"
            rows={2}
            maxLength={280}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Anything we should know? (optional)"
            className="mt-4 w-full resize-none border border-rule bg-white/60 px-3 py-2.5 font-sans text-sm outline-none transition-[border-color,background-color] duration-150 ease-soft placeholder:text-muted/70 hover:border-muted/60 focus:border-ink focus:bg-white/80"
          />
          <button type="button" onClick={request} disabled={state === 'sending'} className={primaryBtn}>
            {state === 'sending' ? 'Sending…' : 'Send request'}
          </button>
          {error && <p className="mt-3 font-sans text-sm leading-relaxed text-accent">{error}</p>}
        </div>
      )}
    </div>
  )
}
