import { useEffect, useState } from "react";
import type { Recipe, IngredientRow } from "@family-cookbook/shared";
import { supabase } from "../lib/supabase";

export interface CookHistory {
  count: number;
  lastCookedOn: string | null;
}

export function useRecipe(recipeId: string | undefined) {
  const [recipe, setRecipe] = useState<Recipe | null>(null);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [cookHistory, setCookHistory] = useState<CookHistory>({ count: 0, lastCookedOn: null });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!recipeId) return;
    setLoading(true);

    Promise.all([
      supabase.from("recipes").select("*").eq("id", recipeId).single(),
      supabase
        .from("ingredients")
        .select("*")
        .eq("recipe_id", recipeId)
        .order("position")
        .returns<IngredientRow[]>(),
      supabase
        .from("cooks")
        .select("cooked_on")
        .eq("recipe_id", recipeId)
        .order("cooked_on", { ascending: false }),
    ]).then(([recipeRes, ingredientsRes, cooksRes]) => {
      if (recipeRes.error) console.error("useRecipe (recipe):", recipeRes.error.message);
      if (ingredientsRes.error) console.error("useRecipe (ingredients):", ingredientsRes.error.message);
      if (cooksRes.error) console.error("useRecipe (cooks):", cooksRes.error.message);
      setRecipe((recipeRes.data as Recipe | null) ?? null);
      setIngredients(ingredientsRes.data ?? []);
      const cooks = cooksRes.data ?? [];
      setCookHistory({
        count: cooks.length,
        lastCookedOn: cooks[0]?.cooked_on ?? null,
      });
      setLoading(false);
    });
  }, [recipeId]);

  return { recipe, ingredients, cookHistory, loading };
}
