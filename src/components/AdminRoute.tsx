import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'
import { usePermissions } from '../lib/permissions'
import { LoadingScreen } from './LoadingScreen'
import { hasSupabaseConfig } from '../lib/supabase'

export function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user, loading: authLoading } = useAuth()
  const { canAccessAdmin, loading: permLoading } = usePermissions()
  const location = useLocation()

  if (authLoading || (user && permLoading)) return <LoadingScreen />

  // Demo mode without Supabase: allow viewing the admin shell UI.
  if (!hasSupabaseConfig) return children

  if (!user) return <Navigate to="/register" replace state={{ from: location.pathname }} />
  if (!canAccessAdmin) {
    return <Navigate to="/dashboard" replace />
  }
  return children
}
