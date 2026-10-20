import type { RequestStatus, Urgency } from '../types'
import { useT, type TranslationKey } from '../i18n'

type BadgeValue = RequestStatus | Urgency | 'verified' | 'available' | 'offline'

function statusKey(value: BadgeValue): TranslationKey {
  if (value === 'verified' || value === 'available' || value === 'offline') return `enum.${value}` as TranslationKey
  if (value === 'critical' || value === 'urgent' || value === 'standard') return `enum.urgency.${value}` as TranslationKey
  return `enum.status.${value}` as TranslationKey
}

export function StatusBadge({ value }: { value: BadgeValue }) {
  const t = useT()
  return <span className={`status status-${value}`}>{t(statusKey(value))}</span>
}
