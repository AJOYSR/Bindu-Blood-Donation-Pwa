-- Public profile photos are separate from private verification documents.
insert into storage.buckets(id, name, public, file_size_limit, allowed_mime_types)
values ('profile-photos', 'profile-photos', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload own photo" on storage.objects for insert to authenticated
with check (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members read own photo objects" on storage.objects for select to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy "members delete own photo" on storage.objects for delete to authenticated
using (bucket_id = 'profile-photos' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- Reuse the existing directory's visibility and staff exclusions. Only the
-- explicit public summary and avatar path are exposed, never private contacts.
create function private.donor_directory_with_photos(target_user uuid default null)
returns setof jsonb language sql stable security definer set search_path = '' as $$
  select to_jsonb(d) || jsonb_build_object('avatar_path', p.avatar_path)
  from private.donor_directory(target_user) d
  join public.profiles p on p.id = d.user_id
$$;
revoke all on function private.donor_directory_with_photos(uuid) from public;
grant execute on function private.donor_directory_with_photos(uuid) to anon, authenticated;

create function public.get_donor_profiles_with_photos(target_user uuid default null)
returns setof jsonb language sql stable security invoker set search_path = '' as $$
  select * from private.donor_directory_with_photos(target_user)
$$;
revoke all on function public.get_donor_profiles_with_photos(uuid) from public;
grant execute on function public.get_donor_profiles_with_photos(uuid) to anon, authenticated;
