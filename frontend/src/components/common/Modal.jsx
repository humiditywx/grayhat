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
            <svg width="18" height="18" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
              <path d="M6 18L18 6M6 6l12 12" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
