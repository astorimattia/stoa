import { issues } from './issues'

/** Open: anyone can read it. Closed: approved readers only, everyone else sees the lock and the request form. */
export type Access = 'open' | 'closed'

export type Piece = {
  slug: string
  number: number
  title: string
  dek: string
  market: string
  date: string
  readTime: string
  access: Access
  /** Written here, or brought over from the Substack archive. */
  origin: 'Stoa' | 'Substack'
  /** Times a signed-in reader opened it; for an open piece, every visit. */
  reads: number
  /** Access requests sent from this piece's lock. */
  requests: number
}

const stats: Record<string, { reads: number; requests: number; origin?: 'Substack' }> = {
  'us-election-venture': { reads: 1284, requests: 0 },
  'applied-intuition': { reads: 96, requests: 9 },
  'space-insurance': { reads: 71, requests: 4 },
  consensus: { reads: 58, requests: 2, origin: 'Substack' },
  erebor: { reads: 112, requests: 6, origin: 'Substack' },
  's26-screening': { reads: 143, requests: 11, origin: 'Substack' },
}

export const pieces: Piece[] = issues.map((i) => ({
  slug: i.slug,
  number: i.number,
  title: i.title,
  dek: i.dek,
  market: i.market,
  date: i.date,
  readTime: i.readTime,
  access: i.free ? 'open' : 'closed',
  origin: stats[i.slug]?.origin ?? 'Stoa',
  reads: stats[i.slug]?.reads ?? 0,
  requests: stats[i.slug]?.requests ?? 0,
}))

export const MARKETS = ['Autonomy', 'Space', 'AI search', 'Fintech', 'Venture', 'Defense', 'Energy', 'YC']

/** What the Substack archive at stoacap.substack.com returns. Three are already on Stoa. */
export type SubstackPost = {
  slug: string
  title: string
  date: string
  readTime: string
  /** Paywalled on Substack, so it arrives closed by default. */
  paid: boolean
  /** Already brought over; shown, but not selectable. */
  imported: boolean
}

export const SUBSTACK_URL = 'stoacap.substack.com'

export const substackPosts: SubstackPost[] = [
  { slug: 'defense-procurement', title: 'Defense procurement after the drone wars', date: 'Sep 2026', readTime: '16 min', paid: true, imported: false },
  { slug: 'grid-interconnect', title: 'The interconnection queue is the real energy bottleneck', date: 'Aug 2026', readTime: '12 min', paid: true, imported: false },
  { slug: 'w26-screening', title: 'W26 Screening', date: 'Apr 2026', readTime: '19 min', paid: false, imported: false },
  { slug: 's26-screening', title: 'S26 Screening', date: 'Sep 2026', readTime: '22 min', paid: true, imported: true },
  { slug: 'erebor', title: 'Erebor: a deep dive on the new bank for the innovation economy', date: 'Oct 2026', readTime: '18 min', paid: true, imported: true },
  { slug: 'consensus', title: 'Consensus and the search for answers you can cite', date: 'Oct 2026', readTime: '9 min', paid: false, imported: true },
]

/** How many approved readers an email about a new piece would reach. */
export const READER_COUNT = 214
