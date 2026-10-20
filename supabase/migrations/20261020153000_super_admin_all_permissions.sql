-- super_admin implicitly holds every permission, including ones added later.
-- MFA (AAL2) is still required separately for admin mutations.

create or replace function private.has_permission(requested text) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = (select auth.uid())
      and (
        ur.role = 'super_admin'
        or exists(select 1 from public.role_permissions rp where rp.role = ur.role and rp.permission = requested)
      )
  )
$$;
revoke all on function private.has_permission(text) from public;
grant execute on function private.has_permission(text) to authenticated;

create or replace function public.my_permissions()
returns text[] language sql stable security definer set search_path='' as $$
  select coalesce(array_agg(distinct p.permission order by p.permission), '{}')
  from (
    select rp.permission
    from public.user_roles ur
    join public.role_permissions rp using(role)
    where ur.user_id = (select auth.uid())
    union
    select rp.permission
    from public.role_permissions rp
    where exists(select 1 from public.user_roles ur where ur.user_id = (select auth.uid()) and ur.role = 'super_admin')
  ) p
$$;
revoke all on function public.my_permissions() from public, anon;
grant execute on function public.my_permissions() to authenticated;
