create or replace function private.is_aal2() returns boolean language sql stable security invoker set search_path='' as $$
  select coalesce(auth.jwt()->>'aal','aal1')='aal2'
$$;
revoke all on function private.is_aal2() from public,anon;
grant execute on function private.is_aal2() to authenticated;

drop policy if exists "authorized request updates" on public.blood_requests;
create policy "authorized request updates" on public.blood_requests for update to authenticated
using (
  (requester_id=(select auth.uid()) and status in('draft','open'))
  or ((select private.has_permission('request.manage')) and (select private.is_aal2()))
)
with check (
  (requester_id=(select auth.uid()) and status in('draft','open','cancelled'))
  or ((select private.has_permission('request.manage')) and (select private.is_aal2()))
);
