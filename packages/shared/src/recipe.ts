import { z } from "zod";

// Fixed allergen vocabulary — never free text. See CLAUDE.md "AI prompt rules".
export const ALLERGENS = [
  "milk",
  "egg",
  "fish",
  "shellfish",
  "tree_nut",
  "peanut",
  "wheat",
  "soy",
  "sesame",
] as const;
export const allergenSchema = z.enum(ALLERGENS);
export type Allergen = z.infer<typeof allergenSchema>;

export const SOURCE_TYPES = ["web", "tiktok", "instagram", "photo", "manual"] as const;
export const sourceTypeSchema = z.enum(SOURCE_TYPES);
export type SourceType = z.infer<typeof sourceTypeSchema>;

export const confidenceSchema = z.enum(["low", "medium", "high"]);
export type Confidence = z.infer<typeof confidenceSchema>;

// ---- ingredients ------------------------------------------------------
// Own table, not a text[] — this is what unlocks scaling, shopping lists,
// and ingredient search.

export const ingredientSchema = z.object({
  raw_text: z.string(),
  quantity: z.number().nullable(),
  unit: z.string().nullable(),
  item: z.string(),
  prep_note: z.string().nullable(),
  is_optional: z.boolean(),
  group_label: z.string().nullable(),
});
export type Ingredient = z.infer<typeof ingredientSchema>;

export const ingredientRowSchema = ingredientSchema.extend({
  id: z.string().uuid(),
  recipe_id: z.string().uuid(),
  position: z.number().int(),
});
export type IngredientRow = z.infer<typeof ingredientRowSchema>;

// ---- instructions -------------------------------------------------------

export const instructionStepSchema = z.object({
  step: z.number().int(),
  text: z.string(),
  image_path: z.string().nullable(),
});
export type InstructionStep = z.infer<typeof instructionStepSchema>;

// ---- nutrition ------------------------------------------------------------

export const nutritionSchema = z.object({
  calories: z.number().nullable(),
  protein_g: z.number().nullable(),
  carbs_g: z.number().nullable(),
  fat_g: z.number().nullable(),
  fiber_g: z.number().nullable(),
  sugar_g: z.number().nullable(),
  sodium_mg: z.number().nullable(),
  confidence: confidenceSchema,
});
export type Nutrition = z.infer<typeof nutritionSchema>;

// ---- pass 1 · extract (Sonnet 5) ------------------------------------------
// Tool-use output. Every optional field is nullable, never omitted — the
// prompt instructs the model to leave a field null rather than guess.

export const recipeExtractionSchema = z.object({
  title: z.string(),
  description: z.string().nullable(),
  servings: z.number().int().nullable(),
  prep_minutes: z.number().int().nullable(),
  cook_minutes: z.number().int().nullable(),
  source_author: z.string().nullable(),
  ingredients: z.array(ingredientSchema),
  instructions: z.array(instructionStepSchema),
  // Video lane only: index into the 8 sampled frames for the hero image.
  best_frame_index: z.number().int().nullable(),
});
export type RecipeExtraction = z.infer<typeof recipeExtractionSchema>;

// ---- pass 2 · enrich (Haiku 4.5) -------------------------------------------

export const recipeEnrichmentSchema = z.object({
  allergens: z.array(allergenSchema),
  may_contain: z.array(allergenSchema),
  health_score: z.number().int().min(0).max(100),
  health_rationale: z.string(),
  nutrition: nutritionSchema,
  tags: z.array(z.string()),
});
export type RecipeEnrichment = z.infer<typeof recipeEnrichmentSchema>;

// ---- recipes table row ----------------------------------------------------

export const recipeSchema = z.object({
  id: z.string().uuid(),
  household_id: z.string().uuid(),
  created_by: z.string().uuid().nullable(),
  title: recipeExtractionSchema.shape.title,
  description: recipeExtractionSchema.shape.description,
  hero_image_path: z.string().nullable(),
  source_type: sourceTypeSchema,
  source_url: z.string().nullable(),
  source_author: recipeExtractionSchema.shape.source_author,
  servings: recipeExtractionSchema.shape.servings,
  prep_minutes: recipeExtractionSchema.shape.prep_minutes,
  cook_minutes: recipeExtractionSchema.shape.cook_minutes,
  instructions: recipeExtractionSchema.shape.instructions,
  nutrition: nutritionSchema.nullable(),
  health_score: recipeEnrichmentSchema.shape.health_score.nullable(),
  health_rationale: z.string().nullable(),
  allergens: z.array(allergenSchema),
  may_contain: z.array(allergenSchema),
  tags: z.array(z.string()),
  // Original transcript / page text, kept so a re-tuned prompt can
  // re-derive the recipe without re-fetching a URL that may be dead.
  raw_extract: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
});
export type Recipe = z.infer<typeof recipeSchema>;
