import { useEffect, useRef, useState, useCallback } from 'react'
import MessageBubble from './MessageBubble.jsx'
import { getMessages, markRead } from '../../api.js'
import { useSocket } from '../../context/SocketContext.jsx'

function fmtDate(iso) {
  const d = new Date(iso)
  const now = new Date()
  const diff = Math.floor((now - d) / 86400000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Yesterday'
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: diff > 300 ? 'numeric' : undefined })
}

function needsDateSep(messages, index) {
  if (index === 0) return true
  const prev = new Date(messages[index - 1].created_at)
  const curr = new Date(messages[index].created_at)
  return prev.toDateString() !== curr.toDateString()
}

export default function MessageList({ conv, me, onReply }) {
  const [messages, setMessages] = useState([])
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [initialLoad, setInitialLoad] = useState(true)
  const bottomRef = useRef(null)
  const listRef = useRef(null)
  const { joinConv, leaveConv, registerMsgHandler } = useSocket()
  const convId = conv.id
  const isGroup = conv.kind === 'group'

  const load = useCallback(async (before = null) => {
    try {
      const data = await getMessages(convId, before)
      const fetched = data.messages || []
      if (before) {
        setMessages((prev) => [...fetched, ...prev])
        setLoadingMore(false)
      } else {
        setMessages(fetched)
        setInitialLoad(false)
      }
      setHasMore(fetched.length === 50)
    } catch {
      setInitialLoad(false)
    }
  }, [convId])

  useEffect(() => {
    setMessages([])
    setInitialLoad(true)
    setHasMore(false)
    load()
    joinConv(convId)
    markRead(convId).catch(() => {})

    const unsub = registerMsgHandler(convId, (msg) => {
      setMessages((prev) => prev.find((m) => m.id === msg.id) ? prev : [...prev, msg])
      markRead(convId).catch(() => {})
    })

    return () => {
      leaveConv(convId)
      unsub()
    }
  }, [convId]) // eslint-disable-line

  // Socket events for edits/deletes/reactions
  const { on } = useSocket()
  useEffect(() => {
    const applyUpdate = (msg) => {
      if (msg.conversation_id !== convId) return
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    }
    const applyDelete = (msg) => {
      if (msg.conversation_id !== convId) return
      setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
    }
    const unsubs = [
      on('message:updated', applyUpdate),
      on('message:deleted', applyDelete),
      on('message:reaction', applyUpdate),
    ]
    return () => unsubs.forEach((u) => u())
  }, [on, convId])

  // Scroll to bottom after initial load (instant)
  useEffect(() => {
    if (!initialLoad) {
      requestAnimationFrame(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'instant' })
      })
    }
  }, [initialLoad])

  // Scroll to bottom on new incoming messages (smooth) if near bottom
  const prevLenRef = useRef(0)
  useEffect(() => {
    if (initialLoad) return
    if (messages.length > prevLenRef.current) {
      const el = listRef.current
      const nearBottom = !el || el.scrollHeight - el.scrollTop - el.clientHeight < 150
      if (nearBottom) {
        requestAnimationFrame(() => {
          bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
        })
      }
    }
    prevLenRef.current = messages.length
  }, [messages.length, initialLoad])

  // Preserve scroll on load-more
  const loadMore = async () => {
    if (!messages.length || loadingMore) return
    setLoadingMore(true)
    const prev = listRef.current?.scrollHeight || 0
    await load(messages[0].created_at)
    requestAnimationFrame(() => {
      if (listRef.current) {
        listRef.current.scrollTop = listRef.current.scrollHeight - prev
      }
    })
  }

  if (initialLoad) {
    return (
      <div className="message-list" style={{ alignItems: 'center', justifyContent: 'center' }}>
        <div className="spinner" />
      </div>
    )
  }

  return (
    <div className="message-list" ref={listRef}>
      {hasMore && (
        <button className="load-more-btn" onClick={loadMore} disabled={loadingMore}>
          {loadingMore ? 'Loading…' : 'Load earlier messages'}
        </button>
      )}

      {messages.length === 0 && (
        <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', margin: 'auto', padding: '24px 0' }}>
          No messages yet. Say hello! 👋
        </div>
      )}

      {messages.map((msg, i) => (
        <div key={msg.id}>
          {needsDateSep(messages, i) && (
            <div className="msg-date-sep">{fmtDate(msg.created_at)}</div>
          )}
          <MessageBubble
            msg={msg}
            isMine={msg.sender?.id === me.id}
            isGroup={isGroup}
            onUpdated={(updated) => setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m))}
            onDeleted={(updated) => setMessages((prev) => prev.map((m) => m.id === updated.id ? updated : m))}
            onReply={onReply}
          />
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  )
}
