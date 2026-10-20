import { useEffect, useRef, useState } from 'react'

declare global {
  interface Window {
    turnstile?: {
      render: (el: HTMLElement, options: Record<string, unknown>) => string
      reset: (id: string) => void
      remove: (id: string) => void
    }
  }
}

/**
 * Cloudflare Turnstile when VITE_TURNSTILE_SITE_KEY is set; otherwise a honeypot.
 * Pass the token (or empty string for honeypot mode) with auth form submissions.
 */
export function CaptchaField({ onToken }: { onToken: (token: string) => void }) {
  const siteKey = import.meta.env.VITE_TURNSTILE_SITE_KEY
  const containerRef = useRef<HTMLDivElement>(null)
  const [widgetId, setWidgetId] = useState<string | null>(null)
  const [honeypot, setHoneypot] = useState('')

  useEffect(() => {
    if (!siteKey || !containerRef.current) {
      onToken('')
      return
    }
    const scriptId = 'cf-turnstile'
    const existing = document.getElementById(scriptId)
    const mount = () => {
      if (!containerRef.current || !window.turnstile || widgetId) return
      const id = window.turnstile.render(containerRef.current, {
        sitekey: siteKey,
        callback: (token: string) => onToken(token),
        'error-callback': () => onToken(''),
        theme: 'light'
      })
      setWidgetId(id)
    }
    if (existing) {
      mount()
      return
    }
    const script = document.createElement('script')
    script.id = scriptId
    script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'
    script.async = true
    script.onload = mount
    document.head.appendChild(script)
    return () => {
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId)
    }
  }, [onToken, siteKey, widgetId])

  if (!siteKey) {
    return (
      <label className="honeypot-field" aria-hidden="true">
        Company
        <input tabIndex={-1} autoComplete="off" value={honeypot} onChange={(e) => {
          setHoneypot(e.target.value)
          onToken(e.target.value ? 'blocked' : '')
        }}/>
      </label>
    )
  }

  return <div className="captcha-field" ref={containerRef} />
}

export function isCaptchaBlocked(token: string) {
  return token === 'blocked'
}
