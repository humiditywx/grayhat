import { useState, useEffect } from 'react'
import Avatar from './Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useCall } from '../../context/CallContext.jsx'
import { getUserProfile, openPrivate } from '../../api.js'
import AeroIcon from '../icons/AeroIcon.jsx'

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
          <AeroIcon name="back" size={20} />
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
                <div className="profile-username">{user?.display_name || user?.username}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginTop: -2 }}>@{user?.username}</div>
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
                    <AeroIcon name="edit" size={14} />
                    Edit Profile
                  </button>
                  <button
                    className="btn btn-outline btn-sm"
                    style={{ flex: 1 }}
                    onClick={() => navigator.clipboard.writeText(user?.id || '').then(() => toast('UUID copied!', 'success'))}
                  >
                    <AeroIcon name="copy" size={14} />
                    Copy UUID
                  </button>
                </div>
              )
              : (
                <div style={{ padding: '4px 16px 8px', display: 'flex', gap: 8 }}>
                  <button className="btn btn-outline btn-sm" style={{ flex: 1 }} onClick={callUser}>
                    <AeroIcon name="phone" size={14} />
                    Call
                  </button>
                  <button className="btn btn-primary btn-sm" style={{ flex: 1 }} onClick={openChat}>
                    <AeroIcon name="chat" size={14} />
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
