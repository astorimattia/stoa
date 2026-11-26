export type Status = 'new' | 'unread' | 'started' | 'read'

export type Progress = {
  status: Status
  /** How far through, 0 to 1, for a piece they started. */
  progress?: number
  minutesLeft?: number
  /** The section they stopped in. */
  section?: string
}

/**
 * Mara's reading history. She read the open election piece while her request
 * was pending, and Erebor and the S26 screening after approval. Two pieces
 * have landed since her last visit, and she is part-way through Consensus.
 */
const returning: Record<string, Progress> = {
  'us-election-venture': { status: 'read' },
  'applied-intuition': { status: 'new' },
  'space-insurance': { status: 'new' },
  consensus: { status: 'started', progress: 0.45, minutesLeft: 5, section: 'Who pays for citations' },
  erebor: { status: 'read' },
  's26-screening': { status: 'read' },
}

/** A reader's history for each state the reader home is shown in. */
export function historyFor(state: string): Record<string, Progress> {
  if (state === 'first-visit') {
    return Object.fromEntries(Object.keys(returning).map((s) => [s, { status: 'unread' as Status }]))
  }
  if (state === 'caught-up') {
    return Object.fromEntries(Object.keys(returning).map((s) => [s, { status: 'read' as Status }]))
  }
  return returning
}
