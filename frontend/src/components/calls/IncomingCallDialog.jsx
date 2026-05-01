import Avatar from '../common/Avatar.jsx'
import { useCall } from '../../context/CallContext.jsx'
import { Button } from '@/components/ui/button.jsx'
import { Phone, X } from 'lucide-react'

export default function IncomingCallDialog() {
  const { call, joinCall, declineCall } = useCall()
  const inc = call.incomingCall

  if (!inc) return null

  const answer = async () => {
    await joinCall(inc.conversationId, inc.mode, inc.title, inc.callerAvatar)
  }

  const decline = () => {
    declineCall()
  }

  return (
    <div className="incoming-call-overlay">
      <div className="incoming-call-card">
        <div className="incoming-call-type">
          {inc.mode === 'video' ? '📹 Incoming video call' : '📞 Incoming voice call'}
        </div>

        <div className="incoming-call-pulse">
          <Avatar
            user={{ username: inc.callerName, avatar_url: inc.callerAvatar }}
            size="xl"
          />
        </div>

        <div className="incoming-call-name">{inc.title || inc.callerName}</div>
        <div style={{ fontSize: 'var(--text-xs)', color: 'var(--text-3)', marginBottom: 24 }}>from {inc.callerName}</div>

        <div className="incoming-call-actions">
          <Button type="button" variant="ghost" className="call-action-btn h-auto p-0 hover:bg-transparent" onClick={decline}>
            <div className="call-decline-btn">
              <X size={26} />
            </div>
            <span>Decline</span>
          </Button>
          <Button type="button" variant="ghost" className="call-action-btn h-auto p-0 hover:bg-transparent" onClick={answer}>
            <div className="call-answer-btn">
              <Phone size={26} />
            </div>
            <span>Answer</span>
          </Button>
        </div>
      </div>
    </div>
  )
}
