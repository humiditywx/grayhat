import { useState, useEffect } from 'react'

const STORAGE_KEY = 'grayhat-theme'

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme)
}

export function useTheme() {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'dark' ? 'dark' : 'light'
  })

  useEffect(() => {
    applyTheme(theme)
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  const toggle = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return { theme, toggle, isDark: theme === 'dark' }
}

// Call once at startup (before React mounts) to avoid flash of wrong theme
export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY)
  if (saved) applyTheme(saved)
}
