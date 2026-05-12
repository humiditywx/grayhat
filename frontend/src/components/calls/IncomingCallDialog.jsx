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
              {/* xmark */}
              <svg width="26" height="26" viewBox="0 0 24 24">
                <path
                  d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
            <span>Decline</span>
          </button>
          <button className="call-action-btn" onClick={answer}>
            <div className="call-answer-btn">
              {/* phone.fill */}
              <svg width="26" height="26" viewBox="0 0 24 24">
                <path
                  d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.28-.28.67-.36 1.02-.25 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"
                  fill="currentColor"
                  filter="url(#icon-depth)"
                />
              </svg>
            </div>
            <span>Answer</span>
          </button>
        </div>
      </div>
    </div>
  )
}
