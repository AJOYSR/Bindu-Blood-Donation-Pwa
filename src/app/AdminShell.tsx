import { ArrowUpRight, BarChart3, ChevronRight, ClipboardCheck, Droplet, FileClock, Gauge, LockKeyhole, LogOut, Menu, ShieldAlert, ShieldCheck, TimerReset, UsersRound, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { AdminRoute } from '../components/AdminRoute'
import { Skeleton, TableSkeleton } from '../components/Skeleton'
import { useAdminIdleLogout } from '../hooks/useAdminIdleLogout'
import { useApp } from './AppContext'
import { useAuth } from './AuthContext'
import { AdminMfaProvider, useAdminMfa } from './AdminMfaContext'
import { hasSupabaseConfig } from '../lib/supabase'
import { usePermissions } from '../lib/permissions'

const groups = [
  {
    label: 'Operations',
    items: [
      { to: '/admin', label: 'Overview', icon: Gauge, end: true, permission: 'analytics.view' },
      { to: '/admin/requests', label: 'Requests', icon: Droplet, permission: 'request.manage', badge: 'requests' as const },
      { to: '/admin/donors', label: 'Donors', icon: UsersRound, permission: 'donor.review' }
    ]
  },
  {
    label: 'Trust & safety',
    items: [
      { to: '/admin/reports', label: 'Moderation', icon: ShieldAlert, permission: 'report.moderate' },
      { to: '/admin/verification', label: 'Verification', icon: ClipboardCheck, permission: 'verification.review' }
    ]
  },
  {
    label: 'Insights',
    items: [
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'analytics.view' },
      { to: '/admin/audit-log', label: 'Audit log', icon: FileClock, permission: 'audit.view' }
    ]
  }
]
const allItems = groups.flatMap((group) => group.items)

function AdminPageSkeleton() {
  return <div role="status" aria-busy="true">
    <div className="admin-page-heading"><div style={{ display: 'grid', gap: 10 }}><Skeleton width={110} height={11} /><Skeleton width={260} height={28} radius={8} /><Skeleton width={340} height={13} /></div></div>
    <section className="admin-panel data-panel"><TableSkeleton rows={6} columns={5} /></section>
  </div>
}

function AdminShellInner() {
  const [open, setOpen] = useState(false)
  const { user, signOut } = useAuth()
  const { requests } = useApp()
  const { can, roles, permissions, isSuperAdmin } = usePermissions()
  const location = useLocation()
  const { verified, ensureVerified } = useAdminMfa()
  useAdminIdleLogout()

  useEffect(() => { setOpen(false) }, [location.pathname])

  useEffect(() => {
    if (!open) return
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') setOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  const displayName = String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Admin')
  const initials = displayName.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'AD'
  const roleLabel = roles.find((role) => role !== 'member' && role !== 'verified_donor')?.replaceAll('_', ' ') || 'Administrator'
  const visible = (permission: string) => can(permission) || permissions.length === 0
  const current = allItems.find((item) => item.end ? location.pathname === item.to : location.pathname.startsWith(item.to))
  const openRequests = requests.filter((request) => request.status === 'open').length

  return <div className="admin-shell">
    <button className={open ? 'admin-scrim is-open' : 'admin-scrim'} aria-label="Close menu" tabIndex={open ? 0 : -1} onClick={() => setOpen(false)} />
    <aside className={open ? 'admin-sidebar is-open' : 'admin-sidebar'} aria-label="Admin navigation">
      <div className="admin-brand">
        <Brand />
        <span className="admin-badge">Ops</span>
        <button className="icon-button admin-close" aria-label="Close menu" onClick={() => setOpen(false)}><X /></button>
      </div>

      <nav className="admin-nav">
        {groups.map((group) => {
          const items = group.items.filter((item) => visible(item.permission))
          if (!items.length) return null
          return <div className="admin-nav-group" key={group.label}>
            <p className="admin-nav-label">{group.label}</p>
            {items.map(({ to, label, icon: Icon, end, ...rest }) => (
              <NavLink to={to} end={end} key={to}>
                <Icon size={18} /><span>{label}</span>
                {'badge' in rest && openRequests > 0 && <em className="admin-nav-count">{openRequests}</em>}
              </NavLink>
            ))}
          </div>
        })}
      </nav>

      <div className="admin-sidebar-bottom">
        <div className="system-health">
          <span><TimerReset size={14} />Idle logout armed</span>
          <small>Signs out after 15 minutes of inactivity</small>
        </div>
        <div className="admin-account">
          <div className="admin-avatar">{initials}</div>
          <div className="admin-user"><strong>{displayName}</strong><span>{roleLabel}</span></div>
          <button className="icon-button" type="button" aria-label="Sign out" title="Sign out" onClick={() => void signOut()}><LogOut /></button>
        </div>
        <Link to="/" className="admin-back"><ArrowUpRight size={16} />Back to public site</Link>
      </div>
    </aside>

    <div className="admin-main">
      <header className="admin-header">
        <button className="icon-button admin-menu" aria-label="Open menu" onClick={() => setOpen(true)}><Menu /></button>
        <div className="admin-header-title">
          <span className="admin-crumb hide-mobile">Admin</span>
          <ChevronRight className="hide-mobile" />
          <strong>{current?.label ?? 'Admin'}</strong>
        </div>
        <div className={hasSupabaseConfig ? 'environment' : 'environment is-demo'}><span />{hasSupabaseConfig ? 'Live' : 'Demo data'}</div>
        <div className="admin-header-actions">
          {hasSupabaseConfig && !isSuperAdmin && (verified
            ? <span className="mfa-status is-verified"><ShieldCheck />Verified</span>
            : <button type="button" className="mfa-status is-pending" onClick={() => void ensureVerified()}><LockKeyhole />Verify</button>)}
          <div className="admin-avatar admin-avatar-header">{initials}</div>
        </div>
      </header>
      <main className="admin-content">
        {hasSupabaseConfig && !isSuperAdmin && !verified && <div className="mfa-banner">
          <div className="notice notice-warn">
            <LockKeyhole />
            <p><strong>Two-step verification needed for changes</strong>You can view everything, but changing requests, donors, reports or verifications needs a code from your authenticator app.</p>
          </div>
          <button type="button" className="button button-primary" onClick={() => void ensureVerified()}><ShieldCheck />Verify now</button>
        </div>}
        <div className="page-transition" key={location.pathname}>
          <Suspense fallback={<AdminPageSkeleton />}><Outlet /></Suspense>
        </div>
      </main>
    </div>
  </div>
}

export function AdminShell() {
  return <AdminRoute><AdminMfaProvider><AdminShellInner /></AdminMfaProvider></AdminRoute>
}
