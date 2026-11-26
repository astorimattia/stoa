import React from 'react'

import { Wordmark } from './Logo'

/** One Stoa email as it lands in an inbox: sender line, mark and wordmark, body, footer. */
export function EmailCard({ subject, to, children }: { subject: string; to?: string; children: React.ReactNode }) {
  return (
    <article className="w-full max-w-[640px] bg-paper text-ink shadow-[0_1px_2px_rgba(27,25,21,0.08),0_8px_24px_-12px_rgba(27,25,21,0.18)]">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 border-b border-rule px-6 py-3 font-sans text-xs text-muted sm:px-8">
        <span className="font-medium text-ink">Stoa</span>
        <span>research@stoacap.com</span>
        {to && <span>to {to}</span>}
        <span className="w-full truncate text-sm text-ink sm:ml-auto sm:w-auto">{subject}</span>
      </div>
      <div className="px-6 py-8 font-serif text-[17px] leading-relaxed sm:px-10">
        <Wordmark className="mb-8 text-[28px]" />
        {children}
      </div>
      <footer className="border-t border-rule px-6 py-4 font-sans text-xs text-muted sm:px-10">
        Stoa is published by Astori Ventures at stoacap.com
      </footer>
    </article>
  )
}

export const SUBJECTS = {
  received: 'We have your request',
  approved: "You're in: your link to Stoa",
  declined: 'About your request to read Stoa',
  signin: 'Your sign-in link',
} as const

type Reader = { firstName: string; email: string; piece?: string | null; personalLine?: string; signer: string }

export function ApprovedBody({ firstName, email, piece, personalLine, signer }: Reader) {
  return (
    <>
      <Greeting name={firstName} />
      {personalLine && (
        <P>
          {personalLine}
        </P>
      )}
      <P>
        You now have access to every Stoa piece and the archive. The link below signs you in as{' '}
        <strong className="font-medium">{email}</strong>, with no password to keep.
      </P>
      <EmailButton>{piece ? 'Read the piece you asked for' : 'Open Stoa'}</EmailButton>
      <Small>
        {piece ? (
          <>
            It opens on {piece}.{' '}
          </>
        ) : null}
        The link works once, for 7 days.
      </Small>
      <P>Next time, use Sign in on stoacap.com and we'll email you a fresh link.</P>
      <Sign signer={signer} />
    </>
  )
}

export function DeclinedBody({ firstName, personalLine, signer }: Reader) {
  return (
    <>
      <Greeting name={firstName} />
      {personalLine && (
        <P>
          {personalLine}
        </P>
      )}
      <P>
        Thank you for your interest. Stoa is shared with a small circle tied to the companies we write about, and we
        can't open it more widely at the moment.
      </P>
      <P>Some pieces are open to everyone on stoacap.com, and we'll keep publishing them.</P>
      <Sign signer={signer} />
    </>
  )
}

export function Greeting({ name }: { name: string }) {
  return <p>Dear {name},</p>
}

export function P({ children }: { children: React.ReactNode }) {
  return <p className="mt-4">{children}</p>
}

export function Small({ children }: { children: React.ReactNode }) {
  return <p className="mt-3 font-sans text-xs text-muted">{children}</p>
}

export function EmailButton({ children }: { children: React.ReactNode }) {
  return <span className="mt-6 inline-block bg-ink px-5 py-2.5 font-sans text-sm font-medium text-paper">{children}</span>
}

export function Sign({ signer }: { signer: string }) {
  return (
    <p className="mt-6">
      {signer}
      <span className="block font-sans text-xs text-muted">Stoa, published by Astori Ventures</span>
    </p>
  )
}
