import React from 'react'

import { stoaPositions, type StoaNote } from '../../stoaData'

type Props = {
  notes: StoaNote[]
  onOpenNote?: (slug: string) => void
}

/** Notes separated by space, not rules. A held position shows as a plain line under its note. */
export function NoteIndex({ notes, onOpenNote }: Props) {
  return (
    <ol className="flex flex-col gap-8 md:gap-10">
      {notes.map((n) => {
        const entered = stoaPositions.find((p) => p.note === n.slug)?.entered
        return (
          <li key={n.slug}>
            <button onClick={() => onOpenNote?.(n.slug)} className="group block w-full text-left">
              <span className="block text-[20px] leading-[1.3] tracking-[-0.01em] decoration-1 underline-offset-[5px] group-hover:underline md:text-[24px]">
                {n.title}
              </span>
              <span className="mt-2 flex flex-wrap gap-x-5 gap-y-1 text-[14px] text-quiet">
                <span>{n.topic}</span>
                <span className="tabular-nums">{n.date}</span>
                {entered && <span className="text-ink">Position entered {entered}</span>}
              </span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
