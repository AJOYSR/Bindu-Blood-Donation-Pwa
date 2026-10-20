import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { track } from '../lib/analytics'
import type { TranslationKey } from './en'
import {
  htmlLang,
  localeStorageKey,
  resolveLocale,
  translate,
  type Locale,
  type TranslateVars
} from './translate'

interface I18nContextValue {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: (key: TranslationKey, vars?: TranslateVars) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(() => resolveLocale())

  const setLocale = useCallback((next: Locale) => {
    const root = document.documentElement
    root.classList.remove('is-lang-swap')
    void root.offsetWidth // restart the cross-fade animation
    root.classList.add('is-lang-swap')
    window.setTimeout(() => root.classList.remove('is-lang-swap'), 450)
    setLocaleState((current) => {
      if (current !== next) track('language_changed', { locale: next })
      return next
    })
    try { localStorage.setItem(localeStorageKey, next) } catch { /* ignore */ }
  }, [])

  useEffect(() => {
    document.documentElement.lang = htmlLang(locale)
    document.title = translate(locale, 'doc.title')
    const meta = document.querySelector('meta[name="description"]')
    if (meta) meta.setAttribute('content', translate(locale, 'doc.description'))
  }, [locale])

  const t = useCallback((key: TranslationKey, vars?: TranslateVars) => translate(locale, key, vars), [locale])

  const value = useMemo(() => ({ locale, setLocale, t }), [locale, setLocale, t])

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n must be used within I18nProvider')
  return ctx
}

export function useT() {
  return useI18n().t
}
