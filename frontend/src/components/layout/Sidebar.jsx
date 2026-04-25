import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import Avatar from '../common/Avatar.jsx'
import StoryBar from '../stories/StoryBar.jsx'
import StoryViewer from '../stories/StoryViewer.jsx'
import InboxPanel from '../panels/InboxPanel.jsx'
import GroupsPanel from '../panels/GroupsPanel.jsx'
import ProfilePanel from '../panels/ProfilePanel.jsx'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'
import CreateGroupDialog from '../dialogs/CreateGroupDialog.jsx'
import { sendFriendRequest, joinGroup, postStory, sendAttachment } from '../../api.js'
import { useSounds } from '../../hooks/useSounds.js'

function fmtTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function parseScannedValue(val) {
  if (!val) return null
  const addMatch = val.match(/\/add\/([0-9a-f-]{36})/i)
  if (addMatch) return { kind: 'friend', id: addMatch[1] }
  const groupMatch = val.match(/\/g\/([A-Za-z0-9_-]+)/)
  if (groupMatch) return { kind: 'group', token: groupMatch[1], url: val }
  // raw UUID → treat as friend id
  if (/^[0-9a-f-]{36}$/i.test(val.trim())) return { kind: 'friend', id: val.trim() }
  return null
}

function CameraActionModal({ file, onClose, dispatch, toast, conversations }) {
  const [view, setView] = useState('options') // 'options' | 'send-picker'
  const [busy, setBusy] = useState(false)
  const { play } = useSounds()
  const objectUrl = file ? URL.createObjectURL(file) : null
  const isVideo = file?.type?.startsWith('video/')

  const handleStory = async () => {
    if (busy) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await postStory(fd)
      toast('Story posted!', 'success')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleSendTo = async (conv) => {
    if (busy) return
    setBusy(true)
    try {
      const fd = new FormData()
      fd.append('file', file)
      await sendAttachment(conv.id, fd)
      dispatch({ type: 'SELECT_CONV', convId: conv.id })
      toast('Sent!', 'success')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const handleScanQr = async () => {
    if (!file || isVideo) return
    if (busy) return
    setBusy(true)
    try {
      if (!('BarcodeDetector' in window)) {
        toast('QR scanning not supported in this browser.', 'error')
        setBusy(false)
        return
      }
      const bitmap = await createImageBitmap(file)
      const detector = new window.BarcodeDetector({ formats: ['qr_code'] })
      const codes = await detector.detect(bitmap)
      if (!codes.length) {
        toast('No QR code found in image.', 'error')
        setBusy(false)
        return
      }
      const val = codes[0].rawValue
      const parsed = parseScannedValue(val)
      if (!parsed) {
        toast('Unrecognised QR code.', 'error')
        setBusy(false)
        return
      }
      if (parsed.kind === 'friend') {
        const data = await sendFriendRequest({ uuid: parsed.id })
        play('qrScanSuccess')
        if (data.friend) {
          dispatch({ type: 'ADD_FRIEND', friend: data.friend })
          if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
          toast(`${data.friend.username} added!`, 'success')
        } else if (data.request) {
          dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
          toast('Friend request sent!', 'success')
        }
      } else {
        const data = await joinGroup(parsed.token)
        dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
        dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
        toast(`Joined "${data.conversation.title}"!`, 'success')
      }
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="camera-action-overlay" onClick={onClose}>
      <div className="camera-action-modal" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <span style={{ fontWeight: 700, fontSize: 'var(--text-base)' }}>
            {view === 'send-picker' ? 'Send to…' : 'Use photo'}
          </span>
          <button className="btn-icon" onClick={onClose}>✕</button>
        </div>

        {view === 'options' && (
          <>
            {/* Preview */}
            <div className="camera-preview">
              {isVideo
                ? <video src={objectUrl} controls style={{ width: '100%', borderRadius: 'var(--r-md)' }} />
                : <img src={objectUrl} alt="Captured" style={{ width: '100%', borderRadius: 'var(--r-md)', objectFit: 'contain', maxHeight: 260 }} />
              }
            </div>

            {/* Options */}
            <div className="camera-options">
              <button className="camera-option-btn" onClick={handleStory} disabled={busy}>
                <div className="camera-option-icon" style={{ background: 'linear-gradient(135deg, #E879F9, var(--primary))' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/>
                  </svg>
                </div>
                <span>Add to Story</span>
              </button>

              <button className="camera-option-btn" onClick={() => setView('send-picker')} disabled={busy}>
                <div className="camera-option-icon" style={{ background: 'var(--primary)' }}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                    <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </div>
                <span>Send to Someone</span>
              </button>

              {!isVideo && (
                <button className="camera-option-btn" onClick={handleScanQr} disabled={busy}>
                  <div className="camera-option-icon" style={{ background: '#0EA5E9' }}>
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="2">
                      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
                      <rect x="3" y="14" width="7" height="7" rx="1"/>
                      <line x1="14" y1="14" x2="14" y2="14.01"/><line x1="17" y1="14" x2="17" y2="14.01"/>
                      <line x1="20" y1="14" x2="20" y2="17"/><line x1="14" y1="17" x2="17" y2="17"/>
                      <line x1="17" y1="20" x2="20" y2="20"/>
                    </svg>
                  </div>
                  <span>Scan QR</span>
                </button>
              )}
            </div>
          </>
        )}

        {view === 'send-picker' && (
          <>
            <button
              className="btn-ghost btn-sm"
              style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 4 }}
              onClick={() => setView('options')}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>
            <div className="send-picker">
              {conversations.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', padding: '20px 0', fontSize: 'var(--text-sm)' }}>
                  No conversations yet.
                </div>
              )}
              {conversations.map((conv) => (
                <button
                  key={conv.id}
                  className="send-picker-item"
                  onClick={() => handleSendTo(conv)}
                  disabled={busy}
                >
                  <Avatar user={conv.partner || { username: conv.title }} size="sm" />
                  <span style={{ flex: 1, textAlign: 'left', fontSize: 'var(--text-sm)', fontWeight: 500, color: 'var(--text)' }}>
                    {conv.title}
                  </span>
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default function Sidebar({ mobileHidden }) {
  const { state, dispatch, toast } = useApp()
  const [storyGroupIndex, setStoryGroupIndex] = useState(null)
  const [cameraFile, setCameraFile] = useState(null)
  const cameraInputRef = useRef(null)

  const panel = state.panel
  const selId = state.selectedConvId

  const chats = state.conversations
    .filter((c) => c.kind === 'private')
    .sort((a, b) => {
      const ta = a.last_message_at ? new Date(a.last_message_at) : new Date(a.created_at)
      const tb = b.last_message_at ? new Date(b.last_message_at) : new Date(b.created_at)
      return tb - ta
    })

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCameraFile(file)
    // Reset input so same file can be selected again
    e.target.value = ''
  }

  const inboxCount = (state.friendRequests?.incoming || []).length

  return (
    <>
      <div className={`sidebar${mobileHidden ? ' hidden-mobile' : ''}`}>
        {/* Logo header */}
        <div className="sidebar-header">
          <span className="sidebar-logo">Pentastic</span>
          <div style={{ display: 'flex', gap: 4 }}>
            {panel === 'chats' && (
              <button className="btn-icon" title="New direct message" onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
                </svg>
              </button>
            )}
          </div>
        </div>

        {/* Panel content */}
        {panel === 'chats' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <StoryBar onOpenViewer={(idx) => setStoryGroupIndex(idx)} />

            <div className="conv-list-header">Messages</div>
            <div className="sidebar-content">
              {chats.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '32px 16px' }}>
                  No chats yet.<br />Add a friend to start messaging!
                </div>
              )}
              {chats.map((c) => {
                const partner = c.partner
                const online = partner && state.onlineUsers.has(partner.id)
                const typing = Object.values(state.typingUsers[c.id] || {})
                return (
                  <div
                    key={c.id}
                    className={`conv-item${selId === c.id ? ' active' : ''}`}
                    onClick={() => dispatch({ type: 'SELECT_CONV', convId: c.id })}
                  >
                    <div style={{ position: 'relative' }}>
                      <Avatar user={partner} size="md" />
                      {online && <span className="online-dot" />}
                    </div>
                    <div className="conv-item-info">
                      <div className="conv-item-top">
                        <span className="conv-item-name">{c.title}</span>
                        <span className="conv-item-time">{fmtTime(c.last_message_at)}</span>
                      </div>
                      <div className="conv-item-preview">
                        {typing.length
                          ? <span style={{ color:'var(--primary)',fontStyle:'italic' }}>{typing[0]} is typing…</span>
                          : c.last_message_preview || 'Start a conversation'}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {panel === 'inbox'   && <InboxPanel />}
        {panel === 'groups'  && <GroupsPanel />}
        {panel === 'profile' && <ProfilePanel />}

        {/* Bottom nav — Chats | Inbox | [Camera] | Groups | Profile */}
        <nav className="sidebar-nav">
          <button className={`nav-tab${panel === 'chats' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_PANEL', panel: 'chats' })}>
            <ChatIcon active={panel === 'chats'} />
            Chats
          </button>
          <button className={`nav-tab${panel === 'inbox' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_PANEL', panel: 'inbox' })} style={{ position: 'relative' }}>
            <InboxIcon active={panel === 'inbox'} />
            Inbox
            {inboxCount > 0 && (
              <span style={{
                position: 'absolute', top: 6, right: 8,
                background: '#EF4444', color: '#fff',
                borderRadius: '9999px', fontSize: 9, fontWeight: 700,
                minWidth: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                padding: '0 3px',
              }}>{inboxCount}</span>
            )}
          </button>

          {/* Center camera button */}
          <button
            className="nav-tab nav-tab-qr"
            onClick={() => cameraInputRef.current?.click()}
            title="Camera"
          >
            <div className="nav-qr-btn">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M23 19a2 2 0 01-2 2H3a2 2 0 01-2-2V8a2 2 0 012-2h4l2-3h6l2 3h4a2 2 0 012 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            Camera
          </button>
          {/* Hidden camera input — capture="environment" forces back camera on Android/iOS */}
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />

          <button className={`nav-tab${panel === 'groups' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_PANEL', panel: 'groups' })}>
            <GroupsIcon active={panel === 'groups'} />
            Groups
          </button>
          <button className={`nav-tab${panel === 'profile' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_PANEL', panel: 'profile' })}>
            <div className={`nav-avatar-wrap${panel === 'profile' ? ' active' : ''}`}>
              <Avatar user={state.me} size="xs" />
            </div>
            Profile
          </button>
        </nav>
      </div>

      {storyGroupIndex !== null && (
        <StoryViewer initialGroupIndex={storyGroupIndex} onClose={() => setStoryGroupIndex(null)} />
      )}

      {cameraFile && (
        <CameraActionModal
          file={cameraFile}
          onClose={() => setCameraFile(null)}
          dispatch={dispatch}
          toast={toast}
          conversations={state.conversations}
        />
      )}

      {state.addFriendOpen && (
        <AddFriendDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'addFriendOpen' })} />
      )}
      {state.createGroupOpen && (
        <CreateGroupDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'createGroupOpen' })} />
      )}
    </>
  )
}

function ChatIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
    </svg>
  )
}
function InboxIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/>
      <circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )
}
function GroupsIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
      <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
    </svg>
  )
}
function ProfileIcon({ active }) {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2">
      <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/>
      <circle cx="12" cy="7" r="4"/>
    </svg>
  )
}
