import { useState } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { removeFriend, openPrivate } from '../../api.js'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { MessageCircle, Trash2, UserPlus } from 'lucide-react'

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
        <Button
          type="button"
          size="sm"
          onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
        >
          <UserPlus />
          {t('addFriend')}
        </Button>
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
              <Button type="button" variant="ghost" size="icon" title={t('messagePlaceholder')} onClick={() => openChat(f)}>
                <MessageCircle />
              </Button>
              <Button type="button" variant="ghost" size="icon" onClick={() => remove(f)} className="text-destructive">
                <Trash2 />
              </Button>
            </div>
          </div>
        ))}
      </div>

      {state.addFriendOpen && <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />}
    </div>
  )
}
