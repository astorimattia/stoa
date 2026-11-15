// Reader slugs shared by the article gate and the admin endpoint. The slug
// scopes everything: article delivery and approvals both resolve through
// this table, so an admin call can only ever touch a known piece.
//
// Tiers:
// - open:       anyone, no reading link.
// - members:    any approved, unexpired reader (one link works across pieces).
// - restricted: an approved reader who also holds a grant for this slug.
export const TIERS = ['open', 'members', 'restricted']

export const PIECES = {
  'yc-s26-screening': { title: 'S26 Screening', envKey: 'ARTICLE_YC_S26', tier: 'restricted' },
  'elections-vc': {
    title: 'Do US election results have an impact on venture capital?',
    envKey: 'ARTICLE_ELECTIONS_VC',
    tier: 'open',
  },
}

export const tierOf = (cfg) => (cfg && TIERS.includes(cfg.tier) ? cfg.tier : 'members')

/** Resolve a stored piece label (title or slug) back to its slug, or null. */
export function slugForLabel(label) {
  if (!label) return null
  for (const [slug, cfg] of Object.entries(PIECES)) {
    if (cfg.title === label || slug === label) return slug
  }
  return null
}

export const DEFAULT_LINK_DAYS = 30
export const MAX_LINK_DAYS = 365
