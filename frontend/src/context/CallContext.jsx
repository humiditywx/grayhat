import { createContext, useContext, useReducer, useRef, useCallback, useEffect } from 'react'
import { useSocket } from './SocketContext.jsx'
import { useApp } from './AppContext.jsx'
const Ctx = createContext(null)

const init = {
  incomingCall: null, // { conversationId, callerId, callerName, callerAvatar, mode, title }
  active: false,
  callPhase: null, // 'dialing' | 'ringing' | 'connected'
  conversationId: null,
  mode: 'voice',
  title: '',
  partnerAvatar: null, // avatar of the person being called / caller
  participants: [], // [{ userId, username, avatar_url }]
  muted: false,
  camOff: false,
  screenSharing: false,
  startTime: null,
}

function reducer(s, a) {
  switch (a.type) {
    case 'INCOMING':  return { ...s, incomingCall: a.call }
    case 'CLEAR_INCOMING': return { ...s, incomingCall: null }
    case 'CALL_ACTIVE': return {
      ...s, active: true,
      callPhase: a.phase || 'connected',
      conversationId: a.conversationId, mode: a.mode, title: a.title,
      partnerAvatar: a.partnerAvatar ?? null,
      participants: a.participants || [],
      startTime: (!a.phase || a.phase === 'connected') ? Date.now() : null,
      incomingCall: null,
      screenSharing: false,
    }
    case 'SET_CALL_PHASE': return {
      ...s, callPhase: a.phase,
      startTime: a.phase === 'connected' ? Date.now() : s.startTime,
    }
    case 'CALL_ENDED': return { ...init }
    case 'SET_PARTICIPANTS': return { ...s, participants: a.participants }
    case 'PARTICIPANT_JOINED': {
      if (s.participants.find((p) => p.userId === a.participant.userId)) return s
      return { ...s, participants: [...s.participants, a.participant] }
    }
    case 'PARTICIPANT_LEFT':
      return { ...s, participants: s.participants.filter((p) => p.userId !== a.userId) }
    case 'TOGGLE_MUTE': return { ...s, muted: !s.muted }
    case 'TOGGLE_CAM': return { ...s, camOff: !s.camOff }
    case 'SET_SCREEN_SHARING': return { ...s, screenSharing: a.active }
    default: return s
  }
}

export function CallProvider({ children }) {
  const [call, dispatch] = useReducer(reducer, init)
  const { on, emit } = useSocket()
  const { state: appState } = useApp()
  // Keep fresh refs so socket event closures never go stale
  const meRef = useRef(null)
  const friendsRef = useRef([])
  useEffect(() => { meRef.current = appState.me }, [appState.me])
  useEffect(() => { friendsRef.current = appState.friends }, [appState.friends])

  // Track call phase + active + conversationId in refs so socket closures never go stale
  const callPhaseRef = useRef(null)
  const callActiveRef = useRef(false)
  const conversationIdRef = useRef(null)
  useEffect(() => { callPhaseRef.current = call.callPhase }, [call.callPhase])
  useEffect(() => { callActiveRef.current = call.active }, [call.active])
  useEffect(() => { conversationIdRef.current = call.conversationId }, [call.conversationId])

  // Emit call:start when transitioning to ringing; play callAnswer on connected
  useEffect(() => {
    if (!call.active) return
    if (call.callPhase === 'ringing' && isCallerRef.current) {
      emit('call:start', { conversation_id: call.conversationId, mode: call.mode })
    }
  }, [call.callPhase, call.active]) // eslint-disable-line

  const localStreamRef = useRef(null)
  const screenShareStreamRef = useRef(null)
  const peersRef = useRef(new Map())
  const localVideoRef = useRef(null)
  const remoteRefs = useRef(new Map())
  const iceServersRef = useRef([])
  const isCallerRef = useRef(false)
  useEffect(() => { iceServersRef.current = appState.iceServers }, [appState.iceServers])

  // Resolve a userId to a participant object using fresh refs
  const resolveUser = useCallback((userId) => {
    const me = meRef.current
    if (me && userId === me.id) return { userId: me.id, username: me.username, avatar_url: me.avatar_url }
    const friend = friendsRef.current.find((f) => f.id === userId)
    if (friend) return { userId: friend.id, username: friend.username, avatar_url: friend.avatar_url }
    return { userId, username: 'User', avatar_url: null }
  }, [])

  const createPeer = useCallback((userId, isInitiator) => {
    const servers = iceServersRef.current.length
      ? iceServersRef.current
      : [{ urls: 'stun:stun.l.google.com:19302' }]
    const pc = new RTCPeerConnection({ iceServers: servers })
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => pc.addTrack(t, localStreamRef.current))
    }
    pc.onicecandidate = ({ candidate }) => {
      if (candidate) emit('webrtc:ice-candidate', { target_user_id: userId, candidate })
    }
    pc.ontrack = ({ streams }) => {
      const el = remoteRefs.current.get(userId)
      if (el && streams[0]) el.srcObject = streams[0]
    }
    // Guard: only the designated initiator creates the offer; prevents both sides offering at once
    let makingOffer = false
    pc.onnegotiationneeded = async () => {
      if (!isInitiator || makingOffer) return
      try {
        makingOffer = true
        const offer = await pc.createOffer()
        if (pc.signalingState !== 'stable') return  // aborted while awaiting
        await pc.setLocalDescription(offer)
        emit('webrtc:offer', { target_user_id: userId, sdp: pc.localDescription })
      } catch (err) {
        console.warn('[WebRTC] onnegotiationneeded error:', err)
      } finally {
        makingOffer = false
      }
    }
    peersRef.current.set(userId, pc)
    return pc
  }, [emit])

  const cleanupPeer = useCallback((userId) => {
    peersRef.current.get(userId)?.close()
    peersRef.current.delete(userId)
    const el = remoteRefs.current.get(userId)
    if (el) el.srcObject = null
  }, [])

  const cleanupAll = useCallback(() => {
    peersRef.current.forEach((pc) => pc.close())
    peersRef.current.clear()
    localStreamRef.current?.getTracks().forEach((t) => t.stop())
    localStreamRef.current = null
    screenShareStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenShareStreamRef.current = null
    if (localVideoRef.current) localVideoRef.current.srcObject = null
  }, [])

  const startCall = useCallback(async (conversationId, mode, title, partnerAvatar = null) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      isCallerRef.current = true
      emit('call:join', { conversation_id: conversationId })
      dispatch({ type: 'CALL_ACTIVE', conversationId, mode, title, partnerAvatar, participants: [], phase: 'dialing' })
    } catch {
      alert('Could not access camera/microphone.')
    }
  }, [emit])

  const joinCall = useCallback(async (conversationId, mode, title, partnerAvatar = null) => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: mode === 'video' })
      localStreamRef.current = stream
      if (localVideoRef.current) localVideoRef.current.srcObject = stream
      isCallerRef.current = false
      emit('call:join', { conversation_id: conversationId })
      dispatch({ type: 'CALL_ACTIVE', conversationId, mode, title, partnerAvatar, participants: [] })
    } catch {
      alert('Could not access camera/microphone.')
    }
  }, [emit])

  const leaveCall = useCallback(() => {
    // Use ref so this never captures a stale conversationId
    emit('call:leave', { conversation_id: conversationIdRef.current })
    cleanupAll()
    dispatch({ type: 'CALL_ENDED' })
  }, [emit, cleanupAll])

  const stopAllCallSounds = useCallback(() => {}, [])

  const declineCall = useCallback(() => {
    if (call.incomingCall) {
      emit('call:decline', {
        conversation_id: call.incomingCall.conversationId,
        caller_user_id: call.incomingCall.callerId,
      })
    }
    dispatch({ type: 'CLEAR_INCOMING' })
  }, [emit, call.incomingCall])

  const toggleMute = useCallback(() => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = call.muted })
    dispatch({ type: 'TOGGLE_MUTE' })
  }, [call.muted])

  const toggleCamera = useCallback(() => {
    localStreamRef.current?.getVideoTracks().forEach((t) => { t.enabled = call.camOff })
    dispatch({ type: 'TOGGLE_CAM' })
  }, [call.camOff])

  // Stop screen share and restore camera video
  const stopScreenShare = useCallback(() => {
    screenShareStreamRef.current?.getTracks().forEach((t) => t.stop())
    screenShareStreamRef.current = null
    const cameraVideoTrack = localStreamRef.current?.getVideoTracks()[0]
    if (cameraVideoTrack) {
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(cameraVideoTrack).catch(() => {})
      }
    }
    if (localVideoRef.current && localStreamRef.current) {
      localVideoRef.current.srcObject = localStreamRef.current
    }
    dispatch({ type: 'SET_SCREEN_SHARING', active: false })
  }, [])

  // Start screen share: capture display, replace video track in all peer connections
  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false })
      const screenTrack = screenStream.getVideoTracks()[0]
      screenShareStreamRef.current = screenStream
      for (const pc of peersRef.current.values()) {
        const sender = pc.getSenders().find((s) => s.track?.kind === 'video')
        if (sender) sender.replaceTrack(screenTrack).catch(() => {})
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = screenStream
      // When the OS/browser stops the share (e.g. user clicks "stop sharing")
      screenTrack.onended = stopScreenShare
      dispatch({ type: 'SET_SCREEN_SHARING', active: true })
    } catch {
      // User cancelled or getDisplayMedia not supported — silently ignore
    }
  }, [stopScreenShare])

  useEffect(() => {
    const unsubs = [
      on('call:incoming', (data) => {
        dispatch({
          type: 'INCOMING',
          call: {
            conversationId: data.conversation_id,
            callerId: data.caller?.id,
            callerName: data.caller?.username,
            callerAvatar: data.caller?.avatar_url,
            mode: data.mode,
            title: data.conversation_title,
          },
        })
      }),

      on('call:participants', ({ participants }) => {
        if (!callActiveRef.current) return
        const resolved = (participants || []).map(resolveUser)
        dispatch({ type: 'SET_PARTICIPANTS', participants: resolved })
        resolved.forEach(({ userId }) => {
          if (userId !== meRef.current?.id && !peersRef.current.has(userId)) {
            // Deterministic initiator: the peer whose ID sorts lower sends the offer.
            // This guarantees exactly one side initiates for every pair, in any call size.
            const iAmInitiator = (meRef.current?.id ?? '') < userId
            createPeer(userId, iAmInitiator)
          }
        })
      }),

      on('call:participant-joined', ({ user_id }) => {
        if (!callActiveRef.current) return
        const p = resolveUser(user_id)
        dispatch({ type: 'PARTICIPANT_JOINED', participant: p })
        if (callPhaseRef.current === 'dialing' || callPhaseRef.current === 'ringing') {
          dispatch({ type: 'SET_CALL_PHASE', phase: 'connected' })
        }
        if (user_id !== meRef.current?.id && !peersRef.current.has(user_id)) {
          const iAmInitiator = (meRef.current?.id ?? '') < user_id
          createPeer(user_id, iAmInitiator)
        }
      }),

      on('call:participant-left', ({ user_id }) => {
        if (!callActiveRef.current) return
        dispatch({ type: 'PARTICIPANT_LEFT', userId: user_id })
        cleanupPeer(user_id)
      }),

      on('call:ended', () => { stopAllCallSounds(); cleanupAll(); dispatch({ type: 'CALL_ENDED' }) }),
      on('call:declined', () => { stopAllCallSounds(); cleanupAll(); dispatch({ type: 'CALL_ENDED' }) }),

      on('webrtc:offer', async ({ from_user_id, sdp }) => {
        if (!callActiveRef.current) return
        let pc = peersRef.current.get(from_user_id)
        // We received an offer, so we are the answerer — create peer as non-initiator
        if (!pc) pc = createPeer(from_user_id, false)
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(sdp))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          emit('webrtc:answer', { target_user_id: from_user_id, sdp: pc.localDescription })
        } catch (err) {
          console.warn('[WebRTC] offer handler error:', err)
        }
      }),

      on('webrtc:answer', async ({ from_user_id, sdp }) => {
        const pc = peersRef.current.get(from_user_id)
        if (!pc) return
        try { await pc.setRemoteDescription(new RTCSessionDescription(sdp)) } catch (err) {
          console.warn('[WebRTC] answer handler error:', err)
        }
      }),

      on('webrtc:ice-candidate', async ({ from_user_id, candidate }) => {
        const pc = peersRef.current.get(from_user_id)
        if (!pc) return
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)) } catch {}
      }),

      on('webrtc:hangup', ({ from_user_id }) => {
        cleanupPeer(from_user_id)
        dispatch({ type: 'PARTICIPANT_LEFT', userId: from_user_id })
      }),
    ]
    return () => unsubs.forEach((u) => u())
  }, [on, emit, createPeer, cleanupPeer, cleanupAll, resolveUser, stopAllCallSounds])

  return (
    <Ctx.Provider value={{
      call, dispatch,
      startCall, joinCall, leaveCall, declineCall,
      toggleMute, toggleCamera,
      startScreenShare, stopScreenShare,
      localVideoRef, localStreamRef, remoteRefs,
    }}>
      {children}
    </Ctx.Provider>
  )
}

export const useCall = () => useContext(Ctx)
