import { Link } from "react-router-dom";
import type { FeedRecipe } from "../hooks/useRecipes";
import type { Member } from "../hooks/useMembers";
import { AvatarCircle } from "./AvatarCircle";
import { useSignedImageUrl } from "../hooks/useSignedImageUrl";

// Variable card height (150-190px) creates the masonry-ish rhythm the design
// calls for; deterministic per-index so it doesn't jitter on re-render.
const PHOTO_HEIGHTS = [150, 175, 190, 160];

const NEW_WINDOW_DAYS = 7;

interface RecipeCardProps {
  recipe: FeedRecipe;
  index: number;
  members: Member[];
}

export function RecipeCard({ recipe, index, members }: RecipeCardProps) {
  const photoHeight = PHOTO_HEIGHTS[index % PHOTO_HEIGHTS.length];
  const imageUrl = useSignedImageUrl(recipe.hero_image_path);
  const totalMinutes = (recipe.prep_minutes ?? 0) + (recipe.cook_minutes ?? 0);
  const isNew =
    recipe.cookCount === 0 &&
    Date.now() - new Date(recipe.createdAt).getTime() < NEW_WINDOW_DAYS * 24 * 60 * 60 * 1000;

  const cookedByMembers = recipe.cookedByMemberIds
    .map((id) => members.find((m) => m.id === id))
    .filter((m): m is Member => !!m);
  const visibleAvatars = cookedByMembers.slice(0, 4);
  const overflowCount = cookedByMembers.length - visibleAvatars.length;

  return (
    <Link to={`/recipe/${recipe.id}`} className="block">
      <div
        className={`relative overflow-hidden rounded-[14px] ${
          imageUrl ? "bg-placeholder" : "bg-[repeating-linear-gradient(135deg,#E4D3BB_0_9px,#DCC9AE_9px_18px)]"
        }`}
        style={{ height: photoHeight }}
      >
        {imageUrl && (
          <img src={imageUrl} alt="" className="h-full w-full object-cover" loading="lazy" />
        )}
        {recipe.cookCount > 0 ? (
          <span className="absolute right-2 top-2 rounded-full bg-ink/72 px-2.5 py-1 font-mono text-[10px] text-cream">
            {recipe.cookCount} {recipe.cookCount === 1 ? "cook" : "cooks"}
          </span>
        ) : isNew ? (
          <span className="absolute right-2 top-2 rounded-full bg-sage px-2.5 py-1 font-mono text-[10px] text-cream">
            new
          </span>
        ) : null}
      </div>

      <h3 className="mt-2 line-clamp-2 font-display text-[15px] leading-snug text-ink">
        {recipe.title}
      </h3>

      {recipe.cookCount === 0 ? (
        <p className="mt-1 font-mono text-[11px] text-terracotta">never cooked</p>
      ) : (
        <div className="mt-1 flex items-center gap-2">
          <span className="font-mono text-[11px] text-muted">{totalMinutes} min</span>
          <span className="text-[11px] text-terracotta">
            {"★".repeat(Math.round(recipe.avgStars ?? 0))}
            {"☆".repeat(5 - Math.round(recipe.avgStars ?? 0))}
          </span>
        </div>
      )}

      {visibleAvatars.length > 0 && (
        <div className="mt-1.5 flex items-center">
          {visibleAvatars.map((member, i) => (
            <AvatarCircle
              key={member.id}
              name={member.display_name}
              sizePx={18}
              className={`border-[1.5px] border-cream ${i > 0 ? "-ml-1.5" : ""}`}
            />
          ))}
          {overflowCount > 0 && (
            <div className="-ml-1.5 flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-[1.5px] border-cream bg-placeholder font-mono text-[8px] text-ink">
              +{overflowCount}
            </div>
          )}
        </div>
      )}
    </Link>
  );
}
