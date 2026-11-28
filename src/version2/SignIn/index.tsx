import React, { useEffect, useState } from 'react'

import type { StoaPage } from '../shared/components/stoa/Masthead'
import { AuthLayout, fieldCls, primaryCls, secondaryCls, textLinkCls } from '../shared/components/stoa/AuthLayout'
import { authClient } from '../../shared/stoa/authClient'

type Step = 'email' | 'link-sent' | 'code' | 'no-access'

type Props = Partial<typeof args> & {
  onNavigate?: (page: StoaPage) => void
  /** Prototype only: a member signed in. */
  onSignedIn?: () => void
  /** Live site: sign in through the real account system (email link or code, Google, passkey). */
  live?: boolean
  /** Live site: who is signed in, if anyone, and whether that email is an approved member. */
  sessionEmail?: string
  approved?: boolean | null
  onSignOut?: () => void
}

/** Where an email link or Google brings the reader back to. */
const returnUrl = () => `${window.location.origin}/version2#members`

// The "Sign In" frame of the Stoa prototype in Magic Patterns. Signing in proves an email;
// approval is separate, and an unapproved email sees the no-access step.
export default function SignIn(props: Props) {
  const { state, email: startEmail, onNavigate, onSignedIn, live, sessionEmail, approved, onSignOut } = { ...args, ...props }
  const [step, setStep] = useState<Step>(state as Step)
  const [email, setEmail] = useState(live ? '' : startEmail)
  const [code, setCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [google, setGoogle] = useState(!live)
  useEffect(() => setStep(state as Step), [state])

  // Live: which sign-in methods the server has turned on.
  useEffect(() => {
    if (!live) return
    fetch('/api/auth-config')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => setGoogle(c?.google === true))
      .catch(() => {})
  }, [live])

  // Live: a session for an approved member goes to Members; any other session is told it isn't a member yet.
  useEffect(() => {
    if (!live || !sessionEmail || approved == null) return
    if (approved) onNavigate?.('members')
    else {
      setEmail(sessionEmail)
      setStep('no-access')
    }
  }, [live, sessionEmail, approved])

  const run = async (fn: () => Promise<{ error?: unknown } | undefined>, fail: string, next?: Step) => {
    setBusy(true)
    setError(null)
    const res = await fn().catch(() => ({ error: true }))
    setBusy(false)
    if (res?.error) setError(fail)
    else if (next) setStep(next)
  }

  const sendLink = () =>
    live
      ? run(() => authClient.signIn.magicLink({ email: email.trim(), callbackURL: returnUrl() }), 'We couldn’t send a link just now. Please try again in a moment.', 'link-sent')
      : setStep('link-sent')

  const sendCode = () =>
    live
      ? run(() => authClient.emailOtp.sendVerificationOtp({ email: email.trim(), type: 'sign-in' }), 'We couldn’t send a code just now. Please try again in a moment.', 'code')
      : setStep('code')

  const checkCode = () => {
    if (!live) return onSignedIn ? onSignedIn() : setStep('no-access')
    // A good code starts a session; the effect above then sends members on, and others to no-access.
    run(() => authClient.signIn.emailOtp({ email: email.trim(), otp: code.trim() }), 'That code didn’t work. Check it, or send a new one.')
  }

  const withGoogle = () =>
    run(() => authClient.signIn.social({ provider: 'google', callbackURL: returnUrl() }), 'Google sign-in didn’t work just now. Please try again.')

  const withPasskey = () =>
    live ? run(() => authClient.signIn.passkey(), 'No passkey found for this device. Use your email instead.') : onSignedIn?.()

  const signOut = async () => {
    if (live) {
      await authClient.signOut().catch(() => {})
      onSignOut?.()
    }
    setEmail('')
    setStep('email')
  }

  const errorLine = error && (
    <p role="alert" className="mt-4 text-[15px] text-ink">
      {error}
    </p>
  )

  return (
    <AuthLayout active="signin" onNavigate={onNavigate}>
      {step === 'link-sent' && (
        <section>
          <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">Check your inbox.</h1>
          <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">
            We sent a sign-in link to <span className="text-ink">{email}</span>. It works once, for the next 15 minutes. Nothing
            there? Check spam, then try again.
          </p>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-3 text-[15px]">
            <button onClick={sendCode} disabled={busy} className={textLinkCls}>
              Send a code instead
            </button>
            <button onClick={() => setStep('email')} className={`${textLinkCls} text-quiet`}>
              Use a different email
            </button>
          </div>
          {errorLine}
        </section>
      )}

      {step === 'code' && (
        <section>
          <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">Enter your code.</h1>
          <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">
            We sent a six-digit code to <span className="text-ink">{email}</span>. It works once, for the next 15 minutes.
          </p>
          <form
            className="mt-10 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!busy) checkCode()
            }}
          >
            <label htmlFor="signin-code" className="sr-only">
              Sign-in code
            </label>
            <input
              id="signin-code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              required
              value={code}
              onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className={`${fieldCls} text-center text-[28px] tracking-[0.4em] tabular-nums`}
            />
            <button type="submit" disabled={busy} className={primaryCls}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          {errorLine}
          <button onClick={() => setStep('email')} className={`${textLinkCls} mt-6 text-[15px] text-quiet`}>
            Use a different email
          </button>
        </section>
      )}

      {step === 'no-access' && (
        <section>
          <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">You’re signed in.</h1>
          <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">
            <span className="text-ink">{email}</span> isn’t a member yet. Membership is free, and one approval opens every note and
            the archive. We read every request ourselves.
          </p>
          <button onClick={() => onNavigate?.('request')} className={`${primaryCls} mt-10 sm:w-auto`}>
            Request access
          </button>
          <p className="mt-6 text-[15px] text-quiet">
            Wrong account?{' '}
            <button onClick={signOut} className={textLinkCls}>
              Sign out
            </button>
          </p>
        </section>
      )}

      {step === 'email' && (
        <section>
          <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[56px]">Sign in</h1>
          <p className="mt-6 text-[18px] leading-[1.55] text-ink/75">
            For members. We’ll email you a link to sign in, so there’s no password to keep.
          </p>

          <form
            className="mt-10 flex flex-col gap-3"
            onSubmit={(e) => {
              e.preventDefault()
              if (!busy) sendLink()
            }}
          >
            <label htmlFor="signin-email" className="sr-only">
              Email
            </label>
            <input
              id="signin-email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@firm.com"
              className={fieldCls}
            />
            <button type="submit" disabled={busy} className={primaryCls}>
              {busy ? 'Sending…' : 'Email me a link'}
            </button>
          </form>
          <p className="mt-4 text-[14px] text-quiet">
            Opening it on another device?{' '}
            <button onClick={() => email && sendCode()} disabled={busy} className={textLinkCls}>
              Send a code instead
            </button>
          </p>
          {errorLine}

          <p className="mt-10 text-[14px] text-quiet">Or</p>
          <div className="mt-3 flex flex-col gap-3">
            {google && (
              <button onClick={withGoogle} disabled={busy} className={secondaryCls}>
                Continue with Google
              </button>
            )}
            <button onClick={withPasskey} disabled={busy} className={secondaryCls}>
              Sign in with a passkey
            </button>
          </div>

          <p className="mt-14 text-[16px]">
            Not a member yet?{' '}
            <button onClick={() => onNavigate?.('request')} className={textLinkCls}>
              Request access
            </button>
          </p>
        </section>
      )}
    </AuthLayout>
  )
}

export const args = {
  state: 'email',
  email: 'eleanor@harlowfamily.com',
}

export const argTypes = {
  state: { control: 'select', options: ['email', 'link-sent', 'code', 'no-access'] },
  email: { control: 'text' },
}
