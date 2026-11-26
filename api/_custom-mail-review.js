// A short-lived review proves the exact one-recipient message the admin saw.
// It grants no account access and never sends by itself.
import { createHmac, createHash, randomUUID, timingSafeEqual } from 'node:crypto'
import { customEmail } from './_stoa-emails.js'
const duration = 15 * 60 * 1000
const digest = tpl => createHash('sha256').update(JSON.stringify([tpl.subject, tpl.text, tpl.html])).digest('hex')
const sign = (data, key) => createHmac('sha256', key).update('stoa-custom-mail-review:' + data).digest('base64url')
export function createCustomReview(to, subject, text, env = process.env, now = Date.now()) {
  if (!env.STOA_ADMIN_SECRET) throw Error('Review signing unavailable')
  const template = customEmail(subject, text)
  const payload = { version: 1, to, subject, text, hash: digest(template), nonce: randomUUID(), expiresAt: now + duration }
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url')
  return { to, ...template, expiresAt: payload.expiresAt, reviewToken: data + '.' + sign(data, env.STOA_ADMIN_SECRET) }
}
export function verifyCustomReview(token, to, template, env = process.env, now = Date.now()) {
  if (!env.STOA_ADMIN_SECRET || typeof token !== 'string' || token.length > 60000) throw Error('Review this email again before sending')
  const [data, signature, extra] = token.split('.')
  if (!data || !signature || extra) throw Error('Review this email again before sending')
  const expected = sign(data, env.STOA_ADMIN_SECRET)
  const a = Buffer.from(signature), b = Buffer.from(expected)
  if (a.length !== b.length || !timingSafeEqual(a, b)) throw Error('Review this email again before sending')
  let p
  try { p = JSON.parse(Buffer.from(data, 'base64url').toString()) } catch { throw Error('Review this email again before sending') }
  if (p.version !== 1 || p.to !== to || !p.nonce || !Number.isFinite(p.expiresAt) || p.expiresAt < now || p.expiresAt > now + duration) throw Error('Review this email again before sending')
  const final = customEmail(p.subject, p.text)
  if (p.hash !== digest(final) || (template && digest(template) !== p.hash)) throw Error('The email changed. Review it again before sending')
  return { to: p.to, template: final, key: 'admin-custom:' + createHash('sha256').update(token).digest('hex') }
}
