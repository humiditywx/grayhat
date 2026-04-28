import { createContext, useContext, useEffect, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { useApp } from './AppContext.jsx'
const Ctx = createContext(null)

const msgHandlers = new Map() // convId → (msg) => void
const callHandlers = new Map()
const eventBus = new Map()   // event name → Set<handler>

export function SocketProvider({ children }) {
  const { state, dispatch, toast } = useApp()
  const socketRef = useRef(null)
  const selectedConvIdRef = useRef(null)
  const meIdRef = useRef(null)
  useEffect(() => { selectedConvIdRef.current = state.selectedConvId }, [state.selectedConvId])
  useEffect(() => { meIdRef.current = state.me?.id }, [state.me])

  const emit = useCallback((event, ...args) => {
    socketRef.current?.emit(event, ...args)
  }, [])

  const on = useCallback((event, handler) => {
    if (!eventBus.has(event)) eventBus.set(event, new Set())
    eventBus.get(event).add(handler)
    return () => eventBus.get(event)?.delete(handler)
  }, [])

  useEffect(() => {
    if (state.authStatus !== 'authenticated') return

    const socket = io({ transports: ['websocket', 'polling'], withCredentials: true })
    socketRef.current = socket

    socket.on('socket:ready', () => {
      socket.emit('presence:request')
    })

    socket.on('user:online', ({ user_id }) => dispatch({ type: 'SET_ONLINE', userId: user_id }))
    socket.on('user:offline', ({ user_id }) => dispatch({ type: 'SET_OFFLINE', userId: user_id }))
    socket.on('presence:snapshot', ({ online }) => dispatch({ type: 'PRESENCE_SNAPSHOT', userIds: online }))

    socket.on('typing:start', ({ conversation_id, user_id, username }) => {
      dispatch({ type: 'TYPING_START', convId: conversation_id, userId: user_id, username })
    })
    socket.on('typing:stop', ({ conversation_id, user_id }) => {
      dispatch({ type: 'TYPING_STOP', convId: conversation_id, userId: user_id })
    })

    socket.on('message:new', (data) => {
      // Server wraps message: { message: {...} }
      const msg = data?.message ?? data
      const handler = msgHandlers.get(msg.conversation_id)
      handler?.(msg)
      dispatch({
        type: 'MSG_PREVIEW',
        convId: msg.conversation_id,
        createdAt: msg.created_at,
        preview: msg.message_type === 'text' ? (msg.body || '').slice(0, 80) :
                 msg.message_type === 'voice' ? 'Voice message' : 'Attachment',
      })
      // Play receive sound for ALL incoming messages from other people
      if (msg.sender?.id !== meIdRef.current) {
        // Only show the banner for background (non-active) conversations
        if (msg.conversation_id !== selectedConvIdRef.current) {
          eventBus.get('message:new:background')?.forEach((h) => h(msg))
        }
      }
    })

    socket.on('message:updated', (msg) => {
      eventBus.get('message:updated')?.forEach((h) => h(msg))
    })
    socket.on('message:deleted', (msg) => {
      eventBus.get('message:deleted')?.forEach((h) => h(msg))
    })
    socket.on('message:reaction', (msg) => {
      eventBus.get('message:reaction')?.forEach((h) => h(msg))
    })

    socket.on('friend:request', (data) => {
      dispatch({ type: 'ADD_INCOMING_REQUEST', request: data.request })
      eventBus.get('friend:request')?.forEach((h) => h(data))
    })
    socket.on('friend:request:accepted', (data) => {
      // data: { request_id, friend, conversation }
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: data.request_id })
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: data.request_id })
      if (data.friend) dispatch({ type: 'ADD_FRIEND', friend: data.friend })
      if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      eventBus.get('friend:request:accepted')?.forEach((h) => h(data))
    })
    socket.on('friend:request:declined', ({ request_id }) => {
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: request_id })
    })
    socket.on('friend:request:cancelled', ({ request_id }) => {
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: request_id })
    })
    socket.on('friend:removed', ({ friend_id }) => {
      dispatch({ type: 'REMOVE_FRIEND', friendId: friend_id })
    })
    socket.on('user:avatar_updated', ({ user_id }) => {
      dispatch({ type: 'UPDATE_FRIEND_AVATAR', userId: user_id })
    })

    socket.on('conversation:updated', (conv) => {
      dispatch({ type: 'UPDATE_CONVERSATION', conv })
    })
    socket.on('conversation:deleted', ({ conversation_id }) => {
      dispatch({ type: 'REMOVE_CONVERSATION', convId: conversation_id })
    })

    socket.on('conversation:read', (data) => {
      dispatch({ type: 'UPDATE_CONVERSATION', conv: { id: data.conversation_id, ...data } })
    })

    socket.on('story:new', (story) => {
      dispatch({ type: 'ADD_STORY', story })
    })

    // Call events forwarded to callHandlers
    ;['call:incoming','call:participants','call:participant-joined','call:participant-left',
      'call:declined','call:ended','webrtc:offer','webrtc:answer','webrtc:ice-candidate','webrtc:hangup',
    ].forEach((ev) => {
      socket.on(ev, (data) => eventBus.get(ev)?.forEach((h) => h(data)))
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [state.authStatus]) // eslint-disable-line

  const joinConv = useCallback((convId) => emit('conversation:join', { conversation_id: convId }), [emit])
  const leaveConv = useCallback((convId) => emit('conversation:leave', { conversation_id: convId }), [emit])
  const startTyping = useCallback((convId) => emit('typing:start', { conversation_id: convId }), [emit])
  const stopTyping = useCallback((convId) => emit('typing:stop', { conversation_id: convId }), [emit])

  const registerMsgHandler = useCallback((convId, handler) => {
    msgHandlers.set(convId, handler)
    return () => msgHandlers.delete(convId)
  }, [])

  return (
    <Ctx.Provider value={{ emit, on, joinConv, leaveConv, startTyping, stopTyping, registerMsgHandler }}>
      {children}
    </Ctx.Provider>
  )
}

export const useSocket = () => useContext(Ctx)
