import Avatar from '../common/Avatar.jsx'
import { useCall } from '../../context/CallContext.jsx'

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
          <button className="call-action-btn" onClick={decline}>
            <div className="call-decline-btn">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </div>
            <span>Decline</span>
          </button>
          <button className="call-action-btn" onClick={answer}>
            <div className="call-answer-btn">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07 19.5 19.5 0 01-6-6A19.79 19.79 0 012.12 4.18 2 2 0 014.11 2h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L8.09 9.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
              </svg>
            </div>
            <span>Answer</span>
          </button>
        </div>
      </div>
    </div>
  )
}
