import { useState } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from '../../api.js'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function InboxPanel() {
  const { state, dispatch, toast } = useApp()
  const [tab, setTab] = useState('received')
  const [busy, setBusy] = useState(null) // requestId being processed

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
      toast('Request declined.', 'info')
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
      toast('Request cancelled.', 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title">Inbox</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
        >
          + Add Friend
        </button>
      </div>

      {/* Tab pills */}
      <div className="inbox-tabs">
        <button
          className={`inbox-tab-pill${tab === 'received' ? ' active' : ''}`}
          onClick={() => setTab('received')}
        >
          Received {incoming.length > 0 && <span className="inbox-tab-badge">{incoming.length}</span>}
        </button>
        <button
          className={`inbox-tab-pill${tab === 'sent' ? ' active' : ''}`}
          onClick={() => setTab('sent')}
        >
          Sent {outgoing.length > 0 && <span className="inbox-tab-badge">{outgoing.length}</span>}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {tab === 'received' && (
          <>
            {incoming.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
                No pending friend requests.
              </div>
            )}
            {incoming.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">Wants to be your friend · {fmtTime(req.created_at)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <button
                    className="req-action-decline"
                    onClick={() => handleDecline(req)}
                    disabled={busy === req.id}
                    title="Decline"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                    </svg>
                  </button>
                  <button
                    className="req-action-accept"
                    onClick={() => handleAccept(req)}
                    disabled={busy === req.id}
                    title="Accept"
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                      <polyline points="20 6 9 17 4 12"/>
                    </svg>
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
                No sent requests.
              </div>
            )}
            {outgoing.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">Request pending · {fmtTime(req.created_at)}</div>
                </div>
                <button
                  className="btn-icon"
                  onClick={() => handleCancel(req)}
                  disabled={busy === req.id}
                  title="Cancel request"
                  style={{ color: 'var(--text-3)', flexShrink: 0 }}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                  </svg>
                </button>
              </div>
            ))}
          </>
        )}
      </div>

      {state.addFriendOpen && <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />}
    </div>
  )
}
