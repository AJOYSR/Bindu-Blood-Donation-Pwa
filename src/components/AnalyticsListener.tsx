import { useEffect, useRef } from 'react'
import { useLocation } from 'react-router-dom'
import { track, trackPageView } from '../lib/analytics'
import { usePermissions } from '../lib/permissions'

/** Fires privacy-safe page views and a single admin-entry event. */
export function AnalyticsListener() {
  const location = useLocation()
  const { isSuperAdmin } = usePermissions()
  const lastPath = useRef('')
  const wasOnAdmin = useRef(false)

  useEffect(() => {
    if (location.pathname === lastPath.current) return
    lastPath.current = location.pathname
    trackPageView(location.pathname)

    const onAdmin = location.pathname.startsWith('/admin')
    if (isSuperAdmin && onAdmin && !wasOnAdmin.current) track('admin_panel_opened')
    wasOnAdmin.current = onAdmin
  }, [isSuperAdmin, location.pathname])

  return null
}
