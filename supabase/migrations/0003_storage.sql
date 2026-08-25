-- recipe-images bucket: hero photos (from ingest) and, later, step/frame
-- images. Private bucket — this app has no public sharing — so images are
-- read via signed URLs, not public URLs. Path convention is
-- {household_id}/{recipe_id}/{filename}; RLS checks only the first path
-- segment, reusing my_household() like every other table.

insert into storage.buckets (id, name, public)
values ('recipe-images', 'recipe-images', false)
on conflict (id) do nothing;

create policy household_rw_recipe_images on storage.objects
  for all
  using (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1]::uuid = my_household()
  )
  with check (
    bucket_id = 'recipe-images'
    and (storage.foldername(name))[1]::uuid = my_household()
  );
