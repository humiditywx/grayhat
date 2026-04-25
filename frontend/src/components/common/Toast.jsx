import { useApp } from '../../context/AppContext.jsx'

const ICONS = {
  info:    'ℹ',
  success: '✓',
  error:   '✕',
}

export default function ToastContainer() {
  const { state, dispatch } = useApp()
  return (
    <div className="toast-container">
      {state.toasts.map((t) => (
        <div key={t.id} className={`toast toast-${t.kind}`} onClick={() => dispatch({ type: 'REMOVE_TOAST', id: t.id })}>
          <span style={{ fontWeight: 700 }}>{ICONS[t.kind]}</span>
          <span style={{ flex: 1 }}>{t.message}</span>
        </div>
      ))}
    </div>
  )
}
