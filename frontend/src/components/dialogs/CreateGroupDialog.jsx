import { useState } from 'react'
import Modal from '../common/Modal.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { createGroup } from '../../api.js'

export default function CreateGroupDialog({ onClose }) {
  const { dispatch, toast } = useApp()
  const [form, setForm] = useState({ title: '', description: '', is_public: true })
  const [busy, setBusy] = useState(false)

  const handle = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return
    setBusy(true)
    try {
      const data = await createGroup(form)
      dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      dispatch({ type: 'SELECT_CONV', convId: data.conversation.id })
      toast('Group created!', 'success')
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal title="Create Group" onClose={onClose}>
      <form onSubmit={handle} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="field">
          <label className="field-label">Group name *</label>
          <input className="field-input" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My group" autoFocus />
        </div>
        <div className="field">
          <label className="field-label">Description (optional)</label>
          <input className="field-input" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's this group about?" />
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 'var(--text-sm)', color: 'var(--text-2)' }}>
          <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
          Public group (joinable via invite link)
        </label>
        <button className="btn btn-primary" disabled={busy || !form.title.trim()}>
          {busy ? 'Creating…' : 'Create Group'}
        </button>
      </form>
    </Modal>
  )
}
