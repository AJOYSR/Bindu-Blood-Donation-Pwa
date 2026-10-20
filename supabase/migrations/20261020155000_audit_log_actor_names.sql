-- Audit viewers see actor display names, not only UUIDs.
create or replace function public.list_admin_audit_logs(page_limit integer default 100)
returns table (
  id bigint,
  action text,
  entity_type text,
  entity_id text,
  reason text,
  created_at timestamptz,
  actor_id uuid,
  actor_name text
)
language plpgsql stable security definer set search_path='' as $$
begin
  if not private.has_permission('audit.view') then
    raise exception 'permission denied' using errcode='42501';
  end if;
  return query
  select
    a.id,
    a.action,
    a.entity_type,
    a.entity_id,
    a.reason,
    a.created_at,
    a.actor_id,
    coalesce(nullif(trim(p.display_name), ''), split_part(u.email, '@', 1), 'Unknown')
  from public.admin_audit_logs a
  left join public.profiles p on p.id = a.actor_id
  left join auth.users u on u.id = a.actor_id
  order by a.created_at desc
  limit greatest(1, least(coalesce(page_limit, 100), 200));
end $$;
revoke all on function public.list_admin_audit_logs(integer) from public, anon;
grant execute on function public.list_admin_audit_logs(integer) to authenticated;
