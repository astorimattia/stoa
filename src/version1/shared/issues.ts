export type Issue = {
  number: number
  slug: string
  title: string
  dek: string
  market: string
  date: string
  readTime: string
  /** Open to everyone, signed in or not. */
  free?: boolean
}

/** The one piece with a full written body in the prototype. */
export const featured = 'applied-intuition'

/** Stoa's reading list — newest first, as on stoacap.com/research. */
export const issues: Issue[] = [
  {
    number: 6,
    slug: 'us-election-venture',
    title: 'Do US election results have an impact on venture capital?',
    dek: 'Fifty years of fundraising, deployment and exits, set against who won. The pattern is weaker than the commentary suggests.',
    market: 'Venture',
    date: 'Nov 2026',
    readTime: '8 min',
    free: true,
  },
  {
    number: 4,
    slug: 'applied-intuition',
    title: 'Applied Intuition and the software layer of physical autonomy',
    dek: 'Why the company that sold simulation to carmakers is now positioned to sell autonomy to anything that moves — and what that means for the next wave of defense and industrial startups.',
    market: 'Autonomy',
    date: 'Nov 2026',
    readTime: '14 min',
  },
  {
    number: 3,
    slug: 'space-insurance',
    title: 'Space insurance is a market of twelve underwriters',
    dek: 'Launch cadence has gone vertical while underwriting capacity has not. Who carries the risk of a constellation, and where new capital gets in.',
    market: 'Space',
    date: 'Nov 2026',
    readTime: '11 min',
  },
  {
    number: 2,
    slug: 'consensus',
    title: 'Consensus and the search for answers you can cite',
    dek: 'Academic search is becoming an AI product category. What a research engine needs to win clinicians, analysts and students at once.',
    market: 'AI search',
    date: 'Oct 2026',
    readTime: '9 min',
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
    number: 5,
    slug: 's26-screening',
    title: 'S26 Screening',
    dek: 'Our read of the Summer 2026 Y Combinator batch: the companies we met, the markets they point to, and the few we would back.',
    market: 'YC',
    date: 'Sep 2026',
    readTime: '22 min',
  },
]
