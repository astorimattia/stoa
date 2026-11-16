// Article delivery. The article text lives only in a sensitive Vercel env
// var (write-only; never in the public repo or the client bundle).
//
// Two states:
// - open pieces:  released to anyone, no token.
// - gated pieces: the token must belong to an approved reader whose access
//                 has not expired or been revoked. One active reader link
//                 opens every gated piece.
//
// Legacy per-piece links (stoa_requests rows minted before readers existed)
// still work as a fallback for their own piece, unless a reader row owns
// that token or that email - then the reader decision is authoritative, so
// a revoke or expiry always wins. Tokens are stored as SHA-256 hashes only
// and are never logged. Nothing here approves anyone.
//
// GET /api/article?piece=<slug>[&t=<token>]  -> { article }
// GET /api/article?access=1&t=<token>        -> { pieces: [slug...] } the
//     gated slugs this token opens (every gated piece for an active reader;
//     used by the research list); 403 if the token is not an active reader
//     or legacy link.

import { createHash } from 'node:crypto'
import { getSql, ensureSchema } from './_stoa-db.js'
import { PIECES, isOpen } from './_stoa-pieces.js'

const active = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

async function readerFor(sql, tokenHash) {
  const rows = await sql`
    select email, status, expires_at, revoked_at from stoa_readers where token_hash = ${tokenHash} limit 1
  `
  return rows[0] || null
}

// Legacy per-piece link: honoured only when no reader row governs it.
async function legacyOk(sql, tokenHash, cfg) {
  const rows = await sql`
    select lower(r.email) as email, r.status, r.expires_at, r.revoked_at
    from stoa_requests r
    where r.token_hash = ${tokenHash} and r.piece = ${cfg.title}
    limit 1
  `
  const r = rows[0]
  if (!active(r)) return false
  const owned = await sql`select 1 from stoa_readers where email = ${r.email} limit 1`
  return owned.length === 0
}

function send(res, cfg) {
  const raw = process.env[cfg.envKey]
  if (!raw) {
    console.error(`[stoa] ${cfg.envKey} not configured`)
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ article: JSON.parse(raw) })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const token = (req.query.t || '').toString().slice(0, 200)
  const wantsAccess = req.query.access === '1'
  const piece = (req.query.piece || '').toString().slice(0, 100)
  const cfg = PIECES[piece]

  if (!wantsAccess) {
    if (!cfg) return res.status(400).json({ error: 'Missing piece or token' })
    // Open pieces are already published openly (e.g. on Stoa's Substack).
    if (isOpen(cfg)) return send(res, cfg)
  }
  if (!token) return res.status(400).json({ error: 'Missing piece or token' })

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] DATABASE_URL not configured')
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    const tokenHash = createHash('sha256').update(token).digest('hex')
    const reader = await readerFor(sql, tokenHash)
    const member = active(reader)
    const gated = Object.entries(PIECES).filter(([, c]) => !isOpen(c))

    if (wantsAccess) {
      const open = []
      if (member) {
        for (const [slug] of gated) open.push(slug)
      } else if (!reader) {
        for (const [slug, c] of gated) {
          if (await legacyOk(sql, tokenHash, c)) open.push(slug)
        }
      }
      if (!member && !open.length) return res.status(403).json({ error: 'This reading link is not active' })
      return res.status(200).json({ pieces: open })
    }

    // A reader row is authoritative: an active reader opens every gated
    // piece; a revoked or expired reader is refused with no legacy fallback.
    let allowed = false
    if (member) {
      allowed = true
    } else if (!reader) {
      allowed = await legacyOk(sql, tokenHash, cfg)
    }
    if (!allowed) {
      return res.status(403).json({ error: 'This reading link is not active' })
    }
    return send(res, cfg)
  } catch (err) {
    console.error('[stoa] article lookup failed:', err)
    return res.status(502).json({ error: 'The reader is temporarily unavailable' })
  }
}
