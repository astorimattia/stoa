import {readImportLink} from './_link-import.js'
// Read-only admin dashboard data for stoacap.com/admin. Returns the inbox
// of access requests (with the piece each came from), the readers (status,
// role, expiry and library scope) and every registered piece with its live
// mode. It can only read - approvals, scope changes and piece-mode changes
// stay in admin.js - and it never returns tokens, article content or
// secrets. Same auth model as admin.js: the STOA_ADMIN_SECRET bearer (or
// the demo password on the preview), compared constant-time, with
// failed-auth throttling and audit.

import { readAdminSession } from './_admin-session.js'
import { createHash, timingSafeEqual } from 'node:crypto'
import { ensureTestSchema } from './_test-schema.js'
import { getSql, ensureSchema, T } from './_stoa-db.js'
import { PIECES, defaultMode, DEFAULT_LINK_DAYS, MAX_LINK_DAYS } from './_stoa-pieces.js'
import { lookupRequesterIdentity } from './_stoa-lookup.js'
import { ensureContentSchema, substackArchive, CODE_PIECE_META } from './_stoa-content.js'
import { newIssue } from './_stoa-emails.js'
import { tokenFor } from './publications.js'

const FAIL_WINDOW_MIN = 10
const MAX_FAILS = 10
const LOCK_MIN = 15

const hash = (s) => createHash('sha256').update(s).digest('hex')

function secretOk(req) {
  const header = req.headers.authorization || ''
  const presented = header.startsWith('Bearer ') ? header.slice(7) : ''
  if (!presented) return false
  const secret = process.env.STOA_ADMIN_SECRET
  if (secret && timingSafeEqual(Buffer.from(hash(presented)), Buffer.from(hash(secret)))) return true
  return false
}

const clientIp = (req) =>
  ((req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown').trim().slice(0, 64)


export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getSql()
  if (!sql) {
    return res.status(503).json({ error: 'Not configured' })
  }
  const ip = clientIp(req)

  try {
    await ensureSchema(sql)

    const lock = await sql`select locked_until from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
    if (lock[0] && lock[0].locked_until && new Date(lock[0].locked_until) > new Date()) {
      return res.status(429).json({ error: 'Too many failed attempts' })
    }

    if (!secretOk(req) && !(await readAdminSession(sql, req))) {
      const prev = await sql`select fails, first_fail_at from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
      const r = prev[0]
      const stale =
        !r || !r.first_fail_at || new Date(r.first_fail_at) < new Date(Date.now() - FAIL_WINDOW_MIN * 60000)
      const fails = stale ? 1 : r.fails + 1
      const lockedUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null
      await sql`
        insert into ${T(sql, 'stoa_admin_throttle')} (ip, fails, first_fail_at, locked_until)
        values (${ip}, ${fails}, now(), ${lockedUntil})
        on conflict (ip) do update set fails = ${fails}, first_fail_at = now(), locked_until = ${lockedUntil}
      `
      await sql`insert into ${T(sql, 'stoa_admin_audit')} (ip, action, target, ok) values (${ip}, 'dashboard', null, false)`.catch(() => {})
      return res.status(401).json({ error: 'Unauthorized' })
    }

    // Admin-initiated "who might this requester be" hint: fetches only the
    // requester email domain's public homepage (title/description). Free and
    // credential-less, runs only on demand, stores nothing. Uncertain by
    // nature - it suggests a company, never the person.
    if (req.query.lookup !== undefined) {
      const r = await lookupRequesterIdentity(req.query.lookup)
      return res.status(r.status || 200).json(r.error ? { error: r.error } : r)
    }

    const review = process.env.STOA_ACCOUNT_REVIEW === '1'
    if (!review && process.env.STOA_ACCOUNT_LIVE !== '1') return res.status(409).json({error:'Account dashboard is not enabled'})
    if (review) await ensureTestSchema(sql)

    const pfx = review ? 'stoa_test_' : 'stoa_'
    await ensureContentSchema(sql, pfx)

    if(req.query['link-preview'] !== undefined){
      try{return res.status(200).json(await readImportLink(req.query['link-preview']))}catch(e){return res.status(400).json({error:e.message||'This source could not be read.'})}
    }

    // Manual Substack import: list the publication's latest posts, flagging
    // anything already on Stoa (by slug or same title). Read-only.
    if (req.query.substack !== undefined) {
      let host = String(req.query.host || '').toLowerCase().slice(0, 500)
      try { host = new URL(host.includes('://') ? host : 'https://' + host).hostname } catch { /* keep as typed */ }
      if (!host) return res.status(400).json({ error: 'A Substack address is required' })
      const posts = await substackArchive(host)
      if (!posts) return res.status(200).json({ posts: null, note: 'No publication answered at that address. Check it and try again.' })
      const existingRows = await sql`select slug, title from ${T(sql, pfx + 'piece_content')}`
      const existingSlugs = new Set([...Object.keys(PIECES), ...existingRows.map((r) => r.slug)])
      const existingTitles = new Set([...Object.values(PIECES).map((c) => c.title.toLowerCase()), ...existingRows.map((r) => r.title.toLowerCase())])
      return res.status(200).json({
        posts: posts.map((p) => ({ ...p, imported: existingSlugs.has(p.slug) || existingTitles.has(p.title.toLowerCase()) })),
      })
    }

    // Announcement review: the exact recipients and the exact message that
    // queueing would use. Nothing is queued or sent here.
    if (req.query['announce-preview'] !== undefined) {
      const slug = String(req.query['announce-preview'] || '')
      if ((await sql`select slug from ${T(sql, pfx + 'removed_pieces')} where slug = ${slug} limit 1`).length) return res.status(404).json({ error: 'This piece is no longer available.' })
      const known = PIECES[slug] || (await sql`select title, dek from ${T(sql, pfx + 'piece_content')} where slug = ${slug} limit 1`)[0]
      if (!known) return res.status(400).json({ error: 'Unknown piece' })
      await sql`create table if not exists ${T(sql, pfx + 'subscriptions')}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`
      // The announcement audience is exactly the approved readers who have
      // not stopped new-piece emails, matching what announce-piece would
      // queue. Revoked or expired readers are never in this list.
      const recipients = (await sql`select s.email from ${T(sql, pfx + 'subscriptions')} s join ${T(sql, pfx + 'readers')} r on r.email = s.email where s.unsubscribed_at is null and r.status = 'approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at > now()) order by s.email`).map((r) => r.email)
      let readerCount = 0
      try {
        const rows = await sql`select count(*)::int as c from ${T(sql, pfx + 'readers')} where status='approved' and revoked_at is null and (expires_at is null or expires_at>now())`
        readerCount = Number((rows[0] || {}).c || 0)
      } catch {
        readerCount = 0
      }
      const dek = (CODE_PIECE_META[slug] && CODE_PIECE_META[slug].dek) || known.dek || ''
      const sample = recipients[0] || 'reader@example.com'
      const tpl = newIssue(known.title, dek, 'https://www.stoacap.com/research/' + slug, 'https://www.stoacap.com/unsubscribe#' + tokenFor(sample))
      // The reviewed snapshot: queueing is rejected if the audience, subject
      // or either outgoing body no longer matches what this preview showed.
      const reviewHash = createHash('sha256').update(JSON.stringify([slug, recipients, tpl.subject, tpl.text, tpl.html])).digest('hex')
      return res.status(200).json({
        recipients,
        readerCount,
        subject: tpl.subject,
        text: tpl.text,
        html: tpl.html,
        review: reviewHash,
        sending: !review && process.env.STOA_ANNOUNCEMENTS_SEND === '1' ? 'enabled' : 'disabled',
      })
    }

    // Read-only mail pipeline state: counts only, never recipients or
    // (encrypted) payloads. Lets Mattia verify nothing is queued or sent.
    if (req.query.mailstate !== undefined) {
      const prefix = review ? 'stoa_test_' : 'stoa_'
      const exists = async (name) => (await sql`select to_regclass(${name}) as r`)[0]?.r != null
      const out = { scope: review ? 'test' : 'live' }
      if (await exists(prefix + 'mail_outbox')) {
        out.outbox = await sql`select state, kind, count(*)::int as n from ${T(sql, prefix + 'mail_outbox')} group by state, kind order by state, kind`
        out.outbox_total = (await sql`select count(*)::int as n, max(created_at) as latest from ${T(sql, prefix + 'mail_outbox')}`)[0]
      } else out.outbox = 'table not created'
      if (await exists(prefix + 'mail_suppressions')) {
        out.suppressions = (await sql`select count(*)::int as n from ${T(sql, prefix + 'mail_suppressions')}`)[0].n
      } else out.suppressions = 'table not created'
      if (await exists(prefix + 'mail_events')) {
        out.provider_events = (await sql`select count(*)::int as n from ${T(sql, prefix + 'mail_events')}`)[0].n
      } else out.provider_events = 'table not created'
      return res.status(200).json(out)
    }
    const table = name => (review?'stoa_test_':'stoa_')+name
    const requests = await sql`
      select id, email, role, piece, status, note, source, team_note, created_at, approved_at, expires_at, revoked_at
      from ${T(sql, table('requests'))}
      order by created_at desc
      limit 500
    `
    const readerRows = await sql`
      select email, role, status, access_mode, approved_at, expires_at, revoked_at, created_at
      from ${T(sql, table('readers'))}
      order by created_at desc
      limit 500
    `
    const grantRows = await sql`select email, piece from ${T(sql, table('grants'))}`
    const exclusionRows = await sql`select email, piece from ${T(sql, table('exclusions'))}`
    const pieceRows = await sql`select slug, title, mode from ${T(sql, pfx + 'pieces')}`

    const grantsBy = {}
    for (const g of grantRows) (grantsBy[g.email] ||= []).push(g.piece)
    const exclusionsBy = {}
    for (const x of exclusionRows) (exclusionsBy[x.email] ||= []).push(x.piece)

    const openedRows = await sql`select email, max(opened_at) as last_opened_at, count(*)::int as opened from ${T(sql, table('reading_events'))} group by email`
    const opens = Object.fromEntries(openedRows.map(r => [r.email, r]))
    const pieceOpenRows = await sql`select piece, count(*)::int as opens, count(distinct email)::int as readers, max(opened_at) as last_opened_at from ${T(sql, table('reading_events'))} group by piece`
    const pieceOpens = Object.fromEntries(pieceOpenRows.map(r => [r.piece, r]))
    const now = new Date()
    const readers = readerRows.map((r) => ({
      ...r,
      opened: opens[r.email]?.opened || 0,
      last_opened_at: opens[r.email]?.last_opened_at || null,
      active: r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > now),
      grants: grantsBy[r.email] || [],
      exclusions: exclusionsBy[r.email] || [],
    }))
    const byStatus = await sql`
      select status, count(*)::int as count from ${T(sql, table('requests'))} group by status
    `
    const byPiece = await sql`
      select piece, count(*)::int as count from ${T(sql, table('requests'))} group by piece order by count desc
    `
    const totals = {
      requests: requests.length,
      pending: requests.filter((r) => r.status === 'pending').length,
      readers: readers.length,
      activeReaders: readers.filter((r) => r.active).length,
      byStatus: Object.fromEntries(byStatus.map((r) => [r.status, r.count])),
      byPiece: byPiece.map((r) => ({ piece: r.piece || 'Library access', count: r.count })),
    }

    await sql`insert into ${T(sql, 'stoa_admin_audit')} (ip, action, target, ok) values (${ip}, 'dashboard', null, true)`.catch(() => {})

    // Every registered piece, in registry order, with its live mode.
    const removed = new Set((await sql`select slug from ${T(sql, pfx + 'removed_pieces')}`).map(r => r.slug))
    const liveModes = Object.fromEntries(pieceRows.map((r) => [r.slug, r.mode]))
    const pieces = Object.entries(PIECES).filter(([slug]) => !removed.has(slug)).map(([slug, c]) => ({
      slug,
      title: c.title,
      mode: liveModes[slug] || defaultMode(c),
    }))
    const contentRows = await sql`select slug, number, title, dek, market, author, date_label, read_time, source, created_at from ${T(sql, pfx + 'piece_content')} order by number desc`
    const requestCounts = {}
    for (const r of requests) if (r.piece) requestCounts[r.piece] = (requestCounts[r.piece] || 0) + 1
    const piecesFull = [
      ...Object.entries(PIECES).filter(([slug]) => !removed.has(slug)).map(([slug, c]) => ({
        slug, title: (CODE_PIECE_META[slug] || {}).title || c.title, mode: (pieces.find((x) => x.slug === slug) || {}).mode || defaultMode(c),
        number: (CODE_PIECE_META[slug] || {}).number || 0, market: (CODE_PIECE_META[slug] || {}).market || '',
        source: 'code', requestsFromLock: requestCounts[(CODE_PIECE_META[slug] || {}).title || c.title] || requestCounts[c.title] || 0,
        opens: pieceOpens[slug] || null,
      })),
      ...contentRows.filter(r => !removed.has(r.slug)).map((r) => ({
        slug: r.slug, title: r.title, mode: liveModes[r.slug] || 'readers',
        number: r.number, market: r.market, source: r.source, requestsFromLock: requestCounts[r.title] || 0,
        opens: pieceOpens[r.slug] || null,
      })),
    ].sort((a, b) => (b.number || 0) - (a.number || 0))
    const drafts = await sql`select id, title, summary, market, body, updated_at from ${T(sql, pfx + 'piece_drafts')} order by updated_at desc limit 50`
    const body = {
      capabilities:{review,mailCapture:review,transactionalMail:!review&&process.env.STOA_TRANSACTIONAL_SEND==='1',announcements:review,manualLinks:!review&&process.env.STOA_TRANSACTIONAL_SEND!=='1'},
      totals,
      requests,
      readers,
      pieces,
      piecesFull,
      drafts,
      linkDays: { default: DEFAULT_LINK_DAYS, max: MAX_LINK_DAYS },
    }
    return res.status(200).json(body)
  } catch (err) {
    console.error('[stoa] dashboard failed:', err)
    return res.status(502).json({ error: 'Temporarily unavailable' })
  }
}
