import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { sendFriendRequest, scanQrImage } from '../../api.js'

export default function AddFriendDialog({ onClose }) {
  const { state, dispatch, toast } = useApp()
  const [tab, setTab] = useState('qr')

  return (
    <Modal title="Add Friend" onClose={onClose}>
      <div className="tab-pills">
        {['qr', 'uuid', 'image'].map((t) => (
          <button key={t} className={`tab-pill${tab === t ? ' active' : ''}`} onClick={() => setTab(t)}>
            {t === 'qr' ? 'My QR' : t === 'uuid' ? 'Add by UUID' : 'Scan Image'}
          </button>
        ))}
      </div>

      {tab === 'qr'    && <MyQR me={state.me} myAddLink={state.myAddLink} />}
      {tab === 'uuid'  && <AddByUUID dispatch={dispatch} toast={toast} onClose={onClose} />}
      {tab === 'image' && <ScanImage  dispatch={dispatch} toast={toast} onClose={onClose} />}
    </Modal>
  )
}

function MyQR({ me, myAddLink }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="qr-display">
        <img src="/api/users/me/qr.png" alt="My QR code" />
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center' }}>
        Friends can scan this QR code to add you.
      </p>
      <div className="uuid-display" onClick={() => navigator.clipboard.writeText(me?.id || '')}>
        {me?.id}
      </div>
      {myAddLink && (
        <div className="uuid-display" onClick={() => navigator.clipboard.writeText(myAddLink)} style={{ fontSize: 'var(--text-xs)' }}>
          {myAddLink}
        </div>
      )}
    </div>
  )
}

function AddByUUID({ dispatch, toast, onClose }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!val.trim()) return
    setBusy(true)
    try {
      const data = await sendFriendRequest({ uuid: val.trim() })
      if (data.friend) {
        dispatch({ type: 'ADD_FRIEND', friend: data.friend })
        if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
        toast(`${data.friend.username} added!`, 'success')
      } else if (data.request) {
        dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
        toast('Friend request sent!', 'success')
      }
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="field">
        <label className="field-label">UUID or invite link</label>
        <input className="field-input" value={val} onChange={(e) => setVal(e.target.value)} placeholder="Paste UUID or https://…" autoFocus />
      </div>
      <button className="btn btn-primary" disabled={busy || !val.trim()}>
        {busy ? 'Adding…' : 'Add Friend'}
      </button>
    </form>
  )
}

function ScanImage({ dispatch, toast, onClose }) {
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await scanQrImage(fd)
      if (data.friend) {
        dispatch({ type: 'ADD_FRIEND', friend: data.friend })
        if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
        toast(`${data.friend.username} added!`, 'success')
      } else if (data.request) {
        dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
        toast('Friend request sent!', 'success')
      }
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div style={{ textAlign: 'center', padding: 12 }}>
      <label style={{ cursor: 'pointer' }}>
        <div className="btn btn-outline" style={{ display: 'inline-flex' }}>
          {busy ? 'Scanning…' : 'Choose QR image'}
        </div>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} disabled={busy} />
      </label>
    </div>
  )
}

async function addByValue(val, dispatch, toast, onClose) {
  try {
    const data = await sendFriendRequest({ uuid: val })
    if (data.friend) {
      dispatch({ type: 'ADD_FRIEND', friend: data.friend })
      if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      toast(`${data.friend.username} added!`, 'success')
    } else if (data.request) {
      dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
      toast('Friend request sent!', 'success')
    }
    onClose()
  } catch (err) {
    toast(err.message, 'error')
  }
}
