function getCsrf() {
  return (
    document.cookie
      .split('; ')
      .find((r) => r.startsWith('csrf_access_token='))
      ?.split('=')[1] || ''
  )
}

async function request(url, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  const headers = { ...options.headers }
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }
  if (!['GET', 'HEAD'].includes(method)) {
    headers['X-CSRF-TOKEN'] = getCsrf()
  }
  const res = await fetch(url, { ...options, headers, credentials: 'include' })
  if (res.status === 204) return null
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || data.message || `HTTP ${res.status}`)
  return data
}

const get  = (url) => request(url)
const post = (url, body) => request(url, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) })
const patch = (url, body) => request(url, { method: 'PATCH', body: JSON.stringify(body) })
const del  = (url) => request(url, { method: 'DELETE' })

// Auth
export const authMe           = () => get('/api/auth/me')
export const authLogin        = (b) => post('/api/auth/login', b)
export const authRegister     = (b) => post('/api/auth/register', b)
export const sendOtp          = (email) => post('/api/auth/otp/send', { email })
export const verifyOtp        = (email, code) => post('/api/auth/otp/verify', { email, code })
export const completeRegister = (b, token) => request('/api/auth/register/complete', { method: 'POST', body: JSON.stringify(b), headers: { 'Authorization': `Bearer ${token}` } })
export const authLogout       = () => post('/api/auth/logout', {})
export const totpSetup     = () => post('/api/auth/totp/setup', {})
export const totpConfirm   = (code) => post('/api/auth/totp/confirm', { code })
export const passwordReset = (b) => post('/api/auth/password-reset', b)
export const passwordChange= (b) => post('/api/auth/password-change', b)

// Bootstrap
export const bootstrap     = () => get('/api/bootstrap')

// Friends
export const listFriends          = () => get('/api/friends')
export const addFriend            = (b) => post('/api/friends', b)  // backward compat alias
export const sendFriendRequest    = (b) => post('/api/friends', b)
export const removeFriend         = (id) => del(`/api/friends/${id}`)
export const scanQrImage          = (fd) => post('/api/friends/scan-image', fd)
export const getFriendRequests    = () => get('/api/friends/requests')
export const acceptFriendRequest  = (id) => post(`/api/friends/requests/${id}/accept`, {})
export const declineFriendRequest = (id) => post(`/api/friends/requests/${id}/decline`, {})
export const cancelFriendRequest  = (id) => del(`/api/friends/requests/${id}`)

// Conversations
export const listConvs     = () => get('/api/conversations')
export const openPrivate   = (friendId) => post(`/api/conversations/private/${friendId}`, {})
export const createGroup   = (b) => post('/api/conversations/groups', b)
export const joinGroup     = (token) => post(`/api/groups/join/${token}`, {})
export const getGroupPublic= (token) => get(`/api/groups/${token}/public`)
export const leaveConv     = (id) => del(`/api/conversations/${id}/membership`)

// Messages
export const getMessages   = (id, before) => get(`/api/conversations/${id}/messages?limit=50${before ? `&before=${before}` : ''}`)
export const sendMessage   = (id, body, replyToId) => post(`/api/conversations/${id}/messages`, { body, ...(replyToId ? { reply_to_id: replyToId } : {}) })
export const sendAttachment= (id, fd) => post(`/api/conversations/${id}/attachments`, fd)
export const editMessage   = (id, body) => patch(`/api/messages/${id}`, { body })
export const deleteMessage  = (id) => del(`/api/messages/${id}`)
export const reactMessage  = (id) => post(`/api/messages/${id}/react`, {})
export const markRead      = (id) => post(`/api/conversations/${id}/read`, {})

// Members
export const getMembers    = (id) => get(`/api/conversations/${id}/members`)
export const addMember     = (id, b) => post(`/api/conversations/${id}/members`, b)
export const uploadGroupIcon=(id, fd) => post(`/api/conversations/${id}/icon`, fd)

// Avatar
export const uploadAvatar  = (fd) => post('/api/users/me/avatar', fd)

// Profile
export const updateProfile  = (b) => patch('/api/users/me/profile', b)
export const changeUsername = (b) => patch('/api/users/me/username', b)
export const getUserProfile = (id) => get(`/api/users/${id}/profile`)

// Stories
export const getStories      = () => get('/api/stories')
export const postStory       = (fd) => post('/api/stories', fd)
export const deleteStory     = (id) => del(`/api/stories/${id}`)
export const replyStory      = (id, body) => post(`/api/stories/${id}/reply`, { body })
export const viewStory       = (id) => post(`/api/stories/${id}/view`, {})
export const getStoryViews   = (id) => get(`/api/stories/${id}/views`)

/** Upload a story with XHR so upload progress can be tracked. */
export const postStoryWithProgress = (fd, onProgress) =>
  new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', '/api/stories')
    xhr.setRequestHeader('X-CSRF-TOKEN', getCsrf())
    xhr.withCredentials = true
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      let data = {}
      try { data = JSON.parse(xhr.responseText) } catch { /* */ }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(data)
      } else {
        reject(new Error(data.error || `HTTP ${xhr.status}`))
      }
    }
    xhr.onerror = () => reject(new Error('Upload failed'))
    xhr.send(fd)
  })
