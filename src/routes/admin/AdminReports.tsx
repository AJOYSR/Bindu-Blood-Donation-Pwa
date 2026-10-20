import { CheckCircle2, FileWarning, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { adminResolveReport, fetchReports } from '../../lib/admin-api'
import { useApp } from '../../app/AppContext'
import { useAdminMfa } from '../../app/AdminMfaContext'
import { TableSkeleton } from '../../components/Skeleton'
import { useReasonDialog } from '../../components/ReasonDialog'
import { hasSupabaseConfig } from '../../lib/supabase'

type ReportRow = Awaited<ReturnType<typeof fetchReports>>[number]

export default function AdminReports() {
  const { notify } = useApp()
  const [rows, setRows] = useState<ReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const { ask, dialog } = useReasonDialog()
  const { ensureVerified } = useAdminMfa()

  const load = useCallback(() => {
    if (!hasSupabaseConfig) { setLoading(false); setError('Supabase is not configured.'); return }
    setLoading(true)
    void fetchReports()
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const resolve = async (row: ReportRow, status: 'resolved' | 'dismissed') => {
    const id = row.id
    if (!(await ensureVerified())) return
    const reason = await ask({
      title: status === 'resolved' ? 'Resolve this report?' : 'Dismiss this report?',
      subject: <div><strong>{row.category}</strong><small>{row.entity_type} · {row.details}</small></div>,
      description: status === 'resolved'
        ? 'Confirm the issue was investigated and action was taken.'
        : 'Use this when the report is not a genuine safety concern.',
      label: status === 'resolved' ? 'Resolution' : 'Reason',
      placeholder: status === 'resolved' ? 'What action was taken?' : 'Why is this report being dismissed?',
      presets: status === 'resolved'
        ? ['Request removed', 'Donor suspended', 'Requester warned']
        : ['No evidence found', 'Duplicate report', 'Not a safety issue'],
      confirmLabel: status === 'resolved' ? 'Resolve report' : 'Dismiss report'
    })
    if (!reason) return
    setWorking(id)
    try {
      await adminResolveReport(id, status, reason)
      notify('Report updated', `Marked ${status} with an audit record.`, 'success')
      load()
    } catch (err) {
      notify('Action denied', err instanceof Error ? err.message : 'MFA and moderator permission required.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  return <>
    <div className="admin-page-heading"><div><span>Trust & safety</span><h1>Moderation queue</h1><p>Investigate reports with evidence, assignment, and a recorded resolution.</p></div></div>
    <section className="admin-panel data-panel">
      {loading ? <TableSkeleton /> : error ? <div className="admin-locked admin-inline-msg"><FileWarning/><div><strong>Permission required</strong><p>{error}</p></div></div> : (
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Report</th><th>Details</th><th>Status</th><th>Created</th><th>Action</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td className="cell-primary"><div className="cell-stack"><strong>{row.category}</strong><small>{row.entity_type}</small></div></td>
              <td data-label="Details">{row.details}</td>
              <td data-label="Status"><div><span className={`status status-${row.status}`}>{row.status}</span></div></td>
              <td data-label="Created">{new Date(row.created_at).toLocaleString()}</td>
              <td className="cell-actions"><div className="row-actions">
                {row.status !== 'resolved' && <button disabled={working === row.id} onClick={() => void resolve(row, 'resolved')} title="Resolve"><CheckCircle2/>Resolve</button>}
                {row.status !== 'dismissed' && <button disabled={working === row.id} onClick={() => void resolve(row, 'dismissed')} title="Dismiss"><XCircle/>Dismiss</button>}
              </div></td>
            </tr>
          )) : <tr><td colSpan={5}><div className="table-empty"><span className="empty-icon"><CheckCircle2 /></span><strong>No open reports</strong>Nothing needs moderation right now.</div></td></tr>}</tbody>
        </table></div>
      )}
    </section>
    {dialog}
  </>
}
