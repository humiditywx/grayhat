import { useState, useRef, useEffect, useCallback } from 'react'
import Avatar from '../common/Avatar.jsx'
import { editMessage, deleteMessage, reactMessage } from '../../api.js'
import { Button } from '@/components/ui/button.jsx'
import { Textarea } from '@/components/ui/textarea.jsx'
import { Edit3, FileText, Heart, Pause, Play, Trash2 } from 'lucide-react'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function VoicePlayer({ url, isMine }) {
  const audioRef = useRef(null)
  const [playing, setPlaying] = useState(false)
  const [progress, setProgress] = useState(0)
  const [duration, setDuration] = useState(0)
  const BARS = 24

  useEffect(() => {
    const a = new Audio(url)
    audioRef.current = a
    a.preload = 'metadata'
    a.addEventListener('loadedmetadata', () => setDuration(a.duration || 0))
    a.addEventListener('timeupdate', () => setProgress(a.duration ? a.currentTime / a.duration : 0))
    a.addEventListener('ended', () => { setPlaying(false); setProgress(0) })
    return () => { a.pause(); a.src = '' }
  }, [url])

  const toggle = () => {
    const a = audioRef.current
    if (!a) return
    if (playing) { a.pause(); setPlaying(false) }
    else { a.play().catch(() => {}); setPlaying(true) }
  }

  const fmt = (s) => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, '0')}` }

  return (
    <div className="voice-player">
      <Button className="vp-play-btn" onClick={toggle} type="button">
        {playing ? <Pause size={14} fill="currentColor" /> : <Play size={14} fill="currentColor" />}
      </Button>
      <div className="vp-bars">
        {Array.from({ length: BARS }).map((_, i) => (
          <div key={i} className={`vp-bar${i / BARS <= progress ? ' played' : ''}`} style={{ height: `${30 + Math.sin(i * 0.7) * 16}%` }} />
        ))}
      </div>
      <span className="vp-time">{fmt(audioRef.current?.currentTime || 0) || fmt(duration)}</span>
    </div>
  )
}

function AttachmentView({ att, isMine }) {
  if (!att) return null
  if (['image'].includes(att.kind)) {
    return (
      <div className="msg-media">
        <img src={att.url} alt={att.name} loading="lazy" onClick={() => window.open(att.url, '_blank')} />
        {att.name && <div style={{ fontSize: 'var(--text-xs)', padding: '4px 6px', color: isMine ? 'rgba(255,255,255,.7)' : 'var(--text-3)' }}>{att.name}</div>}
      </div>
    )
  }
  if (['video'].includes(att.kind)) {
    return (
      <div className="msg-media">
        <video src={att.url} controls preload="metadata" />
      </div>
    )
  }
  return (
    <a className="msg-file" href={att.url} download={att.name} target="_blank" rel="noreferrer">
      <FileText size={24} />
      <div className="msg-file-info">
        <div className="msg-file-name">{att.name}</div>
        <div className="msg-file-size">{fmtSize(att.size_bytes)}</div>
      </div>
    </a>
  )
}

export default function MessageBubble({ msg, isMine, isGroup, onUpdated, onDeleted, onReply }) {
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')
  const [busy, setBusy] = useState(false)
  const [swipeX, setSwipeX] = useState(0)
  const touchStartX = useRef(null)
  const touchStartY = useRef(null)
  const isDeleted = !!msg.deleted_at
  const hearts = msg.extra?.hearts || []
  const replyTo = msg.extra?.reply_to
  const storyReply = msg.extra?.story_reply  // { story_id, author_username, media_url, media_type }

  const onTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX
    touchStartY.current = e.touches[0].clientY
  }
  const onTouchMove = (e) => {
    if (touchStartX.current === null) return
    const dx = e.touches[0].clientX - touchStartX.current
    const dy = Math.abs(e.touches[0].clientY - touchStartY.current)
    if (dy > 12) return // vertical scroll, ignore
    // Right swipe on others' messages, left swipe on mine
    const trigger = isMine ? dx < 0 : dx > 0
    if (trigger) setSwipeX(Math.min(Math.abs(dx), 60))
  }
  const onTouchEnd = () => {
    if (swipeX >= 48) onReply?.(msg)
    setSwipeX(0)
    touchStartX.current = null
  }

  const startEdit = () => { setEditVal(msg.body || ''); setEditing(true) }

  const saveEdit = async () => {
    if (!editVal.trim()) return
    setBusy(true)
    try {
      const data = await editMessage(msg.id, editVal.trim())
      onUpdated?.(data.message)
      setEditing(false)
    } catch {}
    setBusy(false)
  }

  const doDelete = async () => {
    if (!confirm('Delete this message?')) return
    try { const data = await deleteMessage(msg.id); onDeleted?.(data.message) } catch {}
  }

  const doReact = async () => {
    try { const data = await reactMessage(msg.id); onUpdated?.(data.message) } catch {}
  }

  const isVoice = msg.message_type === 'voice'
  const voiceAtt = isVoice ? msg.attachments?.[0] : null

  const swipeStyle = swipeX > 0 ? {
    transform: `translateX(${isMine ? -swipeX : swipeX}px)`,
    transition: swipeX === 0 ? 'transform .2s' : 'none',
  } : {}

  return (
    <div
      className={`msg-row${isMine ? ' mine' : ''}`}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      style={swipeStyle}
    >
      {!isMine && isGroup && <div className="msg-avatar"><Avatar user={msg.sender} size="xs" /></div>}
      <div className="msg-body">
        {!isMine && isGroup && (
          <div className="msg-sender-name">{msg.sender?.username}</div>
        )}

        {/* Reply-to reference */}
        {replyTo && (
          <div className={`msg-reply-ref${isMine ? ' mine' : ''}`}>
            <span className="msg-reply-ref-name">{replyTo.sender_name}</span>
            <span className="msg-reply-ref-text">{(replyTo.body || replyTo.message_type || '').slice(0, 60)}</span>
          </div>
        )}

        {/* Story reply banner */}
        {storyReply && (
          <div className={`msg-story-reply${isMine ? ' mine' : ''}`}>
            {storyReply.media_type === 'image' && (
              <img src={storyReply.media_url} alt="story" className="msg-story-reply-thumb" />
            )}
            <div className="msg-story-reply-label">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" style={{ flexShrink: 0 }}>
                <polygon points="5 3 19 12 5 21 5 3"/>
              </svg>
              Replied to {storyReply.author_username}'s story
            </div>
          </div>
        )}

        {/* Main bubble or attachment */}
        {isVoice && voiceAtt
          ? <VoicePlayer url={voiceAtt.url} isMine={isMine} />
          : (
            <div className={`msg-bubble${isDeleted ? ' deleted' : ''}`}>
              {isDeleted
                ? (
                  <span className="msg-deleted-body">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" style={{ flexShrink: 0 }}>
                      <circle cx="12" cy="12" r="10"/>
                      <line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/>
                    </svg>
                    Message deleted
                  </span>
                )
                : (
                  <>
                    {msg.body && (
                      editing
                        ? (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                            <Textarea
                              value={editVal}
                              onChange={(e) => setEditVal(e.target.value)}
                              rows={2}
                              style={{ resize: 'none', color: 'var(--text)', background: 'var(--surface)' }}
                              autoFocus
                            />
                            <div style={{ display: 'flex', gap: 6 }}>
                              <Button type="button" size="sm" onClick={saveEdit} disabled={busy}>Save</Button>
                              <Button type="button" variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
                            </div>
                          </div>
                        )
                        : <span style={{ whiteSpace: 'pre-wrap' }}>{msg.body}</span>
                    )}
                    {!isDeleted && msg.attachments?.map((att) => (
                      att.kind !== 'voice' && <AttachmentView key={att.id} att={att} isMine={isMine} />
                    ))}
                  </>
                )
              }
            </div>
          )
        }

        {/* Reactions */}
        {hearts.length > 0 && (
          <div className="msg-reactions">
            <Button type="button" variant="ghost" size="xs" className="msg-reaction-btn" onClick={doReact}>
              <Heart fill="currentColor" /> {hearts.length}
            </Button>
          </div>
        )}

        {/* Meta row */}
        <div className="msg-meta">
          <span>{fmtTime(msg.created_at)}</span>
          {msg.edited_at && <span className="msg-edited">edited</span>}
          {isMine && <ReadTick msg={msg} />}
        </div>

        {/* Action row (hover) */}
        {!isDeleted && !editing && (
          <div className="msg-action-row">
            {hearts.length === 0 && (
              <Button type="button" variant="ghost" size="xs" className="msg-action-btn" onClick={doReact}>
                <Heart />
              </Button>
            )}
            {isMine && msg.message_type === 'text' && (
              <Button type="button" variant="ghost" size="xs" className="msg-action-btn" onClick={startEdit}>
                <Edit3 /> Edit
              </Button>
            )}
            {isMine && (
              <Button type="button" variant="ghost" size="xs" className="msg-action-btn danger" onClick={doDelete}>
                <Trash2 /> Delete
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function ReadTick({ msg }) {
  return (
    <svg className="msg-tick" width="16" height="12" viewBox="0 0 16 12" fill="none">
      <path d="M1 6l4 4L15 1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M5 6l4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}
