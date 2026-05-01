import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Checkbox } from '@/components/ui/checkbox.jsx'
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
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Create Group</DialogTitle>
        </DialogHeader>
        <form onSubmit={handle} className="flex flex-col gap-3.5">
          <div className="flex flex-col gap-1.5">
            <Label>Group name *</Label>
            <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="My group" autoFocus />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label>Description (optional)</Label>
            <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="What's this group about?" />
          </div>
          <div className="flex items-center gap-2.5">
            <Checkbox
              id="is_public"
              checked={form.is_public}
              onCheckedChange={(checked) => setForm({ ...form, is_public: !!checked })}
            />
            <label htmlFor="is_public" style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', cursor: 'pointer' }}>
              Public group (joinable via invite link)
            </label>
          </div>
          <Button type="submit" disabled={busy || !form.title.trim()}>
            {busy ? 'Creating…' : 'Create Group'}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  )
}
