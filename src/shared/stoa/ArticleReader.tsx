import { useState } from 'react'

type MemoItem = { title: string; body: string }
type MemoSection = { id: string; label: string | null; paragraphs: string[]; items?: MemoItem[] }
export type Memo = {
  slug: string
  title: string
  entity: string
  author: string
  date: string
  subtitle?: string
  sections: MemoSection[]
}

const sectionLabel = (s: MemoSection, index: number) =>
  s.label ?? (index === 0 ? 'Overview' : `Section ${index + 1}`)

export default function ArticleReader({ memo, onBack }: { memo: Memo; onBack: () => void }) {
  const [tocOpen, setTocOpen] = useState(false)

  return (
    <div className="min-h-screen bg-ink font-sans text-paper">
      <header className="flex w-full items-center justify-between border-b border-paper/10 px-6 py-5 md:px-12">
        <button
          onClick={onBack}
          className="text-[13px] uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-paper"
        >
          Stoa
        </button>
        <span className="text-[13px] uppercase tracking-[0.2em] text-paper/60">Research</span>
      </header>

      <main className="mx-auto max-w-[680px] px-6 py-16 md:py-24">
        <div className="mb-10">
          <div className="mb-4 text-[12px] uppercase tracking-[0.25em] text-paper/50">{memo.entity}</div>
          <h1 className="mb-6 font-serif text-4xl leading-tight md:text-5xl">{memo.title}</h1>
          <div className="mb-6 flex flex-wrap items-center gap-3 text-[13px] text-paper/60">
            <span>{memo.author}</span>
            <span className="inline-block h-1 w-1 rounded-full bg-paper/40"></span>
            <span>{memo.date}</span>
          </div>
          {memo.subtitle && <p className="leading-relaxed text-paper/70">{memo.subtitle}</p>}
        </div>

        <div className="mb-12 border-t border-paper/10 pt-6">
          <button
            onClick={() => setTocOpen(!tocOpen)}
            className="text-[12px] uppercase tracking-[0.2em] text-paper/50 transition-colors hover:text-paper"
          >
            {tocOpen ? 'Hide contents' : 'Contents'}
          </button>
          {tocOpen && (
            <nav className="mt-5">
              <ul className="space-y-3">
                {memo.sections.map((s, i) => (
                  <li key={s.id}>
                    <a
                      href={`#section-${s.id}`}
                      className="text-[13px] uppercase tracking-[0.12em] text-paper/70 transition-colors hover:text-paper"
                    >
                      {sectionLabel(s, i)}
                    </a>
                  </li>
                ))}
              </ul>
            </nav>
          )}
        </div>

        {memo.sections.map((s, i) => (
          <section key={s.id} id={`section-${s.id}`} className="mb-16 scroll-mt-24">
            <h2 className="mb-8 font-serif text-2xl leading-tight md:text-3xl">{sectionLabel(s, i)}</h2>
            {s.paragraphs.map((p, pi) => (
              <p key={pi} className="mb-6 text-[16px] leading-[1.8] text-paper/75">
                {p}
              </p>
            ))}
            {s.items && (
              <div className="mt-8 space-y-6">
                {s.items.map((item) => (
                  <div key={item.title} className="border-l border-paper/15 pl-5">
                    <div className="mb-1 font-medium text-paper">{item.title}</div>
                    <p className="text-[14px] leading-[1.7] text-paper/60">{item.body}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}

        <footer className="mt-20 border-t border-paper/10 pt-8">
          <button
            onClick={onBack}
            className="text-[13px] uppercase tracking-[0.2em] text-paper/60 transition-colors hover:text-paper"
          >
            Back to Stoa
          </button>
        </footer>
      </main>
    </div>
  )
}
