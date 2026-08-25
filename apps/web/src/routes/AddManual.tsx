import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "../lib/supabase";
import { startManualEnrich } from "../lib/ingest";
import { useIngestJob } from "../hooks/useIngestJob";
import { useMembers } from "../hooks/useMembers";
import { useSession } from "../hooks/useSession";
import { DEV_SKIP_AUTH, DEV_HOUSEHOLD_ID } from "../lib/devMode";

export default function AddManual() {
  const navigate = useNavigate();
  const { members } = useMembers();
  const { session } = useSession();
  const currentMember = members.find((m) => m.user_id === session?.user.id);

  const [title, setTitle] = useState("");
  const [servings, setServings] = useState("");
  const [prepMinutes, setPrepMinutes] = useState("");
  const [cookMinutes, setCookMinutes] = useState("");
  const [ingredientLines, setIngredientLines] = useState([""]);
  const [steps, setSteps] = useState([""]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [jobId, setJobId] = useState<string | undefined>();

  const job = useIngestJob(jobId);

  // No fetch needed for the title here — the user just typed it themselves.
  useEffect(() => {
    if (job?.status !== "done" || !job.recipe_id) return;
    const timer = setTimeout(
      () => navigate(`/recipe/${job.recipe_id}`, { replace: true }),
      1600
    );
    return () => clearTimeout(timer);
  }, [job, navigate]);

  // Typing into the last (empty) row grows the list by one, so there's
  // always a trailing blank input ready for the next line.
  function updateLine(lines: string[], setLines: (v: string[]) => void, i: number, value: string) {
    const next = [...lines];
    next[i] = value;
    if (i === lines.length - 1 && value.trim()) next.push("");
    setLines(next);
  }

  async function handleSubmit() {
    setError(null);
    const cleanIngredients = ingredientLines.map((l) => l.trim()).filter(Boolean);
    const cleanSteps = steps.map((s) => s.trim()).filter(Boolean);

    if (!title.trim()) return setError("Give it a title.");
    if (cleanIngredients.length === 0) return setError("Add at least one ingredient.");
    if (cleanSteps.length === 0) return setError("Add at least one step.");

    setBusy(true);
    try {
      const { data: recipe, error: insertError } = await supabase
        .from("recipes")
        .insert({
          title: title.trim(),
          source_type: "manual",
          created_by: currentMember?.id ?? null,
          servings: servings ? Number(servings) : null,
          prep_minutes: prepMinutes ? Number(prepMinutes) : null,
          cook_minutes: cookMinutes ? Number(cookMinutes) : null,
          instructions: cleanSteps.map((text, i) => ({ step: i + 1, text, image_path: null })),
          ...(DEV_SKIP_AUTH ? { household_id: DEV_HOUSEHOLD_ID } : {}),
        })
        .select("id")
        .single();
      if (insertError || !recipe) throw insertError ?? new Error("Couldn't save the recipe");

      const id = await startManualEnrich(recipe.id, cleanIngredients);
      setJobId(id);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
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
        <p className="font-display text-[22px] text-ink">{title.trim()} is in the cookbook</p>
        <p className="font-mono text-xs text-muted underline">Open it now</p>
      </button>
    );
  }

  if (jobId && job?.status !== "error") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
        <p className="font-display text-[22px] text-ink">Saving…</p>
        <p className="font-mono text-sm text-muted">{job?.status_detail ?? "Starting…"}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-cream px-5 pb-10 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] text-ink">Type it out</h1>
        <Link to="/add" className="font-body text-sm text-muted">
          Cancel
        </Link>
      </div>

      {(error || job?.status === "error") && (
        <p className="mt-4 rounded-2xl bg-terracotta-tint px-4 py-3 font-body text-sm text-terracotta-text">
          {error ?? job?.error}
        </p>
      )}

      <p className="mt-6 font-mono text-[11px] uppercase tracking-wide text-muted">Title</p>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Grandma's biscuits"
        className="mt-2 w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-4 py-3 font-body text-[15px] text-ink placeholder:text-muted focus:outline-none"
      />

      <div className="mt-4 grid grid-cols-3 gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Servings</p>
          <input
            type="number"
            inputMode="numeric"
            value={servings}
            onChange={(e) => setServings(e.target.value)}
            className="mt-1 w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-3 py-2 font-body text-[15px] text-ink focus:outline-none"
          />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Prep min</p>
          <input
            type="number"
            inputMode="numeric"
            value={prepMinutes}
            onChange={(e) => setPrepMinutes(e.target.value)}
            className="mt-1 w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-3 py-2 font-body text-[15px] text-ink focus:outline-none"
          />
        </div>
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wide text-muted">Cook min</p>
          <input
            type="number"
            inputMode="numeric"
            value={cookMinutes}
            onChange={(e) => setCookMinutes(e.target.value)}
            className="mt-1 w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-3 py-2 font-body text-[15px] text-ink focus:outline-none"
          />
        </div>
      </div>

      <p className="mt-6 font-mono text-[11px] uppercase tracking-wide text-muted">
        Ingredients — one per line, however you'd naturally write it
      </p>
      {ingredientLines.map((line, i) => (
        <input
          key={i}
          type="text"
          value={line}
          onChange={(e) => updateLine(ingredientLines, setIngredientLines, i, e.target.value)}
          placeholder="2 cups flour, sifted"
          className="mt-2 w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-muted focus:outline-none"
        />
      ))}

      <p className="mt-6 font-mono text-[11px] uppercase tracking-wide text-muted">Steps</p>
      {steps.map((step, i) => (
        <div key={i} className="mt-2 flex gap-2">
          <span className="mt-2.5 w-5 shrink-0 font-mono text-[13px] text-terracotta">
            {i + 1}
          </span>
          <textarea
            value={step}
            onChange={(e) => updateLine(steps, setSteps, i, e.target.value)}
            rows={2}
            placeholder="Cream the butter and sugar until fluffy."
            className="w-full rounded-xl border-[1.5px] border-line/20 bg-cream-3 px-4 py-2.5 font-body text-[15px] text-ink placeholder:text-muted focus:outline-none"
          />
        </div>
      ))}

      <button
        type="button"
        onClick={handleSubmit}
        disabled={busy}
        className="mt-8 flex h-[60px] w-full items-center justify-center rounded-full bg-terracotta font-body text-[17px] font-semibold text-cream disabled:opacity-60"
      >
        {busy ? "Saving…" : "Save recipe"}
      </button>
    </div>
  );
}
