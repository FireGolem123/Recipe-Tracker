import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";

export interface FeedRecipe {
  id: string;
  title: string;
  hero_image_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  createdAt: string;
  cookCount: number;
  avgStars: number | null;
  cookedByMemberIds: string[];
}

interface RawFeedRow {
  id: string;
  title: string;
  hero_image_path: string | null;
  prep_minutes: number | null;
  cook_minutes: number | null;
  tags: string[];
  created_at: string;
  cooks: { id: string; cooked_by: string | null; cook_ratings: { stars: number }[] }[];
}

export function useRecipes() {
  const [recipes, setRecipes] = useState<FeedRecipe[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase
      .from("recipes")
      .select(
        "id, title, hero_image_path, prep_minutes, cook_minutes, tags, created_at, cooks(id, cooked_by, cook_ratings(stars))"
      )
      .order("created_at", { ascending: false })
      .returns<RawFeedRow[]>()
      .then(({ data, error }) => {
        if (error) console.error("useRecipes:", error.message);
        setRecipes(
          (data ?? []).map((row) => {
            const allRatings = row.cooks.flatMap((c) => c.cook_ratings);
            const avgStars = allRatings.length
              ? allRatings.reduce((sum, r) => sum + r.stars, 0) / allRatings.length
              : null;
            const cookedByMemberIds = [
              ...new Set(row.cooks.map((c) => c.cooked_by).filter((id): id is string => !!id)),
            ];

            return {
              id: row.id,
              title: row.title,
              hero_image_path: row.hero_image_path,
              prep_minutes: row.prep_minutes,
              cook_minutes: row.cook_minutes,
              tags: row.tags,
              createdAt: row.created_at,
              cookCount: row.cooks.length,
              avgStars,
              cookedByMemberIds,
            };
          })
        );
        setLoading(false);
      });
  }, []);

  return { recipes, loading };
}
