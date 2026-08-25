import { supabase } from "./supabase";

export function signInWithGoogle() {
  return supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: window.location.origin },
  });
}

export function signOut() {
  return supabase.auth.signOut();
}
