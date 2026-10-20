import { useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../app/AuthContext'

const IDLE_MS = 15 * 60 * 1000

/** Automatically sign administrators out after inactivity. */
export function useAdminIdleLogout() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const timer = useRef<number | null>(null)

  useEffect(() => {
    if (!user) return

    const reset = () => {
      if (timer.current) window.clearTimeout(timer.current)
      timer.current = window.setTimeout(() => {
        void signOut().then(() => navigate('/register', { replace: true }))
      }, IDLE_MS)
    }

    const events: (keyof WindowEventMap)[] = ['mousemove', 'keydown', 'click', 'scroll', 'touchstart']
    events.forEach((event) => window.addEventListener(event, reset, { passive: true }))
    reset()

    return () => {
      if (timer.current) window.clearTimeout(timer.current)
      events.forEach((event) => window.removeEventListener(event, reset))
    }
  }, [navigate, signOut, user])
}
