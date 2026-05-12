import { useEffect } from 'react'

export default function Modal({ title, onClose, children, center = false }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', handler)
    return () => document.removeEventListener('keydown', handler)
  }, [onClose])

  return (
    <div className={`modal-backdrop${center ? ' center' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <div className="modal">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          {title && <div className="modal-title" style={{ margin: 0 }}>{title}</div>}
          <button className="btn-icon" onClick={onClose} style={{ marginLeft: 'auto' }}>
            {/* xmark */}
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
