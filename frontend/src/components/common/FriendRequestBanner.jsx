import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../../context/SocketContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import Avatar from './Avatar.jsx'
import { acceptFriendRequest, declineFriendRequest } from '../../api.js'
import { Button } from '@/components/ui/button.jsx'
import { Check, X } from 'lucide-react'

export default function FriendRequestBanner() {
  const { on } = useSocket()
  const { dispatch } = useApp()
  const [notification, setNotification] = useState(null) // { request }
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const dismissRef = useRef(null)
  const [busy, setBusy] = useState(false)

  const dismiss = useCallback(() => {
    setVisible(false)
    clearTimeout(dismissRef.current)
    dismissRef.current = setTimeout(() => setNotification(null), 320)
  }, [])

  useEffect(() => {
    return on('friend:request', (data) => {
      const request = data.request
      clearTimeout(timerRef.current)
      clearTimeout(dismissRef.current)
      setNotification({ request })
      setVisible(false)
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      timerRef.current = setTimeout(dismiss, 4500)
    })
  }, [on, dismiss])

  const handleAccept = async () => {
    if (busy || !notification) return
    setBusy(true)
    try {
      const data = await acceptFriendRequest(notification.request.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: notification.request.id })
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: notification.request.id })
      if (data.friend) dispatch({ type: 'ADD_FRIEND', friend: data.friend })
      if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
    } catch {}
    setBusy(false)
    dismiss()
  }

  const handleDecline = async () => {
    if (busy || !notification) return
    setBusy(true)
    try {
      await declineFriendRequest(notification.request.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: notification.request.id })
    } catch {}
    setBusy(false)
    dismiss()
  }

  if (!notification) return null

  const { request } = notification
  const other = request.other_user

  return (
    <div className={`req-notif-banner${visible ? ' visible' : ''}`}>
      <Avatar user={other} size="sm" />
      <div className="msg-notif-info" style={{ flex: 1, minWidth: 0 }}>
        <div className="msg-notif-name" style={{ fontWeight: 700 }}>{other?.username}</div>
        <div className="msg-notif-preview" style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)' }}>
          Sent you a friend request.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          className="text-destructive"
          onClick={handleDecline}
          disabled={busy}
          title="Decline"
        >
          <X />
        </Button>
        <Button
          type="button"
          size="icon-sm"
          onClick={handleAccept}
          disabled={busy}
          title="Accept"
        >
          <Check />
        </Button>
      </div>
    </div>
  )
}
