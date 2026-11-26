import React from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { IndexTitle } from '../shared/components/stoa/IndexList'
import { Colophon } from '../shared/components/stoa/Colophon'
import { noteBySlug, stoaExperts } from '../shared/stoaData'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
  onOpenNote?: (slug: string) => void
}

export default function Experts(props: Props) {
  const { showNotes, signedIn, onNavigate, onOpenNote } = { ...args, ...props }

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="experts" signedIn={signedIn} onNavigate={onNavigate} />

      <main className="px-5 md:px-10">
        <IndexTitle>Experts</IndexTitle>
        <p className="mt-5 max-w-[560px] text-[18px] leading-[1.5] text-ink/75">
          Some of the people we call. Each one agreed to be named here; most of the people we speak with prefer not to be.
        </p>

        <ul className="mt-12 grid grid-cols-2 gap-x-5 gap-y-12 md:mt-16 md:grid-cols-3 md:gap-x-10 lg:grid-cols-4">
          {stoaExperts.map((e) => (
            <li key={e.name} className="flex min-w-0 flex-col">
              {e.photo ? (
                <img src={e.photo} alt={e.name} className="aspect-[4/5] w-full bg-stone object-cover grayscale" />
              ) : (
                // Placeholder until a real, approved photo is in
                <div className="flex aspect-[4/5] w-full items-center justify-center bg-stone text-[32px] font-medium tracking-[-0.02em] text-quiet md:text-[44px]">
                  {initials(e.name)}
                </div>
              )}
              <p className="mt-4 text-[18px] font-medium leading-[1.25] tracking-[-0.01em] md:text-[20px]">{e.name}</p>
              <p className="mt-1 text-[15px] leading-[1.4] text-quiet">{e.role}</p>
              {showNotes &&
                e.notes.map((slug) => {
                  const note = noteBySlug(slug)
                  if (!note) return null
                  return (
                    <button
                      key={slug}
                      onClick={() => onOpenNote?.(slug)}
                      className="mt-2 text-left text-[14px] leading-[1.4] underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
                    >
                      {note.title}
                    </button>
                  )
                })}
            </li>
          ))}
        </ul>
      </main>

      <Colophon />
    </div>
  )
}

export const args = {
  showNotes: true,
}

export const argTypes = {
  showNotes: { control: 'boolean' },
}

function initials(name: string) {
  return name
    .split(' ')
    .map((p) => p[0])
    .join('')
}
