import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext.jsx'
import { adminListUsers, adminToggleBan, adminResetPassword, adminGetAuditLogs } from '../../api.js'
import Avatar from '../common/Avatar.jsx'
import AeroIcon from '../icons/AeroIcon.jsx'

function UsersTab({ toast }) {
  const [users, setUsers] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(false)

  const loadUsers = async (p = page, s = search) => {
    setLoading(true)
    try {
      const data = await adminListUsers(p, s)
      setUsers(data.users)
      setTotalPages(data.pages)
      setPage(data.current_page)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadUsers()
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    loadUsers(1, search)
  }

  const handleToggleBan = async (user) => {
    try {
      await adminToggleBan(user.id, !user.is_banned)
      toast(`User ${!user.is_banned ? 'banned' : 'unbanned'} successfully.`, 'success')
      setUsers(users.map(u => u.id === user.id ? { ...u, is_banned: !user.is_banned } : u))
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  const handleResetPassword = async (user) => {
    if (!window.confirm(`Are you sure you want to force reset the password for ${user.username}?`)) return
    try {
      const data = await adminResetPassword(user.id)
      toast(`Password reset! New password: ${data.new_password}`, 'success', 10000)
    } catch (err) {
      toast(err.message, 'error')
    }
  }

  return (
    <div className="admin-tab-content">
      <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <input 
          className="input" 
          value={search} 
          onChange={e => setSearch(e.target.value)} 
          placeholder="Search by username or email..."
          style={{ flex: 1 }}
        />
        <button type="submit" className="btn btn-primary">Search</button>
      </form>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
      ) : (
        <div className="admin-list">
          {users.map(u => (
            <div key={u.id} className="admin-list-item" style={{ display: 'flex', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
              <Avatar user={u} size="sm" />
              <div style={{ flex: 1, marginLeft: 12 }}>
                <div style={{ fontWeight: 600 }}>{u.username || 'No username'} {u.is_banned && <span style={{ color: 'red', fontSize: '0.8em' }}>(Banned)</span>}</div>
                <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{u.email}</div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className={`btn btn-sm ${u.is_banned ? 'btn-primary' : 'btn-danger'}`} onClick={() => handleToggleBan(u)}>
                  {u.is_banned ? 'Unban' : 'Ban'}
                </button>
                <button className="btn btn-sm" onClick={() => handleResetPassword(u)}>Reset Password</button>
              </div>
            </div>
          ))}
          {users.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No users found.</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => loadUsers(page - 1, search)}>Previous</button>
        <span style={{ display: 'flex', alignItems: 'center' }}>Page {page} of {totalPages}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => loadUsers(page + 1, search)}>Next</button>
      </div>
    </div>
  )
}

function AuditLogsTab({ toast }) {
  const [logs, setLogs] = useState([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(false)

  const loadLogs = async (p = page) => {
    setLoading(true)
    try {
      const data = await adminGetAuditLogs(p)
      setLogs(data.logs)
      setTotalPages(data.pages)
      setPage(data.current_page)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadLogs()
  }, [])

  return (
    <div className="admin-tab-content">
      {loading ? (
        <div style={{ textAlign: 'center', padding: 20 }}>Loading...</div>
      ) : (
        <div className="admin-list" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {logs.map(log => (
            <div key={log.id} style={{ padding: 12, border: '1px solid var(--border)', borderRadius: 'var(--r-md)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontWeight: 600 }}>{log.action}</span>
                <span style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)' }}>{new Date(log.created_at).toLocaleString()}</span>
              </div>
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
                {log.admin_username && <div><strong>Admin:</strong> {log.admin_username}</div>}
                {log.target_username && <div><strong>Target:</strong> {log.target_username}</div>}
                {log.details && Object.keys(log.details).length > 0 && (
                  <pre style={{ margin: '8px 0 0 0', padding: 8, background: 'var(--bg)', borderRadius: 'var(--r-sm)', fontSize: '11px', overflowX: 'auto' }}>
                    {JSON.stringify(log.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          ))}
          {logs.length === 0 && <div style={{ textAlign: 'center', padding: 20, color: 'var(--text-3)' }}>No logs found.</div>}
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 16 }}>
        <button className="btn btn-sm" disabled={page <= 1} onClick={() => loadLogs(page - 1)}>Previous</button>
        <span style={{ display: 'flex', alignItems: 'center' }}>Page {page} of {totalPages}</span>
        <button className="btn btn-sm" disabled={page >= totalPages} onClick={() => loadLogs(page + 1)}>Next</button>
      </div>
    </div>
  )
}

export default function AdminPanel() {
  const { toast } = useApp()
  const [tab, setTab] = useState('users') // 'users' | 'audit'

  return (
    <div className="chat-pane" style={{ background: 'var(--surface)' }}>
      <div className="chat-pane-header">
        <div className="chat-pane-header-title">
          <span style={{ fontSize: '18px', fontWeight: 600 }}>Admin Panel</span>
        </div>
      </div>
      
      <div style={{ padding: 16, display: 'flex', gap: 8, borderBottom: '1px solid var(--border)' }}>
        <button 
          className={`btn ${tab === 'users' ? 'btn-primary' : ''}`}
          onClick={() => setTab('users')}
        >
          Users
        </button>
        <button 
          className={`btn ${tab === 'audit' ? 'btn-primary' : ''}`}
          onClick={() => setTab('audit')}
        >
          Audit Logs
        </button>
      </div>
      
      <div className="chat-pane-body" style={{ padding: 16, overflowY: 'auto' }}>
        {tab === 'users' && <UsersTab toast={toast} />}
        {tab === 'audit' && <AuditLogsTab toast={toast} />}
      </div>
    </div>
  )
}
