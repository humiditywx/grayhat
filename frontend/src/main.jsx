import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/global.css'
import App from './App.jsx'
import { initTheme } from './hooks/useTheme.js'
import { LocaleProvider } from './i18n/index.jsx'

initTheme() // apply saved theme before first paint — prevents flash

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LocaleProvider>
      <App />
    </LocaleProvider>
  </StrictMode>,
)
