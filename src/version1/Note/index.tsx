import React from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { Intake } from '../shared/components/stoa/Intake'
import { Colophon } from '../shared/components/stoa/Colophon'
import { SHOW_VOICES, noteBySlug, stoaNotes, stoaPositions, stoaSources } from '../shared/stoaData'
import { noteAuthors, noteBodies } from '../shared/stoaNoteBodies'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  intake?: string
  onNavigate?: (page: StoaPage) => void
  onRequestAccess?: (email: string) => void
}

export default function Note(props: Props) {
  const { slug, reader, signedIn, intake, onNavigate, onRequestAccess } = { ...args, ...props }
  const note = noteBySlug(slug) ?? stoaNotes[0]
  const sources = SHOW_VOICES ? stoaSources[note.slug] : undefined
  const body = noteBodies[note.slug]
  const author = noteAuthors[note.slug]
  const entered = stoaPositions.find((p) => p.note === note.slug)?.entered
  const isMember = signedIn || reader === 'member'

  // Visitors read the opening; members read on. The expert's line lands just before the cut.
  const paragraphs = body?.sections[0].paragraphs ?? []
  const open = isMember ? paragraphs : paragraphs.slice(0, FREE_PARAGRAPHS)
  const voiceAfter = Math.min(4, open.length - 1)

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="research" signedIn={isMember} onNavigate={onNavigate} />

      <main className="mx-auto max-w-[1360px] px-5 md:px-10">
        <header className="max-w-[900px] pt-12 md:pt-20">
          <h1 className="text-[36px] font-medium leading-[1.05] tracking-[-0.035em] md:text-[58px]">{note.title}</h1>
          {note.dek && <p className="mt-6 max-w-[720px] text-[19px] leading-[1.5] text-ink/75 md:text-[21px]">{note.dek}</p>}
          <p className="mt-6 text-[14px] text-quiet">
            {note.topic}
            <span className="mx-2">·</span>
            {author ? `${author}, ` : ''}
            <span className="tabular-nums">{note.date}</span>
          </p>
        </header>

        <div className="mt-12 grid grid-cols-1 gap-12 md:mt-16 lg:grid-cols-[minmax(0,680px)_minmax(0,1fr)] lg:gap-20">
          <article className="min-w-0">
            {open.map((p, i) => (
              <React.Fragment key={i}>
                <p className="mb-5 text-[18px] leading-[1.65]">{p}</p>
                {i === voiceAfter && sources?.voice && (
                  <blockquote className="my-10 bg-olive px-6 py-8 text-paper md:-mr-10 md:px-8">
                    <p className="text-[24px] leading-[1.25] tracking-[-0.015em] md:text-[28px]">“{sources.voice.quote}”</p>
                    <footer className="mt-4 text-[15px] text-olive-soft">{sources.voice.who}</footer>
                  </blockquote>
                )}
              </React.Fragment>
            ))}

            {isMember ? (
              <>
                {!body && (
                  <p className="text-[18px] leading-[1.65] text-ink/75">
                    The full text of this note goes out to members by email. It will be on the site shortly.
                  </p>
                )}
                {body?.sections.slice(1).map((s) => (
                  <section key={s.label} className="mt-10">
                    {s.label && <h2 className="mb-4 text-[22px] font-medium tracking-[-0.015em]">{s.label}</h2>}
                    {s.paragraphs.map((p, i) => (
                      <p key={i} className="mb-5 text-[18px] leading-[1.65]">{p}</p>
                    ))}
                  </section>
                ))}
                {entered && (
                  <p className="mt-10 bg-stone px-5 py-4 text-[16px] leading-[1.5]">
                    Stoa invested in {note.title.split(':')[0]} in {entered}, after this note was published.
                  </p>
                )}
              </>
            ) : (
              <section className="mt-10 bg-stone px-5 py-8 md:px-8">
                <p className="mb-6 text-[22px] font-medium leading-[1.25] tracking-[-0.015em]">
                  {body ? 'The rest is for members. Joining is free.' : 'This note is for members. Joining is free.'}
                </p>
                <Intake sent={intake === 'sent'} onRequestAccess={onRequestAccess} />
              </section>
            )}
          </article>

          {/* Who we spoke to: the signature of every note, beside the text */}
          {sources && (
            <aside className="lg:sticky lg:top-8 lg:self-start">
              <p className="text-[14px] text-quiet">We spoke with</p>
              <ul className="mt-3 flex flex-col gap-3 text-[16px] leading-[1.4]">
                {sources.roles.map((r) => (
                  <li key={r}>{r}</li>
                ))}
              </ul>
            </aside>
          )}
        </div>
      </main>

      <Colophon />
    </div>
  )
}

export const args = {
  slug: 'micron-margin',
  reader: 'visitor',
}

export const argTypes = {
  slug: { control: 'select', options: ['micron-margin', 'anthropic-ipo', 'elections-vc', 'erebor', 'space-insurance', 'beyond-consensus', 's26-screening'] },
  reader: { control: 'radio', options: ['visitor', 'member'] },
}

const FREE_PARAGRAPHS = 6
