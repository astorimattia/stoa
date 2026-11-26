import React from 'react'

export type IndexItem = {
  key: string
  /** The thing itself: a note's title, a company's name. */
  primary: string
  /** One quiet line under it: a date, an entry month. */
  meta: React.ReactNode
  /** An optional sentence of context, kept to one or two lines. */
  detail?: string
  onClick?: () => void
}

/** The one list layout Research and Positions share: big line, quiet line, optional sentence. */
export function IndexList({ items }: { items: IndexItem[] }) {
  return (
    <ol className="mt-12 flex max-w-[960px] flex-col gap-10 md:mt-16 md:gap-12">
      {items.map((item) => (
        <li key={item.key}>
          {item.onClick ? (
            <button onClick={item.onClick} className="group text-left">
              <Primary text={item.primary} interactive />
            </button>
          ) : (
            <Primary text={item.primary} />
          )}
          <p className="mt-2 text-[14px] tabular-nums text-quiet">{item.meta}</p>
          {item.detail && <p className="mt-2 max-w-[620px] text-[16px] leading-[1.5] text-ink/75">{item.detail}</p>}
        </li>
      ))}
    </ol>
  )
}

function Primary({ text, interactive }: { text: string; interactive?: boolean }) {
  return (
    <span
      className={`block text-[24px] leading-[1.2] tracking-[-0.025em] md:text-[32px] ${interactive ? 'decoration-1 underline-offset-[5px] group-hover:underline' : ''}`}
    >
      {text}
    </span>
  )
}

export function IndexTitle({ children }: { children: React.ReactNode }) {
  return <h1 className="pt-12 text-[40px] font-medium leading-none tracking-[-0.035em] md:pt-20 md:text-[60px]">{children}</h1>
}
