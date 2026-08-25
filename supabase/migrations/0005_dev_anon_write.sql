-- TEMPORARY DEV-ONLY — companion to 0002_dev_anon_read.sql, same reason
-- (Google OAuth paused for local UI dev) and same revert plan: drop these
-- three policies once auth is back.
--
-- The new household_id defaults (0004) resolve to null for anon (no
-- session to derive from), so the client explicitly passes the sample
-- household id when DEV_SKIP_AUTH is on — see apps/web/src/lib/devMode.ts.
-- These policies just let that explicit insert through.
--
-- Revert:
--   drop policy dev_anon_write_ingest_jobs on ingest_jobs;
--   drop policy dev_anon_write_recipes on recipes;
--   drop policy dev_anon_write_ingredients on ingredients;

create policy dev_anon_write_ingest_jobs on ingest_jobs
  for insert to anon
  with check (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_write_recipes on recipes
  for insert to anon
  with check (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_write_ingredients on ingredients
  for insert to anon
  with check (household_id = '00000000-0000-0000-0000-000000000001');
