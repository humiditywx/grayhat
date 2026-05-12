import { useEffect } from 'react'
import AeroIcon from '../icons/AeroIcon.jsx'

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
            <AeroIcon name="close" size={18} />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}
