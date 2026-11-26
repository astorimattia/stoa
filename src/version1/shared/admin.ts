import type { Role } from './RoleChoice'

/** Where on the site the request was sent from. */
export type Source = 'Home' | 'Issue page' | 'Locked piece' | 'Sign-in, no record'

export type RequestStatus = 'pending' | 'approved' | 'declined'

export type AccessRequest = {
  id: string
  name: string
  email: string
  company: string
  role: Role | null
  /** The piece they were trying to open, when they asked from a locked one. */
  piece: string | null
  source: Source
  received: string
  /** Their own words, from the optional box on the request form. */
  message: string | null
  /**
   * Matched automatically: the email's domain checked against Astori's own records
   * (portfolio, co-investors, LPs, past readers). Null when nothing matches.
   */
  record: string | null
  /** Written by whoever on the team knows the person. Empty until someone adds one. */
  note: string
  status: RequestStatus
  /** A second request from the same address. */
  repeat?: boolean
}

export const requests: AccessRequest[] = [
  {
    id: 'r1',
    name: 'Mara Lindqvist',
    email: 'mara@kiln.co',
    company: 'Kiln',
    role: 'Founder',
    piece: 'Applied Intuition and the autonomy stack',
    source: 'Locked piece',
    received: '12 min ago',
    message: 'We make thermal sensors for off-road autonomy and spoke to your team for the trucking piece.',
    record: 'Mentioned in 2 Stoa interviews',
    note: 'Kiln builds thermal sensors for off-road autonomy.',
    status: 'pending',
  },
  {
    id: 'r2',
    name: 'Daniel Okafor',
    email: 'd.okafor@northpine.vc',
    company: 'Northpine Ventures',
    role: 'Investor',
    piece: null,
    source: 'Home',
    received: '1 h ago',
    message: null,
    record: 'Co-investor, 2 deals since 2024',
    note: '',
    status: 'pending',
  },
  {
    id: 'r3',
    name: 'Priya Raman',
    email: 'priya.raman@gmail.com',
    company: 'Personal email',
    role: 'Operator',
    piece: null,
    source: 'Sign-in, no record',
    received: '3 h ago',
    message: 'I run fleet operations at a mid-size carrier. Using a personal address while between roles.',
    record: null,
    note: 'Tried to sign in first, then requested. Personal address, no company.',
    status: 'pending',
    repeat: true,
  },
  {
    id: 'r4',
    name: 'Tomás Herrera',
    email: 'tomas@halyard.aero',
    company: 'Halyard Aerospace',
    role: 'Operator',
    piece: 'Defense procurement after the drone wars',
    source: 'Issue page',
    received: 'Yesterday',
    message: 'Read the free piece, would like the defense one before our board meeting.',
    record: 'Portfolio company',
    note: 'Head of programs at Halyard.',
    status: 'pending',
  },
  {
    id: 'r5',
    name: 'Sophie Brandt',
    email: 'sbrandt@meridianlp.com',
    company: 'Meridian Partners',
    role: 'Investor',
    piece: null,
    source: 'Home',
    received: '2 days ago',
    message: null,
    record: 'LP in Fund II',
    note: '',
    status: 'pending',
  },
  {
    id: 'r6',
    name: 'James Whitfield',
    email: 'james@ferrous.io',
    company: 'Ferrous',
    role: 'Founder',
    piece: null,
    source: 'Home',
    received: '3 days ago',
    message: null,
    record: null,
    note: '',
    status: 'approved',
  },
  {
    id: 'r7',
    name: 'Lena Vogt',
    email: 'lena@recruitwave.com',
    company: 'Recruitwave',
    role: null,
    piece: null,
    source: 'Home',
    received: '4 days ago',
    message: 'We place senior engineers at autonomy startups.',
    record: null,
    note: 'Recruiting agency.',
    status: 'declined',
  },
]

export type Reader = {
  name: string
  email: string
  company: string
  role: Role
  since: string
  lastRead: string
  opened: number
}

export const readers: Reader[] = [
  { name: 'James Whitfield', email: 'james@ferrous.io', company: 'Ferrous', role: 'Founder', since: 'Nov 2026', lastRead: 'Today', opened: 2 },
  { name: 'Ana Costa', email: 'ana@tessellate.ai', company: 'Tessellate', role: 'Founder', since: 'Oct 2026', lastRead: 'Yesterday', opened: 5 },
  { name: 'Rob Feeney', email: 'rfeeney@harbourcap.com', company: 'Harbour Capital', role: 'Investor', since: 'Sep 2026', lastRead: '3 days ago', opened: 6 },
  { name: 'Ingrid Sæther', email: 'ingrid@fjordlogistics.no', company: 'Fjord Logistics', role: 'Operator', since: 'Sep 2026', lastRead: '1 week ago', opened: 3 },
  { name: 'Marcus Bell', email: 'marcus@bell.family', company: 'Bell Family Office', role: 'Investor', since: 'Aug 2026', lastRead: '2 weeks ago', opened: 4 },
  { name: 'Yuki Tanaka', email: 'yuki@halyard.aero', company: 'Halyard Aerospace', role: 'Operator', since: 'Jul 2026', lastRead: '5 weeks ago', opened: 1 },
  { name: 'Chloé Martin', email: 'chloe@lumen.energy', company: 'Lumen Energy', role: 'Founder', since: 'Jun 2026', lastRead: 'Never', opened: 0 },
]
