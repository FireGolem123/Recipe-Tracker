import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import {
  recipeExtractionSchema,
  recipeEnrichmentSchema,
  ingredientSchema,
  type RecipeExtraction,
  type RecipeEnrichment,
  type Ingredient,
} from "@family-cookbook/shared";
import { callClaudeTool } from "../_shared/claude.ts";
import {
  findJsonLdRecipe,
  extractOgImage,
  extractMainText,
  parseIsoDurationMinutes,
  parseServings,
  parseAuthor,
  normalizeInstructions,
} from "../_shared/htmlExtract.ts";

const SONNET = "claude-sonnet-5";
const HAIKU = "claude-haiku-4-5-20251001";

const USER_AGENT =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36 FamilyCookbook/1.0";

const EXTRACTION_SYSTEM = `You extract recipes into structured data. Parse every ingredient's
quantity, unit, and item name yourself — never leave an ingredient as a raw
string, and never regex-guess at fractions like "1½ cups". Handle ranges,
"to taste", and "2 (14 oz) cans" by picking the clearest single reading.
If a field isn't stated (servings, prep/cook time, description), leave it
null rather than guessing. For video frames, also return the index of the
frame that best shows the finished dish — otherwise leave best_frame_index
null.`;

const ENRICHMENT_SYSTEM = `You enrich a recipe's ingredient list with allergens, nutrition, a health
score, and tags.

Allergens: use only this fixed enum — milk, egg, fish, shellfish, tree_nut,
peanut, wheat, soy, sesame. Check for hidden sources: soy sauce carries
wheat and soy, Worcestershire carries fish, most pesto carries tree_nut and
milk. Put uncertain/trace sources in may_contain, not allergens.

Health score (0-100), anchored so it doesn't drift between runs:
90-100 whole foods, vegetable-forward, lean protein, little added sugar or
  sodium — e.g. grilled salmon with roasted vegetables.
70-89 balanced, some refined carbs or moderate fat — e.g. chicken burrito
  bowl.
50-69 comfort-leaning, refined carbs or notable fat — e.g. baked ziti.
30-49 heavy fat, sugar, or refined starch dominates — e.g. fettuccine
  alfredo.
0-29 dessert, deep-fried, or ultra-processed — e.g. skillet cookie.
Score on whole vs. refined ingredients, added sugar, sodium, saturated fat,
fiber/produce content, and cooking method. health_rationale is one sentence
and must justify the score.

Nutrition is per serving. confidence is low/medium/high for the estimate as
a whole. Leave a field null rather than guess if you can't estimate it.`;

const jsonLdEnrichmentSchema = z.object({
  ingredients: z.array(ingredientSchema),
  ...recipeEnrichmentSchema.shape,
});

interface IngestRequestBody {
  job_id: string;
  photo_base64?: string;
  manual_ingredients?: string[];
}

interface IngestJobRow {
  id: string;
  household_id: string;
  requested_by: string | null;
  input_url: string | null;
  input_type: "web" | "tiktok" | "instagram" | "photo" | "manual";
  recipe_id: string | null;
}

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders() });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("Authorization") ?? "";

  // Scoped to the caller's own JWT — RLS makes this the authorization
  // check: the caller can only ever see/act on jobs in their own household.
  const callerClient = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  // Privileged — used only after the caller's access to this specific job
  // has already been established via callerClient above.
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let job: IngestJobRow | null = null;

  try {
    const body: IngestRequestBody = await req.json();

    const { data: jobRow, error: jobError } = await callerClient
      .from("ingest_jobs")
      .select("id, household_id, requested_by, input_url, input_type, recipe_id")
      .eq("id", body.job_id)
      .single();
    if (jobError || !jobRow) {
      return new Response(JSON.stringify({ error: "Job not found" }), {
        status: 404,
        headers: corsHeaders(),
      });
    }
    job = jobRow as IngestJobRow;

    await setStatus(adminClient, job.id, "processing", "Starting…");

    if (job.input_type === "manual") {
      await processManual(adminClient, job, body.manual_ingredients);
    } else if (job.input_type === "photo") {
      await processPhoto(adminClient, job, body.photo_base64);
    } else if (job.input_type === "web") {
      await processWeb(adminClient, job);
    } else {
      throw new Error(`${job.input_type} ingest isn't built yet — that needs the video worker`);
    }

    return new Response(JSON.stringify({ ok: true }), { headers: corsHeaders() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (job) await setStatus(adminClient, job.id, "error", null, message);
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: corsHeaders(),
    });
  }
});

async function setStatus(
  client: ReturnType<typeof createClient>,
  jobId: string,
  status: string,
  detail: string | null,
  error?: string
) {
  await client
    .from("ingest_jobs")
    .update({ status, status_detail: detail, ...(error ? { error } : {}) })
    .eq("id", jobId);
}

async function processManual(
  client: ReturnType<typeof createClient>,
  job: IngestJobRow,
  manualIngredients: string[] | undefined
) {
  if (!job.recipe_id) throw new Error("Manual job is missing recipe_id");
  if (!manualIngredients?.length) throw new Error("Manual job is missing ingredients");

  await setStatus(client, job.id, "processing", "Estimating nutrition…");

  const { data: recipe } = await client
    .from("recipes")
    .select("servings")
    .eq("id", job.recipe_id)
    .single();

  const rawIngredients = manualIngredients.map((raw_text) => ({ raw_text }));
  const combined = await callClaudeTool<z.infer<typeof jsonLdEnrichmentSchema>>({
    model: HAIKU,
    schema: jsonLdEnrichmentSchema,
    toolName: "parse_and_enrich",
    system: `${EXTRACTION_SYSTEM}\n\n${ENRICHMENT_SYSTEM}`,
    content: JSON.stringify({ servings: recipe?.servings ?? null, raw_ingredients: rawIngredients }),
  });

  const ingredientRows = combined.ingredients.map((ing, i) => ({
    recipe_id: job.recipe_id,
    household_id: job.household_id,
    position: i + 1,
    raw_text: ing.raw_text,
    quantity: ing.quantity,
    unit: ing.unit,
    item: ing.item,
    prep_note: ing.prep_note,
    is_optional: ing.is_optional,
    group_label: ing.group_label,
  }));
  const { error: ingredientsError } = await client.from("ingredients").insert(ingredientRows);
  if (ingredientsError) throw new Error(`Failed to save ingredients: ${ingredientsError.message}`);

  await client
    .from("recipes")
    .update({
      allergens: combined.allergens,
      may_contain: combined.may_contain,
      health_score: combined.health_score,
      health_rationale: combined.health_rationale,
      nutrition: combined.nutrition,
      tags: combined.tags,
    })
    .eq("id", job.recipe_id);

  await setStatus(client, job.id, "done", "Done");
}

async function processPhoto(
  client: ReturnType<typeof createClient>,
  job: IngestJobRow,
  photoBase64: string | undefined
) {
  if (!photoBase64) throw new Error("Photo ingest is missing the image");

  await setStatus(client, job.id, "processing", "Reading the photo…");

  const extraction = await callClaudeTool<RecipeExtraction>({
    model: SONNET,
    schema: recipeExtractionSchema,
    toolName: "extract_recipe",
    system: EXTRACTION_SYSTEM,
    content: [
      { type: "image", source: { type: "base64", media_type: "image/webp", data: photoBase64 } },
      { type: "text", text: "Extract the recipe shown in this photo." },
    ],
  });

  await setStatus(client, job.id, "processing", "Estimating nutrition…");
  const enrichment = await enrich(extraction);

  const heroBytes = base64ToBytes(photoBase64);
  await finalizeNewRecipe(client, job, extraction, enrichment, {
    bytes: heroBytes,
    contentType: "image/webp",
    ext: "webp",
  });
}

async function processWeb(client: ReturnType<typeof createClient>, job: IngestJobRow) {
  if (!job.input_url) throw new Error("Web job is missing input_url");

  await setStatus(client, job.id, "processing", "Fetching the page…");
  const res = await fetch(job.input_url, {
    headers: { "User-Agent": USER_AGENT },
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Fetch failed: HTTP ${res.status}`);
  const html = await res.text();

  const ogImage = extractOgImage(html);
  const jsonLd = findJsonLdRecipe(html);

  let extraction: RecipeExtraction;
  let enrichment: RecipeEnrichment;
  let rawExtract: string | null = null;

  if (jsonLd?.recipeIngredient?.length) {
    rawExtract = JSON.stringify(jsonLd);
    await setStatus(client, job.id, "processing", "Reading the ingredients…");
    const rawIngredients = jsonLd.recipeIngredient.map((raw_text) => ({ raw_text }));
    const combined = await callClaudeTool<z.infer<typeof jsonLdEnrichmentSchema>>({
      model: HAIKU,
      schema: jsonLdEnrichmentSchema,
      toolName: "parse_and_enrich",
      system: `${EXTRACTION_SYSTEM}\n\n${ENRICHMENT_SYSTEM}`,
      content: JSON.stringify({ raw_ingredients: rawIngredients }),
    });

    extraction = {
      title: jsonLd.name ?? "Untitled recipe",
      description: jsonLd.description ?? null,
      servings: parseServings(jsonLd.recipeYield),
      prep_minutes: parseIsoDurationMinutes(jsonLd.prepTime),
      cook_minutes: parseIsoDurationMinutes(jsonLd.cookTime),
      source_author: parseAuthor(jsonLd.author),
      ingredients: combined.ingredients,
      instructions: normalizeInstructions(jsonLd.recipeInstructions),
      best_frame_index: null,
    };
    enrichment = combined;
  } else {
    await setStatus(client, job.id, "processing", "Reading the page…");
    const pageText = extractMainText(html);
    rawExtract = pageText;
    extraction = await callClaudeTool<RecipeExtraction>({
      model: SONNET,
      schema: recipeExtractionSchema,
      toolName: "extract_recipe",
      system: EXTRACTION_SYSTEM,
      content: `Page text:\n\n${pageText}`,
    });
    await setStatus(client, job.id, "processing", "Estimating nutrition…");
    enrichment = await enrich(extraction);
  }

  let hero: { bytes: Uint8Array; contentType: string; ext: string } | null = null;
  if (ogImage) {
    try {
      const imgRes = await fetch(ogImage);
      if (imgRes.ok) {
        const contentType = imgRes.headers.get("content-type") ?? "image/jpeg";
        hero = {
          bytes: new Uint8Array(await imgRes.arrayBuffer()),
          contentType,
          ext: contentType.split("/")[1]?.split(";")[0] ?? "jpg",
        };
      }
    } catch {
      // Hero image is a nice-to-have — a broken og:image shouldn't fail the whole ingest.
    }
  }

  await finalizeNewRecipe(client, job, extraction, enrichment, hero, rawExtract);
}

async function enrich(extraction: RecipeExtraction): Promise<RecipeEnrichment> {
  return callClaudeTool<RecipeEnrichment>({
    model: HAIKU,
    schema: recipeEnrichmentSchema,
    toolName: "enrich_recipe",
    system: ENRICHMENT_SYSTEM,
    content: JSON.stringify({ servings: extraction.servings, ingredients: extraction.ingredients }),
  });
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function finalizeNewRecipe(
  client: ReturnType<typeof createClient>,
  job: IngestJobRow,
  extraction: RecipeExtraction,
  enrichment: RecipeEnrichment,
  hero: { bytes: Uint8Array; contentType: string; ext: string } | null,
  rawExtract: string | null = null
) {
  const recipeId = crypto.randomUUID();
  let heroPath: string | null = null;

  if (hero) {
    const path = `${job.household_id}/${recipeId}/hero.${hero.ext}`;
    const { error: uploadError } = await client.storage
      .from("recipe-images")
      .upload(path, hero.bytes, { contentType: hero.contentType, upsert: true });
    if (!uploadError) heroPath = path;
  }

  await setStatus(client, job.id, "processing", "Saving the recipe…");

  const { error: insertError } = await client.from("recipes").insert({
    id: recipeId,
    household_id: job.household_id,
    created_by: job.requested_by,
    title: extraction.title,
    description: extraction.description,
    hero_image_path: heroPath,
    source_type: job.input_type,
    source_url: job.input_url,
    source_author: extraction.source_author,
    servings: extraction.servings,
    prep_minutes: extraction.prep_minutes,
    cook_minutes: extraction.cook_minutes,
    instructions: extraction.instructions,
    nutrition: enrichment.nutrition,
    health_score: enrichment.health_score,
    health_rationale: enrichment.health_rationale,
    allergens: enrichment.allergens,
    may_contain: enrichment.may_contain,
    tags: enrichment.tags,
    raw_extract: rawExtract,
  });
  if (insertError) throw new Error(`Failed to save recipe: ${insertError.message}`);

  const ingredientRows = extraction.ingredients.map((ing: Ingredient, i: number) => ({
    recipe_id: recipeId,
    household_id: job.household_id,
    position: i + 1,
    raw_text: ing.raw_text,
    quantity: ing.quantity,
    unit: ing.unit,
    item: ing.item,
    prep_note: ing.prep_note,
    is_optional: ing.is_optional,
    group_label: ing.group_label,
  }));
  if (ingredientRows.length > 0) {
    const { error: ingredientsError } = await client.from("ingredients").insert(ingredientRows);
    if (ingredientsError) throw new Error(`Failed to save ingredients: ${ingredientsError.message}`);
  }

  await client.from("ingest_jobs").update({ status: "done", status_detail: "Done", recipe_id: recipeId }).eq(
    "id",
    job.id
  );
}
