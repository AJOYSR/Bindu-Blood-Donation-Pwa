import { useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'

/** Thin top bar that gives instant feedback on every navigation. */
export function RouteProgress() {
  const { pathname } = useLocation()
  const [phase, setPhase] = useState<'idle' | 'active' | 'done'>('idle')
  const first = useRef(true)

  useEffect(() => {
    if (first.current) { first.current = false; return }
    setPhase('active')
    const done = window.setTimeout(() => setPhase('done'), 420)
    const idle = window.setTimeout(() => setPhase('idle'), 900)
    return () => { window.clearTimeout(done); window.clearTimeout(idle) }
  }, [pathname])

  return <div className={`route-progress ${phase === 'active' ? 'is-active' : phase === 'done' ? 'is-done' : ''}`} aria-hidden />
}
