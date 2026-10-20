import { ArrowRight, Bell, CheckCircle2, Droplet, HeartPulse, Moon, Plus, Search, TriangleAlert, UserRound } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { useAuth } from '../app/AuthContext'
import { BloodBadge } from '../components/BloodBadge'
import { RequestCard } from '../components/RequestCard'
import { useT } from '../i18n'
import { fetchMemberProfile, type MemberProfile } from '../lib/api'

const notificationIcon = { info: Bell, success: CheckCircle2, warning: TriangleAlert }

export default function Dashboard() {
  const { requests, notifications, setDonorAvailability, markNotificationsRead } = useApp()
  const { user } = useAuth()
  const t = useT()
  const [profile, setProfile] = useState<MemberProfile | null>(null)
  const [available, setAvailable] = useState(false)
  const [availabilitySaving, setAvailabilitySaving] = useState(false)
  const displayName = String(profile?.displayName || user?.user_metadata?.display_name || user?.email?.split('@')[0] || t('common.member'))
  const firstName = displayName.split(/\s+/)[0]
  const activeRequests = requests.filter((request) => request.status === 'open').slice(0, 3)
  const unread = notifications.filter((item) => !item.read).length

  const greeting = () => {
    const hour = new Date().getHours()
    return hour < 12 ? t('dash.greeting.morning') : hour < 18 ? t('dash.greeting.afternoon') : t('dash.greeting.evening')
  }

  const completionSteps = profile ? [
    { done: true, label: t('dash.completion.account') },
    { done: Boolean(profile.area), label: t('dash.completion.area') },
    { done: Boolean(profile.phone), label: t('dash.completion.phone') },
    { done: Boolean(profile.lastDonation), label: t('dash.completion.lastDonation') },
    { done: profile.searchable, label: t('dash.completion.searchable') }
  ] : []
  const completion = completionSteps.length ? Math.round(completionSteps.filter((step) => step.done).length / completionSteps.length * 100) : 0
  const nextStep = completionSteps.find((step) => !step.done)

  useEffect(() => {
    let active = true
    void fetchMemberProfile().then((data) => {
      if (active && data) { setProfile(data); setAvailable(data.available) }
    })
    return () => { active = false }
  }, [user?.id])

  const toggleAvailability = async () => {
    const next = !available
    setAvailabilitySaving(true)
    try { await setDonorAvailability(next); setAvailable(next) } catch { /* toast already shown */ } finally { setAvailabilitySaving(false) }
  }

  return <div className="page dash-page">
    <div className="container narrow">
      <header className="dash-head">
        <div>
          <p className="dash-greet"><span className={available ? 'live-dot' : 'live-dot is-red'} />{greeting()}</p>
          <h1>{firstName}</h1>
        </div>
        {profile && <BloodBadge group={profile.bloodGroup} size="md" />}
      </header>

      <section className={available ? 'status-card is-on' : 'status-card'}>
        <span className="status-card-icon">{available ? <HeartPulse /> : <Moon />}</span>
        <div className="status-copy">
          <strong>{available ? t('dash.available.title') : t('dash.unavailable.title')}</strong>
          <small>{available ? t('dash.available.hint') : t('dash.unavailable.hint')}</small>
        </div>
        <button type="button" role="switch" aria-checked={available} aria-label={t('dash.availableAria')} className="switch-button" disabled={availabilitySaving} onClick={() => void toggleAvailability()}>
          <span className={available ? 'switch-ui is-on' : 'switch-ui'} />
        </button>
      </section>

      {profile && completion < 100 && (
        <Link to="/profile" className="dash-next">
          <div>
            <strong>{t('dash.finishProfile')}</strong>
            <span>{nextStep ? nextStep.label : t('dash.almostDone')} · {completion}%</span>
          </div>
          <span className="progress-bar dash-next-bar"><span style={{ width: `${completion}%` }} /></span>
          <ArrowRight />
        </Link>
      )}

      <nav className="dash-quick" aria-label={t('shell.nav.main')}>
        <Link to="/requests/new"><span><Plus /></span>{t('dash.quick.request')}</Link>
        <Link to="/find-donors"><span><Search /></span>{t('dash.quick.find')}</Link>
        <Link to="/profile"><span><UserRound /></span>{t('dash.quick.profile')}</Link>
      </nav>

      <section className="dash-block">
        <div className="section-head">
          <h2>{t('dash.needsTitle')}</h2>
          <Link to="/requests" className="text-link">{t('common.seeAll')}<ArrowRight /></Link>
        </div>
        {activeRequests.length
          ? <div className="card-list">{activeRequests.map((request) => <RequestCard key={request.id} request={request} />)}</div>
          : <div className="dash-empty">
              <Droplet />
              <h3>{t('dash.emptyTitle')}</h3>
              <p>{t('dash.emptyText')}</p>
              <Link to="/requests/new" className="button button-primary button-sm"><Plus />{t('dash.requestBlood')}</Link>
            </div>}
      </section>

      <section className="dash-block" id="notifications">
        <div className="section-head">
          <h2>{t('dash.notifications')}{unread > 0 && <span className="count-pill">{unread}</span>}</h2>
          {unread > 0 && <button type="button" className="text-button" onClick={markNotificationsRead}>{t('dash.markRead')}</button>}
        </div>
        {notifications.length ? (
          <div className="notif-list">
            {notifications.slice(0, 4).map((item) => {
              const Icon = notificationIcon[item.tone]
              return <article key={item.id} className={!item.read ? 'unread' : ''}>
                <span className={`notif-icon ${item.tone}`}><Icon /></span>
                <div><strong>{item.title}</strong><p>{item.message}</p><small>{item.time}</small></div>
              </article>
            })}
          </div>
        ) : <p className="muted-copy">{t('dash.caughtUp')}</p>}
      </section>
    </div>
  </div>
}
