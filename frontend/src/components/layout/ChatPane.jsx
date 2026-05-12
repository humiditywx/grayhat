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
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ filter: 'drop-shadow(0 1px 1px rgba(0,0,0,0.2))' }}>
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
            {/* phone.fill */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                fill="currentColor"
                filter="url(#icon-depth)"
              />
            </svg>
          </button>
          <button className="btn-icon" title="Video call" onClick={handleVideoCall}>
            {/* video.fill */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M17 10.5V7a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h12a1 1 0 001-1v-3.5l4 4v-11l-4 4z"
                fill="currentColor"
                filter="url(#icon-depth)"
              />
            </svg>
          </button>
          {!isPrivate && (
            <button className="btn-icon" title="Group info" onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'groupInfoConvId', value: conv.id })}>
              {/* info.circle.fill */}
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path
                  d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </button>
          )}
          {isPrivate && (
            <button className="btn-icon" title="Close chat" style={{ color:'#EF4444' }} onClick={handleLeave}>
              {/* xmark */}
              <svg width="14" height="14" viewBox="0 0 24 24">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
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
