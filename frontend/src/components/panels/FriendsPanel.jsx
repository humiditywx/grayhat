import { useState } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { removeFriend, openPrivate } from '../../api.js'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'

function fmtLastSeen(iso, t) {
  if (!iso) return t('neverSeen')
  const d = new Date(iso)
  const diff = Date.now() - d
  if (diff < 60000) return t('justNow')
  if (diff < 3600000) return t('minutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('hoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString()
}

export default function FriendsPanel() {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()

  const openChat = async (friend) => {
    try {
      const data = await openPrivate(friend.id)
      dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const remove = async (friend) => {
    if (!confirm(t('removeConfirm', { name: friend.username }))) return
    try {
      await removeFriend(friend.id)
      dispatch({ type: 'REMOVE_FRIEND', friendId: friend.id })
      toast(t('friendRemoved'), 'info')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title">{t('friendsTitle')}</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
        >
          {t('addFriend')}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {state.friends.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
            {t('noFriendsLine1')}<br />{t('noFriendsLine2')}
          </div>
        )}
        {state.friends.map((f) => (
          <div key={f.id} className="friend-item">
            <div style={{ position: 'relative' }}>
              <Avatar user={f} size="md" />
              {state.onlineUsers.has(f.id) && <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0, top: 'auto', left: 'auto' }} />}
            </div>
            <div className="friend-item-info" style={{ cursor: 'pointer' }} onClick={() => openChat(f)}>
              <div className="friend-name">{f.username}</div>
              <div className="friend-last-seen">
                {state.onlineUsers.has(f.id)
                  ? <span style={{ color: '#22C55E' }}>● {t('online')}</span>
                  : t('lastSeen', { time: fmtLastSeen(f.last_seen_at, t) })}
              </div>
            </div>
            <div className="friend-actions">
              <button className="btn-icon" title={t('messagePlaceholder')} onClick={() => openChat(f)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </button>
              <button className="btn-icon" onClick={() => remove(f)} style={{ color: '#EF4444' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.addFriendOpen && <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />}
    </div>
  )
}
