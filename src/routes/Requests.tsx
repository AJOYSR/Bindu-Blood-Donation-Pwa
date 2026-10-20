import { Droplet, Plus, RotateCcw, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../app/AppContext'
import { EmptyState } from '../components/EmptyState'
import { RequestCard } from '../components/RequestCard'
import { pluralKey, useT } from '../i18n'
import { bloodGroups } from '../lib/mock-data'

const urgencyRank = { critical: 0, urgent: 1, standard: 2 }

export default function Requests() {
  const { requests } = useApp()
  const t = useT()
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('All')
  const [status, setStatus] = useState('active')
  const filtersActive = group !== 'All' || query !== '' || status !== 'active'
  const clearFilters = () => { setGroup('All'); setQuery(''); setStatus('active') }

  const statusTabs = [
    { value: 'active', label: t('requests.tab.active') },
    { value: 'fulfilled', label: t('requests.tab.fulfilled') },
    { value: 'all', label: t('requests.tab.all') }
  ]

  const filtered = useMemo(() => requests
    .filter((r) => (group === 'All' || r.bloodGroup === group)
      && (status === 'all' || (status === 'active' ? ['open', 'matched'].includes(r.status) : r.status === status))
      && `${r.hospital} ${r.area} ${r.id}`.toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => status === 'active' ? urgencyRank[a.urgency] - urgencyRank[b.urgency] : 0),
  [group, query, requests, status])

  return <div className="page">
    <header className="container page-header page-header-row">
      <div>
        <span className="kicker">{t('requests.kicker')}</span>
        <h1>{t('requests.title')}</h1>
        <p>{t('requests.lead')}</p>
      </div>
      <Link to="/requests/new" className="button button-primary hide-mobile"><Plus />{t('requests.new')}</Link>
    </header>

    <div className="container">
      <div className="filter-bar">
        <div className="search-field">
          <Search />
          <input type="search" aria-label={t('requests.searchAria')} placeholder={t('requests.searchPlaceholder')} value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
        <div className="segmented" role="tablist" aria-label={t('requests.statusAria')}>
          {statusTabs.map((tab) => <button
            key={tab.value}
            type="button"
            role="tab"
            aria-selected={status === tab.value}
            className={status === tab.value ? 'is-active' : ''}
            onClick={() => setStatus(tab.value)}
          >{tab.label}</button>)}
        </div>
        <div className="chip-row" role="group" aria-label={t('requests.groupAria')}>
          {['All', ...bloodGroups].map((item) => <button
            key={item}
            type="button"
            className={group === item ? 'chip is-active' : 'chip'}
            aria-pressed={group === item}
            onClick={() => setGroup(item)}
          >{item === 'All' ? t('requests.allGroups') : item}</button>)}
        </div>
      </div>

      <div className="results-meta">
        <span>{t('requests.count', { count: filtered.length, requests: t(pluralKey('common.request', filtered.length)) })}</span>
        {filtersActive ? <button type="button" className="filter-clear" onClick={clearFilters}>{t('common.clearFilters')}</button> : <span>{t('requests.urgentFirst')}</span>}
      </div>

      {filtered.length
        ? <div className="card-list cols-3">{filtered.map((r) => <RequestCard request={r} key={r.id} />)}</div>
        : <EmptyState icon={Droplet} title={t('requests.emptyTitle')} text={t('requests.emptyText')} action={filtersActive
            ? <button type="button" className="button button-secondary" onClick={clearFilters}><RotateCcw />{t('common.clearFilters')}</button>
            : <Link to="/requests/new" className="button button-primary"><Plus />{t('requests.new')}</Link>} />}
    </div>
  </div>
}
