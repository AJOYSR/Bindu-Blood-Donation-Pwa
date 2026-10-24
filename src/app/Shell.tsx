import { ArrowRight, Bell, ChevronRight, Droplet, HeartHandshake, Home, Info, Menu, Phone, Plus, ShieldCheck, UserRound, X } from 'lucide-react'
import { Suspense, useEffect, useState } from 'react'
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from './AppContext'
import { Brand } from '../components/Brand'
import { LanguageSwitcher } from '../components/LanguageSwitcher'
import { RouteProgress } from '../components/RouteProgress'
import { PageSkeleton } from '../components/Skeleton'
import { useAuth } from './AuthContext'
import { usePermissions } from '../lib/permissions'
import { useT } from '../i18n'

function initialsFor(name: string) {
  return name.split(/[\s._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join('') || 'B'
}

function useScrolled(threshold = 8) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > threshold)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [threshold])
  return scrolled
}

export function Shell() {
  const { notifications } = useApp()
  const { user } = useAuth()
  const { isSuperAdmin } = usePermissions()
  const t = useT()
  const location = useLocation()
  const path = location.pathname
  const unread = notifications.filter((item) => !item.read).length
  const scrolled = useScrolled()
  const [menuOpen, setMenuOpen] = useState(false)

  useEffect(() => { window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior }); setMenuOpen(false) }, [path])

  if (path.startsWith('/admin')) return <><RouteProgress /><Outlet /></>

  const displayName = String(user?.user_metadata?.display_name || user?.email?.split('@')[0] || '')
  const isRequestsTab = path === '/requests' || (path.startsWith('/requests/') && path !== '/requests/new')
  const isAccountTab = ['/dashboard', '/profile', '/register'].includes(path)
  const tabClass = (active: boolean) => active ? 'tab is-active' : 'tab'
  const isHome = path === '/'

  return <div className="site-shell">
    <RouteProgress />
    <a href="#main" className="skip-link">{t('shell.skip')}</a>

    <header className={['topbar', scrolled ? 'is-scrolled' : '', isHome && !scrolled ? 'is-home' : ''].filter(Boolean).join(' ')}>
      <div className="container topbar-inner">
        <Brand />
        <nav className="topnav" aria-label={t('shell.nav.main')}>
          <NavLink to="/" end>{t('shell.nav.home')}</NavLink>
          <NavLink to="/requests" end>{t('shell.nav.requests')}</NavLink>
          <NavLink to="/contacts">{t('shell.nav.contacts')}</NavLink>
          <NavLink to="/about">{t('shell.nav.about')}</NavLink>
          {isSuperAdmin && <NavLink to="/admin">{t('shell.nav.admin')}</NavLink>}
        </nav>
        <div className="topbar-actions">
          <LanguageSwitcher compact />
          {user && <Link to="/dashboard#notifications" className="icon-button" aria-label={t('shell.nav.unread', { count: unread })}>
            <Bell />{unread > 0 && <span className="notif-count">{unread > 9 ? '9+' : unread}</span>}
          </Link>}
          {user
            ? <Link to="/dashboard" className="avatar-button hide-mobile" aria-label={t('shell.nav.dashboard')}>{initialsFor(displayName)}</Link>
            : <Link to="/register" className="button button-ghost button-sm hide-mobile">{t('shell.nav.signIn')}</Link>}
          <Link to="/requests/new" className="button button-primary button-sm topbar-cta"><Plus />{t('shell.nav.requestBlood')}</Link>
          <button type="button" className="icon-button menu-button" aria-label={t('shell.menu.open')} aria-expanded={menuOpen} onClick={() => setMenuOpen(true)}><Menu /></button>
        </div>
      </div>
    </header>

    <MobileMenu open={menuOpen} onClose={() => setMenuOpen(false)} displayName={displayName} isSuperAdmin={isSuperAdmin} />

    <main id="main" className="site-main">
      <div className="page-transition" key={path}>
        <Suspense fallback={<PageSkeleton />}><Outlet /></Suspense>
      </div>
    </main>

    <footer className="site-footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Brand tone="light" />
            <p>{t('shell.footer.tagline')}</p>
            <LanguageSwitcher full tone="dark" />
          </div>
          <div className="footer-col">
            <h4>{t('shell.footer.explore')}</h4>
            <Link to="/find-donors">{t('shell.footer.findDonors')}</Link>
            <Link to="/requests">{t('shell.footer.requests')}</Link>
            <Link to="/requests/new">{t('shell.footer.requestBlood')}</Link>
          </div>
          <div className="footer-col">
            <h4>{t('shell.footer.accountHead')}</h4>
            {user
              ? <><Link to="/dashboard">{t('shell.footer.account')}</Link><Link to="/profile">{t('shell.footer.profile')}</Link></>
              : <><Link to="/register">{t('shell.footer.signIn')}</Link><Link to="/register">{t('shell.footer.join')}</Link></>}
          </div>
          <div className="footer-col">
            <h4>{t('shell.footer.learn')}</h4>
            <Link to="/about">{t('shell.footer.howItWorks')}</Link>
            <Link to="/contacts">{t('shell.nav.contacts')}</Link>
          </div>
          <a className="footer-emergency" href="tel:999">
            <span className="footer-emergency-icon"><Phone /></span>
            <span>
              <strong>{t('shell.footer.emergencyTitle')}</strong>
              <small>{t('shell.footer.emergency')}</small>
            </span>
            <span className="footer-emergency-call">{t('shell.footer.emergencyCall')}</span>
          </a>
        </div>
        <div className="footer-bottom">
          <span>{t('shell.footer.copyright')}</span>
          <span className="footer-bottom-meta"><ShieldCheck />{t('shell.footer.meta')}</span>
          <span>{t('shell.footer.madeIn')}</span>
        </div>
      </div>
    </footer>

    <nav className="tabbar" aria-label={t('shell.tab.primary')}>
      <div className="tabbar-inner">
        <Link to="/" className={tabClass(path === '/')}><Home />{t('shell.tab.home')}</Link>
        <Link to="/requests" className={tabClass(isRequestsTab)}><Droplet />{t('shell.nav.requests')}</Link>
        <Link to="/contacts" className={tabClass(path === '/contacts')}><Phone />{t('shell.nav.contacts')}</Link>
        <Link to="/about" className={tabClass(path === '/about')}><Info />{t('shell.nav.about')}</Link>
        <Link to={user ? '/dashboard' : '/register'} className={tabClass(isAccountTab)}><UserRound />{user ? t('shell.tab.account') : t('shell.tab.signIn')}</Link>
      </div>
    </nav>
  </div>
}

function MobileMenu({ open, onClose, displayName, isSuperAdmin }: { open: boolean; onClose: () => void; displayName: string; isSuperAdmin: boolean }) {
  const { user } = useAuth()
  const t = useT()
  const [mounted, setMounted] = useState(open)

  useEffect(() => {
    if (open) { setMounted(true); return }
    const timer = window.setTimeout(() => setMounted(false), 260)
    return () => window.clearTimeout(timer)
  }, [open])

  useEffect(() => {
    if (!open) return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', onKey) }
  }, [open, onClose])

  if (!mounted) return null

  const links = [
    { to: '/', icon: Home, label: t('shell.nav.home'), desc: t('shell.menu.homeDesc'), end: true },
    { to: '/requests', icon: Droplet, label: t('shell.nav.requests'), desc: t('shell.menu.requestsDesc'), end: true },
    { to: '/contacts', icon: Phone, label: t('shell.nav.contacts'), desc: t('shell.menu.contactsDesc') },
    { to: '/about', icon: Info, label: t('shell.nav.about'), desc: t('shell.menu.aboutDesc') },
    ...(isSuperAdmin ? [{ to: '/admin', icon: ShieldCheck, label: t('shell.nav.admin'), desc: t('shell.menu.adminDesc') }] : [])
  ]

  return <div className={open ? 'menu-layer is-open' : 'menu-layer'} role="dialog" aria-modal="true" aria-label={t('shell.menu.title')}>
    <button type="button" className="menu-scrim" aria-label={t('shell.menu.close')} onClick={onClose} tabIndex={-1} />
    <div className="menu-sheet">
      <div className="menu-head">
        <Brand />
        <button type="button" className="icon-button" aria-label={t('shell.menu.close')} onClick={onClose} autoFocus><X /></button>
      </div>

      {user
        ? <Link to="/dashboard" className="menu-user">
            <span className="avatar-button">{initialsFor(displayName)}</span>
            <span><strong>{displayName}</strong><small>{t('shell.nav.dashboard')}</small></span>
            <ChevronRight />
          </Link>
        : <div className="menu-auth">
            <p>{t('shell.menu.signInHint')}</p>
            <div>
              <Link to="/register" className="button button-secondary">{t('shell.nav.signIn')}</Link>
              <Link to="/register" className="button button-dark"><HeartHandshake />{t('shell.menu.createAccount')}</Link>
            </div>
          </div>}

      <nav className="menu-links" aria-label={t('shell.nav.main')}>
        {links.map(({ to, icon: Icon, label, desc, end }) => <NavLink key={to} to={to} end={end}>
          <span className="menu-link-icon"><Icon /></span>
          <span><strong>{label}</strong><small>{desc}</small></span>
          <ChevronRight />
        </NavLink>)}
      </nav>

      <Link to="/requests/new" className="button button-primary button-lg button-full"><Plus />{t('shell.nav.requestBlood')}<ArrowRight /></Link>

      <div className="menu-lang">
        <span>{t('shell.menu.language')}</span>
        <LanguageSwitcher full />
      </div>

      <a className="menu-emergency" href="tel:999"><Phone /><span><strong>{t('shell.footer.emergencyTitle')}</strong> {t('shell.footer.emergencyCall')}</span></a>
    </div>
  </div>
}
