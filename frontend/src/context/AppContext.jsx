import { createContext, useContext, useReducer, useCallback } from 'react'
import { toast as sonnerToast } from 'sonner'

const Ctx = createContext(null)

const initState = {
  // Auth
  authStatus: 'loading', // 'loading' | 'unauthenticated' | 'authenticated'
  me: null,
  requiresTotpSetup: false,
  iceServers: [],
  myUUID: '',
  myAddLink: '',

  // Data
  friends: [],
  conversations: [],
  stories: [],
  friendRequests: { incoming: [], outgoing: [] },
  onlineUsers: new Set(),
  typingUsers: {}, // { [convId]: { [userId]: username } }

  // UI
  panel: 'chats',
  selectedConvId: null,
  mobileChatOpen: false,

  // Dialogs
  addFriendOpen: false,
  createGroupOpen: false,
  groupInfoConvId: null,
  storyUploadOpen: false,

  // Full-screen user profile view
  profileViewUserId: null,

  // Route
  routeAction: null, // { type, payload }
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET_AUTH_STATUS':
      return { ...state, authStatus: action.status }

    case 'SET_ME':
      return { ...state, me: action.me, authStatus: 'authenticated', requiresTotpSetup: action.requiresTotpSetup ?? false }

    case 'LOGOUT':
      return { ...initState, authStatus: 'unauthenticated' }

    case 'BOOTSTRAP': {
      const { user, friends, conversations, ice_servers, my_uuid, my_add_link, story_groups, requires_totp_setup, friend_requests } = action.data
      return {
        ...state,
        me: user,
        requiresTotpSetup: requires_totp_setup ?? !user.totp_enabled,
        friends,
        conversations,
        stories: story_groups,
        iceServers: ice_servers || [],
        myUUID: my_uuid,
        myAddLink: my_add_link,
        friendRequests: friend_requests || { incoming: [], outgoing: [] },
      }
    }

    case 'SET_PANEL':
      return { ...state, panel: action.panel, selectedConvId: action.convId ?? state.selectedConvId }

    case 'SELECT_CONV':
      return { ...state, selectedConvId: action.convId, panel: 'chats', mobileChatOpen: true }

    case 'CLOSE_CHAT':
      return { ...state, mobileChatOpen: false, selectedConvId: null }

    case 'ADD_FRIEND': {
      const exists = state.friends.some((f) => f.id === action.friend.id)
      if (exists) return state
      return { ...state, friends: [...state.friends, action.friend].sort((a, b) => a.username.localeCompare(b.username)) }
    }

    case 'REMOVE_FRIEND':
      return { ...state, friends: state.friends.filter((f) => f.id !== action.friendId) }

    case 'UPDATE_FRIEND_AVATAR': {
      return {
        ...state,
        friends: state.friends.map((f) =>
          f.id === action.userId ? { ...f, avatar_url: `/api/users/${action.userId}/avatar?t=${Date.now()}` } : f
        ),
      }
    }

    case 'ADD_CONVERSATION': {
      const exists = state.conversations.some((c) => c.id === action.conv.id)
      if (exists) return state
      return { ...state, conversations: [action.conv, ...state.conversations] }
    }

    case 'UPDATE_CONVERSATION': {
      const exists = state.conversations.some((c) => c.id === action.conv.id)
      if (!exists) return { ...state, conversations: [action.conv, ...state.conversations] }
      return {
        ...state,
        conversations: state.conversations.map((c) => (c.id === action.conv.id ? { ...c, ...action.conv } : c)),
      }
    }

    case 'REMOVE_CONVERSATION':
      return {
        ...state,
        conversations: state.conversations.filter((c) => c.id !== action.convId),
        selectedConvId: state.selectedConvId === action.convId ? null : state.selectedConvId,
        mobileChatOpen: state.selectedConvId === action.convId ? false : state.mobileChatOpen,
      }

    case 'MSG_PREVIEW': {
      return {
        ...state,
        conversations: state.conversations.map((c) =>
          c.id === action.convId
            ? { ...c, last_message_at: action.createdAt, last_message_preview: action.preview }
            : c
        ),
      }
    }

    case 'SET_ONLINE': {
      const s = new Set(state.onlineUsers)
      s.add(action.userId)
      return { ...state, onlineUsers: s }
    }

    case 'SET_OFFLINE': {
      const s = new Set(state.onlineUsers)
      s.delete(action.userId)
      return { ...state, onlineUsers: s }
    }

    case 'PRESENCE_SNAPSHOT':
      return { ...state, onlineUsers: new Set(action.userIds) }

    case 'TYPING_START': {
      const existing = state.typingUsers[action.convId] || {}
      return { ...state, typingUsers: { ...state.typingUsers, [action.convId]: { ...existing, [action.userId]: action.username } } }
    }

    case 'TYPING_STOP': {
      const existing = { ...(state.typingUsers[action.convId] || {}) }
      delete existing[action.userId]
      return { ...state, typingUsers: { ...state.typingUsers, [action.convId]: existing } }
    }

    case 'ADD_STORY': {
      const groups = [...state.stories]
      const idx = groups.findIndex((g) => g.user_id === action.story.user_id)
      if (idx >= 0) {
        const updated = { ...groups[idx], stories: [...groups[idx].stories, action.story] }
        groups[idx] = updated
      } else {
        groups.push({ user_id: action.story.user_id, username: action.story.username, avatar_url: action.story.avatar_url, stories: [action.story] })
      }
      return { ...state, stories: groups }
    }

    case 'REFRESH_STORIES':
      return { ...state, stories: action.stories }

    case 'UPDATE_MY_AVATAR': {
      const ts = Date.now()
      return { ...state, me: { ...state.me, avatar_url: `/api/users/${state.me.id}/avatar?t=${ts}` } }
    }

    case 'UPDATE_ME':
      return { ...state, me: { ...state.me, ...action.patch } }

    case 'SET_REQUIRES_TOTP':
      return { ...state, requiresTotpSetup: action.value }

    case 'OPEN_DIALOG':
      return { ...state, [action.key]: action.value ?? true }

    case 'CLOSE_DIALOG':
      return { ...state, [action.key]: false }

    case 'ADD_INCOMING_REQUEST': {
      const exists = state.friendRequests.incoming.some((r) => r.id === action.request.id)
      if (exists) return state
      return { ...state, friendRequests: { ...state.friendRequests, incoming: [...state.friendRequests.incoming, action.request] } }
    }

    case 'REMOVE_INCOMING_REQUEST':
      return { ...state, friendRequests: { ...state.friendRequests, incoming: state.friendRequests.incoming.filter((r) => r.id !== action.requestId) } }

    case 'ADD_OUTGOING_REQUEST': {
      const exists = state.friendRequests.outgoing.some((r) => r.id === action.request.id)
      if (exists) return state
      return { ...state, friendRequests: { ...state.friendRequests, outgoing: [...state.friendRequests.outgoing, action.request] } }
    }

    case 'REMOVE_OUTGOING_REQUEST':
      return { ...state, friendRequests: { ...state.friendRequests, outgoing: state.friendRequests.outgoing.filter((r) => r.id !== action.requestId) } }

    case 'VIEW_PROFILE':
      return { ...state, profileViewUserId: action.userId }

    case 'CLOSE_PROFILE':
      return { ...state, profileViewUserId: null }

    case 'SET_ROUTE_ACTION':
      return { ...state, routeAction: action.action }

    case 'CLEAR_ROUTE_ACTION':
      return { ...state, routeAction: null }

    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initState)

  const toast = useCallback((message, kind = 'info') => {
    if (kind === 'success') sonnerToast.success(message)
    else if (kind === 'error') sonnerToast.error(message)
    else sonnerToast(message)
  }, [])

  return (
    <Ctx.Provider value={{ state, dispatch, toast }}>
      {children}
    </Ctx.Provider>
  )
}

export const useApp = () => useContext(Ctx)
