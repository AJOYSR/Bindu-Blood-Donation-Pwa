import type * as SentryNamespace from '@sentry/react'

type SentryModule = typeof SentryNamespace

let sentry: SentryModule | null = null
let initPromise: Promise<void> | null = null

const PII_PATTERN = /(email|phone|password|token|authorization|cookie|address|contact|note|description|name)/i

function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[redacted-email]')
      .replace(/\+?\d[\d\s()-]{7,}\d/g, '[redacted-phone]')
  }
  if (Array.isArray(value)) return value.map(scrubValue)
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
        key,
        PII_PATTERN.test(key) ? '[redacted]' : scrubValue(entry)
      ])
    )
  }
  return value
}

export function isMonitoringEnabled() {
  return Boolean(import.meta.env.VITE_SENTRY_DSN)
}

export async function initMonitoring() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || initPromise) return initPromise ?? Promise.resolve()

  initPromise = (async () => {
    const Sentry = await import('@sentry/react')
    sentry = Sentry
    Sentry.init({
      dsn,
      environment: import.meta.env.MODE,
      release: `bindu-web@${import.meta.env.VITE_APP_VERSION ?? '1.0.0'}`,
      tracesSampleRate: import.meta.env.PROD ? 0.08 : 0,
      replaysSessionSampleRate: 0,
      replaysOnErrorSampleRate: 0,
      ignoreErrors: [
        'ResizeObserver loop',
        'Non-Error promise rejection captured',
        /Loading chunk [\d]+ failed/i,
        /Failed to fetch dynamically imported module/i
      ],
      beforeSend(event) {
        if (event.message) event.message = String(scrubValue(event.message))
        if (event.exception?.values) {
          event.exception.values = event.exception.values.map((item) => ({
            ...item,
            value: item.value ? String(scrubValue(item.value)) : item.value
          }))
        }
        if (event.request) {
          event.request = scrubValue(event.request) as typeof event.request
          if (event.request?.headers) {
            delete event.request.headers.Authorization
            delete event.request.headers.cookie
          }
        }
        if (event.user) {
          event.user = { id: event.user.id }
        }
        return event
      }
    })

    window.addEventListener('unhandledrejection', (event) => {
      reportError(event.reason, { source: 'unhandledrejection' })
    })
  })()

  return initPromise
}

export function reportError(error: unknown, context: Record<string, string> = {}) {
  const err = error instanceof Error ? error : new Error(typeof error === 'string' ? error : 'Unknown error')
  if (!import.meta.env.VITE_SENTRY_DSN) {
    if (import.meta.env.DEV) console.error('[monitoring]', err, context)
    return
  }

  const send = () => {
    if (!sentry) return
    sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        if (!PII_PATTERN.test(key)) scope.setTag(key, value.slice(0, 120))
      })
      scope.setLevel('error')
      sentry!.captureException(err)
    })
  }

  if (sentry) send()
  else void initMonitoring().then(send)
}

export function reportMessage(message: string, level: 'info' | 'warning' | 'error' = 'warning', context: Record<string, string> = {}) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  const send = () => {
    if (!sentry) return
    sentry.withScope((scope) => {
      Object.entries(context).forEach(([key, value]) => {
        if (!PII_PATTERN.test(key)) scope.setTag(key, value.slice(0, 120))
      })
      sentry!.captureMessage(String(scrubValue(message)), level)
    })
  }
  if (sentry) send()
  else void initMonitoring().then(send)
}

/** Attach a non-PII user id for Sentry. Never pass email or phone. */
export function setMonitoringUser(userId: string | null) {
  if (!sentry) return
  if (userId) sentry.setUser({ id: userId })
  else sentry.setUser(null)
}

export function getSentry() {
  return sentry
}
