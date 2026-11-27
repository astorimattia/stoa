import React, { useEffect, useState } from 'react'

import Home from './Home'
import Research from './Research'
import Note from './Note'
import Investments from './Positions'
import Members from './Members'
import type { StoaPage } from './shared/components/stoa/Masthead'
import { noteBySlug } from './shared/stoaData'

// The Experts page stays in the repo (./Experts) but is off the site until we have named experts.

type Route = { page: StoaPage | 'note'; slug?: string }

/** Every page has its own address (#research, #investments, #note/<slug>), so links can be shared and Back works. */
function parseHash(hash: string): Route {
  const [head, slug] = hash.replace(/^#\/?/, '').split('/')
  if (head === 'note' && slug && noteBySlug(slug)) return { page: 'note', slug }
  if (head === 'research' || head === 'investments' || head === 'members') return { page: head }
  if (head === 'positions') return { page: 'investments' }
  return { page: 'home' }
}

function toHash(route: Route) {
  if (route.page === 'note') return `#note/${route.slug}`
  if (route.page === 'home') return ''
  return `#${route.page}`
}

/** The size every frame draws at, unless one exports its own. */
export const viewport = 'web'

export const args = {
  signedIn: false,
}

export const argTypes = {
  signedIn: { control: 'boolean' },
}

type Props = Partial<typeof args> & { live?: boolean }

/** Live site only: store an access request the same way the main home does. */
function sendRequest(email: string) {
  fetch('/api/request', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, role: null, piece: null }),
  }).catch(() => {})
}

export default function StoaSite(props: Props) {
  const { signedIn: startSignedIn, live } = { ...args, ...props }
  const [route, setRoute] = useState<Route>(() => (typeof window === 'undefined' ? { page: 'home' } : parseHash(window.location.hash)))
  const [signedIn, setSignedIn] = useState(startSignedIn)
  const [requested, setRequested] = useState(false)
  useEffect(() => setSignedIn(startSignedIn), [startSignedIn])

  useEffect(() => {
    const onHash = () => {
      setRoute(parseHash(window.location.hash))
      window.scrollTo?.({ top: 0 })
    }
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const go = (next: Route) => {
    const hash = toHash(next)
    const current = window.location.hash
    if (hash && hash !== current) {
      // The hashchange listener sets the route and scrolls up.
      window.location.hash = hash
      return
    }
    if (!hash && current) history.pushState(null, '', window.location.pathname + window.location.search)
    setRoute(next)
    window.scrollTo?.({ top: 0 })
  }
  const navigate = (to: StoaPage) => go({ page: to })
  const openNote = (slug: string) => go({ page: 'note', slug })

  const requestAccess = (email?: string) => {
    setRequested(true)
    if (live && email) sendRequest(email)
  }

  useEffect(() => {
    const titles: Record<string, string> = { research: 'Research', investments: 'Investments', members: 'Request access' }
    const note = route.page === 'note' && route.slug ? noteBySlug(route.slug) : undefined
    document.title = note ? `${note.title} | Stoa` : titles[route.page] ? `${titles[route.page]} | Stoa` : 'Stoa'
  }, [route])

  if (route.page === 'note' && route.slug)
    return (
      <Note
        slug={route.slug}
        signedIn={signedIn}
        intake={requested ? 'sent' : 'default'}
        onNavigate={navigate}
        onRequestAccess={requestAccess}
      />
    )

  if (route.page === 'research') return <Research signedIn={signedIn} onNavigate={navigate} onOpenNote={openNote} />
  if (route.page === 'investments') return <Investments signedIn={signedIn} onNavigate={navigate} onOpenNote={openNote} />
  if (route.page === 'members')
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
