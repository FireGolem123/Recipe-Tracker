# Handoff: Family Cookbook — visual direction & core screens

## Overview

A private recipe app for one household (~6 people). Recipes are saved from links, photos,
and short-form video; the household logs what it actually cooks, with per-person star
ratings. Not a product: no public sharing, no monetization.

This bundle covers the **visual direction** (chosen: "Hearth") and **nine screens**:
the feed, recipe detail, cook mode, log-a-cook, the share-to-save ingest flow (3 states),
and the one-time iOS Shortcut setup (2 screens).

Target codebase: `FireGolem123/Recipe-Tracker` — Vite + React 18 + TypeScript + Tailwind v4,
PWA via `vite-plugin-pwa`, Supabase backend. At time of handoff the repo is at **Phase 0**:
schema, RLS, zod schemas and seed data exist; `apps/web/src` has only `App.tsx`, `main.tsx`,
`index.css`, `lib/supabase.ts`. There is no existing UI to match — these designs are the
starting point for the UI layer.

## About the Design Files

`Family Cookbook.dc.html` in this folder is a **design reference created in HTML** — a
prototype showing the intended look and behavior. It is **not production code to copy**.
It renders all screens side by side on a canvas with option ids (`1a`, `2b`, `3c`…) used
throughout this document.

The task is to **recreate these designs in the existing codebase**: React function
components under `apps/web/src`, styled with Tailwind v4, typed against the zod schemas in
`packages/shared/src/recipe.ts`, reading real data through `lib/supabase.ts`. Do not port
the HTML or its inline styles; translate the values below into Tailwind classes/theme tokens.

Open it by serving the folder (`npx serve .`) and opening `Family Cookbook.dc.html` —
`support.js` must sit alongside it.

## Fidelity

**High-fidelity.** Colors, typography, spacing, and radii are final and should be matched
closely. Photography is represented by striped placeholders — real images come from
`recipe_images` / `cook_photos` in Supabase Storage. Interactions in the prototype
(cook-mode step nav, avatar/star rating, setup checklist) are real and demonstrate intent.

---

## Design Tokens — "Hearth"

### Color

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FBF6EC` | App background, text on dark |
| `cream-2` | `#F2E8D9` | Cards, chips, inputs, secondary buttons |
| `cream-3` | `#F7EFE1` | Text-entry surface (paste box) |
| `terracotta` | `#B4552F` | Primary action, quantities, active accents |
| `terracotta-tint` | `#F3E2DA` | Allergen chip background |
| `terracotta-text` | `#9A3E1E` | Allergen chip text |
| `sage` | `#7E8F6E` | Health score, success/complete states |
| `sage-tint` | `#EDF0E7` | Success panel background |
| `sage-text` | `#5C6B4C` / `#4F5C41` | Text on sage tint |
| `ochre` | `#C08A3E` | Third avatar tone (used sparingly) |
| `ink` | `#2E2621` | Headings, dark surfaces (nav bar, cook mode) |
| `ink-2` | `#5C4E42` | Body text on cream |
| `muted` | `#9C8B78` | Meta text, mono labels, placeholders |
| `line` | `rgba(60,40,25,.07–.14)` | Hairlines and borders |
| `placeholder` | `#E4D3BB` / `#DCC9AE` | Photo placeholder stripes, empty avatars |

Max two background colors per screen. Dark surfaces use `ink` `#2E2621` with cream text at
100% / 60% / 45% opacity.

### Typography

- **Display / headings** — `Newsreader`, weight 500, `letter-spacing:-.01em`.
  Scale: 30px (screen title), 27→25px (recipe title), 19/18px (section head), 16/15px (card title).
  Cook mode step: **40px / line-height 1.2**.
- **Body / UI** — `Karla`, 400/500/600. Scale: 17px (primary button), 15px (body, list items),
  14px (secondary), 13px, 12px (chips), 11px.
- **Quantities, labels, meta** — `IBM Plex Mono`, 400/500. Scale: 13px (ingredient quantity),
  12px, 11px, 10px, 9px. Uppercase labels use `letter-spacing:.12–.14em`.

Google Fonts: `Newsreader:wght@400;500;600`, `Karla:wght@400;500;600;700`, `IBM Plex Mono:wght@400;500`.

### Spacing, radius, shadow

- Screen gutter: **20px**. Card padding: 14–16px. Vertical rhythm: 6 / 10 / 14 / 18 / 22px.
- Radius: pills `30px` (primary CTA), `26px`, cards `18px`, `16px`, `14px`, chips `12px`,
  small `8–10px`, avatars `50%`. Sheet top corners `22–26px`.
- Shadows: primary CTA `0 10px 24px rgba(180,85,47,.3)`; dark nav/toast `0 10–12px 26–28px rgba(46,38,33,.28–.3)`.
- Phone frame in the mocks: **390 × 844** (iPhone 14/15 logical size), safe bottom inset 26px.

### Photo placeholders

`repeating-linear-gradient(135deg, #E4D3BB 0 9px, #DCC9AE 9px 18px)` with a monospace caption.
Replace with real images; keep the same radii and aspect behavior.

---

## Screens / Views

Ids match the badges in the prototype.

### 2a — Feed (`/`)
**Purpose:** browse the cookbook; photo-forward.
**Layout:** column. Status bar → header (mono household eyebrow + 30px Newsreader wordmark,
36px avatar right) → 40px search pill (`cream-2`, radius 20) → horizontal filter chips
(All / Dinner / Under 30 / Never cooked; active = `ink` fill, cream text) → **2-column grid,
gap 18px row / 14px column, gutter 20px**.
**Card:** photo first, radius 14, **variable height (150–190px) to create a masonry-ish
rhythm**; overlay badges top-right (`rgba(46,38,33,.72)` pill, e.g. "3 cooks") or `sage`
"new"; below: 15px Newsreader title (2 lines max), then a row of mono time + terracotta star
glyphs, then an overlapping avatar row (18px circles, `-6px` margin, 1.5px cream border,
`+N` overflow chip in `#E4D3BB`).
**Bottom:** cream gradient fade (96px) over a floating `ink` bar (radius 31, height 62,
inset 20px, bottom 22px) with "Cookbook" / "Cooks" and a 46px terracotta `+` circle.
**Empty/never-cooked state:** mono "never cooked" in terracotta replaces the star row.

### 2b — Recipe detail (`/recipe/:id`)
**Purpose:** decide to cook it; the safety-critical screen.
**Layout:** 210px hero photo (back and favorite buttons as 38px cream circles at top 52px)
→ content sheet pulled up `-28px`, radius 26 top, gutter 20px.
Order: mono source line → 25px Newsreader title → mono meta row (`serves 4 · 15 prep ·
20 cook`) with hairline under → allergen strip → AI note → health + nutrition row →
**full ingredient list** → sticky CTA.

**Allergen strip:** chips only, never a replacement for the list. "Contains fish" in
`terracotta-tint`/`terracotta-text`; per-member clearance chip ("Sam: peanut — clear") in
`sage-tint`/`sage-text`. Allergen values come from the fixed enum
(`milk, egg, fish, shellfish, tree_nut, peanut, wheat, soy, sesame`) plus `may_contain`.

**Required note, directly under the strip:** "AI-generated — check the ingredients below."
11px IBM Plex Mono, `muted`.

**Health + nutrition row:** two `cream-2` cards, radius 14, gap 12.
Left (104px fixed): mono "Health · est." label, 34px Newsreader score in `sage`, 4px progress
bar (`#E2DACB` track, sage fill = score%), then `health_rationale` at 10px Karla.
Right (flex): mono "Per serving · estimate · medium confidence", then a 3-column grid of
value (17px Newsreader) + unit (9px mono). **Any field whose confidence is low renders at
`opacity:.45` with a "low conf." unit suffix.**

**Ingredients:** section head (18px Newsreader) + "for 4 · scale" mono link. Each row:
74px fixed quantity column in 13px mono terracotta (or `optional` in `muted`), then item in
14px Karla `ink` with `prep_note` appended in `muted` after an em dash. 7px vertical padding,
hairline between rows, none on the last. **All ingredients must be reachable — the list is
never collapsed, truncated, or hidden behind the allergen summary.** In the real app the
sheet scrolls; keep a 96px spacer so the last row clears the CTA.

**CTA:** full-width 60px terracotta pill "Start cook mode", sitting on a cream gradient.

### 2c — Cook mode (`/recipe/:id/cook`)
**Purpose:** one-handed use at counter distance, greasy hands, high contrast.
**Layout:** full-screen `ink`. Header: mono recipe name + 15px "Step 2 of 3", 52px circular
close button. Three-segment progress bar (5px, terracotta = done, `rgba(251,246,236,.16)` = not).
Body: **40px Newsreader step text, line-height 1.2, `text-wrap: pretty`**, 24px gutter, then
this step's ingredient chips (16px Karla, `rgba(251,246,236,.09)` fill, radius 12, 10/15px padding).
Footer: 64px outlined timer button ("⏱ Start 15 min timer"), then **92px-tall** controls —
104px back square (radius 20, translucent) + flexed terracotta "Next step" (26px Karla).
On the last step the primary button reads "Done — log it" and routes to 2d.
Everything tappable is ≥ 52px; primary targets are 92px.
Screen should also request a wake lock while open.

### 2d — Log a cook (`/recipe/:id/log`)
**Purpose:** record one cook and everyone's rating from a single phone.
**Layout:** title row ("Log a cook", 26px Newsreader + Cancel) → recipe row (52px thumb +
title + mono "3rd time · last cooked Mar 2") → date segmented row (3 × 44px: Tonight /
Yesterday / Pick date, active = `ink`) → photo row (92px dashed "Camera" tile + 92px thumbs)
→ "How was it?" (19px Newsreader) → **avatar row** → active-member rating card → tweaks line
→ 60px terracotta "Save cook".

**Avatar row (the required pattern — not a single star rating):** one 44px circle per member
(`#E4D3BB`, initial in 15px Karla), gap 12, star count underneath in 9px mono terracotta
(`★★★★` or `–` when unrated). The selected member gets `box-shadow: 0 0 0 2.5px #B4552F`.
Tapping a face selects that member.

**Rating card:** `cream-2`, radius 16, padding 16. Label "{Name}'s rating" then five **54px**
star buttons (radius 14, `cream` fill, 26px glyph, terracotta) — `★` filled / `☆` empty.
Writes one `cook_ratings` row per member; members without ratings are simply omitted.

**Tweaks line:** mono uppercase "What we changed" + a single 15px underlined text input
("Swapped broccoli for green beans"). One line, not a notes field.

### 3a — Share sheet (OS-level, not app UI)
Reference only: shows the app as a share target with a 58px terracotta rounded-square icon
(radius 16, 26px Newsreader "C"). Nothing to build beyond the icon and the share-target
registration.

### 3b — Ingest in progress (feed with job card)
**Purpose:** the user shared a reel and never opened the app; the work happens in the background.
**Job card** at the top of the feed: `cream-2`, radius 18, 1px `rgba(180,85,47,.18)` border,
padding 15. Row: 52px thumb + "Watching the reel for you…" (14px Karla 600) + mono
"@handle · added by Nate · 40s". Then a 4-step checklist — `✓` sage (done), `◐` terracotta
(current, 500 weight), `○` muted at `opacity:.45` (pending): Downloaded the video →
Transcribed the audio → Reading the ingredients off screen → Allergens, nutrition, health score.
Then a 4px progress bar. Backed by `ingest_jobs`; subscribe via Supabase Realtime.
**Completion toast:** `ink` card pinned above the nav (radius 16, padding 14/16) with 34px
thumb, title "X is in the cookbook", mono meta "15 min · contains soy, wheat, sesame", and
an "Open" link in `#E8A87C`.

### 3c — Ingest fallback (paste the caption)
**Purpose:** required by CLAUDE.md — a failed video fetch is never an error screen.
Title "Almost got it" (26px Newsreader) + "Later" · explanatory body naming the platform ·
"Saved as a stub" card showing the source URL (a real recipe row already exists) ·
`cream-3` paste box (radius 16, 1.5px border, 210px, 15px Karla) · mono hint about screenshots ·
two CTAs: 60px terracotta "Read the recipe from this" + 52px `cream-2` "Add a screenshot instead".

### 4a — Sharing setup checklist (iOS only)
**Purpose:** one-time per phone; sent to each family member.
Mono eyebrow "Three minutes, once" → 30px Newsreader "Set up sharing on this phone" →
14px body → progress row (5px bar, sage fill, mono "N of 3 done") → three tappable step cards
(`cream-2`, radius 18, padding 16): 32px numbered circle (`#E4D3BB` → `sage` with `✓` when
done), 15px Karla title, 13px body, 10px mono meta. Card background lightens to `#F4EFE4`
when done. Steps: (1) Add to Home Screen in Safari, (2) install the "Save to Cookbook"
shortcut, (3) pin it in the share sheet.
CTA: 60px terracotta "Install the shortcut" + mono line "Android? It just works — skip all of this."
On Android the whole screen is skipped; the PWA registers as a share target directly.

### 4b — Setup step 3 detail
Illustrates the iOS "Edit actions" list: the target row is highlighted (`#F5EDE0`, 1.5px
terracotta border) with `＋` / app icon / label / `≡` handle; other rows at `opacity:.5`
with `−`. Below: instruction line and a `sage-tint` "test it now" panel. Footer: 96px "Back"
+ flexed terracotta "Done — it's working".

---

## Interactions & Behavior

- **Cook mode:** next/back step; last step's primary CTA becomes "Done — log it" → 2d.
  Progress segments fill as steps complete. Close returns to detail. No transitions needed
  beyond an instant swap; keep it snappy and glanceable.
- **Log a cook:** tapping an avatar sets the active member; tapping star N sets that member's
  rating to N. Ratings persist per member for this cook. Save writes `cooks` + `cook_photos`
  + one `cook_ratings` row per rated member.
- **Setup checklist:** each card toggles done; the progress bar and counter follow.
- **Ingest:** job card appears on share receipt and updates live; on failure it becomes 3c.
- **Hover/active:** touch-first — use a subtle press state (opacity ~.9 or a 1–2% darken),
  no hover-only affordances.
- **Loading:** the ingest job card *is* the loading state. For lists, use `cream-2` blocks at
  the card's dimensions rather than spinners.

## State Management

- `feed`: recipes list + active filter + search query; realtime `ingest_jobs` for the household.
- `recipeDetail`: recipe + ingredients + nutrition/health + allergens + household allergy
  profiles (to compute the per-member clearance chip).
- `cookMode`: `stepIndex`, derived `step`, wake lock handle, optional timer.
- `logCook`: `date`, `photos[]`, `activeMemberId`, `ratings: Record<memberId, 1–5>`, `tweaks` string.
- `setup`: three booleans, persisted locally per device.

## Assets

None shipped. Photo placeholders stand in for `recipe_images` / `cook_photos`; icons are
text glyphs in the prototype (`←`, `✕`, `♡`, `⌕`, `★`, `☆`, `⏱`, `≡`) and should be replaced
with a real icon set of the developer's choice, sized to match. Fonts are Google Fonts
(Newsreader, Karla, IBM Plex Mono) — self-host or use the PWA-safe hosted route.

## Alternate directions (not chosen — for reference)

Turn 1 in the prototype shows three directions. **1a "Hearth" is the chosen direction** and
is what this document specifies. 1b "Counter" (paper white / graphite / `#2F6F5E`, Instrument
Sans) and 1c "Jam" (`#FFF8EE` / `#D6355E` / `#F2A93B`, Bricolage Grotesque) remain in the file
as comparison only. Do not mix them in.

## Files

- `Family Cookbook.dc.html` — all screens, this bundle's design reference
- `support.js` — runtime required to open the HTML file locally
- `screenshots/` — one PNG per screen, 2x, named `NN-<screen>-<id>.png`:

| File | Screen |
|---|---|
| `01-style-1a-hearth.png` | Style direction 1a — **chosen** |
| `02-style-1b-counter.png` | Style direction 1b (reference only) |
| `03-style-1c-jam.png` | Style direction 1c (reference only) |
| `04-feed-2a.png` | Feed |
| `05-recipe-detail-2b.png` | Recipe detail |
| `06-cook-mode-2c.png` | Cook mode |
| `07-log-a-cook-2d.png` | Log a cook |
| `08-share-sheet-3a.png` | OS share sheet (reference) |
| `09-ingest-progress-3b.png` | Ingest in progress + completion toast |
| `10-ingest-fallback-3c.png` | Ingest fallback — paste caption |
| `11-setup-checklist-4a.png` | Sharing setup checklist (iOS) |
| `12-setup-step3-4b.png` | Setup step 3 detail |

When screens are added or revised, keep this naming scheme (`NN-<screen>-<option id>.png`)
and the option ids stable so a future handoff is a diff, not a re-read.

## Non-negotiables (from the repo's CLAUDE.md — do not design or code around these)

1. The recipe screen **always** renders the full ingredient list. The allergen badge is a
   convenience, never a safety control. Never hide ingredients behind an allergen summary.
2. The "AI-generated — check the ingredients" note is visible on the recipe screen.
3. Nutrition and health score always carry a visible "estimate" qualifier and gray out at
   low confidence.
4. The recipe shape is defined once in `packages/shared/src/recipe.ts` — never redefined in the UI.
5. Every table is household-scoped with RLS; `members.user_id` is nullable (kids and
   grandparents have no login but do have avatars, allergies, and ratings).
6. A failed video ingest always falls back to a caption paste box and saves a stub with the
   source URL — never an error screen.
