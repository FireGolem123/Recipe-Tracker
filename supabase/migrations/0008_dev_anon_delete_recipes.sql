-- TEMPORARY DEV-ONLY — companion to 0002/0005/0006, same revert plan.
-- Lets anon delete recipes in the sample household while auth is paused.
-- Child rows (ingredients/cooks/etc) cascade via the FK ON DELETE CASCADE
-- in 0001_init.sql, which doesn't need its own RLS policy — cascade
-- deletes aren't a separate client-issued DELETE subject to RLS.
--
-- Revert: drop policy dev_anon_delete_recipes on recipes;

create policy dev_anon_delete_recipes on recipes
  for delete to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');
