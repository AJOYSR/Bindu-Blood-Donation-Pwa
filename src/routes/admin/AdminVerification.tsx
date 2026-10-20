import { BadgeCheck, ExternalLink, FileCheck2, XCircle } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { adminReviewVerification, fetchVerifications } from '../../lib/admin-api'
import { useApp } from '../../app/AppContext'
import { TableSkeleton } from '../../components/Skeleton'
import { useReasonDialog } from '../../components/ReasonDialog'
import { hasSupabaseConfig, supabase } from '../../lib/supabase'

type VerificationRow = Awaited<ReturnType<typeof fetchVerifications>>[number]

export default function AdminVerification() {
  const { notify } = useApp()
  const [rows, setRows] = useState<VerificationRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const { ask, dialog } = useReasonDialog()

  const load = useCallback(() => {
    if (!hasSupabaseConfig) { setLoading(false); setError('Supabase is not configured.'); return }
    setLoading(true)
    void fetchVerifications()
      .then(setRows)
      .catch((err: Error) => setError(err.message))
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => { load() }, [load])

  const review = async (row: VerificationRow, status: 'verified' | 'rejected') => {
    const id = row.id
    const reason = await ask({
      title: status === 'verified' ? 'Approve verification?' : 'Reject verification?',
      subject: <div><strong>{row.document_type}</strong><small>Submitted {new Date(row.created_at).toLocaleString()}</small></div>,
      description: status === 'verified'
        ? 'The donor gets a verified badge on their public profile.'
        : 'The donor can submit a new document afterwards.',
      placeholder: status === 'verified' ? 'What did you check?' : 'Why is this document being rejected?',
      presets: status === 'verified'
        ? ['Name and photo match the profile', 'Document is valid and readable']
        : ['Document is unreadable', 'Name does not match profile', 'Document has expired'],
      confirmLabel: status === 'verified' ? 'Approve' : 'Reject',
      tone: status === 'verified' ? 'default' : 'danger'
    })
    if (!reason) return
    setWorking(id)
    try {
      await adminReviewVerification(id, status, reason)
      notify('Verification reviewed', `Marked ${status} and audited.`, 'success')
      load()
    } catch (err) {
      notify('Action denied', err instanceof Error ? err.message : 'MFA and verification permission required.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const openDocument = async (path: string) => {
    if (!supabase) return
    const { data, error: signedError } = await supabase.storage.from('verification-documents').createSignedUrl(path, 60)
    if (signedError || !data?.signedUrl) {
      notify('Could not open document', signedError?.message ?? 'Signed URL failed.', 'danger')
      return
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer')
  }

  return <>
    <div className="admin-page-heading"><div><span>Trust & safety</span><h1>Verification queue</h1><p>Review donor identity evidence through private, short-lived signed URLs.</p></div></div>
    <section className="admin-panel data-panel">
      {loading ? <TableSkeleton /> : error ? <div className="admin-locked admin-inline-msg"><FileCheck2/><div><strong>Permission required</strong><p>{error}</p></div></div> : (
        <div className="table-scroll"><table className="data-table"><thead><tr><th>Document</th><th>Status</th><th>Submitted</th><th>Action</th></tr></thead>
          <tbody>{rows.length ? rows.map((row) => (
            <tr key={row.id}>
              <td className="cell-primary"><div className="cell-stack"><strong>{row.document_type}</strong><small>{row.user_id}</small></div></td>
              <td data-label="Status"><div><span className={`status status-${row.status}`}>{row.status}</span></div></td>
              <td data-label="Submitted">{new Date(row.created_at).toLocaleString()}</td>
              <td className="cell-actions"><div className="row-actions">
                <button type="button" onClick={() => void openDocument(row.document_path)} title="Open document"><ExternalLink/>Open</button>
                {row.status === 'pending' && <>
                  <button disabled={working === row.id} onClick={() => void review(row, 'verified')} title="Approve"><BadgeCheck/>Approve</button>
                  <button className="is-danger" disabled={working === row.id} onClick={() => void review(row, 'rejected')} title="Reject"><XCircle/>Reject</button>
                </>}
              </div></td>
            </tr>
          )) : <tr><td colSpan={4}><div className="table-empty"><span className="empty-icon"><FileCheck2 /></span><strong>Queue is clear</strong>No verification submissions are waiting for review.</div></td></tr>}</tbody>
        </table></div>
      )}
    </section>
    {dialog}
  </>
}
