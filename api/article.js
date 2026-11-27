// Article delivery. In production the article text lives only in a
// sensitive Vercel env var (write-only; never in the public repo or the
// client bundle). In demo mode the preview serves built-in demo copy
// instead, so the real texts are never touched.
//
// Piece modes (see api/_stoa-pieces.js):
// - open:   released to anyone, no session.
// - any other mode: gated - an active reader opens it. Access is
//   account-wide: one approval opens the whole locked library, and the
//   piece recorded on a request is a demand signal, not a scope.
//   Per-piece grants/exclusions are no longer consulted.
//
// A Better Auth session proves the email; the readers table decides
// whether that email may read. A session alone never grants access, and
// revoking the reader row blocks reading even while the session stays
// valid. Nothing here approves anyone.
//
// GET /api/article?piece=<slug>[&t=<token>]  -> { article }
// GET /api/article?access=1&t=<token>        -> { pieces: [slug...] } the
//     slugs this token opens (used by the research list); 403 if the token
//     is not an active reader or legacy link.

import { legacyAccess, legacyReaderAllows, legacyReaderByToken } from './_legacy-access.js'
import { gunzipSync } from 'node:zlib'
import { getSql, ensureSchema, T, pieceModes, readerCanRead } from './_stoa-db.js'
import { PIECES, defaultMode } from './_stoa-pieces.js'
import { ensureContentSchema, CODE_PIECE_META } from './_stoa-content.js'
import { getAuth } from './_auth.js'

const active = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

async function readerByEmail(sql, email, table) {
  const rows = await sql`
    select email, status, access_mode, expires_at, revoked_at from ${T(sql, table)}
    where lower(email) = lower(${email}) limit 1
  `
  return rows[0] || null
}

function send(res, cfg, slug) {
  let raw = process.env[cfg.envKey]
  if (!raw) {
    console.error(`[stoa] ${cfg.envKey} not configured`)
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }
  // Values prefixed `gz:` are gzip+base64, to stay under the project's total
  // env-var size limit for larger pieces; decompressed before parsing.
  if (raw.startsWith('gz:')) {
    raw = gunzipSync(Buffer.from(raw.slice(3), 'base64')).toString('utf8')
  }
  res.setHeader('Cache-Control', 'no-store')
  return res.status(200).json({ article: JSON.parse(raw) })
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  // Editor images, stored in Postgres by the admin upload. Public and
  // immutable: the id is random and never reused.
  if (req.query.image) {
    const id = String(req.query.image)
    if (!/^[a-f0-9]{24}\.(jpg|png|gif|webp)$/.test(id)) return res.status(400).json({ error: 'Bad image' })
    const sql = getSql()
    if (!sql) return res.status(503).json({ error: 'Not configured' })
    const table = req.query.test === '1' ? 'stoa_test_images' : 'stoa_images'
    let row
    try { row = (await sql`select type, data from ${T(sql, table)} where id = ${id} limit 1`)[0] } catch { row = null }
    if (!row) return res.status(404).json({ error: 'Not found' })
    res.setHeader('Content-Type', row.type)
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    return res.status(200).send(Buffer.from(row.data, 'base64'))
  }

  const wantsAccess = req.query.access === '1'
  const wantsIndex = req.query.index === '1'
  const piece = (req.query.piece || '').toString().slice(0, 100)
  let cfg = PIECES[piece] || null

  if (!wantsAccess && !wantsIndex && !cfg && !/^[a-z0-9-]{1,100}$/.test(piece)) {
    return res.status(400).json({ error: 'Missing piece' })
  }

  const sql = getSql()
  if (!sql) {
    console.error('[stoa] DATABASE_URL not configured')
    return res.status(503).json({ error: 'The reader is not configured yet' })
  }

  try {
    await ensureSchema(sql)
    const reviewMode = process.env.STOA_ACCOUNT_REVIEW === '1'
    const prefix = reviewMode ? 'stoa_test_' : 'stoa_'
    await ensureContentSchema(sql, prefix)
    const removed = new Set((await sql`select slug from ${T(sql, prefix + 'removed_pieces')}`).map(r => r.slug))
    if (!wantsAccess && !wantsIndex && removed.has(piece)) return res.status(404).json({ error: 'This piece is no longer available.' })
    const modes = await pieceModes(sql, prefix)
    const modeOf = (slug) => modes[slug] || defaultMode(PIECES[slug])
    // Dynamic pieces written through the admin editor or the manual import.
    const dbRows = (await sql`select slug, number, title, dek, market, author, entity, date_label, read_time, source from ${T(sql, prefix + 'piece_content')}`).filter(r => !removed.has(r.slug))
    const dbBySlug = Object.fromEntries(dbRows.map((r) => [r.slug, r]))

    // Public research index: metadata and modes only, never content.
    if (wantsIndex) {
      const code = Object.entries(PIECES).filter(([slug]) => !removed.has(slug)).map(([slug, c]) => ({
        slug, title: c.title, ...(CODE_PIECE_META[slug] || {}), mode: modeOf(slug), source: 'code',
      }))
      const db = dbRows.map((r) => ({
        slug: r.slug, title: r.title, dek: r.dek, market: r.market, author: r.author,
        date: r.date_label, readTime: r.read_time, number: r.number, mode: modeOf(r.slug), source: r.source,
      }))
      const all = [...code, ...db].sort((a, b) => (b.number || 0) - (a.number || 0))
      return res.status(200).json({ pieces: all })
    }

    // A slug outside the static registry must exist as DB content.
    let dbContent = null
    if (!cfg && !wantsAccess) {
      dbContent = (await sql`select memo from ${T(sql, prefix + 'piece_content')} where slug = ${piece}`)[0] || null
      if (!dbContent) return res.status(400).json({ error: 'Missing piece' })
    }
    const sendPiece = () => {
      if (dbContent) {
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json({ article: dbContent.memo })
      }
      return send(res, cfg, piece)
    }
    // Every known slug: static registry plus DB content.
    const allPieces = [
      ...Object.entries(PIECES).filter(([slug]) => !removed.has(slug)).map(([slug, c]) => ({ slug, title: c.title })),
      ...dbRows.map((r) => ({ slug: r.slug, title: r.title })),
    ]

    // Open pieces are already published openly (e.g. on Stoa's Substack).
    if (!wantsAccess && modeOf(piece) === 'open') return sendPiece()

    // Preview deployments only: slugs in STOA_PREVIEW_OPEN (comma-separated)
    // are served without a token so not-yet-approved pieces can be reviewed
    // on a protected preview. Never set for production, where this is inert.
    const previewOpen = (process.env.STOA_PREVIEW_OPEN || '').split(',').map((s) => s.trim())
    if (!wantsAccess && process.env.VERCEL_ENV === 'preview' && previewOpen.includes(piece)) return sendPiece()

    const review = process.env.STOA_ACCOUNT_REVIEW === '1'
    const bridge = !review && process.env.STOA_PRODUCTION_READER_BRIDGE === '1'
    if (!review && !bridge) return res.status(503).json({ error: 'Reader access is not enabled' })
    const token = (req.headers['x-stoa-legacy-token'] || req.query.t || '').toString().slice(0, 201)
    if (bridge && token && req.query.identity !== '1') {
      // Resolve the link's approved reader once, for opens recording below.
      const linkReader = await legacyReaderByToken(sql, { token, test: review }).catch(() => null)
      const opens = []
      for (const p of allPieces) {
        if (modeOf(p.slug) !== 'open' && await legacyAccess(sql, { token, slug: p.slug, title: p.title, mode: modeOf(p.slug) })) opens.push(p.slug)
      }
      if (wantsAccess) return res.status(200).json({ pieces: opens })
      if (opens.includes(piece)) {
        // Opens: the same record as a signed-in open, for an approved reader
        // using their reading link. The reader is identified by the link
        // itself; unknown, expired or revoked links record nothing, and no
        // IP, device or other visitor data is stored.
        if (linkReader) await sql`insert into ${T(sql, prefix + 'reading_events')} (email, piece) values (${linkReader.email}, ${piece})`.catch(() => {})
        return sendPiece()
      }
      // An invalid or expired legacy token does not invalidate a verified
      // session. No identity or reader rows are created from a bearer link.
    }
    const session = await getAuth().api.getSession({ headers: new Headers(req.headers) }).catch(() => null)
    if (!session?.user?.email || session.user.emailVerified !== true) return res.status(401).json({ error: 'sign_in_required' })
    const reader = await readerByEmail(sql, session.user.email, review ? 'stoa_test_readers' : 'stoa_readers')
    const member = active(reader)
    let grants = new Set(), exclusions = new Set()
    if (bridge && member) {
      grants = new Set((await sql`select piece from stoa_grants where email=${reader.email}`).map(r => r.piece))
      exclusions = new Set((await sql`select piece from stoa_exclusions where email=${reader.email}`).map(r => r.piece))
    }
    const allowed = slug => member && (bridge ? legacyReaderAllows(reader, slug, modeOf(slug), grants, exclusions) : readerCanRead(reader, slug, modeOf(slug)))
    if (wantsAccess) return res.status(200).json({ readerApproved: !!member, pieces: allPieces.map(p => p.slug).filter(slug => modeOf(slug) !== 'open' && allowed(slug)) })
    if (!allowed(piece)) return res.status(403).json({ error: 'no_access' })
    // Opens: record that this approved reader opened this locked piece and
    // when, whether signed in or using their reading link (recorded above).
    // This measures opens, never reading time or attention. The insert must
    // never break reading, so failures are swallowed.
    await sql`insert into ${T(sql, prefix + 'reading_events')} (email, piece) values (${reader.email}, ${piece})`.catch(() => {})
    return sendPiece()
  } catch (err) {
    console.error('[stoa] article lookup failed:', err)
    return res.status(502).json({ error: 'The reader is temporarily unavailable' })
  }
}
