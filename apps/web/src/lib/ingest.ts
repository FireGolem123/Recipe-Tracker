import { supabase } from "./supabase";
import { DEV_SKIP_AUTH, DEV_HOUSEHOLD_ID } from "./devMode";

// household_id defaults to my_household() server-side — omit it and a real
// authenticated insert gets it automatically. That default resolves to
// null for anon, so the dev-auth-bypass path needs it passed explicitly.
const householdIdOverride = DEV_SKIP_AUTH ? { household_id: DEV_HOUSEHOLD_ID } : {};

async function invokeIngest(
  jobId: string,
  extra?: { photo_base64?: string; manual_ingredients?: string[] }
) {
  const { error } = await supabase.functions.invoke("ingest-url", {
    body: { job_id: jobId, ...extra },
  });
  if (error) throw error;
}

export async function startWebIngest(url: string): Promise<string> {
  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({ input_type: "web", input_url: url, status: "queued", ...householdIdOverride })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create ingest job");

  invokeIngest(data.id).catch(() => {
    // Errors land in the job row itself (status='error'); the UI polls/subscribes to that.
  });
  return data.id;
}

export async function startPhotoIngest(photoBase64: string): Promise<string> {
  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({ input_type: "photo", status: "queued", ...householdIdOverride })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create ingest job");

  invokeIngest(data.id, { photo_base64: photoBase64 }).catch(() => {});
  return data.id;
}

// recipeId must already exist (title/servings/times/instructions inserted
// directly — no AI needed for structured form fields). rawIngredientLines
// are free-text ("2 cups flour, sifted") and get parsed server-side, same
// as every other ingest path — never regex-parsed client-side.
export async function startManualEnrich(
  recipeId: string,
  rawIngredientLines: string[]
): Promise<string> {
  const { data, error } = await supabase
    .from("ingest_jobs")
    .insert({
      input_type: "manual",
      recipe_id: recipeId,
      status: "queued",
      ...householdIdOverride,
    })
    .select("id")
    .single();
  if (error || !data) throw error ?? new Error("Failed to create ingest job");

  invokeIngest(data.id, { manual_ingredients: rawIngredientLines }).catch(() => {});
  return data.id;
}
