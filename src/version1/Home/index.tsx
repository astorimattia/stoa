import React from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { Intake } from '../shared/components/stoa/Intake'
import { Colophon } from '../shared/components/stoa/Colophon'
import { NoteFigure } from '../shared/components/stoa/NoteFigure'
import { stoaNotes, stoaPositions } from '../shared/stoaData'
import { noteAuthors } from '../shared/stoaNoteBodies'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
  onOpenNote?: (slug: string) => void
  onRequestAccess?: (email: string) => void
}

const steps = [
  {
    n: '01',
    title: 'We call the people who know',
    body: 'Underwriters, engineers, bankers, regulators and operators. The people who see a market from the inside, before it shows up in the numbers.',
  },
  {
    n: '02',
    title: 'We write down what we learn',
    body: 'Short, plain notes on where capital is moving and why. The opening of every note is free to read. Members read the rest.',
  },
  {
    n: '03',
    title: 'We invest where it points',
    body: 'When the research is strong enough, we invest. Members hear about those allocations first.',
  },
]

export default function Home(props: Props) {
  const { intake, signedIn, onNavigate, onOpenNote, onRequestAccess } = { ...args, ...props }
  const latest = [...stoaNotes].filter((n) => n.dek).slice(0, 3)

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="home" signedIn={signedIn} onNavigate={onNavigate} />

      <main className="mx-auto max-w-[1360px]">
        {/* The promise, the painting, and the one action */}
        <section className="grid grid-cols-1 gap-8 px-5 pt-4 md:px-10 md:pt-8 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
          <div className="order-2 lg:order-1">
            <p className="text-[14px] font-medium uppercase tracking-[0.12em] text-olive">Research and investments</p>
            <h1 className="mt-5 text-[42px] font-medium leading-[1.02] tracking-[-0.04em] md:text-[64px]">
              The people closest to the money already know. We ask them.
            </h1>
            <p className="mt-6 max-w-[500px] text-[18px] leading-[1.55] text-ink/75 md:text-[19px]">
              Stoa turns conversations with the people who underwrite, build, regulate and run a market into clear research. Then we put our own capital behind it.
            </p>
            {!signedIn && (
              <div className="mt-10 max-w-[500px]">
                <Intake sent={intake === 'sent'} onRequestAccess={onRequestAccess} />
              </div>
            )}
          </div>
          <img
            src="https://www.stoacap.com/1-stoa-home.jpg"
            alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
            className="order-1 aspect-[4/3] w-full bg-stone object-cover lg:order-2 lg:aspect-[4/5]"
          />
        </section>

        {/* How Stoa works, in three steps, on the olive of the painting */}
        <section className="mt-20 bg-olive px-5 py-14 text-paper md:mx-10 md:mt-28 md:px-12 md:py-16">
          <h2 className="text-[14px] font-medium uppercase tracking-[0.12em] text-olive-soft">How Stoa works</h2>
          <ol className="mt-10 grid grid-cols-1 gap-12 md:grid-cols-3 md:gap-10">
            {steps.map((s) => (
              <li key={s.n}>
                <p className="text-[14px] tabular-nums text-olive-soft">{s.n}</p>
                <p className="mt-3 text-[24px] font-medium leading-[1.15] tracking-[-0.02em] md:text-[26px]">{s.title}</p>
                <p className="mt-4 text-[16px] leading-[1.55] text-paper/80">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* The latest research */}
        <section className="px-5 pt-20 md:px-10 md:pt-28">
          <div className="flex items-end justify-between gap-6">
            <h2 className="text-[32px] font-medium leading-none tracking-[-0.03em] md:text-[44px]">Latest research</h2>
            <button
              onClick={() => onNavigate?.('research')}
              className="shrink-0 text-[15px] underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
            >
              All research
            </button>
          </div>
          <ul className="mt-10 grid grid-cols-1 gap-x-10 gap-y-14 md:mt-12 md:grid-cols-3">
            {latest.map((n) => (
              <li key={n.slug}>
                <button onClick={() => onOpenNote?.(n.slug)} className="group flex h-full w-full flex-col text-left">
                  <NoteFigure note={n} className="aspect-[4/3]" />
                  <span className="mt-5 text-[22px] leading-[1.2] tracking-[-0.02em] decoration-1 underline-offset-4 group-hover:underline">
                    {n.title}
                  </span>
                  {n.dek && <span className="mt-3 text-[16px] leading-[1.5] text-ink/75">{n.dek}</span>}
                  <span className="mt-4 text-[14px] tabular-nums text-quiet">
                    {noteAuthors[n.slug] ? `${noteAuthors[n.slug]}, ${n.date}` : n.date}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Where the research has taken us */}
        <section className="px-5 pt-20 md:px-10 md:pt-28">
          <div className="grid grid-cols-1 gap-10 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:gap-16">
            <div>
              <h2 className="text-[32px] font-medium leading-none tracking-[-0.03em] md:text-[44px]">Investments</h2>
              <p className="mt-5 max-w-[440px] text-[18px] leading-[1.55] text-ink/75">
                We invest in the companies our research keeps pointing to. These are some of them.
              </p>
              <button
                onClick={() => onNavigate?.('investments')}
                className="mt-8 text-[15px] underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
              >
                See why we invested
              </button>
            </div>
            <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {stoaPositions.map((p) => (
                <li key={p.company}>
                  <button onClick={() => onNavigate?.('investments')} className="flex h-full w-full flex-col gap-1 bg-stone px-5 py-6 text-left transition-colors duration-150 hover:bg-rule">
                    <span className="text-[20px] font-medium tracking-[-0.02em]">{p.company}</span>
                    <span className="text-[14px] text-quiet">{p.sector}</span>
                  </button>
                </li>
              ))}
              <li>
                <button onClick={() => onNavigate?.('investments')} className="flex h-full w-full flex-col justify-end gap-1 bg-olive px-5 py-6 text-left text-paper transition-opacity duration-150 hover:opacity-90">
                  <span className="text-[17px] font-medium">See all →</span>
                </button>
              </li>
            </ul>
          </div>
        </section>

        {/* The ask, once more, for readers who got to the end */}
        {!signedIn && (
          <section className="px-5 pt-20 md:px-10 md:pt-28">
            <div className="grid grid-cols-1 gap-8 bg-stone px-5 py-10 md:px-12 md:py-14 lg:grid-cols-[minmax(0,6fr)_minmax(0,6fr)] lg:items-center lg:gap-16">
              <div>
                <h2 className="text-[30px] font-medium leading-[1.1] tracking-[-0.03em] md:text-[40px]">Read every note in full.</h2>
                <p className="mt-4 max-w-[460px] text-[17px] leading-[1.55] text-ink/75">
                  Members get the full research by email and first look at our investments.
                </p>
              </div>
              <Intake sent={intake === 'sent'} onRequestAccess={onRequestAccess} idSuffix="footer" />
            </div>
          </section>
        )}
      </main>

      <Colophon />
    </div>
  )
}

export const args = {
  intake: 'default',
}

export const argTypes = {
  intake: { control: 'radio', options: ['default', 'sent'] },
}
