import { BadgeCheck, MapPin } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { Donor } from '../types'
import { BloodBadge } from './BloodBadge'
import { useT } from '../i18n'

export function DonorCard({ donor }: { donor: Donor }) {
  const t = useT()
  const status = donor.available ? t('card.ariaAvailable') : t('card.ariaResting')
  return <Link
    to={`/donors/${donor.id}`}
    className="donor-card"
    aria-label={t('card.ariaDonor', { name: donor.displayName, group: donor.bloodGroup, status })}
  >
    <div className="donor-photo-badge">{donor.avatarUrl && <img src={donor.avatarUrl} alt="" loading="lazy" />}<BloodBadge group={donor.bloodGroup} size={donor.avatarUrl ? "sm" : "lg"} /></div>
    <div className="dc-body">
      <div className="dc-name"><h3>{donor.displayName}</h3>{donor.verified && <BadgeCheck aria-label={t('card.verified')} />}</div>
      <p><MapPin />{donor.area}, {donor.district}{donor.distanceKm > 0 ? ` · ${donor.distanceKm} km` : ''}</p>
      <div className="dc-stats">
        <span><strong>{donor.donations}</strong> {t('card.donations')}</span>
        <span><strong>{donor.responseRate}%</strong> {t('card.responseRate')}</span>
      </div>
    </div>
    <span className={`availability-dot ${donor.available ? 'is-on' : ''}`}>{donor.available ? t('card.available') : t('card.resting')}</span>
  </Link>
}