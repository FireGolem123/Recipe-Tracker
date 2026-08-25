-- recipes and ingest_jobs are the two root-level tables where a client
-- insert has no parent row to derive household_id from (unlike
-- ingredients/cooks/etc, which get it from derive_household_from_* -
-- see 0001_init.sql). Without a default, every client insert has to
-- remember to set household_id explicitly — a real bug found while
-- wiring up the Add-a-recipe flow, where several insert calls simply
-- omitted it. A default closes that whole class of mistake.

alter table recipes alter column household_id set default my_household();
alter table ingest_jobs alter column household_id set default my_household();
