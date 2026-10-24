export type BloodGroup = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-'
export type Urgency = 'critical' | 'urgent' | 'standard'
export type RequestStatus = 'open' | 'matched' | 'fulfilled' | 'expired' | 'cancelled' | 'fraudulent'
export type AppRole = 'member' | 'verified_donor' | 'support' | 'moderator' | 'operations_admin' | 'analyst' | 'super_admin'

export interface Donor {
  avatarUrl?: string | null
  backendId?: string
  id: string
  displayName: string
  bloodGroup: BloodGroup
  district: string
  area: string
  distanceKm: number
  verified: boolean
  available: boolean
  lastDonation: string | null
  responseRate: number
  donations: number
  maskedPhone?: string | null
}

export interface BloodRequest {
  backendId?: string
  id: string
  patientName: string
  bloodGroup: BloodGroup
  units: number
  hospital: string
  district: string
  area: string
  urgency: Urgency
  status: RequestStatus
  neededBy: string
  createdAt: string
  responses: number
  contactUnlocked?: boolean
  note: string
}

export interface NotificationItem {
  id: string
  title: string
  message: string
  time: string
  read: boolean
  tone: 'info' | 'success' | 'warning'
}
