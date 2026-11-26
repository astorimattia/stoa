import React from 'react'

import { Masthead, StoaPage } from '../shared/components/stoa/Masthead'
import { Intake } from '../shared/components/stoa/Intake'
import { Colophon } from '../shared/components/stoa/Colophon'
import { homeVoices, noteBySlug, stoaSources } from '../shared/stoaData'

type Props = Partial<typeof args> & {
  signedIn?: boolean
  onNavigate?: (page: StoaPage) => void
  onOpenNote?: (slug: string) => void
  onRequestAccess?: (email: string) => void
}

export default function Home(props: Props) {
  const { conversations, intake, signedIn, onNavigate, onOpenNote, onRequestAccess } = { ...args, ...props }
  const [lead, ...others] = homeVoices
  const leadVoice = stoaSources[lead]?.voice
  const leadNote = noteBySlug(lead)

  return (
    <div className="min-h-full bg-paper font-sans text-ink">
      <Masthead active="home" signedIn={signedIn} onNavigate={onNavigate} />

      <main>
        {/* The painting and the claim, with the one number that backs it and the one action */}
        <section className="grid grid-cols-1 gap-8 px-5 pt-4 md:px-10 md:pt-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)] lg:items-end lg:gap-14">
          <div className="order-2 lg:order-1 lg:pb-4">
            <h1 className="text-[40px] font-medium leading-[1.04] tracking-[-0.035em] md:text-[60px]">
              Built on conversations with experts.
            </h1>
            <p className="mt-6 max-w-[440px] text-[18px] leading-[1.5] text-ink/75">
              {conversations} conversations since September with the people who underwrite, build, regulate and run the things we write about.
            </p>
            {!signedIn && (
              <div className="mt-10 max-w-[480px]">
                <Intake sent={intake === 'sent'} onRequestAccess={onRequestAccess} />
              </div>
            )}
          </div>
          <img
            src="https://www.stoacap.com/1-stoa-home.jpg"
            alt="An oil study of a stoa on a stone terrace above the sea, among olives and cypresses."
            className="order-1 aspect-[16/10] w-full bg-stone object-cover lg:order-2"
          />
        </section>

        {/* One voice leads, large, on the olive of the painting */}
        {leadVoice && (
          <section className="mt-16 bg-olive px-5 py-14 text-paper md:mt-24 md:px-10 md:py-20">
            <button onClick={() => leadNote && onOpenNote?.(leadNote.slug)} className="group block max-w-[980px] text-left">
              <p className="text-[28px] leading-[1.2] tracking-[-0.02em] decoration-1 underline-offset-[6px] group-hover:underline md:text-[44px]">“{leadVoice.quote}”</p>
              <p className="mt-8 text-[16px] text-olive-soft">{leadVoice.who}</p>
            </button>
          </section>
        )}

        <section className="px-5 pt-16 md:px-10 md:pt-24">
          <ul className="grid grid-cols-1 gap-x-14 gap-y-14 md:grid-cols-3">
            {others.map((slug) => {
              const voice = stoaSources[slug]?.voice
              if (!voice) return null
              return (
                <li key={slug}>
                  <button onClick={() => onOpenNote?.(slug)} className="group text-left">
                    <p className="text-[21px] leading-[1.35] tracking-[-0.01em] decoration-1 underline-offset-4 group-hover:underline md:text-[22px]">“{voice.quote}”</p>
                    <p className="mt-5 text-[15px] text-quiet">{voice.who}</p>
                  </button>
                </li>
              )
            })}
          </ul>

          <button
            onClick={() => onNavigate?.('research')}
            className="mt-16 text-[16px] underline decoration-1 underline-offset-4 transition-opacity duration-150 hover:opacity-70"
          >
            Read the research
          </button>
        </section>
      </main>

      <Colophon />
    </div>
  )
}

export const args = {
  conversations: 214,
  intake: 'default',
}

export const argTypes = {
  conversations: { control: 'number' },
  intake: { control: 'radio', options: ['default', 'sent'] },
}
