import type { Session, User } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { hasSupabaseConfig, supabase } from '../lib/supabase'

interface AuthState {
  user: User | null
  session: Session | null
  loading: boolean
  configured: boolean
  signOut: () => Promise<void>
}

const AuthContext=createContext<AuthState|null>(null)

export function AuthProvider({children}:{children:ReactNode}){
  const [session,setSession]=useState<Session|null>(null)
  const [loading,setLoading]=useState(hasSupabaseConfig)

  useEffect(()=>{
    if(!supabase){setLoading(false);return}
    let active=true
    void supabase.auth.getSession().then(({data})=>{if(active){setSession(data.session);setLoading(false)}})
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,nextSession)=>{setSession(nextSession);setLoading(false)})
    return()=>{active=false;subscription.unsubscribe()}
  },[])

  const value=useMemo<AuthState>(()=>({user:session?.user??null,session,loading,configured:hasSupabaseConfig,signOut:async()=>{if(supabase)await supabase.auth.signOut()}}),[loading,session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(){const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used inside AuthProvider');return value}
