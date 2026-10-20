import type { TranslationDict, TranslationKey } from './en'
import { en } from './en'
import { bn } from './bn'

export type Locale = 'en' | 'bn'

export const locales: Locale[] = ['en', 'bn']
export const defaultLocale: Locale = 'en'
export const localeStorageKey = 'bindu.locale'

const dictionaries: Record<Locale, TranslationDict> = { en, bn }

export function isLocale(value: string | null | undefined): value is Locale {
  return value === 'en' || value === 'bn'
}

export function resolveLocale(preferred?: string | null): Locale {
  if (isLocale(preferred)) return preferred
  try {
    const stored = localStorage.getItem(localeStorageKey) ?? localStorage.getItem('hemora.locale')
    if (isLocale(stored)) return stored
  } catch { /* ignore */ }
  const browser = typeof navigator !== 'undefined' ? navigator.language.toLowerCase() : ''
  if (browser.startsWith('bn')) return 'bn'
  return defaultLocale
}

export type TranslateVars = Record<string, string | number>

export function translate(locale: Locale, key: TranslationKey, vars?: TranslateVars): string {
  const template = dictionaries[locale][key] ?? dictionaries.en[key] ?? key
  if (!vars) return template
  return template.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
    const value = vars[name]
    return value === undefined || value === null ? '' : String(value)
  })
}

export function pluralKey(base: string, count: number): TranslationKey {
  const suffix = count === 1 ? '_one' : '_other'
  return `${base}${suffix}` as TranslationKey
}

export function htmlLang(locale: Locale): string {
  return locale === 'bn' ? 'bn' : 'en'
}
