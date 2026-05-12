import Avatar from '../common/Avatar.jsx'
import { useCall } from '../../context/CallContext.jsx'
import AeroIcon from '../icons/AeroIcon.jsx'

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
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
            <AeroIcon name={inc.mode === 'video' ? 'video' : 'phone'} size={18} />
            {inc.mode === 'video' ? 'Incoming video call' : 'Incoming voice call'}
          </span>
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
          <button className="call-action-btn" onClick={decline}>
            <div className="call-decline-btn">
              <AeroIcon name="close" size={26} />
            </div>
            <span>Decline</span>
          </button>
          <button className="call-action-btn" onClick={answer}>
            <div className="call-answer-btn">
              <AeroIcon name="phone" size={26} />
            </div>
            <span>Answer</span>
          </button>
        </div>
      </div>
    </div>
  )
}
