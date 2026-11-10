// Reader slugs shared by the article gate and the admin endpoint. The slug
// scopes everything: article delivery and approvals both resolve through
// this table, so an admin call can only ever touch a known piece.
export const PIECES = {
  'yc-s26-screening': { title: 'S26 Screening', envKey: 'ARTICLE_YC_S26' },
}

export const DEFAULT_LINK_DAYS = 30
export const MAX_LINK_DAYS = 365
