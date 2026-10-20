create extension if not exists pg_cron with schema pg_catalog;

create or replace function private.reset_expired_availability() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  update public.donor_availability set available=false where available and available_until is not null and available_until<=now();
  get diagnostics affected=row_count; return affected;
end $$;

create or replace function private.cleanup_expired_notifications() returns integer language plpgsql security definer set search_path='' as $$
declare affected integer;
begin
  delete from public.notifications where expires_at is not null and expires_at<now()-interval '7 days';
  get diagnostics affected=row_count; return affected;
end $$;

create or replace function private.snapshot_daily_metrics() returns void language plpgsql security definer set search_path='' as $$
begin
  insert into public.daily_operational_metrics(metric_date,requests_created,requests_fulfilled,requests_expired,requests_without_response,median_first_response_minutes,median_fulfillment_minutes,available_donors,pending_verifications,unresolved_reports)
  select current_date,
    count(*) filter(where br.created_at>=current_date),
    count(*) filter(where br.status='fulfilled' and br.updated_at>=current_date),
    count(*) filter(where br.status='expired' and br.updated_at>=current_date),
    count(*) filter(where br.status in('open','matched') and not exists(select 1 from public.request_responses rr where rr.request_id=br.id)),
    percentile_cont(.5) within group(order by extract(epoch from (first_response.created_at-br.created_at))/60),
    percentile_cont(.5) within group(order by extract(epoch from (br.updated_at-br.created_at))/60) filter(where br.status='fulfilled'),
    (select count(distinct da.user_id) from public.donor_availability da where da.available and (da.available_until is null or da.available_until>now())),
    (select count(*) from public.donor_verifications dv where dv.status='pending'),
    (select count(*) from public.reports r where r.status in('unreviewed','reviewing'))
  from public.blood_requests br
  left join lateral (select min(rr.created_at) created_at from public.request_responses rr where rr.request_id=br.id) first_response on true
  on conflict(metric_date) do update set requests_created=excluded.requests_created,requests_fulfilled=excluded.requests_fulfilled,requests_expired=excluded.requests_expired,requests_without_response=excluded.requests_without_response,median_first_response_minutes=excluded.median_first_response_minutes,median_fulfillment_minutes=excluded.median_fulfillment_minutes,available_donors=excluded.available_donors,pending_verifications=excluded.pending_verifications,unresolved_reports=excluded.unresolved_reports,created_at=now();

  insert into public.district_blood_supply_snapshots(snapshot_date,district,blood_group,available_donors,open_requests,supply_ratio)
  select current_date,dimensions.district,dimensions.blood_group,coalesce(s.available_donors,0),coalesce(d.open_requests,0),case when coalesce(d.open_requests,0)=0 then null else round(coalesce(s.available_donors,0)::numeric/d.open_requests,2) end
  from (select distinct district,blood_group from public.donor_profiles union select distinct district,blood_group from public.blood_requests) dimensions
  left join (select dp.district,dp.blood_group,count(distinct dp.user_id) available_donors from public.donor_profiles dp join public.donor_availability da on da.user_id=dp.user_id and da.available and (da.available_until is null or da.available_until>now()) group by 1,2) s using(district,blood_group)
  left join (select district,blood_group,count(*) open_requests from public.blood_requests where status in('open','matched') group by 1,2) d using(district,blood_group)
  on conflict(snapshot_date,district,blood_group) do update set available_donors=excluded.available_donors,open_requests=excluded.open_requests,supply_ratio=excluded.supply_ratio;
end $$;

select cron.schedule('hemora-expire-requests','*/15 * * * *',$$select public.expire_old_requests()$$);
select cron.schedule('hemora-reset-availability','5 * * * *',$$select private.reset_expired_availability()$$);
select cron.schedule('hemora-daily-metrics','15 0 * * *',$$select private.snapshot_daily_metrics()$$);
select cron.schedule('hemora-notification-cleanup','30 2 * * *',$$select private.cleanup_expired_notifications()$$);
