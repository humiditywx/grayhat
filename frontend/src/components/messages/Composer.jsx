import { useState, useRef, useCallback } from 'react'
import { sendMessage, sendAttachment } from '../../api.js'
import { useSocket } from '../../context/SocketContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Mic, Paperclip, Send, Upload, X } from 'lucide-react'

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
          <Button type="button" variant="ghost" size="icon-xs" onClick={onCancelReply}>
            <X />
          </Button>
        </div>
      )}

      {file && (
        <div className="file-preview-bar">
          <Upload size={14} />
          <span className="file-preview-name">{file.name}</span>
          <Button type="button" variant="ghost" size="icon-xs" onClick={clearFile}>
            <X />
          </Button>
        </div>
      )}

      <div className="composer-row">
        <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => setFile(e.target.files[0] || null)} />
        <Button type="button" variant="ghost" size="icon" title="Attach file" onClick={() => fileInputRef.current?.click()}>
          <Paperclip />
        </Button>

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
          <Button
            className={`voice-rec-btn${recording ? ' recording' : ''}`}
            type="button"
            onPointerDown={startRecording}
            onPointerUp={recording ? stopRecording : undefined}
            title={recording ? t('releaseToSend') : t('holdToRecord')}
          >
            <Mic />
          </Button>
        </div>

        <Button className="send-btn" type="button" onClick={send} disabled={busy || (!text.trim() && !file)}>
          <Send />
        </Button>
      </div>
    </div>
  )
}
