import { useNavigate } from "react-router-dom";

export default function SetupStep3() {
  const navigate = useNavigate();

  return (
    <div className="flex min-h-screen flex-col bg-cream px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="text-xl text-ink"
          aria-label="Back"
        >
          ←
        </button>
        <h1 className="font-display text-[25px] text-ink">Pin it in the share sheet</h1>
      </div>

      <p className="mt-3 font-body text-sm text-ink-2">
        The shortcut is installed — it's just buried. Move it to the front of the actions
        row once and it stays there.
      </p>

      <div className="mt-5 rounded-2xl bg-cream-2 p-4">
        <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
          What you'll see
        </p>
        <div className="mt-3 rounded-2xl bg-cream p-4">
          <p className="font-body text-[15px] font-semibold text-ink">Edit actions</p>

          <div className="mt-3 flex items-center gap-3 rounded-2xl border-[1.5px] border-terracotta px-3 py-3">
            <span className="text-muted">＋</span>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-terracotta font-display text-sm text-cream">
              C
            </span>
            <span className="flex-1 font-body text-[15px] font-semibold text-ink">
              Save to Cookbook
            </span>
            <span className="text-muted">☰</span>
          </div>

          {["Add to Reading List", "Print"].map((label) => (
            <div key={label} className="mt-2 flex items-center gap-3 px-3 py-3 opacity-50">
              <span className="text-muted">−</span>
              <span className="h-8 w-8 shrink-0 rounded-lg bg-placeholder" />
              <span className="flex-1 font-body text-[15px] text-ink">{label}</span>
              <span className="text-muted">☰</span>
            </div>
          ))}
        </div>

        <p className="mt-3 font-body text-sm text-ink-2">
          Drag <span className="font-semibold text-ink">Save to Cookbook</span> to the top
          using the ☰ handle, then tap Done.
        </p>
      </div>

      <div className="mt-4 rounded-2xl bg-sage-tint p-4">
        <p className="font-body text-sm text-sage-text">
          <span className="mr-1">✓</span>
          Test it now: open any reel, tap share, tap Save to Cookbook. It should land in
          the feed within a minute.
        </p>
      </div>

      <div className="flex-1" />

      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="h-[52px] w-24 shrink-0 rounded-full bg-cream-2 font-body text-[15px] text-ink"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => navigate("/setup")}
          className="h-[52px] flex-1 rounded-full bg-terracotta font-body text-[15px] font-semibold text-cream"
        >
          Done — it's working
        </button>
      </div>
    </div>
  );
}
