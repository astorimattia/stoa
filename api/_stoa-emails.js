// Reviewed transactional templates. Dynamic content is escaped before HTML.
const esc = (v = '') => String(v).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
export const BRAND_FROM = 'Stoa Research <research@stoacap.com>'
export const SEND_FROM = BRAND_FROM
// Styles follow the reviewed Stoa email designs: paper card on paper-deep,
// sans header/footer, serif body, ink button.
const P = (text, first) => `<p style="margin:${first ? '0' : '16px 0 0'};overflow-wrap:anywhere;word-break:break-word">${esc(text)}</p>`
const button = (url, label) => `<p style="margin:24px 0 0"><a style="display:inline-block;background:#1b1915;color:#f2ede3;padding:10px 20px;line-height:18px;font-size:14px;font-weight:500;font-family:Inter,Arial,sans-serif;text-decoration:none" href="${esc(url)}">${esc(label)}</a></p>`
function template(subject, paragraphs, action, otp) {
  const text = [...paragraphs.map((p) => typeof p === 'object' && p.link ? `${p.link.prefix}${p.link.label}: ${p.link.url}` : p), ...(action ? ['', action.label, action.url] : []), '', 'Email preferences: https://www.stoacap.com/email-preferences'].join('\n\n')
  const linkP = (l) => `<p style="margin:16px 0 0;font:12px Inter,Arial,sans-serif;color:#6b645a">${esc(l.prefix)}<a style="color:#1b1915;text-decoration:underline" href="${esc(l.url)}">${esc(l.label)}</a></p>`
  const body = paragraphs.map((p, i) => typeof p === 'object' && p.link ? linkP(p.link) : otp && p.includes(otp) ? `<p style="margin:${i === 0 ? '0' : '16px 0 0'}">${esc(p).replace(esc(otp) + '.', `<strong style="display:block;margin:12px 0;font:500 36px/1.4 Georgia,serif;letter-spacing:.12em;color:#1b1915">${esc(otp)}<span style="font-size:18px;letter-spacing:0">.</span></strong>`)}</p>` : P(p, i === 0)).join('')
  const html = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;background:#e8e1d3;color:#1b1915"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="background:#e8e1d3"><tr><td align="center" style="padding:28px 12px"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:640px;table-layout:fixed;background:#f2ede3;color:#1b1915"><tr><td style="padding:12px 28px;border-bottom:1px solid #cfc6b6;font:12px Inter,Arial,sans-serif;color:#6b645a"><span style="font-weight:500;color:#1b1915">Stoa</span>&nbsp;&nbsp;research@stoacap.com<span style="float:right;font-size:14px;color:#1b1915;overflow-wrap:anywhere;word-break:break-word">${esc(subject)}</span></td></tr><tr><td style="padding:32px 28px;font:17px/1.625 Newsreader,Georgia,serif"><div style="font:300 28px/1 Newsreader,Georgia,serif;letter-spacing:-.02em;text-transform:uppercase;margin-bottom:32px">Stoa</div>${body}${action ? button(action.url, action.label) : ''}</td></tr><tr><td style="border-top:1px solid #cfc6b6;padding:16px 28px;font:12px Inter,Arial,sans-serif;color:#6b645a">Stoa &middot; stoacap.com &middot; <a href="https://www.stoacap.com/email-preferences" style="color:#1b1915;text-decoration:underline">Email preferences</a></td></tr></table></td></tr></table></body></html>`
  return { subject, text, html }
}
export function requestReceived(email, pieceTitle) {
  return template('We have your request', [
    'Thank you for asking to read Stoa.',
    'Your request is with us. Signing in does not approve access to private research.',
    'For questions, contact research@stoacap.com.',
    'Stoa',
  ])
}
export function customEmail(subject, text) {
  const paragraphs = String(text || '').split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  return template(String(subject || '').slice(0, 200), [...paragraphs, 'Stoa'])
}

export function approved(email, expiresAt, invitationURL, personalLine = '', options = {}) {
  return template("You're in: your link to Stoa", [
    ...(personalLine ? [personalLine] : []),
    ...(options.isolatedTest ? ['This is an isolated Stoa test. It does not grant access to private research on stoacap.com.'] : []),
    'Your access to Stoa is ready.',
    `Your reader email is ${email}. Your welcome link signs you in once, within 24 hours. Open it and press Continue to read. No second email is needed.`,
    'Your access is limited to the research approved for your account. Signing in does not extend your access expiry.',
    ...(expiresAt ? [`Access runs until ${new Date(expiresAt).toLocaleString('en-US', {timeZone:'America/New_York', month:'short', day:'numeric', year:'numeric', hour:'numeric', minute:'2-digit', timeZoneName:'short'})}.`] : []),
    'Next time, use Sign in on stoacap.com.',
    'Stoa',
  ], invitationURL ? { url: invitationURL, label: 'Open Stoa' } : undefined)
}
export function declined(personalLine = '') {
  return template('About your request to read Stoa', [
    ...(personalLine ? [personalLine] : []),
    'Thank you for your interest. Stoa is shared with a small circle tied to the companies we write about, and we cannot open it more widely at the moment.',
    'Some pieces are open to everyone on stoacap.com, and we will keep publishing them.',
    'Stoa',
  ])
}
export function signInCode(otp) {
  return template('Your Stoa sign-in code', [
    `Your Stoa sign-in code is ${otp}. It works once, for the next 15 minutes.`,
    'If you did not ask for this, ignore this email.',
  ], undefined, otp)
}
export function signInLink(url) {
  return template('Your sign-in link', [
    'Use the link below to sign in to Stoa. It works once, for the next 15 minutes.',
    'Signing in proves your email. Access to locked pieces still requires reader approval.',
    'If you did not ask for this, ignore this email.',
  ], { url, label: 'Sign in to Stoa' })
}

// New-piece announcements go to approved readers who have not stopped them.
export function newIssue(title, dek, url, unsubscribeURL) {
  return template(`Stoa: ${title}`, [title, dek,
    'You are receiving this because you are an approved Stoa reader. New-piece emails come with reader approval.',
    ...(unsubscribeURL ? [{ link: { prefix: 'Stop these emails: ', label: 'Unsubscribe', url: unsubscribeURL } }] : []),
  ], { url, label: 'Read it on Stoa' })
}
