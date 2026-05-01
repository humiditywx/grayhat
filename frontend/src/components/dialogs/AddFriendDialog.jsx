import { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Input } from '@/components/ui/input.jsx'
import { Label } from '@/components/ui/label.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { sendFriendRequest, scanQrImage } from '../../api.js'

export default function AddFriendDialog({ onClose }) {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()
  const [tab, setTab] = useState('qr')

  return (
    <Dialog open onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="max-w-[480px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{t('addFriendTitle')}</DialogTitle>
        </DialogHeader>

        <Tabs value={tab} onValueChange={setTab} className="gap-4">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="qr">{t('myQr')}</TabsTrigger>
            <TabsTrigger value="uuid">{t('addByUuid')}</TabsTrigger>
            <TabsTrigger value="image">{t('scanImage')}</TabsTrigger>
          </TabsList>
          <TabsContent value="qr">
            <MyQR me={state.me} myAddLink={state.myAddLink} t={t} />
          </TabsContent>
          <TabsContent value="uuid">
            <AddByUUID dispatch={dispatch} toast={toast} onClose={onClose} t={t} />
          </TabsContent>
          <TabsContent value="image">
            <ScanImage dispatch={dispatch} toast={toast} onClose={onClose} t={t} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}

function MyQR({ me, myAddLink, t }) {
  return (
    <div className="flex flex-col items-center gap-3.5">
      <div className="qr-display">
        <img src="/api/users/me/qr.png" alt="My QR code" />
      </div>
      <p style={{ fontSize: 'var(--text-sm)', color: 'var(--text-2)', textAlign: 'center' }}>
        {t('qrScanHint')}
      </p>
      <div className="uuid-display" onClick={() => navigator.clipboard.writeText(me?.id || '')}>
        {me?.id}
      </div>
      {myAddLink && (
        <div className="uuid-display" onClick={() => navigator.clipboard.writeText(myAddLink)} style={{ fontSize: 'var(--text-xs)' }}>
          {myAddLink}
        </div>
      )}
    </div>
  )
}

function AddByUUID({ dispatch, toast, onClose, t }) {
  const [val, setVal] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    if (!val.trim()) return
    setBusy(true)
    try {
      const data = await sendFriendRequest({ uuid: val.trim() })
      if (data.friend) {
        dispatch({ type: 'ADD_FRIEND', friend: data.friend })
        if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
        toast(`${data.friend.username} added!`, 'success')
      } else if (data.request) {
        dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
        toast('Friend request sent!', 'success')
      }
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <div className="flex flex-col gap-1.5">
        <Label>{t('uuidOrLink')}</Label>
        <Input value={val} onChange={(e) => setVal(e.target.value)} placeholder={t('pasteUuidPlaceholder')} autoFocus />
      </div>
      <Button type="submit" disabled={busy || !val.trim()}>
        {busy ? t('adding') : t('addFriendTitle')}
      </Button>
    </form>
  )
}

function ScanImage({ dispatch, toast, onClose, t }) {
  const [busy, setBusy] = useState(false)

  const pick = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBusy(true)
    const fd = new FormData()
    fd.append('file', file)
    try {
      const data = await scanQrImage(fd)
      if (data.friend) {
        dispatch({ type: 'ADD_FRIEND', friend: data.friend })
        if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
        toast(`${data.friend.username} added!`, 'success')
      } else if (data.request) {
        dispatch({ type: 'ADD_OUTGOING_REQUEST', request: data.request })
        toast('Friend request sent!', 'success')
      }
      onClose()
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="text-center p-3">
      <label className="cursor-pointer">
        <Button variant="outline" asChild>
          <span>{busy ? t('scanning') : t('chooseQrImage')}</span>
        </Button>
        <input type="file" accept="image/*" className="hidden" onChange={pick} disabled={busy} />
      </label>
    </div>
  )
}
