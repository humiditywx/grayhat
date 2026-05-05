const REQUIREMENTS = [
  {
    id: 'length',
    label: 'Minimum 8 symbols',
    isMet: (password) => password.length >= 8,
  },
  {
    id: 'uppercase',
    label: 'At least one uppercase letter',
    isMet: (password) => /[A-Z]/.test(password),
  },
  {
    id: 'lowercase',
    label: 'At least one lowercase letter',
    isMet: (password) => /[a-z]/.test(password),
  },
  {
    id: 'number',
    label: 'At least one number',
    isMet: (password) => /\d/.test(password),
  },
]

export function getPasswordRequirementState(password) {
  return REQUIREMENTS.map((requirement) => ({
    ...requirement,
    met: requirement.isMet(password),
  }))
}

export function isPasswordValid(password) {
  return REQUIREMENTS.every((requirement) => requirement.isMet(password))
}

export default function PasswordRequirements({ password }) {
  const items = getPasswordRequirementState(password)

  return (
    <div
      aria-live="polite"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        padding: '10px 12px',
        borderRadius: 'var(--r-md)',
        background: 'var(--surface-2)',
        border: '1px solid var(--border-light)',
      }}
    >
      <div style={{ fontSize: 'var(--text-xs)', fontWeight: 700, color: 'var(--text-2)' }}>
        Password requirements
      </div>
      {items.map((item) => (
        <div
          key={item.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 10,
            fontSize: 'var(--text-xs)',
            color: item.met ? '#15803d' : 'var(--text-3)',
          }}
        >
          <span>{item.label}</span>
          <span style={{ fontWeight: 700 }}>{item.met ? 'OK' : 'Need'}</span>
        </div>
      ))}
    </div>
  )
}
