import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useRecipes } from "../hooks/useRecipes";
import { useMembers } from "../hooks/useMembers";
import { useHousehold } from "../hooks/useHousehold";
import { useSession } from "../hooks/useSession";
import { RecipeCard } from "../components/RecipeCard";
import { AvatarCircle } from "../components/AvatarCircle";

const FILTERS = ["All", "Dinner", "Under 30", "Never cooked"] as const;
type Filter = (typeof FILTERS)[number];

export default function Feed() {
  const navigate = useNavigate();
  const { recipes, loading } = useRecipes();
  const { members } = useMembers();
  const { name: householdName } = useHousehold();
  const { session } = useSession();
  const [filter, setFilter] = useState<Filter>("All");
  const [query, setQuery] = useState("");

  const currentMember = members.find((m) => m.user_id === session?.user.id);

  const filtered = useMemo(() => {
    let list = recipes;

    if (filter === "Dinner") {
      list = list.filter((r) => r.tags.includes("dinner"));
    } else if (filter === "Under 30") {
      list = list.filter((r) => (r.prep_minutes ?? 0) + (r.cook_minutes ?? 0) < 30);
    } else if (filter === "Never cooked") {
      list = list.filter((r) => r.cookCount === 0);
    }

    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((r) => r.title.toLowerCase().includes(q));
    }

    return list;
  }, [recipes, filter, query]);

  return (
    <div className="min-h-screen bg-cream pb-32">
      <header className="flex items-center justify-between px-5 pt-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-muted">
            {householdName ?? "Household"}
          </p>
          <h1 className="font-display text-[30px] text-ink">Family Cookbook</h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            to="/setup"
            aria-label="Set up sharing from your phone"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-cream-2 font-body text-sm font-semibold text-ink-2"
          >
            ?
          </Link>
          {currentMember && <AvatarCircle name={currentMember.display_name} sizePx={36} />}
        </div>
      </header>

      <div className="mt-4 px-5">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search recipes"
          className="h-10 w-full rounded-[20px] bg-cream-2 px-4 font-body text-sm text-ink placeholder:text-muted focus:outline-none"
        />
      </div>

      <div className="mt-3 flex gap-2 overflow-x-auto px-5">
        {FILTERS.map((f) => (
          <button
            key={f}
            type="button"
            onClick={() => setFilter(f)}
            className={`shrink-0 rounded-full px-3.5 py-1.5 font-body text-[13px] transition ${
              filter === f ? "bg-ink text-cream" : "bg-cream-2 text-ink-2"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-x-3.5 gap-y-[18px] px-5">
        {filtered.map((recipe, i) => (
          <RecipeCard key={recipe.id} recipe={recipe} index={i} members={members} />
        ))}
      </div>

      {!loading && filtered.length === 0 && (
        <p className="mt-8 px-5 text-center font-body text-sm text-muted">
          No recipes match yet.
        </p>
      )}

      <div className="fixed inset-x-0 bottom-0 h-24 bg-gradient-to-t from-cream to-transparent">
        <nav className="absolute inset-x-5 bottom-[22px] flex h-[62px] items-center justify-between rounded-[31px] bg-ink px-5 shadow-[0_10px_26px_rgba(46,38,33,0.3)]">
          <span className="font-body text-[15px] font-medium text-cream">Cookbook</span>
          <span className="font-body text-[15px] text-cream/60">Cooks</span>
          <button
            type="button"
            onClick={() => navigate("/add")}
            className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-terracotta text-2xl leading-none text-cream"
            aria-label="Add a recipe"
          >
            +
          </button>
        </nav>
      </div>
    </div>
  );
}
