# BRAND.md — Family Cookbook

Visual and voice identity for the app. Read alongside `CLAUDE.md` (conventions) and
`PLAN.md` (build plan). This doc is the source of truth for design tokens — when it
changes, `apps/web/src/index.css` (`@theme` block) and `vite.config.ts` (PWA manifest
colors) should be updated to match.

**Full per-screen specs, interactions, and state shape live in
[`design_handoff_family_cookbook/README.md`](./design_handoff_family_cookbook/README.md)**
— nine screens (feed, recipe detail, cook mode, log-a-cook, ingest flow, iOS share setup),
high-fidelity, chosen via Claude Design. This file is the condensed identity reference;
don't duplicate the per-screen detail here, it drifts.

Working name is **Family Cookbook**.

---

## Voice

- **Personal, not corporate.** Talks like a family member, not a SaaS product. "Add a
  recipe," not "create a new recipe entry."
- **Honest about being AI-assisted.** Nutrition and allergen data are always labeled as
  estimates — CLAUDE.md's safety requirement. The voice never oversells what the model
  actually knows.
- **Short.** Kitchen screens get glanced at with wet hands. Five words beats a clever
  sentence.

---

## Direction: "Hearth"

Chosen over two alternates (Counter — paper white/graphite/teal, Instrument Sans; Jam —
bright cream/magenta/amber, Bricolage Grotesque), both kept in the handoff bundle for
reference only, not to be mixed in. Hearth: terracotta, cream, sage — the well-loved
recipe box, not a dashboard.

## Color tokens

| Token | Hex | Use |
|---|---|---|
| `cream` | `#FBF6EC` | App background, text on dark surfaces |
| `cream-2` | `#F2E8D9` | Cards, chips, inputs, secondary buttons |
| `cream-3` | `#F7EFE1` | Text-entry surfaces (paste box) |
| `terracotta` | `#B4552F` | Primary action, ingredient quantities, active accents |
| `terracotta-tint` | `#F3E2DA` | Allergen chip background |
| `terracotta-text` | `#9A3E1E` | Allergen chip text |
| `sage` | `#7E8F6E` | Health score, success/complete states, per-member allergy-clearance chips |
| `sage-tint` | `#EDF0E7` | Success panel / clearance chip background |
| `sage-text` | `#5C6B4C` / `#4F5C41` | Text on sage tint |
| `ochre` | `#C08A3E` | Third avatar tone — used sparingly |
| `ink` | `#2E2621` | Headings, dark surfaces (nav bar, cook mode) |
| `ink-2` | `#5C4E42` | Body text on cream |
| `muted` | `#9C8B78` | Meta text, mono labels, placeholders |
| `line` | `rgba(60,40,25,.07–.14)` | Hairlines, borders |
| `placeholder` | `#E4D3BB` / `#DCC9AE` | Photo placeholder stripes, empty avatars |

Max two background colors per screen. Dark surfaces (cook mode) use `ink` with cream text
at 100% / 60% / 45% opacity.

**Health score is always `sage`** — a single color, not a red→green gradient by band.
The 5-band 0–100 rubric with worked anchors (CLAUDE.md) is a scoring guide for the AI
prompt, not a UI color scale. **Allergens are `terracotta-tint`/`terracotta-text`** (e.g.
"Contains fish"); a **per-member clearance chip** ("Sam: peanut — clear") is
`sage-tint`/`sage-text` — distinct from the health/success sage so "cleared for this
person" doesn't read as a blanket safety signal.

## Typography

| Role | Family | Scale |
|---|---|---|
| Display / headings | **Newsreader**, weight 500, `letter-spacing:-.01em` | 30px screen title · 27→25px recipe title · 19/18px section head · 16/15px card title · **40px/1.2 cook-mode step** |
| Body / UI | **Karla**, 400/500/600 | 17px primary button · 15px body/list · 14px secondary · 13px · 12px chips · 11px |
| Quantities, labels, meta | **IBM Plex Mono**, 400/500 | 13px ingredient quantity · 12/11/10/9px. Uppercase labels: `letter-spacing:.12–.14em` |

Google Fonts: `Newsreader:wght@400;500;600`, `Karla:wght@400;500;600;700`,
`IBM Plex Mono:wght@400;500`.

## Shape, spacing, shadow

- Screen gutter **20px**. Card padding 14–16px. Vertical rhythm 6/10/14/18/22px.
- Radius: pills `30px` (primary CTA) / `26px`, cards `18px`/`16px`/`14px`, chips `12px`,
  small `8–10px`, avatars `50%`, sheet top corners `22–26px`.
- Shadows: primary CTA `0 10px 24px rgba(180,85,47,.3)`; dark nav/toast
  `0 10–12px 26–28px rgba(46,38,33,.28–.3)`.
- Phone frame reference: 390×844 (iPhone 14/15), safe bottom inset 26px.
- Photo placeholder: `repeating-linear-gradient(135deg, #E4D3BB 0 9px, #DCC9AE 9px 18px)`
  with a monospace caption — real images come from `recipe_images`/`cook_photos` in Storage.

---

## Icon / logo

Two shortlisted candidates in
[`design_handoff_family_cookbook/logo/`](./design_handoff_family_cookbook/logo/README.md)
— same top-down skillet mark, two tiles. **Not yet decided**; the plan is to pick once real
UI exists to see them against, not in isolation.

| Candidate | Tile | Character |
|---|---|---|
| `9a-cream-tile` | `#F2E8D9` oat cream, ink pan, terracotta cooking surface | Quiet — recedes on a busy home screen |
| `9d-gradient-tile` | Terracotta gradient, ink pan, pale cream cooking surface | Warmer, louder; drops the hang-hole detail (closes up at small sizes on the gradient) |

SVG is the source; PNGs are 512×512 previews, corner radius 116/512 to match the iOS
squircle. Needed for real at 192×192 and 512×512 for the PWA install icon
(`vite.config.ts` still references placeholder paths — tracked as a Phase 2 item).

---

## Implementation mapping (not yet applied)

- `apps/web/src/index.css` — `@theme` block below `@import "tailwindcss";` defining the
  tokens above as Tailwind v4 theme variables (`--color-cream`, `--color-terracotta`, etc.)
  and `@font-face`/Google Fonts import for Newsreader, Karla, IBM Plex Mono
- `vite.config.ts` — PWA manifest `background_color`/`theme_color`: `#FBF6EC` / `#B4552F`
- `index.html` — `<meta name="theme-color">` to match

## Non-negotiables (CLAUDE.md — do not design or code around these)

1. Full ingredient list always visible. Allergen badge is a convenience, never a safety
   control — never hide ingredients behind it.
2. "AI-generated — check the ingredients" note visible on the recipe screen.
3. Nutrition and health score always carry a visible "estimate" qualifier; gray out
   (`opacity:.45`) at low confidence.
4. A failed video ingest falls back to a caption paste box and saves a stub with the
   source URL — never an error screen.
