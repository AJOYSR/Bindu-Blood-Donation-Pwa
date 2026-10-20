-- Privacy-safe donor directory. Raw phone numbers and email addresses remain
-- in donor_private_contacts and are never returned by this API.
create or replace function private.mask_donor_phone(phone_number text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select case
    when char_length(regexp_replace(phone_number, '[^0-9]', '', 'g')) < 5 then null
    else substr(regexp_replace(phone_number, '[^0-9]', '', 'g'), 1, 4)
      || '****'
      || right(regexp_replace(phone_number, '[^0-9]', '', 'g'), 1)
  end
$$;

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
    and (target_user is null or dp.user_id = target_user)
  order by available desc, dp.verification_status = 'verified' desc, dp.updated_at desc
  limit 100
$$;

revoke all on function private.mask_donor_phone(text) from public;
revoke all on function private.donor_directory(uuid) from public;
grant usage on schema private to anon, authenticated;
grant execute on function private.donor_directory(uuid) to anon, authenticated;

create or replace function public.get_donor_profiles(target_user uuid default null)
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
security invoker
set search_path = ''
as $$
  select * from private.donor_directory(target_user)
$$;

revoke all on function public.get_donor_profiles(uuid) from public;
grant execute on function public.get_donor_profiles(uuid) to anon, authenticated;

comment on function public.get_donor_profiles(uuid) is
  'Returns the public donor directory contract. Email and raw contact fields are intentionally excluded.';
