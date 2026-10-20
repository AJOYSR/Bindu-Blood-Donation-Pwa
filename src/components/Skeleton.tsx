import type { CSSProperties } from 'react'

export function Skeleton({ width, height = 14, radius, style, className = '' }: { width?: number | string; height?: number | string; radius?: number | string; style?: CSSProperties; className?: string }) {
  return <span className={`skeleton ${className}`} style={{ width, height, borderRadius: radius, ...style }} aria-hidden />
}

export function CardSkeleton() {
  return <div className="skeleton-card" aria-hidden>
    <div className="skeleton-row">
      <Skeleton width={54} height={54} radius={16} />
      <div className="skeleton-stack"><Skeleton width="40%" height={12} /><Skeleton width="75%" height={16} /><Skeleton width="55%" height={12} /></div>
    </div>
    <Skeleton height={12} width="90%" />
    <Skeleton height={36} radius={10} />
  </div>
}

export function CardGridSkeleton({ count = 3 }: { count?: number }) {
  return <div className="card-list cols-3" role="status" aria-busy="true">
    {Array.from({ length: count }, (_, index) => <CardSkeleton key={index} />)}
  </div>
}

export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return <div className="skeleton-table" role="status" aria-busy="true" aria-label="Loading">
    {Array.from({ length: rows }, (_, row) => <div key={row}>
      <Skeleton width={36} height={36} radius={10} />
      <div className="skeleton-stack" style={{ maxWidth: 220 }}><Skeleton width="80%" height={13} /><Skeleton width="50%" height={11} /></div>
      {Array.from({ length: Math.max(columns - 2, 1) }, (_, col) => <Skeleton key={col} width={`${12 + ((row + col) % 3) * 4}%`} height={12} style={{ flex: 'none' }} />)}
    </div>)}
  </div>
}

export function PageSkeleton() {
  return <div className="container page" role="status" aria-busy="true">
    <div className="page-header" style={{ display: 'grid', gap: 12 }}>
      <Skeleton width={120} height={12} />
      <Skeleton width="min(440px, 80%)" height={34} radius={10} />
      <Skeleton width="min(520px, 90%)" height={14} />
    </div>
    <CardGridSkeleton count={3} />
  </div>
}

export function Spinner({ large = false, label }: { large?: boolean; label?: string }) {
  return <span className={large ? 'spinner spinner-lg' : 'spinner'} role={label ? 'status' : undefined} aria-label={label} aria-hidden={label ? undefined : true} />
}
