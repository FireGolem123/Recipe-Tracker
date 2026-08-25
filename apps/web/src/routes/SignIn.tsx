import { useEffect, useState } from "react";
import { signInWithGoogle } from "../lib/auth";

// GoTrue redirects back with ?error=... (or #error=...) when the
// reject_uninvited_signup trigger aborts the auth.users insert — see
// supabase/migrations/0001_init.sql. It doesn't reliably pass our custom
// Postgres exception message through, so this shows a generic explanation
// keyed off the mere presence of an error rather than its exact text.
function useOAuthError() {
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const raw = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.search.slice(1);
    const params = new URLSearchParams(raw);

    if (params.get("error")) {
      setError(
        "That Google account isn't part of this household yet. Ask whoever set up the app to add you as a member first."
      );
      window.history.replaceState(null, "", window.location.pathname);
    }
  }, []);

  return error;
}

export default function SignIn() {
  const error = useOAuthError();

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-cream px-6">
      <div className="w-full max-w-sm text-center">
        <h1 className="font-display text-3xl text-ink">Family Cookbook</h1>
        <p className="mt-2 font-body text-[15px] text-ink-2">
          Recipes the household has saved, and what everyone actually thought of them.
        </p>

        {error && (
          <p className="mt-6 rounded-2xl bg-terracotta-tint px-4 py-3 font-body text-sm text-terracotta-text">
            {error}
          </p>
        )}

        <button
          type="button"
          onClick={() => signInWithGoogle()}
          className="mt-8 flex w-full items-center justify-center gap-3 rounded-full border border-line/15 bg-cream-2 px-6 py-3.5 font-body text-[15px] font-medium text-ink transition hover:bg-cream-3"
        >
          <GoogleIcon />
          Continue with Google
        </button>
      </div>
    </main>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62Z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.96v2.33A9 9 0 0 0 9 18Z"
      />
      <path
        fill="#FBBC05"
        d="M3.95 10.7A5.4 5.4 0 0 1 3.67 9c0-.59.1-1.16.28-1.7V4.97H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.03l2.99-2.33Z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.46 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.97l2.99 2.33C4.66 5.17 6.65 3.58 9 3.58Z"
      />
    </svg>
  );
}
