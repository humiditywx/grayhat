import { useState, useRef } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { uploadAvatar, removeFriend, openPrivate, updateProfile, changeUsername } from '../../api.js'
import SettingsPanel from './SettingsPanel.jsx'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'
import StoryViewer from '../stories/StoryViewer.jsx'

function fmtLastSeen(iso) {
  if (!iso) return 'Never'
  const d = new Date(iso)
  const diff = Date.now() - d
  if (diff < 60000) return 'Just now'
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`
  return d.toLocaleDateString()
}

export default function ProfilePanel() {
  const { state, dispatch, toast } = useApp()
  const { me } = state
  const [view, setView] = useState('profile') // 'profile' | 'friends' | 'settings' | 'qr' | 'edit'
  const [storyViewerOpen, setStoryViewerOpen] = useState(false)

  const myStoryGroup = state.stories.find((g) => g.user_id === me?.id)
  const hasStories = (myStoryGroup?.stories?.length || 0) > 0
  const myStoryGroupIndex = state.stories.findIndex((g) => g.user_id === me?.id)

  const handleAvatarClick = () => {
    if (hasStories && myStoryGroupIndex >= 0) {
      setStoryViewerOpen(true)
    }
    // No-op if no story
  }

  if (view === 'settings') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden', position: 'relative' }}>
        <div style={{ position: 'absolute', top: 16, left: 8, zIndex: 10 }}>
          <button className="btn-icon" onClick={() => setView('profile')} title="Back">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <polyline points="15 18 9 12 15 6"/>
            </svg>
          </button>
        </div>
        <SettingsPanel />
      </div>
    )
  }

  if (view === 'friends') {
    return <FriendsView onBack={() => setView('profile')} />
  }

  if (view === 'edit') {
    return <EditProfileView onBack={() => setView('profile')} />
  }

  if (view === 'qr') {
    return <QRView onBack={() => setView('profile')} me={me} />
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div className="panel-header">
        <span className="panel-title">Profile</span>
        <button
          className="btn-icon"
          title="Settings"
          onClick={() => setView('settings')}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3"/>
            <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
          </svg>
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {/* Profile hero */}
        <div className="profile-hero">
          {/* Avatar — clickable to view story */}
          <div
            style={{ position: 'relative', cursor: hasStories ? 'pointer' : 'default' }}
            onClick={handleAvatarClick}
            title={hasStories ? 'View your story' : undefined}
          >
            {hasStories ? (
              <div className="avatar-ring">
                <Avatar user={me} size="xl" />
              </div>
            ) : (
              <Avatar user={me} size="xl" />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="profile-username">{me?.username}</div>
            {me?.bio && (
              <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                {me.bio}
              </div>
            )}
          </div>
        </div>

        {/* Quick action buttons */}
        <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 8 }}>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => setView('edit')}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
              <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
            </svg>
            Edit Profile
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => navigator.clipboard.writeText(me?.id || '').then(() => toast('UUID copied!', 'success'))}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
              <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
              <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
            </svg>
            Copy UUID
          </button>
        </div>

        {/* Friends card */}
        <div style={{ padding: '4px 16px' }}>
          <button className="profile-card" onClick={() => setView('friends')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--r-md)',
                background: 'var(--primary-tint)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
                  <circle cx="9" cy="7" r="4"/>
                  <path d="M23 21v-2a4 4 0 00-3-3.87"/>
                  <path d="M16 3.13a4 4 0 010 7.75"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>Friends</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                  {state.friends.length} {state.friends.length === 1 ? 'friend' : 'friends'}
                </div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        </div>

        {/* QR Code card */}
        <div style={{ padding: '4px 16px 16px' }}>
          <button className="profile-card" onClick={() => setView('qr')}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 'var(--r-md)',
                background: 'var(--primary-tint)', color: 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: 0,
              }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" rx="1"/>
                  <rect x="14" y="3" width="7" height="7" rx="1"/>
                  <rect x="3" y="14" width="7" height="7" rx="1"/>
                  <line x1="14" y1="14" x2="14" y2="14.01"/>
                  <line x1="17" y1="14" x2="17" y2="14.01"/>
                  <line x1="20" y1="14" x2="20" y2="17"/>
                  <line x1="14" y1="17" x2="17" y2="17"/>
                  <line x1="17" y1="20" x2="20" y2="20"/>
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>My QR Code</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Share to add friends</div>
              </div>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--text-3)' }}>
                <polyline points="9 18 15 12 9 6"/>
              </svg>
            </div>
          </button>
        </div>
      </div>

      {storyViewerOpen && (
        <StoryViewer
          initialGroupIndex={myStoryGroupIndex}
          onClose={() => setStoryViewerOpen(false)}
        />
      )}
    </div>
  )
}

function QRView({ onBack, me }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <button className="btn-icon" onClick={onBack} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="panel-title">My QR Code</span>
      </div>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
        <img
          src="/api/users/me/qr.png"
          alt="My QR code"
          style={{ width: 200, height: 200, borderRadius: 12, border: '2px solid var(--border-light)' }}
        />
        <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center' }}>
          Friends can scan this QR code to add you.
        </p>
        <div
          className="uuid-display"
          onClick={() => navigator.clipboard.writeText(me?.id || '')}
          style={{ cursor: 'pointer', fontSize: 'var(--text-xs)', color: 'var(--text-3)', wordBreak: 'break-all', textAlign: 'center', padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 'var(--r-md)' }}
        >
          {me?.id}
        </div>
      </div>
    </div>
  )
}

function EditProfileView({ onBack }) {
  const { state, dispatch, toast } = useApp()
  const { me } = state
  const avatarRef = useRef(null)
  const [bio, setBio] = useState(me?.bio || '')
  const [username, setUsername] = useState(me?.username || '')
  const [busy, setBusy] = useState(false)
  const [usernameChanges, setUsernameChanges] = useState(null) // number of changes in window

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('avatar', file)
    // Note: backend expects 'file' field for avatar
    const fd2 = new FormData()
    fd2.append('file', file)
    try {
      await uploadAvatar(fd2)
      dispatch({ type: 'UPDATE_MY_AVATAR' })
      toast('Avatar updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const saveBio = async () => {
    if (busy) return
    setBusy(true)
    try {
      const data = await updateProfile({ bio })
      dispatch({ type: 'UPDATE_ME', patch: { bio: data.user.bio } })
      toast('Bio saved!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveUsername = async () => {
    if (busy || !username.trim()) return
    setBusy(true)
    try {
      const data = await changeUsername({ username: username.trim() })
      dispatch({ type: 'UPDATE_ME', patch: { username: data.user.username } })
      setUsernameChanges(data.changes_in_window)
      toast('Username updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const changesLeft = usernameChanges !== null ? 2 - usernameChanges : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <button className="btn-icon" onClick={onBack} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="panel-title">Edit Profile</span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '16px' }}>
        {/* Avatar */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 24, gap: 12 }}>
          <div style={{ position: 'relative', cursor: 'pointer' }} onClick={() => avatarRef.current?.click()}>
            <Avatar user={me} size="xl" />
            <div style={{
              position: 'absolute', bottom: 0, right: 0,
              width: 26, height: 26, borderRadius: '50%',
              background: 'var(--primary)', color: '#fff',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              border: '2px solid var(--surface)',
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Tap to change photo</span>
        </div>

        {/* Username */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="field-label">Username</label>
          <input
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="username"
            maxLength={24}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
            3–24 chars, letters/numbers/underscores.
            {changesLeft !== null && (
              <span style={{ marginLeft: 4, color: changesLeft === 0 ? '#EF4444' : 'var(--text-3)' }}>
                {changesLeft} change{changesLeft !== 1 ? 's' : ''} remaining (14-day window).
              </span>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={saveUsername}
            disabled={busy || !username.trim() || username === me?.username}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {busy ? 'Saving…' : 'Update Username'}
          </button>
        </div>

        {/* Bio */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="field-label">Bio</label>
          <textarea
            className="field-input"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="Tell people about yourself…"
            rows={3}
            maxLength={300}
            style={{ resize: 'vertical' }}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', textAlign: 'right' }}>{bio.length}/300</div>
          <button
            className="btn btn-primary btn-sm"
            onClick={saveBio}
            disabled={busy || bio === (me?.bio || '')}
            style={{ alignSelf: 'flex-start', marginTop: 4 }}
          >
            {busy ? 'Saving…' : 'Save Bio'}
          </button>
        </div>
      </div>
    </div>
  )
}

function FriendsView({ onBack }) {
  const { state, dispatch, toast } = useApp()
  const [busy, setBusy] = useState(null)

  const openChat = async (friend) => {
    try {
      const data = await openPrivate(friend.id)
      dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const remove = async (friend) => {
    if (!confirm(`Remove ${friend.username} from friends?`)) return
    setBusy(friend.id)
    try {
      await removeFriend(friend.id)
      dispatch({ type: 'REMOVE_FRIEND', friendId: friend.id })
      toast('Friend removed.', 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <button className="btn-icon" onClick={onBack} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="panel-title">Friends</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
        >
          + Add
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {state.friends.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
            No friends yet.<br />Add someone to get started!
          </div>
        )}
        {state.friends.map((f) => (
          <div key={f.id} className="friend-item">
            <div style={{ position: 'relative' }}>
              <Avatar user={f} size="md" />
              {state.onlineUsers.has(f.id) && <span className="online-dot" style={{ position: 'absolute', bottom: 0, right: 0 }} />}
            </div>
            <div className="friend-item-info" style={{ cursor: 'pointer' }} onClick={() => openChat(f)}>
              <div className="friend-name">{f.username}</div>
              <div className="friend-last-seen">
                {state.onlineUsers.has(f.id) ? <span style={{ color: '#22C55E' }}>Online</span> : `Last seen ${fmtLastSeen(f.last_seen_at)}`}
              </div>
            </div>
            <div className="friend-actions">
              <button className="btn-icon" title="Message" onClick={() => openChat(f)}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </button>
              <button className="btn-icon" title="Remove" onClick={() => remove(f)} disabled={busy === f.id} style={{ color: '#EF4444' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4h6v2"/>
                </svg>
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.addFriendOpen && <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />}
    </div>
  )
}
