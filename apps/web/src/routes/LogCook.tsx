import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRecipe } from "../hooks/useRecipe";
import { useMembers } from "../hooks/useMembers";
import { useSession } from "../hooks/useSession";
import { supabase } from "../lib/supabase";
import { AvatarCircle } from "../components/AvatarCircle";

type DateOption = "tonight" | "yesterday" | "custom";

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return `${n}${s[(v - 20) % 10] ?? s[v] ?? s[0]}`;
}

export default function LogCook() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, cookHistory, loading } = useRecipe(id);
  const { members } = useMembers();
  const { session } = useSession();

  const [dateOption, setDateOption] = useState<DateOption>("tonight");
  const [customDate, setCustomDate] = useState("");
  const [photoPreviews, setPhotoPreviews] = useState<string[]>([]);
  const [activeMemberId, setActiveMemberId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [tweaks, setTweaks] = useState("");
  const [saving, setSaving] = useState(false);

  const currentMember = members.find((m) => m.user_id === session?.user.id);
  const activeMember = members.find((m) => m.id === activeMemberId) ?? null;

  const cookedOn = useMemo(() => {
    const d = new Date();
    if (dateOption === "yesterday") d.setDate(d.getDate() - 1);
    if (dateOption === "custom" && customDate) return customDate;
    return d.toISOString().slice(0, 10);
  }, [dateOption, customDate]);

  if (loading || !recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-body text-sm text-muted">Loading…</p>
      </div>
    );
  }

  function handlePhotoChange(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    setPhotoPreviews((prev) => [...prev, ...files.map((f) => URL.createObjectURL(f))]);
  }

  function setRating(memberId: string, stars: number) {
    setRatings((prev) => ({ ...prev, [memberId]: stars }));
  }

  async function handleSave() {
    setSaving(true);

    const { data: cook, error } = await supabase
      .from("cooks")
      .insert({
        recipe_id: recipe!.id,
        cooked_by: currentMember?.id ?? null,
        cooked_on: cookedOn,
        tweaks: tweaks.trim() || null,
      })
      .select()
      .single();

    if (error || !cook) {
      setSaving(false);
      return;
    }

    const ratingRows = Object.entries(ratings)
      .filter(([, stars]) => stars > 0)
      .map(([memberId, stars]) => ({ cook_id: cook.id, member_id: memberId, stars }));

    if (ratingRows.length > 0) {
      await supabase.from("cook_ratings").insert(ratingRows);
    }

    // replace — this whole cook-mode-to-log flow should collapse to a
    // single history entry, otherwise Back re-enters the completed flow.
    navigate(`/recipe/${recipe!.id}`, { replace: true });
  }

  return (
    <div className="min-h-screen bg-cream px-5 pb-8 pt-6">
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] text-ink">Log a cook</h1>
        <Link to={`/recipe/${recipe.id}`} replace className="font-body text-sm text-muted">
          Cancel
        </Link>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <div className="h-[52px] w-[52px] shrink-0 rounded-[10px] bg-[repeating-linear-gradient(135deg,#E4D3BB_0_9px,#DCC9AE_9px_18px)]" />
        <div>
          <p className="font-body text-[15px] text-ink">{recipe.title}</p>
          <p className="font-mono text-[11px] text-muted">
            {cookHistory.count > 0
              ? `${ordinal(cookHistory.count + 1)} time`
              : "first time"}
            {cookHistory.lastCookedOn && ` · last cooked ${cookHistory.lastCookedOn}`}
          </p>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2">
        {(["tonight", "yesterday", "custom"] as const).map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => setDateOption(opt)}
            className={`h-11 rounded-full font-body text-sm capitalize transition ${
              dateOption === opt ? "bg-ink text-cream" : "bg-cream-2 text-ink-2"
            }`}
          >
            {opt === "custom" ? "Pick date" : opt}
          </button>
        ))}
      </div>
      {dateOption === "custom" && (
        <input
          type="date"
          value={customDate}
          onChange={(e) => setCustomDate(e.target.value)}
          className="mt-2 h-10 w-full rounded-lg bg-cream-2 px-3 font-body text-sm text-ink"
        />
      )}

      <div className="mt-5 flex gap-2">
        <label className="flex h-[92px] w-[92px] shrink-0 cursor-pointer flex-col items-center justify-center gap-1 rounded-[14px] border border-dashed border-line/25 font-body text-xs text-muted">
          <input
            type="file"
            accept="image/*"
            capture="environment"
            multiple
            className="hidden"
            onChange={handlePhotoChange}
          />
          <span className="text-lg">📷</span>
          Camera
        </label>
        {photoPreviews.map((src, i) => (
          <img
            key={i}
            src={src}
            alt=""
            className="h-[92px] w-[92px] shrink-0 rounded-[14px] object-cover"
          />
        ))}
      </div>

      <h2 className="mt-6 font-display text-[19px] text-ink">How was it?</h2>

      <div className="mt-3 flex gap-3">
        {members.map((m) => {
          const stars = ratings[m.id] ?? 0;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveMemberId(m.id)}
              className="flex flex-col items-center gap-1"
            >
              <AvatarCircle name={m.display_name} sizePx={44} selected={activeMemberId === m.id} />
              <span className="font-mono text-[9px] text-terracotta">
                {stars > 0 ? "★".repeat(stars) : "–"}
              </span>
            </button>
          );
        })}
      </div>

      {activeMember && (
        <div className="mt-4 rounded-[16px] bg-cream-2 p-4">
          <p className="font-body text-sm text-ink">{activeMember.display_name}'s rating</p>
          <div className="mt-2 flex gap-2">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => setRating(activeMember.id, n)}
                className="flex h-[54px] w-[54px] items-center justify-center rounded-[14px] bg-cream text-[26px] text-terracotta"
              >
                {n <= (ratings[activeMember.id] ?? 0) ? "★" : "☆"}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="mt-6">
        <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
          What we changed
        </p>
        <input
          type="text"
          value={tweaks}
          onChange={(e) => setTweaks(e.target.value)}
          placeholder="Swapped broccoli for green beans"
          className="mt-2 w-full border-b border-line/20 bg-transparent pb-1 font-body text-[15px] text-ink underline decoration-line/20 placeholder:text-muted placeholder:no-underline focus:outline-none"
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-8 flex h-[60px] w-full items-center justify-center rounded-full bg-terracotta font-body text-[17px] font-semibold text-cream disabled:opacity-60"
      >
        {saving ? "Saving…" : "Save cook"}
      </button>
    </div>
  );
}
