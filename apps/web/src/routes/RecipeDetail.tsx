import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useRecipe } from "../hooks/useRecipe";
import { useMembers } from "../hooks/useMembers";
import { deleteRecipe } from "../lib/recipes";
import { useSignedImageUrl } from "../hooks/useSignedImageUrl";

const ALLERGEN_LABELS: Record<string, string> = {
  milk: "milk",
  egg: "egg",
  fish: "fish",
  shellfish: "shellfish",
  tree_nut: "tree nut",
  peanut: "peanut",
  wheat: "wheat",
  soy: "soy",
  sesame: "sesame",
};

function formatQuantity(value: number): string {
  const rounded = Math.round(value * 100) / 100;
  return rounded.toString();
}

function sourceHostname(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

export default function RecipeDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { recipe, ingredients, loading } = useRecipe(id);
  const { members } = useMembers();
  const [servings, setServings] = useState<number | null>(null);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const imageUrl = useSignedImageUrl(recipe?.hero_image_path ?? null);

  const effectiveServings = servings ?? recipe?.servings ?? null;
  const scale =
    effectiveServings && recipe?.servings ? effectiveServings / recipe.servings : 1;

  const clearedMembers = useMemo(() => {
    if (!recipe) return [];
    const allergens = recipe.allergens as string[];
    return members.filter(
      (m) => m.allergies.length > 0 && !m.allergies.some((a) => allergens.includes(a))
    );
  }, [members, recipe]);

  if (loading || !recipe) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <p className="font-body text-sm text-muted">Loading…</p>
      </div>
    );
  }

  const metaParts = [
    recipe.servings ? `serves ${recipe.servings}` : null,
    recipe.prep_minutes ? `${recipe.prep_minutes} prep` : null,
    recipe.cook_minutes ? `${recipe.cook_minutes} cook` : null,
  ].filter(Boolean);

  const nutrition = recipe.nutrition;
  const lowConfidence = nutrition?.confidence === "low";

  async function handleDelete() {
    setDeleting(true);
    try {
      await deleteRecipe(recipe!.id, recipe!.hero_image_path);
      navigate("/", { replace: true });
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
    }
  }

  function toggleCheck(ingredientId: string) {
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(ingredientId)) next.delete(ingredientId);
      else next.add(ingredientId);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-cream">
      <div
        className={`relative h-[210px] ${
          imageUrl ? "bg-placeholder" : "bg-[repeating-linear-gradient(135deg,#E4D3BB_0_9px,#DCC9AE_9px_18px)]"
        }`}
        aria-label="hero photo"
      >
        {imageUrl && (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" />
        )}
        <button
          type="button"
          onClick={() => navigate(-1)}
          className="absolute left-5 top-4 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-cream text-ink"
          aria-label="Back"
        >
          ←
        </button>
        {/* Visual only — no is_favorite concept in the schema yet, so this doesn't persist. */}
        <button
          type="button"
          className="absolute right-5 top-4 flex h-[38px] w-[38px] items-center justify-center rounded-full bg-cream text-ink"
          aria-label="Favorite"
        >
          ♡
        </button>
      </div>

      <div className="relative -mt-7 rounded-t-[26px] bg-cream px-5 pt-5">
        {sourceHostname(recipe.source_url ?? "") && (
          <p className="font-mono text-[11px] uppercase tracking-wide text-muted">
            from {sourceHostname(recipe.source_url ?? "")}
          </p>
        )}
        <h1 className="mt-1 font-display text-[25px] leading-tight text-ink">{recipe.title}</h1>

        {metaParts.length > 0 && (
          <p className="mt-2 border-b border-line/10 pb-3 font-mono text-xs text-ink-2">
            {metaParts.join(" · ")}
          </p>
        )}

        {(recipe.allergens.length > 0 || clearedMembers.length > 0) && (
          <div className="mt-3 flex flex-wrap gap-2">
            {recipe.allergens.map((a) => (
              <span
                key={a}
                className="rounded-full bg-terracotta-tint px-3 py-1.5 font-body text-xs font-medium text-terracotta-text"
              >
                Contains {ALLERGEN_LABELS[a] ?? a}
              </span>
            ))}
            {clearedMembers.map((m) => (
              <span
                key={m.id}
                className="rounded-full bg-sage-tint px-3 py-1.5 font-body text-xs font-medium text-sage-text"
              >
                {m.display_name}: {m.allergies.map((a) => ALLERGEN_LABELS[a] ?? a).join(", ")} —
                clear
              </span>
            ))}
          </div>
        )}

        <p className="mt-2 font-mono text-[11px] text-muted">
          AI-generated — check the ingredients below.
        </p>

        {nutrition && (
          <div className="mt-4 flex gap-3">
            <div className="w-[104px] shrink-0 rounded-[14px] bg-cream-2 p-4">
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
                Health · est.
              </p>
              {recipe.health_score !== null && (
                <>
                  <p className="mt-1 font-display text-[34px] leading-none text-sage">
                    {recipe.health_score}
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-[#E2DACB]">
                    <div
                      className="h-1 rounded-full bg-sage"
                      style={{ width: `${recipe.health_score}%` }}
                    />
                  </div>
                </>
              )}
              {recipe.health_rationale && (
                <p className="mt-2 font-body text-[10px] leading-snug text-ink-2">
                  {recipe.health_rationale}
                </p>
              )}
            </div>

            <div className={`flex-1 rounded-[14px] bg-cream-2 p-4 ${lowConfidence ? "opacity-45" : ""}`}>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
                Per serving · estimate · {nutrition.confidence} confidence
              </p>
              <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-3">
                {[
                  ["cal", nutrition.calories],
                  ["protein", nutrition.protein_g, "g"],
                  ["carbs", nutrition.carbs_g, "g"],
                  ["fat", nutrition.fat_g, "g"],
                  ["fiber", nutrition.fiber_g, "g"],
                  ["sodium", nutrition.sodium_mg, "mg"],
                ].map(([label, value, unit]) =>
                  value === null || value === undefined ? null : (
                    <div key={label as string}>
                      <p className="font-display text-[17px] leading-none text-ink">{value}</p>
                      <p className="font-mono text-[9px] text-muted">
                        {unit ?? ""} {label}
                      </p>
                    </div>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        <div className="mt-6 flex items-baseline justify-between">
          <h2 className="font-display text-[18px] text-ink">Ingredients</h2>
          {recipe.servings && (
            <div className="flex items-center gap-2 font-mono text-xs text-muted">
              <button
                type="button"
                onClick={() => setServings(Math.max(1, (effectiveServings ?? recipe.servings!) - 1))}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-2 text-ink"
                aria-label="Fewer servings"
              >
                −
              </button>
              for {effectiveServings}
              <button
                type="button"
                onClick={() => setServings((effectiveServings ?? recipe.servings!) + 1)}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-cream-2 text-ink"
                aria-label="More servings"
              >
                +
              </button>
            </div>
          )}
        </div>

        <ul className="mt-1">
          {ingredients.map((ing, i) => (
            <li
              key={ing.id}
              onClick={() => toggleCheck(ing.id)}
              className={`flex cursor-pointer gap-3 py-[7px] ${
                i < ingredients.length - 1 ? "border-b border-line/10" : ""
              } ${checked.has(ing.id) ? "opacity-45" : ""}`}
            >
              <span className="w-[74px] shrink-0 font-mono text-[13px] text-terracotta">
                {ing.is_optional
                  ? "optional"
                  : ing.quantity !== null
                    ? `${formatQuantity(ing.quantity * scale)}${ing.unit ? ` ${ing.unit}` : ""}`
                    : ""}
              </span>
              <span className="font-body text-[14px] text-ink">
                {ing.item}
                {ing.prep_note && <span className="text-muted"> — {ing.prep_note}</span>}
              </span>
            </li>
          ))}
        </ul>

        <div className="mt-8">
          {confirmingDelete ? (
            <div className="rounded-2xl bg-terracotta-tint p-4 text-center">
              <p className="font-body text-sm text-terracotta-text">
                Delete this recipe? This can't be undone.
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmingDelete(false)}
                  disabled={deleting}
                  className="h-10 flex-1 rounded-full bg-cream font-body text-sm text-ink-2"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDelete}
                  disabled={deleting}
                  className="h-10 flex-1 rounded-full bg-terracotta font-body text-sm font-medium text-cream disabled:opacity-60"
                >
                  {deleting ? "Deleting…" : "Delete recipe"}
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setConfirmingDelete(true)}
              className="w-full font-body text-sm text-muted underline"
            >
              Delete recipe
            </button>
          )}
        </div>

        <div className="h-24" />
      </div>

      <div className="fixed inset-x-0 bottom-0 bg-gradient-to-t from-cream via-cream px-5 pb-6 pt-4">
        <Link
          to={`/recipe/${recipe.id}/cook`}
          className="flex h-[60px] w-full items-center justify-center rounded-full bg-terracotta font-body text-[17px] font-semibold text-cream"
        >
          Start cook mode
        </Link>
      </div>
    </div>
  );
}
