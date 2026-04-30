import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { sendFriendRequest, scanQrImage } from '../../api.js'

export default function AddFriendDialog({ onClose }) {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()
  const [tab, setTab] = useState('qr')

  return (
    <Modal title={t('addFriendTitle')} onClose={onClose}>
      <div className="tab-pills">
        {['qr', 'uuid', 'image'].map((v) => (
          <button key={v} className={`tab-pill${tab === v ? ' active' : ''}`} onClick={() => setTab(v)}>
            {v === 'qr' ? t('myQr') : v === 'uuid' ? t('addByUuid') : t('scanImage')}
          </button>
        ))}
      </div>

      {tab === 'qr'    && <MyQR me={state.me} myAddLink={state.myAddLink} t={t} />}
      {tab === 'uuid'  && <AddByUUID dispatch={dispatch} toast={toast} onClose={onClose} t={t} />}
      {tab === 'image' && <ScanImage  dispatch={dispatch} toast={toast} onClose={onClose} t={t} />}
    </Modal>
  )
}

function MyQR({ me, myAddLink, t }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
      <div className="qr-display">
        <img src="/api/users/me/qr.png" alt="My QR code" />
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center' }}>
        {t('qrScanHint')}
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

function AddByUUID({ dispatch, toast, onClose, t }) {
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
        <label className="field-label">{t('uuidOrLink')}</label>
        <input className="field-input" value={val} onChange={(e) => setVal(e.target.value)} placeholder={t('pasteUuidPlaceholder')} autoFocus />
      </div>
      <button className="btn btn-primary" disabled={busy || !val.trim()}>
        {busy ? t('adding') : t('addFriendTitle')}
      </button>
    </form>
  )
}

function ScanImage({ dispatch, toast, onClose, t }) {
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
          {busy ? t('scanning') : t('chooseQrImage')}
        </div>
        <input type="file" accept="image/*" style={{ display: 'none' }} onChange={pick} disabled={busy} />
      </label>
    </div>
  )
}
