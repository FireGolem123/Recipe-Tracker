-- TEMPORARY DEV-ONLY POLICIES — drop before this app goes further.
--
-- Google OAuth is paused during local UI development so the app can be
-- exercised without completing a real sign-in. RLS still blocks every
-- query for an unauthenticated (anon) request, so these add read-only
-- SELECT access for the anon role, scoped to the one seeded sample
-- household. Purely additive: the existing household_rw policies (which
-- require a real authenticated member) are untouched, so this changes
-- nothing about how an authenticated user's access works.
--
-- No insert/update/delete grant — writes (e.g. Log a Cook's save) will
-- still fail under this policy, which is expected while auth is paused.
--
-- Revert by dropping each policy below once Google OAuth is re-enabled:
--   drop policy dev_anon_read_households on households;
--   drop policy dev_anon_read_members on members;
--   drop policy dev_anon_read_recipes on recipes;
--   drop policy dev_anon_read_ingredients on ingredients;
--   drop policy dev_anon_read_cooks on cooks;
--   drop policy dev_anon_read_cook_ratings on cook_ratings;

create policy dev_anon_read_households on households
  for select to anon
  using (id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_read_members on members
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_read_recipes on recipes
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_read_ingredients on ingredients
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_read_cooks on cooks
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');

create policy dev_anon_read_cook_ratings on cook_ratings
  for select to anon
  using (household_id = '00000000-0000-0000-0000-000000000001');
