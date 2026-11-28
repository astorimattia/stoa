import React, { useEffect, useState } from 'react'

import Home from './Home'
import Research from './Research'
import Note from './Note'
import Investments from './Positions'
import Members from './Members'
import type { StoaPage } from './shared/components/stoa/Masthead'
import { noteBySlug } from './shared/stoaData'
import { authClient } from '../shared/stoa/authClient'

// The Experts page is off the site until we have named experts (see src/version1/Experts).

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

/** Live site only: store an access request the same way the main home does. True once the server has it. */
async function sendRequest(email: string): Promise<boolean> {
  try {
    const res = await fetch('/api/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, role: null, piece: null, source: 'version2' }),
    })
    return res.ok
  } catch {
    return false
  }
}

/**
 * Live site only: the real account session. A session proves an email; the
 * server says whether that email is an approved member.
 */
function useMember(live?: boolean) {
  const { data: session, isPending } = authClient.useSession()
  const email = live ? session?.user?.email : undefined
  const [approved, setApproved] = useState<boolean | null>(null)
  useEffect(() => {
    if (!email) {
      setApproved(null)
      return
    }
    let cancelled = false
    fetch('/api/article?access=1&identity=1')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => !cancelled && setApproved(d?.readerApproved === true))
      .catch(() => !cancelled && setApproved(false))
    return () => {
      cancelled = true
    }
  }, [email])
  return { email, approved, checking: live ? isPending || (!!email && approved === null) : false }
}

export default function StoaSite(props: Props) {
  const { signedIn: startSignedIn, live } = { ...args, ...props }
  const [route, setRoute] = useState<Route>(() => (typeof window === 'undefined' ? { page: 'home' } : parseHash(window.location.hash)))
  const [mockSignedIn, setMockSignedIn] = useState(startSignedIn)
  const [requested, setRequested] = useState(false)
  useEffect(() => setMockSignedIn(startSignedIn), [startSignedIn])
  const member = useMember(live)
  // On the live site, signed in means a real session for an approved member.
  const signedIn = live ? member.approved === true : mockSignedIn
  const signOut = async () => {
    if (!live) return setMockSignedIn(false)
    await authClient.signOut().catch(() => {})
    window.location.reload()
  }

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

  const requestAccess = async (email?: string) => {
    if (live) {
      if (!email || !(await sendRequest(email))) return false
    }
    setRequested(true)
    return true
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
        member={live ? member.email : undefined}
        pending={live && !!member.email && member.approved === false}
        checking={member.checking}
        live={live}
        onNavigate={navigate}
        onSignIn={() => setMockSignedIn(true)}
        onSignOut={signOut}
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
