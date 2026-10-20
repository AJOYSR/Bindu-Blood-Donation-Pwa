import type { LucideIcon } from 'lucide-react'

export function MetricCard({ label, value, note, icon: Icon, tone = 'red', loading = false }: { label: string; value: string | number; note: string; icon: LucideIcon; tone?: 'red' | 'green' | 'amber' | 'blue'; loading?: boolean }) {
  return <article className={`metric-card metric-tone-${tone}`}>
    <div className="metric-top">
      <p>{label}</p>
      <div className={`metric-icon metric-${tone}`}><Icon size={18} /></div>
    </div>
    <div className="metric-body">
      {loading ? <span className="skeleton" style={{ width: 64, height: 30, borderRadius: 8 }} /> : <strong>{value}</strong>}
      <span>{note}</span>
    </div>
  </article>
}
