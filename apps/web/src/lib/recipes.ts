import { supabase } from "./supabase";

// Ingredients/cooks/comments/etc cascade via FK (see 0001_init.sql) — only
// the Storage object needs cleaning up separately, since Storage isn't
// part of Postgres's cascade.
export async function deleteRecipe(recipeId: string, heroImagePath: string | null) {
  if (heroImagePath) {
    await supabase.storage.from("recipe-images").remove([heroImagePath]);
  }
  const { error } = await supabase.from("recipes").delete().eq("id", recipeId);
  if (error) throw error;
}
