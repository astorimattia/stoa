import React from 'react'

type Props = {
  /** Height of the mark in px; the wordmark scales with it. */
  size?: number
  variant?: 'lockup' | 'mark' | 'wordmark'
  className?: string
}

/**
 * The Stoa logo: a colonnade drawn from rectangles (a beam, four columns, a step)
 * beside the name in Libre Franklin. Draws in currentColor, so it takes the colour of its text.
 */
export function StoaLogo({ size = 24, variant = 'lockup', className = '' }: Props) {
  const mark = <StoaMark size={size} />
  const word = (
    <span className="font-medium leading-none tracking-[-0.035em]" style={{ fontSize: size * 1.05 }}>
      Stoa
    </span>
  )
  if (variant === 'mark') return <span className={`inline-flex ${className}`}>{mark}</span>
  if (variant === 'wordmark') return <span className={`inline-flex ${className}`}>{word}</span>
  return (
    <span className={`inline-flex items-center ${className}`} style={{ gap: size * 0.42 }}>
      {mark}
      {word}
    </span>
  )
}

export function StoaMark({ size = 24 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" fill="currentColor" aria-hidden="true">
      <rect x="2" y="5" width="36" height="4" />
      <rect x="6" y="12" width="4" height="19" />
      <rect x="14" y="12" width="4" height="19" />
      <rect x="22" y="12" width="4" height="19" />
      <rect x="30" y="12" width="4" height="19" />
      <rect x="2" y="34" width="36" height="3" />
    </svg>
  )
}
