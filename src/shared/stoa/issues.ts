export type Issue = {
  number: number
  slug: string
  title: string
  dek: string
  market: string
  date: string
  readTime: string
  /** Open pieces need no reading link and open directly at /research/<slug>.
   *  Every other piece is gated: any active reader's link opens it.
   *  Mirrors `open: true` in api/_stoa-pieces.js. */
  public?: boolean
}

/** Gated unless marked public. */
export const isGated = (issue: Pick<Issue, 'public'>): boolean => !issue.public

/** Stoa's launch set — newest first. */
export const issues: Issue[] = [
  {
    number: 5,
    slug: 'elections-vc',
    title: 'Do US election results have an impact on venture capital?',
    dek: 'I checked the last 19 federal elections against 30 years of venture data. The results surprised me.',
    market: 'Venture',
    date: 'Nov 2026',
    readTime: '9 min',
    public: true,
  },
  {
    number: 3,
    slug: 'space-insurance',
    title: 'Space Insurance; Is Now The Time?',
    dek: 'An analysis of the space insurance market and the potential future value.',
    market: 'Space',
    date: 'Oct 2026',
    readTime: '7 min',
    public: true,
  },
  {
    number: 2,
    slug: 'consensus',
    title: 'Beyond Consensus',
    dek: 'The market has priced its winners. I want to map the world once those bets play out, and invest in what becomes scarce then.',
    market: 'Venture',
    date: 'Sep 2026',
    readTime: '9 min',
    public: true,
  },
  {
    number: 1,
    slug: 'erebor',
    title: 'Erebor: a deep dive on the new bank for the innovation economy',
    dek: 'A chartered bank built for technology companies, two years after SVB. The thesis, the regulatory path and the open questions.',
    market: 'Fintech',
    date: 'Oct 2026',
    readTime: '18 min',
  },
  {
    number: 0,
    slug: 'yc-s26-screening',
    title: 'S26 Screening',
    dek: 'Where YC is putting its money in S26: agents, industrials and the less obvious bets, screened by founder signal nine days before Demo Day.',
    market: 'YC',
    date: 'Sep 2026',
    readTime: '8 min',
  },
]
