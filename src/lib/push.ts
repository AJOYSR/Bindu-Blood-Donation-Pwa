import { supabase } from './supabase'
import { track } from './analytics'

async function sha256(value: string) {
  const data = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

/** Register a Web Push subscription. Requires VITE_VAPID_PUBLIC_KEY. */
export async function registerPushSubscription() {
  if (!supabase || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('Push notifications are not supported in this browser.')
  }
  const vapid = import.meta.env.VITE_VAPID_PUBLIC_KEY
  if (!vapid) throw new Error('VITE_VAPID_PUBLIC_KEY is not configured.')

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') throw new Error('Notification permission was not granted.')
  track('notification_permission_granted')

  const registration = await navigator.serviceWorker.ready
  const subscription = await registration.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(vapid)
  })
  const json = subscription.toJSON()
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Incomplete push subscription.')

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Please sign in first.')

  const { error } = await supabase.from('push_subscriptions').upsert({
    user_id: user.id,
    endpoint: json.endpoint,
    endpoint_hash: await sha256(json.endpoint),
    p256dh: json.keys.p256dh,
    auth_key: json.keys.auth,
    last_used_at: new Date().toISOString(),
    failed_count: 0
  }, { onConflict: 'endpoint_hash' })
  if (error) throw error
  return true
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const output = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) output[i] = raw.charCodeAt(i)
  return output
}
