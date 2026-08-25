import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

const STORAGE_KEY = "cookbook:setup-steps";

interface StepDef {
  title: string;
  body: string;
  meta: string;
}

const STEPS: StepDef[] = [
  {
    title: "Put the cookbook on your Home Screen",
    body: "Open the cookbook in Safari, tap Share, then Add to Home Screen. It opens full-screen like an app and stays signed in.",
    meta: "Safari · once per phone",
  },
  {
    title: 'Install the "Save to Cookbook" shortcut',
    body: "Tap the setup link below. Shortcuts opens, you tap Add Shortcut. It accepts a URL and hands it to the cookbook.",
    meta: "Shortcuts app · one tap",
  },
  {
    title: "Pin it in the share sheet",
    body: "In TikTok or Instagram, tap Share, scroll to the bottom of the actions row, tap Edit Actions, and drag Save to Cookbook to the top.",
    meta: "Any app · makes it one tap forever",
  },
];

function loadDone(): boolean[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore corrupt/missing local storage — falls through to the default below
  }
  return [false, false, false];
}

export default function Setup() {
  const [done, setDone] = useState<boolean[]>(loadDone);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(done));
  }, [done]);

  const doneCount = done.filter(Boolean).length;

  function toggle(i: number) {
    setDone((prev) => prev.map((v, idx) => (idx === i ? !v : v)));
  }

  return (
    <div className="min-h-screen bg-cream px-5 pb-10 pt-6">
      <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-muted">
        Three minutes, once
      </p>
      <h1 className="mt-1 font-display text-[30px] leading-tight text-ink">
        Set up sharing on this phone
      </h1>
      <p className="mt-3 font-body text-sm text-ink-2">
        After this, saving a recipe is: tap share, tap the cookbook. That's the whole thing.
      </p>

      <div className="mt-5 flex items-center gap-3">
        <div className="h-[5px] flex-1 rounded-full bg-placeholder">
          <div
            className="h-[5px] rounded-full bg-sage transition-all"
            style={{ width: `${(doneCount / STEPS.length) * 100}%` }}
          />
        </div>
        <span className="whitespace-nowrap font-mono text-xs text-muted">
          {doneCount} of {STEPS.length} done
        </span>
      </div>

      <div className="mt-5 flex flex-col gap-3">
        {STEPS.map((step, i) => (
          <button
            key={step.title}
            type="button"
            onClick={() => (i === 2 ? undefined : toggle(i))}
            className={`rounded-[18px] p-4 text-left transition-colors ${
              done[i] ? "bg-[#F4EFE4]" : "bg-cream-2"
            }`}
          >
            <div className="flex items-start gap-3">
              <div
                className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full font-body text-sm ${
                  done[i] ? "bg-sage text-cream" : "bg-placeholder text-ink"
                }`}
              >
                {done[i] ? "✓" : i + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-body text-[15px] font-semibold text-ink">{step.title}</p>
                <p className="mt-1 font-body text-[13px] text-ink-2">{step.body}</p>
                <p className="mt-2 font-mono text-[10px] text-muted">{step.meta}</p>
                {i === 2 && (
                  <Link
                    to="/setup/step-3"
                    className="mt-2 inline-block font-mono text-[10px] text-terracotta underline"
                  >
                    Show me what this looks like →
                  </Link>
                )}
              </div>
            </div>
          </button>
        ))}
      </div>

      {/* The shortcut file itself is Phase 4 (video ingest) — not built yet,
          so this is disabled rather than linking to something that doesn't exist. */}
      <button
        type="button"
        disabled
        className="mt-6 flex h-[60px] w-full items-center justify-center rounded-full bg-terracotta font-body text-[17px] font-semibold text-cream opacity-40"
      >
        Install the shortcut
      </button>
      <p className="mt-2 text-center font-mono text-[10px] text-muted">
        Coming with video sharing — not available yet
      </p>
      <p className="mt-4 text-center font-mono text-[10px] text-muted">
        Android? It just works — skip all of this.
      </p>
    </div>
  );
}
