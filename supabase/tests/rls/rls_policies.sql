begin;
select plan(22);

-- Structural guarantees
select has_table('public','blood_requests','blood_requests exists');
select has_table('public','donor_private_contacts','private contact table exists');
select has_table('public','admin_audit_logs','audit table exists');
select has_table('public','contact_unlocks','contact unlocks exist');
select has_table('public','account_deletion_requests','deletion requests exist');
select has_table('public','operational_alerts','operational alerts exist');
select isnt_empty($$select 1 from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relname='blood_requests'$$,'blood_requests has RLS');
select isnt_empty($$select 1 from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relname='donor_private_contacts'$$,'private contacts have RLS');
select isnt_empty($$select 1 from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relname='admin_audit_logs'$$,'audit log has RLS');
select isnt_empty($$select 1 from pg_class where relnamespace='public'::regnamespace and relrowsecurity and relname='reports'$$,'reports have RLS');
select has_function('private','has_permission',array['text'],'permission helper exists');
select has_function('public','admin_set_request_status',array['uuid','request_status','text','text'],'audited admin RPC exists');
select has_function('public','my_permissions',array[]::text[],'my_permissions helper exists');
select has_function('public','admin_overview_metrics',array[]::text[],'overview metrics RPC exists');
select has_function('public','consent_contact_unlock',array['uuid','uuid'],'contact unlock RPC exists');
select has_function('public','export_my_data',array[]::text[],'export RPC exists');
select has_function('public','check_rate_limit',array['text','integer','integer'],'rate limit helper exists');

-- Deny grants: anon and authenticated must not freely access sensitive tables
select ok(not has_table_privilege('anon','public.donor_private_contacts','SELECT'),'anon cannot read private contacts');
select ok(not has_table_privilege('anon','public.admin_audit_logs','SELECT'),'anon cannot read audit logs');
select ok(not has_table_privilege('authenticated','public.admin_audit_logs','INSERT'),'clients cannot append audit entries directly');
select ok(not has_table_privilege('authenticated','public.rate_limit_events','SELECT'),'clients cannot read rate-limit events');
select ok(has_function_privilege('authenticated','public.my_permissions()','EXECUTE'),'authenticated can call my_permissions');

select * from finish();
rollback;
