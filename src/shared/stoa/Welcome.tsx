import { useEffect, useState } from 'react'

/** The 24-hour welcome credential is consumed only after a deliberate
 * click. It signs into a normal account, never bypasses reader approval. */
export default function Welcome() {
  const [token] = useState(() => window.location.hash.slice(1))
  useEffect(() => { window.history.replaceState({}, '', '/welcome') }, [])
  const validShape = /^[A-Za-z0-9_-]{32,128}$/.test(token)
  const destination = new URL('/api/welcome-auth/magic-link/verify', window.location.origin)
  destination.searchParams.set('token', token)
  destination.searchParams.set('callbackURL', '/research')
  destination.searchParams.set('errorCallbackURL', '/research/sign-in')
  return <div className="min-h-screen bg-paper px-6 py-16 font-serif text-ink">
    <main className="mx-auto max-w-xl">
      <p className="mb-12 text-3xl font-light uppercase tracking-[-.02em]">Stoa</p>
      <h1 className="text-4xl font-light">{validShape ? 'Welcome to Stoa.' : 'Use a fresh sign-in link.'}</h1>
      <p className="mt-5 font-sans text-sm leading-relaxed text-muted">{validShape
        ? 'Your welcome link works once, within 24 hours. Continue to sign in and open the library. No second email is needed.'
        : 'This welcome link is missing or was already opened. Sign in with your email for a fresh one-time link or code.'}</p>
      {validShape && <a href={destination.href} className="mt-8 inline-block bg-ink px-5 py-3 font-sans text-sm text-paper">Continue to Stoa</a>}
      <p className="mt-6 font-sans text-sm"><a className="underline underline-offset-4" href="/research/sign-in">Need a fresh link? Sign in</a></p>
    </main>
  </div>
}
