import React from 'react'

/**
 * The current Stoa mark: the brushed colonnade from the favicon. `light` is umber strokes on
 * primed canvas (for paper backgrounds); `dark` is lit stone on umber (for the ink strips).
 */
export function BrushedMark({ tone = 'light', className = 'h-8 w-8' }: { tone?: 'light' | 'dark'; className?: string }) {
  return (
    <span role="img" aria-label="Stoa" className={`block shrink-0 overflow-hidden ${className}`}>
      <img
        src={tone === 'dark' ? DARK : LIGHT}
        alt=""
        className="h-full w-full object-cover"
        style={{ transform: 'scale(1.05)', objectPosition: '50% 50%' }}
      />
    </span>
  )
}

const LIGHT = 'https://cdn.magicpatterns.com/patterns/generated-images/bb29e703-f26a-4c62-9753-7d059aeaef52.jpg'
const DARK = 'https://cdn.magicpatterns.com/patterns/generated-images/76ec17ea-b96d-4a86-83f2-f70ecd36a908.jpg'
