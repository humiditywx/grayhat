import { useState } from 'react'
import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import { useLocale } from '../../i18n/index.jsx'
import { acceptFriendRequest, declineFriendRequest, cancelFriendRequest } from '../../api.js'
import { Badge } from '@/components/ui/badge.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.jsx'
import { Check, UserPlus, X } from 'lucide-react'

function fmtTime(iso, t) {
  if (!iso) return ''
  const d = new Date(iso)
  const diff = Date.now() - d
  if (diff < 60000) return t('justNow')
  if (diff < 3600000) return t('minutesAgo', { n: Math.floor(diff / 60000) })
  if (diff < 86400000) return t('hoursAgo', { n: Math.floor(diff / 3600000) })
  return d.toLocaleDateString()
}

export default function InboxPanel({ hideHeader = false }) {
  const { state, dispatch, toast } = useApp()
  const { t } = useLocale()
  const [tab, setTab] = useState('received')
  const [busy, setBusy] = useState(null)

  const incoming = state.friendRequests?.incoming || []
  const outgoing = state.friendRequests?.outgoing || []

  const handleAccept = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      const data = await acceptFriendRequest(req.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: req.id })
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: req.id })
      if (data.friend) dispatch({ type: 'ADD_FRIEND', friend: data.friend })
      if (data.conversation) dispatch({ type: 'ADD_CONVERSATION', conv: data.conversation })
      toast(`You are now friends with ${req.other_user.username}!`, 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleDecline = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      await declineFriendRequest(req.id)
      dispatch({ type: 'REMOVE_INCOMING_REQUEST', requestId: req.id })
      toast(t('requestDeclined'), 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const handleCancel = async (req) => {
    if (busy) return
    setBusy(req.id)
    try {
      await cancelFriendRequest(req.id)
      dispatch({ type: 'REMOVE_OUTGOING_REQUEST', requestId: req.id })
      toast(t('requestCancelled'), 'info')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {!hideHeader && (
        <div className="panel-header">
          <span className="panel-title">{t('inboxTitle')}</span>
          <Button
            type="button"
            size="sm"
            onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'addFriendOpen' })}
          >
            <UserPlus />
            {t('addFriend')}
          </Button>
        </div>
      )}

      <Tabs value={tab} onValueChange={setTab} className="min-h-0 flex-1 gap-0">
        <TabsList className="mx-3 my-2 grid w-auto grid-cols-2">
          <TabsTrigger value="received">
            {t('received')}
            {incoming.length > 0 && <Badge className="ml-1 h-4 px-1.5">{incoming.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="sent">
            {t('sent')}
            {outgoing.length > 0 && <Badge className="ml-1 h-4 px-1.5">{outgoing.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="received" className="min-h-0 flex-1 overflow-y-auto">
            {incoming.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
                {t('noPendingRequests')}
              </div>
            )}
            {incoming.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">{t('wantsFriend')} · {fmtTime(req.created_at, t)}</div>
                </div>
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="text-destructive"
                    onClick={() => handleDecline(req)}
                    disabled={busy === req.id}
                  >
                    <X />
                  </Button>
                  <Button
                    type="button"
                    size="icon-sm"
                    onClick={() => handleAccept(req)}
                    disabled={busy === req.id}
                  >
                    <Check />
                  </Button>
                </div>
              </div>
            ))}
        </TabsContent>

        <TabsContent value="sent" className="min-h-0 flex-1 overflow-y-auto">
            {outgoing.length === 0 && (
              <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
                {t('noSentRequests')}
              </div>
            )}
            {outgoing.map((req) => (
              <div key={req.id} className="req-item">
                <Avatar user={req.other_user} size="md" />
                <div className="req-item-info">
                  <div className="req-item-name">{req.other_user.username}</div>
                  <div className="req-item-sub">{t('requestPending')} · {fmtTime(req.created_at, t)}</div>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => handleCancel(req)}
                  disabled={busy === req.id}
                  className="shrink-0 text-muted-foreground"
                >
                  <X />
                </Button>
              </div>
            ))}
        </TabsContent>
      </Tabs>

    </div>
  )
}
