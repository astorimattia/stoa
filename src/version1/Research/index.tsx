import React from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { IndexTitle } from '../shared/components/stoa/IndexList'
import { Colophon } from '../shared/components/stoa/Colophon'
import { NoteFigure as Figure } from '../shared/components/stoa/NoteFigure'
import { SHOW_VOICES, stoaNotes, stoaPositions, stoaSources, type StoaNote } from '../shared/stoaData'
import { noteAuthors } from '../shared/stoaNoteBodies'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
  onOpenNote?: (slug: string) => void
}

export default function Research(props: Props) {
  const { count, signedIn, onNavigate, onOpenNote } = { ...args, ...props }
  const [lead, ...rest] = stoaNotes.slice(0, count)
  const leadVoice = SHOW_VOICES ? stoaSources[lead.slug]?.voice : undefined

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="research" signedIn={signedIn} onNavigate={onNavigate} />

      <main className="mx-auto max-w-[1360px] px-5 md:px-10">
        <IndexTitle>Research</IndexTitle>
        <p className="mt-5 max-w-[560px] text-[18px] leading-[1.5] text-ink/75">
          Notes on where capital is moving, written after talking to the people closest to it. The opening of every note is free.
        </p>

        {/* The latest note leads: its chart, its title, and the voice behind it */}
        <button
          onClick={() => onOpenNote?.(lead.slug)}
          className="group mt-12 grid w-full grid-cols-1 gap-8 text-left md:mt-16 lg:grid-cols-[minmax(0,7fr)_minmax(0,5fr)] lg:gap-14"
        >
          <Figure note={lead} className="aspect-[16/10]" />
          <div className="flex flex-col">
            <span className="text-[30px] font-medium leading-[1.08] tracking-[-0.03em] decoration-2 underline-offset-[6px] group-hover:underline md:text-[44px]">
              {lead.title}
            </span>
            {lead.dek && <span className="mt-5 text-[18px] leading-[1.5] text-ink/75 md:text-[19px]">{lead.dek}</span>}
            <Byline note={lead} />
            {leadVoice && (
              <span className="mt-8 block bg-olive px-5 py-5 text-paper lg:mt-auto">
                <span className="block text-[18px] leading-[1.4]">“{leadVoice.quote}”</span>
                <span className="mt-3 block text-[14px] text-olive-soft">{leadVoice.who}</span>
              </span>
            )}
          </div>
        </button>

        <ul className="mt-20 grid grid-cols-1 gap-x-10 gap-y-16 md:mt-28 md:grid-cols-2 lg:grid-cols-3">
          {rest.map((n) => (
            <li key={n.slug}>
              <button onClick={() => onOpenNote?.(n.slug)} className="group flex h-full w-full flex-col text-left">
                <Figure note={n} className="aspect-[4/3]" />
                <span className="mt-5 text-[22px] leading-[1.2] tracking-[-0.02em] decoration-1 underline-offset-4 group-hover:underline md:text-[24px]">
                  {n.title}
                </span>
                {n.dek && <span className="mt-3 text-[16px] leading-[1.5] text-ink/75">{n.dek}</span>}
                <span className="mt-auto">
                  <Byline note={n} />
                </span>
              </button>
            </li>
          ))}
        </ul>
      </main>

      <Colophon />
    </div>
  )
}

export const args = {
  count: 7,
}

export const argTypes = {
  count: { control: 'range', min: 2, max: 7, step: 1 },
}

function Byline({ note }: { note: StoaNote }) {
  const author = noteAuthors[note.slug]
  const entered = stoaPositions.find((p) => p.note === note.slug)?.entered
  return (
    <span className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] tabular-nums text-quiet">
      <span>{author ? `${author}, ${note.date}` : note.date}</span>
      {entered && <span className="text-ink">Invested {entered}</span>}
    </span>
  )
}
