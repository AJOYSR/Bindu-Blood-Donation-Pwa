import type { BloodGroup } from '../types'

export function BloodBadge({ group, size = 'md' }: { group: BloodGroup; size?: 'sm' | 'md' | 'lg' }) {
  return <span className={`blood-badge blood-badge-${size}`} aria-label={`${group} blood group`}>{group}</span>
}
