// Content for the Stoa site. A dagger on a note means Stoa or its affiliates hold a position in a company it discusses.

export type StoaNote = {
  slug: string
  title: string
  topic: string
  date: string
  minutes: number
  held?: boolean
  /** The note's own subtitle, where the published note has one. */
  dek?: string
  /** The note's first chart, as published on stoacap.com. */
  figure?: string
}

export const stoaNotes: StoaNote[] = [
  { slug: 'anthropic-ipo', title: 'Making sense of Anthropic’s IPO', topic: 'Public markets', date: '17 Nov 2026', minutes: 14, dek: 'Anthropic plans to price its IPO on Wednesday, and the world is watching.', figure: 'https://astori.vc/notes/6-anthropic-ipo-chart-1.jpg' },
  { slug: 'micron-margin', title: 'Micron earns a higher gross margin than Nvidia. How long can it last?', topic: 'Semiconductors', date: '18 Nov 2026', minutes: 11, dek: 'The memory chip maker now keeps more of every sales dollar than Nvidia does.', figure: 'https://astori.vc/notes/5-micron-margin-chart-1.jpg' },
  { slug: 'elections-vc', title: 'Do US election results have an impact on venture capital?', topic: 'Venture', date: '13 Nov 2026', minutes: 18, dek: 'I checked the last 19 federal elections against 30 years of venture data. The results surprised me.', figure: 'https://astori.vc/notes/10-elections-vc-chart-1.png' },
  { slug: 'erebor', title: 'Erebor: a deep dive on the new bank for the innovation economy', topic: 'Fintech', date: '14 Oct 2026', minutes: 22, held: true },
  { slug: 'space-insurance', title: 'Space insurance: is now the time?', topic: 'Space', date: '27 Oct 2026', minutes: 16, dek: 'An analysis of the space insurance market and its potential future value.', figure: 'https://astori.vc/notes/space-insurance-us-military-intel-spending.png' },
  { slug: 'beyond-consensus', title: 'Beyond consensus', topic: 'Venture', date: '24 Sep 2026', minutes: 9 },
  { slug: 's26-screening', title: 'S26 screening', topic: 'YC', date: '11 Sep 2026', minutes: 7, held: true },
]

export type StoaPosition = {
  company: string
  sector: string
  entered: string
  /** The note that came before the position, by slug, or a one-line reason when there is none in public. */
  note?: string
  reason?: string
  website?: string
  /** Conversations held before the position was entered. Placeholder counts. */
  conversations?: number
}

export const stoaPositions: StoaPosition[] = [
  { company: 'Erebor', sector: 'Banking', entered: 'Nov 2026', note: 'erebor', reason: 'A national bank built for the companies the big banks stopped understanding after SVB.', website: 'https://erebor.bank', conversations: 11 },
  { company: 'Fluidstack', sector: 'Compute', entered: 'Aug 2026', reason: 'GPU capacity sold forward to the labs, financed against the contracts.', website: 'https://fluidstack.io', conversations: 8 },
  { company: 'Kalshi', sector: 'Exchanges', entered: 'Jun 2026', reason: 'A regulated venue for event contracts, ahead of the volume.', website: 'https://kalshi.com', conversations: 6 },
  { company: 'AMI Labs', sector: 'Research', entered: 'Apr 2026', reason: 'World models from a team that has argued for them for a decade.', website: 'https://amilabs.xyz', conversations: 5 },
  { company: 'Waymo', sector: 'Autonomy', entered: 'Feb 2026', reason: 'Paid rides per week, compounding city by city.', website: 'https://waymo.com', conversations: 9 },
]

export const noteBySlug = (slug: string) => stoaNotes.find((n) => n.slug === slug)

/**
 * Whether the site shows the expert quotes and "We spoke with" lists below.
 * Off for the public launch: these are illustrative and anonymised. Turn it back on once they are the real calls.
 */
export const SHOW_VOICES = false

// Who each note drew on. Illustrative and anonymised: replace with the real calls behind each note.
export type StoaVoice = { quote: string; who: string }
export type StoaSources = { count: number; roles: string[]; voice?: StoaVoice }

export const stoaSources: Record<string, StoaSources> = {
  'anthropic-ipo': {
    count: 9,
    roles: ['Portfolio manager at a crossover fund', 'Former head of an IPO desk at a bulge-bracket bank', 'Infrastructure lead at a hyperscaler'],
    voice: { quote: 'The public market will pay for growth. It won’t pay for a compute bill it can’t see the end of.', who: 'Portfolio manager at a crossover fund' },
  },
  'micron-margin': {
    count: 6,
    roles: ['Former DRAM product lead at a top-three memory maker', 'Supply chain director at a server maker', 'Former sell-side semiconductor analyst'],
    voice: { quote: 'HBM changed who holds the pricing power. For the first time in my career, the memory makers get to say no.', who: 'Former DRAM product lead at a top-three memory maker' },
  },
  'elections-vc': {
    count: 4,
    roles: ['Venture partner investing since 1996', 'Head of private markets at a university endowment', 'Economist who studies venture cycles'],
    voice: { quote: 'We never changed pace for an election. We changed pace for rates.', who: 'Head of private markets at a university endowment' },
  },
  erebor: {
    count: 11,
    roles: ['Former chief credit officer at a regional bank', 'Former bank examiner', 'CFO of a venture-backed hardware company'],
    voice: { quote: 'The banks that pulled back after SVB didn’t leave because of the risk. They left because nobody there understood the customers.', who: 'Former chief credit officer at a regional bank' },
  },
  'space-insurance': {
    count: 7,
    roles: ['Former underwriter at a Lloyd’s syndicate', 'Mission assurance lead at a launch company', 'CFO of a satellite operator'],
    voice: { quote: 'Nobody prices a launch off the rocket any more. They price it off the last three failures of that rocket.', who: 'Former underwriter at a Lloyd’s syndicate' },
  },
  'beyond-consensus': {
    count: 3,
    roles: ['Seed investor in four of the last decade’s top AI companies', 'Founder of a model-serving company'],
  },
  's26-screening': {
    count: 12,
    roles: ['Founders from recent batches', 'Partners at seed funds'],
  },
}

// Experts who agreed to be named. Placeholder names and roles: replace with real people, with their permission and photo.
export type StoaExpert = { name: string; role: string; notes: string[]; photo?: string }

export const stoaExperts: StoaExpert[] = [
  { name: 'Margaret Ellison', role: 'Former underwriter, Lloyd’s of London', notes: ['space-insurance'] },
  { name: 'David Kwon', role: 'Former DRAM product lead, memory maker', notes: ['micron-margin'] },
  { name: 'Ruth Adeyemi', role: 'Former chief credit officer, regional bank', notes: ['erebor'] },
  { name: 'Tomás Herrera', role: 'Portfolio manager, crossover fund', notes: ['anthropic-ipo'] },
  { name: 'Alan Whitcombe', role: 'Venture partner since 1996', notes: ['elections-vc', 'beyond-consensus'] },
  { name: 'Priya Natarajan', role: 'Mission assurance lead, launch company', notes: ['space-insurance'] },
  { name: 'James Okafor', role: 'Former bank examiner', notes: ['erebor'] },
  { name: 'Lena Brandt', role: 'Head of private markets, university endowment', notes: ['elections-vc'] },
]

/** The voices the home page leads with, in order. */
export const homeVoices = ['space-insurance', 'micron-margin', 'erebor', 'anthropic-ipo']
