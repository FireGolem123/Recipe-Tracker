-- Realtime requires each table to be explicitly added to the
-- supabase_realtime publication — it's not automatic just because RLS
-- allows a SELECT. Without this, postgres_changes subscriptions silently
-- never fire: useIngestJob's realtime hook would sit waiting forever even
-- though the edge function is updating the row correctly server-side.
alter publication supabase_realtime add table ingest_jobs;
