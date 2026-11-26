// DB-backed pieces: content written through the admin Pieces editor and the
// manual Substack import. Static pieces keep living in code+env; this module
// only adds the dynamic side and never rewrites the static registry.
//
// Tables (prefix-aware: stoa_ live, stoa_test_ in review mode):
//   <p>pieces         slug, title, mode            (shared shape with _stoa-db)
//   <p>piece_content  slug pk, number, title, dek, market, author, entity,
//                     date_label, read_time, memo jsonb, source, timestamps
//   <p>piece_drafts   id pk, title, summary, market, body, timestamps
//
// Article text in the DB is reader data: never logged, served only through
// article.js under the same mode checks as env-backed pieces.

import { randomBytes } from 'node:crypto'
import { T } from './_stoa-db.js'
import { fetchPinned, resolvePublicHost, HOST_RE } from './_stoa-lookup.js'

export async function ensureContentSchema(sql, prefix) {
  // Removal is a tombstone, never a content, reader or analytics purge.
  await sql`create table if not exists ${T(sql, prefix + 'removed_pieces')} (slug text primary key, removed_at timestamptz not null default now())`
  await sql`create table if not exists ${T(sql, prefix + 'pieces')} (
    slug text primary key, title text not null, mode text not null default 'readers'
  )`
  await sql`create table if not exists ${T(sql, prefix + 'piece_content')} (
    slug text primary key,
    number integer not null,
    title text not null,
    dek text not null default '',
    market text not null default '',
    author text not null default 'MATTIA ASTORI',
    entity text not null default 'STOA',
    date_label text not null default '',
    read_time text not null default '',
    memo jsonb not null,
    source text not null default 'editor',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`
  await sql`create table if not exists ${T(sql, prefix + 'piece_drafts')} (
    id text primary key,
    title text not null default '',
    summary text not null default '',
    market text not null default '',
    body text not null default '',
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  )`
}

// Metadata for the static registry pieces, mirroring the public research
// index so the API can serve one merged list. Static defaults only; the live
// mode always comes from the pieces table.
export const CODE_PIECE_META = {
  'elections-vc': { number: 5, dek: 'I checked the last 19 federal elections against 30 years of venture data. The results surprised me.', market: 'Venture', date: 'Nov 2026', readTime: '9 min', author: 'DINKI' },
  'space-insurance': { number: 3, title: 'Space Insurance; Is Now The Time?', dek: 'An analysis of the space insurance market and the potential future value.', market: 'Space', date: 'Oct 2026', readTime: '7 min', author: 'MATTIA ASTORI' },
  consensus: { number: 2, title: 'Beyond Consensus', dek: 'The market has priced its winners. I want to map the world once those bets play out, and invest in what becomes scarce then.', market: 'Venture', date: 'Sep 2026', readTime: '9 min', author: 'MATTIA ASTORI' },
  erebor: { number: 1, dek: 'A chartered bank built for technology companies, two years after SVB. The thesis, the regulatory path and the open questions.', market: 'Fintech', date: 'Oct 2026', readTime: '18 min', author: 'MATTIA ASTORI' },
  'yc-s26-screening': { number: 0, dek: 'Where YC is putting its money in S26: agents, industrials and the less obvious bets, screened by founder signal nine days before Demo Day.', market: 'YC', date: 'Sep 2026', readTime: '8 min', author: 'MATTIA ASTORI' },
}

export const slugify = (title) =>
  String(title || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60)

export const readTime = (text) => {
  const words = String(text || '').split(/\s+/).filter(Boolean).length
  return Math.max(1, Math.round(words / 200)) + ' min'
}

// Plain-text editor body -> Memo sections. Blank lines split paragraphs,
// "## " starts a heading, "- " starts a list item, and an image-only line in
// Markdown form preserves an imported image through the plain-text editor.
const decodeEntities = (s) => String(s || '').replace(/&(amp|lt|gt|quot|apos|nbsp|#39|#x27);/gi, (m, k) => ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', '#39': "'", '#x27': "'" }[k.toLowerCase()] || m))
const cleanText = (s) => decodeEntities(String(s || '').replace(/<[^>]+>/g, '')).replace(/\s+/g, ' ').trim()
const attrs = (tag) => {
  const out = {}
  for (const m of String(tag || '').matchAll(/([a-zA-Z_:][-\w:.]*)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/g)) out[m[1].toLowerCase()] = decodeEntities(m[2] ?? m[3] ?? m[4] ?? '')
  return out
}
export const safeImageURL = (src) => {
  try {
    const u = new URL(decodeEntities(src), 'https://stoa.invalid')
    if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443')) return ''
    return u.href
  } catch { return '' }
}
const imageLine = (b) => '![' + String(b.alt || '').replace(/[\]\n\r]/g, ' ') + '](' + b.src + (b.caption ? ' "' + String(b.caption).replace(/["\n\r]/g, "'") + '"' : '') + ')'

export function textToMemo({ slug, title, author, entity, date, subtitle, body }) {
  const blocks = []
  for (const para of String(body || '').split(/\n\s*\n/)) {
    const lines = para.split('\n').map((l) => l.trim()).filter(Boolean)
    for (const line of lines) {
      const img = line.match(/^!\[([^\]]*)\]\((\S+?)(?:\s+"([^"]*)")?\)$/)
      if (img && safeImageURL(img[2])) blocks.push({ type: 'img', src: safeImageURL(img[2]), alt: img[1] || '', ...(img[3] ? { caption: img[3] } : {}) })
      else if (line.startsWith('## ')) blocks.push({ type: 'h3', text: line.slice(3) })
      else if (line.startsWith('- ')) blocks.push({ type: 'li', text: line.slice(2) })
      else blocks.push({ type: 'p', text: line })
    }
  }
  return { slug, title, entity: entity || 'STOA', author: author || 'MATTIA ASTORI', date: date || '', ...(subtitle ? { subtitle } : {}), sections: [{ id: 's1', blocks }] }
}

// Memo -> the plain-text editor format. Images stay visible as one-line
// Markdown placeholders so saving or publishing a draft cannot silently drop
// them again.
export function memoToText(memo) {
  return (memo.sections || []).flatMap((s) => s.blocks || []).map((b) => {
    if (b.type === 'h3') return '## ' + b.text
    if (b.type === 'li') return '- ' + b.text
    if (b.type === 'img') return imageLine(b)
    return b.text || ''
  }).filter(Boolean).join('\n\n')
}

// Imported HTML -> Memo blocks. Paragraphs, headings, list items and images
// survive; everything else is stripped to text. Links keep their text only.
// Figures keep the source image URL, alt text and caption where available.
export function htmlToMemo({ slug, title, author, entity, date, subtitle, html }) {
  const blocks = []
  const cleaned = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<(p|h1|h2|h3|h4|li|blockquote)[^>]*>/gi, '\n\n<$1>')
  const figureRe = /<figure\b[\s\S]*?<\/figure>/gi
  const tokens = []
  let last = 0
  for (const m of cleaned.matchAll(figureRe)) {
    if (m.index > last) tokens.push({ kind: 'html', value: cleaned.slice(last, m.index) })
    tokens.push({ kind: 'figure', value: m[0] })
    last = m.index + m[0].length
  }
  if (last < cleaned.length) tokens.push({ kind: 'html', value: cleaned.slice(last) })

  const pushImage = (imgTag, caption = '') => {
    const a = attrs(imgTag)
    const src = safeImageURL(a.src || a['data-src'] || '')
    if (src) blocks.push({ type: 'img', src, alt: cleanText(a.alt || ''), ...(caption ? { caption } : {}) })
  }
  const pushHtml = (value) => {
    const parts = String(value || '').split(/\n\s*\n/).map((s) => s.trim()).filter(Boolean)
    for (const part of parts) {
      const tag = (part.match(/^<(p|h1|h2|h3|h4|li|blockquote)>/i) || [])[1] || ''
      const text = cleanText(part)
      if (/^h[1-4]$/i.test(tag)) { if (text) blocks.push({ type: 'h3', text }) }
      else if (/^li$/i.test(tag)) { if (text) blocks.push({ type: 'li', text }) }
      else if (text) blocks.push({ type: 'p', text })
      for (const m of part.matchAll(/<img\b[^>]*>/gi)) pushImage(m[0])
    }
  }

  for (const token of tokens) {
    if (token.kind === 'figure') {
      const caption = cleanText((token.value.match(/<figcaption\b[^>]*>([\s\S]*?)<\/figcaption>/i) || [])[1] || '')
      const imgs = [...token.value.matchAll(/<img\b[^>]*>/gi)]
      imgs.forEach((m, i) => pushImage(m[0], i === 0 ? caption : ''))
      if (!imgs.length) pushHtml(token.value)
    } else {
      pushHtml(token.value)
    }
  }
  return { slug, title, entity: entity || 'STOA', author: author || 'MATTIA ASTORI', date: date || '', ...(subtitle ? { subtitle } : {}), sections: [{ id: 's1', blocks }] }
}

const normText = (v) => String(v || '').replace(/\s+/g, ' ').trim().toLowerCase()
const textOfBlock = (b) => b && (b.type === 'p' || b.type === 'h3' || b.type === 'li') ? normText(b.text) : ''

// Repair an already-published imported piece without touching its text: add
// source images that the old importer dropped, and refresh alt/caption data
// for images already present. Existing blocks and their order stay as-is.
export function mergeMemoImages(existingMemo, sourceMemo) {
  const existing = (existingMemo?.sections || []).flatMap((s) => s.blocks || [])
  const source = (sourceMemo?.sections || []).flatMap((s) => s.blocks || [])
  const sourceImages = source.filter((b) => b.type === 'img' && safeImageURL(b.src))
  const bySrc = new Map(sourceImages.map((b) => [safeImageURL(b.src), b]))
  let updated = false
  const result = existing.map((b) => {
    if (b.type !== 'img') return b
    const fresh = bySrc.get(safeImageURL(b.src))
    if (fresh) updated = true
    return fresh ? { ...b, alt: fresh.alt || b.alt || '', ...(fresh.caption ? { caption: fresh.caption } : {}) } : b
  })
  let added = 0
  for (const img of sourceImages) {
    const src = safeImageURL(img.src)
    if (result.some((b) => b.type === 'img' && safeImageURL(b.src) === src)) continue
    const sourceIndex = source.findIndex((b) => b === img)
    const prevText = source.slice(0, sourceIndex).reverse().map(textOfBlock).find(Boolean)
    const nextText = source.slice(sourceIndex + 1).map(textOfBlock).find(Boolean)
    let at = -1
    if (prevText) {
      const i = result.findIndex((b) => textOfBlock(b) === prevText)
      if (i >= 0) at = i + 1
    }
    if (at < 0 && nextText) {
      const i = result.findIndex((b) => textOfBlock(b) === nextText)
      if (i >= 0) at = i
    }
    if (at < 0) at = result.length
    result.splice(at, 0, { type: 'img', src, alt: img.alt || '', ...(img.caption ? { caption: img.caption } : {}) })
    added++
  }
  const memo = { ...existingMemo, sections: (existingMemo?.sections?.length ? existingMemo.sections : [{ id: 's1' }]).map((s, i) => i === 0 ? { ...s, blocks: result } : s) }
  return { memo, added, updated }
}

// Pinned fetch of a Substack API path (same SSRF posture as the admin
// lookup: validated public host, pinned address, https/443, bounded).
async function substackGet(host, path) {
  if (!HOST_RE.test(host)) return null
  const addrs = await resolvePublicHost(host)
  if (!addrs) return null
  const r = await fetchPinned('https://' + host + path, addrs[0], Date.now() + 10000, 4 * 1024 * 1024)
  if (!r || r.status !== 200) return null
  const type = r.headers['content-type'] || ''
  if (!type.includes('json')) return null
  try { return JSON.parse(r.body.toString('utf8')) } catch { return null }
}

export async function substackArchive(host) {
  const raw = await substackGet(host, '/api/v1/archive?sort=new&limit=25')
  const data = Array.isArray(raw) ? raw : (raw && Array.isArray(raw.posts) ? raw.posts : null)
  if (!data) return null
  return data.map((p) => ({
    slug: String(p.slug || '').slice(0, 120),
    title: String(p.title || '').slice(0, 200),
    subtitle: String(p.subtitle || '').slice(0, 500),
    date: String(p.post_date || '').slice(0, 10),
    paid: p.audience === 'only_paid',
  })).filter((p) => p.slug && p.title)
}

export async function substackPost(host, slug) {
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return null
  const data = await substackGet(host, '/api/v1/posts/' + slug)
  if (!data || !data.body_html) return null
  return {
    slug,
    title: String(data.title || '').slice(0, 200),
    subtitle: String(data.subtitle || '').slice(0, 500),
    date: String(data.post_date || '').slice(0, 10),
    paid: data.audience === 'only_paid',
    html: String(data.body_html),
  }
}

export const newDraftId = () => randomBytes(9).toString('base64url')
