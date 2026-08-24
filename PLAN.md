# Family Cookbook — Build Plan

A private, invite-only recipe app for one household. Paste a link or snap a photo; it
comes back as a clean recipe with a picture, a parsed ingredient list, allergen flags,
and a rough nutrition read. Then log what you actually cooked — your photos, everyone's
ratings.

**Locked decisions:** mobile-first PWA (Vite + React) · sources are web / TikTok+Reels /
photo / manual · nutrition is an LLM estimate plus a health score · built locally with
Claude Code.

Target running cost: **~$1–2/month**, roughly 3½¢ per recipe worst case.

---

## 1. The shape of it

Six or so people share one cookbook. Anyone can add a recipe by pasting a URL, sharing a
reel into the app, photographing a recipe card, or typing it in. Everything lands in the
same normalized shape, so search, scaling, and shopping lists work regardless of origin.

- **One household, hard-scoped.** Every row carries a `household_id`. RLS keys off it.
  No public browse, no sharing model, no moderation — the entire security story is one policy.
- **Ingredients as data, not text.** Parsed into quantity / unit / item / prep-note. That's
  what unlocks serving scaling, merged shopping lists, and ingredient search.
- **Allergies are per-person.** Each family member lists theirs. The card reads
  "contains sesame — flagged for Mom", not a generic badge nobody reads.
- **Built for the counter.** Cook mode: big type, checkable steps, screen kept awake,
  works offline. Kitchens have bad Wi-Fi and greasy hands.
- **A record of what you made.** Every cook gets logged: real photos, a star from each
  person who ate it, and what you changed. Over years this becomes the actual family cookbook.

---

## 2. Stack

| Layer | Choice | Why |
|---|---|---|
| Frontend | Vite + React + TS, Tailwind | `vite-plugin-pwa` handles manifest, service worker, offline cache with almost no config |
| Data + auth | Supabase | Postgres, auth, storage, realtime, RLS in one box. Realtime drives the live "extracting…" progress for free |
| Fast ingest | Supabase Edge Function (Deno) | Fetch HTML, parse JSON-LD, call Claude. Seconds, no container. Handles web + photo + manual |
| Video ingest | Node worker on Fly.io (Docker) | Needs `yt-dlp` + `ffmpeg` binaries, which serverless can't carry. Auto-stops when idle. **Phase 4 only** |
| AI | Claude Sonnet 5 / Haiku 4.5 | Sonnet for extraction (accuracy is the product). Haiku for the cheap enrichment pass. Both via tool-use for guaranteed JSON |
| Transcription | `gpt-4o-mini-transcribe` | $0.003/min, and a reel is one minute. Alternative: self-hosted `faster-whisper` on the same Fly box |
| Hosting | Vercel Hobby | Free, static SPA |
| Shared types | Zod schema package | One `Recipe` schema imported by edge function, worker, and UI. Doubles as the Claude tool-use JSON schema |

**Why not native:** a native app gives a proper iOS share sheet but puts TestFlight between
you and your family on every change. The PWA trades that for zero distribution friction.

---

## 3. Ingest pipeline

Four source types route to one of two extraction lanes; both lanes hand the same partial
recipe to a shared enrichment pass. Allergen logic, the health rubric, and nutrition live
in exactly one place.

```
SOURCES            ROUTE       EXTRACT                          ENRICH            STORE

Recipe URL    ─┐              ┌─ Fast lane ──────────────┐
TikTok/Reel   ─┤              │  JSON-LD schema.org      │
Photo         ─┼─► Router ────┤  else Readability+Claude ├─► Claude pass 2 ─► Supabase
Typed in      ─┘   by host    │  seconds · often $0.00   │   allergens          recipes
                   + type     │                          │   nutrition          ingredients
                              └─ Worker lane ────────────┘   health score       storage
                                 yt-dlp → caption+audio       tags              realtime→UI
                                 ffmpeg → 8 frames
                                 transcribe → Claude vision
                                 30–90s · async job
```

- **Hero image:** `og:image` for web; best-frame pick by Claude for video. Always
  re-hosted in Supabase Storage, never hotlinked.
- **Keep `raw_extract`** (transcript / page text) on the row so a better prompt later can
  re-extract without re-fetching.

### Job handling

Fast-lane ingests finish inside a request; video ingests don't. Route both through a job
row anyway — one code path, and the UI gets a progress state for free.

1. Client inserts an `ingest_jobs` row, subscribes to it via Supabase Realtime.
2. Edge function picks it up. Web/photo/manual finish in-line and mark it `done`.
3. Video jobs get an HTTP nudge to the Fly worker (wakes from stopped on the request);
   the worker updates the row as it goes.
4. UI renders status straight off the row — *fetching → transcribing → reading frames →
   estimating nutrition → done*. That narration is most of the perceived quality.

---

## 4. Data model

```
-- identity ------------------------------------------------
households        id, name, created_at
members           id, household_id, display_name, avatar_path,
                  allergies text[],
                  user_id → auth.users NULL   -- null = no login

-- the core -----------------------------------------------
recipes           id, household_id, created_by,
                  title, description, hero_image_path,
                  source_type,        -- web|tiktok|instagram|photo|manual
                  source_url, source_author,
                  servings, prep_minutes, cook_minutes,
                  instructions jsonb, -- [{step, text, image_path?}]
                  nutrition   jsonb,  -- per serving + confidence
                  health_score int, health_rationale text,
                  allergens   text[], may_contain text[],
                  tags        text[],
                  raw_extract jsonb,  -- transcript / page text — keep this
                  created_at, updated_at

ingredients       id, recipe_id, position,
                  raw_text,           -- "1½ cups flour, sifted"
                  quantity numeric, unit, item, prep_note,
                  is_optional bool, group_label

recipe_images     id, recipe_id, storage_path, kind, position
                                      -- kind: hero|step|frame

-- the cook log ---------------------------------------------
cooks             id, recipe_id, household_id,
                  cooked_by → members, cooked_on date,
                  notes,              -- "kids devoured it"
                  tweaks,             -- "half the sugar, added chili"
                  created_at

cook_photos       id, cook_id, storage_path, position, caption

cook_ratings      id, cook_id, member_id → members,
                  stars smallint,     -- 1..5
                  comment,
                  unique (cook_id, member_id)

-- family layer --------------------------------------------
comments          id, recipe_id, author_id, body, created_at
collections       id, household_id, name  + collection_recipes join

-- plumbing -------------------------------------------------
ingest_jobs       id, household_id, requested_by, input_url,
                  input_type, status, status_detail, error,
                  recipe_id, created_at
```

### RLS — the entire access-control model

Apply this shape to every table.

```sql
-- helper, marked stable so Postgres caches it per statement
create function my_household() returns uuid
  language sql stable security definer as $$
    select household_id from members where user_id = auth.uid()
  $$;

alter table recipes enable row level security;

create policy household_rw on recipes
  for all
  using      (household_id = my_household())
  with check (household_id = my_household());
```

### Three schema decisions worth defending

- **Members are not users.** `members.user_id` is nullable, so a grandparent or a
  seven-year-old can have a profile, allergies, and a star rating without a login. Tying
  identity to `auth.users` means everyone who rates a dinner needs an email account, and
  retrofitting later means migrating every foreign key in the cook log.
- **Ingredients get their own table.** A `text[]` is faster to ship and blocks scaling,
  shopping lists, and ingredient search forever.
- **Keep `raw_extract`.** Improve the prompt in month three and re-run every recipe against
  the stored transcript instead of re-scraping links that may be dead.

### Invite-only, without building an invite system

Turn off self-signup in Supabase Auth; invite the handful of accounts that need logins from
the dashboard. A trigger on `auth.users` links the new user to its `members` row. Everyone
else is a `members` row typed in on the family screen. No join codes, no admin UI.

---

## 5. The two AI passes

Kept separate so the health rubric can be retuned without touching parsing, and nutrition
can be re-run across all recipes for pennies. **Use tool-use with a JSON schema in both** —
never ask for JSON in prose and hope.

### Pass 1 · Extract (Sonnet 5)

Input varies by lane (page text, or caption + transcript + frames, or a photo). Output is
always the same tool schema.

- **Let the model parse quantities.** Regex on `"1½ cups flour, sifted"` is a losing fight.
  Ask for `{quantity: 1.5, unit: "cup", item: "flour", prep_note: "sifted"}` and it handles
  ranges, "to taste", and "2 (14 oz) cans".
- **Instruct it to say it doesn't know.** Reels rarely state servings or times. Nullable
  fields plus an explicit *"leave null rather than guess"* beats confident fabrication.
- **Frames for video.** 8 evenly spaced frames at ~512px wide. Ask for the recipe *and* the
  index of the frame that best shows the finished dish — that field is your hero image.

### Pass 2 · Enrich (Haiku 4.5)

Takes structured ingredients + servings; returns allergens, nutrition, score, tags. Runs on
every recipe including manually typed ones.

**Allergens** — constrain to a fixed enum with a separate `may_contain` list:

```
milk, egg, fish, shellfish, tree_nut, peanut, wheat, soy, sesame
```

Prompt explicitly for hidden sources: soy sauce carries wheat and soy, Worcestershire
carries fish, most pesto carries tree nuts and milk. Free-text allergen strings will
fragment and break filtering.

**Health score** — an unanchored 1–100 drifts wildly between runs. Put the rubric and
worked anchors in the prompt:

| Band | Character | Anchor |
|---|---|---|
| 90–100 | Whole foods, vegetable-forward, lean protein, little added sugar or sodium | Grilled salmon with roasted vegetables |
| 70–89 | Balanced; some refined carbs or moderate fat | Chicken burrito bowl |
| 50–69 | Comfort-leaning; refined carbs or notable fat | Baked ziti |
| 30–49 | Heavy fat, sugar, or refined starch dominates | Fettuccine alfredo |
| 0–29 | Dessert, deep-fried, or ultra-processed | Skillet cookie |

Score on: whole vs. refined ingredients, added sugar, sodium, saturated fat, fiber and
produce content, cooking method. Require a one-sentence `health_rationale` — it makes the
number accountable and reveals when the model is scoring badly.

**Nutrition** — per serving, with a required `confidence: low | medium | high`. Render as
`~520 cal` with the word *estimate* visible; gray out at low confidence.

> ⚠️ **Say this in the UI.** If anyone in the family has a real allergy, the allergen badge
> is a convenience, not a safety control. Always show the full ingredient list on the recipe
> card — never the badge alone — with a short "AI-generated, check the ingredients" line.

---

## 6. The cook log

A recipe is what the internet said to do. A *cook* is what your family actually made on a
Tuesday in October. Recipes are the input; cooks are the thing worth keeping.

### Rate the cook, not the recipe

Attaching stars to the **cook** rather than the recipe costs nothing extra and gets three
things a recipe-level rating can't:

- **Execution is visible.** The same carbonara scores a 2 the first time and a 5 the fourth.
  A single averaged recipe score erases that.
- **Disagreement survives.** Dad gave it a 5, the kids gave it a 2 — that's the useful signal
  about whether to make it again, lost the moment you collapse to one number.
- **The recipe score still exists**, as an aggregate over every rating on every cook.

### Logging has to take fifteen seconds

If logging a cook is slower than putting the leftovers away, it happens twice and then never.

| Element | Behavior |
|---|---|
| Entry point | One button on the recipe screen — **We made this** — plus an automatic prompt on exiting cook mode |
| Date | Defaults to today |
| Photos | Camera straight into `<input capture>`. Multiple shots fine. No cropping UI, no filters |
| Ratings | Row of family avatars. Tap a face, tap a star count. **One person enters everyone's ratings from one phone** |
| Tweaks | Single optional line: *"what did you change?"* |

The avatar row is the whole trick. If each person has to open the app on their own phone,
you get ratings from you and nobody else. This is also the concrete reason `members` exists
separately from `auth.users`.

### What it unlocks

- **Two scores side by side** on every card: family rating and health score. *Is it good* and
  *is it good for us*, answered independently.
- **Feed sorts people want:** favorites, made most often, not made in six months, and best of
  all **never made** — the pile everyone saved and forgot.
- **Photo timeline.** Source image once, then every real photo of it, oldest to newest.
- **Accumulated tweaks.** After four cooks with "half the sugar", the recipe is quietly wrong.
  A *fold tweaks into the recipe* button is how family recipes actually get made.

> ⚠️ **Storage math changes here.** Cook photos outnumber hero images ten to one, and phones
> produce 3–5 MB files. Uploading originals fills the 1 GB free tier inside a year.
> **Downscale client-side before upload** — canvas resize to ~1600px, WebP, quality 0.85,
> lands near 200 KB. That's ~5,000 photos in the free tier instead of ~250, in about fifteen
> lines of code.

---

## 7. Video: the hard part

Recipe websites publish machine-readable `schema.org/Recipe` JSON-LD — solved, near-perfect,
no AI cost. TikTok and Instagram publish nothing and change their internals without notice.

| Source | Method | Reliability | Maintenance |
|---|---|---|---|
| Recipe sites | JSON-LD, Claude fallback | Solid | None |
| Photo / card | Claude vision | Solid | None |
| TikTok | yt-dlp + transcribe | Usually | Update yt-dlp often |
| Instagram | yt-dlp + session cookies | Flaky | Cookies expire; expect breakage |

Instagram is the painful one. yt-dlp's tracker carries a steady stream of Instagram extractor
breakages — commonly an empty media response for reels that load fine in a browser, generally
fixed by updating to master, often requiring browser cookies for gated content.

### How to make it survivable

- **Pin `yt-dlp` in the Docker image and rebuild weekly** via a scheduled GitHub Action.
- **Always offer the manual fallback.** On failure show a paste box, not an error:
  *"Couldn't read that one. Paste the caption and I'll take it from there."*
- **Store the source URL regardless** — a failed ingest still saves a stub with the link.
- **Rate-limit yourself.** A few requests a day is invisible. Don't build a bulk importer.

> Automated downloading is against TikTok's and Instagram's terms of service. At family scale,
> for personal use, on content you're saving rather than republishing, this is a low-stakes
> gray area — but it's why this feature can never be a product, and why it belongs last.

---

## 8. Screens

| Screen | What's on it |
|---|---|
| Feed | Card grid — your latest cook photo if there is one, else the source hero. Title, total time, family rating, health score, who added it. Sort chips: favorites, recent, never made |
| Add | One big paste field, camera button, "type it out" link. Then live status narration off the job row |
| Recipe | Hero, both scores, meta row, ingredients with servings stepper and tap-to-check, numbered steps, nutrition + rationale, allergen strip with per-person warnings. Below: the cook timeline |
| Cook mode | Full-screen, one step at a time, oversized type, wake lock on, swipe to advance. Exiting the last step prompts *"log this cook?"* |
| Log a cook | Date, camera, avatar-and-stars row, one tweaks line. Fifteen seconds, one thumb, no scrolling |
| Search | Postgres full-text over title + ingredients. Filter by tag, max total time, safe-for-*person* |
| Family | Display name, avatar, allergy list. Add a member without creating a login |

---

## 9. PWA specifics

| Capability | Android | iOS | Notes |
|---|---|---|---|
| Install to home screen | Yes | Yes | iOS needs Safari → Share → Add to Home Screen. Show a one-time hint |
| Share sheet target | Yes | **No** | `share_target` is Chromium-only; WebKit has never shipped it. On iOS, hand out a Shortcut that POSTs the shared URL to your ingest endpoint |
| Camera capture | Yes | Yes | Plain `<input type="file" accept="image/*" capture>` |
| Offline recipes | Yes | Yes | Workbox cache-first for recipe JSON and hero images |
| Screen wake lock | Yes | Yes | Works in home-screen web apps since iOS 18.4. Feature-detect and degrade quietly |
| Push notifications | Yes | Installed only | iOS requires home-screen install first. Skip for v1 |

The iOS Shortcut is worth ten minutes. Watching a reel, hitting share, tapping your app's
icon, and having the recipe appear is the moment your family decides whether they'll use this.

---

## 10. Cost

| Ingest type | Breakdown | Per recipe |
|---|---|---|
| Web · JSON-LD found | No extraction call, Haiku enrichment only | ~$0.005 |
| Web · no JSON-LD | ~7k in / 1.2k out on Sonnet 5 + enrichment | ~$0.03 |
| Photo of a card | One image + Sonnet 5 + enrichment | ~$0.02 |
| Reel · 60 seconds | Transcription $0.003 + 8 frames & transcript + enrichment | ~$0.035 |

| Monthly | Plan | Cost |
|---|---|---|
| Vercel | Hobby — static SPA | $0 |
| Supabase | Free — 500 MB DB, 1 GB storage, 50k MAU | $0 |
| Fly.io worker | shared-cpu-1x, auto-stop when idle | <$1 |
| Claude + transcription | ~30 recipes/month | ~$1 |
| **Total** | Roughly $15–25/year all in | **~$1–2** |

> ⚠️ **The one free-tier trap.** Supabase pauses free projects after **one week of inactivity**,
> and a family recipe app will absolutely go quiet for a week. Point a daily cron (Vercel cron,
> a GitHub Action, or the Fly worker) at a trivial query to keep it warm. Otherwise someone
> opens the app on a Sunday to a dead database. Pro is $25/mo — the cron is the right answer.

At ~200 KB per downscaled image, 1 GB holds roughly 5,000 photos.

---

## 11. Build order

The sequencing is deliberate: the boring phases carry most of the value, and the fragile one
is last because it's the one that can fail. Stop after Phase 3 and you still have a real app.

### Phase 0 — Foundation
*~1 evening · nothing usable yet*

- Repo, Vite + React + TS + Tailwind, Supabase project
- Full schema as a migration, RLS on every table, `auth.users` → `members` trigger
- Zod schemas in `packages/shared` — **write these before any UI**
- Magic-link auth, self-signup disabled, your account invited
- Seed 3 recipes by hand so there's something to render against
- Daily cron ping so the free tier never pauses

### Phase 1 — Web ingest (the whole point)
*~2 evenings · this is ~80% of the value*

- Edge function: fetch → JSON-LD parse → Claude fallback → enrichment pass → insert
- Feed and recipe detail screens rendering real ingested data
- Hero image from `og:image`, re-hosted in Storage
- Manual entry form sharing the same submit path

Ship this to the family before building anything else. Their reaction tells you what
Phase 2 should contain.

### Phase 2 — Make it live in the kitchen
*~2 evenings · this is when people start using it*

- PWA: manifest, icons, Workbox offline cache, install prompt
- Cook mode with wake lock; servings scaler; tap-to-check ingredients
- Per-person allergy profiles and the allergen strip
- Search and filter chips
- **The image pipeline** — capture, client-side downscale to WebP, upload to Storage.
  Build once here; Phase 3 and photo ingest both ride on it
- Photo-of-a-recipe-card ingest — the Phase 1 Claude pass with an image input

### Phase 3 — The cook log
*~2 evenings · the reason it's a family app*

- `cooks`, `cook_photos`, `cook_ratings` tables and policies
- The fifteen-second log sheet: date, camera, avatar-and-stars row, tweaks line
- Auto-prompt on exiting cook mode
- Cook timeline on the recipe screen; latest cook photo becomes the feed thumbnail
- Family rating aggregate; favorites / never-made feed sorts
- Members without logins, added from the family screen

Everything here is ordinary CRUD against your own database — no external service can break
it. That's exactly why it belongs before the video work.

### Phase 4 — Video ingest
*~2–3 evenings · the fragile one*

- Fly.io Docker worker: yt-dlp + ffmpeg + transcription + Claude vision
- `ingest_jobs` + Realtime status narration in the UI
- Best-frame hero selection
- Manual caption-paste fallback on every failure
- iOS Shortcut + Android `share_target`
- Weekly GitHub Action to rebuild the image with current yt-dlp

### Phase 5 — Whatever people ask for
*open-ended*

- Shopping list: multi-select recipes, merge and de-dupe, group by aisle
- Fold accumulated tweaks into a revised recipe version
- Comments, collections, weekly meal plan
- Push notifications when someone adds or cooks something

Sit an afternoon down with a stack of your grandmother's index cards and the Phase 2 photo
ingest. It's the part of this app that will still matter in twenty years.

---

## 12. Repo layout

```
family-cookbook/
├─ apps/
│  ├─ web/                    # Vite + React PWA → Vercel
│  │  ├─ src/routes/          # feed, recipe, add, cook, log, search, family
│  │  ├─ src/lib/image.ts     # downscale-before-upload, used everywhere
│  │  ├─ src/lib/supabase.ts
│  │  └─ vite.config.ts       # vite-plugin-pwa lives here
│  └─ worker/                 # Phase 4 only → Fly.io
│     ├─ src/ingestVideo.ts
│     ├─ Dockerfile           # node + yt-dlp + ffmpeg
│     └─ fly.toml             # auto_stop_machines = true
├─ packages/shared/
│  └─ src/recipe.ts           # zod schemas — the source of truth
├─ supabase/
│  ├─ migrations/
│  └─ functions/
│     ├─ ingest-url/          # fast lane
│     └─ enrich-recipe/       # pass 2, callable standalone
└─ CLAUDE.md                  # conventions, schema notes, prompt rules
```

---

## 13. Gotchas

| Risk | Handling |
|---|---|
| Supabase free-tier pause after a quiet week | Daily cron ping. Set up in Phase 0, not after it bites |
| Instagram extractor breaks | Weekly image rebuild + manual caption fallback. Never lose the link |
| Allergen miss on a real allergy | Ingredient list always visible; badge labeled AI-generated; never the sole signal |
| Health scores drift between runs | Anchored rubric, required rationale, low temperature. Spot-check ten recipes after any prompt change |
| Phone originals filling Storage | Client-side canvas resize to ~1600px WebP before every upload |
| Cook logging never becomes a habit | Auto-prompt on cook-mode exit; one phone enters everyone's stars |
| API keys leaking into the client | Claude and transcription keys live only in edge function / worker env. The browser holds only the Supabase anon key, which RLS makes safe |
| Recipe blogs blocking the fetch | Real User-Agent, follow redirects, fall back to the paste box |
| Scope creep into a product | No public sharing, no accounts beyond the household, no monetization |

### Two decisions still open

- **Transcription provider.** OpenAI's API is one key and $0.003/min; self-hosted
  `faster-whisper` on the Fly box is free but adds ~1 GB to the image and a cold-start
  penalty. Recommend the API — the cost is genuinely nothing at this volume.
- **Domain.** A Vercel subdomain works, but a real domain makes the iOS home-screen install
  feel like an app rather than a bookmark. ~$12/yr.

---

*Build plan v2 · 24 Aug 2026 · costs are estimates at current published rates*
