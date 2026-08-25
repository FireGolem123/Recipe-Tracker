import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useRecipe } from "../hooks/useRecipe";

// The schema has no per-step ingredient/duration association (instructions
// are just {step, text, image_path}). Rather than leave the chips/timer
// empty, match against the step's own text — works well for well-written
// steps, degrades to "nothing shown" otherwise.
function ingredientsForStep(stepText: string, items: string[]): string[] {
  const lower = stepText.toLowerCase();
  return items.filter((item) => {
    // Match on significant words, not the whole item string — an
    // ingredient like "broccoli florets" should still match a step that
    // just says "toss the broccoli", not only an exact-phrase mention.
    const words = item.toLowerCase().split(/\s+/).filter((w) => w.length > 3);
    return words.some((w) => lower.includes(w));
  });
}

function minutesInStep(stepText: string): number | null {
  const match = stepText.match(/(\d+)(?:-(\d+))?\s*min/i);
  if (!match) return null;
  return Number(match[2] ?? match[1]);
}

export default function CookMode() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, ingredients, loading } = useRecipe(id);
  const [stepIndex, setStepIndex] = useState(0);
  const [timerSeconds, setTimerSeconds] = useState<number | null>(null);

  useEffect(() => {
    let sentinel: WakeLockSentinel | null = null;
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((s) => (sentinel = s)).catch(() => {});
    }
    return () => {
      sentinel?.release().catch(() => {});
    };
  }, []);

  useEffect(() => {
    if (timerSeconds === null || timerSeconds <= 0) return;
    const t = setTimeout(() => setTimerSeconds((s) => (s ?? 0) - 1), 1000);
    return () => clearTimeout(t);
  }, [timerSeconds]);

  const itemNames = useMemo(() => ingredients.map((i) => i.item), [ingredients]);

  if (loading || !recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="font-body text-sm text-cream/60">Loading…</p>
      </div>
    );
  }

  const steps = recipe.instructions;
  const step = steps[stepIndex];

  if (!step) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-ink">
        <p className="font-body text-sm text-cream/60">This recipe has no steps yet.</p>
      </div>
    );
  }

  const isLastStep = stepIndex === steps.length - 1;
  const stepMinutes = minutesInStep(step.text);
  const stepIngredients = ingredientsForStep(step.text, itemNames);

  function startTimer() {
    if (stepMinutes) setTimerSeconds(stepMinutes * 60);
  }

  function goNext() {
    if (isLastStep) {
      // replace, not push — otherwise Back from the recipe page (after
      // Log a Cook saves and navigates away) lands back in cook mode.
      navigate(`/recipe/${recipe!.id}/log`, { replace: true });
    } else {
      setStepIndex((i) => i + 1);
      setTimerSeconds(null);
    }
  }

  function goBack() {
    setStepIndex((i) => Math.max(0, i - 1));
    setTimerSeconds(null);
  }

  const timerLabel =
    timerSeconds === null
      ? stepMinutes
        ? `⏱ Start ${stepMinutes} min timer`
        : null
      : timerSeconds > 0
        ? `⏱ ${Math.floor(timerSeconds / 60)}:${String(timerSeconds % 60).padStart(2, "0")}`
        : "⏱ Time's up";

  return (
    <div className="flex min-h-screen flex-col bg-ink px-6 pt-6 text-cream">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono text-[11px] uppercase tracking-wide text-cream/60">
            {recipe.title}
          </p>
          <p className="font-body text-[15px] text-cream">
            Step {stepIndex + 1} of {steps.length}
          </p>
        </div>
        <button
          type="button"
          onClick={() => navigate(`/recipe/${recipe.id}`, { replace: true })}
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-cream/10 text-xl text-cream"
          aria-label="Close cook mode"
        >
          ✕
        </button>
      </div>

      <div className="mt-4 flex gap-1.5">
        {steps.map((s, i) => (
          <div
            key={s.step}
            className={`h-[5px] flex-1 rounded-full ${i <= stepIndex ? "bg-terracotta" : "bg-cream/16"}`}
          />
        ))}
      </div>

      <p
        className="mt-8 font-display text-[40px] leading-[1.2] text-cream"
        style={{ textWrap: "pretty" }}
      >
        {step.text}
      </p>

      {stepIngredients.length > 0 && (
        <div className="mt-6 flex flex-wrap gap-2">
          {stepIngredients.map((item) => (
            <span
              key={item}
              className="rounded-[12px] bg-cream/9 px-[15px] py-[10px] font-body text-[16px] text-cream"
            >
              {item}
            </span>
          ))}
        </div>
      )}

      <div className="flex-1" />

      {timerLabel && (
        <button
          type="button"
          onClick={startTimer}
          disabled={timerSeconds !== null && timerSeconds > 0}
          className="mb-4 flex h-16 items-center justify-center rounded-full border border-cream/30 font-body text-[15px] text-cream"
        >
          {timerLabel}
        </button>
      )}

      <div className="mb-6 flex gap-3">
        <button
          type="button"
          onClick={goBack}
          disabled={stepIndex === 0}
          className="h-[92px] w-[104px] shrink-0 rounded-[20px] bg-cream/10 text-2xl text-cream disabled:opacity-30"
          aria-label="Previous step"
        >
          ←
        </button>
        <button
          type="button"
          onClick={goNext}
          className="h-[92px] flex-1 rounded-[20px] bg-terracotta font-body text-[26px] text-cream"
        >
          {isLastStep ? "Done — log it" : "Next step"}
        </button>
      </div>
    </div>
  );
}
