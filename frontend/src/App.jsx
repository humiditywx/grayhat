import { useEffect, useCallback } from 'react'
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
import { authMe, bootstrap, joinGroup, sendFriendRequest } from './api.js'

function AppInner() {
  const { state, dispatch, toast } = useApp()

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
        <span style={{ color: 'var(--text-3)', fontSize: 'var(--text-sm)' }}>Loading Pentastic…</span>
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
      <MessageNotificationBanner />
      <FriendRequestBanner />
      <Sidebar mobileHidden={sidebarHidden} />
      <ChatPane />
      <IncomingCallDialog />
      <CallOverlay />
      <UserProfilePage />
    </div>
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
