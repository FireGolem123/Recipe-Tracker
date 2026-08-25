-- TEMPORARY DEV-ONLY — companion to 0002/0005, same revert plan.
--
-- Missed this table in 0002_dev_anon_read.sql. Needed for two things:
-- (1) insert(...).select().single() requires SELECT permission on the
-- just-inserted row for RETURNING to work, not just the INSERT policy's
-- WITH CHECK — so job creation itself was failing without this.
-- (2) the realtime status-narration hook (useIngestJob) subscribes to
-- postgres_changes on this table, which also needs SELECT.
--
-- Revert: drop policy dev_anon_read_ingest_jobs on ingest_jobs;

create policy dev_anon_read_ingest_jobs on ingest_jobs
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');
