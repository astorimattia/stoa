// "Who might this requester be" lookup - free, credential-less, admin-initiated.
// Fetches only the requester email domain's public homepage and returns its
// site name / title / description as an uncertain company hint.
//
// SSRF guards (fail closed):
// - the hostname is validated as a bare DNS name: no scheme, credentials,
//   port, path, IP literal or trailing-dot tricks;
// - DNS is resolved first and EVERY address must be public - loopback,
//   private, link-local, CGNAT, multicast, documentation and IPv4-mapped
//   IPv6 ranges are refused;
// - only https on the default port; redirects are followed manually (max 2)
//   with the same hostname + DNS re-validation on every hop, so a public
//   domain cannot bounce the request to an internal target;
// - 8s total timeout and a 256 KB body cap;
// - the connection is then PINNED to a validated address (custom TLS lookup),
//   so the DNS check and the fetch can never resolve to different addresses -
//   there is no check/use window, while SNI and certificate verification
//   still run against the real hostname.

import { lookup as dnsLookup } from 'node:dns/promises'
import { request as httpsRequest } from 'node:https'

export const HOST_RE = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)+$/i
const EMAIL_RE = /^[A-Za-z0-9._%+-]{1,64}@([A-Za-z0-9-]+(\.[A-Za-z0-9-]+)+)$/
export const GENERIC_MAIL = new Set(['gmail.com','yahoo.com','hotmail.com','outlook.com','icloud.com','aol.com','proton.me','protonmail.com','me.com','googlemail.com','live.com','msn.com','mail.com','pm.me'])

export function isPrivateAddress(ip) {
  if (ip.includes('.')) {
    const p = ip.split('.').map(Number)
    if (p.length !== 4 || p.some(n => !(Number.isInteger(n) && n >= 0 && n <= 255))) return true
    const [a, b] = p
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) ||
      (a === 198 && (b === 18 || b === 19 || b === 51)) || (a === 203 && b === 0) || a >= 224
  }
  const s = ip.toLowerCase()
  if (s === '::' || s === '::1') return true
  if (s.startsWith('::ffff:')) { const v4 = s.slice(7); return !/^\d+\.\d+\.\d+\.\d+$/.test(v4) || isPrivateAddress(v4) }
  const h = s.replace(/^\[+|\]$/g, '')
  if (!/^[0-9a-f:]+$/.test(h)) return true
  const first = h.split(':')[0]
  if (!first) return true
  const n = parseInt(first, 16)
  if (Number.isNaN(n)) return true
  return (n & 0xfe00) === 0xfc00 /* fc00::/7 unique-local */ || (n & 0xffc0) === 0xfe80 /* fe80::/10 link-local */ ||
    (n & 0xffe0) === 0xfec0 /* deprecated site-local */ || (n === 0x2001 && h.startsWith('2001:db8')) /* documentation */
}

// Every resolved address must be public; null means refuse.
export async function resolvePublicHost(host) {
  let addrs
  try { addrs = await dnsLookup(host, { all: true, verbatim: true }) } catch { return null }
  if (!addrs || !addrs.length) return null
  for (const a of addrs) if (isPrivateAddress(a.address)) return null
  return addrs
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&#x27;': "'", '&nbsp;': ' ' }
const clean = (v, n) => String(v || '').replace(/&(amp|lt|gt|quot|nbsp|#39|#x27);/g, (m) => ENTITIES[m] || m).replace(/<[^>]*>/g, '').replace(/\s+/g, ' ').trim().slice(0, n)
const none = (email, domain, note) => ({ email, domain, kind: 'none', note })

// GET with the connection pinned to an already-validated public address:
// the custom lookup makes the TCP/TLS dial use that exact IP while the TLS
// SNI and certificate check still run against the real hostname, closing the
// DNS check/fetch gap. https on the default port only.
export function fetchPinned(url, pinned, deadline, maxBytes, strict = false) {
  return new Promise((resolve) => {
    let u
    try { u = new URL(url) } catch { return resolve(null) }
    const req = httpsRequest({
      hostname: u.hostname,
      servername: u.hostname,
      port: 443,
      path: (u.pathname || '/') + (u.search || ''),
      method: 'GET',
      lookup: (host, opts, cb) => (opts && opts.all) ? cb(null, [{ address: pinned.address, family: pinned.family }]) : cb(null, pinned.address, pinned.family),
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StoaAdminLookup/1.0)', Accept: 'text/html' },
      timeout: Math.max(1000, deadline - Date.now()),
    }, (res) => {
      // Cap the body but keep what arrived: title/description live in <head>,
      // so a truncated page still yields the hint and stays bounded.
      const chunks = []
      let size = 0
      let done = false
      const finish = (body) => { if (!done) { done = true; resolve(body ? { status: res.statusCode, headers: res.headers, body } : null) } }
      res.on('data', (c) => {
        size += c.length
        if (size > maxBytes) { finish(strict ? null : Buffer.concat(chunks)); res.destroy() } else chunks.push(c)
      })
      res.on('end', () => finish(Buffer.concat(chunks)))
      res.on('error', () => finish(!strict && chunks.length ? Buffer.concat(chunks) : null))
    })
    req.on('timeout', () => { req.destroy() })
    req.on('error', () => resolve(null))
    req.end()
  })
}

export async function lookupRequesterIdentity(rawEmail) {
  const email = clean(rawEmail, 254).toLowerCase()
  const m = EMAIL_RE.exec(email)
  if (!m) return { error: 'Valid email required', status: 400 }
  const domain = m[1].toLowerCase()
  if (GENERIC_MAIL.has(domain)) {
    return { email, domain, kind: 'personal', note: null }
  }
  if (!HOST_RE.test(domain)) return none(email, domain, 'No public website to look up for this domain.')
  const initial = await resolvePublicHost(domain)
  if (!initial) return none(email, domain, 'No public website to look up for this domain. Try the web search links.')

  const deadline = Date.now() + 8000
  let current = 'https://' + domain + '/'
  let pinned = initial[0]
  try {
    for (let hop = 0; hop < 3; hop++) {
      if (Date.now() > deadline) return none(email, domain, 'No public website answered for ' + domain + '. Try the web search links.')
      const r = await fetchPinned(current, pinned, deadline, 256 * 1024)
      if (!r) return none(email, domain, 'No public website answered for ' + domain + '. Try the web search links.')
      if (r.status >= 300 && r.status < 400) {
        const loc = r.headers.location
        if (!loc || hop === 2) return none(email, domain, 'The site at ' + domain + ' only redirects. Try the web search links.')
        let u
        try { u = new URL(loc, current) } catch { return none(email, domain, 'The site at ' + domain + ' gave an unusable redirect.') }
        const host = (u.hostname || '').toLowerCase()
        if (u.protocol !== 'https:' || u.username || u.password || (u.port && u.port !== '443') || !HOST_RE.test(host)) {
          return none(email, domain, 'The site at ' + domain + ' redirects somewhere this lookup will not follow. Try the web search links.')
        }
        const next = await resolvePublicHost(host)
        if (!next) return none(email, domain, 'The site at ' + domain + ' redirects somewhere this lookup will not follow. Try the web search links.')
        pinned = next[0]
        current = 'https://' + host + (u.pathname || '/') + (u.search || '')
        continue
      }
      const type = r.headers['content-type'] || ''
      if (r.status < 200 || r.status >= 300 || !type.includes('text/html')) return none(email, domain, 'No readable page at ' + domain + '. Try the web search links.')
      const html = r.body.toString('utf8')
      const title = clean((html.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || [])[1], 200)
      const desc = clean((html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["']/i) || html.match(/<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["']/i) || [])[1], 400)
      const ogSite = clean((html.match(/<meta[^>]+property=["']og:site_name["'][^>]+content=["']([\s\S]*?)["']/i) || [])[1], 120)
      if (!title && !desc && !ogSite) return none(email, domain, 'The site at ' + domain + ' gave no description. Try the web search links.')
      return {
        email, domain, kind: 'domain',
        site: ogSite || null, title: title || null, description: desc || null,
        note: 'Only the public website at their email domain - it suggests the company, not the person. Confirm with the web search links before deciding.',
      }
    }
    return none(email, domain, 'The site at ' + domain + ' only redirects. Try the web search links.')
  } catch {
    return none(email, domain, 'No public website answered for ' + domain + '. Try the web search links.')
  }
}
