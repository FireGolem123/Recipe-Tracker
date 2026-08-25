// TEMPORARY: paired with VITE_DEV_SKIP_AUTH and
// supabase/migrations/0005_dev_anon_write.sql. household_id normally
// defaults to my_household() server-side (0004), which resolves to null
// for an unauthenticated anon request — so while auth is paused, writes
// need to pass it explicitly. Remove alongside the auth bypass.
export const DEV_SKIP_AUTH = import.meta.env.VITE_DEV_SKIP_AUTH === "true";
export const DEV_HOUSEHOLD_ID = "00000000-0000-0000-0000-000000000001";
