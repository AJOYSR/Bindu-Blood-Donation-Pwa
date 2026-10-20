import { ArrowRight, BadgeCheck, CheckCircle2, Clock3, HandHeart, HeartPulse, Hospital, LockKeyhole, MapPin, Search, ShieldCheck, Sparkles, UsersRound } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { BloodBadge } from '../components/BloodBadge'
import { RequestCard } from '../components/RequestCard'
import { StatusBadge } from '../components/StatusBadge'
import { pluralKey, useI18n } from '../i18n'
import { bloodGroups, districts } from '../lib/mock-data'
import { neededLabel } from '../lib/utils'

const urgencyRank = { critical: 0, urgent: 1, standard: 2 }

export default function Landing() {
  const { donors, requests } = useApp()
  const { locale, t } = useI18n()
  const navigate = useNavigate()
  const [group, setGroup] = useState('')
  const [district, setDistrict] = useState('')

  const active = useMemo(() => requests
    .filter((request) => request.status === 'open' || request.status === 'matched')
    .sort((a, b) => urgencyRank[a.urgency] - urgencyRank[b.urgency]), [requests])

  const available = donors.filter((donor) => donor.available).length
  const availableByGroup = useMemo(() => {
    const counts: Record<string, number> = {}
    donors.forEach((donor) => { if (donor.available) counts[donor.bloodGroup] = (counts[donor.bloodGroup] ?? 0) + 1 })
    return counts
  }, [donors])
  const featured = active[0]

  const search = (event: React.FormEvent) => {
    event.preventDefault()
    const params = new URLSearchParams()
    if (group) params.set('group', group)
    if (district) params.set('district', district)
    const query = params.toString()
    navigate(`/find-donors${query ? `?${query}` : ''}`)
  }

  const steps = [
    { icon: HeartPulse, title: t('landing.steps.1.title'), text: t('landing.steps.1.text') },
    { icon: UsersRound, title: t('landing.steps.2.title'), text: t('landing.steps.2.text') },
    { icon: LockKeyhole, title: t('landing.steps.3.title'), text: t('landing.steps.3.text') }
  ]

  const stats = [
    { value: available, label: t('landing.stats.available'), tone: 'ok' },
    { value: active.length, label: t('landing.stats.open'), tone: 'brand' },
    { value: 8, label: t('landing.stats.groups'), tone: 'ink' },
    { value: 0, label: t('landing.stats.private'), tone: 'ink' }
  ]

  return <>
    <section className="hero">
      <div className="hero-bg" aria-hidden />
      <div className="container hero-grid">
        <div className="hero-copy">
          <span className="hero-pill reveal"><span className="live-dot is-red" />{t('landing.hero.badge', { count: active.length })}</span>
          <h1 className="reveal reveal-1">{t('landing.hero.title')} <em>{t('landing.hero.titleEm')}</em></h1>
          <p className="hero-lead reveal reveal-2">{t('landing.hero.lead')}</p>

          <form className="hero-search reveal reveal-3" onSubmit={search} role="search" aria-label={t('landing.hero.findDonor')}>
            <label className="hero-search-field">
              <span>{t('landing.hero.groupLabel')}</span>
              <select value={group} onChange={(event) => setGroup(event.target.value)}>
                <option value="">{t('landing.hero.anyGroup')}</option>
                {bloodGroups.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <label className="hero-search-field">
              <span>{t('landing.hero.districtLabel')}</span>
              <select value={district} onChange={(event) => setDistrict(event.target.value)}>
                <option value="">{t('landing.hero.anyDistrict')}</option>
                {districts.map((item) => <option key={item} value={item}>{item}</option>)}
              </select>
            </label>
            <button type="submit" className="button button-primary button-lg"><Search />{t('landing.hero.findDonor')}</button>
          </form>

          <Link to="/requests/new" className="hero-urgent reveal reveal-4">
            <span className="hero-urgent-icon"><Hospital /></span>
            <span>{t('landing.hero.urgentLink')}</span>
            <ArrowRight />
          </Link>

          <ul className="hero-trust reveal reveal-4">
            <li><ShieldCheck />{t('landing.hero.trust1')}</li>
            <li><BadgeCheck />{t('landing.hero.trust2')}</li>
            <li><Sparkles />{t('landing.hero.trust3')}</li>
          </ul>
        </div>

        <div className="hero-visual" aria-label={t('landing.visual.live')}>
          <div className="hv-orb" aria-hidden />
          {featured && <Link to={`/requests/${featured.id}`} className="hv-card">
            <div className="hv-card-head">
              <span className="hv-live"><span className="live-dot is-red" />{t('landing.visual.live')}</span>
              <StatusBadge value={featured.urgency} />
            </div>
            <div className="hv-card-main">
              <BloodBadge group={featured.bloodGroup} size="lg" />
              <div>
                <strong>{t(pluralKey('card.units', featured.units), { count: featured.units, group: featured.bloodGroup })}</strong>
                <span>{featured.hospital}</span>
              </div>
            </div>
            <div className="hv-meta">
              <span><MapPin />{featured.area}, {featured.district}</span>
              <span><Clock3 />{neededLabel(featured.neededBy, locale)}</span>
            </div>
            <div className="hv-progress">
              <div className="hv-avatars" aria-hidden>{['N', 'S', 'F', 'A'].slice(0, Math.max(1, Math.min(4, featured.responses))).map((letter) => <span key={letter}>{letter}</span>)}</div>
              <span>{featured.responses} {t(pluralKey('card.response', featured.responses))}</span>
            </div>
          </Link>}
          <div className="hv-float hv-match">
            <span className="hv-float-icon is-ok"><CheckCircle2 /></span>
            <span><strong>{t('landing.visual.matched')}</strong><small>{t('landing.visual.matchedTime')}</small></span>
          </div>
          <div className="hv-float hv-stat">
            <strong>{available}</strong>
            <small>{t('landing.visual.available')}</small>
          </div>
        </div>
      </div>
    </section>

    <section className="container">
      <dl className="stats-strip">
        {stats.map((stat) => <div key={stat.label} className={`stat stat-${stat.tone}`}>
          <dt>{stat.label}</dt>
          <dd>{stat.value}</dd>
        </div>)}
      </dl>
    </section>

    <section className="section group-section">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">{t('landing.groups.kicker')}</span>
            <h2>{t('landing.groups.title')}</h2>
            <p>{t('landing.groups.lead')}</p>
          </div>
          <p className="muted-copy">{t('landing.groups.meta', { available, open: active.length })}</p>
        </div>
        <div className="group-grid" role="list">
          {bloodGroups.map((item) => {
            const count = availableByGroup[item] ?? 0
            const tag = item === 'O-' ? t('landing.groups.universalDonor') : item === 'AB+' ? t('landing.groups.universalRecipient') : null
            return <Link key={item} role="listitem" to={`/find-donors?group=${encodeURIComponent(item)}`} aria-label={t('landing.groups.findAria', { group: item })} className={count ? 'group-tile' : 'group-tile is-empty'}>
              <span className="group-tile-top">
                <span className="group-name">{item}</span>
                <ArrowRight className="group-arrow" />
              </span>
              <span className="group-tile-foot">
                <span className={count ? 'availability-dot is-on' : 'availability-dot'}>{count ? t('landing.groups.count', { count }) : t('landing.groups.none')}</span>
                {tag && <span className="group-tag">{tag}</span>}
              </span>
            </Link>
          })}
        </div>
      </div>
    </section>

    {active.length > 0 && <section className="section section-tinted">
      <div className="container">
        <div className="section-head">
          <div>
            <span className="kicker">{t('landing.urgent.kicker')}</span>
            <h2>{t('landing.urgent.title')}</h2>
            <p>{t('landing.urgent.lead')}</p>
          </div>
          <Link to="/requests" className="button button-secondary">{t('common.viewAll')}<ArrowRight /></Link>
        </div>
        <div className="card-list cols-3">{active.slice(0, 3).map((request) => <RequestCard key={request.id} request={request} />)}</div>
      </div>
    </section>}

    <section className="section">
      <div className="container">
        <div className="section-head section-head-center">
          <div>
            <span className="kicker">{t('landing.steps.kicker')}</span>
            <h2>{t('landing.steps.title')}</h2>
            <p>{t('landing.steps.lead')}</p>
          </div>
        </div>
        <ol className="steps">
          {steps.map(({ icon: Icon, title, text }, index) => (
            <li className="step" key={title}>
              <div className="step-top">
                <span className="step-icon"><Icon /></span>
                <span className="step-num">{String(index + 1).padStart(2, '0')}</span>
              </div>
              <h3>{title}</h3>
              <p>{text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>

    <section className="container section-cta">
      <div className="audience-grid">
        <div className="cta">
          <span className="cta-icon"><HandHeart /></span>
          <div>
            <span className="kicker">{t('landing.cta.kicker')}</span>
            <h2>{t('landing.cta.title')}</h2>
            <p>{t('landing.cta.text')}</p>
          </div>
          <Link to="/register" className="button button-light button-lg">{t('landing.cta.join')}<ArrowRight /></Link>
        </div>
        <div className="cta cta-light">
          <span className="cta-icon"><Hospital /></span>
          <div>
            <span className="kicker">{t('landing.need.kicker')}</span>
            <h2>{t('landing.need.title')}</h2>
            <p>{t('landing.need.text')}</p>
          </div>
          <Link to="/requests/new" className="button button-primary button-lg">{t('landing.need.cta')}<ArrowRight /></Link>
        </div>
      </div>
    </section>
  </>
}
