import { AlertTriangle, BadgeCheck, BellOff, Clock3, Droplet, ShieldAlert, UsersRound } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { MetricCard } from '../../components/MetricCard'
import { CalendarClock } from 'lucide-react'
import { buildSupplyGapMatrix, fetchAdminOverview, fetchUsageQuota, type AdminOverview, type UsageQuota } from '../../lib/admin-api'
import { supplyGap as mockGap, weeklyRequests as mockWeekly } from '../../lib/mock-data'
import { hasSupabaseConfig } from '../../lib/supabase'
import { useApp } from '../../app/AppContext'

export default function AdminOverview() {
  const { donors, requests } = useApp()
  const [overview, setOverview] = useState<AdminOverview | null>(null)
  const [quota, setQuota] = useState<UsageQuota | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(hasSupabaseConfig)

  useEffect(() => {
    if (!hasSupabaseConfig) return
    let active = true
    void Promise.all([fetchAdminOverview(), fetchUsageQuota()])
      .then(([metrics, usage]) => {
        if (!active) return
        setOverview(metrics)
        setQuota(usage)
      })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const weekly = overview?.weekly?.length ? overview.weekly : mockWeekly
  const gapRows = useMemo(() => {
    if (overview?.supply_gap?.length) return buildSupplyGapMatrix(overview.supply_gap)
    return mockGap
  }, [overview])

  // Demo mode: derive believable numbers from the in-memory data instead of showing zeros.
  const demoMetrics = useMemo(() => {
    const open = requests.filter((r) => r.status === 'open' || r.status === 'matched')
    const soon = Date.now() + 3 * 3600_000
    return {
      active_donors: donors.length, available_today: donors.filter((d) => d.available).length,
      open_requests: open.length, critical_requests: open.filter((r) => r.urgency === 'critical').length,
      expiring_soon: open.filter((r) => new Date(r.neededBy).getTime() < soon).length,
      fulfilled_today: requests.filter((r) => r.status === 'fulfilled').length,
      pending_verification: donors.filter((d) => !d.verified).length, unresolved_reports: 0,
      notification_failures: 0, delivery_failures: 0
    }
  }, [donors, requests])
  const metrics = overview ?? (hasSupabaseConfig ? {
    active_donors: 0, available_today: 0, open_requests: 0, critical_requests: 0,
    expiring_soon: 0, fulfilled_today: 0, pending_verification: 0, unresolved_reports: 0,
    notification_failures: 0, delivery_failures: 0
  } : demoMetrics)

  return <>
    <div className="admin-page-heading">
      <div><span>Operations overview</span><h1>Network health</h1><p>{hasSupabaseConfig ? 'Live aggregate metrics from Supabase. Personal data is excluded.' : 'Demo data — connect Supabase to see live aggregate metrics.'}</p></div>
      <div className="date-chip"><CalendarClock size={15} />{new Date().toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })}</div>
    </div>
    {error && <div className="admin-locked"><ShieldAlert/><div><strong>Could not load metrics</strong><p>{error}</p></div></div>}
        <div className="metrics-grid">
      <MetricCard label="Active donors" value={String(metrics.active_donors)} note="Searchable profiles" icon={UsersRound} tone="red" loading={loading}/>
      <MetricCard label="Available today" value={String(metrics.available_today)} note="Temporary availability" icon={BadgeCheck} tone="green" loading={loading}/>
      <MetricCard label="Open requests" value={String(metrics.open_requests)} note={`${metrics.critical_requests} critical`} icon={Droplet} tone="amber" loading={loading}/>
      <MetricCard label="Pending review" value={String(metrics.pending_verification + metrics.unresolved_reports)} note="Verification + reports" icon={ShieldAlert} tone="blue" loading={loading}/>
    </div>
    {quota && <section className="admin-panel quota-panel">
      <div className="admin-panel-heading"><div><h2>Free-tier usage warning</h2><p>{quota.notes}</p></div></div>
      <div className="quota-grid">
        <article><strong>{quota.profiles}</strong><span>Profiles</span></article>
        <article><strong>{quota.blood_requests}</strong><span>Requests</span></article>
        <article><strong>{quota.notifications}</strong><span>Notifications</span></article>
        <article><strong>{quota.push_subscriptions}</strong><span>Push subs</span></article>
        <article><strong>{quota.audit_logs}</strong><span>Audit rows</span></article>
      </div>
    </section>}
    <div className="admin-dashboard-grid">
      <section className="admin-panel chart-panel">
        <div className="admin-panel-heading"><div><h2>Request activity</h2><p>Created versus fulfilled over the last 7 days.</p></div>
          <div className="legend"><span className="legend-created">Created</span><span className="legend-fulfilled">Fulfilled</span></div>
        </div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><AreaChart data={weekly} margin={{left:-20,right:4,top:10}}>
          <defs><linearGradient id="created" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#e0243c" stopOpacity={.22}/><stop offset="100%" stopColor="#e0243c" stopOpacity={0}/></linearGradient><linearGradient id="fulfilled" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#12b076" stopOpacity={.14}/><stop offset="100%" stopColor="#12b076" stopOpacity={0}/></linearGradient></defs>
          <CartesianGrid vertical={false} stroke="#ececf2" strokeDasharray="3 3"/>
          <XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false}/>
          <Tooltip contentStyle={{border:'1px solid #ececf2',borderRadius:12,boxShadow:'0 12px 28px -6px rgba(17,18,28,.12)',fontSize:12}} cursor={{stroke:'#d6d7e1',strokeDasharray:'4 4'}}/>
          <Area type="monotone" dataKey="created" stroke="#e0243c" fill="url(#created)" strokeWidth={2.5}/>
          <Area type="monotone" dataKey="fulfilled" stroke="#12b076" fill="transparent" strokeWidth={2.5}/>
        </AreaChart></ResponsiveContainer></div>
      </section>
      <section className="admin-panel attention-panel">
        <div className="admin-panel-heading"><div><h2>Needs attention</h2><p>Prioritized operational queue.</p></div></div>
        <div className="attention-list">
          <Attention icon={AlertTriangle} tone="red" count={metrics.critical_requests} title="Critical requests" text="High urgency open needs"/>
          <Attention icon={Clock3} tone="amber" count={metrics.expiring_soon} title="Expiring soon" text="Within the next 3 hours"/>
          <Attention icon={ShieldAlert} tone="blue" count={metrics.unresolved_reports} title="Unresolved reports" text="Moderation backlog"/>
          <Attention icon={BellOff} tone="purple" count={metrics.delivery_failures} title="Delivery failures" text="Push subscriptions need cleanup"/>
          {(overview?.alerts ?? []).slice(0, 3).map((alert) => (
            <Attention key={alert.id} icon={AlertTriangle} tone={alert.severity === 'critical' ? 'red' : 'amber'} title={alert.alert_type.replaceAll('_', ' ')} text={alert.message}/>
          ))}
        </div>
      </section>
    </div>
    <section className="admin-panel supply-panel">
      <div className="admin-panel-heading"><div><h2>Blood supply gap</h2><p>Availability compared with open demand. Aggregated data only.</p></div>
        <div className="gap-legend"><span><i className="gap-ok"/>Stable</span><span><i className="gap-low"/>Low</span><span><i className="gap-critical"/>Critical</span></div>
      </div>
      <div className="table-scroll"><table className="gap-table"><thead><tr><th>District</th>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((g) => <th key={g}>{g}</th>)}</tr></thead>
        <tbody>{gapRows.map((row) => <tr key={row.district}><th>{row.district}</th>{['A+','A-','B+','B-','O+','O-','AB+','AB-'].map((g) => {
          const level = String(row[g as keyof typeof row] ?? 'ok')
          return <td key={g}><span className={`gap-${level}`}>{level}</span></td>
        })}</tr>)}</tbody>
      </table></div>
    </section>
    <div className="admin-footnote"><BadgeCheck/>Metrics come from daily snapshots and live counts. Sensitive personal information is excluded.</div>
  </>
}

function Attention({ icon: Icon, tone, title, text, count }: { icon: typeof AlertTriangle; tone: string; title: string; text: string; count?: number }) {
  return <article><span className={`attention-icon ${tone}`}><Icon/></span><div><strong>{title}</strong><p>{text}</p></div>{count !== undefined && <span className="attention-count">{count}</span>}</article>
}
