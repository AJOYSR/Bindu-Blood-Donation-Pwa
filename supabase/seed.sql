-- Auth-backed fixtures are seeded by `npm run seed`.
--
-- A plain SQL seed cannot safely read SUPER_ADMIN_EMAIL or
-- SUPER_ADMIN_PASSWORD from .env. The server-only seed runner creates Auth
-- users through the supported Admin API first, then fills every public table
-- in foreign-key order. Keeping this file makes `supabase db reset` explicit
-- and prevents credentials from being embedded in SQL or migration history.
select 'Run npm run seed after the local Supabase stack is ready.' as seed_instruction;
