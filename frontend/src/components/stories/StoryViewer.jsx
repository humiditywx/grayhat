import { useState, useEffect, useRef, useCallback } from 'react'
import Avatar from '../common/Avatar.jsx'
import { deleteStory, replyStory, viewStory, getStoryViews } from '../../api.js'
import { useApp } from '../../context/AppContext.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Eye, Send, Trash2, X } from 'lucide-react'

const STORY_DURATION = 5000

export default function StoryViewer({ initialGroupIndex, onClose }) {
  const { state, dispatch, toast } = useApp()
  const [groupIndex, setGroupIndex] = useState(initialGroupIndex)
  const [storyIndex, setStoryIndex] = useState(0)
  const [progress, setProgress] = useState(0)
  const [reply, setReply] = useState('')
  const [dragY, setDragY] = useState(0)
  const [closing, setClosing] = useState(false)
  const [viewers, setViewers] = useState(null)   // null = not yet fetched
  const [viewersOpen, setViewersOpen] = useState(false)
  const dragStartY = useRef(null)
  const timerRef = useRef(null)
  const startRef = useRef(0)
  const pausedRef = useRef(false)

  const groups = state.stories
  const group = groups[groupIndex]
  const story = group?.stories?.[storyIndex]
  const isOwn = story?.user_id === state.me?.id

  const triggerClose = useCallback(() => {
    setClosing(true)
    setTimeout(onClose, 280)
  }, [onClose])

  const goNext = useCallback(() => {
    if (!group) return
    if (storyIndex < group.stories.length - 1) {
      setStoryIndex((s) => s + 1); setProgress(0)
    } else if (groupIndex < groups.length - 1) {
      setGroupIndex((g) => g + 1); setStoryIndex(0); setProgress(0)
    } else {
      triggerClose()
    }
  }, [group, groups, storyIndex, groupIndex, triggerClose])

  const goPrev = useCallback(() => {
    if (storyIndex > 0) { setStoryIndex((s) => s - 1); setProgress(0) }
    else if (groupIndex > 0) { setGroupIndex((g) => g - 1); setStoryIndex(0); setProgress(0) }
  }, [storyIndex, groupIndex])

  // Record view for other users' stories (fire-and-forget)
  useEffect(() => {
    if (story && !isOwn) {
      viewStory(story.id).catch(() => {})
    }
  }, [story?.id, isOwn])

  // Fetch viewers when owner is looking at their own story
  useEffect(() => {
    if (!story || !isOwn) { setViewers(null); return }
    setViewers(null)
    setViewersOpen(false)
    getStoryViews(story.id)
      .then((data) => setViewers(data.views || []))
      .catch(() => setViewers([]))
  }, [story?.id, isOwn])

  // Pause timer while viewers sheet is open
  useEffect(() => {
    pausedRef.current = viewersOpen
  }, [viewersOpen])

  // Progress timer
  useEffect(() => {
    if (!story || story.media_type === 'video') return
    setProgress(0)
    startRef.current = Date.now()
    clearInterval(timerRef.current)
    timerRef.current = setInterval(() => {
      if (pausedRef.current) return
      const elapsed = Date.now() - startRef.current
      const pct = Math.min(elapsed / STORY_DURATION, 1)
      setProgress(pct)
      if (pct >= 1) { clearInterval(timerRef.current); goNext() }
    }, 50)
    return () => clearInterval(timerRef.current)
  }, [story?.id]) // eslint-disable-line

  const onTouchStart = (e) => {
    dragStartY.current = e.touches[0].clientY
    pausedRef.current = true
  }
  const onTouchMove = (e) => {
    if (dragStartY.current === null) return
    setDragY(e.touches[0].clientY - dragStartY.current)
  }
  const onTouchEnd = () => {
    if (Math.abs(dragY) > 100) {
      triggerClose()
    } else {
      setDragY(0)
      pausedRef.current = viewersOpen
    }
    dragStartY.current = null
  }

  if (!group || !story) return null

  const doDelete = async () => {
    try {
      await deleteStory(story.id)
      toast('Story deleted.', 'info')
      goNext()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const doReply = async () => {
    if (!reply.trim()) return
    try {
      await replyStory(story.id, reply.trim())
      setReply('')
      toast('Reply sent!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const opacity = Math.max(0, 1 - Math.abs(dragY) / 300)
  const transform = closing
    ? 'translateY(100vh)'
    : dragY !== 0
      ? `translateY(${dragY}px)`
      : 'none'
  const transition = (dragY === 0 || closing) ? 'transform 0.28s cubic-bezier(.4,0,.2,1), opacity 0.28s' : 'none'

  return (
    <div
      className="story-viewer"
      style={{ opacity, transform, transition }}
      onPointerDown={(e) => { if (e.target === e.currentTarget) { pausedRef.current = true } }}
      onPointerUp={(e) => { if (e.target === e.currentTarget) { pausedRef.current = viewersOpen } }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
    >
      {/* Progress bars */}
      <div className="story-progress-bar">
        {group.stories.map((s, i) => (
          <div key={s.id} className="story-seg">
            <div
              className="story-seg-fill"
              style={{ width: i < storyIndex ? '100%' : i === storyIndex ? `${progress * 100}%` : '0%' }}
            />
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="story-header" style={{ top: 28 }}>
        <Avatar user={{ username: group.username, avatar_url: group.avatar_url }} size="xs" />
        <div className="story-header-info">
          <div className="story-header-name">{group.username}</div>
          <div className="story-header-time">{fmtAgo(story.created_at)}</div>
        </div>
        {isOwn && (
          <Button type="button" variant="ghost" className="story-close-btn" onClick={doDelete} title="Delete story">
            <Trash2 size={16} />
          </Button>
        )}
        <Button type="button" variant="ghost" className="story-close-btn" onClick={triggerClose}>
          <X />
        </Button>
      </div>

      {/* Media */}
      <div className="story-media">
        {story.media_type === 'image'
          ? <img
              src={story.url}
              alt=""
              className="story-media-el"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
          : <video
              src={story.url}
              autoPlay
              controls={false}
              muted={false}
              onEnded={goNext}
              className="story-media-el"
              style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'contain' }}
            />
        }
      </div>

      {story.caption && <div className="story-caption">{story.caption}</div>}

      {/* Tap nav */}
      <div className="story-nav-left" onClick={goPrev} />
      <div className="story-nav-right" onClick={goNext} />

      {/* Eye icon — own story only */}
      {isOwn && (
        <Button
          type="button"
          variant="ghost"
          className="story-view-count-btn h-auto"
          onClick={() => setViewersOpen(true)}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <Eye size={22} />
          <span className="story-view-count-label">
            {viewers === null ? '…' : viewers.length}
          </span>
        </Button>
      )}

      {/* Reply form — other users' stories only */}
      {!isOwn && (
        <div className="story-reply-form">
          <Input
            className="story-reply-input"
            placeholder={`Reply to ${group.username}…`}
            value={reply}
            onChange={(e) => setReply(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') doReply() }}
            onPointerDown={(e) => e.stopPropagation()}
            onFocus={() => { pausedRef.current = true }}
            onBlur={() => { if (!reply) pausedRef.current = false }}
          />
          <Button type="button" className="btn-icon-primary" onClick={doReply} onPointerDown={(e) => e.stopPropagation()}>
            <Send />
          </Button>
        </div>
      )}

      {/* Viewers slide-up sheet */}
      {viewersOpen && (
        <div className="story-viewers-overlay" onClick={() => setViewersOpen(false)}>
          <div className="story-viewers-sheet" onClick={(e) => e.stopPropagation()}>
            <div className="story-viewers-handle" />
            <div className="story-viewers-header">
              <span>Viewers · {viewers?.length ?? 0}</span>
              <Button type="button" variant="ghost" className="story-close-btn" onClick={() => setViewersOpen(false)}>
                <X />
              </Button>
            </div>
            <div className="story-viewers-list">
              {viewers === null && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0', fontSize: 'var(--text-sm)' }}>
                  Loading…
                </div>
              )}
              {viewers?.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '32px 0', fontSize: 'var(--text-sm)' }}>
                  No views yet.
                </div>
              )}
              {viewers?.map((v) => (
                <div key={v.viewer_id} className="story-viewer-item">
                  <Avatar user={{ username: v.username, avatar_url: v.avatar_url }} size="sm" />
                  <div className="story-viewer-item-info">
                    <div className="story-viewer-item-name">{v.username}</div>
                    <div className="story-viewer-item-time">{fmtAgo(v.viewed_at)}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function fmtAgo(iso) {
  if (!iso) return ''
  const d = Date.now() - new Date(iso)
  if (d < 60000) return 'just now'
  if (d < 3600000) return `${Math.floor(d / 60000)}m ago`
  return `${Math.floor(d / 3600000)}h ago`
}
