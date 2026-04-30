import { createContext, useContext, useState, useCallback } from 'react'
import en from './locales/en.js'
import az from './locales/az.js'

const STORAGE_KEY = 'grayhat-locale'
const locales = { en, az }

export const SUPPORTED_LOCALES = [
  { code: 'en', label: 'English' },
  { code: 'az', label: 'Azərbaycanca' },
]

const Ctx = createContext(null)

export function LocaleProvider({ children }) {
  const [locale, setLocaleState] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY)
    return saved === 'az' ? 'az' : 'en'
  })

  const t = useCallback((key, vars) => {
    const str = locales[locale]?.[key] ?? locales.en[key] ?? key
    if (!vars) return str
    return str.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')
  }, [locale])

  const setLocale = useCallback((code) => {
    localStorage.setItem(STORAGE_KEY, code)
    setLocaleState(code)
  }, [])

  return (
    <Ctx.Provider value={{ locale, t, setLocale }}>
      {children}
    </Ctx.Provider>
  )
}

export function useLocale() {
  return useContext(Ctx)
}
