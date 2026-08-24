# CLAUDE.md — Family Cookbook

Private recipe app for one household (~6 people). Not a product: no public sharing, no
accounts beyond the household, no monetization. Every feature answers to "does my family
use this."

Full build plan lives in `PLAN.md`. Read it before starting a new phase.

---

## Stack

- **Web:** Vite + React + TypeScript + Tailwind, PWA via `vite-plugin-pwa` → Vercel
- **Backend:** Supabase (Postgres, Auth, Storage, Realtime, RLS)
- **Fast ingest:** Supabase Edge Functions (Deno)
- **Video ingest:** Node worker on Fly.io with `yt-dlp` + `ffmpeg` (Phase 4 only)
- **AI:** Claude Sonnet 5 (extraction), Claude Haiku 4.5 (enrichment)
- **Transcription:** `gpt-4o-mini-transcribe`

## Repo layout

```
apps/web/              # React PWA
apps/worker/           # Phase 4 only — Fly.io video worker
packages/shared/       # zod schemas — THE source of truth for the Recipe shape
supabase/migrations/   # schema
supabase/functions/    # ingest-url, enrich-recipe
```

---

## Non-negotiable conventions

1. **Zod first.** The `Recipe` shape is defined once in `packages/shared/src/recipe.ts`.
   The edge function, the worker, and the UI all import it. It also generates the Claude
   tool-use JSON schema. Never redefine the recipe shape anywhere else.

2. **AI output is always tool-use with a JSON schema.** Never ask Claude for JSON in prose
   and parse the response. Never `JSON.parse` a text completion.

3. **Every table is household-scoped** and has RLS enabled using the `my_household()`
   helper. No exceptions, including new tables.

4. **Images are downscaled client-side before upload.** Canvas resize to ~1600px, WebP,
   quality 0.85. Use `apps/web/src/lib/image.ts` — never upload a phone original.
   The Supabase free tier is 1 GB and phone photos are 3–5 MB each.

5. **Secrets never reach the browser.** Claude and OpenAI keys live only in edge function
   and worker env. The client holds only the Supabase anon key (RLS makes it safe).

6. **Minimal error handling in examples** unless a failure path is actually load-bearing.

---

## Data model summary

Full DDL in `supabase/migrations/`. Key relationships:

```
households ──< members (user_id NULLABLE — see below)
           ──< recipes ──< ingredients
                       ──< recipe_images
                       ──< cooks ──< cook_photos
                                 ──< cook_ratings >── members
           ──< ingest_jobs
```

### `members.user_id` is nullable — this is deliberate

A member is a person in the household, **not** an auth user. Kids and grandparents have
`members` rows with `user_id = null`: they have profiles, allergies, and star ratings but
no login. Only the handful of adults who add recipes need `auth.users` rows.

Never assume `member.user_id` is present. Never key a foreign key off `auth.users` where a
`members.id` would do.

### RLS helper

```sql
create function my_household() returns uuid
  language sql stable security definer as $$
    select household_id from members where user_id = auth.uid()
  $$;
```

Policy shape for every table:

```sql
create policy household_rw on <table>
  for all
  using      (household_id = my_household())
  with check (household_id = my_household());
```

### Keep `recipes.raw_extract`

Stores the original transcript or page text. When the extraction prompt improves, recipes
can be re-derived without re-fetching URLs that may be dead. Never drop this column.

---

## AI prompt rules

Two passes, deliberately separate so either can be retuned or re-run alone.

### Pass 1 — Extract (Sonnet 5)

- Let the model parse ingredient quantities. Do **not** regex `"1½ cups flour, sifted"`.
  Output shape: `{quantity: 1.5, unit: "cup", item: "flour", prep_note: "sifted"}`.
- Nullable fields must stay null when unknown. Prompt explicitly: *leave null rather than
  guess*. Reels rarely state servings or times.
- For video: 8 evenly spaced frames at ~512px. Ask for the recipe **and** the index of the
  frame that best shows the finished dish — that becomes the hero image.

### Pass 2 — Enrich (Haiku 4.5)

**Allergen enum — fixed, never free text:**

```
milk, egg, fish, shellfish, tree_nut, peanut, wheat, soy, sesame
```

Plus a separate `may_contain` array. Prompt for hidden sources: soy sauce → wheat + soy,
Worcestershire → fish, pesto → tree_nut + milk.

**Health score rubric — always include these anchors in the prompt.** An unanchored 1–100
drifts badly between runs.

| Band | Character | Anchor |
|---|---|---|
| 90–100 | Whole foods, vegetable-forward, lean protein, little added sugar/sodium | Grilled salmon with roasted vegetables |
| 70–89 | Balanced; some refined carbs or moderate fat | Chicken burrito bowl |
| 50–69 | Comfort-leaning; refined carbs or notable fat | Baked ziti |
| 30–49 | Heavy fat, sugar, or refined starch dominates | Fettuccine alfredo |
| 0–29 | Dessert, deep-fried, or ultra-processed | Skillet cookie |

Score on: whole vs. refined ingredients, added sugar, sodium, saturated fat, fiber and
produce content, cooking method. `health_rationale` (one sentence) is required.

**Nutrition** is per serving and carries a required `confidence: low | medium | high`.

Use low temperature on both passes. After any prompt change, spot-check ten existing
recipes before considering it done.

---

## Safety requirement — allergens

The allergen badge is a convenience, **not** a safety control. The recipe screen must
always render the full ingredient list, never the badge alone, with a visible
"AI-generated — check the ingredients" note. Do not build any UI that hides ingredients
behind an allergen summary.

Nutrition numbers always render with a visible "estimate" qualifier and gray out at low
confidence.

---

## Operational notes

- **Supabase free projects pause after 1 week of inactivity.** A daily cron hits a trivial
  query to keep it warm. Do not remove it.
- **yt-dlp breaks regularly**, Instagram especially. Pinned in the Docker image, rebuilt
  weekly by GitHub Action. Every video ingest failure falls back to a caption paste box —
  never an error screen, and always save a stub with the source URL.
- Rate-limit video ingestion. A few requests a day. Never build a bulk importer.

---

## Phase status

- [ ] **Phase 0** — Foundation: schema, RLS, zod schemas, auth, cron ping
- [ ] **Phase 1** — Web URL ingest + feed + recipe detail
- [ ] **Phase 2** — PWA, cook mode, allergy profiles, search, image pipeline, photo ingest
- [ ] **Phase 3** — Cook log: photos, per-member ratings, timeline
- [ ] **Phase 4** — Video ingest (TikTok / Reels)
- [ ] **Phase 5** — Shopping list, tweaks folding, collections, meal plan
