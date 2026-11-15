// Tiered article delivery. The article text lives only in a sensitive Vercel
// env var (write-only; never in the public repo or the client bundle).
//
// - open pieces:       released to anyone, no token.
// - members pieces:    the token must belong to an approved reader whose
//                      access has not expired or been revoked.
// - restricted pieces: as members, plus an active grant for that slug.
//
// One reading link per reader: the same token opens every piece the reader
// can see. Legacy per-piece links (stoa_requests rows minted before readers
// existed) still work as a fallback, unless a reader row owns that token or
// that email - then the reader decision is authoritative, so a revoke or
// expiry always wins. Tokens are stored as SHA-256 hashes only and are never
// logged. Nothing here approves anyone.
//
// GET /api/article?piece=<slug>[&t=<token>]  -> { article }
// GET /api/article?access=1&t=<token>        -> { pieces: [slug...] } the
//     slugs this token opens (used by the research list); 403 if the
//     token is not an active reader or legacy link.

import { createHash } from 'node:crypto'
import { getSql, ensureSchema } from './_stoa-db.js'
import { PIECES, tierOf } from './_stoa-pieces.js'

const active = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

async function readerFor(sql, tokenHash) {
  const rows = await sql`
    select email, status, expires_at, revoked_at from stoa_readers where token_hash = ${tokenHash} limit 1
  `
  return rows[0] || null
}

async function grantsFor(sql, email) {
  const rows = await sql`select piece from stoa_grants where email = ${email} and revoked_at is null`
  return new Set(rows.map((r) => r.piece))
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
    if (tierOf(cfg) === 'open') return send(res, cfg)
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

    if (wantsAccess) {
      const open = []
      if (member) {
        const grants = await grantsFor(sql, reader.email)
        for (const [slug, c] of Object.entries(PIECES)) {
          const t = tierOf(c)
          if (t === 'members' || (t === 'restricted' && grants.has(slug))) open.push(slug)
        }
      } else if (!reader) {
        for (const [slug, c] of Object.entries(PIECES)) {
          if (tierOf(c) !== 'open' && (await legacyOk(sql, tokenHash, c))) open.push(slug)
        }
      }
      if (!member && !open.length) return res.status(403).json({ error: 'This reading link is not active' })
      return res.status(200).json({ pieces: open })
    }

    let allowed = false
    if (member) {
      allowed = tierOf(cfg) === 'members' || (await grantsFor(sql, reader.email)).has(piece)
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
