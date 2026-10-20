-- Replace the exposed SECURITY DEFINER mutation with RLS + an audit trigger.
drop function if exists public.admin_set_request_status(uuid,public.request_status,text,text);

create policy "operations admins update requests"
on public.blood_requests for update to authenticated
using ((select private.has_permission('request.manage')) and (select auth.jwt()->>'aal')='aal2')
with check ((select private.has_permission('request.manage')) and (select auth.jwt()->>'aal')='aal2');

create or replace function private.audit_request_status_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare change_reason text := coalesce(nullif(current_setting('hemora.change_reason',true),''),'Administrative status change');
declare client_request_id text := nullif(current_setting('hemora.client_request_id',true),'');
begin
  if old.status is distinct from new.status then
    insert into public.request_status_history(request_id,from_status,to_status,reason,changed_by)
    values(new.id,old.status,new.status,change_reason,(select auth.uid()));
    insert into public.admin_audit_logs(actor_id,action,entity_type,entity_id,reason,previous_value,new_value,request_id)
    values((select auth.uid()),'request.status_changed','blood_request',new.id::text,change_reason,to_jsonb(old)-'private_contact',to_jsonb(new)-'private_contact',client_request_id);
  end if;
  return new;
end $$;
revoke all on function private.audit_request_status_change() from public,anon,authenticated;
drop trigger if exists audit_request_status_change on public.blood_requests;
create trigger audit_request_status_change after update of status on public.blood_requests for each row execute function private.audit_request_status_change();

create or replace function public.admin_set_request_status(target_request uuid,new_status public.request_status,change_reason text,client_request_id text default null) returns boolean
language plpgsql security invoker set search_path='' as $$
declare affected integer;
begin
  if (select auth.uid()) is null or not private.has_permission('request.manage') then raise exception 'permission denied' using errcode='42501'; end if;
  if coalesce((select auth.jwt()->>'aal'),'aal1') <> 'aal2' then raise exception 'MFA assurance level 2 required' using errcode='42501'; end if;
  if char_length(trim(change_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode='22023'; end if;
  perform set_config('hemora.change_reason',change_reason,true);
  perform set_config('hemora.client_request_id',coalesce(client_request_id,''),true);
  update public.blood_requests set status=new_status where id=target_request;
  get diagnostics affected=row_count;
  if affected=0 then raise exception 'Request not found or update denied' using errcode='P0002'; end if;
  return true;
end $$;
revoke all on function public.admin_set_request_status(uuid,public.request_status,text,text) from public,anon;
grant execute on function public.admin_set_request_status(uuid,public.request_status,text,text) to authenticated;

grant select,insert,delete on public.request_attachments to authenticated;
create policy "participants read request attachments" on public.request_attachments for select to authenticated
using(uploaded_by=(select auth.uid()) or exists(select 1 from public.blood_requests br where br.id=request_id and br.requester_id=(select auth.uid())) or (select private.has_permission('request.manage')));
create policy "members upload request attachments" on public.request_attachments for insert to authenticated
with check(uploaded_by=(select auth.uid()) and exists(select 1 from public.blood_requests br where br.id=request_id and br.requester_id=(select auth.uid())));
create policy "members delete own request attachments" on public.request_attachments for delete to authenticated
using(uploaded_by=(select auth.uid()));
create policy "service writes anonymized analytics" on public.analytics_events for all to service_role using(true) with check(true);

-- Cover common foreign-key joins and cascades reported by the performance advisor.
create index if not exists blood_requests_requester_idx on public.blood_requests(requester_id);
create index if not exists blood_requests_verified_by_idx on public.blood_requests(verified_by);
create index if not exists donor_availability_user_idx on public.donor_availability(user_id);
create index if not exists donor_status_history_user_idx on public.donor_status_history(user_id);
create index if not exists donor_status_history_changed_by_idx on public.donor_status_history(changed_by);
create index if not exists donor_verifications_user_idx on public.donor_verifications(user_id);
create index if not exists donor_verifications_reviewer_idx on public.donor_verifications(reviewer_id);
create index if not exists donation_records_donor_idx on public.donation_records(donor_id);
create index if not exists donation_records_request_idx on public.donation_records(request_id);
create index if not exists donation_records_verified_by_idx on public.donation_records(verified_by);
create index if not exists contact_unlocks_donor_idx on public.contact_unlocks(donor_id);
create index if not exists request_responses_donor_idx on public.request_responses(donor_id);
create index if not exists request_status_history_request_idx on public.request_status_history(request_id);
create index if not exists request_status_history_changed_by_idx on public.request_status_history(changed_by);
create index if not exists request_notes_request_idx on public.request_notes(request_id);
create index if not exists request_notes_author_idx on public.request_notes(author_id);
create index if not exists request_attachments_request_idx on public.request_attachments(request_id);
create index if not exists request_attachments_uploader_idx on public.request_attachments(uploaded_by);
create index if not exists reports_reporter_idx on public.reports(reporter_id);
create index if not exists reports_assigned_idx on public.reports(assigned_to);
create index if not exists moderation_actions_report_idx on public.moderation_actions(report_id);
create index if not exists moderation_actions_actor_idx on public.moderation_actions(actor_id);
create index if not exists blocked_users_blocked_idx on public.blocked_users(blocked_id);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
create index if not exists role_permissions_permission_idx on public.role_permissions(permission);
create index if not exists user_roles_role_idx on public.user_roles(role);
create index if not exists user_roles_assigned_by_idx on public.user_roles(assigned_by);
