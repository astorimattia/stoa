// Reader slugs shared by the article gate and the admin endpoint. The slug
// scopes everything: article delivery resolves through this table, so only
// a known piece can ever be served.
//
// Two states only:
// - open:  anyone, no reading link (open: true).
// - gated: everything else. Any approved, unexpired, unrevoked reader's
//          link opens every gated piece.

export const PIECES = {
  'yc-s26-screening': { title: 'S26 Screening', envKey: 'ARTICLE_YC_S26' },
  'elections-vc': {
    title: 'Do US election results have an impact on venture capital?',
    envKey: 'ARTICLE_ELECTIONS_VC',
    open: true,
  },
}

export const isOpen = (cfg) => !!(cfg && cfg.open === true)

export const DEFAULT_LINK_DAYS = 30
export const MAX_LINK_DAYS = 365
