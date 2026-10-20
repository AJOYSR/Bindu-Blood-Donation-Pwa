const key = import.meta.env.VITE_POSTHOG_KEY
const host = (import.meta.env.VITE_POSTHOG_HOST || 'https://us.i.posthog.com').replace(/\/$/, '')
const DISTINCT_KEY = 'bindu.analytics.distinct_id'

/** Privacy-safe product events only. Property names with PII cues are stripped at send time. */
const allowedEvents = new Set([
  'app_opened',
  'page_viewed',
  'signup_started',
  'signup_completed',
  'sign_in_completed',
  'sign_out',
  'donor_profile_completed',
  'donor_search_performed',
  'request_created',
  'request_response_started',
  'request_response_completed',
  'availability_changed',
  'notification_permission_granted',
  'pwa_installed',
  'language_changed',
  'data_exported',
  'account_deletion_requested',
  'verification_upload_started',
  'verification_upload_completed',
  'admin_panel_opened'
])

const blockedPropertyName = /(name|phone|email|address|location|blood|hospital|note|description|password|token)/i

type AnalyticsProps = Record<string, string | number | boolean>

function createDistinctId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return `anon:${crypto.randomUUID()}`
  return `anon:${Date.now().toString(36)}.${Math.random().toString(36).slice(2, 10)}`
}

function getDistinctId() {
  try {
    const existing = localStorage.getItem(DISTINCT_KEY)
    if (existing) return existing
    const next = createDistinctId()
    localStorage.setItem(DISTINCT_KEY, next)
    return next
  } catch {
    return createDistinctId()
  }
}

let distinctId = typeof window !== 'undefined' ? getDistinctId() : 'anon:ssr'
let identifiedUserId: string | null = null

function sanitizeProperties(properties: AnalyticsProps) {
  return Object.fromEntries(
    Object.entries(properties).filter(([name]) => !blockedPropertyName.test(name))
  )
}

export function isAnalyticsEnabled() {
  return Boolean(key)
}

export function track(event: string, properties: AnalyticsProps = {}) {
  if (!key || !allowedEvents.has(event)) return

  const payload = {
    api_key: key,
    event,
    distinct_id: identifiedUserId ?? distinctId,
    timestamp: new Date().toISOString(),
    properties: {
      ...sanitizeProperties(properties),
      $lib: 'bindu-web',
      $lib_version: '1.0.0',
      environment: import.meta.env.MODE,
      $process_person_profile: false
    }
  }

  void fetch(`${host}/i/v0/e/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
    mode: 'cors',
    credentials: 'omit'
  }).catch(() => {
    /* analytics must never break the app */
  })
}

export function trackPageView(path: string) {
  const safePath = path.split('?')[0]?.split('#')[0] || '/'
  // Avoid leaking donor/request UUIDs into analytics paths
  const normalized = safePath
    .replace(/\/donors\/[^/]+/i, '/donors/:id')
    .replace(/\/requests\/(?!new(?:\/|$))[^/]+/i, '/requests/:id')
  track('page_viewed', { path: normalized })
}

/** Prefer opaque auth user ids. Never pass email or phone. */
export function identifyUser(userId: string | null) {
  if (!key) return
  if (userId) {
    identifiedUserId = `user:${userId}`
    try { localStorage.setItem(DISTINCT_KEY, identifiedUserId) } catch { /* ignore */ }
    distinctId = identifiedUserId
  } else {
    identifiedUserId = null
    try {
      const fresh = createDistinctId()
      localStorage.setItem(DISTINCT_KEY, fresh)
      distinctId = fresh
    } catch {
      distinctId = createDistinctId()
    }
  }
}

export function initAnalytics() {
  if (!key || typeof window === 'undefined') return
  track('app_opened', { path: window.location.pathname })
}
