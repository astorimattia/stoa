// Token-gated article delivery. Article text lives only in Neon, never in
// the client bundle. A reading link carries a per-requester approval token;
// this endpoint verifies it server-side (approved, not revoked, not expired)
// before releasing content. Approvals are granted one by one by Mattia -
// nothing here auto-approves.

import { getSql, ensureSchema } from './_stoa-db.js'

// Reader slugs to the piece title stored on the request row.
const PIECES = { 'yc-s26-screening': 'S26 Screening' }

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const piece = (req.query.piece || '').toString().slice(0, 100)
  const token = (req.query.t || '').toString().slice(0, 200)
  const title = PIECES[piece]
  if (!title || !token) {
    return res.status(400).json({ error: 'Missing piece or token' })
  }

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] DATABASE_URL not configured')
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    const rows = await sql`
      select status, expires_at, revoked_at
      from stoa_requests
      where token = ${token} and piece = ${title}
      limit 1
    `
    const r = rows[0]
    const active =
      r &&
      r.status === 'approved' &&
      !r.revoked_at &&
      (!r.expires_at || new Date(r.expires_at) > new Date())
    if (!active) {
      return res.status(403).json({ error: 'This reading link is not active' })
    }

    const arts = await sql`select content from stoa_articles where piece = ${piece} limit 1`
    if (!arts[0]) {
      console.error(`[stoa] approved token but no content stored for ${piece}`)
      return res.status(404).json({ error: 'Piece not available' })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ article: arts[0].content })
  } catch (err) {
    console.error('[stoa] article lookup failed:', err)
    return res.status(502).json({ error: 'The reader is temporarily unavailable' })
  }
}
