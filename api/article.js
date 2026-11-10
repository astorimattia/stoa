// Token-gated article delivery. The article text lives only in a sensitive
// Vercel env var (write-only; never in the public repo or the client bundle).
// A reading link carries a per-requester approval token; this endpoint
// verifies it server-side (approved, not revoked, not expired, via Neon)
// before releasing content. Approvals are granted one by one by Mattia -
// nothing here auto-approves. Tokens are stored as SHA-256 hashes only.

import { createHash } from 'node:crypto'
import { getSql, ensureSchema } from './_stoa-db.js'
import { PIECES } from './_stoa-pieces.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const piece = (req.query.piece || '').toString().slice(0, 100)
  const token = (req.query.t || '').toString().slice(0, 200)
  const cfg = PIECES[piece]
  if (!cfg || !token) {
    return res.status(400).json({ error: 'Missing piece or token' })
  }

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] DATABASE_URL not configured')
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const rows = await sql`
      select status, expires_at, revoked_at
      from stoa_requests
      where token_hash = ${tokenHash} and piece = ${cfg.title}
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

    const raw = process.env[cfg.envKey]
    if (!raw) {
      console.error(`[stoa] approved token but ${cfg.envKey} not configured`)
      return res.status(503).json({ error: 'The reader is not configured yet' })
    }

    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json({ article: JSON.parse(raw) })
  } catch (err) {
    console.error('[stoa] article lookup failed:', err)
    return res.status(502).json({ error: 'The reader is temporarily unavailable' })
  }
}
