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
            {/* chevron.left */}
            <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
              <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
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
          {/* gearshape.fill */}
          <svg width="20" height="20" viewBox="0 0 24 24">
            <path
              d="M19.14 12.94c.04-.3.06-.61.06-.94s-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87a.48.48 0 00.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32a.49.49 0 00-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z"
              fill="currentColor"
              filter="url(#icon-depth)"
            />
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
            <div className="profile-username">{me?.display_name || me?.username}</div>
            <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: -2 }}>@{me?.username}</div>
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
            {/* pencil.fill */}
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"
                fill="currentColor"
                filter="url(#icon-depth)"
              />
            </svg>
            Edit Profile
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => navigator.clipboard.writeText(me?.id || '').then(() => toast('UUID copied!', 'success'))}
          >
            {/* doc.on.doc.fill */}
            <svg width="14" height="14" viewBox="0 0 24 24">
              <path
                d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h11c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm0 16H8V7h11v14z"
                fill="currentColor"
                filter="url(#icon-depth)"
              />
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
                {/* person.2.fill */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"
                    fill="currentColor"
                    filter="url(#icon-depth)"
                  />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>Friends</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                  {state.friends.length} {state.friends.length === 1 ? 'friend' : 'friends'}
                </div>
              </div>
              {/* chevron.right */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-3)' }}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
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
                {/* qrcode */}
                <svg width="20" height="20" viewBox="0 0 24 24">
                  <path
                    d="M3 3h7v7H3V3zm1 1v5h5V4H4zm1 1h3v3H5V5zM3 14h7v7H3v-7zm1 1v5h5v-5H4zm1 1h3v3H5v-3zM14 3h7v7h-7V3zm1 1v5h5V4h-5zm1 1h3v3h-3V5zM14 14h2v2h-2v-2zm3 0h2v2h-2v-2zm-3 3h2v2h-2v-2zm3 0h2v2h-2v-2zm3-3h1v1h-1v-1zm-1 1h1v1h-1v-1zm1 1h1v3h-3v-1h2v-2z"
                    fill="currentColor"
                    filter="url(#icon-depth)"
                  />
                </svg>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>My QR Code</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Share to add friends</div>
              </div>
              {/* chevron.right */}
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ color: 'var(--text-3)' }}>
                <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z"/>
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
          {/* chevron.left */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
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
  const [displayName, setDisplayName] = useState(me?.display_name || '')
  const [isGlobal, setIsGlobal] = useState(me?.is_global || false)
  const [username, setUsername] = useState(me?.username || '')
  const [busy, setBusy] = useState(false)
  const [usernameChanges, setUsernameChanges] = useState(null)

  const pickAvatar = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const fd = new FormData()
    fd.append('file', file)
    try {
      await uploadAvatar(fd)
      dispatch({ type: 'UPDATE_MY_AVATAR' })
      toast('Avatar updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const saveProfile = async () => {
    if (busy) return
    setBusy(true)
    try {
      const data = await updateProfile({ bio, display_name: displayName, is_global: isGlobal })
      dispatch({ type: 'UPDATE_ME', patch: {
        bio: data.user.bio,
        display_name: data.user.display_name,
        is_global: data.user.is_global
      } })
      toast('Profile saved!', 'success')
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
          {/* chevron.left */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
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
              {/* pencil.fill */}
              <svg width="13" height="13" viewBox="0 0 24 24" fill="currentColor">
                <path d="M3 17.25V21h3.75L17.81 9.94l-3.75-3.75L3 17.25zM20.71 7.04a1 1 0 000-1.41l-2.34-2.34a1 1 0 00-1.41 0l-1.83 1.83 3.75 3.75 1.83-1.83z"/>
              </svg>
            </div>
          </div>
          <input ref={avatarRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={pickAvatar} />
          <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Tap to change photo</span>
        </div>

        {/* Name */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="field-label">Name</label>
          <input
            className="field-input"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Display Name"
            maxLength={20}
          />
        </div>

        {/* Global Mode */}
        <div style={{ marginBottom: 24, display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="global-toggle-edit" checked={isGlobal} onChange={e => setIsGlobal(e.target.checked)} />
          <label htmlFor="global-toggle-edit" style={{ fontSize: 'var(--text-sm)', color: 'var(--text)' }}>Global Mode</label>
        </div>

        {/* Username */}
        <div className="field" style={{ marginBottom: 16 }}>
          <label className="field-label">Username</label>
          <input
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9._]/g, ''))}
            placeholder="username"
            maxLength={31}
          />
          <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
            3–31 chars, lowercase/numbers/dots/underscores.
            {changesLeft !== null && (
              <span style={{ marginLeft: 4, color: changesLeft === 0 ? '#EF4444' : 'var(--text-3)' }}>
                {changesLeft} change{changesLeft !== 1 ? 's' : ''} remaining (14-day window).
              </span>
            )}
          </div>
          <button
            className="btn btn-primary btn-sm"
            onClick={saveUsername}
            disabled={busy || !username.trim() || username === me?.username || username.length < 3}
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
        </div>

        <button
          className="btn btn-primary"
          onClick={saveProfile}
          disabled={busy || (bio === (me?.bio || '') && displayName === (me?.display_name || '') && isGlobal === me?.is_global)}
          style={{ width: '100%', marginTop: 8 }}
        >
          {busy ? 'Saving…' : 'Save Changes'}
        </button>
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
          {/* chevron.left */}
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M15.41 7.41L14 6l-6 6 6 6 1.41-1.41L10.83 12z"/>
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
                {/* bubble.left.fill */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M2 8.5A6.5 6.5 0 018.5 2h7A6.5 6.5 0 0122 8.5v4A6.5 6.5 0 0115.5 19H9l-5 3V8.5z"/>
                </svg>
              </button>
              <button className="btn-icon" title="Remove" onClick={() => remove(f)} disabled={busy === f.id} style={{ color: '#EF4444' }}>
                {/* trash.fill */}
                <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M9 3v1H4v2h1l1 14h12l1-14h1V4h-5V3H9zm0 5h2v9H9V8zm4 0h2v9h-2V8z"/>
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
