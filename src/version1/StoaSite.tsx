import React, { useEffect, useState } from 'react'

import Home from './Home'
import Research from './Research'
import Note from './Note'
import Positions from './Positions'
import Experts from './Experts'
import Members from './Members'

const HOME = '6XFDFUgVM26wSN1YHiMuat'
const RESEARCH = 'iYrmqbYhguHqgVyTULg5ps'
const POSITIONS = 't4tAL3Gt31NZ6wqHMpBaXQ'
const MEMBERS = 'r6j2fjsX2HD3y1vS7eHa6k'
const NOTE = '7d8MS6qF3jZFmf73c5cAz9'
const EXPERTS = 'r9JEQgiAxLoZxyX1xQrp3s'

const pages = { home: HOME, research: RESEARCH, positions: POSITIONS, experts: EXPERTS, members: MEMBERS } as const

/** The size every frame draws at, unless one exports its own. */
export const viewport = 'web'

export const args = {
  signedIn: false,
}

export const argTypes = {
  signedIn: { control: 'boolean' },
}

type Props = Partial<typeof args> & { start?: string; live?: boolean }

/** Live site only: store an access request the same way the main home does. */
function sendRequest(email: string) {
  fetch('/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role: null, piece: null }),
  }).catch(() => {})
}

export default function Prototype(props: Props) {
  const { signedIn: startSignedIn, start, live } = { ...args, ...props }
  const requestAccess = (email?: string) => {
    setRequested(true)
    if (live && email) sendRequest(email)
  }
  const [page, setPage] = useState(() => start ?? HOME)
  const [signedIn, setSignedIn] = useState(startSignedIn)
  const [requested, setRequested] = useState(false)
  const [noteSlug, setNoteSlug] = useState('micron-margin')
  useEffect(() => setSignedIn(startSignedIn), [startSignedIn])

  const navigate = (to: keyof typeof pages) => {
    setPage(pages[to])
    window.scrollTo?.({ top: 0 })
  }
  const openNote = (slug: string) => {
    setNoteSlug(slug)
    setPage(NOTE)
    window.scrollTo?.({ top: 0 })
  }

  if (page === NOTE)
    return (
      <Note
        slug={noteSlug}
        signedIn={signedIn}
        intake={requested ? 'sent' : 'default'}
        onNavigate={navigate}
        onRequestAccess={requestAccess}
      />
    )

  if (page === RESEARCH) return <Research signedIn={signedIn} onNavigate={navigate} onOpenNote={openNote} />
  if (page === EXPERTS) return <Experts signedIn={signedIn} onNavigate={navigate} onOpenNote={openNote} />
  if (page === POSITIONS) return <Positions signedIn={signedIn} onNavigate={navigate} onOpenNote={openNote} />
  if (page === MEMBERS)
    return (
      <Members
        state={signedIn ? 'signed-in' : requested ? 'requested' : 'signed-out'}
        onNavigate={navigate}
        signInHref={live ? '/signin' : undefined}
        onSignIn={() => setSignedIn(true)}
        onSignOut={() => setSignedIn(false)}
        onRequestAccess={requestAccess}
      />
    )
  return (
    <Home
      signedIn={signedIn}
      intake={requested ? 'sent' : 'default'}
      onNavigate={navigate}
      onOpenNote={openNote}
      onRequestAccess={requestAccess}
    />
  )
}
