import { ArrowLeft, ArrowUpRight } from 'lucide-react'

export type AuthorPiece = { path: string; title: string; date: string }
export type AuthorLink = { label: string; href: string }
export type Author = {
  slug: string
  name: string
  role: string
  location?: string
  bio: string
  pieces: AuthorPiece[]
  links: AuthorLink[]
}

/** Public author profiles. Keep entries to facts already public elsewhere. */
export const AUTHORS: Record<string, Author> = {
  dinki: {
    slug: 'dinki',
    name: 'DINKI',
    role: 'Research, Stoa',
    location: 'San Francisco',
    bio: 'Dinki runs research at Stoa. Before Stoa he was Funds & Community at Wefunder (2023-2026). He is based in San Francisco and studied at the University of Michigan.',
    pieces: [
      {
        path: '/research/elections-vc',
        title: 'Do US election results have an impact on venture capital?',
        date: '13 NOV 2026',
      },
    ],
    links: [
      { label: 'LinkedIn', href: 'https://www.linkedin.com/in/mahamed-dinki-306414129' },
      { label: 'Stoa Research on Substack', href: 'https://stoaresearch.substack.com' },
    ],
  },
}

function Strip() {
  return (
    <div className="flex select-none items-center gap-3 bg-ink px-4 py-2 font-sans text-[13px] text-paper sm:px-5">
      <a href="/" aria-label="Back to Stoa" className="group -ml-1 inline-flex shrink-0 items-center p-1">
        <ArrowLeft className="h-3.5 w-3.5 text-paper/60 transition-[color,transform] duration-200 ease-soft group-hover:text-paper motion-safe:group-hover:-translate-x-0.5" />
      </a>
      <span className="min-w-0 flex-1 truncate text-paper/75">Built on conversations with experts.</span>
    </div>
  )
}

function Footer() {
  return (
    <footer className="flex select-none flex-wrap items-center justify-between gap-x-6 gap-y-1 border-t border-paper/10 bg-ink px-4 py-2.5 font-sans text-xs text-paper/70 sm:px-5">
      <span>© 2026 Stoa</span>
      <span>Nothing here is investment advice.</span>
    </footer>
  )
}

export default function AuthorProfile({ author }: { author: Author }) {
  return (
    <div className="flex min-h-full flex-col bg-paper font-serif text-ink">
      <Strip />
      <section className="mx-auto w-full max-w-6xl flex-1 px-6 pb-16 pt-12 lg:px-10 lg:pt-16">
        <p className="flex flex-wrap gap-x-5 gap-y-1 font-sans text-sm text-muted">
          <span>{author.role}</span>
          {author.location && <span>{author.location}</span>}
        </p>
        <h1 className="mt-5 text-4xl font-light leading-[1.05] tracking-tight sm:text-5xl lg:text-[68px]">
          {author.name}
        </h1>
        <p className="mt-6 max-w-3xl text-xl leading-relaxed text-ink/75">{author.bio}</p>

        <div className="mt-12 max-w-3xl border-t border-rule pt-4">
          <h2 className="font-sans text-sm uppercase tracking-wide text-muted">Pieces</h2>
          <ul className="mt-4 divide-y divide-rule">
            {author.pieces.map((p) => (
              <li key={p.path}>
                <a href={p.path} className="group flex items-baseline justify-between gap-6 py-4">
                  <span className="text-lg leading-snug text-ink transition-colors group-hover:text-ink/70">
                    {p.title}
                  </span>
                  <span className="shrink-0 font-sans text-sm text-muted">{p.date}</span>
                </a>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-10 max-w-3xl border-t border-rule pt-4 font-sans text-sm">
          <h2 className="uppercase tracking-wide text-muted">Elsewhere</h2>
          <p className="mt-4 flex flex-wrap gap-x-6 gap-y-2">
            {author.links.map((l) => (
              <a
                key={l.href}
                href={l.href}
                target="_blank"
                rel="noopener noreferrer"
                className="group inline-flex items-center gap-1 text-ink transition-colors hover:text-ink/70"
              >
                {l.label}
                <ArrowUpRight className="h-3.5 w-3.5 text-muted transition-[color,transform] duration-200 ease-soft group-hover:text-ink/70 motion-safe:group-hover:-translate-y-0.5 motion-safe:group-hover:translate-x-0.5" />
              </a>
            ))}
          </p>
        </div>
      </section>
      <Footer />
    </div>
  )
}
