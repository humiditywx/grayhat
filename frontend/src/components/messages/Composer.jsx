import { useState, useRef, useCallback } from 'react'
import { sendMessage, sendAttachment } from '../../api.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import AeroIcon from '../icons/AeroIcon.jsx'

export default function Composer({ convId, replyTo, onCancelReply, onSent }) {
  const [text, setText] = useState('')
  const [file, setFile] = useState(null)
  const [recording, setRecording] = useState(false)
  const [busy, setSending] = useState(false)
  const textareaRef = useRef(null)
  const fileInputRef = useRef(null)
  const recorderRef = useRef(null)
  const chunksRef = useRef([])
  const typingTimerRef = useRef(null)
  const { startTyping, stopTyping } = useSocket()
  const { t } = useLocale()

  const autoResize = () => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = Math.min(el.scrollHeight, 120) + 'px'
  }

  const handleTextChange = (e) => {
    setText(e.target.value)
    autoResize()
    clearTimeout(typingTimerRef.current)
    startTyping(convId)
    typingTimerRef.current = setTimeout(() => stopTyping(convId), 2500)
  }

  const clearFile = () => {
    setFile(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const send = useCallback(async () => {
    if (busy) return
    const body = text.trim()
    if (!body && !file) return

    setSending(true)
    stopTyping(convId)

    try {
      let result
      if (file) {
        const fd = new FormData()
        fd.append('file', file)
        if (body) fd.append('body', body)
        if (replyTo) fd.append('reply_to_id', replyTo.id)
        result = await sendAttachment(convId, fd)
      } else {
        result = await sendMessage(convId, body, replyTo?.id)
      }
      setText('')
      setFile(null)
      onCancelReply?.()
      if (fileInputRef.current) fileInputRef.current.value = ''
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
      // Optimistically add the message if socket echo isn't reliable
      if (result?.message) onSent?.(result.message)
    } catch (err) {
      alert(err.message)
    } finally {
      setSending(false)
    }
  }, [busy, text, file, convId, replyTo, stopTyping, onCancelReply, onSent])

  const handleKey = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream)
      chunksRef.current = []
      mr.ondataavailable = (e) => chunksRef.current.push(e.data)
      mr.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const fd = new FormData()
        fd.append('file', blob, 'voice.webm')
        fd.append('message_type', 'voice')
        if (replyTo) fd.append('reply_to_id', replyTo.id)
        try {
          const result = await sendAttachment(convId, fd)
          if (result?.message) onSent?.(result.message)
        } catch (err) {
          alert(err.message)
        }
        setRecording(false)
        onCancelReply?.()
      }
      mr.start()
      recorderRef.current = mr
      setRecording(true)
    } catch {
      alert('Could not access microphone.')
    }
  }

  const stopRecording = () => {
    recorderRef.current?.stop()
  }

  const replyPreview = replyTo
    ? (replyTo.message_type === 'text' ? replyTo.body : replyTo.message_type === 'voice' ? t('voiceMessage') : t('attachment'))
    : null

  return (
    <div className="composer">
      {/* Reply preview */}
      {replyTo && (
        <div className="reply-preview-bar">
          <div className="reply-preview-content">
            <span className="reply-preview-name">{replyTo.sender?.username}</span>
            <span className="reply-preview-text">{(replyPreview || '').slice(0, 80)}</span>
          </div>
          <button className="reply-preview-cancel" onClick={onCancelReply}>
            <AeroIcon name="close" size={13} variant="glyph" />
          </button>
        </div>
      )}

      {file && (
        <div className="file-preview-bar">
          <AeroIcon name="upload" size={14} variant="glyph" />
          <span className="file-preview-name">{file.name}</span>
          <button onClick={clearFile} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--primary)', padding:'2px' }}>
            <AeroIcon name="close" size={13} variant="glyph" />
          </button>
        </div>
      )}

      <div className="composer-row">
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0] || null)} />
        <button className="btn-icon" type="button" title="Attach file" onClick={() => fileInputRef.current?.click()}>
          <AeroIcon name="attach" size={20} />
        </button>

        <div className="composer-textarea-wrap">
          <textarea
            ref={textareaRef}
            className="composer-textarea"
            placeholder={t('messagePlaceholder')}
            value={text}
            onChange={handleTextChange}
            onKeyDown={handleKey}
            rows={1}
          />
          <button
            className={`voice-rec-btn${recording ? ' recording' : ''}`}
            type="button"
            onPointerDown={startRecording}
            onPointerUp={recording ? stopRecording : undefined}
            title={recording ? t('releaseToSend') : t('holdToRecord')}
          >
            <AeroIcon name="mic" size={18} variant={recording ? 'tile' : 'glyph'} />
          </button>
        </div>

        <button className="send-btn" type="button" onClick={send} disabled={busy || (!text.trim() && !file)}>
          <AeroIcon name="send" size={22} variant="glyph" />
        </button>
      </div>
    </div>
  )
}
