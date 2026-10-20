import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { identifyUser, track } from '../lib/analytics'
import { setMonitoringUser } from '../lib/monitoring'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  signOut: () => Promise<void>
}

const AuthContext=createContext<AuthState|null>(null)

function syncTelemetry(userId: string | null) {
  identifyUser(userId)
  setMonitoringUser(userId)
}

export function AuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(hasSupabaseConfig)

  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    let active=true
    void supabase.auth.getSession().then(({data})=>{
      if(!active) return
      setSession(data.session)
      syncTelemetry(data.session?.user?.id ?? null)
      setLoading(false)
    })
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{
      setSession(nextSession)
      syncTelemetry(nextSession?.user?.id ?? null)
      setLoading(false)
    })
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  const value=useMemo<AuthState>(()=>({
    user:session?.user??null,
    session,
    loading,
    configured:hasSupabaseConfig,
    signOut:async()=>{
      if(supabase) await supabase.auth.signOut()
      track('sign_out')
      syncTelemetry(null)
    }
  }),[loading,session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
