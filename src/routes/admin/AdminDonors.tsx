import { Spinner, TableSkeleton } from '../../components/Skeleton'
import { BadgeCheck, Ban, Eye, Pencil, Plus, Search, ShieldCheck, Trash2, UsersRound, X } from 'lucide-react'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from '@tanstack/react-table'
import { useApp } from '../../app/AppContext'
import { useAdminMfa } from '../../app/AdminMfaContext'
import { BloodBadge } from '../../components/BloodBadge'
import { DateTimePicker } from '../../components/DateTimePicker'
import { useReasonDialog } from '../../components/ReasonDialog'
import {
  adminCreateDonor,
  adminDeleteDonor,
  adminGetDonor,
  adminListDonors,
  adminSuspendDonor,
  adminUpdateDonor,
  type AdminDonor
} from '../../lib/admin-api'
import { bloodGroups, districts } from '../../lib/mock-data'
import { hasSupabaseConfig } from '../../lib/supabase'
import type { BloodGroup } from '../../types'

const columnHelper = createColumnHelper<AdminDonor>()

function cellProps(id: string, header: unknown) {
  if (id === 'display_name') return { className: 'cell-primary' }
  if (id === 'actions') return { className: 'cell-actions' }
  return { 'data-label': typeof header === 'string' ? header : '' }
}

type PanelMode = 'view' | 'edit' | 'create' | null

interface DonorFormState {
  email: string
  displayName: string
  bloodGroup: BloodGroup
  district: string
  area: string
  phone: string
  searchable: boolean
  lastDonation: string
  birthYear: string
  available: boolean
  reason: string
}

const emptyForm = (): DonorFormState => ({
  email: '',
  displayName: '',
  bloodGroup: 'O+',
  district: 'Dhaka',
  area: '',
  phone: '',
  searchable: true,
  lastDonation: '',
  birthYear: '',
  available: true,
  reason: ''
})

function formFromDonor(donor: AdminDonor): DonorFormState {
  return {
    email: donor.email ?? '',
    displayName: donor.display_name,
    bloodGroup: donor.blood_group,
    district: donor.district,
    area: donor.area,
    phone: donor.phone ?? '',
    searchable: donor.searchable,
    lastDonation: donor.last_donation_date ?? '',
    birthYear: donor.birth_year ? String(donor.birth_year) : '',
    available: donor.available,
    reason: ''
  }
}

export default function AdminDonors() {
  const { notify } = useApp()
  const [rows, setRows] = useState<AdminDonor[]>([])
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [working, setWorking] = useState<string | null>(null)
  const [panel, setPanel] = useState<PanelMode>(null)
  const [selected, setSelected] = useState<AdminDonor | null>(null)
  const [form, setForm] = useState<DonorFormState>(emptyForm)
  const [saving, setSaving] = useState(false)
  const [tempPassword, setTempPassword] = useState<string | null>(null)
  const { ask, dialog } = useReasonDialog()
  const { ensureVerified } = useAdminMfa()

  const load = useCallback(async () => {
    if (!hasSupabaseConfig) { setLoading(false); setRows([]); return }
    setLoading(true)
    try {
      setRows(await adminListDonors())
    } catch (error) {
      notify('Could not load donors', error instanceof Error ? error.message : 'Permission denied.', 'danger')
      setRows([])
    } finally {
      setLoading(false)
    }
  }, [notify])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    if (!panel) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = previous }
  }, [panel])

  const openView = async (donor: AdminDonor) => {
    if (!(await ensureVerified())) return
    setWorking(donor.user_id)
    try {
      const detail = await adminGetDonor(donor.user_id)
      setSelected(detail)
      setForm(formFromDonor(detail))
      setPanel('view')
      setTempPassword(null)
    } catch (error) {
      notify('Could not open donor', error instanceof Error ? error.message : 'Please try again.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const openCreate = async () => {
    if (!(await ensureVerified())) return
    setSelected(null)
    setForm(emptyForm())
    setTempPassword(null)
    setPanel('create')
  }

  const openEdit = async (donor?: AdminDonor) => {
    if (!(await ensureVerified())) return
    const target = donor ?? selected
    if (!target) return
    setWorking(target.user_id)
    try {
      const detail = await adminGetDonor(target.user_id)
      setSelected(detail)
      setForm(formFromDonor(detail))
      setPanel('edit')
      setTempPassword(null)
    } catch (error) {
      notify('Could not open donor', error instanceof Error ? error.message : 'Please try again.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const closePanel = () => {
    setPanel(null)
    setSelected(null)
    setTempPassword(null)
    setForm(emptyForm())
  }

  const save = async () => {
    if (form.displayName.trim().length < 2) { notify('Name required', 'Enter a display name.', 'danger'); return }
    if (form.area.trim().length < 2) { notify('Area required', 'Enter an approximate area.', 'danger'); return }
    if (form.reason.trim().length < 5) { notify('Reason required', 'Add a short reason for the audit log.', 'danger'); return }
    if (panel === 'create' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      notify('Email required', 'Enter a valid email address.', 'danger')
      return
    }

    setSaving(true)
    try {
      if (panel === 'create') {
        const created = await adminCreateDonor({
          email: form.email.trim(),
          displayName: form.displayName.trim(),
          bloodGroup: form.bloodGroup,
          district: form.district,
          area: form.area.trim(),
          phone: form.phone.trim() || undefined,
          searchable: form.searchable,
          lastDonation: form.lastDonation || null,
          birthYear: form.birthYear ? Number(form.birthYear) : null,
          reason: form.reason.trim()
        })
        if (created.temporary_password) setTempPassword(created.temporary_password)
        notify('Donor added', created.created_auth_user
          ? 'A new sign-in account was created. Share the temporary password securely.'
          : 'Donor profile linked to the existing member account.', 'success')
        await load()
        if (created.temporary_password) {
          const detail = await adminGetDonor(created.user_id)
          setSelected(detail)
          setForm(formFromDonor(detail))
          setPanel('view')
        } else {
          closePanel()
        }
      } else if (panel === 'edit' && selected) {
        await adminUpdateDonor(selected.user_id, {
          displayName: form.displayName.trim(),
          bloodGroup: form.bloodGroup,
          district: form.district,
          area: form.area.trim(),
          phone: form.phone.trim(),
          searchable: form.searchable,
          lastDonation: form.lastDonation || null,
          birthYear: form.birthYear ? Number(form.birthYear) : null,
          available: form.available,
          reason: form.reason.trim()
        })
        notify('Donor updated', 'Changes were saved and audited.', 'success')
        await load()
        closePanel()
      }
    } catch (error) {
      notify('Could not save donor', error instanceof Error ? error.message : 'Please try again.', 'danger')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (donor: AdminDonor) => {
    if (!(await ensureVerified())) return
    const reason = await ask({
      title: 'Remove donor from the network?',
      subject: <>
        <BloodBadge group={donor.blood_group} size="md" />
        <div><strong>{donor.display_name}</strong><small>{donor.area}, {donor.district}</small></div>
      </>,
      description: 'They are hidden from donor search and marked unavailable. Their sign-in account is kept. This is audited.',
      placeholder: 'Why is this donor being removed?',
      presets: ['Duplicate profile', 'Requested removal', 'Inactive / unreachable', 'Safety concern'],
      confirmLabel: 'Remove donor',
      tone: 'danger'
    })
    if (!reason) return
    setWorking(donor.user_id)
    try {
      await adminDeleteDonor(donor.user_id, reason)
      notify('Donor removed', 'Hidden from the directory and audited.', 'success')
      if (selected?.user_id === donor.user_id) closePanel()
      await load()
    } catch (error) {
      notify('Could not remove donor', error instanceof Error ? error.message : 'Permission denied.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const suspend = async (donor: AdminDonor) => {
    if (!(await ensureVerified())) return
    const reason = await ask({
      title: 'Suspend donor for 7 days?',
      subject: <>
        <BloodBadge group={donor.blood_group} size="md" />
        <div><strong>{donor.display_name}</strong><small>{donor.area}, {donor.district} · {donor.donation_count} donations</small></div>
      </>,
      description: 'Their availability is paused and they are hidden from donor search. Blood group and donation history cannot be silently altered.',
      placeholder: 'Describe what happened and any evidence reviewed',
      presets: ['Reported for asking for payment', 'Repeated no-shows after confirming', 'Suspected fake profile', 'Abusive behaviour reported'],
      confirmLabel: 'Suspend donor',
      tone: 'danger'
    })
    if (!reason) return
    setWorking(donor.user_id)
    try {
      await adminSuspendDonor(donor.user_id, reason, 7)
      notify('Donor suspended', 'Availability paused, search hidden, and an audit record was written.', 'success')
      await load()
    } catch (error) {
      notify('Action denied', error instanceof Error ? error.message : 'Requires donor.review and MFA.', 'danger')
    } finally {
      setWorking(null)
    }
  }

  const columns = useMemo(() => [
    columnHelper.accessor('display_name', {
      header: 'Donor',
      cell: (info) => <div className="cell-with-badge">
        <BloodBadge group={info.row.original.blood_group} size="sm" />
        <div className="cell-stack">
          <strong className="verified-name">{info.getValue()}{info.row.original.verification_status === 'verified' && <BadgeCheck />}</strong>
          <small>{info.row.original.email || 'No email'}</small>
        </div>
      </div>
    }),
    columnHelper.display({ id: 'area', header: 'Area', cell: ({ row }) => `${row.original.area}, ${row.original.district}` }),
    columnHelper.accessor('donation_count', { header: 'Donations' }),
    columnHelper.display({
      id: 'directory',
      header: 'Directory',
      cell: ({ row }) => <div><span className={`status ${row.original.searchable ? 'status-available' : 'status-cancelled'}`}>{row.original.searchable ? 'Listed' : 'Hidden'}</span></div>
    }),
    columnHelper.display({
      id: 'standing',
      header: 'Standing',
      cell: ({ row }) => <div><span className={`status ${row.original.available ? 'status-available' : 'status-expired'}`}><ShieldCheck />{row.original.available ? 'Available' : 'Paused'}</span></div>
    }),
    columnHelper.display({
      id: 'actions',
      header: 'Action',
      cell: ({ row }) => <div className="row-actions">
        <button type="button" className="table-action" disabled={working === row.original.user_id} onClick={() => void openView(row.original)}><Eye />View</button>
        <button type="button" className="table-action" disabled={working === row.original.user_id} onClick={() => void openEdit(row.original)}><Pencil />Edit</button>
        <button type="button" className="table-action" disabled={working === row.original.user_id} onClick={() => void suspend(row.original)}><Ban />Suspend</button>
        <button type="button" className="table-action is-danger" disabled={working === row.original.user_id} onClick={() => void remove(row.original)}><Trash2 />Remove</button>
      </div>
    })
  ], [working])

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter: query },
    onGlobalFilterChange: setQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })

  const setField = <K extends keyof DonorFormState>(key: K, value: DonorFormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }))
  }

  return <>
    <div className="admin-page-heading">
      <div>
        <span>Community</span>
        <h1>Donor management</h1>
        <p>View, add, edit or remove donor profiles. Sensitive changes are audited.</p>
      </div>
      <button type="button" className="button button-primary" onClick={() => void openCreate()}><Plus />Add donor</button>
    </div>

    <section className="admin-panel data-panel">
      <div className="data-toolbar">
        <div className="search-field"><Search /><input type="search" placeholder="Search name, email or area" value={query} onChange={(e) => setQuery(e.target.value)} /></div>
      </div>
      {loading ? <TableSkeleton columns={6} /> : (
        <div className="table-scroll"><table className="data-table">
          <thead>{table.getHeaderGroups().map((group) => <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>)}</thead>
          <tbody>
            {table.getRowModel().rows.length
              ? table.getRowModel().rows.map((row) => <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} {...cellProps(cell.column.id, cell.column.columnDef.header)}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>)
              : <tr><td colSpan={columns.length}><div className="table-empty"><span className="empty-icon"><UsersRound /></span><strong>{hasSupabaseConfig ? (query ? 'No donors match' : 'No donors yet') : 'Demo mode'}</strong>{hasSupabaseConfig ? (query ? 'Try a different name, email or area.' : 'Add the first donor profile to get started.') : 'Connect Supabase to manage real donor profiles.'}</div></td></tr>}
          </tbody>
        </table></div>
      )}
    </section>

    {panel && createPortal(
      <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) closePanel() }}>
        <div className="modal admin-donor-modal" role="dialog" aria-modal="true" aria-labelledby="donor-panel-title">
          <span className="modal-grabber" aria-hidden />
          <header className="modal-head">
            <h2 id="donor-panel-title">{panel === 'create' ? 'Add donor' : panel === 'edit' ? 'Edit donor' : 'Donor profile'}</h2>
            <button type="button" className="icon-button" aria-label="Close" onClick={closePanel}><X /></button>
          </header>

          {panel === 'view' && selected && <>
            <div className="modal-scroll">
              <div className="modal-subject">
                <BloodBadge group={selected.blood_group} size="lg" />
                <div>
                  <strong className="verified-name">{selected.display_name}{selected.verification_status === 'verified' && <BadgeCheck />}</strong>
                  <small>{selected.email || 'No email'} · {selected.area}, {selected.district}</small>
                </div>
              </div>
              {tempPassword && <div className="notice notice-warn"><ShieldCheck /><p><strong>Temporary password</strong>Share once, then ask the donor to change it: <code>{tempPassword}</code></p></div>}
              <div className="admin-donor-facts">
                <div><small>Phone</small><strong>{selected.phone || '—'}</strong></div>
                <div><small>Directory</small><strong>{selected.searchable ? 'Listed' : 'Hidden'}</strong></div>
                <div><small>Availability</small><strong>{selected.available ? 'Available' : 'Paused'}</strong></div>
                <div><small>Donations</small><strong>{selected.donation_count}</strong></div>
                <div><small>Response rate</small><strong>{selected.response_rate}%</strong></div>
                <div><small>Last donation</small><strong>{selected.last_donation_date || '—'}</strong></div>
                <div><small>Birth year</small><strong>{selected.birth_year || '—'}</strong></div>
                <div><small>Verification</small><strong>{selected.verification_status}</strong></div>
              </div>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={() => void openEdit()}><Pencil />Edit</button>
              <button type="button" className="button button-danger" onClick={() => void remove(selected)}><Trash2 />Remove</button>
            </div>
          </>}

          {(panel === 'create' || panel === 'edit') && <form className="modal-form" onSubmit={(event) => { event.preventDefault(); void save() }}>
            <div className="modal-scroll">
              {panel === 'create' && <label>Email
                <input type="email" required value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="donor@example.com" autoComplete="off" />
                <span className="field-help">If the email is new, a sign-in account is created. If it already exists, that member becomes a donor.</span>
              </label>}
              <div className="form-grid">
                <label>Display name
                  <input required minLength={2} value={form.displayName} onChange={(e) => setField('displayName', e.target.value)} />
                </label>
                <label>Blood group
                  <select value={form.bloodGroup} onChange={(e) => setField('bloodGroup', e.target.value as BloodGroup)}>
                    {bloodGroups.map((group) => <option key={group}>{group}</option>)}
                  </select>
                </label>
                <label>District
                  <select value={form.district} onChange={(e) => setField('district', e.target.value)}>
                    {districts.map((item) => <option key={item}>{item}</option>)}
                  </select>
                </label>
                <label>Area
                  <input required minLength={2} value={form.area} onChange={(e) => setField('area', e.target.value)} placeholder="e.g. Dhanmondi" />
                </label>
                <label>Phone
                  <input type="tel" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="Optional" />
                </label>
                <label>Birth year
                  <input type="number" min={1940} max={new Date().getFullYear() - 18} value={form.birthYear} onChange={(e) => setField('birthYear', e.target.value)} placeholder="Optional" />
                </label>
                <div className="span-2 field">
                  <span className="field-label">Last donation</span>
                  <DateTimePicker
                    mode="date"
                    value={form.lastDonation}
                    onChange={(value) => setField('lastDonation', value)}
                    max={new Date()}
                    placeholder="Choose last donation date"
                    urgency="standard"
                  />
                </div>
              </div>
              <label className="setting-row">
                <div><strong>Show in donor directory</strong><small>Public search results.</small></div>
                <input type="checkbox" checked={form.searchable} onChange={(e) => setField('searchable', e.target.checked)} />
                <span className="switch-ui" aria-hidden />
              </label>
              {panel === 'edit' && <label className="setting-row">
                <div><strong>Available to donate</strong><small>Updates their live availability.</small></div>
                <input type="checkbox" checked={form.available} onChange={(e) => setField('available', e.target.checked)} />
                <span className="switch-ui" aria-hidden />
              </label>}
              <label>Reason for audit log
                <textarea required minLength={5} rows={3} value={form.reason} onChange={(e) => setField('reason', e.target.value)} placeholder="Why are you making this change?" />
              </label>
            </div>
            <div className="modal-actions">
              <button type="button" className="button button-secondary" onClick={closePanel}>Cancel</button>
              <button type="submit" className="button button-primary" disabled={saving} aria-busy={saving}>{saving ? <><Spinner />Saving…</> : panel === 'create' ? 'Add donor' : 'Save changes'}</button>
            </div>
          </form>}
        </div>
      </div>,
      document.body
    )}

    {dialog}
  </>
}
