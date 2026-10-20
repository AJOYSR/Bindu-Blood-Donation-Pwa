import { ArrowLeft, Building2, CalendarClock, CheckCircle2, Flag, LockKeyhole, MapPin, Phone, ShieldCheck, UsersRound } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { useAuth } from '../app/AuthContext'
import { BloodBadge } from '../components/BloodBadge'
import { StatusBadge } from '../components/StatusBadge'
import { consentContactUnlock, createReport, getSharedContact } from '../lib/api'
import { Spinner } from '../components/Skeleton'
import { formatDate, neededLabel } from '../lib/utils'
import { pluralKey, useI18n } from '../i18n'

export default function RequestDetail() {
  const { id } = useParams()
  const { requests, respondToRequest, notify } = useApp()
  const { user } = useAuth()
  const { locale, t } = useI18n()
  const [reporting, setReporting] = useState(false)
  const [consenting, setConsenting] = useState(false)
  const [shared, setShared] = useState<{ unlocked: boolean; phone?: string | null; email?: string | null } | null>(null)
  const request = requests.find((item) => item.id === id)

  if (!request) return <div className="container not-found">
    <h1>{t('detail.notFound')}</h1>
    <p className="muted-copy">{t('detail.notFoundText')}</p>
    <Link to="/requests" className="button button-secondary">{t('detail.backRequests')}</Link>
  </div>

  const isClosed = !['open', 'matched'].includes(request.status)

  const report = async () => {
    setReporting(true)
    try {
      await createReport(request, 'Member requested a safety review from the request detail page.')
      notify(t('detail.toast.reportOk'), t('detail.toast.reportOkMsg'), 'success')
    } catch (error) {
      notify(t('detail.toast.reportFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setReporting(false)
    }
  }

  const unlock = async () => {
    if (!request.backendId) {
      notify(t('detail.toast.demo'), t('detail.toast.demoMsg'), 'danger')
      return
    }
    setConsenting(true)
    try {
      await consentContactUnlock(request.backendId)
      if (user?.id) {
        const contact = await getSharedContact(request.backendId, user.id)
        setShared(contact)
      }
      notify(t('detail.toast.consentOk'), t('detail.toast.consentOkMsg'), 'success')
    } catch (error) {
      notify(t('detail.toast.consentFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
    } finally {
      setConsenting(false)
    }
  }

  const respondButton = (className: string) => <button
    className={className}
    disabled={isClosed}
    onClick={() => void respondToRequest(request.id)}
  >
    <CheckCircle2 />{isClosed ? t('detail.requestClosed', { status: request.status }) : t('detail.canDonate')}
  </button>

  return <div className={isClosed ? 'page' : 'page has-sticky-action'}>
    <div className="container">
      <Link to="/requests" className="back-link"><ArrowLeft />{t('detail.allRequests')}</Link>

      <div className="detail-layout">
        <section className="detail-main">
          <div className="card detail-hero">
            <BloodBadge group={request.bloodGroup} size="lg" />
            <div>
              <div className="badge-row">
                <StatusBadge value={request.urgency} />
                {request.status !== 'open' && <StatusBadge value={request.status} />}
              </div>
              <h1>{t(pluralKey('detail.needed', request.units), { count: request.units, group: request.bloodGroup })}</h1>
              <p>{t('detail.posted', { id: request.id, when: formatDate(request.createdAt, locale) })}</p>
            </div>
          </div>

          <div className="card info-list">
            <div className="info-row"><span className="info-icon"><Building2 /></span><div><small>{t('detail.hospital')}</small><strong>{request.hospital}</strong></div></div>
            <div className="info-row"><span className="info-icon"><MapPin /></span><div><small>{t('detail.area')}</small><strong>{request.area}, {request.district}</strong></div></div>
            <div className="info-row"><span className="info-icon"><CalendarClock /></span><div><small>{neededLabel(request.neededBy, locale)}</small><strong>{formatDate(request.neededBy, locale)}</strong></div></div>
            <div className="info-row"><span className="info-icon"><UsersRound /></span><div><small>{t('detail.responses')}</small><strong>{t('detail.responded', { count: request.responses, donors: t(pluralKey('common.donor', request.responses)) })}</strong></div></div>
          </div>

          {request.note && <article className="card note-card"><h2>{t('detail.about')}</h2><p>{request.note}</p></article>}

          <div className="notice notice-ok">
            <ShieldCheck />
            <p><strong>{t('detail.safeTitle')}</strong>{t('detail.safeText')}</p>
          </div>
        </section>

        <aside className="detail-aside">
          <div className="card action-card">
            <div>
              <h2>{t('detail.helpTitle')}</h2>
              <p className="muted-copy">{t('detail.helpText')}</p>
            </div>
            <ul className="checklist">
              <li><CheckCircle2 />{t('detail.checkGroup', { group: request.bloodGroup })}</li>
              <li><CheckCircle2 />{t('detail.checkEligible')}</li>
              <li><LockKeyhole />{t('detail.checkConsent')}</li>
            </ul>
            {respondButton('button button-primary button-full button-lg hide-mobile')}
            <button className="button button-secondary button-full" disabled={consenting || !user} onClick={() => void unlock()}>
              {consenting ? <Spinner /> : <LockKeyhole />}{consenting ? t('detail.consenting') : user ? t('detail.consent') : t('detail.signInConsent')}
            </button>
            {shared?.unlocked && <div className="shared-contact"><Phone /><div><strong>{t('detail.contactUnlocked')}</strong><p>{shared.phone || shared.email || t('detail.sharedSecurely')}</p></div></div>}
            <small className="muted-copy">{t('detail.withdraw')}</small>
          </div>
          <button className="text-button report-link" disabled={reporting} onClick={() => void report()}>
            {reporting ? <Spinner /> : <Flag />}{reporting ? t('detail.reporting') : t('detail.report')}
          </button>
        </aside>
      </div>
    </div>

    {!isClosed && <div className="sticky-action">{respondButton('button button-primary button-full button-lg')}</div>}
  </div>
}
