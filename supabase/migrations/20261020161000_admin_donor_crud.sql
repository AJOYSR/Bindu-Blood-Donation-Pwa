-- Admin donor CRUD: list / view / create / update / soft-delete.
-- Mutations require donor.review and admin_assured (super_admin or AAL2).
-- Blood group and donation_count changes must include a reason and are audited.

create or replace function private.require_donor_admin()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null or not private.has_permission('donor.review') then
    raise exception 'permission denied' using errcode = '42501';
  end if;
  if not private.admin_assured() then
    raise exception 'MFA assurance level 2 required' using errcode = '42501';
  end if;
end $$;
revoke all on function private.require_donor_admin() from public, anon, authenticated;

create or replace function public.admin_list_donors(page_limit integer default 100)
returns table (
  user_id uuid,
  display_name text,
  email text,
  phone text,
  blood_group public.blood_group,
  district text,
  area text,
  verification_status public.verification_status,
  searchable boolean,
  available boolean,
  last_donation_date date,
  donation_count integer,
  response_rate integer,
  birth_year smallint,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_donor_admin();
  return query
  select
    dp.user_id,
    p.display_name,
    coalesce(dpc.email, u.email) as email,
    dpc.phone,
    dp.blood_group,
    dp.district,
    dp.area,
    dp.verification_status,
    dp.searchable,
    coalesce(da.available and (da.available_until is null or da.available_until > now()), false) as available,
    dp.last_donation_date,
    dp.donation_count,
    case when dp.response_count > 0
      then round(dp.accepted_count::numeric / dp.response_count * 100)::integer
      else 100
    end as response_rate,
    dp.birth_year,
    dp.updated_at
  from public.donor_profiles dp
  join public.profiles p on p.id = dp.user_id
  left join public.donor_private_contacts dpc on dpc.user_id = dp.user_id
  left join auth.users u on u.id = dp.user_id
  left join lateral (
    select availability.available, availability.available_until
    from public.donor_availability availability
    where availability.user_id = dp.user_id
    order by availability.created_at desc
    limit 1
  ) da on true
  where not private.is_staff_account(dp.user_id)
  order by dp.updated_at desc
  limit greatest(1, least(coalesce(page_limit, 100), 200));
end $$;
revoke all on function public.admin_list_donors(integer) from public, anon;
grant execute on function public.admin_list_donors(integer) to authenticated;

create or replace function public.admin_get_donor(target_user uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result jsonb;
begin
  perform private.require_donor_admin();
  if target_user is null then raise exception 'Donor id required' using errcode = '22023'; end if;
  if private.is_staff_account(target_user) then
    raise exception 'Staff accounts are not managed as donors' using errcode = '42501';
  end if;

  select jsonb_build_object(
    'user_id', dp.user_id,
    'display_name', p.display_name,
    'email', coalesce(dpc.email, u.email),
    'phone', dpc.phone,
    'blood_group', dp.blood_group,
    'district', dp.district,
    'area', dp.area,
    'birth_year', dp.birth_year,
    'verification_status', dp.verification_status,
    'searchable', dp.searchable,
    'last_donation_date', dp.last_donation_date,
    'donation_count', dp.donation_count,
    'response_count', dp.response_count,
    'accepted_count', dp.accepted_count,
    'response_rate', case when dp.response_count > 0
      then round(dp.accepted_count::numeric / dp.response_count * 100)::integer
      else 100 end,
    'available', coalesce(da.available and (da.available_until is null or da.available_until > now()), false),
    'available_until', da.available_until,
    'created_at', dp.created_at,
    'updated_at', dp.updated_at
  ) into result
  from public.donor_profiles dp
  join public.profiles p on p.id = dp.user_id
  left join public.donor_private_contacts dpc on dpc.user_id = dp.user_id
  left join auth.users u on u.id = dp.user_id
  left join lateral (
    select availability.available, availability.available_until
    from public.donor_availability availability
    where availability.user_id = dp.user_id
    order by availability.created_at desc
    limit 1
  ) da on true
  where dp.user_id = target_user;

  if result is null then raise exception 'Donor not found' using errcode = 'P0002'; end if;
  return result;
end $$;
revoke all on function public.admin_get_donor(uuid) from public, anon;
grant execute on function public.admin_get_donor(uuid) to authenticated;

-- Create a donor from an existing member email, or create a new Auth user + donor profile.
create or replace function public.admin_create_donor(
  donor_email text,
  donor_display_name text,
  donor_blood_group public.blood_group,
  donor_district text,
  donor_area text,
  donor_phone text default null,
  donor_searchable boolean default true,
  donor_last_donation date default null,
  donor_birth_year smallint default null,
  create_reason text default 'Donor profile created by administrator'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid;
  normalized_email text := lower(trim(donor_email));
  temp_password text;
  created_auth boolean := false;
begin
  perform private.require_donor_admin();
  if char_length(trim(create_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode = '22023'; end if;
  if normalized_email is null or normalized_email !~ '^[^@]+@[^@]+\.[^@]+$' then
    raise exception 'A valid email is required' using errcode = '22023';
  end if;
  if char_length(trim(donor_display_name)) < 2 then raise exception 'Display name is required' using errcode = '22023'; end if;
  if char_length(trim(donor_district)) < 2 or char_length(trim(donor_area)) < 2 then
    raise exception 'District and area are required' using errcode = '22023';
  end if;

  select u.id into uid from auth.users u where lower(u.email) = normalized_email limit 1;

  if uid is null then
    uid := gen_random_uuid();
    temp_password := substr(replace(gen_random_uuid()::text || gen_random_uuid()::text, '-', ''), 1, 24);
    insert into auth.users (
      instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
      confirmation_token, recovery_token, email_change_token_new, email_change
    ) values (
      '00000000-0000-0000-0000-000000000000',
      uid,
      'authenticated',
      'authenticated',
      normalized_email,
      public.crypt(temp_password, public.gen_salt('bf')),
      now(),
      jsonb_build_object('provider', 'email', 'providers', array['email'], 'hemora_role', 'member', 'created_by_admin', true),
      jsonb_build_object('display_name', trim(donor_display_name)),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );
    insert into auth.identities (
      id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
    ) values (
      gen_random_uuid(),
      uid,
      jsonb_build_object('sub', uid::text, 'email', normalized_email, 'email_verified', true),
      'email',
      uid::text,
      now(),
      now(),
      now()
    );
    created_auth := true;
  end if;

  if private.is_staff_account(uid) then
    raise exception 'Staff accounts cannot be managed as donors' using errcode = '42501';
  end if;

  insert into public.profiles(id, display_name, district)
  values (uid, trim(donor_display_name), trim(donor_district))
  on conflict (id) do update
    set display_name = excluded.display_name,
        district = excluded.district;

  insert into public.user_roles(user_id, role, assigned_by)
  values (uid, 'member', (select auth.uid()))
  on conflict do nothing;

  insert into public.donor_profiles(
    user_id, blood_group, district, area, birth_year, searchable, last_donation_date, verification_status
  ) values (
    uid, donor_blood_group, trim(donor_district), trim(donor_area), donor_birth_year,
    coalesce(donor_searchable, true) and not private.is_staff_account(uid),
    donor_last_donation, 'unverified'
  )
  on conflict (user_id) do update
    set blood_group = excluded.blood_group,
        district = excluded.district,
        area = excluded.area,
        birth_year = coalesce(excluded.birth_year, public.donor_profiles.birth_year),
        searchable = excluded.searchable,
        last_donation_date = coalesce(excluded.last_donation_date, public.donor_profiles.last_donation_date),
        updated_at = now();

  insert into public.donor_private_contacts(user_id, phone, email)
  values (uid, nullif(trim(donor_phone), ''), normalized_email)
  on conflict (user_id) do update
    set phone = coalesce(excluded.phone, public.donor_private_contacts.phone),
        email = excluded.email,
        updated_at = now();

  insert into public.contact_preferences(user_id, allow_phone, allow_email, require_mutual_consent)
  values (uid, donor_phone is not null and length(trim(donor_phone)) > 0, true, true)
  on conflict (user_id) do nothing;

  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, new_value)
  values (
    (select auth.uid()),
    'donor.created',
    'donor',
    uid::text,
    trim(create_reason),
    jsonb_build_object(
      'email', normalized_email,
      'display_name', trim(donor_display_name),
      'blood_group', donor_blood_group,
      'district', trim(donor_district),
      'area', trim(donor_area),
      'searchable', coalesce(donor_searchable, true),
      'created_auth_user', created_auth
    )
  );

  return jsonb_build_object(
    'user_id', uid,
    'email', normalized_email,
    'created_auth_user', created_auth,
    'temporary_password', case when created_auth then temp_password else null end
  );
end $$;
revoke all on function public.admin_create_donor(text,text,public.blood_group,text,text,text,boolean,date,smallint,text) from public, anon;
grant execute on function public.admin_create_donor(text,text,public.blood_group,text,text,text,boolean,date,smallint,text) to authenticated;

create or replace function public.admin_update_donor(
  target_user uuid,
  donor_display_name text,
  donor_blood_group public.blood_group,
  donor_district text,
  donor_area text,
  donor_phone text default null,
  donor_searchable boolean default null,
  donor_last_donation date default null,
  donor_birth_year smallint default null,
  donor_available boolean default null,
  change_reason text default 'Donor profile updated by administrator'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  old_dp public.donor_profiles;
  old_name text;
  old_phone text;
begin
  perform private.require_donor_admin();
  if char_length(trim(change_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode = '22023'; end if;
  if private.is_staff_account(target_user) then
    raise exception 'Staff accounts cannot be managed as donors' using errcode = '42501';
  end if;

  select * into old_dp from public.donor_profiles where user_id = target_user for update;
  if not found then raise exception 'Donor not found' using errcode = 'P0002'; end if;
  select display_name into old_name from public.profiles where id = target_user;
  select phone into old_phone from public.donor_private_contacts where user_id = target_user;

  update public.profiles
    set display_name = trim(donor_display_name),
        district = trim(donor_district)
  where id = target_user;

  update public.donor_profiles
    set blood_group = donor_blood_group,
        district = trim(donor_district),
        area = trim(donor_area),
        birth_year = coalesce(donor_birth_year, birth_year),
        searchable = case when donor_searchable is null then searchable else donor_searchable and not private.is_staff_account(target_user) end,
        last_donation_date = case when donor_last_donation is null then last_donation_date else donor_last_donation end,
        updated_at = now()
  where user_id = target_user;

  insert into public.donor_private_contacts(user_id, phone, email)
  values (target_user, nullif(trim(coalesce(donor_phone, '')), ''), null)
  on conflict (user_id) do update
    set phone = coalesce(nullif(trim(coalesce(donor_phone, '')), ''), public.donor_private_contacts.phone),
        updated_at = now();

  if donor_available is not null then
    insert into public.donor_availability(user_id, available, available_until)
    values (
      target_user,
      donor_available,
      case when donor_available then now() + interval '7 days' else null end
    );
  end if;

  if old_dp.blood_group is distinct from donor_blood_group then
    insert into public.donor_status_history(user_id, from_status, to_status, reason, changed_by)
    values (target_user, old_dp.blood_group::text, donor_blood_group::text, 'blood_group_changed: ' || trim(change_reason), (select auth.uid()));
  end if;

  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, previous_value, new_value)
  values (
    (select auth.uid()),
    'donor.updated',
    'donor',
    target_user::text,
    trim(change_reason),
    jsonb_build_object(
      'display_name', old_name,
      'blood_group', old_dp.blood_group,
      'district', old_dp.district,
      'area', old_dp.area,
      'searchable', old_dp.searchable,
      'phone', old_phone,
      'last_donation_date', old_dp.last_donation_date
    ),
    jsonb_build_object(
      'display_name', trim(donor_display_name),
      'blood_group', donor_blood_group,
      'district', trim(donor_district),
      'area', trim(donor_area),
      'searchable', coalesce(donor_searchable, old_dp.searchable),
      'phone', nullif(trim(coalesce(donor_phone, '')), ''),
      'last_donation_date', coalesce(donor_last_donation, old_dp.last_donation_date),
      'available', donor_available
    )
  );
  return true;
end $$;
revoke all on function public.admin_update_donor(uuid,text,public.blood_group,text,text,text,boolean,date,smallint,boolean,text) from public, anon;
grant execute on function public.admin_update_donor(uuid,text,public.blood_group,text,text,text,boolean,date,smallint,boolean,text) to authenticated;

-- Soft-delete: hide from directory, pause availability, keep audit trail. Does not wipe Auth.
create or replace function public.admin_delete_donor(target_user uuid, delete_reason text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare old_dp public.donor_profiles;
begin
  perform private.require_donor_admin();
  if char_length(trim(delete_reason)) < 5 then raise exception 'A meaningful reason is required' using errcode = '22023'; end if;
  if private.is_staff_account(target_user) then
    raise exception 'Staff accounts cannot be managed as donors' using errcode = '42501';
  end if;

  select * into old_dp from public.donor_profiles where user_id = target_user for update;
  if not found then raise exception 'Donor not found' using errcode = 'P0002'; end if;

  update public.donor_profiles set searchable = false, updated_at = now() where user_id = target_user;
  insert into public.donor_availability(user_id, available, available_until)
  values (target_user, false, null);
  insert into public.donor_status_history(user_id, from_status, to_status, reason, changed_by)
  values (target_user, 'active', 'removed', trim(delete_reason), (select auth.uid()));
  insert into public.admin_audit_logs(actor_id, action, entity_type, entity_id, reason, previous_value, new_value)
  values (
    (select auth.uid()),
    'donor.deleted',
    'donor',
    target_user::text,
    trim(delete_reason),
    to_jsonb(old_dp) - 'exact_location',
    jsonb_build_object('searchable', false, 'available', false)
  );
  return true;
end $$;
revoke all on function public.admin_delete_donor(uuid,text) from public, anon;
grant execute on function public.admin_delete_donor(uuid,text) to authenticated;
