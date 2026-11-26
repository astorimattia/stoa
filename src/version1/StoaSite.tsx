import React, { useEffect, useState } from 'react'

import StoaHome from './StoaHome'
import ReaderHome from './ReaderHome'
import StoaIssue from './StoaIssue'

const HOME = 'cmtNB8dQ38z9wA8FFAAtNE'
const READER_HOME = 'efPPPqYDZD3hwTHwNHyDED'
const ISSUE = '1VNbzut9ctibRvv5rsz4Ra'

/** The size every frame draws at, unless one exports its own. */
export const viewport = 'web'

export const args = {
  access: 'signed-out',
  signInAs: 'approved',
}

export const argTypes = {
  access: { control: 'radio', options: ['signed-out', 'member'] },
  signInAs: { control: 'radio', options: ['approved', 'pending', 'unknown'] },
}

type Props = Partial<typeof args> & { start?: string; live?: boolean }

/** Live site only: store an access request the same way the main home does. */
function sendRequest(email: string, role: string | null, piece: string | null) {
  fetch('/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role, piece }),
  }).catch(() => {})
}

/**
 * Stoa is a gated front door. Visitors request access; approved readers sign in
 * with an emailed link. `signInAs` decides what a sign-in attempt finds. An
 * approved reader is signed in a moment after the link is sent, standing in
 * for them opening it from their inbox.
 */
export default function StoaSite(props: Props) {
  const { access: startAccess, signInAs, start, live } = { ...args, ...props }
  /** Home and reader home are one place: which one shows depends on access. */
  const [step, setStep] = useState(() => (start === READER_HOME ? HOME : start ?? HOME))
  const [requested, setRequested] = useState(false)
  const [access, setAccess] = useState(start === READER_HOME ? 'member' : startAccess)
  const [email, setEmail] = useState('')
  /** Opens the home sheet on a given panel, e.g. sign in from an issue page. */
  const [homePanel, setHomePanel] = useState<string | null>(null)

  useEffect(() => setAccess(startAccess), [startAccess])

  if (step === ISSUE) {
    return (
      <StoaIssue
        state={requested ? 'requested' : 'default'}
        access={access}
        onBack={() => {
          setHomePanel(null)
          setStep(HOME)
        }}
        onSignIn={() => {
          setHomePanel('signin')
          setStep(HOME)
        }}
        onRequest={(address, role) => {
          if (live) sendRequest(address, role, null)
          setRequested(true)
        }}
      />
    )
  }
  if (access === 'member') {
    return (
      <ReaderHome
        state="returning"
        email={email || 'mara@kiln.co'}
        onOpen={() => setStep(ISSUE)}
        onSignOut={() => {
          setHomePanel(null)
          setAccess('signed-out')
        }}
      />
    )
  }
  return (
    <StoaHome
      state={homePanel ?? (requested ? 'requested' : 'default')}
      access={access}
      email={email}
      onRequest={(address, piece, role) => {
        if (live) sendRequest(address, role, piece)
        setRequested(true)
      }}
      onOpen={() => {
        setHomePanel(null)
        setStep(ISSUE)
      }}
      onSignOut={() => setAccess('signed-out')}
      onSignIn={(address) => {
        setEmail(address)
        // On the live site, sign-in goes through the real Stoa sign-in page.
        if (live) {
          window.location.href = '/signin'
          return 'link-sent'
        }
        if (signInAs === 'pending') return 'pending'
        if (signInAs === 'unknown') return 'unknown'
        setTimeout(() => setAccess('member'), 2400)
        return 'link-sent'
      }}
    />
  )
}
