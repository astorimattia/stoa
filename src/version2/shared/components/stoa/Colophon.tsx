import React from 'react'

import { StoaLogo } from './StoaLogo'

/** The footer: who publishes Stoa, where to go next, and the fine print. */
export function Colophon() {
  return (
    <footer className="mx-auto mt-24 w-full max-w-[1360px] px-5 pb-10 font-sans md:mt-32 md:px-10">
      <div className="grid grid-cols-1 gap-10 border-t border-rule pt-10 md:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] md:gap-14">
        <div>
          <StoaLogo size={19} className="text-ink" />
          <p className="mt-5 max-w-[420px] text-[15px] leading-[1.55] text-ink/75">
            Stoa is the research and investment platform of{' '}
            <a href="https://astori.vc" className="underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70">
              Astori Ventures
            </a>
            , a private investment firm in San Francisco.
          </p>
        </div>
        <div className="flex flex-col gap-6 text-[13px] leading-[1.55] text-quiet md:items-end md:text-right">
          <nav className="flex flex-wrap gap-x-6 gap-y-2 text-[15px] text-ink">
            <a href="#research" className="transition-opacity duration-150 hover:opacity-70">Research</a>
            <a href="#investments" className="transition-opacity duration-150 hover:opacity-70">Investments</a>
            <a href="#members" className="transition-opacity duration-150 hover:opacity-70">Request access</a>
            <a href="/privacy" className="transition-opacity duration-150 hover:opacity-70">Privacy</a>
          </nav>
          <p className="max-w-[560px]">
            Stoa is free to read and free to join. We read every request ourselves. Nothing here is investment advice.
          </p>
          <p>© {new Date().getFullYear()} Stoa</p>
        </div>
      </div>
    </footer>
  )
}
