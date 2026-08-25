# Family Cookbook

Private recipe app for one household. Paste a link, snap a photo, or type it in — it comes
back as a structured recipe with allergen flags and a rough nutrition/health read. Log what
you actually cooked and how everyone rated it.

Full conventions in [`CLAUDE.md`](./CLAUDE.md), the original build plan in
[`PLAN.md`](./PLAN.md), visual identity in [`BRAND.md`](./BRAND.md), and the source design
reference in [`design_handoff_family_cookbook/`](./design_handoff_family_cookbook/).

---

## Status

**Phase 0 (foundation) — done.** Schema, RLS, zod schemas, seed data, CI keepalive cron all
live on the real Supabase project.

**Phase 1 (web ingest) — mostly built, not yet committed as final.** Feed, Recipe Detail,
Cook Mode, Log a Cook, and the Add flow (link / photo / manual) all work end-to-end against
real data, including a working ingest pipeline (Claude extraction + enrichment) verified
against several real recipe sites.

**Auth is currently paused.** Google OAuth is fully wired (Cloud Console + Supabase
provider + the invite-gate DB trigger) but disabled for local development via
`VITE_DEV_SKIP_AUTH=true` in `apps/web/.env.local`. This pairs with several temporary
anon-role RLS policies (migrations `0002`, `0005`, `0006`, `0008`, `0009` — each header-
commented "TEMPORARY DEV-ONLY" with its own revert instructions). **Re-enabling real auth
means flipping that env var off and dropping those five migrations' policies** — nothing
else depends on them.

## Running locally

```
npm install
npm run dev        # apps/web, http://localhost:5173
npm run typecheck
npm run build
```

Needs `apps/web/.env.local` (`VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`) and, for the
CLI, `.env` at the repo root (`ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY`) — see
`.env.example`. Both are gitignored.

Migrations: `npx supabase db push`. Edge function: `npx supabase functions deploy ingest-url --no-verify-jwt`.

---

## What's built

**Foundation**
- Vite + React + TS + Tailwind v4 PWA, `vite-plugin-pwa` configured
- Full schema + household-scoped RLS on every table (`supabase/migrations/0001_init.sql`),
  including derive-from-parent triggers so a child row's `household_id` can't be spoofed
- `packages/shared` — the `Recipe`/`Ingredient`/allergen zod schemas, single source of truth
  for the app, the edge function, and (eventually) the video worker
- Google OAuth + invite-only gate (`reject_uninvited_signup` trigger) — see "Auth is
  currently paused" above
- "Hearth" design system (`BRAND.md`) wired into Tailwind's `@theme`

**Screens** (`apps/web/src/routes/`)
- **Feed** — recipe grid, filter chips, client-side search, real hero images
- **Recipe Detail** — full ingredient list (never hidden behind the allergen badge, per
  CLAUDE.md), allergen strip + per-member clearance chips, health score + nutrition with
  confidence-based dimming, servings scaler, tap-to-check, delete with inline confirm
- **Cook Mode** — full-screen steps, wake lock, timer and per-step ingredient chips (see
  Known issues — these are text-matching heuristics, not real data links)
- **Log a Cook** — avatar-and-stars rating row, date picker, photo preview, tweaks line
- **Add** — paste a link, take a photo, or type it in; live status narration via Realtime;
  a real success confirmation ("X is in the cookbook") instead of a silent redirect
- **Setup** (`/setup`, `/setup/step-3`) — the iOS "add to home screen + share sheet"
  onboarding from the design's screens 4a/4b. Step 1 is fully real; steps 2–3 describe the
  Phase 4 Shortcut/share-target flow and are honestly marked not-yet-available rather than
  linking to something that doesn't exist

**Ingest pipeline** (`supabase/functions/ingest-url/`)
- One edge function, three entry points, one shared Haiku enrichment pass:
  - **Web** — JSON-LD `schema.org/Recipe` parse when present (cheap, combines ingredient
    parsing + enrichment in one Haiku call), else Sonnet extraction over scraped page text
  - **Photo** — Sonnet vision extraction over a client-downscaled WebP (`lib/image.ts`,
    per CLAUDE.md's never-upload-a-phone-original rule)
  - **Manual** — user types title/servings/steps directly; ingredient lines still go
    through Claude for quantity/unit/item parsing (never regexed, per CLAUDE.md)
- Hero images re-hosted into a private Storage bucket, displayed via signed URLs
- Verified against multiple real recipe sites (Cookie and Kate, We Are Not Martha) with
  correct ingredient parsing, allergens, health scores, and nutrition estimates

## Known issues

- **Mojibake in instruction text** on the JSON-LD fast path — e.g. "jalapeño" renders as
  "jalapeÃ±o", HTML entities like `&#39;` sometimes left undecoded. Root cause is upstream
  in `deno-dom`'s script-tag text extraction; ingredients go through Claude (which happens
  to self-correct it) but instructions are copied verbatim. Not fixed — a wrong blind
  encoding fix could corrupt correctly-encoded text elsewhere.
- **Many recipe sites block server-side fetches** (Cloudflare/bot-protection keyed on
  cloud-provider IP ranges — confirmed on allrecipes.com and simplyrecipes.com; works fine
  from a residential IP). No workaround built; fails to the error state with a link to
  manual entry, which is the intended fallback per PLAN.md.
- **Favorites don't persist.** The heart button on Recipe Detail is visual only — there's
  no `is_favorite` concept anywhere in the schema.
- **Cook photos aren't uploaded**, only previewed locally in Log a Cook. The downscale
  pipeline exists (`lib/image.ts`) but isn't wired to an actual Storage upload for cook
  photos yet.
- **Cook Mode's per-step ingredient chips and timer are heuristics** (matching ingredient
  item names / a "N minutes" pattern against the step's own text), not real data — the
  schema has no per-step ingredient or duration association.

## Not built yet

- **Video ingest (TikTok/Reels)** — Phase 4. Needs its own Fly.io worker (yt-dlp + ffmpeg +
  transcription), the iOS Shortcut file itself, share-target registration, and a weekly
  yt-dlp rebuild pipeline. The Setup screens (4a/4b) describe this flow but it's not live.
- **Ingest progress/fallback screens** (design's 3b/3c) — the Add screen has simpler inline
  status narration and error handling instead; functionally equivalent, visually simpler.
- **Server-side search** — current search/filter is client-side over already-loaded
  recipes, not Postgres full-text search.
- **PWA icons** — `vite.config.ts` still points at placeholder paths.
- **Family screen** — no UI yet for managing members, allergy profiles, or adding a member
  without a login.
- **"Cooks" nav tab** — present in the Feed's bottom nav, not wired to anything.
- **Collections, shopping list, meal plan** — Phase 5.
