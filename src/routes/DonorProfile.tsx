import { ArrowLeft, BadgeCheck, EyeOff, Mail, MapPin, Phone, Plus, ShieldCheck } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { BloodBadge } from '../components/BloodBadge'
import { CardSkeleton, Skeleton } from '../components/Skeleton'
import { useI18n } from '../i18n'
import { fetchDonorById } from '../lib/api'
import type { Donor } from '../types'

export default function DonorProfile() {
  const { id } = useParams()
  const { donors } = useApp()
  const { locale, t } = useI18n()
  const [donor, setDonor] = useState<Donor | null>(() => donors.find((item) => item.id === id) ?? null)
  const [loading, setLoading] = useState(!donor)

  useEffect(() => {
    if (!id) return
    let active = true
    setLoading(true)
    void fetchDonorById(id)
      .then((result) => { if (active) setDonor(result) })
      .catch(() => { if (active) setDonor(null) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [id])

  if (loading) return <div className="page"><div className="container narrow" role="status" aria-busy="true" style={{ display: 'grid', gap: 16, paddingTop: 52 }}><CardSkeleton /><Skeleton height={120} radius={18} /><Skeleton height={54} radius={14} /></div></div>
  if (!donor) return <div className="container not-found">
    <h1>{t('donor.notFound')}</h1>
    <p className="muted-copy">{t('donor.notFoundText')}</p>
    <Link className="button button-secondary" to="/find-donors"><ArrowLeft />{t('donor.back')}</Link>
  </div>

  const lastDonation = donor.lastDonation
    ? new Date(donor.lastDonation).toLocaleDateString(locale === 'bn' ? 'bn-BD' : 'en-GB', { month: 'short', year: 'numeric' })
    : t('donor.new')

  return <div className="page">
    <div className="container narrow">
      <Link className="back-link" to="/find-donors"><ArrowLeft />{t('donor.all')}</Link>

      <div className="detail-main">
        <article className="card detail-main">
          <div className="donor-hero">
            <BloodBadge group={donor.bloodGroup} size="lg" />
            <div>
              <span className={`availability-dot ${donor.available ? 'is-on' : ''}`}>{donor.available ? t('donor.availableNow') : t('donor.restingNow')}</span>
              <h1>{donor.displayName}{donor.verified && <BadgeCheck aria-label={t('donor.verified')} />}</h1>
              <p><MapPin />{donor.area}, {donor.district}</p>
            </div>
          </div>
          <div className="stat-trio">
            <div><strong>{donor.donations}</strong><span>{t('donor.donations')}</span></div>
            <div><strong>{donor.responseRate}%</strong><span>{t('donor.responseRate')}</span></div>
            <div><strong>{lastDonation}</strong><span>{t('donor.lastDonation')}</span></div>
          </div>
        </article>

        <div className="card info-list">
          <div className="info-row"><span className="info-icon"><Phone /></span><div><small>{t('donor.phone')}</small><strong>{donor.maskedPhone ?? t('donor.hiddenPhone')}</strong></div></div>
          <div className="info-row"><span className="info-icon"><Mail /></span><div><small>{t('donor.email')}</small><strong><EyeOff size={14} /> {t('donor.emailHidden')}</strong></div></div>
        </div>

        <div className="notice notice-ok">
          <ShieldCheck />
          <p><strong>{t('donor.protectedTitle')}</strong>{t('donor.protectedText')}</p>
        </div>

        {donor.available
          ? <Link to="/requests/new" className="button button-primary button-full button-lg"><Plus />{t('donor.postRequest', { group: donor.bloodGroup })}</Link>
          : <button className="button button-secondary button-full button-lg" disabled>{t('donor.restingBtn')}</button>}
      </div>
    </div>
  </div>
}
