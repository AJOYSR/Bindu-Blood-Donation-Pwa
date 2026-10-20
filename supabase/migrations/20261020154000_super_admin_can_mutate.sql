-- Super admins hold every permission and may perform admin mutations
-- without a second authenticator factor. Other admin roles still need AAL2.

create or replace function private.is_super_admin() returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid()) and ur.role = 'super_admin'
  )
$$;
revoke all on function private.is_super_admin() from public, anon;
grant execute on function private.is_super_admin() to authenticated;

create or replace function private.admin_assured() returns boolean
language sql stable security definer set search_path='' as $$
  select private.is_super_admin() or private.is_aal2()
$$;
revoke all on function private.admin_assured() from public, anon;
grant execute on function private.admin_assured() to authenticated;

create or replace function public.my_permissions()
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct p.permission order by p.permission), '{}')
  from (
    select rp.permission
    from public.user_roles ur
    join public.role_permissions rp using(role)
    where ur.user_id = (select auth.uid())
    union
    select perm.permission
    from public.permissions perm
    where private.is_super_admin()
  ) p
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;

drop policy if exists "operations admins update requests" on public.blood_requests;
drop policy if exists "authorized request updates" on public.blood_requests;
create policy "authorized request updates" on public.blood_requests for update to authenticated
using (
  (requester_id = (select auth.uid()) and status in ('draft', 'open'))
  or ((select private.has_permission('request.manage')) and (select private.admin_assured()))
)
with check (
  (requester_id = (select auth.uid()) and status in ('draft', 'open', 'cancelled'))
  or ((select private.has_permission('request.manage')) and (select private.admin_assured()))
);

create or replace function public.admin_set_request_status(target_request uuid, new_status public.request_status, change_reason text, client_request_id text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  if (select auth.uid()) is null or not private.has_permission('request.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if not private.admin_assured() then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(change_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  perform set_config('hemora.change_reason', change_reason, true);
  perform set_config('hemora.client_request_id', coalesce(client_request_id, ''), true);
  update public.blood_requests set status = new_status where id = target_request;
  get diagnostics affected = row_count;
  if affected = 0 then raise exception 'Request not found or update denied' using errcode='P0002'; end if;
  return true;
end $$;

create or replace function public.admin_add_request_note(target_request uuid, note_body text)
returns uuid language plpgsql security definer set search_path='' as $$
declare note_id uuid;
begin
  if not private.has_permission('request.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if not private.admin_assured() then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(note_body)) < 5 then raise exception 'A meaningful note is required' using errcode='22023'; end if;
  insert into public.request_notes(request_id, author_id, body, internal)
  values(target_request, (select auth.uid()), trim(note_body), true)
  returning id into note_id;
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, new_value)
  values((select auth.uid()), 'request.note_added', 'blood_request', target_request::text, 'Internal administrative note', jsonb_build_object('note_id', note_id));
  return note_id;
end $$;

create or replace function public.admin_resolve_report(target_report uuid, new_status text, resolution text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_row public.reports;
begin
  if not private.has_permission('report.moderate') then raise exception 'permission denied' using errcode='42501'; end if;
  if not private.admin_assured() then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
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

create or replace function public.admin_review_verification(target_verification uuid, new_status public.verification_status, review_reason text)
returns boolean language plpgsql security definer set search_path='' as $$
declare old_row public.donor_verifications;
begin
  if not private.has_permission('verification.review') then raise exception 'permission denied' using errcode='42501'; end if;
  if not private.admin_assured() then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
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

create or replace function public.admin_suspend_donor(target_user uuid, suspend_reason text, days integer default 7)
returns boolean language plpgsql security definer set search_path='' as $$
begin
  if not private.has_permission('donor.review') then raise exception 'permission denied' using errcode='42501'; end if;
  if not private.admin_assured() then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(suspend_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  update public.donor_profiles set searchable = false where user_id = target_user;
  insert into public.donor_availability(user_id, available, available_until)
  values(target_user, false, now() + make_interval(days => greatest(days, 1)));
  insert into public.donor_status_history(user_id, from_status, to_status, reason, changed_by)
  values(target_user, 'active', 'suspended', trim(suspend_reason), (select auth.uid()));
  insert into public.moderation_actions(actor_id, action, entity_type, entity_id, reason, expires_at)
  values((select auth.uid()), 'donor.suspended', 'user', target_user::text, trim(suspend_reason), now() + make_interval(days => greatest(days, 1)));
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, new_value)
  values((select auth.uid()), 'donor.suspended', 'user', target_user::text, trim(suspend_reason),
    jsonb_build_object('days', days, 'searchable', false));
  return true;
end $$;
