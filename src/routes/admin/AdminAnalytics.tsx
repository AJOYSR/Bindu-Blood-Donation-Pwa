import { BarChart3 } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { TableSkeleton } from '../../components/Skeleton'
import { fetchDailyMetrics } from '../../lib/admin-api'
import { hasSupabaseConfig } from '../../lib/supabase'

type MetricRow = Awaited<ReturnType<typeof fetchDailyMetrics>>[number]

export default function AdminAnalytics() {
  const [rows, setRows] = useState<MetricRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) { setLoading(false); setError('Supabase is not configured.'); return }
    let active = true
    void fetchDailyMetrics()
      .then((data) => { if (active) setRows(data) })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const chartData = [...rows].reverse().map((row) => ({
    day: String(row.metric_date).slice(5),
    created: row.requests_created,
    fulfilled: row.requests_fulfilled,
    available: row.available_donors
  }))

  return <>
    <div className="admin-page-heading"><div><span>Operational intelligence</span><h1>Privacy-safe analytics</h1><p>Aggregate snapshots only. No personal or health-linked identifiers.</p></div></div>
    {loading && <section className="admin-panel data-panel"><TableSkeleton rows={6} columns={6} /></section>}
    {error && <div className="admin-locked"><BarChart3/><div><strong>Permission required</strong><p>{error}</p></div></div>}
    {!error && !loading && <>
      <section className="admin-panel chart-panel">
        <div className="admin-panel-heading"><div><h2>Daily operational metrics</h2><p>Precomputed in Supabase Cron — not scanned from raw tables on every load.</p></div></div>
        <div className="chart-wrap"><ResponsiveContainer width="100%" height="100%"><BarChart data={chartData}>
          <CartesianGrid vertical={false} stroke="#ececf2" strokeDasharray="3 3"/>
          <XAxis dataKey="day" axisLine={false} tickLine={false}/><YAxis axisLine={false} tickLine={false} width={32}/>
          <Tooltip contentStyle={{border:'1px solid #ececf2',borderRadius:12}}/>
          <Bar dataKey="created" fill="#e0243c" radius={[6, 6, 0, 0]} maxBarSize={28}/>
          <Bar dataKey="fulfilled" fill="#12b076" radius={[6, 6, 0, 0]} maxBarSize={28}/>
        </BarChart></ResponsiveContainer></div>
      </section>
      <section className="admin-panel data-panel">
        <div className="table-scroll"><table className="data-table"><thead><tr>
          <th>Date</th><th>Created</th><th>Fulfilled</th><th>Expired</th><th>No response</th><th>Available</th><th>Median first response</th><th>Median fulfillment</th>
        </tr></thead><tbody>
          {rows.length ? rows.map((row) => (
            <tr key={String(row.metric_date)}>
              <td className="cell-primary"><strong>{String(row.metric_date)}</strong></td>
              <td data-label="Created">{row.requests_created}</td>
              <td data-label="Fulfilled">{row.requests_fulfilled}</td>
              <td data-label="Expired">{row.requests_expired}</td>
              <td data-label="No response">{row.requests_without_response}</td>
              <td data-label="Available">{row.available_donors}</td>
              <td data-label="First response">{row.median_first_response_minutes ?? '—'} min</td>
              <td data-label="Fulfilment">{row.median_fulfillment_minutes ?? '—'} min</td>
            </tr>
          )) : <tr><td colSpan={8}><div className="table-empty"><span className="empty-icon"><BarChart3 /></span><strong>No snapshots yet</strong>Supabase Cron creates them once a day.</div></td></tr>}
        </tbody></table></div>
      </section>
    </>}
  </>
}
