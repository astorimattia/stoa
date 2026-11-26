// Review-only passwordless identity: captured email link/code (15 minutes),
// capability-gated Google and passkey. This does not approve library access.
// Real email sends are disabled; capture permits test identities only.

import { betterAuth } from 'better-auth'
import { APIError, createAuthMiddleware } from 'better-auth/api'
import { deliverTemplate } from './_mail-delivery.js'
import { databaseURL } from './_stoa-db.js'
import { takeLimit } from './_stoa-limits.js'
import { emailOTP, admin, magicLink } from 'better-auth/plugins'
import { signInCode as signInCodeTpl, signInLink as signInLinkTpl, approved } from './_stoa-emails.js'
import { passkey } from '@better-auth/passkey'
import { Pool, neon } from '@neondatabase/serverless'
import { NeonDialect } from 'kysely-neon'

export function identityOnlyAccount(data){
  // This application never calls Google APIs after sign-in. Keep provider
  // identity, not reusable access/refresh/ID tokens or token expiry metadata.
  return {data:{...data,accessToken:null,refreshToken:null,idToken:null,accessTokenExpiresAt:null,refreshTokenExpiresAt:null}}
}

let auth = null
let welcomeAuth = null

// Staging-only mail capture: with STOA_MAIL_CAPTURE=1 (Workers staging),
// sign-in codes are written to the stoa_test_mail table instead of being
// emailed - no Resend, no real mail. The table is readable only through
// the STOA_RECOVERY_TEST-gated test action in api/recover.js.
async function captureMail(email, subject, text) {
  const sql = neon(databaseURL())
  await sql`create table if not exists stoa_test_mail (
    id bigint generated always as identity primary key,
    at timestamptz not null default now(),
    to_addr text not null,
    subject text not null,
    body text not null
  )`
  await sql`insert into stoa_test_mail (to_addr, subject, body) values (${email}, ${subject}, ${text + ' (staging capture - no email was sent)'})`
}

async function sendMail(email, tpl, workflow) {
  if (process.env.STOA_MAIL_CAPTURE === '1') return captureMail(email, tpl.subject, tpl.text)
  return deliverTemplate({sql:neon(databaseURL()),to:email,template:tpl,workflow})
}

const sendSignInCode = (email, otp) => sendMail(email, signInCodeTpl(otp), 'sign-in-code')
const sendSignInLink = (email, url) => sendMail(email, signInLinkTpl(url), 'sign-in-link')

export function createStoaAuth({ welcome = false, database: testDatabase, mailTransport } = {}) {
  const baseURL = process.env.BETTER_AUTH_URL
  const origins = (process.env.BETTER_AUTH_TRUSTED_ORIGINS || baseURL || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  // On Workers (STOA_WORKER=1) a long-lived pg Pool cannot work; the
  // Neon HTTP driver does. kysely-neon's NeonDialect wraps neon() for
  // Better Auth's Kysely; it rejects interactive transactions, so the
  // adapter runs with transaction:false.
  const database = testDatabase || (
    process.env.STOA_WORKER === '1'
      ? {
          dialect: new NeonDialect({ neon: neon(databaseURL()) }),
          type: 'postgres',
          transaction: false,
        }
      : new Pool({ connectionString: databaseURL() }))
  const instance = betterAuth({
    baseURL,
    basePath: welcome ? '/api/welcome-auth' : '/api/auth',
    secret: process.env.BETTER_AUTH_SECRET,
    database,
    account:{storeAccountCookie:false},
    databaseHooks:{account:{create:{before:async data=>identityOnlyAccount(data)},update:{before:async data=>identityOnlyAccount(data)}}},
    emailAndPassword: { enabled: false }, // passwordless only
    trustedOrigins: origins,
    socialProviders: process.env.GOOGLE_CLIENT_ID
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
          },
        }
      : {},
    hooks: {
      before: createAuthMiddleware(async (ctx) => {
        const issue = ['/sign-in/magic-link', '/email-otp/send-verification-otp'].includes(ctx.path)
        const check = ctx.path === '/sign-in/email-otp'
        if (!issue && !check) return
        const email = String(ctx.body?.email || '').trim().toLowerCase().slice(0, 200)
        if (process.env.STOA_MAIL_CAPTURE === '1' && !/@(?:stoa-test\.invalid|test\.local)$/.test(email)) throw new APIError('BAD_REQUEST', { message: 'Use a test identity in this review build.' })
        const ip = ctx.headers?.get('cf-connecting-ip') || ctx.headers?.get('x-forwarded-for')?.split(',')[0] || 'unknown'
        if (testDatabase) return // Only dependency-injected local SQL tests.
        const sql = neon(databaseURL())
        const emailOK = await takeLimit(sql, check ? 'verify-email' : 'issue-email', email, check ? 10 : 3)
        const ipOK = await takeLimit(sql, check ? 'verify-ip' : 'issue-ip', ip, check ? 30 : 20)
        if (!emailOK || !ipOK) throw new APIError('TOO_MANY_REQUESTS', { message: 'Please wait before trying again.' })
      }),
    },
    plugins: [
      emailOTP({
        storeOTP: 'hashed',
        expiresIn: 900, // 15 minutes, matching the sign-in copy
        async sendVerificationOTP({ email, otp, type }) {
          if (type === 'sign-in') await (mailTransport ? mailTransport(email, signInCodeTpl(otp)) : sendSignInCode(email, otp))
        },
      }),
      // One-time sign-in link (15 minutes). The link email carries the link
      // only; the code path below remains the cross-device option.
      magicLink({
        storeToken: 'hashed',
        expiresIn: welcome ? 86400 : 900,
        async sendMagicLink({ email, url, metadata }) {
          if (!welcome) return mailTransport ? mailTransport(email, signInLinkTpl(url)) : sendSignInLink(email, url)
          // The public router does not expose this instance's issuance API.
          // Send a landing link; only a deliberate click spends the login.
          const token = new URL(url).searchParams.get('token')
          const landing = `${new URL(baseURL).origin}/welcome#${token}`
          const tpl = approved(email, metadata?.expiresAt || null, landing, String(metadata?.personalLine || '').slice(0, 1000), {scopeNeutral:true,isolatedTest:process.env.STOA_ISOLATED_MAIL_TEST==='1'})
          if(process.env.STOA_ISOLATED_MAIL_TEST==='1')tpl.subject='[Stoa test] '+tpl.subject
          await (mailTransport ? mailTransport(email, tpl) : sendMail(email, tpl, 'approved-welcome'))
        },
      }),
      passkey({
        rpID: process.env.BETTER_AUTH_RP_ID || (baseURL ? new URL(baseURL).hostname : undefined),
        rpName: 'Stoa',
        origin: origins.length ? origins : undefined,
      }),
      admin(),
    ],
  })
  return instance
}

export function getAuth(welcome = false) {
  if (welcome) return welcomeAuth ||= createStoaAuth({ welcome: true })
  return auth ||= createStoaAuth()
}

export const getWelcomeAuth = () => getAuth(true)
