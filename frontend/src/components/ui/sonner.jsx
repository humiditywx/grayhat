import { Toaster as Sonner } from "sonner"

const Toaster = (props) => {
  const isDark = document.documentElement.dataset.theme === 'dark'

  return (
    <Sonner
      theme={isDark ? 'dark' : 'light'}
      className="toaster group"
      style={{
        '--normal-bg': 'var(--popover)',
        '--normal-text': 'var(--popover-foreground)',
        '--normal-border': 'var(--border)',
        '--border-radius': 'var(--radius)',
      }}
      {...props}
    />
  )
}

export { Toaster }
