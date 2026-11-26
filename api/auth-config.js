// Public auth capability surface for the sign-in UI: which methods are
// actually configured on THIS deployment. The client renders each method
// from this, never from the hostname - a staging OAuth client enables
// Google on staging, and production without a client shows it unavailable.
export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }
  return res.status(200).json({ google: !!process.env.GOOGLE_CLIENT_ID, email: process.env.STOA_MAIL_CAPTURE === '1' || (process.env.STOA_TRANSACTIONAL_SEND === '1' && !!process.env.RESEND_API_KEY && !!process.env.STOA_MAIL_ENCRYPTION_KEY && (!!process.env.STOA_MAIL_RECIPIENT_ALLOWLIST || process.env.STOA_TRANSACTIONAL_RECIPIENT_POLICY==='requested-workflows')), reviewOnly: process.env.STOA_MAIL_CAPTURE === '1', legacyBridge: process.env.STOA_ACCOUNT_REVIEW !== '1' && process.env.STOA_PRODUCTION_READER_BRIDGE === '1' })
}
