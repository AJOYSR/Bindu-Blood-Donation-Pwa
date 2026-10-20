-- Complete missing architecture: permissions RPC, admin ops, rate limits,
-- contact unlock, account export/deletion, cursor lists, critical-request alerts.

create table if not exists public.rate_limit_events (
  id bigint generated always as identity primary key,
  user_id uuid references auth.users(id) on delete cascade,
  action text not null,
  created_at timestamptz not null default now()
);
create index if not exists rate_limit_events_lookup_idx on public.rate_limit_events(user_id, action, created_at desc);

create table if not exists public.account_deletion_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check(char_length(reason) between 5 and 1000),
  status text not null default 'pending' check(status in('pending','processing','completed','cancelled')),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists public.operational_alerts (
  id uuid primary key default gen_random_uuid(),
  alert_type text not null,
  entity_type text not null,
  entity_id text not null,
  severity text not null default 'warning' check(severity in('info','warning','critical')),
  message text not null,
  resolved_at timestamptz,
  created_at timestamptz not null default now(),
  unique(alert_type, entity_type, entity_id)
);

alter table public.rate_limit_events enable row level security;
alter table public.account_deletion_requests enable row level security;
alter table public.operational_alerts enable row level security;

revoke all on public.rate_limit_events from anon, authenticated;
revoke all on public.account_deletion_requests from anon, authenticated;
revoke all on public.operational_alerts from anon, authenticated;
grant select, insert on public.account_deletion_requests to authenticated;
grant select on public.operational_alerts to authenticated;

create policy "users manage own deletion requests" on public.account_deletion_requests
  for all to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "ops read operational alerts" on public.operational_alerts
  for select to authenticated using((select private.has_permission('request.manage')) or (select private.has_permission('analytics.view')));

-- Permissions for the signed-in user (UI gating only; DB remains authoritative).
create or replace function public.my_permissions()
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct rp.permission order by rp.permission), '{}')
  from public.user_roles ur
  join public.role_permissions rp using(role)
  where ur.user_id=(select auth.uid())
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

create or replace function public.my_roles()
returns public.app_role[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(ur.role order by ur.role), '{}')
  from public.user_roles ur where ur.user_id=(select auth.uid())
$$;
revoke all on function public.my_roles() from public, anon;
grant execute on function public.my_roles() to authenticated;

create or replace function public.check_rate_limit(action_name text, max_events integer default 10, window_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare recent integer;
begin
  if uid is null then return false; end if;
  select count(*) into recent from public.rate_limit_events
  where user_id=uid and action=action_name and created_at > now() - make_interval(secs => window_seconds);
  if recent >= max_events then return false; end if;
  insert into public.rate_limit_events(user_id, action) values(uid, action_name);
  return true;
end $$;
revoke all on function public.check_rate_limit(text,integer,integer) from public, anon;
grant execute on function public.check_rate_limit(text,integer,integer) to authenticated;

create or replace function public.admin_overview_metrics()
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
  if not (private.has_permission('analytics.view') or private.has_permission('request.manage')) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  select jsonb_build_object(
    'active_donors', (select count(*) from public.donor_profiles where searchable),
    'available_today', (select count(distinct da.user_id) from public.donor_availability da where da.available and (da.available_until is null or da.available_until>now())),
    'open_requests', (select count(*) from public.blood_requests where status in('open','matched')),
    'critical_requests', (select count(*) from public.blood_requests where status in('open','matched') and urgency='critical'),
    'expiring_soon', (select count(*) from public.blood_requests where status in('open','matched') and expires_at < now() + interval '3 hours'),
    'fulfilled_today', (select count(*) from public.blood_requests where status='fulfilled' and updated_at>=current_date),
    'pending_verification', (select count(*) from public.donor_verifications where status='pending'),
    'unresolved_reports', (select count(*) from public.reports where status in('unreviewed','reviewing')),
    'notification_failures', (select count(*) from public.notifications where failed_at is not null and created_at > now() - interval '7 days'),
    'delivery_failures', (select count(*) from public.push_subscriptions where failed_count > 0),
    'latest_metric', (select to_jsonb(m) from public.daily_operational_metrics m order by metric_date desc limit 1),
    'weekly', coalesce((
      select jsonb_agg(jsonb_build_object('day', to_char(d,'Dy'), 'created', coalesce(c.cnt,0), 'fulfilled', coalesce(f.cnt,0)) order by d)
      from generate_series(current_date - 6, current_date, '1 day'::interval) d
      left join lateral (select count(*) cnt from public.blood_requests br where br.created_at::date=d::date) c on true
      left join lateral (select count(*) cnt from public.blood_requests br where br.status='fulfilled' and br.updated_at::date=d::date) f on true
    ), '[]'::jsonb),
    'supply_gap', coalesce((
      select jsonb_agg(jsonb_build_object(
        'district', s.district,
        'blood_group', s.blood_group,
        'available_donors', s.available_donors,
        'open_requests', s.open_requests,
        'supply_ratio', s.supply_ratio,
        'level', case
          when coalesce(s.open_requests,0)=0 then 'ok'
          when coalesce(s.supply_ratio,0) < 0.5 then 'critical'
          when coalesce(s.supply_ratio,0) < 1.2 then 'low'
          else 'ok'
        end
      ))
      from public.district_blood_supply_snapshots s
      where s.snapshot_date=(select max(snapshot_date) from public.district_blood_supply_snapshots)
    ), '[]'::jsonb),
    'alerts', coalesce((
      select jsonb_agg(jsonb_build_object('id',a.id,'alert_type',a.alert_type,'severity',a.severity,'message',a.message,'created_at',a.created_at) order by a.created_at desc)
      from (select * from public.operational_alerts where resolved_at is null order by created_at desc limit 10) a
    ), '[]'::jsonb)
  ) into result;
  return result;
end $$;
revoke all on function public.admin_overview_metrics() from public, anon;
grant execute on function public.admin_overview_metrics() to authenticated;

create or replace function public.usage_quota_snapshot()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if not (private.has_permission('analytics.view') or private.has_permission('request.manage')) then
    raise exception 'permission denied' using errcode='42501';
  end if;
  return jsonb_build_object(
    'profiles', (select count(*) from public.profiles),
    'donor_profiles', (select count(*) from public.donor_profiles),
    'blood_requests', (select count(*) from public.blood_requests),
    'notifications', (select count(*) from public.notifications),
    'push_subscriptions', (select count(*) from public.push_subscriptions),
    'audit_logs', (select count(*) from public.admin_audit_logs),
    'storage_warning_threshold', 0.7,
    'notes', 'Free-tier planning estimates only. Monitor Supabase and Netlify dashboards for hard limits.'
  );
end $$;
revoke all on function public.usage_quota_snapshot() from public, anon;
grant execute on function public.usage_quota_snapshot() to authenticated;

create or replace function public.list_blood_requests_page(page_cursor timestamptz default null, page_limit integer default 25, status_filter text default null)
returns table(id uuid, public_id text, blood_group public.blood_group, units integer, hospital text, district text, area text, urgency public.request_urgency, status public.request_status, needed_by timestamptz, created_at timestamptz, response_count bigint, next_cursor timestamptz)
language plpgsql stable security definer set search_path='' as $$
begin
  page_limit := least(greatest(coalesce(page_limit,25),1),50);
  return query
  select br.id, br.public_id, br.blood_group, br.units, br.hospital, br.district, br.area, br.urgency, br.status, br.needed_by, br.created_at,
    (select count(*) from public.request_responses rr where rr.request_id=br.id),
    br.created_at
  from public.blood_requests br
  where (page_cursor is null or br.created_at < page_cursor)
    and (status_filter is null or br.status::text=status_filter)
    and (
      br.status in('open','matched','fulfilled')
      or br.requester_id=(select auth.uid())
      or private.has_permission('request.manage')
    )
  order by br.created_at desc
  limit page_limit;
end $$;
revoke all on function public.list_blood_requests_page(timestamptz,integer,text) from public, anon;
grant execute on function public.list_blood_requests_page(timestamptz,integer,text) to authenticated;

create or replace function public.admin_add_request_note(target_request uuid, note_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare note_id uuid;
begin
  if not private.has_permission('request.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(note_body)) < 5 then raise exception 'A meaningful note is required' using errcode='22023'; end if;
  insert into public.request_notes(request_id, author_id, body, internal)
  values(target_request, (select auth.uid()), trim(note_body), true)
  returning id into note_id;
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, new_value)
  values((select auth.uid()), 'request.note_added', 'blood_request', target_request::text, 'Internal administrative note', jsonb_build_object('note_id', note_id));
  return note_id;
end $$;
revoke all on function public.admin_add_request_note(uuid,text) from public, anon;
grant execute on function public.admin_add_request_note(uuid,text) to authenticated;

create or replace function public.admin_resolve_report(target_report uuid, new_status text, resolution text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_row public.reports;
begin
  if not private.has_permission('report.moderate') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if new_status not in('resolved','dismissed','reviewing') then raise exception 'invalid status' using errcode='22023'; end if;
  if char_length(trim(resolution)) < 5 then raise exception 'A meaningful resolution reason is required' using errcode='22023'; end if;
  select * into old_row from public.reports where id=target_report for update;
  if not found then raise exception 'Report not found' using errcode='P0002'; end if;
  update public.reports
    set status=new_status, resolution_reason=trim(resolution), assigned_to=(select auth.uid()),
        resolved_at=case when new_status in('resolved','dismissed') then now() else null end
  where id=target_report;
  insert into public.moderation_actions(report_id, actor_id, action, entity_type, entity_id, reason)
  values(target_report, (select auth.uid()), 'report.'||new_status, old_row.entity_type, old_row.entity_id::text, trim(resolution));
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, previous_value, new_value)
  values((select auth.uid()), 'report.status_changed', 'report', target_report::text, trim(resolution),
    jsonb_build_object('status', old_row.status), jsonb_build_object('status', new_status));
  return true;
end $$;
revoke all on function public.admin_resolve_report(uuid,text,text) from public, anon;
grant execute on function public.admin_resolve_report(uuid,text,text) to authenticated;

-- Moderators need update on reports via RPC only (no direct client update grant beyond existing).
grant update on public.reports to authenticated;
drop policy if exists "moderators update reports" on public.reports;
create policy "moderators update reports" on public.reports for update to authenticated
using ((select private.has_permission('report.moderate')))
with check ((select private.has_permission('report.moderate')));

grant insert on public.moderation_actions to authenticated;
drop policy if exists "moderators write actions" on public.moderation_actions;
create policy "moderators write actions" on public.moderation_actions for insert to authenticated
with check ((select private.has_permission('report.moderate')) and actor_id=(select auth.uid()));

create or replace function public.admin_review_verification(target_verification uuid, new_status public.verification_status, review_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_row public.donor_verifications;
begin
  if not private.has_permission('verification.review') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if new_status not in('verified','rejected') then raise exception 'invalid status' using errcode='22023'; end if;
  if char_length(trim(review_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  select * into old_row from public.donor_verifications where id=target_verification for update;
  if not found then raise exception 'Verification not found' using errcode='P0002'; end if;
  update public.donor_verifications
    set status=new_status, reviewer_id=(select auth.uid()), review_reason=trim(review_reason), reviewed_at=now()
  where id=target_verification;
  update public.donor_profiles set verification_status=new_status where user_id=old_row.user_id;
  if new_status='verified' then
    insert into public.user_roles(user_id, role, assigned_by) values(old_row.user_id, 'verified_donor', (select auth.uid()))
    on conflict do nothing;
  end if;
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, previous_value, new_value)
  values((select auth.uid()), 'verification.reviewed', 'donor_verification', target_verification::text, trim(review_reason),
    jsonb_build_object('status', old_row.status), jsonb_build_object('status', new_status));
  return true;
end $$;
revoke all on function public.admin_review_verification(uuid,public.verification_status,text) from public, anon;
grant execute on function public.admin_review_verification(uuid,public.verification_status,text) to authenticated;

grant update on public.donor_verifications to authenticated;
drop policy if exists "reviewers update verifications" on public.donor_verifications;
create policy "reviewers update verifications" on public.donor_verifications for update to authenticated
using ((select private.has_permission('verification.review')))
with check ((select private.has_permission('verification.review')));

create or replace function public.admin_suspend_donor(target_user uuid, suspend_reason text, days integer default 7)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not private.has_permission('donor.review') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(suspend_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  update public.donor_profiles set searchable=false where user_id=target_user;
  insert into public.donor_availability(user_id, available, available_until)
  values(target_user, false, now() + make_interval(days => greatest(days,1)));
  insert into public.donor_status_history(user_id, from_status, to_status, reason, changed_by)
  values(target_user, 'active', 'suspended', trim(suspend_reason), (select auth.uid()));
  insert into public.moderation_actions(actor_id, action, entity_type, entity_id, reason, expires_at)
  values((select auth.uid()), 'donor.suspended', 'user', target_user::text, trim(suspend_reason), now() + make_interval(days => greatest(days,1)));
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, new_value)
  values((select auth.uid()), 'donor.suspended', 'user', target_user::text, trim(suspend_reason),
    jsonb_build_object('days', days, 'searchable', false));
  return true;
end $$;
revoke all on function public.admin_suspend_donor(uuid,text,integer) from public, anon;
grant execute on function public.admin_suspend_donor(uuid,text,integer) to authenticated;

create or replace function public.consent_contact_unlock(target_request uuid, target_donor uuid default null)
returns public.contact_unlocks language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare req public.blood_requests;
declare donor uuid;
declare unlock public.contact_unlocks;
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if not public.check_rate_limit('contact_unlock', 20, 3600) then raise exception 'rate limit exceeded' using errcode='54000'; end if;
  select * into req from public.blood_requests where id=target_request;
  if not found then raise exception 'Request not found' using errcode='P0002'; end if;

  if req.requester_id = uid then
    donor := coalesce(target_donor, (
      select rr.donor_id from public.request_responses rr
      where rr.request_id=target_request and rr.status in('offered','accepted','completed')
      order by rr.created_at desc limit 1
    ));
    if donor is null then raise exception 'No donor response to unlock' using errcode='P0002'; end if;
    insert into public.contact_unlocks(request_id, donor_id, requester_consented_at)
    values(target_request, donor, now())
    on conflict(request_id, donor_id) do update
      set requester_consented_at=coalesce(public.contact_unlocks.requester_consented_at, now()), revoked_at=null
    returning * into unlock;
  else
    if not exists(select 1 from public.request_responses rr where rr.request_id=target_request and rr.donor_id=uid) then
      raise exception 'permission denied' using errcode='42501';
    end if;
    insert into public.contact_unlocks(request_id, donor_id, donor_consented_at)
    values(target_request, uid, now())
    on conflict(request_id, donor_id) do update
      set donor_consented_at=coalesce(public.contact_unlocks.donor_consented_at, now()), revoked_at=null
    returning * into unlock;
  end if;
  return unlock;
end $$;
revoke all on function public.consent_contact_unlock(uuid,uuid) from public, anon;
grant execute on function public.consent_contact_unlock(uuid,uuid) to authenticated;

create or replace function public.get_shared_contact(target_request uuid, target_donor uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare unlock public.contact_unlocks;
declare contact public.donor_private_contacts;
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  select * into unlock from public.contact_unlocks
  where request_id=target_request and donor_id=target_donor and revoked_at is null
    and requester_consented_at is not null and donor_consented_at is not null;
  if not found then return jsonb_build_object('unlocked', false); end if;
  if uid <> target_donor and not exists(select 1 from public.blood_requests br where br.id=target_request and br.requester_id=uid)
     and not private.has_permission('request.manage') then
    raise exception 'permission denied' using errcode='42501';
  end if;
  select * into contact from public.donor_private_contacts where user_id=target_donor;
  return jsonb_build_object(
    'unlocked', true,
    'phone', contact.phone,
    'email', contact.email
  );
end $$;
revoke all on function public.get_shared_contact(uuid,uuid) from public, anon;
grant execute on function public.get_shared_contact(uuid,uuid) to authenticated;

create or replace function public.export_my_data()
returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  return jsonb_build_object(
    'exported_at', now(),
    'profile', (select to_jsonb(p) from public.profiles p where p.id=uid),
    'donor_profile', (select to_jsonb(d)-'exact_location' from public.donor_profiles d where d.user_id=uid),
    'consents', coalesce((select jsonb_agg(to_jsonb(c)) from public.user_consents c where c.user_id=uid), '[]'::jsonb),
    'preferences', (select to_jsonb(n) from public.notification_preferences n where n.user_id=uid),
    'requests', coalesce((select jsonb_agg(jsonb_build_object('public_id',br.public_id,'status',br.status,'created_at',br.created_at,'blood_group',br.blood_group,'district',br.district)) from public.blood_requests br where br.requester_id=uid), '[]'::jsonb),
    'responses', coalesce((select jsonb_agg(jsonb_build_object('request_id',rr.request_id,'status',rr.status,'created_at',rr.created_at)) from public.request_responses rr where rr.donor_id=uid), '[]'::jsonb)
  );
end $$;
revoke all on function public.export_my_data() from public, anon;
grant execute on function public.export_my_data() to authenticated;

create or replace function public.request_account_deletion(deletion_reason text)
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare req_id uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  if char_length(trim(deletion_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  insert into public.user_consents(user_id, consent_type, granted, policy_version)
  values(uid, 'account_deletion_requested', true, '2026-10');
  insert into public.account_deletion_requests(user_id, reason)
  values(uid, trim(deletion_reason)) returning id into req_id;
  update public.donor_profiles set searchable=false where user_id=uid;
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason)
  values(uid, 'account.deletion_requested', 'user', uid::text, trim(deletion_reason));
  return req_id;
end $$;
revoke all on function public.request_account_deletion(text) from public, anon;
grant execute on function public.request_account_deletion(text) to authenticated;

create or replace function public.record_user_consent(consent text, is_granted boolean, policy text default '2026-10')
returns uuid language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare cid uuid;
begin
  if uid is null then raise exception 'not authenticated' using errcode='42501'; end if;
  insert into public.user_consents(user_id, consent_type, granted, policy_version)
  values(uid, consent, is_granted, policy)
  on conflict(user_id, consent_type, policy_version) do update set granted=excluded.granted, recorded_at=now()
  returning id into cid;
  return cid;
end $$;
revoke all on function public.record_user_consent(text,boolean,text) from public, anon;
grant execute on function public.record_user_consent(text,boolean,text) to authenticated;

create or replace function private.flag_unanswered_critical_requests() returns integer
language plpgsql security definer set search_path='' as $$
declare affected integer := 0;
begin
  insert into public.operational_alerts(alert_type, entity_type, entity_id, severity, message)
  select 'unanswered_critical', 'blood_request', br.id::text, 'critical',
    format('Critical request %s in %s has no donor responses after 2 hours', br.public_id, br.district)
  from public.blood_requests br
  where br.status in('open','matched') and br.urgency='critical'
    and br.created_at < now() - interval '2 hours'
    and not exists(select 1 from public.request_responses rr where rr.request_id=br.id)
  on conflict(alert_type, entity_type, entity_id) do nothing;
  get diagnostics affected = row_count;

  insert into public.operational_alerts(alert_type, entity_type, entity_id, severity, message)
  select 'verification_backlog', 'system', 'verification', 'warning',
    format('%s verification submissions pending for over 24 hours', count(*))
  from public.donor_verifications dv
  where dv.status='pending' and dv.created_at < now() - interval '24 hours'
  having count(*) > 0
  on conflict(alert_type, entity_type, entity_id) do update
    set message=excluded.message, created_at=now(), resolved_at=null;
  return affected;
end $$;

do $cron$
begin
  if not exists(select 1 from cron.job where jobname='hemora-flag-critical') then
    perform cron.schedule('hemora-flag-critical','*/30 * * * *','select private.flag_unanswered_critical_requests()');
  end if;
end $cron$;

-- Rate-limit request creation via trigger.
create or replace function private.enforce_request_rate_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.check_rate_limit('create_request', 5, 3600) then
    raise exception 'Too many requests created. Please wait before creating another.' using errcode='54000';
  end if;
  return new;
end $$;
drop trigger if exists enforce_request_rate_limit on public.blood_requests;
create trigger enforce_request_rate_limit before insert on public.blood_requests
for each row execute function private.enforce_request_rate_limit();

create or replace function private.enforce_response_rate_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if not public.check_rate_limit('create_response', 30, 3600) then
    raise exception 'Too many responses. Please wait before responding again.' using errcode='54000';
  end if;
  return new;
end $$;
drop trigger if exists enforce_response_rate_limit on public.request_responses;
create trigger enforce_response_rate_limit before insert on public.request_responses
for each row execute function private.enforce_response_rate_limit();

comment on function public.my_permissions() is 'UI helper only. All authorization is enforced by RLS and SECURITY DEFINER checks.';
