import { FileClock, Search } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  useReactTable
} from '@tanstack/react-table'
import { TableSkeleton } from '../../components/Skeleton'
import { fetchAuditLogs } from '../../lib/admin-api'
import { hasSupabaseConfig } from '../../lib/supabase'

type AuditRow = Awaited<ReturnType<typeof fetchAuditLogs>>[number]
const columnHelper = createColumnHelper<AuditRow>()

export default function AdminAuditLog() {
  const [rows, setRows] = useState<AuditRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!hasSupabaseConfig) { setLoading(false); setError('Supabase is not configured.'); return }
    let active = true
    void fetchAuditLogs()
      .then((data) => { if (active) setRows(data) })
      .catch((err: Error) => { if (active) setError(err.message) })
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  const columns = useMemo(() => [
    columnHelper.accessor('created_at', { header: 'When', cell: (info) => new Date(info.getValue()).toLocaleString() }),
    columnHelper.accessor('action', { header: 'Action' }),
    columnHelper.accessor('entity_type', { header: 'Entity' }),
    columnHelper.accessor('entity_id', { header: 'ID', cell: (info) => <small>{info.getValue()}</small> }),
    columnHelper.accessor('reason', { header: 'Reason' }),
    columnHelper.accessor('actor_name', {
      header: 'Actor',
      cell: (info) => <strong>{info.getValue() || 'Unknown'}</strong>
    })
  ], [])

  const table = useReactTable({
    data: rows,
    columns,
    state: { globalFilter: query },
    onGlobalFilterChange: setQuery,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel()
  })

  return <>
    <div className="admin-page-heading"><div><span>Governance</span><h1>Administrative audit log</h1><p>Append-only records of sensitive actions. Visible only with audit permission.</p></div></div>
    <section className="admin-panel data-panel">
      <div className="data-toolbar"><div className="search-field"><Search/><input type="search" placeholder="Filter audit entries" value={query} onChange={(e) => setQuery(e.target.value)}/></div></div>
      {loading ? <TableSkeleton columns={6} /> : error ? <div className="admin-locked admin-inline-msg"><FileClock/><div><strong>Permission required</strong><p>{error}</p></div></div> : (
        <div className="table-scroll"><table className="data-table"><thead>{table.getHeaderGroups().map((group) => (
          <tr key={group.id}>{group.headers.map((header) => <th key={header.id}>{flexRender(header.column.columnDef.header, header.getContext())}</th>)}</tr>
        ))}</thead>
          <tbody>
            {table.getRowModel().rows.length ? table.getRowModel().rows.map((row) => (
              <tr key={row.id}>{row.getVisibleCells().map((cell) => <td key={cell.id} data-label={typeof cell.column.columnDef.header === 'string' ? cell.column.columnDef.header : ''}>{flexRender(cell.column.columnDef.cell, cell.getContext())}</td>)}</tr>
            )) : <tr><td colSpan={columns.length}><div className="table-empty"><span className="empty-icon"><FileClock /></span><strong>{query ? 'No matching entries' : 'No audit entries yet'}</strong>{query ? 'Try a different filter.' : 'Sensitive admin actions will appear here.'}</div></td></tr>}
          </tbody>
        </table></div>
      )}
    </section>
  </>
}
