import Avatar from '../common/Avatar.jsx'
import { useApp } from '../../context/AppContext.jsx'
import CreateGroupDialog from '../dialogs/CreateGroupDialog.jsx'

export default function GroupsPanel() {
  const { state, dispatch } = useApp()
  const groups = state.conversations.filter((c) => c.kind === 'group')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      <div className="panel-header">
        <span className="panel-title">Groups</span>
        <button
          className="btn btn-primary btn-sm"
          onClick={() => dispatch({ type: 'OPEN_DIALOG', key: 'createGroupOpen' })}
        >
          + New Group
        </button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {groups.length === 0 && (
          <div style={{ textAlign: 'center', color: 'var(--text-3)', fontSize: 'var(--text-sm)', padding: '40px 20px' }}>
            No groups yet.<br />Create one to get started!
          </div>
        )}
        {groups.map((g) => (
          <div key={g.id} className="friend-item" onClick={() => dispatch({ type: 'SELECT_CONV', convId: g.id })}>
            <div className="avatar avatar-md" style={{ background: 'linear-gradient(135deg, var(--primary-light), var(--primary))', color: '#fff', fontSize: 18, fontWeight: 700 }}>
              {g.icon_url
                ? <img src={g.icon_url} alt={g.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : g.title?.[0]?.toUpperCase() || 'G'}
            </div>
            <div className="friend-item-info">
              <div className="friend-name">{g.title}</div>
              <div className="friend-last-seen">{g.member_count} members{g.description ? ` · ${g.description}` : ''}</div>
            </div>
            {g.share_url && (
              <button
                className="btn-icon"
                title="Copy invite link"
                onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(g.share_url) }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M10 13a5 5 0 007.54.54l3-3a5 5 0 00-7.07-7.07l-1.72 1.71"/>
                  <path d="M14 11a5 5 0 00-7.54-.54l-3 3a5 5 0 007.07 7.07l1.71-1.71"/>
                </svg>
              </button>
            )}
          </div>
        ))}
      </div>

      {state.createGroupOpen && <CreateGroupDialog onClose={() => dispatch({ type: 'CLOSE_DIALOG', key: 'createGroupOpen' })} />}
    </div>
  )
}
