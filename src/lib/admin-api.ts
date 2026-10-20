import { supabase } from './supabase'
import type { BloodGroup, RequestStatus } from '../types'

export interface AdminOverview {
  active_donors: number
  available_today: number
  open_requests: number
  critical_requests: number
  expiring_soon: number
  fulfilled_today: number
  pending_verification: number
  unresolved_reports: number
  notification_failures: number
  delivery_failures: number
  weekly: { day: string; created: number; fulfilled: number }[]
  supply_gap: { district: string; blood_group: BloodGroup; available_donors: number; open_requests: number; supply_ratio: number | null; level: 'ok' | 'low' | 'critical' }[]
  alerts: { id: string; alert_type: string; severity: string; message: string; created_at: string }[]
  latest_metric: Record<string, unknown> | null
}

export interface UsageQuota {
  profiles: number
  donor_profiles: number
  blood_requests: number
  notifications: number
  push_subscriptions: number
  audit_logs: number
  storage_warning_threshold: number
  notes: string
}

export async function fetchAdminOverview(): Promise<AdminOverview | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('admin_overview_metrics')
  if (error) throw error
  return data as AdminOverview
}

export async function fetchUsageQuota(): Promise<UsageQuota | null> {
  if (!supabase) return null
  const { data, error } = await supabase.rpc('usage_quota_snapshot')
  if (error) throw error
  return data as UsageQuota
}

export async function adminChangeRequestStatus(requestId: string, status: RequestStatus, reason: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_set_request_status', {
    target_request: requestId,
    new_status: status,
    change_reason: reason,
    client_request_id: crypto.randomUUID()
  })
  if (error) throw error
}

export async function adminAddRequestNote(requestId: string, body: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_add_request_note', { target_request: requestId, note_body: body })
  if (error) throw error
}

export async function adminResolveReport(reportId: string, status: 'resolved' | 'dismissed' | 'reviewing', reason: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_resolve_report', {
    target_report: reportId,
    new_status: status,
    resolution: reason
  })
  if (error) throw error
}

export async function adminReviewVerification(verificationId: string, status: 'verified' | 'rejected', reason: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_review_verification', {
    target_verification: verificationId,
    new_status: status,
    review_reason: reason
  })
  if (error) throw error
}

export async function adminSuspendDonor(userId: string, reason: string, days = 7) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_suspend_donor', {
    target_user: userId,
    suspend_reason: reason,
    days
  })
  if (error) throw error
}

export interface AdminDonor {
  user_id: string
  display_name: string
  email: string | null
  phone: string | null
  blood_group: BloodGroup
  district: string
  area: string
  verification_status: string
  searchable: boolean
  available: boolean
  last_donation_date: string | null
  donation_count: number
  response_rate: number
  birth_year: number | null
  updated_at: string
  response_count?: number
  accepted_count?: number
  available_until?: string | null
  created_at?: string
}

export interface AdminDonorInput {
  email: string
  displayName: string
  bloodGroup: BloodGroup
  district: string
  area: string
  phone?: string
  searchable?: boolean
  lastDonation?: string | null
  birthYear?: number | null
  available?: boolean | null
  reason: string
}

export async function adminListDonors() {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('admin_list_donors', { page_limit: 100 })
  if (error) throw error
  return (data as AdminDonor[] | null) ?? []
}

export async function adminGetDonor(userId: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_get_donor', { target_user: userId })
  if (error) throw error
  return data as AdminDonor
}

export async function adminCreateDonor(input: AdminDonorInput) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { data, error } = await supabase.rpc('admin_create_donor', {
    donor_email: input.email,
    donor_display_name: input.displayName,
    donor_blood_group: input.bloodGroup,
    donor_district: input.district,
    donor_area: input.area,
    donor_phone: input.phone || null,
    donor_searchable: input.searchable ?? true,
    donor_last_donation: input.lastDonation || null,
    donor_birth_year: input.birthYear ?? null,
    create_reason: input.reason
  })
  if (error) throw error
  return data as { user_id: string; email: string; created_auth_user: boolean; temporary_password: string | null }
}

export async function adminUpdateDonor(userId: string, input: Omit<AdminDonorInput, 'email'> & { available?: boolean | null }) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_update_donor', {
    target_user: userId,
    donor_display_name: input.displayName,
    donor_blood_group: input.bloodGroup,
    donor_district: input.district,
    donor_area: input.area,
    donor_phone: input.phone ?? null,
    donor_searchable: input.searchable ?? null,
    donor_last_donation: input.lastDonation ?? null,
    donor_birth_year: input.birthYear ?? null,
    donor_available: input.available ?? null,
    change_reason: input.reason
  })
  if (error) throw error
}

export async function adminDeleteDonor(userId: string, reason: string) {
  if (!supabase) throw new Error('Supabase is not configured.')
  const { error } = await supabase.rpc('admin_delete_donor', {
    target_user: userId,
    delete_reason: reason
  })
  if (error) throw error
}

export async function fetchReports() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('reports')
    .select('id,category,status,details,entity_type,entity_id,created_at,resolution_reason')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function fetchVerifications() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('donor_verifications')
    .select('id,user_id,document_type,document_path,status,created_at,review_reason')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) throw error
  return data ?? []
}

export async function fetchAuditLogs() {
  if (!supabase) return []
  const { data, error } = await supabase.rpc('list_admin_audit_logs', { page_limit: 100 })
  if (error) throw error
  return (data as {
    id: number
    action: string
    entity_type: string
    entity_id: string
    reason: string
    created_at: string
    actor_id: string | null
    actor_name: string
  }[] | null) ?? []
}

export async function fetchDailyMetrics() {
  if (!supabase) return []
  const { data, error } = await supabase
    .from('daily_operational_metrics')
    .select('metric_date,requests_created,requests_fulfilled,requests_expired,requests_without_response,available_donors,pending_verifications,unresolved_reports,median_first_response_minutes,median_fulfillment_minutes')
    .order('metric_date', { ascending: false })
    .limit(30)
  if (error) throw error
  return data ?? []
}

export function buildSupplyGapMatrix(rows: AdminOverview['supply_gap']) {
  const groups: BloodGroup[] = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']
  const byDistrict = new Map<string, Record<string, 'ok' | 'low' | 'critical'>>()
  for (const row of rows) {
    const current = byDistrict.get(row.district) ?? Object.fromEntries(groups.map((g) => [g, 'ok' as const]))
    current[row.blood_group] = row.level
    byDistrict.set(row.district, current)
  }
  return [...byDistrict.entries()].map(([district, levels]) => ({ district, ...levels }))
}
