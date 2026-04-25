import { useState, useEffect } from 'react'
import Avatar from './Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useCall } from '../../context/CallContext.jsx'
import { getUserProfile, openPrivate } from '../../api.js'

export default function UserProfilePage() {
  const { state, dispatch, toast } = useApp()
  const userId = state.profileViewUserId
  if (!userId) return null
  return <ProfilePageInner key={userId} userId={userId} dispatch={dispatch} toast={toast} state={state} />
}

function ProfilePageInner({ userId, dispatch, toast, state }) {
  const { startCall } = useCall()
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)

  const isMe = userId === state.me?.id
  const storyGroup = state.stories.find((g) => g.user_id === userId)
  const hasStory = (storyGroup?.stories?.length || 0) > 0

  useEffect(() => {
    getUserProfile(userId)
      .then((d) => setUser(d.user))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [userId])

  const close = () => dispatch({ type: 'CLOSE_PROFILE' })

  const openChat = async () => {
    try {
      const data = await openPrivate(userId)
      dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
      close()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const callUser = async () => {
    try {
      const data = await openPrivate(userId)
      dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      await startCall(data.conversation.id, 'voice', data.conversation.title, user?.avatar_url ?? null)
      close()
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="user-profile-page">
      {/* Header — matches panel-header */}
      <div className="panel-header">
        <button className="btn-icon" onClick={close} title="Back">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
        </button>
        <span className="panel-title">{loading ? '…' : (user?.username ?? '')}</span>
      </div>

      {loading
        ? <div style={{ display:'flex', justifyContent:'center', padding: 60 }}><div className="spinner spinner-lg" /></div>
        : (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Profile hero — matches ProfilePanel hero */}
            <div className="profile-hero">
              <div style={{ position: 'relative' }}>
                {hasStory
                  ? <div className="avatar-ring"><Avatar user={user} size="xl" /></div>
                  : <Avatar user={user} size="xl" />
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="profile-username">{user?.username}</div>
                {user?.bio && (
                  <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-2)', marginTop: 2, lineHeight: 1.4 }}>
                    {user.bio}
                  </div>
                )}
              </div>
            </div>

            {/* Action buttons — two side-by-side, same layout as own profile's Edit+UUID row */}
            {isMe
              ? (
                <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => { close(); dispatch({ type: 'SET_PANEL', panel: 'profile' }) }}
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
                    onClick={() => navigator.clipboard.writeText(user?.id || '').then(() => toast('UUID copied!', 'success'))}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/>
                      <path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/>
                    </svg>
                    Copy UUID
                  </button>
                </div>
              )
              : (
                <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={callUser}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                    </svg>
                    Call
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={openChat}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
                      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                    </svg>
                    Message
                  </button>
                </div>
              )
            }

            {/* Future: posts will go here */}
          </div>
        )
      }
    </div>
  )
}
