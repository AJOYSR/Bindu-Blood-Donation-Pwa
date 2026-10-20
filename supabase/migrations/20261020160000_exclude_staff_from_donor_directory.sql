-- Staff accounts (support / moderator / ops / analyst / super_admin) must never
-- appear in the public donor directory, even if they have a donor_profiles row.

create or replace function private.is_staff_account(target uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1 from public.user_roles ur
    where ur.user_id = target
      and ur.role in ('support', 'moderator', 'operations_admin', 'analyst', 'super_admin')
  )
$$;
revoke all on function private.is_staff_account(uuid) from public, anon;
grant execute on function private.is_staff_account(uuid) to authenticated;

-- Hide existing staff from search right away.
update public.donor_profiles dp
set searchable = false
where private.is_staff_account(dp.user_id)
  and dp.searchable;

create or replace function private.donor_directory(target_user uuid default null)
returns table (
  user_id uuid,
  display_name text,
  blood_group public.blood_group,
  district text,
  area text,
  masked_phone text,
  verification_status public.verification_status,
  available boolean,
  available_until timestamptz,
  last_donation_date date,
  donation_count integer,
  response_rate integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dp.user_id,
    p.display_name,
    dp.blood_group,
    dp.district,
    dp.area,
    case when coalesce(cp.allow_phone, false)
      then private.mask_donor_phone(dpc.phone)
      else null
    end as masked_phone,
    dp.verification_status,
    coalesce(da.available and (da.available_until is null or da.available_until > now()), false) as available,
    da.available_until,
    dp.last_donation_date,
    dp.donation_count,
    case when dp.response_count > 0
      then round(dp.accepted_count::numeric / dp.response_count * 100)::integer
      else 100
    end as response_rate
  from public.donor_profiles dp
  join public.profiles p on p.id = dp.user_id
  left join public.donor_private_contacts dpc on dpc.user_id = dp.user_id
  left join public.contact_preferences cp on cp.user_id = dp.user_id
  left join lateral (
    select availability.available, availability.available_until
    from public.donor_availability availability
    where availability.user_id = dp.user_id
    order by availability.created_at desc
    limit 1
  ) da on true
  where dp.searchable
    and not private.is_staff_account(dp.user_id)
    and (target_user is null or dp.user_id = target_user)
  order by available desc, dp.verification_status = 'verified' desc, dp.updated_at desc
  limit 100
$$;

-- Staff cannot turn directory visibility back on for themselves.
create or replace function private.prevent_staff_searchable_donor()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.searchable and private.is_staff_account(new.user_id) then
    new.searchable := false;
  end if;
  return new;
end $$;
revoke all on function private.prevent_staff_searchable_donor() from public, anon, authenticated;
drop trigger if exists prevent_staff_searchable_donor on public.donor_profiles;
create trigger prevent_staff_searchable_donor
  before insert or update of searchable on public.donor_profiles
  for each row execute function private.prevent_staff_searchable_donor();
