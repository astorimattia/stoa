export type Issue = {
  number: number
  slug: string
  title: string
  dek: string
  market: string
  date: string
  readTime: string
  /** Access tier, mirrored from api/_stoa-pieces.js:
   *  open = anyone; members = any approved reader; restricted = per-reader grant.
   *  Defaults to members. */
  tier?: Tier
  /** Open pieces open directly at /research/<slug>; derived from tier. */
  public?: boolean
}

export type Tier = 'open' | 'members' | 'restricted'

export const tierOf = (issue: Pick<Issue, 'tier'>): Tier => issue.tier || 'members'

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
    tier: 'open',
    public: true,
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
    number: 0,
    slug: 'yc-s26-screening',
    title: 'S26 Screening',
    dek: 'Where YC is putting its money in S26: agents, industrials and the less obvious bets, screened by founder signal nine days before Demo Day.',
    market: 'YC',
    date: 'Sep 2026',
    readTime: '8 min',
    tier: 'restricted',
  },
]
