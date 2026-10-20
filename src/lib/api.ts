import { supabase } from './supabase'
import { track } from './analytics'
import { stripImageMetadata } from './image'
import type { BloodRequest, Donor } from '../types'
import type { BloodGroup, NotificationItem } from '../types'

type RequestRow={id:string;public_id:string;requester_id:string;blood_group:BloodRequest['bloodGroup'];units:number;hospital:string;district:string;area:string;urgency:BloodRequest['urgency'];status:BloodRequest['status'];needed_by:string;created_at:string;note:string|null;responses?:{count:number}[]}
type DonorDirectoryRow={user_id:string;display_name:string;blood_group:BloodGroup;district:string;area:string;masked_phone:string|null;verification_status:string;available:boolean;available_until:string|null;last_donation_date:string|null;donation_count:number;response_rate:number}

export interface MemberProfile {
  displayName:string
  email:string
  phone:string
  bloodGroup:BloodGroup
  district:string
  area:string
  lastDonation:string|null
  searchable:boolean
  showMaskedPhone:boolean
  available:boolean
}

const mapRequest=(row:RequestRow):BloodRequest=>({backendId:row.id,id:row.public_id,patientName:'Patient protected',bloodGroup:row.blood_group,units:row.units,hospital:row.hospital,district:row.district,area:row.area,urgency:row.urgency,status:row.status,neededBy:row.needed_by,createdAt:row.created_at,responses:row.responses?.[0]?.count??0,note:row.note??'Hospital coordination details are available after you respond.'})

export async function fetchRequests(){
  if(!supabase) return null
  const {data,error}=await supabase.from('blood_requests').select('id,public_id,requester_id,blood_group,units,hospital,district,area,urgency,status,needed_by,created_at,note').order('created_at',{ascending:false}).limit(50)
  if(error) return null
  return (data as RequestRow[]).map(mapRequest)
}

export async function fetchDonors(){
  if(!supabase) return null
  const {data,error}=await supabase.rpc('get_donor_profiles',{target_user:null})
  if(error) return null
  return (data as DonorDirectoryRow[]).map(mapDonor)
}

const mapDonor=(row:DonorDirectoryRow):Donor=>({backendId:row.user_id,id:row.user_id,displayName:row.display_name,bloodGroup:row.blood_group,district:row.district,area:row.area,distanceKm:0,verified:row.verification_status==='verified',available:row.available,lastDonation:row.last_donation_date,responseRate:row.response_rate,donations:row.donation_count,maskedPhone:row.masked_phone})

export async function fetchDonorById(id:string){
  if(!supabase)return null
  const {data,error}=await supabase.rpc('get_donor_profiles',{target_user:id})
  if(error)throw error
  const row=(data as DonorDirectoryRow[])[0]
  return row?mapDonor(row):null
}

export async function createBloodRequest(input:BloodRequest){
  if(!supabase) return input
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return null
  const {data,error}=await supabase.from('blood_requests').insert({requester_id:user.id,blood_group:input.bloodGroup,units:input.units,hospital:input.hospital,district:input.district,area:input.area,urgency:input.urgency,status:'open',needed_by:input.neededBy,expires_at:input.neededBy,note:input.note}).select('id,public_id,requester_id,blood_group,units,hospital,district,area,urgency,status,needed_by,created_at,note').single()
  if(error) throw error
  track('request_created',{urgency:input.urgency,district:input.district})
  return mapRequest(data as RequestRow)
}

export async function createResponse(request:BloodRequest){
  if(!supabase||!request.backendId) return true
  const {data:{user}}=await supabase.auth.getUser()
  if(!user) return false
  track('request_response_started')
  const {error}=await supabase.from('request_responses').upsert({request_id:request.backendId,donor_id:user.id,status:'offered'},{onConflict:'request_id,donor_id'})
  if(error) throw error
  track('request_response_completed')
  return true
}

export async function fetchMemberProfile():Promise<MemberProfile|null>{
  if(!supabase)return null
  const {data:{user}}=await supabase.auth.getUser();if(!user)return null
  const [{data:profile,error:profileError},{data:donor,error:donorError},{data:contact,error:contactError},{data:preference,error:preferenceError},{data:availability,error:availabilityError}]=await Promise.all([
    supabase.from('profiles').select('display_name,district').eq('id',user.id).maybeSingle(),
    supabase.from('donor_profiles').select('blood_group,district,area,last_donation_date,searchable').eq('user_id',user.id).maybeSingle(),
    supabase.from('donor_private_contacts').select('phone').eq('user_id',user.id).maybeSingle(),
    supabase.from('contact_preferences').select('allow_phone').eq('user_id',user.id).maybeSingle(),
    supabase.from('donor_availability').select('available,available_until').eq('user_id',user.id).order('created_at',{ascending:false}).limit(1).maybeSingle(),
  ])
  const error=profileError||donorError||contactError||preferenceError||availabilityError;if(error)throw error
  return {displayName:profile?.display_name??String(user.user_metadata?.display_name||user.email?.split('@')[0]||''),email:user.email??'',phone:contact?.phone??'',bloodGroup:(donor?.blood_group??'O+') as BloodGroup,district:donor?.district??profile?.district??'Dhaka',area:donor?.area??'',lastDonation:donor?.last_donation_date??null,searchable:donor?.searchable??true,showMaskedPhone:preference?.allow_phone??true,available:Boolean(availability?.available&&(!availability.available_until||new Date(availability.available_until)>new Date()))}
}

export async function saveMemberProfile(input:{displayName:string;phone:string;bloodGroup:BloodGroup;district:string;area:string;lastDonation:string|null;searchable:boolean;showMaskedPhone:boolean}){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in first.')
  const {error:profileError}=await supabase.from('profiles').update({display_name:input.displayName,district:input.district}).eq('id',user.id)
  if(profileError)throw profileError
  const {error:donorError}=await supabase.from('donor_profiles').upsert({user_id:user.id,blood_group:input.bloodGroup,district:input.district,area:input.area,last_donation_date:input.lastDonation||null,searchable:input.searchable},{onConflict:'user_id'})
  if(donorError)throw donorError
  const {error:contactError}=await supabase.from('donor_private_contacts').upsert({user_id:user.id,phone:input.phone||null,email:user.email??null},{onConflict:'user_id'})
  if(contactError)throw contactError
  const {error:preferenceError}=await supabase.from('contact_preferences').upsert({user_id:user.id,allow_phone:input.showMaskedPhone,allow_email:false,require_mutual_consent:true},{onConflict:'user_id'})
  if(preferenceError)throw preferenceError
  track('donor_profile_completed',{district:input.district})
}

export async function persistAvailability(available:boolean){
  if(!supabase)return
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in first.')
  const until=available?new Date(Date.now()+7*24*60*60*1000).toISOString():null
  const {error}=await supabase.from('donor_availability').insert({user_id:user.id,available,available_until:until})
  if(error)throw error
}

export async function fetchNotifications():Promise<NotificationItem[]|null>{
  if(!supabase)return null
  const {data,error}=await supabase.from('notifications').select('id,title,body,read_at,created_at,type').order('created_at',{ascending:false}).limit(20)
  if(error)return null
  return data.map(row=>({id:row.id,title:row.title,message:row.body,time:new Date(row.created_at).toLocaleString(),read:Boolean(row.read_at),tone:row.type.includes('success')?'success':row.type.includes('critical')?'warning':'info'}))
}

export async function persistNotificationsRead(){
  if(!supabase)return
  const {data:{user}}=await supabase.auth.getUser();if(!user)return
  const {error}=await supabase.from('notifications').update({read_at:new Date().toISOString()}).eq('user_id',user.id).is('read_at',null)
  if(error)throw error
}

export async function adminPersistRequestStatus(request:BloodRequest,status:BloodRequest['status'],reason:string){
  if(!supabase||!request.backendId)return
  const {error}=await supabase.rpc('admin_set_request_status',{target_request:request.backendId,new_status:status,change_reason:reason,client_request_id:crypto.randomUUID()})
  if(error)throw error
}

export async function createReport(request:BloodRequest,details:string){
  if(!supabase||!request.backendId)throw new Error('This request is not available in Supabase.')
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in first.')
  const {error}=await supabase.from('reports').insert({reporter_id:user.id,entity_type:'request',entity_id:request.backendId,category:'safety_concern',details})
  if(error)throw error
}

export async function submitVerification(file:File){
  if(!supabase)throw new Error('Supabase is not configured.')
  const allowed=['image/jpeg','image/png','image/webp','application/pdf'];if(!allowed.includes(file.type))throw new Error('Use a JPG, PNG, WebP, or PDF file.');if(file.size>5*1024*1024)throw new Error('The file must be 5 MB or smaller.')
  const sanitized=file.type.startsWith('image/')?await stripImageMetadata(file):file
  if(sanitized.size>5*1024*1024)throw new Error('The file must be 5 MB or smaller after processing.')
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in first.')
  const extension=sanitized.name.split('.').pop()?.toLowerCase()||'bin';const path=`${user.id}/${crypto.randomUUID()}.${extension}`
  const {error:uploadError}=await supabase.storage.from('verification-documents').upload(path,sanitized,{contentType:sanitized.type,upsert:false});if(uploadError)throw uploadError
  const {error:rowError}=await supabase.from('donor_verifications').insert({user_id:user.id,document_path:path,document_type:sanitized.type,status:'pending'});if(rowError){await supabase.storage.from('verification-documents').remove([path]);throw rowError}
}

export async function consentContactUnlock(requestId:string,donorId:string|null=null){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.rpc('consent_contact_unlock',{target_request:requestId,target_donor:donorId})
  if(error)throw error
  return data
}

export async function getSharedContact(requestId:string,donorId:string){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.rpc('get_shared_contact',{target_request:requestId,target_donor:donorId})
  if(error)throw error
  return data as {unlocked:boolean;phone?:string|null;email?:string|null}
}

export async function exportMyData(){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.rpc('export_my_data')
  if(error)throw error
  return data
}

export async function requestAccountDeletion(reason:string){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data,error}=await supabase.rpc('request_account_deletion',{deletion_reason:reason})
  if(error)throw error
  return data as string
}

export async function recordConsent(consentType:string,granted:boolean){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {error}=await supabase.rpc('record_user_consent',{consent:consentType,is_granted:granted,policy:'2026-10'})
  if(error)throw error
}

export async function saveNotificationPreferences(input:{critical_matches:boolean;response_updates:boolean;eligibility_reminders:boolean}){
  if(!supabase)throw new Error('Supabase is not configured.')
  const {data:{user}}=await supabase.auth.getUser();if(!user)throw new Error('Please sign in first.')
  const {error}=await supabase.from('notification_preferences').upsert({user_id:user.id,...input},{onConflict:'user_id'})
  if(error)throw error
}

export async function fetchRequestsPage(cursor:string|null=null,statusFilter:string|null=null){
  if(!supabase)return null
  const {data,error}=await supabase.rpc('list_blood_requests_page',{page_cursor:cursor,page_limit:25,status_filter:statusFilter})
  if(error)throw error
  return (data as Array<RequestRow & {response_count:number;next_cursor:string}>).map((row)=>({...mapRequest({...row,responses:[{count:row.response_count}]}),cursor:row.next_cursor}))
}
