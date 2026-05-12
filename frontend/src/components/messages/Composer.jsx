import { useState, useRef, useCallback } from 'react'
import { sendMessage, sendAttachment } from '../../api.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { useLocale } from '../../i18n/index.jsx'

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
          <button className="reply-preview-cancel" onClick={onCancelReply}>✕</button>
        </div>
      )}

      {file && (
        <div className="file-preview-bar">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          <span className="file-preview-name">{file.name}</span>
          <button onClick={clearFile} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--primary)', padding:'2px' }}>✕</button>
        </div>
      )}

      <div className="composer-row">
        <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={(e) => setFile(e.target.files[0] || null)} />
        <button className="btn-icon" type="button" title="Attach file" onClick={() => fileInputRef.current?.click()}>
          {/* paperclip.fill */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M16.5 6.5v10.25a4.75 4.75 0 01-9.5 0V5a3.25 3.25 0 016.5 0v9.75a1.75 1.75 0 01-3.5 0V7h-1.5v7.75a3.25 3.25 0 006.5 0V5a4.75 4.75 0 00-9.5 0v11.75a6.25 6.25 0 0012.5 0V6.5h-1.5z"
              fill="currentColor"
              filter="url(#icon-depth)"
            />
          </svg>
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
            {/* mic.fill */}
            <svg width="18" height="18" viewBox="0 0 24 24">
              <path
                d="M12 14a3 3 0 003-3V5a3 3 0 00-6 0v6a3 3 0 003 3zm5-3a5 5 0 01-10 0H5a7 7 0 006 6.93V21H9v2h6v-2h-2v-3.07A7 7 0 0019 11h-2z"
                fill="currentColor"
                filter="url(#icon-depth)"
              />
            </svg>
          </button>
        </div>

        <button className="send-btn" type="button" onClick={send} disabled={busy || (!text.trim() && !file)}>
          {/* paperplane.fill */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"
              fill="#fff"
              filter="url(#icon-depth)"
            />
          </svg>
        </button>
      </div>
    </div>
  )
}
