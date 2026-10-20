import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { donors as initialDonors, notifications as initialNotifications, requests as initialRequests } from '../lib/mock-data'
import type { BloodRequest, Donor, NotificationItem } from '../types'
import { createBloodRequest, createResponse, fetchDonors, fetchNotifications, fetchRequests, persistAvailability, persistNotificationsRead } from '../lib/api'
import { flushAvailabilityQueue } from '../lib/offline-queue'
import { useAuth } from './AuthContext'
import { useI18n } from '../i18n'

interface Toast { id: number; title: string; message?: string; tone?: 'default' | 'success' | 'danger' }
interface AppState {
  donors: Donor[]
  requests: BloodRequest[]
  notifications: NotificationItem[]
  toasts: Toast[]
  demoAdmin: boolean
  setDemoAdmin: (value: boolean) => void
  addRequest: (request: BloodRequest) => Promise<BloodRequest>
  updateRequest: (id: string, patch: Partial<BloodRequest>) => void
  respondToRequest: (id: string) => Promise<void>
  setDonorAvailability: (available: boolean) => Promise<void>
  markNotificationsRead: () => void
  notify: (title: string, message?: string, tone?: Toast['tone']) => void
  dismissToast: (id: number) => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const { t } = useI18n()
  const [donors, setDonors] = useState(initialDonors)
  const [requests, setRequests] = useState(initialRequests)
  const [notifications, setNotifications] = useState(initialNotifications)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [demoAdmin, setDemoAdmin] = useState(false)

  useEffect(() => { void Promise.all([fetchRequests(), fetchDonors(), fetchNotifications()]).then(([remoteRequests, remoteDonors, remoteNotifications]) => { if (remoteRequests) setRequests(remoteRequests); if (remoteDonors) setDonors(remoteDonors); if (remoteNotifications) setNotifications(remoteNotifications) }) }, [user])

  useEffect(() => {
    const onOnline = () => { void flushAvailabilityQueue(persistAvailability).catch(() => undefined) }
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [])

  const notify = (title: string, message?: string, tone: Toast['tone'] = 'default') => {
    const id = Date.now()
    setToasts((current) => [...current, { id, title, message, tone }])
    window.setTimeout(() => setToasts((current) => current.filter((toast) => toast.id !== id)), 4200)
  }

  const value = useMemo<AppState>(() => ({
    donors,
    requests,
    notifications,
    toasts,
    demoAdmin,
    setDemoAdmin,
    addRequest: async (request) => {
      const saved = await createBloodRequest(request)
      if (!saved) throw new Error(t('form.signInRequired'))
      setRequests((current) => [saved, ...current])
      return saved
    },
    updateRequest: (id, patch) => setRequests((current) => current.map((request) => request.id === id ? { ...request, ...patch } : request)),
    respondToRequest: async (id) => {
      const request = requests.find((item) => item.id === id)
      if (!request) return
      const sent = await createResponse(request)
      if (!sent) { notify(t('toast.signInRequired'), t('toast.signInRequiredMsg'), 'danger'); return }
      setRequests((current) => current.map((item) => item.id === id ? { ...item, responses: item.responses + 1 } : item))
      notify(t('toast.responseSent'), t('toast.responseSentMsg'), 'success')
    },
    setDonorAvailability: async (available) => {
      try {
        await persistAvailability(available)
        if (user) setDonors((current) => current.map((donor) => donor.id === user.id ? { ...donor, available } : donor))
        notify(
          available ? t('toast.availableOn') : t('toast.availableOff'),
          available ? t('toast.availableOnMsg') : t('toast.availableOffMsg'),
          'success'
        )
      } catch (error) {
        notify(t('toast.availabilityFail'), error instanceof Error ? error.message : t('common.pleaseTryAgain'), 'danger')
        throw error
      }
    },
    markNotificationsRead: () => {
      setNotifications((current) => current.map((item) => ({ ...item, read: true })))
      void persistNotificationsRead().catch(() => notify(t('toast.notificationsFail'), t('common.pleaseTryAgain'), 'danger'))
    },
    notify,
    dismissToast: (id) => setToasts((current) => current.filter((toast) => toast.id !== id))
  }), [demoAdmin, donors, notifications, requests, t, toasts, user])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const value = useContext(AppContext)
  if (!value) throw new Error('useApp must be used within AppProvider')
  return value
}
