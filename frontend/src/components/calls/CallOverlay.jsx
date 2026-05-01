import { useState, useEffect, useRef, useCallback } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useCall } from '../../context/CallContext.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Mic, MicOff, MonitorUp, PhoneOff, Video, Volume2, VolumeX } from 'lucide-react'
function fmt(ms) {
  const s = Math.floor(ms / 1000)
  const m = Math.floor(s / 60)
  const h = Math.floor(m / 60)
  if (h) return `${h}:${String(m % 60).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
  return `${String(m).padStart(2,'0')}:${String(s % 60).padStart(2,'0')}`
}

export default function CallOverlay() {
  const {
    call, leaveCall: _leaveCall, toggleMute, toggleCamera,
    startScreenShare, stopScreenShare,
    localVideoRef, localStreamRef, remoteRefs, dispatch,
  } = useCall()
  const { state } = useApp()
  const leaveCall = () => { _leaveCall() }
  const [elapsed, setElapsed] = useState(0)
  const [speakerOn, setSpeakerOn] = useState(false)
  const [spotlightUserId, setSpotlightUserId] = useState(null)
  const dialTimerRef = useRef(null)

  // Dialing → ringing timer
  useEffect(() => {
    if (!call.active) return
    if (call.callPhase === 'dialing') {
      dialTimerRef.current = setTimeout(() => {
        dispatch({ type: 'SET_CALL_PHASE', phase: 'ringing' })
      }, 3500)
      return () => clearTimeout(dialTimerRef.current)
    }
  }, [call.callPhase, call.active]) // eslint-disable-line

  // Elapsed timer
  useEffect(() => {
    if (!call.active || call.callPhase !== 'connected' || !call.startTime) return
    const id = setInterval(() => setElapsed(Date.now() - call.startTime), 1000)
    return () => clearInterval(id)
  }, [call.active, call.callPhase, call.startTime])

  // Clear dialing timer on call end
  useEffect(() => {
    if (!call.active) clearTimeout(dialTimerRef.current)
  }, [call.active]) // eslint-disable-line

  // Speaker toggle — route audio output on all remote video elements
  const toggleSpeaker = useCallback(() => {
    const next = !speakerOn
    setSpeakerOn(next)
    remoteRefs.current.forEach((el) => {
      if (el?.setSinkId) {
        // '' = default output (speaker/headphones); 'communications' = earpiece on some platforms
        el.setSinkId(next ? '' : 'communications').catch(() => {})
      }
    })
  }, [speakerOn, remoteRefs])

  if (!call.active) return null

  // ── Pre-connect screen ────────────────────────────────────
  if (call.callPhase === 'dialing' || call.callPhase === 'ringing') {
    return (
      <div className="call-overlay call-preconnect">
        <div className="call-preconnect-body">
          <div className="call-preconnect-avatar">
            <Avatar user={{ username: call.title, avatar_url: call.partnerAvatar }} size="xl" />
            <div className={`call-preconnect-pulse${call.callPhase === 'ringing' ? ' ringing' : ''}`} />
          </div>
          <div className="call-preconnect-name">{call.title}</div>
          <div className="call-preconnect-phase">{call.callPhase === 'dialing' ? 'Dialing…' : 'Ringing…'}</div>
          <div className="call-preconnect-mode">{call.mode === 'video' ? '📹 Video call' : '🎙 Voice call'}</div>
        </div>
        <div className="call-controls">
          <Button type="button" className="call-ctrl-btn danger" onClick={leaveCall}>
            <PhoneOff size={22} />
            <span style={{ fontSize:9 }}>Cancel</span>
          </Button>
        </div>
      </div>
    )
  }

  // ── Connected screen ──────────────────────────────────────
  const peers = call.participants
  const totalPeers = peers.length + 1  // +1 for self

  // Layout: single | duo (2, top+bottom) | trio (3, 1 top + 2 bottom) | quad (4, 2×2) | crowd (5+, spotlight+strip)
  const layoutClass = totalPeers <= 1 ? 'single'
    : totalPeers === 2 ? 'duo'
    : totalPeers === 3 ? 'trio'
    : totalPeers === 4 ? 'quad'
    : 'crowd'
  const isCrowd = layoutClass === 'crowd'

  // Crowd: pick spotlight (default first remote peer)
  const spotlightPeer = isCrowd
    ? (peers.find((p) => p.userId === spotlightUserId) ?? peers[0] ?? null)
    : null

  return (
    <div className="call-overlay">
      <div className="call-header">
        <div>
          <div className="call-title">{call.title}</div>
          <div className="call-duration">{fmt(elapsed)}</div>
        </div>
        <div style={{ fontSize:'var(--text-xs)', color:'rgba(255,255,255,.5)' }}>
          {totalPeers} participant{totalPeers !== 1 ? 's' : ''}
        </div>
      </div>

      {isCrowd ? (
        /* ── Crowd layout: spotlight + scrollable mini strip ── */
        <div className="call-crowd">
          <div className="call-spotlight-area">
            {spotlightPeer && (
              <RemoteTile participant={spotlightPeer} mode={call.mode} remoteRefs={remoteRefs} />
            )}
          </div>
          <div className="call-mini-strip">
            <MiniSelfTile mode={call.mode} localVideoRef={localVideoRef} localStreamRef={localStreamRef} me={state.me} />
            {peers
              .filter((p) => p.userId !== spotlightPeer?.userId)
              .map((p) => (
                <MiniRemoteTile
                  key={p.userId} participant={p} mode={call.mode} remoteRefs={remoteRefs}
                  onClick={() => setSpotlightUserId(p.userId)}
                />
              ))
            }
          </div>
        </div>
      ) : (
        /* ── Grid layout: single / duo / trio / quad ── */
        <div className={`call-video-grid ${layoutClass}`}>
          <LocalTile mode={call.mode} localVideoRef={localVideoRef} localStreamRef={localStreamRef} me={state.me} muted={call.muted} />
          {peers.map((p) => (
            <RemoteTile key={p.userId} participant={p} mode={call.mode} remoteRefs={remoteRefs} />
          ))}
        </div>
      )}

      <div className="call-controls">
        <CallCtrl active={call.muted} onClick={toggleMute} label={call.muted ? 'Unmute' : 'Mute'} icon={call.muted ? MicOff : Mic} />
        {call.mode === 'video' && (
          <CallCtrl active={call.camOff} onClick={toggleCamera} label={call.camOff ? 'Cam On' : 'Cam Off'} icon={Video} />
        )}
        {call.mode === 'video' && (
          <CallCtrl
            active={call.screenSharing}
            onClick={call.screenSharing ? stopScreenShare : startScreenShare}
            label={call.screenSharing ? 'Stop Share' : 'Share'}
            icon={MonitorUp}
          />
        )}
        {call.mode === 'voice' && (
          <CallCtrl
            active={speakerOn}
            onClick={toggleSpeaker}
            label={speakerOn ? 'Speaker' : 'Earpiece'}
            icon={speakerOn ? Volume2 : VolumeX}
          />
        )}
        <Button type="button" className="call-ctrl-btn danger" onClick={leaveCall}>
          <PhoneOff size={22} />
          <span style={{ fontSize:9 }}>End</span>
        </Button>
      </div>
    </div>
  )
}

// ── Tile components ───────────────────────────────────────────────────────────

/**
 * Local (self) tile — callback ref sets srcObject immediately on mount
 * so it works even before the phase transitions to "connected"
 */
function LocalTile({ mode, localVideoRef, localStreamRef, me, muted }) {
  const setRef = useCallback((el) => {
    if (el) {
      localVideoRef.current = el
      if (localStreamRef.current) el.srcObject = localStreamRef.current
    }
  }, []) // eslint-disable-line

  return (
    <div className="call-video-tile">
      {/* Always mounted — WebRTC needs a real DOM sink; hidden in voice mode */}
      <video ref={setRef} autoPlay playsInline muted className="call-video-el"
        style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)',
                 display: mode === 'video' ? 'block' : 'none' }} />
      {mode !== 'video' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'rgba(255,255,255,.7)' }}>
          <Avatar user={me} size="lg" />
          <span style={{ fontSize:'var(--text-sm)' }}>{me?.username}</span>
        </div>
      )}
      <div className="call-tile-name">You {muted ? '🔇' : ''}</div>
    </div>
  )
}

/**
 * Remote peer tile — carries over srcObject on remount (e.g. layout changes)
 */
function RemoteTile({ participant, mode, remoteRefs }) {
  const setRef = useCallback((el) => {
    if (el) {
      // Carry over existing stream if element is remounting
      const prev = remoteRefs.current.get(participant.userId)
      if (prev?.srcObject) el.srcObject = prev.srcObject
      remoteRefs.current.set(participant.userId, el)
    } else {
      remoteRefs.current.delete(participant.userId)
    }
  }, [participant.userId]) // eslint-disable-line

  return (
    <div className="call-video-tile">
      <video ref={setRef} autoPlay playsInline className="call-video-el"
        style={{ width:'100%', height:'100%', objectFit:'cover',
                 display: mode === 'video' ? 'block' : 'none' }} />
      {mode !== 'video' && (
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:8, color:'rgba(255,255,255,.7)' }}>
          <Avatar user={{ username:participant.username, avatar_url:participant.avatar_url }} size="lg" />
          <span style={{ fontSize:'var(--text-sm)' }}>{participant.username}</span>
        </div>
      )}
      <div className="call-tile-name">{participant.username}</div>
    </div>
  )
}

/** Self mini tile for crowd layout */
function MiniSelfTile({ mode, localVideoRef, localStreamRef, me }) {
  const setRef = useCallback((el) => {
    if (el) {
      localVideoRef.current = el
      if (localStreamRef.current) el.srcObject = localStreamRef.current
    }
  }, []) // eslint-disable-line

  return (
    <div className="call-mini-tile">
      {mode === 'video'
        ? <video ref={setRef} autoPlay playsInline muted
            style={{ width:'100%', height:'100%', objectFit:'cover', transform:'scaleX(-1)' }} />
        : <Avatar user={me} size="xs" />
      }
      <div className="call-mini-tile-name">You</div>
    </div>
  )
}

/** Remote mini tile for crowd layout — tap to spotlight */
function MiniRemoteTile({ participant, mode, remoteRefs, onClick }) {
  const setRef = useCallback((el) => {
    if (el) {
      const prev = remoteRefs.current.get(participant.userId)
      if (prev?.srcObject) el.srcObject = prev.srcObject
      remoteRefs.current.set(participant.userId, el)
    } else {
      remoteRefs.current.delete(participant.userId)
    }
  }, [participant.userId]) // eslint-disable-line

  return (
    <div className="call-mini-tile" onClick={onClick}>
      {mode === 'video'
        ? <video ref={setRef} autoPlay playsInline
            style={{ width:'100%', height:'100%', objectFit:'cover' }} />
        : <Avatar user={{ username:participant.username, avatar_url:participant.avatar_url }} size="xs" />
      }
      <div className="call-mini-tile-name">{participant.username}</div>
    </div>
  )
}

// ── Control button ────────────────────────────────────────────────────────────

function CallCtrl({ active, onClick, label, icon: Icon }) {
  return (
    <Button type="button" className={`call-ctrl-btn${active ? ' active' : ''}`} onClick={onClick}>
      <Icon size={22} />
      <span style={{ fontSize:9 }}>{label}</span>
    </Button>
  )
}
