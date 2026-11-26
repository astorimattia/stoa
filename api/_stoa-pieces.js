// Piece registry for Stoa Research: every piece is known here, and the slug
// scopes everything - article delivery resolves through this table, so only
// a known piece can ever be served.
//
// Each piece has an access MODE (kept in the stoa_pieces table; the static
// defaults below only seed it):
// - open:     anyone, no reading link (elections-vc stays public, as Mattia
//             asked).
// - readers:  any approved, unexpired, unrevoked reader opens it. This is the
//             default for every new piece, so a new piece automatically opens
//             to everyone who already has library access.
// - selected: locked until Mattia explicitly grants it to a reader - even a
//             reader with full library access. For sensitive pieces.
//
// Readers have their own library scope (see api/_stoa-db.js): everything,
// everything with exclusions, or only picked pieces. A reader's scope can
// only narrow what a piece's mode would allow, never widen it.

export const PIECES = {
  'yc-s26-screening': { title: 'S26 Screening', envKey: 'ARTICLE_YC_S26' },
  'elections-vc': {
    title: 'Do US election results have an impact on venture capital?',
    envKey: 'ARTICLE_ELECTIONS_VC',
    open: true,
  },
  'space-insurance': {
    title: 'Space insurance is a market of twelve underwriters',
    envKey: 'ARTICLE_SPACE_INSURANCE',
  },
  consensus: {
    title: 'Consensus and the search for answers you can cite',
    envKey: 'ARTICLE_CONSENSUS',
  },
  erebor: {
    title: 'Erebor: a deep dive on the new bank for the innovation economy',
    envKey: 'ARTICLE_EREBOR',
  },
}

export const PIECE_MODES = ['open', 'readers']

// Static default only; the live mode comes from the stoa_pieces table.
export const defaultMode = (cfg) => (cfg && cfg.open === true ? 'open' : 'readers')
export const isOpen = (cfg) => defaultMode(cfg) === 'open'

export const DEFAULT_LINK_DAYS = 30
export const MAX_LINK_DAYS = 365
