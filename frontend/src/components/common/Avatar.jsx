export default function Avatar({ user, size = 'md', className = '' }) {
  const initials = (user?.username || '?').slice(0, 2).toUpperCase()
  const sizeClass = `avatar-${size}`
  return (
    <div className={`avatar ${sizeClass} ${className}`}>
      {user?.avatar_url
        ? <img src={`${user.avatar_url}${user.avatar_url.includes('?') ? '' : ''}`} alt={user.username} loading="lazy" />
        : initials}
    </div>
  )
}
