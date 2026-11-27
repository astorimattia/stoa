import React from 'react'

import { SHOW_VOICES, stoaSources, type StoaNote } from '../../stoaData'

/** A note's chart where it has one; otherwise a quiet olive tile with its topic, so every note has a face. */
export function NoteFigure({ note, className = '' }: { note: StoaNote; className?: string }) {
  if (note.figure) {
    return <img src={note.figure} alt="" loading="lazy" className={`w-full bg-stone object-contain p-3 ${className}`} />
  }
  const voice = SHOW_VOICES ? stoaSources[note.slug]?.voice : undefined
  return (
    <span className={`flex w-full flex-col justify-end bg-stone p-6 ${className}`}>
      {voice ? (
        <>
          <span className="text-[20px] leading-[1.3] tracking-[-0.01em] text-olive md:text-[22px]">“{voice.quote}”</span>
          <span className="mt-3 text-[14px] text-quiet">{voice.who}</span>
        </>
      ) : (
        <span className="text-[34px] font-medium leading-[1.05] tracking-[-0.03em] text-olive md:text-[40px]">{note.topic}</span>
      )}
    </span>
  )
}
