-- Hemora initial schema. All public tables are protected with RLS below.
create extension if not exists pgcrypto;
create schema if not exists private;

create type public.app_role as enum ('member','verified_donor','support','moderator','operations_admin','analyst','super_admin');
create type public.blood_group as enum ('A+','A-','B+','B-','O+','O-','AB+','AB-');
create type public.request_status as enum ('draft','open','matched','fulfilled','expired','cancelled','fraudulent');
create type public.request_urgency as enum ('standard','urgent','critical');
create type public.verification_status as enum ('unverified','pending','verified','rejected','expired');

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null check (char_length(display_name) between 2 and 80),
  avatar_path text,
  district text,
  locale text not null default 'en',
  suspended_until timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.roles (role public.app_role primary key, description text not null);
create table public.permissions (permission text primary key, description text not null);
create table public.role_permissions (role public.app_role references public.roles(role) on delete cascade, permission text references public.permissions(permission) on delete cascade, primary key(role,permission));
create table public.user_roles (user_id uuid references auth.users(id) on delete cascade, role public.app_role references public.roles(role) on delete cascade, assigned_by uuid references auth.users(id), assigned_at timestamptz not null default now(), primary key(user_id,role));
create table public.user_consents (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, consent_type text not null, granted boolean not null, policy_version text not null, recorded_at timestamptz not null default now(), unique(user_id,consent_type,policy_version));

create table public.donor_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  blood_group public.blood_group not null, district text not null, area text not null,
  birth_year smallint check (birth_year between 1940 and extract(year from now())::int - 18),
  verification_status public.verification_status not null default 'unverified',
  searchable boolean not null default false, last_donation_date date,
  donation_count integer not null default 0 check (donation_count >= 0),
  response_count integer not null default 0 check (response_count >= 0),
  accepted_count integer not null default 0 check (accepted_count >= 0),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.donor_private_contacts (user_id uuid primary key references auth.users(id) on delete cascade, phone text, email text, emergency_contact text, exact_address text, updated_at timestamptz not null default now());
create table public.contact_preferences (user_id uuid primary key references auth.users(id) on delete cascade, allow_phone boolean not null default false, allow_email boolean not null default true, require_mutual_consent boolean not null default true, updated_at timestamptz not null default now());
create table public.donor_availability (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, available boolean not null, available_from timestamptz not null default now(), available_until timestamptz, created_at timestamptz not null default now());
create table public.donor_status_history (id bigint generated always as identity primary key, user_id uuid not null references auth.users(id) on delete cascade, from_status text, to_status text not null, reason text, changed_by uuid references auth.users(id), created_at timestamptz not null default now());
create table public.donor_verifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, document_path text not null, document_type text not null, status public.verification_status not null default 'pending', reviewer_id uuid references auth.users(id), review_reason text, reviewed_at timestamptz, created_at timestamptz not null default now());
create table public.donation_records (id uuid primary key default gen_random_uuid(), donor_id uuid not null references auth.users(id) on delete restrict, request_id uuid, hospital text not null, donation_date date not null, donation_type text not null default 'whole_blood', verified_by uuid references auth.users(id), created_at timestamptz not null default now());

create table public.blood_requests (
  id uuid primary key default gen_random_uuid(), public_id text not null unique default ('BR-' || upper(substr(replace(gen_random_uuid()::text,'-',''),1,8))),
  requester_id uuid not null references auth.users(id) on delete restrict, blood_group public.blood_group not null,
  units smallint not null check (units between 1 and 10), hospital text not null check (char_length(hospital) between 3 and 160),
  district text not null, area text not null, private_contact text, urgency public.request_urgency not null default 'standard',
  status public.request_status not null default 'draft', needed_by timestamptz not null, expires_at timestamptz not null,
  note text check (char_length(note) <= 1000), verified_by uuid references auth.users(id), verified_at timestamptz,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  constraint future_expiry check (expires_at > created_at)
);
alter table public.donation_records add constraint donation_records_request_id_fkey foreign key(request_id) references public.blood_requests(id) on delete set null;
create table public.request_responses (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.blood_requests(id) on delete cascade, donor_id uuid not null references auth.users(id) on delete cascade, status text not null default 'offered' check(status in('offered','accepted','declined','withdrawn','completed')), message text check(char_length(message)<=500), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), unique(request_id,donor_id));
create table public.request_status_history (id bigint generated always as identity primary key, request_id uuid not null references public.blood_requests(id) on delete cascade, from_status public.request_status, to_status public.request_status not null, reason text not null, changed_by uuid references auth.users(id), created_at timestamptz not null default now());
create table public.contact_unlocks (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.blood_requests(id) on delete cascade, donor_id uuid not null references auth.users(id) on delete cascade, requester_consented_at timestamptz, donor_consented_at timestamptz, revoked_at timestamptz, created_at timestamptz not null default now(), unique(request_id,donor_id));
create table public.request_notes (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.blood_requests(id) on delete cascade, author_id uuid not null references auth.users(id), body text not null check(char_length(body) between 1 and 2000), internal boolean not null default false, created_at timestamptz not null default now());
create table public.request_attachments (id uuid primary key default gen_random_uuid(), request_id uuid not null references public.blood_requests(id) on delete cascade, uploaded_by uuid not null references auth.users(id), storage_path text not null, mime_type text not null check(mime_type in('image/jpeg','image/png','image/webp','application/pdf')), size_bytes integer not null check(size_bytes between 1 and 5242880), created_at timestamptz not null default now());

create table public.reports (id uuid primary key default gen_random_uuid(), reporter_id uuid not null references auth.users(id) on delete restrict, entity_type text not null check(entity_type in('user','request','response')), entity_id uuid not null, category text not null, details text not null check(char_length(details) between 10 and 2000), status text not null default 'unreviewed' check(status in('unreviewed','reviewing','resolved','dismissed')), assigned_to uuid references auth.users(id), resolution_reason text, resolved_at timestamptz, created_at timestamptz not null default now());
create table public.moderation_actions (id uuid primary key default gen_random_uuid(), report_id uuid references public.reports(id), actor_id uuid not null references auth.users(id), action text not null, entity_type text not null, entity_id uuid not null, reason text not null, expires_at timestamptz, created_at timestamptz not null default now());
create table public.blocked_users (blocker_id uuid references auth.users(id) on delete cascade, blocked_id uuid references auth.users(id) on delete cascade, created_at timestamptz not null default now(), primary key(blocker_id,blocked_id), check(blocker_id<>blocked_id));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, type text not null, title text not null, body text not null, data jsonb not null default '{}', delivered_at timestamptz, failed_at timestamptz, read_at timestamptz, expires_at timestamptz, created_at timestamptz not null default now());
create table public.push_subscriptions (id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, endpoint_hash text not null unique, endpoint text not null, p256dh text not null, auth_key text not null, last_used_at timestamptz not null default now(), failed_count integer not null default 0, created_at timestamptz not null default now());
create table public.notification_preferences (user_id uuid primary key references auth.users(id) on delete cascade, critical_matches boolean not null default true, response_updates boolean not null default true, eligibility_reminders boolean not null default true, quiet_hours_start time, quiet_hours_end time, updated_at timestamptz not null default now());

create table public.admin_audit_logs (id bigint generated always as identity primary key, actor_id uuid references auth.users(id), action text not null, entity_type text not null, entity_id text not null, reason text not null, previous_value jsonb, new_value jsonb, request_id text, created_at timestamptz not null default now());
create table public.analytics_events (id bigint generated always as identity primary key, event_name text not null, anonymous_id_hash text not null, properties jsonb not null default '{}', occurred_at timestamptz not null default now());
create table public.daily_operational_metrics (metric_date date primary key, requests_created integer not null default 0, requests_fulfilled integer not null default 0, requests_expired integer not null default 0, requests_without_response integer not null default 0, median_first_response_minutes numeric, median_fulfillment_minutes numeric, available_donors integer not null default 0, pending_verifications integer not null default 0, unresolved_reports integer not null default 0, created_at timestamptz not null default now());
create table public.district_blood_supply_snapshots (snapshot_date date not null, district text not null, blood_group public.blood_group not null, available_donors integer not null default 0, open_requests integer not null default 0, supply_ratio numeric, primary key(snapshot_date,district,blood_group));
create table public.request_funnel_snapshots (snapshot_date date not null, blood_group public.blood_group not null, created_count integer not null default 0, response_count integer not null default 0, matched_count integer not null default 0, fulfilled_count integer not null default 0, primary key(snapshot_date,blood_group));

insert into public.roles values ('member','Standard member'),('verified_donor','Identity-verified donor'),('support','Limited support access'),('moderator','Trust and safety'),('operations_admin','Request and verification operations'),('analyst','Aggregated analytics only'),('super_admin','System administration');
insert into public.permissions values ('request.manage','Manage blood requests'),('donor.review','Review donor standing'),('verification.review','Review verification evidence'),('report.moderate','Resolve abuse reports'),('analytics.view','View aggregate operational analytics'),('audit.view','View administrative audit entries'),('role.assign','Assign administrative roles');
insert into public.role_permissions values ('operations_admin','request.manage'),('operations_admin','donor.review'),('operations_admin','verification.review'),('moderator','report.moderate'),('analyst','analytics.view'),('super_admin','request.manage'),('super_admin','donor.review'),('super_admin','verification.review'),('super_admin','report.moderate'),('super_admin','analytics.view'),('super_admin','audit.view'),('super_admin','role.assign');

create index blood_requests_search_idx on public.blood_requests(status,blood_group,district,expires_at);
create index donor_profiles_search_idx on public.donor_profiles(blood_group,district,verification_status) where searchable;
create index donor_availability_active_idx on public.donor_availability(available,available_until) where available;
create index request_responses_request_status_idx on public.request_responses(request_id,status);
create index reports_status_created_idx on public.reports(status,created_at);
create index notifications_user_read_created_idx on public.notifications(user_id,read_at,created_at desc);
create index audit_actor_created_idx on public.admin_audit_logs(actor_id,created_at desc);
create index user_roles_user_idx on public.user_roles(user_id);

create or replace function private.has_permission(requested text) returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.user_roles ur join public.role_permissions rp using(role) where ur.user_id=(select auth.uid()) and rp.permission=requested)
$$;
revoke all on function private.has_permission(text) from public;
grant execute on function private.has_permission(text) to authenticated;

create or replace function private.touch_updated_at() returns trigger language plpgsql set search_path='' as $$ begin new.updated_at=now(); return new; end $$;
create trigger profiles_touch before update on public.profiles for each row execute function private.touch_updated_at();
create trigger donor_profiles_touch before update on public.donor_profiles for each row execute function private.touch_updated_at();
create trigger blood_requests_touch before update on public.blood_requests for each row execute function private.touch_updated_at();
create trigger request_responses_touch before update on public.request_responses for each row execute function private.touch_updated_at();

create or replace function private.handle_new_user() returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.profiles(id,display_name) values(new.id,coalesce(new.raw_user_meta_data->>'display_name',split_part(new.email,'@',1),'New member'));
  insert into public.user_roles(user_id,role) values(new.id,'member');
  insert into public.contact_preferences(user_id) values(new.id);
  insert into public.notification_preferences(user_id) values(new.id);
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function private.handle_new_user();

create or replace function public.admin_set_request_status(target_request uuid,new_status public.request_status,change_reason text,client_request_id text default null) returns public.blood_requests
language plpgsql security definer set search_path='' as $$
declare old_row public.blood_requests; changed public.blood_requests;
begin
  if (select auth.uid()) is null or not private.has_permission('request.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(change_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  select * into old_row from public.blood_requests where id=target_request for update;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;
  update public.blood_requests set status=new_status where id=target_request returning * into changed;
  insert into public.request_status_history(request_id,from_status,to_status,reason,changed_by) values(target_request,old_row.status,new_status,change_reason,(select auth.uid()));
  insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,reason,previous_value,new_value,request_id) values((select auth.uid()),'request.status_changed','blood_request',target_request::text,change_reason,to_jsonb(old_row),to_jsonb(changed),client_request_id);
  return changed;
end $$;
revoke all on function public.admin_set_request_status(uuid,public.request_status,text,text) from public;
grant execute on function public.admin_set_request_status(uuid,public.request_status,text,text) to authenticated;

create or replace function public.expire_old_requests() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.blood_requests set status='expired' where status in('open','matched') and expires_at<=now(); get diagnostics affected=row_count; return affected;
end $$;
revoke all on function public.expire_old_requests() from public,anon,authenticated;
grant execute on function public.expire_old_requests() to service_role;

-- Lock down Data API grants before selectively granting operations.
revoke all on all tables in schema public from anon,authenticated;
grant select on public.roles,public.permissions,public.role_permissions to authenticated;
grant select,update on public.profiles to authenticated;
grant select,insert,update on public.donor_profiles,public.donor_private_contacts,public.contact_preferences,public.donor_availability,public.user_consents to authenticated;
grant select,insert,update on public.blood_requests,public.request_responses,public.contact_unlocks,public.request_notes,public.reports,public.blocked_users,public.push_subscriptions,public.notification_preferences to authenticated;
grant select,update on public.notifications to authenticated;
grant select on public.donation_records,public.donor_status_history,public.request_status_history,public.user_roles to authenticated;
grant select on public.daily_operational_metrics,public.district_blood_supply_snapshots,public.request_funnel_snapshots,public.admin_audit_logs,public.donor_verifications,public.moderation_actions to authenticated;
grant usage,select on all sequences in schema public to authenticated;
revoke select on public.blood_requests from authenticated;
grant select(id,public_id,requester_id,blood_group,units,hospital,district,area,urgency,status,needed_by,expires_at,note,verified_by,verified_at,created_at,updated_at) on public.blood_requests to anon,authenticated;

alter table public.profiles enable row level security;
alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.user_roles enable row level security;
alter table public.user_consents enable row level security;
alter table public.donor_profiles enable row level security;
alter table public.donor_private_contacts enable row level security;
alter table public.contact_preferences enable row level security;
alter table public.donor_availability enable row level security;
alter table public.donor_status_history enable row level security;
alter table public.donor_verifications enable row level security;
alter table public.donation_records enable row level security;
alter table public.blood_requests enable row level security;
alter table public.request_responses enable row level security;
alter table public.request_status_history enable row level security;
alter table public.contact_unlocks enable row level security;
alter table public.request_notes enable row level security;
alter table public.request_attachments enable row level security;
alter table public.reports enable row level security;
alter table public.moderation_actions enable row level security;
alter table public.blocked_users enable row level security;
alter table public.notifications enable row level security;
alter table public.push_subscriptions enable row level security;
alter table public.notification_preferences enable row level security;
alter table public.admin_audit_logs enable row level security;
alter table public.analytics_events enable row level security;
alter table public.daily_operational_metrics enable row level security;
alter table public.district_blood_supply_snapshots enable row level security;
alter table public.request_funnel_snapshots enable row level security;

create policy "users read permitted profile summary" on public.profiles for select to authenticated using((select auth.uid())=id or (select private.has_permission('donor.review')) or exists(select 1 from public.donor_profiles dp where dp.user_id=id and dp.searchable));
create policy "users update own profile" on public.profiles for update to authenticated using((select auth.uid())=id) with check((select auth.uid())=id);
create policy "authenticated read role catalog" on public.roles for select to authenticated using(true);
create policy "authenticated read permission catalog" on public.permissions for select to authenticated using(true);
create policy "authenticated read permission map" on public.role_permissions for select to authenticated using(true);
create policy "users read own roles" on public.user_roles for select to authenticated using((select auth.uid())=user_id or (select private.has_permission('role.assign')));
create policy "users manage own consents" on public.user_consents for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);

create policy "searchable donor summaries" on public.donor_profiles for select to authenticated using(searchable or (select auth.uid())=user_id or (select private.has_permission('donor.review')));
create policy "donors insert own profile" on public.donor_profiles for insert to authenticated with check((select auth.uid())=user_id);
create policy "donors update own profile" on public.donor_profiles for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "users manage own private contacts" on public.donor_private_contacts for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "users manage contact preferences" on public.contact_preferences for all to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "donor availability visible for matching" on public.donor_availability for select to authenticated using((available and (available_until is null or available_until>now())) or (select auth.uid())=user_id or (select private.has_permission('donor.review')));
create policy "donors add own availability" on public.donor_availability for insert to authenticated with check((select auth.uid())=user_id);
create policy "donors update own availability" on public.donor_availability for update to authenticated using((select auth.uid())=user_id) with check((select auth.uid())=user_id);
create policy "users see own status history" on public.donor_status_history for select to authenticated using((select auth.uid())=user_id or (select private.has_permission('donor.review')));
create policy "users see own verification" on public.donor_verifications for select to authenticated using((select auth.uid())=user_id or (select private.has_permission('verification.review')));
create policy "users see own donations" on public.donation_records for select to authenticated using((select auth.uid())=donor_id or (select private.has_permission('donor.review')));

create policy "members read active requests" on public.blood_requests for select to authenticated using(status in('open','matched','fulfilled') or requester_id=(select auth.uid()) or (select private.has_permission('request.manage')));
create policy "public read active requests" on public.blood_requests for select to anon using(status in('open','matched','fulfilled') and expires_at>now());
create policy "members create own requests" on public.blood_requests for insert to authenticated with check(requester_id=(select auth.uid()) and status in('draft','open'));
create policy "requesters update own draft requests" on public.blood_requests for update to authenticated using(requester_id=(select auth.uid()) and status in('draft','open')) with check(requester_id=(select auth.uid()) and status in('draft','open','cancelled'));
create policy "response participants read responses" on public.request_responses for select to authenticated using(donor_id=(select auth.uid()) or exists(select 1 from public.blood_requests br where br.id=request_id and br.requester_id=(select auth.uid())) or (select private.has_permission('request.manage')));
create policy "donors create own responses" on public.request_responses for insert to authenticated with check(donor_id=(select auth.uid()) and exists(select 1 from public.blood_requests br where br.id=request_id and br.status in('open','matched')));
create policy "donors update own responses" on public.request_responses for update to authenticated using(donor_id=(select auth.uid())) with check(donor_id=(select auth.uid()));
create policy "request participants read status history" on public.request_status_history for select to authenticated using(exists(select 1 from public.blood_requests br where br.id=request_id and (br.requester_id=(select auth.uid()) or exists(select 1 from public.request_responses rr where rr.request_id=br.id and rr.donor_id=(select auth.uid())))) or (select private.has_permission('request.manage')));
create policy "participants manage contact consent" on public.contact_unlocks for all to authenticated using(donor_id=(select auth.uid()) or exists(select 1 from public.blood_requests br where br.id=request_id and br.requester_id=(select auth.uid()))) with check(donor_id=(select auth.uid()) or exists(select 1 from public.blood_requests br where br.id=request_id and br.requester_id=(select auth.uid())));
create policy "participants read public notes" on public.request_notes for select to authenticated using((not internal and exists(select 1 from public.blood_requests br where br.id=request_id and (br.requester_id=(select auth.uid()) or exists(select 1 from public.request_responses rr where rr.request_id=br.id and rr.donor_id=(select auth.uid()))))) or (select private.has_permission('request.manage')));
create policy "participants add public notes" on public.request_notes for insert to authenticated with check(author_id=(select auth.uid()) and not internal);

create policy "reporters see own reports" on public.reports for select to authenticated using(reporter_id=(select auth.uid()) or (select private.has_permission('report.moderate')));
create policy "members create reports" on public.reports for insert to authenticated with check(reporter_id=(select auth.uid()));
create policy "moderators read actions" on public.moderation_actions for select to authenticated using((select private.has_permission('report.moderate')));
create policy "users manage own blocks" on public.blocked_users for all to authenticated using(blocker_id=(select auth.uid())) with check(blocker_id=(select auth.uid()));
create policy "users read notifications" on public.notifications for select to authenticated using(user_id=(select auth.uid()));
create policy "users mark notifications read" on public.notifications for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "users manage push subscriptions" on public.push_subscriptions for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "users manage notification preferences" on public.notification_preferences for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "authorized admins read audit" on public.admin_audit_logs for select to authenticated using((select private.has_permission('audit.view')));
create policy "analysts read daily metrics" on public.daily_operational_metrics for select to authenticated using((select private.has_permission('analytics.view')));
create policy "analysts read supply snapshots" on public.district_blood_supply_snapshots for select to authenticated using((select private.has_permission('analytics.view')));
create policy "analysts read funnel snapshots" on public.request_funnel_snapshots for select to authenticated using((select private.has_permission('analytics.view')));

-- Private verification documents. Paths must begin with the uploader's user ID.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('verification-documents','verification-documents',false,5242880,array['image/jpeg','image/png','image/webp','application/pdf']) on conflict(id) do update set public=false,file_size_limit=excluded.file_size_limit,allowed_mime_types=excluded.allowed_mime_types;
create policy "upload own verification document" on storage.objects for insert to authenticated with check(bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "read own verification document" on storage.objects for select to authenticated using(bucket_id='verification-documents' and ((storage.foldername(name))[1]=(select auth.uid())::text or (select private.has_permission('verification.review'))));
create policy "replace own pending document" on storage.objects for update to authenticated using(bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text) with check(bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);
create policy "delete own verification document" on storage.objects for delete to authenticated using(bucket_id='verification-documents' and (storage.foldername(name))[1]=(select auth.uid())::text);

comment on table public.donor_private_contacts is 'Never expose through public donor search; access only by owner or consent-aware server workflow.';
comment on table public.admin_audit_logs is 'Append-only administrative audit trail. No client insert, update, or delete grant.';
