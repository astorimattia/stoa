import React from 'react'

import { Wordmark } from './Logo'

export type AdminView = 'requests' | 'readers' | 'pieces'

/** The admin's frame: a dark rail, like the strips on the public site, around a paper workspace. */
export function AdminShell({
  view,
  pending,
  onNavigate,
  children,
}: {
  view: AdminView
  pending: number
  onNavigate?: (view: AdminView) => void
  children: React.ReactNode
}) {
  const items: { id: AdminView; label: string; count?: number }[] = [
    { id: 'requests', label: 'Requests', count: pending },
    { id: 'readers', label: 'Readers' },
    { id: 'pieces', label: 'Pieces' },
  ]
  return (
    <div className="flex h-screen flex-col bg-paper font-sans text-ink md:flex-row">
      <aside className="flex shrink-0 items-center gap-6 bg-ink px-4 py-3 text-paper md:w-56 md:flex-col md:items-stretch md:gap-0 md:px-0 md:py-5">
        <div className="flex items-center gap-2.5 md:px-5">
          <Wordmark className="text-xl" />
        </div>
        <nav className="flex gap-1 md:mt-8 md:flex-col md:gap-0">
          {items.map((item) => {
            const on = item.id === view
            return (
              <button
                key={item.id}
                onClick={() => onNavigate?.(item.id)}
                aria-current={on ? 'page' : undefined}
                className={`flex items-center justify-between gap-3 whitespace-nowrap px-3 py-1.5 text-sm transition-[background-color,color] duration-150 ease-soft md:px-5 md:py-2 ${
                  on ? 'bg-paper/10 text-paper' : 'text-paper/60 hover:text-paper'
                }`}
              >
                {item.label}
                {item.count ? <span className="tabular-nums text-paper/60">{item.count}</span> : null}
              </button>
            )
          })}
        </nav>
        <div className="ml-auto hidden text-xs text-paper/50 sm:block md:ml-0 md:mt-auto md:px-5">
          <span className="hidden md:block">Signed in as</span>
          <span className="md:text-paper/80">dinki@astori.vc</span>
        </div>
      </aside>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  )
}
