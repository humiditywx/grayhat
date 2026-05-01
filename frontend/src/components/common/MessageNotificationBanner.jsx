import { useState, useEffect, useRef, useCallback } from 'react'
import { useSocket } from '../../context/SocketContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import Avatar from './Avatar.jsx'
import { Button } from '@/components/ui/button.jsx'
import { X } from 'lucide-react'

export default function MessageNotificationBanner() {
  const { on } = useSocket()
  const { state, dispatch } = useApp()
  const [notification, setNotification] = useState(null) // { msg, conv }
  const [visible, setVisible] = useState(false)
  const timerRef = useRef(null)
  const dismissRef = useRef(null)
  const convsRef = useRef([])

  useEffect(() => { convsRef.current = state.conversations }, [state.conversations])

  const dismiss = useCallback(() => {
    setVisible(false)
    clearTimeout(dismissRef.current)
    dismissRef.current = setTimeout(() => setNotification(null), 320)
  }, [])

  useEffect(() => {
    return on('message:new:background', (msg) => {
      const conv = convsRef.current.find((c) => c.id === msg.conversation_id)
      clearTimeout(timerRef.current)
      clearTimeout(dismissRef.current)
      setNotification({ msg, conv })
      setVisible(false)
      // tiny delay so slide-in re-triggers when replacing a notification
      requestAnimationFrame(() => requestAnimationFrame(() => setVisible(true)))
      timerRef.current = setTimeout(dismiss, 4500)
    })
  }, [on, dismiss])

  if (!notification) return null

  const { msg, conv } = notification
  const sender = msg.sender
  const isGroup = conv?.kind === 'group'
  const preview = msg.message_type === 'text'
    ? (msg.body || '').slice(0, 60)
    : msg.message_type === 'voice' ? '🎙 Voice message' : '📎 Attachment'

  const handleReply = () => {
    dispatch({ type: 'SELECT_CONV', convId: msg.conversation_id })
    dismiss()
  }

  return (
    <div className={`msg-notif-banner${visible ? ' visible' : ''}`} onClick={handleReply}>
      <Avatar user={sender} size="sm" />
      <div className="msg-notif-info">
        <div className="msg-notif-name">
          {sender?.username}
          {isGroup && conv?.title && <span className="msg-notif-group"> · {conv.title}</span>}
        </div>
        <div className="msg-notif-preview">{preview}</div>
      </div>
      <Button
        type="button"
        size="sm"
        className="msg-notif-reply"
        onClick={(e) => { e.stopPropagation(); handleReply() }}
      >
        Reply
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-xs"
        className="msg-notif-close"
        onClick={(e) => { e.stopPropagation(); dismiss() }}
      >
        <X />
      </Button>
    </div>
  )
}
