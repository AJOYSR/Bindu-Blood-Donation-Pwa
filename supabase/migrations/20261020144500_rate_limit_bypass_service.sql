-- Rate limits apply only to signed-in members. Service-role seeds and
-- background jobs must not be blocked by auth.uid()-based buckets.

create or replace function public.check_rate_limit(action_name text, max_events integer default 10, window_seconds integer default 3600)
returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid := (select auth.uid());
declare recent integer;
begin
  -- No session (service_role / postgres) → allow.
  if uid is null then return true; end if;
  if coalesce((select auth.role()), '') = 'service_role' then return true; end if;

  select count(*) into recent from public.rate_limit_events
  where user_id=uid and action=action_name and created_at > now() - make_interval(secs => window_seconds);
  if recent >= max_events then return false; end if;
  insert into public.rate_limit_events(user_id, action) values(uid, action_name);
  return true;
end $$;

create or replace function private.enforce_request_rate_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select auth.role()), '') = 'service_role' or (select auth.uid()) is null then
    return new;
  end if;
  if not public.check_rate_limit('create_request', 5, 3600) then
    raise exception 'Too many requests created. Please wait before creating another.' using errcode='54000';
  end if;
  return new;
end $$;

create or replace function private.enforce_response_rate_limit() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if coalesce((select auth.role()), '') = 'service_role' or (select auth.uid()) is null then
    return new;
  end if;
  if not public.check_rate_limit('create_response', 30, 3600) then
    raise exception 'Too many responses. Please wait before responding again.' using errcode='54000';
  end if;
  return new;
end $$;
