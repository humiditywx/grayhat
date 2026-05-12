import { useState, useRef, useMemo } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import Avatar from '../common/Avatar.jsx'
import StoryBar from '../stories/StoryBar.jsx'
import StoryViewer from '../stories/StoryViewer.jsx'
import InboxPanel from '../panels/InboxPanel.jsx'
import ProfilePanel from '../panels/ProfilePanel.jsx'
import AddFriendDialog from '../dialogs/AddFriendDialog.jsx'
import CreateGroupDialog from '../dialogs/CreateGroupDialog.jsx'
import AeroIcon from '../icons/AeroIcon.jsx'
import { sendFriendRequest, joinGroup, postStory, sendAttachment } from '../../api.js'

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
  if (/^[0-9a-f-]{36}$/i.test(val.trim())) return { kind: 'friend', id: val.trim() }
  return null
}

function CameraActionModal({ file, onClose, dispatch, toast, conversations }) {
  const [view, setView] = useState('options') // 'options' | 'send-picker'
  const [busy, setBusy] = useState(false)
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
          <button className="btn-icon" onClick={onClose}>
            <AeroIcon name="close" size={18} />
          </button>
        </div>

        {view === 'options' && (
          <>
            <div className="camera-preview">
              {isVideo
                ? <video src={objectUrl} controls style={{ width: '100%', borderRadius: 'var(--r-md)' }} />
                : <img src={objectUrl} alt="Captured" style={{ width: '100%', borderRadius: 'var(--r-md)', objectFit: 'contain', maxHeight: 260 }} />
              }
            </div>

            <div className="camera-options">
              <button className="camera-option-btn" onClick={handleStory} disabled={busy}>
                <div className="camera-option-icon">
                  <AeroIcon name="story" size={36} />
                </div>
                <span>Add to Story</span>
              </button>

              <button className="camera-option-btn" onClick={() => setView('send-picker')} disabled={busy}>
                <div className="camera-option-icon">
                  <AeroIcon name="send" size={36} />
                </div>
                <span>Send to Someone</span>
              </button>

              {!isVideo && (
                <button className="camera-option-btn" onClick={handleScanQr} disabled={busy}>
                  <div className="camera-option-icon">
                    <AeroIcon name="qr" size={36} />
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
              <AeroIcon name="back" size={14} />
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
  const { t } = useLocale()
  const [storyGroupIndex, setStoryGroupIndex] = useState(null)
  const [cameraFile, setCameraFile] = useState(null)
  const [search, setSearch] = useState('')
  const [chatSubView, setChatSubView] = useState('list') // 'list' | 'inbox'
  const cameraInputRef = useRef(null)

  const panel = state.panel
  const selId = state.selectedConvId

  const allConvs = useMemo(() => state.conversations.slice().sort((a, b) => {
    const ta = a.last_message_at ? new Date(a.last_message_at) : new Date(a.created_at)
    const tb = b.last_message_at ? new Date(b.last_message_at) : new Date(b.created_at)
    return tb - ta
  }), [state.conversations])

  const filteredConvs = search.trim()
    ? allConvs.filter((c) => c.title?.toLowerCase().includes(search.toLowerCase()))
    : allConvs

  const inboxCount = (state.friendRequests?.incoming || []).length

  const handleCameraCapture = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCameraFile(file)
    e.target.value = ''
  }

  const goToChats = () => {
    dispatch({ type: 'SET_PANEL', panel: 'chats' })
    setChatSubView('list')
  }

  return (
    <>
      <div className={`sidebar${mobileHidden ? ' hidden-mobile' : ''}`}>
        {/* Logo header */}
        <div className="sidebar-header">
          {panel === 'chats' && chatSubView === 'inbox' ? (
            <>
              <button className="btn-icon" onClick={() => setChatSubView('list')} title="Back to chats">
                <AeroIcon name="back" size={20} />
              </button>
              <span className="sidebar-logo" style={{ flex: 1 }}>{t('inboxTitle')}</span>
              <button
                className="btn btn-primary btn-sm"
                onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
              >
                {t('addFriend')}
              </button>
            </>
          ) : (
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <img src="/static/logo.png" alt="GrayHat" width="26" height="26" style={{ flexShrink: 0, objectFit: 'contain' }} />
                <span className="sidebar-logo">GrayHat</span>
                <span style={{
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '2px 7px',
                  borderRadius: 9999,
                  background: 'var(--primary)',
                  color: '#fff',
                  letterSpacing: '.04em',
                  WebkitTextFillColor: '#fff',
                  backgroundClip: 'unset',
                  WebkitBackgroundClip: 'unset',
                  lineHeight: 1.6,
                  alignSelf: 'center',
                }}>BETA</span>
              </div>
              <div style={{ display: 'flex', gap: 4 }}>
                {panel === 'chats' && (
                  <>
                    <button className="btn-icon" title="New direct message" onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}>
                      <AeroIcon name="edit" size={18} />
                    </button>
                    <button className="btn-icon" title="New group" onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'createGroupOpen' })}>
                      <AeroIcon name="groupAdd" size={18} />
                    </button>
                  </>
                )}
              </div>
            </>
          )}
        </div>

        {/* Chats panel */}
        {panel === 'chats' && chatSubView === 'list' && (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <StoryBar onOpenViewer={(idx) => setStoryGroupIndex(idx)} />

            {/* Search bar */}
            <div className="chat-search-wrap">
              <div className="chat-search-inner">
                <AeroIcon className="chat-search-icon" name="search" size={15} />
                <input
                  className="chat-search"
                  type="text"
                  placeholder={t('searchChats')}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && (
                  <button className="chat-search-clear" onClick={() => setSearch('')}>
                    <AeroIcon name="close" size={13} />
                  </button>
                )}
              </div>
            </div>

            <div className="sidebar-content">
              {/* Pinned inbox item */}
              {!search && (
                <div
                  className="conv-item"
                  onClick={() => setChatSubView('inbox')}
                >
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <div className="inbox-pinned-avatar">
                      <AeroIcon name="groupAdd" size={22} />
                    </div>
                    {inboxCount > 0 && (
                      <span style={{
                        position: 'absolute', bottom: 0, right: 0,
                        width: 10, height: 10, borderRadius: '50%',
                        background: '#EF4444', border: '2px solid var(--surface)',
                      }} />
                    )}
                  </div>
                  <div className="conv-item-info">
                    <div className="conv-item-top">
                      <span className="conv-item-name">{t('friendRequests')}</span>
                      {inboxCount > 0 && (
                        <span className="conv-item-time" style={{ color: 'var(--primary)', fontWeight: 600 }}>
                          {t('newLabel', { n: inboxCount })}
                        </span>
                      )}
                    </div>
                    <div className="conv-item-preview">
                      {inboxCount > 0
                        ? t(inboxCount > 1 ? 'pendingRequestsPlural' : 'pendingRequests', { n: inboxCount })
                        : t('noPendingShort')}
                    </div>
                  </div>
                </div>
              )}

              {/* All conversations: private + groups, sorted by recency */}
              {filteredConvs.length === 0 && (
                <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '32px 16px' }}>
                  {search ? t('noResults') : <span>{t('noChatsYet').split('\n').map((line, i) => i === 0 ? line : <><br key={i} />{line}</>)}</span>}
                </div>
              )}
              {filteredConvs.map((c) => {
                const isGroup = c.kind === 'group'
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
                      {isGroup ? (
                        <div className="avatar avatar-md" style={{ background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', color: '#fff', fontSize: 18, fontWeight: 700, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {c.icon_url
                            ? <img src={c.icon_url} alt={c.title} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }} />
                            : c.title?.[0]?.toUpperCase() || 'G'}
                        </div>
                      ) : (
                        <Avatar user={partner} size="md" />
                      )}
                      {!isGroup && online && <span className="online-dot" />}
                    </div>
                    <div className="conv-item-info">
                      <div className="conv-item-top">
                        <span className="conv-item-name">{c.title}</span>
                        <span className="conv-item-time">{fmtTime(c.last_message_at)}</span>
                      </div>
                      <div className="conv-item-preview">
                        {typing.length
                          ? <span style={{ color: 'var(--primary)', fontStyle: 'italic' }}>{t('isTyping', { name: typing[0] })}</span>
                          : c.last_message_preview || (isGroup ? t('members', { n: c.member_count ?? '' }) : t('startConversation'))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {panel === 'chats' && chatSubView === 'inbox' && <InboxPanel hideHeader />}
        {panel === 'profile' && <ProfilePanel />}

        {/* Bottom nav — Chats | [Camera] | Profile */}
        <nav className="sidebar-nav">
          <button className={`nav-tab${panel === 'chats' ? ' active' : ''}`} onClick={goToChats}>
            <span className="nav-icon"><ChatIcon active={panel === 'chats'} /></span>
            {t('chats')}
          </button>

          {/* Center camera button */}
          <button
            className="nav-tab nav-tab-qr"
            onClick={() => cameraInputRef.current?.click()}
            title={t('camera')}
          >
            <div className="nav-qr-btn">
              <AeroIcon name="camera" size={27} />
            </div>
            {t('camera')}
          </button>
          <input
            ref={cameraInputRef}
            type="file"
            accept="image/*,video/*"
            capture="environment"
            style={{ display: 'none' }}
            onChange={handleCameraCapture}
          />

          <button className={`nav-tab${panel === 'profile' ? ' active' : ''}`} onClick={() => dispatch({ type: 'SET_PANEL', panel: 'profile' })}>
            <span className="nav-icon">
              <div className={`nav-avatar-wrap${panel === 'profile' ? ' active' : ''}`}>
                <Avatar user={state.me} size="xs" />
              </div>
            </span>
            {t('profile')}
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
  return <AeroIcon name="chat" size={22} />
}
