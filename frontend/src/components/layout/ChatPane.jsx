import { useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useCall } from '../../context/CallContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import Avatar from '../common/Avatar.jsx'
import MessageList from '../messages/MessageList.jsx'
import Composer from '../messages/Composer.jsx'
import GroupInfoDialog from '../dialogs/GroupInfoDialog.jsx'
import { leaveConv } from '../../api.js'

function fmtLastSeen(iso) {
  if (!iso) return 'a while ago'
  const diff = Date.now() - new Date(iso)
  if (diff < 60000) return 'just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  const d = new Date(iso)
  const now = new Date()
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  if (d.toDateString() === now.toDateString()) return `today at ${time}`
  const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1)
  if (d.toDateString() === yesterday.toDateString()) return `yesterday at ${time}`
  return `${d.toLocaleDateString([], { month: 'short', day: 'numeric' })} at ${time}`
}

export default function ChatPane() {
  const { state, dispatch, toast } = useApp()
  const { startCall } = useCall()
  const { t } = useLocale()
  const [replyTo, setReplyTo] = useState(null)
  const [sentMessages, setSentMessages] = useState([])

  const conv = state.conversations.find((c) => c.id === state.selectedConvId)
  // Reset reply when conversation changes
  if (replyTo && conv?.id !== replyTo._convId) setReplyTo(null)
  const me = state.me

  if (!conv) {
    return (
      <div className="chat-pane">
        <div className="chat-empty">
          <div className="chat-empty-icon">
            <svg width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
              <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
            </svg>
          </div>
          <h2>GrayHat</h2>
          <p>{t('selectConversation')}</p>
        </div>
      </div>
    )
  }

  const isPrivate = conv.kind === 'private'
  const partner = isPrivate ? conv.partner : null
  const online = partner && state.onlineUsers.has(partner.id)
  const typingList = Object.values(state.typingUsers[conv.id] || {})

  const handleVoiceCall = async () => {
    await startCall(conv.id, 'voice', conv.title, partner?.avatar_url ?? null)
  }

  const handleVideoCall = async () => {
    await startCall(conv.id, 'video', conv.title, partner?.avatar_url ?? null)
  }

  const handleLeave = async () => {
    if (!confirm(t('leaveConfirm', { title: conv.title }))) return
    try {
      await leaveConv(conv.id)
      dispatch({ type: 'REMOVE_CONVERSATION', convId: conv.id })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="chat-pane">
      {/* Header */}
      <div className="chat-header">
        {/* Back button (mobile) */}
        <button
          className="btn-icon chat-back-btn"
          onClick={() => dispatch({ type: 'CLOSE_CHAT' })}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>

        {isPrivate
          ? (
            <div
              style={{ position: 'relative', cursor: 'pointer' }}
              onClick={() => partner && dispatch({ type: 'VIEW_PROFILE', userId: partner.id })}
              title={`View ${partner?.username}'s profile`}
            >
              <Avatar user={partner} size="sm" />
              {online && <span className="online-dot" style={{ position:'absolute',bottom:0,right:0,top:'auto',left:'auto' }} />}
            </div>
          )
          : (
            <div className="avatar avatar-sm" style={{ background:'linear-gradient(135deg,var(--primary-light),var(--primary))',color:'#fff',fontWeight:700,fontSize:14,flexShrink:0 }}>
              {conv.icon_url
                ? <img src={conv.icon_url} alt="" style={{ width:'100%',height:'100%',objectFit:'cover' }} />
                : conv.title?.[0]?.toUpperCase()}
            </div>
          )
        }

        <div
          className="chat-header-info"
          style={isPrivate ? { cursor: 'pointer' } : undefined}
          onClick={isPrivate && partner ? () => dispatch({ type: 'VIEW_PROFILE', userId: partner.id }) : undefined}
        >
          <div className="chat-header-name">{conv.title}</div>
          <div className="chat-header-sub">
            {isPrivate
              ? online
                ? <span style={{ color:'#22C55E' }}>{t('online')}</span>
                : partner?.last_seen_at
                  ? `Last seen ${fmtLastSeen(partner.last_seen_at)}`
                  : t('off')
              : t('members', { n: conv.member_count })
            }
          </div>
        </div>

        <div className="chat-header-actions">
          <button className="btn-icon" title="Voice call" onClick={handleVoiceCall}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
            </svg>
          </button>
          <button className="btn-icon" title="Video call" onClick={handleVideoCall}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polygon points="23 7 16 12 23 17 23 7"/>
              <rect x="1" y="5" width="15" height="14" rx="2" ry="2"/>
            </svg>
          </button>
          {!isPrivate && (
            <button className="btn-icon" title="Group info" onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'groupInfoConvId', value: conv.id })}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
              </svg>
            </button>
          )}
          {isPrivate && (
            <button className="btn-icon" title="Close chat" style={{ color:'#EF4444' }} onClick={handleLeave}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Typing indicator */}
      {typingList.length > 0 && (
        <div className="typing-bar">
          <div className="typing-dots">
            <div className="typing-dot" /><div className="typing-dot" /><div className="typing-dot" />
          </div>
          <span>{typingList.join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing…</span>
        </div>
      )}

      {/* Messages */}
      <MessageList
        conv={conv}
        me={me}
        onReply={(msg) => setReplyTo({ ...msg, _convId: conv.id })}
      />

      {/* Composer */}
      <Composer
        convId={conv.id}
        replyTo={replyTo}
        onCancelReply={() => setReplyTo(null)}
        onSent={(msg) => {
          // Update sidebar preview immediately — don't wait for socket echo
          dispatch({
            type: 'MSG_PREVIEW',
            convId: conv.id,
            createdAt: msg.created_at,
            preview: msg.message_type === 'text'
              ? (msg.body || '').slice(0, 80)
              : msg.message_type === 'voice'
                ? 'Voice message'
                : 'Attachment',
          })
        }}
      />

      {/* Group info modal */}
      {state.groupInfoConvId === conv.id && (
        <GroupInfoDialog
          convId={conv.id}
          onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'groupInfoConvId' })}
        />
      )}

    </div>
  )
}
