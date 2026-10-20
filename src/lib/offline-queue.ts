const KEY = 'bindu.offline.availability'

export interface QueuedAvailability {
  available: boolean
  queuedAt: string
}

export function queueAvailabilityUpdate(available: boolean) {
  const payload: QueuedAvailability = { available, queuedAt: new Date().toISOString() }
  localStorage.setItem(KEY, JSON.stringify(payload))
  return payload
}

export function peekAvailabilityQueue(): QueuedAvailability | null {
  const raw = localStorage.getItem(KEY)
  if (!raw) return null
  try { return JSON.parse(raw) as QueuedAvailability } catch { return null }
}

export function clearAvailabilityQueue() {
  localStorage.removeItem(KEY)
}

export async function flushAvailabilityQueue(persist: (available: boolean) => Promise<void>) {
  const queued = peekAvailabilityQueue()
  if (!queued || !navigator.onLine) return false
  await persist(queued.available)
  clearAvailabilityQueue()
  return true
}
