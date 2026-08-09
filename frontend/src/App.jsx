import { useEffect, useCallback } from 'react'
import { useLocale } from './i18n/index.jsx'
import { AppProvider, useApp } from './context/AppContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import { CallProvider } from './context/CallContext.jsx'
import AuthPage from './components/auth/AuthPage.jsx'
import TotpPage from './components/totp/TotpPage.jsx'
import Sidebar from './components/layout/Sidebar.jsx'
import ChatPane from './components/layout/ChatPane.jsx'
import ToastContainer from './components/common/Toast.jsx'
import IncomingCallDialog from './components/calls/IncomingCallDialog.jsx'
import CallOverlay from './components/calls/CallOverlay.jsx'
import UserProfilePage from './components/common/UserProfilePage.jsx'
import MessageNotificationBanner from './components/common/MessageNotificationBanner.jsx'
import FriendRequestBanner from './components/common/FriendRequestBanner.jsx'
import AdminPanel from './components/panels/AdminPanel.jsx'
import { authMe, bootstrap, joinGroup, sendFriendRequest } from './api.js'

function AppInner() {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()

  // Parse initial route action from URL
  useEffect(() => {
    const path = window.location.pathname
    const groupMatch = path.match(/^\/g\/(.+)$/)
    const friendMatch = path.match(/^\/add\/(.+)$/)
    if (groupMatch) dispatch({ type: 'SET_ROUTE_ACTION', action: { type: 'join-group', payload: groupMatch[1] } })
    else if (friendMatch) dispatch({ type: 'SET_ROUTE_ACTION', action: { type: 'add-friend', payload: friendMatch[1] } })
  }, []) // eslint-disable-line

  // Check auth on mount
  useEffect(() => {
    authMe()
      .then((data) => {
        dispatch({ type: 'SET_ME', me: data.user, requiresTotpSetup: data.requires_totp_setup })
      })
      .catch(() => {
        dispatch({ type: 'SET_AUTH_STATUS', status: 'unauthenticated' })
      })
  }, []) // eslint-disable-line

  // Load bootstrap data after auth
  useEffect(() => {
    if (state.authStatus !== 'authenticated') return
    bootstrap()
      .then((data) => {
        dispatch({ type: 'BOOTSTRAP', data })
      })
      .catch(() => {})
  }, [state.authStatus]) // eslint-disable-line

  // Handle route actions after bootstrap data is loaded
  useEffect(() => {
    const action = state.routeAction
    if (!action || !state.me) return

    const handle = async () => {
      try {
        if (action.type === 'join-group') {
          const data = await joinGroup(action.payload)
          dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
          dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
          toast(`Joined "${data.conversation.title}"!`, 'success')
        } else if (action.type === 'add-friend') {
          const data = await sendFriendRequest({ uuid: action.payload })
          if (data.friend) {
            dispatch({ type: 'ADD_FRIEND', friend: data.friend })
            if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
            toast(`${data.friend.username} added!`, 'success')
          } else if (data.request) {
            dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
            toast('Friend request sent!', 'success')
          }
        }
      } catch (err) {
        toast(err.message, 'error')
      }
      dispatch({ type: 'CLEAR_ROUTE_ACTION' })
      window.history.replaceState({}, '', '/')
    }

    handle()
  }, [state.routeAction, state.me]) // eslint-disable-line

  // Web notifications
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(() => {})
    }
  }, [])

  // Mobile: detect screen width
  const isMobile = window.innerWidth <= 700
  const sidebarHidden = isMobile && state.mobileChatOpen

  if (state.authStatus === 'loading') {
    return (
      <div className="loading-screen" style={{ minHeight: '100vh' }}>
        <div className="spinner spinner-lg" />
        <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>{t('loading')}</span>
      </div>
    )
  }

  if (state.authStatus === 'unauthenticated') {
    return <AuthPage />
  }

  if (state.requiresTotpSetup) {
    return <TotpPage />
  }

  return (
    <div className="app-shell" style={{ height: '100dvh', position: 'relative' }}>
      <SkeumorphicFilters />
      <MessageNotificationBanner />
      <FriendRequestBanner />
      <Sidebar mobileHidden={sidebarHidden} />
      {state.panel === 'admin' ? <AdminPanel /> : <ChatPane />}
      <IncomingCallDialog />
      <CallOverlay />
      <UserProfilePage />
    </div>
  )
}

function SkeumorphicFilters() {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <defs>
        {/* Subtle inner shadow for a "carved" look */}
        <filter id="inner-shadow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="1.5" result="blur" />
          <feOffset dy="1.5" dx="1" />
          <feComposite in2="SourceAlpha" operator="arithmetic" k2="-1" k3="1" result="shadow" />
          <feFlood floodColor="black" floodOpacity="0.4" />
          <feComposite in2="shadow" operator="in" />
          <feComposite in2="SourceGraphic" operator="over" />
        </filter>

        {/* Glossy overlay gradient */}
        <linearGradient id="glossy-grad" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="white" stopOpacity="0.5" />
          <stop offset="50%" stopColor="white" stopOpacity="0.1" />
          <stop offset="51%" stopColor="white" stopOpacity="0" />
          <stop offset="100%" stopColor="white" stopOpacity="0.1" />
        </linearGradient>

        {/* Skeumorphic icon gradient (Blue) */}
        <linearGradient id="icon-grad-blue" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#60A5FA" />
          <stop offset="100%" stopColor="#2563EB" />
        </linearGradient>

        {/* Skeumorphic icon gradient (Red) */}
        <linearGradient id="icon-grad-red" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#F87171" />
          <stop offset="100%" stopColor="#DC2626" />
        </linearGradient>

        {/* Skeumorphic icon gradient (Green) */}
        <linearGradient id="icon-grad-green" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor="#4ADE80" />
          <stop offset="100%" stopColor="#16A34A" />
        </linearGradient>

        {/* Generic depth filter */}
        <filter id="icon-depth" x="-50%" y="-50%" width="200%" height="200%">
          <feDropShadow dx="0" dy="1" stdDeviation="1" floodOpacity="0.3" />
          <feSpecularLighting surfaceScale="2" specularConstant="0.8" specularExponent="20" lightingColor="#white" in="SourceGraphic" result="specOut">
            <fePointLight x="-5000" y="-10000" z="20000" />
          </feSpecularLighting>
          <feComposite in="specOut" in2="SourceAlpha" operator="in" result="specOut" />
          <feComposite in="SourceGraphic" in2="specOut" operator="arithmetic" k1="0" k2="1" k3="1" k4="0" />
        </filter>
      </defs>
    </svg>
  )
}

export default function App() {
  return (
    <AppProvider>
      <ToastContainer />
      <SocketProvider>
        <CallProvider>
          <AppInner />
        </CallProvider>
      </SocketProvider>
    </AppProvider>
  )
}
