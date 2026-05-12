import { useState } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from '../../api.js'
import AeroIcon from '../icons/AeroIcon.jsx'

function fmtTime(iso, t) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d
  if (diff < 60000) return t('justNow')
  if (diff < 3600000) return t('minutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('hoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString()
}

export default function InboxPanel({ hideHeader = false }) {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()
  const [tab, setTab] = useState('received')
  const [busy, setBusy] = useState(null)

  const incoming = state.friendRequests?.incoming || []
  const outgoing = state.friendRequests?.outgoing || []

  const handleAccept = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      const data = await acceptFriendRequest(req.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: req.id })
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: req.id })
      if (data.friend) dispatch({ type: 'ADD_FRIEND', friend: data.friend })
      if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      toast(`You are now friends with ${req.other_user.username}!`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDecline = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      await declineFriendRequest(req.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: req.id })
      toast(t('requestDeclined'), 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      await cancelFriendRequest(req.id)
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: req.id })
      toast(t('requestCancelled'), 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {!hideHeader && (
        <div className="panel-header">
          <span className="panel-title">{t('inboxTitle')}</span>
          <button
            className="btn btn-primary btn-sm"
            onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
          >
            {t('addFriend')}
          </button>
        </div>
      )}

      <div className="inbox-tabs">
        <button
          className={`inbox-tab-pill${tab === 'received' ? ' active' : ''}`}
          onClick={() => setTab('received')}
        >
          {t('received')} {incoming.length > 0 && <span className="inbox-tab-badge">{incoming.length}</span>}
        </button>
        <button
          className={`inbox-tab-pill${tab === 'sent' ? ' active' : ''}`}
          onClick={() => setTab('sent')}
        >
          {t('sent')} {outgoing.length > 0 && <span className="inbox-tab-badge">{outgoing.length}</span>}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'received' && (
          <>
            {incoming.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
                {t('noPendingRequests')}
              </div>
            )}
            {incoming.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">{t('wantsFriend')} · {fmtTime(req.created_at, t)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="req-action-decline"
                    onClick={() => handleDecline(req)}
                    disabled={busy === req.id}
                  >
                    <AeroIcon name="close" size={15} />
                  </button>
                  <button
                    className="req-action-accept"
                    onClick={() => handleAccept(req)}
                    disabled={busy === req.id}
                  >
                    <AeroIcon name="check" size={15} />
                  </button>
                </div>
              </div>
            ))}
          </>
        )}

        {tab === 'sent' && (
          <>
            {outgoing.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
                {t('noSentRequests')}
              </div>
            )}
            {outgoing.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">{t('requestPending')} · {fmtTime(req.created_at, t)}</div>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleCancel(req)}
                  disabled={busy === req.id}
                  style={{ color: 'var(--text-3)', flexShrink: 0 }}
                >
                  <AeroIcon name="close" size={16} />
                </button>
              </div>
            ))}
          </>
        )}
      </div>

    </div>
  )
}
