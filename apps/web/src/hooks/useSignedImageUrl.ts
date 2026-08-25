import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

const SIGNED_URL_TTL_SECONDS = 3600;

// recipe-images is a private bucket (no public sharing — see CLAUDE.md),
// so display always goes through a signed URL, never a plain public one.
// In-memory cache avoids re-signing the same path from every card/render.
const cache = new Map<string, string>();

export function useSignedImageUrl(path: string | null): string | null {
  const [url, setUrl] = useState<string | null>(path ? (cache.get(path) ?? null) : null);

  useEffect(() => {
    if (!path) {
      setUrl(null);
      return;
    }
    const cached = cache.get(path);
    if (cached) {
      setUrl(cached);
      return;
    }

    let cancelled = false;
    supabase.storage
      .from("recipe-images")
      .createSignedUrl(path, SIGNED_URL_TTL_SECONDS)
      .then(({ data }) => {
        if (cancelled || !data) return;
        cache.set(path, data.signedUrl);
        setUrl(data.signedUrl);
      });

    return () => {
      cancelled = true;
    };
  }, [path]);

  return url;
}
