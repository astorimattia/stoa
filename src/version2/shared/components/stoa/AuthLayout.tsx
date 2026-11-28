import React from 'react'

import { Masthead, StoaPage } from './Masthead'
import { Colophon } from './Colophon'

type Props = {
  active: StoaPage
  onNavigate?: (page: StoaPage) => void
  children: React.ReactNode
}

/** Sign in and Request access share one shape: the form on the left, the painting on the right. */
export function AuthLayout({ active, onNavigate, children }: Props) {
  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active={active} onNavigate={onNavigate} />
      <main className="mx-auto grid max-w-[1360px] grid-cols-1 gap-12 px-5 pt-8 md:px-10 md:pt-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,5fr)] lg:gap-20">
        <div className="max-w-[520px]">{children}</div>
        <img
          src="/1-stoa-home.jpg"
          alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
          className="hidden aspect-[4/5] w-full bg-stone object-cover lg:block"
        />
      </main>
      <Colophon />
    </div>
  )
}

export const fieldCls =
  'w-full min-w-0 border border-rule bg-paper px-4 py-3.5 text-[17px] text-ink outline-none transition-colors duration-150 placeholder:text-quiet focus:border-ink'
export const primaryCls =
  'w-full whitespace-nowrap bg-olive px-6 py-3.5 text-[17px] font-medium text-paper transition-opacity duration-150 hover:opacity-90 disabled:opacity-60'
export const secondaryCls =
  'w-full whitespace-nowrap border border-rule bg-paper px-6 py-3.5 text-[16px] text-ink transition-colors duration-150 hover:border-ink'
export const textLinkCls = 'underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70'
