import { useState, useRef, useEffect } from 'react'
import Modal from '../common/Modal.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { sendFriendRequest, scanQrImage } from '../../api.js'
import { useSounds } from '../../hooks/useSounds.js'

export default function AddFriendDialog({ onClose }) {
  const { state, dispatch, toast } = useApp()
  const { play } = useSounds()
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
      {tab === 'uuid'  && <AddByUUID dispatch={dispatch} toast={toast} play={play} onClose={onClose} />}
      {tab === 'image' && <ScanImage  dispatch={dispatch} toast={toast} play={play} onClose={onClose} />}
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

function AddByUUID({ dispatch, toast, play, onClose }) {
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
        play('friendAdded')
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

function ScanCamera({ dispatch, toast, play, onClose }) {
  const videoRef = useRef(null)
  const streamRef = useRef(null)
  const rafRef = useRef(null)
  const [scanning, setScanning] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      .then((stream) => {
        if (!active) { stream.getTracks().forEach((t) => t.stop()); return }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.onplay = () => {
            if (!active) return
            setScanning(true)
            scan()
          }
        }
      })
      .catch(() => setError('Camera access denied.'))

    async function scan() {
      if (!('BarcodeDetector' in window)) { setError('QR scanning not supported in this browser.'); return }
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const loop = async () => {
        if (!active || !videoRef.current) return
        try {
          const codes = await detector.detect(videoRef.current)
          if (codes.length) {
            const val = codes[0].rawValue
            active = false
            play('qrScanSuccess')
            addByValue(val, dispatch, toast, onClose)
            return
          }
        } catch {}
        rafRef.current = requestAnimationFrame(loop)
      }
      rafRef.current = requestAnimationFrame(loop)
    }

    return () => {
      active = false
      cancelAnimationFrame(rafRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, []) // eslint-disable-line

  if (error) return <div style={{ color: 'var(--text-2)', fontSize: 'var(--text-sm)', textAlign: 'center', padding: 20 }}>{error}</div>

  return (
    <div className="scanner-wrap">
      <video ref={videoRef} className="scanner-video" autoPlay playsInline muted />
      <div className="scanner-viewfinder">
        <div className="scanner-box" />
      </div>
      {scanning && <div style={{ position: 'absolute', bottom: 12, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,.8)', fontSize: 'var(--text-xs)' }}>Point at a QR code</div>}
    </div>
  )
}

function ScanImage({ dispatch, toast, play, onClose }) {
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await scanQrImage(fd)
      play('qrScanSuccess')
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
