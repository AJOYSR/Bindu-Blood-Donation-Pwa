grant insert on public.donor_verifications to authenticated;
create policy "users submit own verification" on public.donor_verifications for insert to authenticated
with check(user_id=(select auth.uid()) and status='pending' and reviewer_id is null and reviewed_at is null);
