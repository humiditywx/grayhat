import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { initTheme } from './hooks/useTheme.js'
import { LocaleProvider } from './i18n/index.jsx'
import { Toaster } from './components/ui/sonner.jsx'

initTheme()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <Toaster richColors position="top-center" />
      <App />
    </LocaleProvider>
  </StrictMode>,
)
