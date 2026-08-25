import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { startWebIngest, startPhotoIngest } from "../lib/ingest";
import { downscaleToWebP, blobToBase64 } from "../lib/image";
import { useIngestJob } from "../hooks/useIngestJob";
import { supabase } from "../lib/supabase";

const AUTO_NAVIGATE_MS = 1600;

export default function Add() {
  const navigate = useNavigate();
  const [url, setUrl] = useState("");
  const [jobId, setJobId] = useState<string | undefined>();
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [doneTitle, setDoneTitle] = useState<string | null>(null);

  const job = useIngestJob(jobId);

  // Fetch the title once so "X is in the cookbook" can name it, then give
  // the moment a beat before moving on — a straight-to-detail redirect
  // reads as if nothing happened.
  useEffect(() => {
    if (job?.status !== "done" || !job.recipe_id) return;
    let cancelled = false;

    supabase
      .from("recipes")
      .select("title")
      .eq("id", job.recipe_id)
      .single()
      .then(({ data }) => {
        if (cancelled) return;
        setDoneTitle(data?.title ?? "Your recipe");
      });

    const timer = setTimeout(() => navigate(`/recipe/${job.recipe_id}`, { replace: true }), AUTO_NAVIGATE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [job, navigate]);

  async function handleUrlSubmit() {
    if (!url.trim()) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const id = await startWebIngest(url.trim());
      setJobId(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't start that.");
    } finally {
      setBusy(false);
    }
  }

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setSubmitError(null);
    try {
      const webp = await downscaleToWebP(file);
      const base64 = await blobToBase64(webp);
      const id = await startPhotoIngest(base64);
      setJobId(id);
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Couldn't read that photo.");
    } finally {
      setBusy(false);
    }
  }

  if (job?.status === "done" && job.recipe_id) {
    return (
      <button
        type="button"
        onClick={() => navigate(`/recipe/${job.recipe_id}`, { replace: true })}
        className="flex min-h-screen w-full flex-col items-center justify-center gap-3 bg-cream px-6 text-center"
      >
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-sage-tint text-2xl text-sage-text">
          ✓
        </div>
        <p className="font-display text-[22px] text-ink">
          {doneTitle ?? "Your recipe"} is in the cookbook
        </p>
        <p className="font-mono text-xs text-muted underline">Open it now</p>
      </button>
    );
  }

  if (jobId && job?.status !== "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <p className="font-display text-[22px] text-ink">Getting the recipe…</p>
        <p className="font-mono text-sm text-muted">{job?.status_detail ?? "Starting…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-5 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] text-ink">Add a recipe</h1>
        <Link to="/" className="font-body text-sm text-muted">
          Cancel
        </Link>
      </div>

      {(submitError || job?.status === "error") && (
        <div className="mt-4 rounded-2xl bg-terracotta-tint px-4 py-3 font-body text-sm text-terracotta-text">
          <p>Couldn't get that one: {submitError ?? job?.error}</p>
          <p className="mt-1">
            <Link to="/add/manual" className="underline">
              Type it in instead
            </Link>
          </p>
        </div>
      )}

      <p className="mt-6 font-mono text-[11px] uppercase tracking-wide text-muted">
        Paste a link
      </p>
      <textarea
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://..."
        rows={3}
        className="mt-2 w-full rounded-2xl border-[1.5px] border-line/20 bg-cream-3 p-4 font-body text-[15px] text-ink placeholder:text-muted focus:outline-none"
      />
      <button
        type="button"
        onClick={handleUrlSubmit}
        disabled={busy || !url.trim()}
        className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full bg-terracotta font-body text-[16px] font-semibold text-cream disabled:opacity-60"
      >
        {busy ? "Working…" : "Get the recipe"}
      </button>

      <div className="mt-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-line/15" />
        <span className="font-mono text-[10px] uppercase tracking-wide text-muted">or</span>
        <div className="h-px flex-1 bg-line/15" />
      </div>

      <label className="mt-6 flex h-[52px] w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-cream-2 font-body text-[15px] text-ink">
        <input
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={handlePhoto}
          disabled={busy}
        />
        📷 Photo of a recipe card
      </label>

      <Link
        to="/add/manual"
        className="mt-3 flex h-[52px] w-full items-center justify-center rounded-full font-body text-[15px] text-ink-2 underline"
      >
        Type it out myself
      </Link>
    </div>
  );
}
