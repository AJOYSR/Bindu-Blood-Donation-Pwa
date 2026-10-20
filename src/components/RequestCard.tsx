import { ChevronRight, Clock3, MapPin, UsersRound } from 'lucide-react'
import { Link } from 'react-router-dom'
import type { BloodRequest } from '../types'
import { BloodBadge } from './BloodBadge'
import { StatusBadge } from './StatusBadge'
import { neededLabel } from '../lib/utils'
import { pluralKey, useI18n } from '../i18n'

export function RequestCard({ request }: { request: BloodRequest }) {
  const { locale, t } = useI18n()
  const isActive = request.status === 'open' || request.status === 'matched'
  return <Link to={`/requests/${request.id}`} className={`request-card ${request.urgency === 'critical' && isActive ? 'is-critical' : ''}`}>
    <div className="rc-top">
      <BloodBadge group={request.bloodGroup} size="lg" />
      <div className="rc-title">
        <div className="badge-row">
          {isActive && <StatusBadge value={request.urgency} />}
          {request.status !== 'open' && <StatusBadge value={request.status} />}
        </div>
        <h3>{t(pluralKey('card.units', request.units), { count: request.units, group: request.bloodGroup })}</h3>
        <p>{request.hospital}</p>
      </div>
    </div>
    <div className="rc-meta">
      <span><MapPin />{request.area}, {request.district}</span>
      <span><Clock3 />{neededLabel(request.neededBy, locale)}</span>
    </div>
    <div className="rc-foot">
      <span><UsersRound />{request.responses} {t(pluralKey('card.response', request.responses))}</span>
      <span className="rc-cta">{t('common.details')}<ChevronRight /></span>
    </div>
  </Link>
}
