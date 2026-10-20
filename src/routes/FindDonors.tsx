import { RotateCcw, Search, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { DonorCard } from '../components/DonorCard'
import { EmptyState } from '../components/EmptyState'
import { bloodGroups, districts } from '../lib/mock-data'
import { useApp } from '../app/AppContext'
import { track } from '../lib/analytics'
import { pluralKey, useT } from '../i18n'

export default function FindDonors() {
  const { donors } = useApp()
  const t = useT()
  const [params] = useSearchParams()
  const initialGroup = params.get('group')
  const [group, setGroup] = useState(initialGroup && (bloodGroups as string[]).includes(initialGroup) ? initialGroup : 'All')
  const initialDistrict = params.get('district')
  const [district, setDistrict] = useState(initialDistrict && districts.includes(initialDistrict) ? initialDistrict : 'All')
  const [availableOnly, setAvailableOnly] = useState(true)
  const [search, setSearch] = useState('')
  const filtersActive = group !== 'All' || district !== 'All' || !availableOnly || search !== ''
  const clearFilters = () => { setGroup('All'); setDistrict('All'); setAvailableOnly(true); setSearch('') }

  const filtered = useMemo(() => donors
    .filter((donor) => (group === 'All' || donor.bloodGroup === group)
      && (district === 'All' || donor.district === district)
      && (!availableOnly || donor.available)
      && `${donor.displayName} ${donor.area}`.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => Number(b.available) - Number(a.available) || Number(b.verified) - Number(a.verified)),
  [availableOnly, district, donors, group, search])

  useEffect(() => {
    track('donor_search_performed', { result_count: filtered.length, available_only: availableOnly })
  }, [availableOnly, district, filtered.length, group])

  return <div className="page">
    <header className="container page-header">
      <span className="kicker">{t('find.kicker')}</span>
      <h1>{t('find.title')}</h1>
      <p>{t('find.lead')}</p>
    </header>

    <div className="container">
      <div className="filter-bar">
        <div className="search-field">
          <Search />
          <input type="search" aria-label={t('find.searchAria')} placeholder={t('find.searchPlaceholder')} value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <div className="filter-inline">
          <select aria-label={t('find.districtAria')} value={district} onChange={(e) => setDistrict(e.target.value)}>
            <option value="All">{t('find.allDistricts')}</option>
            {districts.map((item) => <option key={item}>{item}</option>)}
          </select>
          <label className="switch-row">
            <input type="checkbox" checked={availableOnly} onChange={(e) => setAvailableOnly(e.target.checked)} />
            <span className="switch-ui" aria-hidden />
            {t('find.available')}
          </label>
        </div>
        <div className="chip-row" role="group" aria-label={t('find.groupAria')}>
          {['All', ...bloodGroups].map((item) => <button
            key={item}
            type="button"
            className={group === item ? 'chip is-active' : 'chip'}
            aria-pressed={group === item}
            onClick={() => setGroup(item)}
          >{item === 'All' ? t('find.allGroups') : item}</button>)}
        </div>
      </div>

      <div className="results-meta">
        <span>{t('find.found', { count: filtered.length, donors: t(pluralKey('common.donor', filtered.length)) })}</span>
        {filtersActive ? <button type="button" className="filter-clear" onClick={clearFilters}>{t('common.clearFilters')}</button> : <span>{t('find.availableFirst')}</span>}
      </div>

      {filtered.length
        ? <div className="card-list cols-3">{filtered.map((donor) => <DonorCard key={donor.id} donor={donor} />)}</div>
        : <EmptyState icon={UsersRound} title={t('find.emptyTitle')} text={t('find.emptyText')} action={filtersActive ? <button type="button" className="button button-secondary" onClick={clearFilters}><RotateCcw />{t('common.clearFilters')}</button> : undefined} />}
    </div>
  </div>
}
