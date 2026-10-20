import { CheckCircle2, FileText, Search, ShieldAlert, XCircle } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useApp } from '../../app/AppContext'
import { useAdminMfa } from '../../app/AdminMfaContext'
import { BloodBadge } from '../../components/BloodBadge'
import { StatusBadge } from '../../components/StatusBadge'
import { useReasonDialog, type ReasonRequest } from '../../components/ReasonDialog'
import { adminAddRequestNote, adminChangeRequestStatus } from '../../lib/admin-api'
import { formatDate } from '../../lib/utils'
import type { BloodRequest } from '../../types'

type StatusAction = 'fulfilled' | 'cancelled' | 'fraudulent'

const statusDialogs: Record<StatusAction, ReasonRequest> = {
  fulfilled: {
    title: 'Mark request as fulfilled?',
    description: 'The request closes and donors stop receiving alerts for it.',
    placeholder: 'e.g. Hospital confirmed all units were collected',
    presets: ['Hospital confirmed units collected', 'Requester confirmed need is met'],
    confirmLabel: 'Mark fulfilled'
  },
  cancelled: {
    title: 'Cancel this request?',
    description: 'The request closes and is removed from the public list.',
    placeholder: 'Why is this request being cancelled?',
    presets: ['Requester withdrew the request', 'Duplicate request', 'Patient transferred'],
    confirmLabel: 'Cancel request',
    tone: 'danger'
  },
  fraudulent: {
    title: 'Flag as fraudulent?',
    description: 'The request closes and is removed from the public list. Use this only with clear evidence.',
    placeholder: 'Describe the evidence you reviewed',
    presets: ['Asked donors for payment', 'Hospital has no record of patient', 'Fake contact details'],
    confirmLabel: 'Flag fraudulent',
    tone: 'danger'
  }
}

export default function AdminRequests() {
  const { requests, updateRequest, notify } = useApp()
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState('all')
  const [working, setWorking] = useState<string | null>(null)
  const { ask, dialog } = useReasonDialog()
  const { ensureVerified } = useAdminMfa()

  const filtered = useMemo(
    () => requests.filter((request) => (status === 'all' || request.status === status) && `${request.id} ${request.hospital} ${request.area}`.toLowerCase().includes(query.toLowerCase())),
    [query, requests, status]
  )

  const requestSubject = (request: BloodRequest) => <>
    <BloodBadge group={request.bloodGroup} size="md"/>
    <div><strong>{request.id} · {request.units} {request.units === 1 ? 'unit' : 'units'}</strong><small>{request.hospital}, {request.area}</small></div>
  </>

  const changeStatus = async (id: string, next: StatusAction) => {
    const request = requests.find((item) => item.id === id)
    if (!request?.backendId) {
      notify('Demo-only row', 'Connect Supabase and use seeded requests for audited status changes.', 'danger')
      return
    }
    if (!(await ensureVerified())) return
    const reason = await ask({ ...statusDialogs[next], subject: requestSubject(request) })
    if (!reason) return
    setWorking(id)
    try {
      await adminChangeRequestStatus(request.backendId, next, reason)
      updateRequest(id, { status: next })
      notify('Request updated', `${id} → ${next}. Audit entry recorded.`, 'success')
    } catch (error) {
      notify('Admin action denied', error instanceof Error ? error.message : 'Requires operations permission and MFA.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const addNote = async (id: string) => {
    const request = requests.find((item) => item.id === id)
    if (!request?.backendId) {
      notify('Demo-only row', 'Connect Supabase to add internal notes.', 'danger')
      return
    }
    if (!(await ensureVerified())) return
    const body = await ask({
      title: 'Add internal note',
      subject: requestSubject(request),
      description: 'Visible to operations staff only. Never shown to donors or requesters.',
      label: 'Note',
      placeholder: 'e.g. Called the hospital, confirmed the need is genuine',
      confirmLabel: 'Save note'
    })
    if (!body) return
    setWorking(id)
    try {
      await adminAddRequestNote(request.backendId, body)
      notify('Note saved', 'Internal note recorded with audit trail.', 'success')
    } catch (error) {
      notify('Could not save note', error instanceof Error ? error.message : 'Permission denied.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  return <>
    <div className="admin-page-heading"><div><span>Operations</span><h1>Blood requests</h1><p>Verify, prioritize, fulfill, cancel, or flag fraudulent requests. Every mutation is audited.</p></div></div>
    <section className="admin-panel data-panel">
      <div className="data-toolbar">
        <div className="search-field"><Search/><input type="search" placeholder="Search request, hospital, or area" value={query} onChange={(event) => setQuery(event.target.value)}/></div>
        <select value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="matched">Matched</option>
          <option value="fulfilled">Fulfilled</option>
          <option value="cancelled">Cancelled</option>
          <option value="fraudulent">Fraudulent</option>
        </select>
      </div>
      <div className="table-scroll"><table className="data-table"><thead><tr><th>Request</th><th>Hospital</th><th>Needed by</th><th>Responses</th><th>Status</th><th>Action</th></tr></thead>
        <tbody>{filtered.length === 0 && <tr><td colSpan={6}><div className="table-empty"><span className="empty-icon"><Search /></span><strong>No requests match</strong>Try another status or search term.</div></td></tr>}{filtered.map((request) => (
          <tr key={request.id}>
            <td className="cell-primary"><div className="cell-with-badge"><BloodBadge group={request.bloodGroup} size="sm"/><div className="cell-stack"><strong>{request.id}</strong><small>{request.area}, {request.district}</small></div></div></td>
            <td data-label="Hospital"><div className="cell-stack"><strong>{request.hospital}</strong><small>{request.urgency} priority</small></div></td>
            <td data-label="Needed by">{formatDate(request.neededBy)}</td>
            <td data-label="Responses">{request.responses}</td>
            <td data-label="Status"><div><StatusBadge value={request.status}/></div></td>
            <td className="cell-actions"><div className="row-actions">
              {request.status !== 'fulfilled' && <button title="Mark fulfilled" disabled={working === request.id} onClick={() => void changeStatus(request.id, 'fulfilled')}><CheckCircle2/>Fulfil</button>}
              {request.status !== 'cancelled' && <button title="Cancel" disabled={working === request.id} onClick={() => void changeStatus(request.id, 'cancelled')}><XCircle/>Cancel</button>}
              {request.status !== 'fraudulent' && <button className="is-danger" title="Flag fraudulent" disabled={working === request.id} onClick={() => void changeStatus(request.id, 'fraudulent')}><ShieldAlert/>Flag</button>}
              <button title="Internal note" disabled={working === request.id} onClick={() => void addNote(request.id)}><FileText/>Note</button>
            </div></td>
          </tr>
        ))}</tbody>
      </table></div>
      <div className="pagination"><span>Showing {filtered.length} of {requests.length} requests</span></div>
    </section>
    {dialog}
  </>
}
