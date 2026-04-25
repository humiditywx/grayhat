import { useRef, useState } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Avatar from '../common/Avatar.jsx'
import { postStoryWithProgress, getStories } from '../../api.js'

// SVG circle math for the progress ring
const RING_R = 23          // radius inside a 52×52 viewBox (center 26,26)
const RING_C = 2 * Math.PI * RING_R  // full circumference ≈ 144.5

function UploadRing({ progress }) {
  const offset = RING_C * (1 - progress / 100)
  return (
    <svg
      style={{
        position: 'absolute', top: -4, left: -4,
        width: 'calc(100% + 8px)', height: 'calc(100% + 8px)',
        pointerEvents: 'none',
      }}
      viewBox="0 0 52 52"
    >
      {/* track */}
      <circle cx="26" cy="26" r={RING_R} fill="none" stroke="var(--border)" strokeWidth="3" />
      {/* fill */}
      <circle
        cx="26" cy="26" r={RING_R}
        fill="none"
        stroke="var(--primary)"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={RING_C}
        strokeDashoffset={offset}
        transform="rotate(-90 26 26)"
        style={{ transition: 'stroke-dashoffset 0.15s linear' }}
      />
    </svg>
  )
}

export default function StoryBar({ onOpenViewer }) {
  const { state, dispatch, toast } = useApp()
  const storyInputRef = useRef(null)
  const [seenIds, setSeenIds] = useState(new Set())
  const [uploadProgress, setUploadProgress] = useState(null) // null=idle, 0-100=uploading

  const uploadStory = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    setUploadProgress(0)
    try {
      await postStoryWithProgress(fd, setUploadProgress)
      const data = await getStories()
      dispatch({ type: 'REFRESH_STORIES', stories: data.story_groups || [] })
      toast('Story posted!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setUploadProgress(null)
      if (storyInputRef.current) storyInputRef.current.value = ''
    }
  }

  const myGroup = state.stories.find((g) => g.user_id === state.me?.id)
  const otherGroups = state.stories.filter((g) => g.user_id !== state.me?.id)
  const uploading = uploadProgress !== null

  return (
    <div className="story-bar">
      {/* My story */}
      <div className="story-item">
        <div style={{ position: 'relative', display: 'inline-block' }}>
          <div
            style={{ opacity: uploading ? 0.6 : 1, transition: 'opacity 0.2s' }}
            onClick={() => {
              if (uploading) return
              if (myGroup?.stories?.length) {
                const idx = state.stories.indexOf(myGroup)
                onOpenViewer(idx >= 0 ? idx : 0)
              } else {
                storyInputRef.current?.click()
              }
            }}
          >
            {myGroup?.stories?.length
              ? (
                <div className="avatar-ring">
                  <Avatar user={state.me} size="md" />
                </div>
              )
              : (
                <div className="avatar-ring-empty">
                  <div className="avatar avatar-md" style={{ background: 'var(--primary-tint)', color: 'var(--primary)', fontSize: 22, fontWeight: 700 }}>+</div>
                </div>
              )
            }
          </div>

          {/* Progress ring — shown during upload */}
          {uploading && <UploadRing progress={uploadProgress} />}

          {/* Add-more button — only when already have stories and not uploading */}
          {myGroup?.stories?.length > 0 && !uploading && (
            <button
              className="story-add-btn"
              onClick={(e) => { e.stopPropagation(); storyInputRef.current?.click() }}
              title="Add story"
            >+</button>
          )}
        </div>
        <input
          ref={storyInputRef}
          type="file"
          accept="image/*,video/*"
          style={{ display: 'none' }}
          onChange={uploadStory}
        />
        <span className="story-item-name">{uploading ? `${uploadProgress}%` : 'My Story'}</span>
      </div>

      {/* Friends' stories */}
      {otherGroups.map((g) => {
        const idx = state.stories.indexOf(g)
        const seen = seenIds.has(g.user_id)
        return (
          <div
            key={g.user_id}
            className="story-item"
            onClick={() => {
              setSeenIds((prev) => new Set([...prev, g.user_id]))
              onOpenViewer(idx >= 0 ? idx : 0)
            }}
          >
            <div className={seen ? 'avatar-ring-seen' : 'avatar-ring'}>
              <Avatar user={{ username: g.username, avatar_url: g.avatar_url }} size="md" />
            </div>
            <span className="story-item-name">{g.username}</span>
          </div>
        )
      })}
    </div>
  )
}
