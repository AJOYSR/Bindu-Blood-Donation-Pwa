import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { supabase } from './supabase'
import { useAuth } from '../app/AuthContext'
import type { AppRole } from '../types'

const ADMIN_PERMISSIONS = new Set([
  'request.manage',
  'donor.review',
  'verification.review',
  'report.moderate',
  'analytics.view',
  'audit.view',
  'role.assign'
])

export function isAdminPermission(permission: string) {
  return ADMIN_PERMISSIONS.has(permission)
}

interface PermissionsState {
  permissions: string[]
  roles: AppRole[]
  loading: boolean
  can: (permission: string) => boolean
  canAccessAdmin: boolean
  isSuperAdmin: boolean
}

const PermissionsContext = createContext<PermissionsState | null>(null)

export function PermissionsProvider({ children }: { children: ReactNode }) {
  const { user, configured } = useAuth()
  const [permissions, setPermissions] = useState<string[]>([])
  const [roles, setRoles] = useState<AppRole[]>([])
  const [loading, setLoading] = useState(Boolean(user && configured))

  useEffect(() => {
    let active = true
    if (!user || !supabase) {
      setPermissions([])
      setRoles([])
      setLoading(false)
      return
    }
    setLoading(true)
    void Promise.all([
      supabase.rpc('my_permissions'),
      supabase.rpc('my_roles')
    ]).then(([perms, roleResult]) => {
      if (!active) return
      setPermissions((perms.data as string[] | null) ?? [])
      setRoles((roleResult.data as AppRole[] | null) ?? [])
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setPermissions([])
      setRoles([])
      setLoading(false)
    })
    return () => { active = false }
  }, [configured, user])

  const value = useMemo<PermissionsState>(() => {
    const isSuperAdmin = roles.includes('super_admin')
    return {
      permissions,
      roles,
      loading,
      isSuperAdmin,
      can: (permission: string) => isSuperAdmin || permissions.includes(permission),
      canAccessAdmin: isSuperAdmin || permissions.some(isAdminPermission)
    }
  }, [loading, permissions, roles])

  return createElement(PermissionsContext.Provider, { value }, children)
}

export function usePermissions() {
  const value = useContext(PermissionsContext)
  if (!value) throw new Error('usePermissions must be used inside PermissionsProvider')
  return value
}
