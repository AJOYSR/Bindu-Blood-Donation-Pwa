import { createClient } from '@supabase/supabase-js'
import { randomBytes } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import bangladeshDistricts from '../src/data/bangladesh-districts.json' with { type: 'json' }

const districts = bangladeshDistricts
const bloodGroups = ['A+', 'A-', 'B+', 'B-', 'O+', 'O-', 'AB+', 'AB-']

function readEnvFile(path) {
  if (!existsSync(path)) return {}
  return Object.fromEntries(
    readFileSync(path, 'utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('#') && line.includes('='))
      .map((line) => {
        const separator = line.indexOf('=')
        const key = line.slice(0, separator).trim()
        let value = line.slice(separator + 1).trim()
        if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
          value = value.slice(1, -1)
        }
        return [key, value]
      }),
  )
}

const env = { ...readEnvFile('.env'), ...readEnvFile('.env.local'), ...process.env }
const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL
const secretKey = env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
const adminEmail = env.SUPER_ADMIN_EMAIL?.trim().toLowerCase()
const adminPassword = env.SUPER_ADMIN_PASSWORD

const missing = [
  ['SUPABASE_URL (or VITE_SUPABASE_URL)', supabaseUrl],
  ['SUPABASE_SECRET_KEY', secretKey],
  ['SUPER_ADMIN_EMAIL', adminEmail],
  ['SUPER_ADMIN_PASSWORD', adminPassword],
].filter(([, value]) => !value).map(([name]) => name)

if (missing.length) {
  const keyHelp = missing.includes('SUPABASE_SECRET_KEY')
    ? `\n\nGet the server key from:\n  Supabase Dashboard → Project Settings → API Keys → Secret key\n\nThen add it to .env.local:\n  SUPABASE_SECRET_KEY=sb_secret_...\n\nA legacy service_role key also works as SUPABASE_SERVICE_ROLE_KEY. Never use a VITE_ prefix.`
    : ''
  throw new Error(`Missing required environment values: ${missing.join(', ')}${keyHelp}`)
}
if (secretKey.startsWith('sb_publishable_')) throw new Error('SUPABASE_SECRET_KEY must be a secret/server key, not a publishable browser key.')
if (!/^\S+@\S+\.\S+$/.test(adminEmail)) throw new Error('SUPER_ADMIN_EMAIL must be a valid email address.')
if (adminPassword.length < 14) throw new Error('SUPER_ADMIN_PASSWORD must contain at least 14 characters.')

const supabase = createClient(supabaseUrl, secretKey, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
})

function assertResult(result, operation) {
  if (result.error) throw new Error(`${operation}: ${result.error.message}`)
  return result.data
}

async function table(name, operation, promise) {
  return assertResult(await promise, `${name} ${operation}`)
}

async function findUser(email) {
  for (let page = 1; page <= 20; page += 1) {
    const data = assertResult(await supabase.auth.admin.listUsers({ page, perPage: 100 }), 'list Auth users')
    const match = data.users.find((user) => user.email?.toLowerCase() === email)
    if (match) return match
    if (data.users.length < 100) return null
  }
  throw new Error(`Could not finish searching Auth users for ${email}`)
}

async function ensureUser({ email, displayName, password, appMetadata = {} }) {
  const existing = await findUser(email)
  const attributes = {
    email,
    password,
    email_confirm: true,
    user_metadata: { ...(existing?.user_metadata ?? {}), display_name: displayName },
    app_metadata: { ...(existing?.app_metadata ?? {}), ...appMetadata },
  }
  if (existing) {
    const user = assertResult(await supabase.auth.admin.updateUserById(existing.id, attributes), `update Auth user ${email}`).user
    return user
  }
  return assertResult(await supabase.auth.admin.createUser(attributes), `create Auth user ${email}`).user
}

const generatedPassword = () => `${randomBytes(24).toString('base64url')}Aa1!`
const now = new Date()
const isoAfter = (days) => new Date(now.getTime() + days * 86_400_000).toISOString()
const dateBefore = (days) => new Date(now.getTime() - days * 86_400_000).toISOString().slice(0, 10)
const today = now.toISOString().slice(0, 10)

console.log('Creating or updating Auth users…')
const admin = await ensureUser({
  email: adminEmail,
  displayName: 'Hemora Super Admin',
  password: adminPassword,
  appMetadata: { hemora_role: 'super_admin', seed_managed: false },
})
const requester = await ensureUser({
  email: 'seed.requester@example.com',
  displayName: 'Nadia Rahman',
  password: generatedPassword(),
  appMetadata: { hemora_role: 'member', seed_managed: true },
})
const donorOne = await ensureUser({
  email: 'seed.donor.one@example.com',
  displayName: 'Arif Hossain',
  password: generatedPassword(),
  appMetadata: { hemora_role: 'verified_donor', seed_managed: true },
})
const donorTwo = await ensureUser({
  email: 'seed.donor.two@example.com',
  displayName: 'Samira Khan',
  password: generatedPassword(),
  appMetadata: { hemora_role: 'verified_donor', seed_managed: true },
})

const requestOpen = '10000000-0000-4000-8000-000000000001'
const requestFulfilled = '10000000-0000-4000-8000-000000000002'
const responseAccepted = '20000000-0000-4000-8000-000000000001'
const responseCompleted = '20000000-0000-4000-8000-000000000002'
const reportId = '30000000-0000-4000-8000-000000000001'
const verificationId = '40000000-0000-4000-8000-000000000001'
const donationId = '50000000-0000-4000-8000-000000000001'

console.log('Seeding reference and identity data…')
await table('roles', 'upsert', supabase.from('roles').upsert([
  { role: 'member', description: 'Standard member' },
  { role: 'verified_donor', description: 'Identity-verified donor' },
  { role: 'support', description: 'Limited support access' },
  { role: 'moderator', description: 'Trust and safety' },
  { role: 'operations_admin', description: 'Request and verification operations' },
  { role: 'analyst', description: 'Aggregated analytics only' },
  { role: 'super_admin', description: 'System administration' },
], { onConflict: 'role' }))
await table('permissions', 'upsert', supabase.from('permissions').upsert([
  ['request.manage', 'Manage blood requests'],
  ['donor.review', 'Review donor standing'],
  ['verification.review', 'Review verification evidence'],
  ['report.moderate', 'Resolve abuse reports'],
  ['analytics.view', 'View aggregate operational analytics'],
  ['audit.view', 'View administrative audit entries'],
  ['role.assign', 'Assign administrative roles'],
].map(([permission, description]) => ({ permission, description })), { onConflict: 'permission' }))
await table('role_permissions', 'upsert', supabase.from('role_permissions').upsert([
  ['operations_admin', 'request.manage'], ['operations_admin', 'donor.review'], ['operations_admin', 'verification.review'],
  ['moderator', 'report.moderate'], ['analyst', 'analytics.view'],
  ['super_admin', 'request.manage'], ['super_admin', 'donor.review'], ['super_admin', 'verification.review'],
  ['super_admin', 'report.moderate'], ['super_admin', 'analytics.view'], ['super_admin', 'audit.view'], ['super_admin', 'role.assign'],
].map(([role, permission]) => ({ role, permission })), { onConflict: 'role,permission' }))

await table('profiles', 'upsert', supabase.from('profiles').upsert([
  { id: admin.id, display_name: 'Hemora Super Admin', district: 'Dhaka', locale: 'en' },
  { id: requester.id, display_name: 'Nadia Rahman', district: 'Dhaka', locale: 'bn' },
  { id: donorOne.id, display_name: 'Arif Hossain', district: 'Dhaka', locale: 'bn' },
  { id: donorTwo.id, display_name: 'Samira Khan', district: 'Chattogram', locale: 'en' },
], { onConflict: 'id' }))
await table('user_roles', 'upsert', supabase.from('user_roles').upsert([
  { user_id: admin.id, role: 'member', assigned_by: admin.id },
  { user_id: admin.id, role: 'super_admin', assigned_by: admin.id },
  { user_id: requester.id, role: 'member', assigned_by: admin.id },
  { user_id: donorOne.id, role: 'member', assigned_by: admin.id },
  { user_id: donorOne.id, role: 'verified_donor', assigned_by: admin.id },
  { user_id: donorTwo.id, role: 'member', assigned_by: admin.id },
  { user_id: donorTwo.id, role: 'verified_donor', assigned_by: admin.id },
], { onConflict: 'user_id,role' }))
await table('user_consents', 'upsert', supabase.from('user_consents').upsert([
  { user_id: requester.id, consent_type: 'privacy', granted: true, policy_version: '2026-10' },
  { user_id: donorOne.id, consent_type: 'donor_search', granted: true, policy_version: '2026-10' },
  { user_id: donorTwo.id, consent_type: 'donor_search', granted: true, policy_version: '2026-10' },
], { onConflict: 'user_id,consent_type,policy_version' }))

console.log('Seeding donor data…')
await table('donor_profiles', 'upsert', supabase.from('donor_profiles').upsert([
  { user_id: donorOne.id, blood_group: 'O+', district: 'Dhaka', area: 'Dhanmondi', birth_year: 1995, verification_status: 'verified', searchable: true, last_donation_date: dateBefore(110), donation_count: 6, response_count: 9, accepted_count: 7 },
  { user_id: donorTwo.id, blood_group: 'A-', district: 'Chattogram', area: 'Panchlaish', birth_year: 1998, verification_status: 'verified', searchable: true, last_donation_date: dateBefore(140), donation_count: 3, response_count: 5, accepted_count: 4 },
], { onConflict: 'user_id' }))
await table('donor_private_contacts', 'upsert', supabase.from('donor_private_contacts').upsert([
  { user_id: donorOne.id, phone: '+8801700000001', email: 'seed.donor.one@example.com', emergency_contact: '+8801800000001', exact_address: 'Dhanmondi, Dhaka' },
  { user_id: donorTwo.id, phone: '+8801700000002', email: 'seed.donor.two@example.com', emergency_contact: '+8801800000002', exact_address: 'Panchlaish, Chattogram' },
], { onConflict: 'user_id' }))
await table('contact_preferences', 'upsert', supabase.from('contact_preferences').upsert([
  { user_id: admin.id, allow_phone: false, allow_email: true, require_mutual_consent: true },
  { user_id: requester.id, allow_phone: true, allow_email: true, require_mutual_consent: true },
  { user_id: donorOne.id, allow_phone: true, allow_email: true, require_mutual_consent: true },
  { user_id: donorTwo.id, allow_phone: false, allow_email: true, require_mutual_consent: true },
], { onConflict: 'user_id' }))
await table('donor_availability', 'delete seed rows', supabase.from('donor_availability').delete().in('user_id', [donorOne.id, donorTwo.id]))
await table('donor_availability', 'insert', supabase.from('donor_availability').insert([
  { user_id: donorOne.id, available: true, available_from: now.toISOString(), available_until: isoAfter(14) },
  { user_id: donorTwo.id, available: true, available_from: now.toISOString(), available_until: isoAfter(7) },
]))
await table('donor_status_history', 'delete seed rows', supabase.from('donor_status_history').delete().like('reason', '[seed]%'))
await table('donor_status_history', 'insert', supabase.from('donor_status_history').insert([
  { user_id: donorOne.id, from_status: 'pending', to_status: 'verified', reason: '[seed] Verification approved', changed_by: admin.id },
  { user_id: donorTwo.id, from_status: 'pending', to_status: 'verified', reason: '[seed] Verification approved', changed_by: admin.id },
]))

const verificationPath = `${donorOne.id}/seed-verification.pdf`
const fakePdf = new TextEncoder().encode('%PDF-1.4\n% Hemora seed verification fixture\n%%EOF\n')
assertResult(await supabase.storage.from('verification-documents').upload(verificationPath, fakePdf, { contentType: 'application/pdf', upsert: true }), 'upload seed verification document')
await table('donor_verifications', 'upsert', supabase.from('donor_verifications').upsert({
  id: verificationId, user_id: donorOne.id, document_path: verificationPath, document_type: 'national_id', status: 'verified', reviewer_id: admin.id, review_reason: '[seed] Identity matched', reviewed_at: now.toISOString(),
}, { onConflict: 'id' }))

console.log('Seeding request and donation workflows…')
await table('blood_requests', 'upsert', supabase.from('blood_requests').upsert([
  { id: requestOpen, public_id: 'BR-SEED001', requester_id: requester.id, blood_group: 'O+', units: 2, hospital: 'Dhaka Medical College Hospital', district: 'Dhaka', area: 'Shahbag', private_contact: '+8801900000001', urgency: 'critical', status: 'open', needed_by: isoAfter(1), expires_at: isoAfter(2), note: 'Emergency surgery; screened donors requested.', verified_by: admin.id, verified_at: now.toISOString() },
  { id: requestFulfilled, public_id: 'BR-SEED002', requester_id: requester.id, blood_group: 'A-', units: 1, hospital: 'Chattogram Medical College Hospital', district: 'Chattogram', area: 'Panchlaish', private_contact: '+8801900000002', urgency: 'urgent', status: 'fulfilled', needed_by: isoAfter(3), expires_at: isoAfter(4), note: 'Seeded fulfilled request for dashboard history.', verified_by: admin.id, verified_at: now.toISOString() },
], { onConflict: 'id' }))
await table('request_responses', 'upsert', supabase.from('request_responses').upsert([
  { id: responseAccepted, request_id: requestOpen, donor_id: donorOne.id, status: 'accepted', message: 'Available today after 4 PM.' },
  { id: responseCompleted, request_id: requestFulfilled, donor_id: donorTwo.id, status: 'completed', message: 'Donation completed successfully.' },
], { onConflict: 'id' }))
await table('request_status_history', 'delete seed rows', supabase.from('request_status_history').delete().like('reason', '[seed]%'))
await table('request_status_history', 'insert', supabase.from('request_status_history').insert([
  { request_id: requestOpen, from_status: 'draft', to_status: 'open', reason: '[seed] Request verified', changed_by: admin.id },
  { request_id: requestFulfilled, from_status: 'matched', to_status: 'fulfilled', reason: '[seed] Donation confirmed', changed_by: admin.id },
]))
await table('contact_unlocks', 'upsert', supabase.from('contact_unlocks').upsert({
  request_id: requestOpen, donor_id: donorOne.id, requester_consented_at: now.toISOString(), donor_consented_at: now.toISOString(),
}, { onConflict: 'request_id,donor_id' }))
await table('request_notes', 'delete seed rows', supabase.from('request_notes').delete().eq('body', '[seed] Hospital desk confirmed the request.'))
await table('request_notes', 'insert', supabase.from('request_notes').insert({ request_id: requestOpen, author_id: admin.id, body: '[seed] Hospital desk confirmed the request.', internal: false }))
await table('request_attachments', 'delete seed rows', supabase.from('request_attachments').delete().eq('storage_path', 'seed/requests/BR-SEED001-prescription.pdf'))
await table('request_attachments', 'insert', supabase.from('request_attachments').insert({ request_id: requestOpen, uploaded_by: requester.id, storage_path: 'seed/requests/BR-SEED001-prescription.pdf', mime_type: 'application/pdf', size_bytes: fakePdf.byteLength }))
await table('donation_records', 'upsert', supabase.from('donation_records').upsert({
  id: donationId, donor_id: donorTwo.id, request_id: requestFulfilled, hospital: 'Chattogram Medical College Hospital', donation_date: dateBefore(1), donation_type: 'whole_blood', verified_by: admin.id,
}, { onConflict: 'id' }))

console.log('Seeding trust, messaging, and analytics data…')
await table('reports', 'upsert', supabase.from('reports').upsert({
  id: reportId, reporter_id: donorOne.id, entity_type: 'request', entity_id: requestOpen, category: 'contact_check', details: '[seed] Please verify that the hospital contact is still reachable.', status: 'resolved', assigned_to: admin.id, resolution_reason: '[seed] Contact reconfirmed', resolved_at: now.toISOString(),
}, { onConflict: 'id' }))
await table('moderation_actions', 'delete seed rows', supabase.from('moderation_actions').delete().eq('reason', '[seed] Request contact reconfirmed'))
await table('moderation_actions', 'insert', supabase.from('moderation_actions').insert({ report_id: reportId, actor_id: admin.id, action: 'verify_contact', entity_type: 'request', entity_id: requestOpen, reason: '[seed] Request contact reconfirmed' }))
await table('blocked_users', 'upsert', supabase.from('blocked_users').upsert({ blocker_id: donorTwo.id, blocked_id: donorOne.id }, { onConflict: 'blocker_id,blocked_id' }))
await table('notifications', 'delete seed rows', supabase.from('notifications').delete().in('type', ['seed_match', 'seed_status']))
await table('notifications', 'insert', supabase.from('notifications').insert([
  { user_id: donorOne.id, type: 'seed_match', title: 'Critical O+ match nearby', body: 'A verified request in Shahbag matches your donor profile.', data: { request_id: requestOpen, seed: true }, delivered_at: now.toISOString(), expires_at: isoAfter(2) },
  { user_id: requester.id, type: 'seed_status', title: 'A donor responded', body: 'A verified donor accepted your request.', data: { request_id: requestOpen, response_id: responseAccepted, seed: true }, delivered_at: now.toISOString() },
]))
await table('push_subscriptions', 'upsert', supabase.from('push_subscriptions').upsert({
  user_id: donorOne.id, endpoint_hash: 'seed-endpoint-donor-one', endpoint: 'https://push.example.com/hemora-seed-donor-one', p256dh: 'seed-public-key', auth_key: 'seed-auth-key', failed_count: 0,
}, { onConflict: 'endpoint_hash' }))
await table('notification_preferences', 'upsert', supabase.from('notification_preferences').upsert([
  { user_id: admin.id, critical_matches: false, response_updates: true, eligibility_reminders: false, quiet_hours_start: '23:00', quiet_hours_end: '07:00' },
  { user_id: requester.id, critical_matches: true, response_updates: true, eligibility_reminders: true },
  { user_id: donorOne.id, critical_matches: true, response_updates: true, eligibility_reminders: true, quiet_hours_start: '23:00', quiet_hours_end: '06:00' },
  { user_id: donorTwo.id, critical_matches: true, response_updates: true, eligibility_reminders: true },
], { onConflict: 'user_id' }))
await table('admin_audit_logs', 'delete seed rows', supabase.from('admin_audit_logs').delete().eq('entity_id', 'seed-bootstrap'))
await table('admin_audit_logs', 'insert', supabase.from('admin_audit_logs').insert({ actor_id: admin.id, action: 'seed.completed', entity_type: 'system', entity_id: 'seed-bootstrap', reason: '[seed] Relational fixtures loaded', new_value: { tables: 'all', version: 1 }, request_id: 'seed-v1' }))
await table('analytics_events', 'delete seed rows', supabase.from('analytics_events').delete().like('anonymous_id_hash', 'seed:%'))
await table('analytics_events', 'insert', supabase.from('analytics_events').insert([
  { event_name: 'request_viewed', anonymous_id_hash: 'seed:visitor-1', properties: { source: 'search', seed: true } },
  { event_name: 'donor_search_completed', anonymous_id_hash: 'seed:visitor-2', properties: { result_count: 2, seed: true } },
]))
await table('daily_operational_metrics', 'upsert', supabase.from('daily_operational_metrics').upsert({ metric_date: today, requests_created: 2, requests_fulfilled: 1, requests_expired: 0, requests_without_response: 0, median_first_response_minutes: 18, median_fulfillment_minutes: 240, available_donors: 2, pending_verifications: 0, unresolved_reports: 0 }, { onConflict: 'metric_date' }))
const supplySnapshots = districts.flatMap((district, districtIndex) => bloodGroups.map((blood_group, groupIndex) => {
  const available = (districtIndex + groupIndex) % 5
  const open = (districtIndex * 3 + groupIndex) % 3
  return {
    snapshot_date: today,
    district,
    blood_group,
    available_donors: available,
    open_requests: open,
    supply_ratio: open === 0 ? available : Number((available / open).toFixed(2)),
  }
}))
await table('district_blood_supply_snapshots', 'upsert', supabase.from('district_blood_supply_snapshots').upsert(supplySnapshots, { onConflict: 'snapshot_date,district,blood_group' }))
console.log(`Seeded blood-supply snapshots for ${districts.length} districts × ${bloodGroups.length} blood groups.`)
await table('request_funnel_snapshots', 'upsert', supabase.from('request_funnel_snapshots').upsert([
  { snapshot_date: today, blood_group: 'O+', created_count: 1, response_count: 1, matched_count: 1, fulfilled_count: 0 },
  { snapshot_date: today, blood_group: 'A-', created_count: 1, response_count: 1, matched_count: 1, fulfilled_count: 1 },
], { onConflict: 'snapshot_date,blood_group' }))

console.log(`Seed complete. Super admin: ${adminEmail}`)
console.log('Seeded every public application table and uploaded a connected verification fixture.')
