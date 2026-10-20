drop policy if exists "requesters update own draft requests" on public.blood_requests;
drop policy if exists "operations admins update requests" on public.blood_requests;

create policy "authorized request updates" on public.blood_requests for update to authenticated
using (
  (requester_id=(select auth.uid()) and status in('draft','open'))
  or ((select private.has_permission('request.manage')) and (select auth.jwt()->>'aal')='aal2')
)
with check (
  (requester_id=(select auth.uid()) and status in('draft','open','cancelled'))
  or ((select private.has_permission('request.manage')) and (select auth.jwt()->>'aal')='aal2')
);
