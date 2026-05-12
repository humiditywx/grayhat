import { useState, useRef } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { uploadAvatar, removeFriend, openPrivate, updateProfile, changeUsername } from '../../api.js'
import SettingsPanel from './SettingsPanel.jsx'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'
import StoryViewer from '../stories/StoryViewer.jsx'
import AeroIcon from '../icons/AeroIcon.jsx'

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
            <AeroIcon name="back" size={20} />
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
          <AeroIcon name="settings" size={20} />
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
            <AeroIcon name="edit" size={14} />
            Edit Profile
          </button>
          <button
            className="btn btn-outline btn-sm"
            style={{ flex: 1 }}
            onClick={() => navigator.clipboard.writeText(me?.id || '').then(() => toast('UUID copied!', 'success'))}
          >
            <AeroIcon name="copy" size={14} />
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
                <AeroIcon name="people" size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>Friends</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>
                  {state.friends.length} {state.friends.length === 1 ? 'friend' : 'friends'}
                </div>
              </div>
              <AeroIcon name="back" size={16} style={{ color: 'var(--text-3)', transform: 'rotate(180deg)' }} />
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
                <AeroIcon name="qr" size={28} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 'var(--text-sm)', color: 'var(--text)' }}>My QR Code</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>Share to add friends</div>
              </div>
              <AeroIcon name="back" size={16} style={{ color: 'var(--text-3)', transform: 'rotate(180deg)' }} />
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
          <AeroIcon name="back" size={20} />
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
          <AeroIcon name="back" size={20} />
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
              <AeroIcon name="edit" size={14} />
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
          <AeroIcon name="back" size={20} />
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
                <AeroIcon name="chat" size={18} />
              </button>
              <button className="btn-icon" title="Remove" onClick={() => remove(f)} disabled={busy === f.id} style={{ color: '#EF4444' }}>
                <AeroIcon name="trash" size={18} />
              </button>
            </div>
          </div>
        ))}
      </div>

      {state.addFriendOpen && <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />}
    </div>
  )
}
