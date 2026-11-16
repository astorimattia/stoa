// Article delivery. In production the article text lives only in a
// sensitive Vercel env var (write-only; never in the public repo or the
// client bundle). In demo mode the preview serves built-in demo copy
// instead, so the real texts are never touched.
//
// Three piece modes (see api/_stoa-pieces.js):
// - open:     released to anyone, no token.
// - readers:  any active reader opens it, unless their own library scope
//             (exclusions / picked pieces) says no.
// - selected: only readers with an explicit grant open it, however wide
//             their library access is.
//
// Legacy per-piece links (stoa_requests rows minted before readers existed)
// still work as a fallback for their own 'readers'-mode piece, unless a
// reader row owns that token or that email - then the reader decision is
// authoritative, so a revoke or expiry always wins. Tokens are stored as
// SHA-256 hashes only and are never logged. Nothing here approves anyone.
//
// GET /api/article?piece=<slug>[&t=<token>]  -> { article }
// GET /api/article?access=1&t=<token>        -> { pieces: [slug...] } the
//     slugs this token opens (used by the research list); 403 if the token
//     is not an active reader or legacy link.

import { createHash } from 'node:crypto'
import { getSql, ensureSchema, T, pieceModes, readerCanRead } from './_stoa-db.js'
import { PIECES, defaultMode } from './_stoa-pieces.js'

const active = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

async function readerFor(sql, tokenHash) {
  const rows = await sql`
    select email, status, access_mode, expires_at, revoked_at from ${T(sql, 'stoa_readers')}
    where token_hash = ${tokenHash} limit 1
  `
  return rows[0] || null
}

async function grantsFor(sql, email) {
  const rows = await sql`select piece from ${T(sql, 'stoa_grants')} where email = ${email}`
  return new Set(rows.map((r) => r.piece))
}

async function exclusionsFor(sql, email) {
  const rows = await sql`select piece from ${T(sql, 'stoa_exclusions')} where email = ${email}`
  return new Set(rows.map((r) => r.piece))
}

// Legacy per-piece link: honoured only when no reader row governs it.
async function legacyOk(sql, tokenHash, cfg) {
  const rows = await sql`
    select lower(r.email) as email, r.status, r.expires_at, r.revoked_at
    from ${T(sql, 'stoa_requests')} r
    where r.token_hash = ${tokenHash} and r.piece = ${cfg.title}
    limit 1
  `
  const r = rows[0]
  if (!active(r)) return false
  const owned = await sql`select 1 from ${T(sql, 'stoa_readers')} where email = ${r.email} limit 1`
  return owned.length === 0
}

function send(res, cfg, slug) {
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

  if (!wantsAccess && !cfg) return res.status(400).json({ error: 'Missing piece or token' })

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] DATABASE_URL not configured')
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    const modes = await pieceModes(sql)
    const modeOf = (slug) => modes[slug] || defaultMode(PIECES[slug])

    // Open pieces are already published openly (e.g. on Stoa's Substack).
    if (!wantsAccess && modeOf(piece) === 'open') return send(res, cfg, piece)
    if (!token) return res.status(400).json({ error: 'Missing piece or token' })

    const tokenHash = createHash('sha256').update(token).digest('hex')
    const reader = await readerFor(sql, tokenHash)
    const member = active(reader)
    const grants = reader ? await grantsFor(sql, reader.email) : new Set()
    const exclusions = reader ? await exclusionsFor(sql, reader.email) : new Set()

    if (wantsAccess) {
      const open = []
      if (member) {
        for (const [slug] of Object.entries(PIECES)) {
          const mode = modeOf(slug)
          if (mode !== 'open' && readerCanRead(reader, slug, mode, grants, exclusions)) open.push(slug)
        }
      } else if (!reader) {
        for (const [slug, c] of Object.entries(PIECES)) {
          if (modeOf(slug) === 'readers' && (await legacyOk(sql, tokenHash, c))) open.push(slug)
        }
      }
      if (!member && !open.length) return res.status(403).json({ error: 'This reading link is not active' })
      return res.status(200).json({ pieces: open })
    }

    // A reader row is authoritative: an active reader opens what their
    // scope and the piece's mode allow; a revoked or expired reader is
    // refused with no legacy fallback.
    const mode = modeOf(piece)
    let allowed = false
    if (member) {
      allowed = readerCanRead(reader, piece, mode, grants, exclusions)
    } else if (!reader && mode === 'readers') {
      allowed = await legacyOk(sql, tokenHash, cfg)
    }
    if (!allowed) {
      return res.status(403).json({ error: 'This reading link is not active' })
    }
    return send(res, cfg, piece)
  } catch (err) {
    console.error('[stoa] article lookup failed:', err)
    return res.status(502).json({ error: 'The reader is temporarily unavailable' })
  }
}
