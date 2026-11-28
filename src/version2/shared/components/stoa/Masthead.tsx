import React from 'react'

import { StoaLogo } from './StoaLogo'

export type StoaPage = 'home' | 'research' | 'investments' | 'members' | 'signin' | 'request'

type Props = {
  active: StoaPage
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
}

/** Wordmark and three words. No rules: the space around it does the separating. */
export function Masthead({ active, signedIn, onNavigate }: Props) {
  const link = (page: StoaPage, label: string, extra = '') => (
    <button
      onClick={() => onNavigate?.(page)}
      aria-current={active === page ? 'page' : undefined}
      className={`whitespace-nowrap transition-colors duration-150 hover:text-ink ${active === page ? 'text-ink' : 'text-quiet'} ${extra}`}
    >
      {label}
    </button>
  )

  return (
    <header className="mx-auto flex w-full max-w-[1360px] items-center justify-between gap-4 px-5 py-5 font-sans md:px-10 md:py-7">
      <button onClick={() => onNavigate?.('home')} aria-label="Stoa, home" className="shrink-0 text-ink">
        <span className="hidden sm:inline-flex">
          <StoaLogo size={21} />
        </span>
        <span className="inline-flex sm:hidden">
          <StoaLogo size={24} variant="mark" />
        </span>
      </button>
      <nav className="flex min-w-0 items-center gap-4 text-[14px] sm:gap-6 sm:text-[15px] md:gap-8">
        {link('research', 'Research')}
        {link('investments', 'Investments')}
        {signedIn ? (
          link('members', 'Members')
        ) : (
          <>
            {link('signin', 'Sign in', 'hidden sm:inline')}
            <button
              onClick={() => onNavigate?.('request')}
              aria-current={active === 'request' ? 'page' : undefined}
              className="whitespace-nowrap bg-olive px-2.5 py-1.5 text-paper transition-opacity duration-150 hover:opacity-90 sm:px-3.5"
            >
              <span className="sm:hidden">Join</span>
              <span className="hidden sm:inline">Request access</span>
            </button>
          </>
        )}
      </nav>
    </header>
  )
}
