import React, { useState } from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { IndexTitle } from '../shared/components/stoa/IndexList'
import { Colophon } from '../shared/components/stoa/Colophon'
import { noteBySlug, stoaPositions } from '../shared/stoaData'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
  onOpenNote?: (slug: string) => void
}

export default function Investments(props: Props) {
  const { signedIn, onNavigate, onOpenNote } = { ...args, ...props }

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="investments" signedIn={signedIn} onNavigate={onNavigate} />

      <main className="mx-auto max-w-[1360px] px-5 md:px-10">
        <IndexTitle>Investments</IndexTitle>
        <p className="mt-5 max-w-[560px] text-[18px] leading-[1.5] text-ink/75">
          Companies we invested in after researching the market around them. Where we published a note first, it’s linked. Where we didn’t, we say so.
        </p>

        {/* Each row reads left to right: the company, why we invested, and the note that came before */}
        <ol className="mt-14 flex flex-col gap-14 md:mt-20 md:gap-16">
          {stoaPositions.map((p) => {
            const note = p.note ? noteBySlug(p.note) : undefined
            return (
              <li
                key={p.company}
                className="grid grid-cols-1 gap-4 md:grid-cols-[minmax(0,3fr)_minmax(0,5fr)] md:gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,5fr)_minmax(0,3fr)]"
              >
                <div className="flex items-start gap-4">
                  <Mark website={p.website} name={p.company} />
                  <div className="min-w-0">
                    <p className="text-[26px] font-medium leading-[1.1] tracking-[-0.025em] md:text-[30px]">{p.company}</p>
                    <p className="mt-1.5 text-[14px] tabular-nums text-quiet">{p.sector} · Invested {p.entered}</p>
                  </div>
                </div>

                <p className="text-[19px] leading-[1.45] md:text-[21px]">{p.reason}</p>

                <div className="text-[15px] leading-[1.5] md:col-start-2 lg:col-start-auto">
                  {p.website && (
                    <a
                      href={p.website}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-quiet transition-colors duration-150 hover:text-ink"
                    >
                      {p.website.replace(/^https?:\/\//, '').replace(/^www\./, '')}
                    </a>
                  )}
                  {note && (
                    <button
                      onClick={() => onOpenNote?.(note.slug)}
                      className="mt-1 text-left underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
                    >
                      Read our note, {note.date}
                    </button>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </main>

      <Colophon />
    </div>
  )
}

export const args = {}

export const argTypes = {}

/** The company's own mark on a stone tile, falling back to its initial. */
function Mark({ website, name }: { website?: string; name: string }) {
  const [failed, setFailed] = useState(false)
  const domain = website?.replace(/^https?:\/\//, '').replace(/^www\./, '')
  return (
    <span className="flex size-12 shrink-0 items-center justify-center bg-stone md:size-14">
      {domain && !failed ? (
        <img
          src={`https://www.google.com/s2/favicons?domain=${domain}&sz=128`}
          alt=""
          onError={() => setFailed(true)}
          className="size-6 object-contain md:size-7"
        />
      ) : (
        <span className="text-[20px] font-medium text-quiet">{name.charAt(0)}</span>
      )}
    </span>
  )
}
