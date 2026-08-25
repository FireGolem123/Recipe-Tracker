-- TEMPORARY DEV-ONLY — companion to 0002/0005/0006/0008, same revert plan.
-- Storage has its own RLS on storage.objects, separate from the table
-- policies — the original household_rw_recipe_images policy (0003) needs
-- my_household(), which is null for anon, so signed-URL generation was
-- silently failing (Storage returns 404, not 403, for an RLS-blocked
-- object — easy to mistake for a missing file).
--
-- Revert: drop policy dev_anon_read_recipe_images on storage.objects;

create policy dev_anon_read_recipe_images on storage.objects
  for select to anon
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1] = '00000000-0000-0000-0000-000000000001'
  );
