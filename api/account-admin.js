import {readImportLink} from './_link-import.js'
import {createCustomReview,verifyCustomReview} from './_custom-mail-review.js'
import {canonicalRequestAllowed} from './_canonical-request.js'
// LOCAL PREPARATION: account-wide reader administration. No bearer article
// links. Mutation tests require the test secret and test-only identities.
import { accountAdmin } from './_account-admin.js'
import { deliverTemplate } from './_mail-delivery.js'
import { readAdminSession, createAdminSession, revokeAdminSession, clearAdminSession, hasAdminSessionCookie, sameOriginAdminRequest } from './_admin-session.js'
import { createHash, timingSafeEqual, randomBytes } from 'node:crypto'
import { approved, declined, customEmail } from './_stoa-emails.js'
import { getSql, ensureSchema, T } from './_stoa-db.js'
import { ensureTestSchema } from './_test-schema.js'
import { getWelcomeAuth } from './_auth.js'
import { ensureContentSchema, slugify, readTime, textToMemo, htmlToMemo, memoToText, mergeMemoImages, substackArchive, substackPost, newDraftId, CODE_PIECE_META } from './_stoa-content.js'
import { PIECES, PIECE_MODES } from './_stoa-pieces.js'
import { createOutbox, createResendTransport } from './_mail-outbox.js'
import { newIssue, BRAND_FROM } from './_stoa-emails.js'
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

async function isLocked(sql, ip) {
  const rows = await sql`select locked_until from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
  const r = rows[0]
  return r && r.locked_until && new Date(r.locked_until) > new Date()
}

async function recordFailure(sql, ip) {
  const rows = await sql`select fails, first_fail_at from ${T(sql, 'stoa_admin_throttle')} where ip = ${ip} limit 1`
  const r = rows[0]
  const stale =
    !r || !r.first_fail_at || new Date(r.first_fail_at) < new Date(Date.now() - FAIL_WINDOW_MIN * 60000)
  const fails = stale ? 1 : r.fails + 1
  const lockedUntil = fails >= MAX_FAILS ? new Date(Date.now() + LOCK_MIN * 60000) : null
  await sql`
    insert into ${T(sql, 'stoa_admin_throttle')} (ip, fails, first_fail_at, locked_until)
    values (${ip}, ${fails}, now(), ${lockedUntil})
    on conflict (ip) do update set fails = ${fails}, first_fail_at = now(), locked_until = ${lockedUntil}
  `
}


const ACTIONS = ['approve', 'decline', 'reopen', 'note', 'revoke', 'expire', 'status', 'purge', 'resend-welcome',
  'preview-custom-email', 'send-custom-email', 'setpiece', 'save-draft', 'delete-draft', 'delete-piece', 'publish-piece', 'load-piece', 'update-piece', 'import-substack', 'import-link', 'repair-piece-media', 'announce-piece', 'subscribe-test', 'upload-image', 'admin-session-start', 'admin-session-stop']

const isActive = (r) =>
  r && r.status === 'approved' && !r.revoked_at && (!r.expires_at || new Date(r.expires_at) > new Date())

async function sendTemplate(sql, test, email, tpl) {
  if (test) {
    await sql`insert into ${T(sql, 'stoa_test_mail')} (to_addr, subject, body) values (${email}, ${tpl.subject}, ${tpl.text})`
    return true
  }
  return (await deliverTemplate({sql,to:email,template:tpl})).accepted
}

export default async function handler(req, res) {
  if(!canonicalRequestAllowed(req))return res.status(403).json({error:'Use the canonical Stoa website'})
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const sql = getSql()
  if (!sql) {
    return res.status(503).json({ error: 'Not configured' })
  }
  const ip = clientIp(req)

  // Preview test mode: the STOA_RECOVERY_TEST secret as Bearer authorizes
  // the same actions against the isolated test tables, with mail captured
  // instead of sent. Inert when the env var is unset (production).
  const testSecret = process.env.STOA_RECOVERY_TEST || ''
  const presented = (req.headers.authorization || '').startsWith('Bearer ')
    ? req.headers.authorization.slice(7)
    : ''
  const review = process.env.STOA_ACCOUNT_REVIEW === '1'
  let test = !!(testSecret && presented === testSecret) ||
    (review && secretOk(req))
  let TB = test
    ? { readers: 'stoa_test_readers', requests: 'stoa_test_requests', grants: 'stoa_test_grants',
        exclusions: 'stoa_test_exclusions', audit: 'stoa_test_audit' }
    : { readers: 'stoa_readers', requests: 'stoa_requests', grants: 'stoa_grants',
        exclusions: 'stoa_exclusions', audit: 'stoa_admin_audit' }
  const audit = (ipAddr, action, target, ok) =>
    sql`insert into ${T(sql, TB.audit)} (ip, action, target, ok) values (${ipAddr}, ${action}, ${target}, ${ok})`.catch(
      () => {}
    )

  try {
    await ensureSchema(sql)
    if (test) await ensureTestSchema(sql)

    let body = req.body || {}
    if (typeof body === 'string') {
      try { body = JSON.parse(body) } catch { body = {} }
    }
    const action = (body.action || '').toString()
    if ((action === 'admin-session-start' || action === 'admin-session-stop') && !sameOriginAdminRequest(req)) return res.status(403).json({ error: 'Invalid origin' })
    const secret = process.env.STOA_ADMIN_SECRET || ''
    const bodySecretOk = !!(secret && typeof body.secret === 'string' && timingSafeEqual(Buffer.from(hash(body.secret)), Buffer.from(hash(secret))))
    if (action === 'admin-session-start') {
      if (await isLocked(sql, ip)) return res.status(429).json({ error: 'Too many failed attempts' })
      if (!bodySecretOk) { await recordFailure(sql, ip); await audit(ip, 'auth', null, false); return res.status(401).json({ error: 'Unauthorized' }) }
      const cookie = await createAdminSession(sql, ip); if (!cookie) return res.status(503).json({ error: 'Admin sign-in is not configured' })
      res.setHeader('Set-Cookie', cookie); await audit(ip, action, null, true); return res.status(200).json({ session: true })
    }
    if (action === 'admin-session-stop') {
      await revokeAdminSession(sql, req); res.setHeader('Set-Cookie', clearAdminSession()); await audit(ip, action, null, true); return res.status(200).json({ stopped: true })
    }

    if (!test) {
      if (await isLocked(sql, ip)) {
        return res.status(429).json({ error: 'Too many failed attempts' })
      }
      const bearerOk = secretOk(req)
      if (!bearerOk && hasAdminSessionCookie(req) && !sameOriginAdminRequest(req)) return res.status(403).json({ error: 'Invalid origin' })
      const sessionOk = !bearerOk && (await readAdminSession(sql, req))
      // Server-backed admin sessions stay inside the preview's isolated
      // tables too; without this they would fall through to live-gated actions.
      if (review && (bearerOk || sessionOk)) {
        test = true
        TB = { readers: 'stoa_test_readers', requests: 'stoa_test_requests', grants: 'stoa_test_grants',
          exclusions: 'stoa_test_exclusions', audit: 'stoa_test_audit' }
        await ensureTestSchema(sql)
      }
      if (!test && !bearerOk && !sessionOk) {
        await recordFailure(sql, ip)
        await audit(ip, 'auth', null, false)
        return res.status(401).json({ error: 'Unauthorized' })
      }
    }

    // All mutations in this preparation build are test-only. No real
    // reader/request rows or email deliveries can be changed.
    if (!test && process.env.STOA_ACCOUNT_LIVE !== '1') return res.status(409).json({ error: 'Account changes are not enabled' })
    const email = (body.email || '').toString().trim().toLowerCase().slice(0, 200)

    if (!ACTIONS.includes(action)) {
      await audit(ip, action || 'invalid', null, false)
      return res.status(400).json({ error: 'Unknown action' })
    }

    // Piece/content actions carry no reader email and never touch reader,
    // request or grant rows. In review mode they write only test tables.
    if (action.startsWith('setpiece') || action.endsWith('-draft') || action === 'delete-piece' || action === 'publish-piece' || action === 'load-piece' || action === 'update-piece' || action === 'import-substack' || action === 'import-link' || action === 'repair-piece-media' || action === 'announce-piece' || action === 'subscribe-test' || action === 'upload-image') {
      const pfx = test ? 'stoa_test_' : 'stoa_'
      await ensureContentSchema(sql, pfx)
      const PT = { pieces: pfx + 'pieces', content: pfx + 'piece_content', drafts: pfx + 'piece_drafts', subscriptions: pfx + 'subscriptions' }
      await sql`create table if not exists ${T(sql, PT.subscriptions)}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`

      // Review-mode fixture only: subscribe or unsubscribe a synthetic test
      // identity so the announcement audience rules can be exercised without
      // real mail. Never available outside the isolated test tables.
      if (action === 'subscribe-test') {
        if (!test) { await audit(ip, action, null, false); return res.status(403).json({ error: 'Test identities only' }) }
        const target = String(body.email || '').trim().toLowerCase()
        if (!/^[^\s@]+@stoa-test\.invalid$/.test(target)) { await audit(ip, action, null, false); return res.status(400).json({ error: 'Use a test identity' }) }
        if (body.stop) await sql`update ${T(sql, PT.subscriptions)} set unsubscribed_at = now() where email = ${target}`
        else await sql`insert into ${T(sql, PT.subscriptions)}(email, unsubscribed_at) values (${target}, null) on conflict (email) do update set unsubscribed_at = null`
        await audit(ip, action, target, true)
        return res.status(200).json({ subscribed: !body.stop })
      }

      // Editor image upload: the browser has already resized the image.
      // It goes to the site's Vercel Blob store under a random name, and
      // the piece stores only the returned https URL.
      if (action === 'upload-image') {
        const types = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/gif': 'gif', 'image/webp': 'webp' }
        const type = String(body.type || '')
        const data = typeof body.data === 'string' ? body.data : ''
        if (!types[type] || !data) { await audit(ip, action, null, false); return res.status(400).json({ error: 'Use a JPEG, PNG, GIF or WebP image' }) }
        const bytes = Buffer.from(data, 'base64')
        if (!bytes.length || bytes.length > 3_000_000) { await audit(ip, action, null, false); return res.status(413).json({ error: 'This image is too large (3 MB at most)' }) }
        if (!process.env.BLOB_READ_WRITE_TOKEN) return res.status(503).json({ error: 'Image storage is not connected to this deployment' })
        try {
          const { put } = await import('@vercel/blob')
          const name = (test ? 'test/' : '') + 'pieces/' + new Date().toISOString().slice(0, 7) + '/' + randomBytes(12).toString('hex') + '.' + types[type]
          const blob = await put(name, bytes, { access: 'public', contentType: type, cacheControlMaxAge: 31536000, addRandomSuffix: false })
          await audit(ip, action, null, true)
          return res.status(200).json({ url: blob.url })
        } catch (e) {
          await audit(ip, action, null, false)
          return res.status(502).json({ error: 'The image could not be stored. Check that the Blob store is public.' })
        }
      }

      if (action === 'setpiece') {
        const slug = String(body.slug || '')
        const mode = String(body.mode || '')
        const known = PIECES[slug] || (await sql`select slug from ${T(sql, PT.pieces)} where slug = ${slug} limit 1`)[0]
        if (!known || !PIECE_MODES.includes(mode)) {
          await audit(ip, action, slug || null, false)
          return res.status(400).json({ error: 'Unknown piece or mode' })
        }
        if (test) {
          await sql`insert into ${T(sql, PT.pieces)} (slug, title, mode) values (${slug}, ${String(known.title || slug)}, ${mode}) on conflict (slug) do update set mode = ${mode}`
        } else {
          await sql`update ${T(sql, 'stoa_pieces')} set mode = ${mode} where slug = ${slug}`
        }
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, mode })
      }

      if (action === 'save-draft') {
        const id = String(body.id || '').slice(0, 40) || newDraftId()
        const title = String(body.title || '').slice(0, 200)
        const summary = String(body.summary || '').slice(0, 1000)
        const market = String(body.market || '').slice(0, 80)
        const text = String(body.body || '').slice(0, 200000)
        await sql`insert into ${T(sql, PT.drafts)} (id, title, summary, market, body) values (${id}, ${title}, ${summary}, ${market}, ${text})
          on conflict (id) do update set title = ${title}, summary = ${summary}, market = ${market}, body = ${text}, updated_at = now()`
        await audit(ip, action, id, true)
        return res.status(200).json({ id })
      }

      if (action === 'delete-draft') {
        const id = String(body.id || '').slice(0, 40)
        await sql`delete from ${T(sql, PT.drafts)} where id = ${id}`
        await audit(ip, action, id, true)
        return res.status(200).json({ deleted: true })
      }

      if (action === 'delete-piece') {
        const slug = String(body.slug || '').slice(0, 100)
        const known = PIECES[slug] || (await sql`select slug, title from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
        if (!known) return res.status(404).json({ error: 'Unknown piece' })
        const title = CODE_PIECE_META[slug]?.title || known.title
        if (body.confirmTitle !== title) return res.status(409).json({ error: 'Review the piece title before removing it.' })
        await sql`insert into ${T(sql, pfx + 'removed_pieces')} (slug) values (${slug}) on conflict (slug) do nothing`
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, removed: true, retained: 'content-and-analytics' })
      }

      if (action === 'publish-piece') {
        const title = String(body.title || '').trim().slice(0, 200)
        const summary = String(body.summary || '').trim().slice(0, 1000)
        const market = String(body.market || '').trim().slice(0, 80)
        const text = String(body.body || '').trim().slice(0, 200000)
        const mode = PIECE_MODES.includes(body.mode) ? body.mode : 'readers'
        const author = String(body.author || '').trim().slice(0, 80) || 'MATTIA ASTORI'
        if (!title || !text) return res.status(400).json({ error: 'A title and body are required' })
        let base = slugify(title)
        if (!base) return res.status(400).json({ error: 'A title is required' })
        let slug = base
        for (let i = 2; PIECES[slug] || (await sql`select 1 from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]; i++) slug = base + '-' + i
        const maxCode = Math.max(...Object.values(CODE_PIECE_META).map((m) => m.number || 0))
        const maxDb = (await sql`select coalesce(max(number), 0) as m from ${T(sql, PT.content)}`)[0].m
        const number = Math.max(maxCode, maxDb) + 1
        const dateLabel = new Date().toLocaleDateString('en-US', { month: 'short', year: 'numeric', timeZone: 'America/New_York' })
        const memo = textToMemo({ slug, title, author, date: dateLabel.toUpperCase(), subtitle: summary, body: text })
        await sql`insert into ${T(sql, PT.pieces)} (slug, title, mode) values (${slug}, ${title}, ${mode}) on conflict (slug) do update set mode = ${mode}`
        await sql`insert into ${T(sql, PT.content)} (slug, number, title, dek, market, author, date_label, read_time, memo, source)
          values (${slug}, ${number}, ${title}, ${summary}, ${market}, ${author}, ${dateLabel}, ${readTime(text)}, ${JSON.stringify(memo)}, 'editor')`
        if (body.draftId) await sql`delete from ${T(sql, PT.drafts)} where id = ${String(body.draftId).slice(0, 40)}`
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, number })
      }

      // Published pieces stored in the database can be reopened and edited.
      // Slug, number, date, access mode and analytics are kept as they are.
      if (action === 'load-piece') {
        const slug = String(body.slug || '').slice(0, 100)
        const row = (await sql`select slug, title, dek, market, memo from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
        if (!row) return res.status(404).json({ error: 'This piece cannot be edited here.' })
        const memo = typeof row.memo === 'string' ? JSON.parse(row.memo) : row.memo
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, title: row.title, summary: row.dek || '', market: row.market || '', body: memoToText(memo || {}), memo: memo || null })
      }

      if (action === 'update-piece') {
        const slug = String(body.slug || '').slice(0, 100)
        const title = String(body.title || '').trim().slice(0, 200)
        const summary = String(body.summary || '').trim().slice(0, 1000)
        const market = String(body.market || '').trim().slice(0, 80)
        const text = String(body.body || '').trim().slice(0, 200000)
        if (!title || !text) return res.status(400).json({ error: 'A title and body are required' })
        const row = (await sql`select memo from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
        if (!row) return res.status(404).json({ error: 'This piece cannot be edited here.' })
        const old = (typeof row.memo === 'string' ? JSON.parse(row.memo) : row.memo) || {}
        const fresh = textToMemo({ slug, title, author: old.author, entity: old.entity, date: old.date, subtitle: summary, body: text })
        const memo = { ...old, ...fresh }
        if (!summary) delete memo.subtitle
        await sql`update ${T(sql, PT.content)} set title = ${title}, dek = ${summary}, market = ${market}, read_time = ${readTime(text)}, memo = ${JSON.stringify(memo)}, updated_at = now() where slug = ${slug}`
        await sql`update ${T(sql, PT.pieces)} set title = ${title} where slug = ${slug}`
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, updated: true })
      }

      if(action === 'import-link'){
        let preview;try{preview=await readImportLink(body.url)}catch(e){return res.status(400).json({error:e.message||'This source could not be read.'})}
        if(body.review!==preview.review)return res.status(409).json({error:'The source changed. Preview it again before importing.'})
        const id='link-'+preview.review.slice(0,28)
        const saved=await sql`insert into ${T(sql, PT.drafts)} (id,title,summary,market,body,updated_at) values (${id},${preview.title},${''},${''},${preview.body},now()) on conflict(id) do nothing returning id`
        await audit(ip,action,preview.url,true)
        return res.status(200).json({imported:saved.length?[preview.title]:[],skipped:saved.length?[]:[{slug:preview.title,reason:'This source is already saved as a draft.'}],drafts:true})
      }

      if (action === 'import-substack') {
        const host = String(body.host || '').toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].slice(0, 200)
        const list = Array.isArray(body.posts) ? body.posts.slice(0, 10) : []
        if (!host || !list.length) return res.status(400).json({ error: 'A Substack address and posts are required. Use an address like stoaresearch.substack.com.' })
        const imported = []
        const skipped = []
        for (const item of list) {
          const slug = String(item && item.slug || '')
          const exists = PIECES[slug]
            || (await sql`select 1 from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
          if (exists) { skipped.push({ slug, reason: 'Already on Stoa.' }); continue }
          const post = await substackPost(host, slug)
          if (!post) { skipped.push({ slug, reason: 'Could not load it from Substack. Try again.' }); continue }
          const dupDraft = (await sql`select 1 from ${T(sql, PT.drafts)} where title = ${post.title} limit 1`)[0]
          if (dupDraft) { skipped.push({ slug, reason: 'A draft with this title already exists.' }); continue }
          // Import lands as an unpublished draft. Publishing (with its access
          // mode and optional announcement review) is a separate editor action.
          const memo = htmlToMemo({ slug: post.slug, title: post.title, date: '', subtitle: post.subtitle, html: post.html })
          const text = memoToText(memo)
          await sql`insert into ${T(sql, PT.drafts)} (id, title, summary, market, body, updated_at)
            values (${newDraftId()}, ${post.title}, ${post.subtitle || ''}, '', ${text}, now())`
          imported.push(post.slug)
        }
        await audit(ip, action, host, true)
        return res.status(200).json({ imported, skipped, drafts: true })
      }

      if (action === 'repair-piece-media') {
        const slug = String(body.slug || '').slice(0, 100)
        const host = String(body.host || '').toLowerCase().replace(/^https?:\/\//, '').split(/[/?#]/)[0].slice(0, 200)
        const current = (await sql`select title, dek, memo from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
        if (!current || String(body.confirmTitle || '') !== current.title) return res.status(409).json({ error: 'Review the piece title before restoring media.' })
        const posts = await substackArchive(host)
        const postMeta = (posts || []).find((p) => p.title.trim().toLowerCase() === current.title.trim().toLowerCase())
        if (!postMeta) { await audit(ip, action, slug, false); return res.status(404).json({ error: 'No Substack post with this exact title was found.' }) }
        const post = await substackPost(host, postMeta.slug)
        if (!post) { await audit(ip, action, slug, false); return res.status(502).json({ error: 'The source post could not be loaded.' }) }
        const sourceMemo = htmlToMemo({ slug, title: current.title, subtitle: current.dek, html: post.html })
        const merged = mergeMemoImages(current.memo, sourceMemo)
        if (!merged.added && !merged.updated) return res.status(200).json({ slug, added: 0, updated: false, source: postMeta.slug })
        await sql`update ${T(sql, PT.content)} set memo = ${JSON.stringify(merged.memo)}, updated_at = now() where slug = ${slug}`
        await audit(ip, action, slug, true)
        return res.status(200).json({ slug, added: merged.added, updated: merged.updated, source: postMeta.slug })
      }

      if (action === 'announce-piece') {
        const slug = String(body.slug || '')
        if ((await sql`select slug from ${T(sql, pfx + 'removed_pieces')} where slug = ${slug} limit 1`).length) return res.status(404).json({ error: 'This piece is no longer available.' })
        const known = PIECES[slug] || (await sql`select title, dek from ${T(sql, PT.content)} where slug = ${slug} limit 1`)[0]
        if (!known) return res.status(400).json({ error: 'Unknown piece' })
        const title = known.title
        const dek = (CODE_PIECE_META[slug] && CODE_PIECE_META[slug].dek) || known.dek || ''
        const url = 'https://www.stoacap.com/research/' + slug
        // Every approved reader is a new-piece email subscriber unless they
        // stopped these emails. Revoked or expired readers never receive
        // announcements, even with a subscription row still on file.
        const recipients = (await sql`select s.email from ${T(sql, PT.subscriptions)} s join ${T(sql, pfx + 'readers')} r on r.email = s.email where s.unsubscribed_at is null and r.status = 'approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at > now()) order by s.email`).map((r) => r.email)
        if (!recipients.length) return res.status(200).json({ queued: 0, sending: 'disabled', note: 'No subscribed readers to announce to' })
        // The queue request must carry the hash of the exact reviewed
        // audience and message. Anything changed since the review is
        // rejected rather than sent unseen.
        const origin = 'https://www.stoacap.com'
        const reviewed = newIssue(title, dek, url, origin + '/unsubscribe#' + tokenFor(recipients[0]))
        const reviewHash = hash(JSON.stringify([slug, recipients, reviewed.subject, reviewed.text, reviewed.html]))
        if (String(body.review || '') !== reviewHash) {
          await audit(ip, action, slug, false)
          return res.status(409).json({ error: 'The announcement changed since it was reviewed. Review it again.' })
        }
        const outbox = createOutbox({ sql, test, encryptionKey: process.env.STOA_MAIL_ENCRYPTION_KEY || (test ? '0000000000000000000000000000000000000000000000000000000000000000' : '') })
        await outbox.ensure()
        const sendingLive = !test && process.env.STOA_ANNOUNCEMENTS_SEND === '1'
        let queued = 0
        for (const to of recipients) {
          const key = 'piece:' + hash(slug + ':' + to)
          const tpl = newIssue(title, dek, url, origin + '/unsubscribe#' + tokenFor(to))
          // While sending is off the exact message is recorded as held, never
          // queued: no later flag flip or retry can dispatch a stale copy.
          await outbox.enqueue({ key, to, kind: 'announcement', subject: tpl.subject, text: tpl.text, html: tpl.html, ...(sendingLive ? {} : { state: 'held' }) })
          queued++
        }
        // Live transport stays gated on the deliberate announcements flag;
        // without it nothing leaves the outbox.
        if (sendingLive) {
          const transport = createResendTransport({ apiKey: process.env.RESEND_API_KEY, from: BRAND_FROM, replyTo: 'research@stoacap.com', allowlist: recipients, allowLive: true })
          for (const to of recipients) {
            const key = 'piece:' + hash(slug + ':' + to)
            await outbox.dispatch(key, { transport, eligible: async (email) => {
              const u = await sql`select 1 from ${T(sql, 'stoa_subscriptions')} s join ${T(sql, 'stoa_readers')} r on r.email = s.email where s.email = ${email} and s.unsubscribed_at is null and r.status = 'approved' and r.revoked_at is null and (r.expires_at is null or r.expires_at > now()) limit 1`
              return u.length > 0
            } })
          }
          return res.status(200).json({ queued, sending: 'attempted' })
        }
        return res.status(200).json({ queued, sending: 'disabled' })
      }
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      await audit(ip, action, null, false)
      return res.status(400).json({ error: 'A valid email is required' })
    }

    if (test && !email.endsWith('@stoa-test.invalid')) return res.status(400).json({ error: 'Use a test identity' })
    if (!test && action === 'purge') return res.status(403).json({error:'Reader history cannot be deleted'})
    const service = accountAdmin({sql,tables:TB})
    const target = email
    const readerRows = await sql`
      select email, role, status, access_mode, expires_at, revoked_at from ${T(sql, TB.readers)}
      where email = ${email} limit 1
    `
    const reader = readerRows[0] || null

    if (action === 'note') {
      const note = String(body.teamNote || '').trim().slice(0, 2000)
      await sql`update ${T(sql, TB.requests)} set team_note = ${note} where email = ${email}`
      await audit(ip, action, target, true)
      return res.status(200).json({ saved: true })
    }

    // Approve, account-wide: one approval opens the whole locked library.
    // No bearer links are minted - the reader signs in with a fresh
    // one-time link or code that proves email possession every time.
    if (action === 'approve') {

      // Role: keep the reader's, else take it from their latest request.
      const roleRows = await sql`
        select role from ${T(sql, TB.requests)} where email = ${email} and role is not null order by created_at desc limit 1
      `
      const role = (reader && reader.role) || (roleRows[0] && roleRows[0].role) || null

      if(!test){
        const decision=await service.approveManual(email,{role,days:body.days??null,baseURL:process.env.STOA_SITE_URL||'https://www.stoacap.com'})
        if(decision.requiresReactivation)return res.status(409).json({error:'This reader is revoked or expired. Use access settings to restore access explicitly.',requiresReactivation:true})
        await sql`create table if not exists ${T(sql, 'stoa_subscriptions')}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`
        // Every approved reader is a new-piece email subscriber. An explicit
        // unsubscribe already on file always wins over re-approval.
        await sql`insert into ${T(sql, 'stoa_subscriptions')}(email, unsubscribed_at) values (${email}, null) on conflict (email) do nothing`
        let emailed=false,emailError=null
        if(process.env.STOA_TRANSACTIONAL_SEND==='1'){
          try{
            await getWelcomeAuth().api.signInMagicLink({body:{email,callbackURL:'/research',metadata:{expiresAt:null,scopeNeutral:true,personalLine:String(body.personalLine||'').slice(0,1000)}},headers:new Headers({origin:new URL(process.env.BETTER_AUTH_URL).origin})})
            emailed=true
          }catch{emailError='Access saved. The welcome email was not sent. Use Readers, then Send email, to retry.'}
        }
        await audit(ip,action,target,true)
        return res.status(200).json({email,expiresAt:decision.reader.expires_at,approvedRequests:decision.approvedRequests,emailed,emailError,delivery:emailed?'accepted':'not-sent',url:decision.url,created:decision.created})
      }
      const decision = await service.approve(email,{role})
      if(decision.requiresReactivation) return res.status(409).json({error:'This reader is revoked or expired. Approval does not extend or restore existing access.',requiresReactivation:true})
      await sql`create table if not exists ${T(sql, 'stoa_test_subscriptions')}(email text primary key,subscribed_at timestamptz not null default now(),unsubscribed_at timestamptz)`
        // Every approved reader is a new-piece email subscriber. An explicit
        // unsubscribe already on file always wins over re-approval.
        await sql`insert into ${T(sql, 'stoa_test_subscriptions')}(email, unsubscribed_at) values (${email}, null) on conflict (email) do nothing`
      let emailed=false,emailError=null
      if(decision.welcome){
        try{
          await getWelcomeAuth().api.signInMagicLink({
            body:{email,callbackURL:'/research',metadata:{personalLine:String(body.personalLine||'').slice(0,1000)}},
            headers:new Headers({origin:new URL(process.env.BETTER_AUTH_URL).origin})
          });emailed=true
        }catch{emailError='Access saved. Welcome email was not accepted; retry welcome explicitly.'}
      }
      await audit(ip, action, target, true)
      return res.status(200).json({
        email,
        expiresAt: decision.reader.expires_at,
        approvedRequests: decision.approvedRequests,
        emailed,
        emailError,
        delivery: emailed ? (test ? 'captured' : 'accepted') : 'not-sent',
      })
    }

    // Decline: every pending request from this email is marked declined,
    // and the decline email goes out once. A later request from the same
    // email is allowed and lands as a fresh pending row.
    if(action === 'preview-custom-email'){
      if(!isActive(reader))return res.status(409).json({error:'Active reader required'})
      const subject=String(body.subject||'').trim(), text=String(body.text||'').trim()
      if(!subject||subject.length>200||!text||text.length>10000)return res.status(400).json({error:'Use a subject up to 200 characters and a message up to 10,000 characters.'})
      return res.status(200).json(createCustomReview(email,subject,text))
    }
    if(action === 'send-custom-email'){
      if(!test&&process.env.STOA_TRANSACTIONAL_SEND!=='1')return res.status(409).json({error:'Email delivery is not enabled. No email was sent.'})
      if(!isActive(reader))return res.status(409).json({error:'Active reader required. No email was sent.'})
      let reviewed
      try{ reviewed=verifyCustomReview(body.reviewToken,email) }
      catch{return res.status(409).json({error:'Review the current email again before sending. No email was sent.'})}
      try{
        const result=await deliverTemplate({sql,to:email,template:reviewed.template,workflow:'admin-confirmed-custom',reviewToken:body.reviewToken,key:reviewed.key})
        await audit(ip,action,target,result.accepted||result.captured)
        return res.status(200).json({email,emailed:result.accepted||result.captured,delivery:result.captured?'captured':'accepted'})
      }catch{
        await audit(ip,action,target,false)
        return res.status(409).json({error:'Delivery could not be confirmed. Retry this same reviewed email rather than creating a new review.'})
      }
    }
    if(action === 'resend-welcome'){
      if(!test&&process.env.STOA_TRANSACTIONAL_SEND!=='1')return res.status(409).json({error:'Email delivery is not enabled. No email was sent.'})
      if(!isActive(reader))return res.status(409).json({error:'Active reader required'})
      await getWelcomeAuth().api.signInMagicLink({body:{email,callbackURL:'/research',metadata:{expiresAt:reader.expires_at,scopeNeutral:true}},headers:new Headers({origin:new URL(process.env.BETTER_AUTH_URL).origin})})
      await audit(ip,action,target,true)
      return res.status(200).json({email,emailed:true,delivery:test?'captured':'accepted'})
    }
    if (action === 'decline') {
      const declinedRows = await sql`
        update ${T(sql, TB.requests)} set status = 'declined'
        where lower(email) = ${email} and status = 'pending'
        returning id
      `
      if (declinedRows.length === 0) {
        await audit(ip, action, target, false)
        return res.status(404).json({ error: 'No pending request' })
      }
      const tpl = declined(String(body.personalLine || '').slice(0, 1000))
      const emailed = test ? await sendTemplate(sql, test, email, tpl) : false
      await audit(ip, action, target, true)
      return res.status(200).json({ email, declinedRequests: declinedRows.length, emailed })
    }

    // Reopen: move approved/declined requests back to pending (the undo
    // path). It never touches the reader row - revoking access is a
    // separate deliberate action.
    if (action === 'reopen') {
      const reopened = await sql`
        update ${T(sql, TB.requests)} set status = 'pending'
        where lower(email) = ${email} and status in ('approved', 'declined')
        returning id
      `
      await audit(ip, action, target, true)
      return res.status(200).json({ email, reopened: reopened.length })
    }

    if (action === 'status') {
      const requests = await sql`
        select role, piece, status, note, source, approved_at, expires_at, revoked_at, created_at
        from ${T(sql, TB.requests)} where lower(email) = ${email} order by created_at desc limit 20
      `
      const grants = await sql`select piece from ${T(sql, TB.grants)} where email = ${email}`
      const exclusions = await sql`select piece from ${T(sql, TB.exclusions)} where email = ${email}`
      await audit(ip, action, target, true)
      return res.status(200).json({
        reader,
        active: !!isActive(reader),
        grants: grants.map((r) => r.piece),
        exclusions: exclusions.map((r) => r.piece),
        requests,
      })
    }

    if (action === 'purge') {
      const r = await sql`delete from ${T(sql, TB.readers)} where email = ${email} returning email`
      const q = await sql`delete from ${T(sql, TB.requests)} where lower(email) = ${email} returning id`
      await sql`delete from ${T(sql, TB.grants)} where email = ${email}`
      await sql`delete from ${T(sql, TB.exclusions)} where email = ${email}`
      await audit(ip, action, target, true)
      return res.status(200).json({ action, email, deleted: { readers: r.length, requests: q.length } })
    }

    // revoke / expire: the whole reader, plus any legacy per-piece links.
    const changed = action === 'revoke'
      ? (await service.revoke(email)).changed
      : (await sql`update ${T(sql,TB.readers)} set expires_at=now() where email=${email} and status='approved' and (expires_at is null or expires_at>now()) returning email`).length
    // Request decisions are history, not bearer grants. Revoking an
    // account must not rewrite its earlier approval into another decision.
    const legacy = []
    await audit(ip, action, target, true)
    return res.status(200).json({ action, email, changed: changed + legacy.length })
  } catch (err) {
    console.error('[stoa] admin failed:', err && err.message ? err.message.slice(0, 200) : 'error')
    return res.status(502).json({ error: 'Temporarily unavailable' })
  }
}
