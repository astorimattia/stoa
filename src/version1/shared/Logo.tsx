import React from 'react'

/**
 * Stoa's logo is the wordmark: flat type, ink or paper. The only icon is the painted
 * colonnade (BrushedMark), used where a square picture is expected.
 */

/** STOA in Newsreader Light, capitals, tracked in slightly: the same letters as the home page. */
export function Wordmark({ className = 'text-3xl', title = 'Stoa' }: { className?: string; title?: string }) {
  return (
    <span
      role="img"
      aria-label={title}
      className={`inline-block select-none font-serif font-light uppercase leading-none tracking-[-0.02em] ${className}`}
    >
      Stoa
    </span>
  )
}

/** The endorsed lockup, for anywhere Stoa appears without Astori nearby. */
export function Endorsed({ className = '' }: { className?: string }) {
  return (
    <span className={`inline-flex flex-col gap-2 ${className}`}>
      <Wordmark className="text-4xl" />
      <span className="font-sans text-[11px] tracking-wide opacity-70">Published by Astori Ventures</span>
    </span>
  )
}
