// Client for the account-based reader sign-in (email link or code, Google,
// passkey). Access is account-wide: a session proves an email, the server
// decides what that email reads.
import { createAuthClient } from 'better-auth/react'
import { emailOTPClient, magicLinkClient, adminClient } from 'better-auth/client/plugins'
import { passkeyClient } from '@better-auth/passkey/client'

export const authClient = createAuthClient({
  plugins: [emailOTPClient(), magicLinkClient(), passkeyClient(), adminClient()],
})
