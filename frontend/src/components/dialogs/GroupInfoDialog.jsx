import { useState, useEffect, useRef } from 'react'
import Modal from '../common/Modal.jsx'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { getMembers, addMember, leaveConv, uploadGroupIcon } from '../../api.js'

export default function GroupInfoDialog({ convId, onClose }) {
  const { state, dispatch, toast } = useApp()
  const conv = state.conversations.find((c) => c.id === convId)
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [addVal, setAddVal] = useState('')
  const [busy, setBusy] = useState(false)
  const iconRef = useRef(null)
  const me = state.me

  useEffect(() => {
    getMembers(convId)
      .then((d) => setMembers(d.members || []))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [convId])

  const doAddMember = async () => {
    if (!addVal.trim()) return
    setBusy(true)
    try {
      const data = await addMember(convId, { identifier: addVal.trim() })
      setMembers((prev) => [...prev, data.member])
      setAddVal('')
      toast('Member added!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const doLeave = async () => {
    if (!confirm('Leave this group?')) return
    try {
      await leaveConv(convId)
      dispatch({ type: 'REMOVE_CONVERSATION', convId })
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const uploadIcon = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('icon', file)
    try {
      await uploadGroupIcon(convId, fd)
      dispatch({ type: 'UPDATE_CONVERSATION', conv: { id: convId, icon_url: `/api/conversations/${convId}/icon?t=${Date.now()}` } })
      toast('Group icon updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const myRole = conv?.me_role
  const isOwnerOrAdmin = myRole === 'owner' || myRole === 'admin'

  return (
    <Modal title={conv?.title || 'Group Info'} onClose={onClose}>
      {/* Icon */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <div
          className="avatar avatar-lg"
          style={{ cursor: isOwnerOrAdmin ? 'pointer' : 'default' }}
          onClick={() => isOwnerOrAdmin && iconRef.current?.click()}
        >
          {conv?.icon_url
            ? <img src={conv.icon_url} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            : conv?.title?.[0]?.toUpperCase()}
        </div>
        {isOwnerOrAdmin && <input ref={iconRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={uploadIcon} />}
        <div>
          <div style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>{conv?.title}</div>
          {conv?.description && <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>{conv.description}</div>}
          {conv?.share_url && (
            <>
              <button
                className="btn btn-ghost btn-sm"
                style={{ marginTop: 4, padding: '4px 8px' }}
                onClick={() => navigator.clipboard.writeText(conv.share_url).then(() => toast('Invite link copied!', 'success'))}
              >
                Copy invite link
              </button>
            </>
          )}
        </div>
      </div>

      {/* Group QR code */}
      {conv?.share_url && (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, marginBottom: 20 }}>
          <div className="qr-display">
            <img src={`/api/conversations/${convId}/qr.png`} alt="Group invite QR" />
          </div>
          <p style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', textAlign: 'center' }}>
            Members can scan this to join the group
          </p>
        </div>
      )}

      {/* Members */}
      <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text-2)', marginBottom: 10 }}>
        Members ({members.length})
      </div>
      {loading ? <div className="spinner" style={{ margin: '8px auto' }} /> : (
        <div style={{ maxHeight: 240, overflowY: 'auto', marginBottom: 16 }}>
          {members.map((m) => (
            <div
              key={m.user_id}
              className="member-row"
              style={{ cursor: 'pointer' }}
              onClick={() => dispatch({ type: 'VIEW_PROFILE', userId: m.id ?? m.user_id })}
            >
              <Avatar user={m} size="sm" />
              <div className="member-row-info">
                <div className="member-name">{m.username}</div>
              </div>
              <span className={`member-role${m.role === 'member' ? ' member' : ''}`}>{m.role}</span>
            </div>
          ))}
        </div>
      )}

      {/* Add member */}
      {isOwnerOrAdmin && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          <input
            className="field-input"
            style={{ flex: 1 }}
            placeholder="Add by username or UUID"
            value={addVal}
            onChange={(e) => setAddVal(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doAddMember()}
          />
          <button className="btn btn-primary btn-sm" onClick={doAddMember} disabled={busy || !addVal.trim()}>Add</button>
        </div>
      )}

      <button className="btn btn-danger" style={{ width: '100%' }} onClick={doLeave}>
        Leave Group
      </button>
    </Modal>
  )
}
