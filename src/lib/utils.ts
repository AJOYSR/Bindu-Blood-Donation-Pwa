import { format, formatDistanceToNowStrict, isPast } from 'date-fns'
import { bn as bnLocale, enUS } from 'date-fns/locale'
import { clsx, type ClassValue } from 'clsx'
import { translate, type Locale } from '../i18n'

const dateFnsLocale = (locale: Locale) => locale === 'bn' ? bnLocale : enUS

export const cn = (...values: ClassValue[]) => clsx(values)

export const formatDate = (value: string, locale: Locale = 'en') =>
  format(new Date(value), 'd MMM, h:mm a', { locale: dateFnsLocale(locale) })

export const relativeDate = (value: string, locale: Locale = 'en') => {
  const distance = formatDistanceToNowStrict(new Date(value), { locale: dateFnsLocale(locale) })
  const suffix = isPast(new Date(value)) ? translate(locale, 'date.ago') : translate(locale, 'date.fromNow')
  return `${distance} ${suffix}`
}

export const neededLabel = (value: string, locale: Locale = 'en') => {
  const distance = formatDistanceToNowStrict(new Date(value), { locale: dateFnsLocale(locale) })
  return isPast(new Date(value))
    ? translate(locale, 'date.wasNeededAgo', { distance })
    : translate(locale, 'date.neededIn', { distance })
}

export const initials = (name: string) => name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase()
