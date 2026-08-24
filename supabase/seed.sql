-- Local/dev seed data: one household, a few members, and 3 hand-written
-- recipes so there's something to render before the ingest pipeline exists.
-- Applied by `supabase db reset` (always against a fresh database) — never
-- part of the versioned migration history, so this never runs against a
-- deployed environment. Fixed ids + `on conflict do nothing` on the
-- top-level rows make a manual re-run harmless; ingredient rows use
-- generated ids since they're only ever seeded once per reset.

insert into households (id, name) values
  ('00000000-0000-0000-0000-000000000001', 'Sample Household')
on conflict (id) do nothing;

-- Nate gets user_id linked automatically by the auth trigger in
-- 0001_init.sql on first login — no auth.users row exists yet to
-- reference, so it can't be set here. Sam and Jordan are members without
-- logins, per CLAUDE.md's "members.user_id is nullable".
insert into members (id, household_id, display_name, email, allergies) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-000000000001', 'Nate', 'nate@swansonpa.com', '{}'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-000000000001', 'Sam', null, '{peanut}'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-000000000001', 'Jordan', null, '{}')
on conflict (id) do nothing;

-- ============================================================
-- recipe 1 — health rubric anchor for the 90-100 band (CLAUDE.md)
-- ============================================================

insert into recipes (
  id, household_id, created_by, title, description, source_type,
  servings, prep_minutes, cook_minutes, instructions,
  nutrition, health_score, health_rationale,
  allergens, may_contain, tags
) values (
  '00000000-0000-0000-0000-000000000101',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'Grilled Salmon with Roasted Vegetables',
  'Weeknight salmon with a sheet pan of roasted vegetables.',
  'manual',
  4, 15, 20,
  '[
    {"step": 1, "text": "Toss broccoli and bell pepper with olive oil, salt, and pepper. Roast at 425F for 15 minutes.", "image_path": null},
    {"step": 2, "text": "Season salmon fillets with salt, pepper, and lemon. Grill 4-5 minutes per side.", "image_path": null},
    {"step": 3, "text": "Serve salmon over the roasted vegetables with a lemon wedge.", "image_path": null}
  ]'::jsonb,
  '{"calories": 420, "protein_g": 38, "carbs_g": 14, "fat_g": 24, "fiber_g": 5, "sugar_g": 4, "sodium_mg": 380, "confidence": "medium"}'::jsonb,
  94,
  'Lean protein and vegetable-forward with minimal added sugar or refined carbs.',
  '{fish}'::allergen_t[],
  '{}'::allergen_t[],
  '{dinner,healthy,seafood}'
)
on conflict (id) do nothing;

insert into ingredients (recipe_id, position, raw_text, quantity, unit, item, prep_note, is_optional, group_label) values
  ('00000000-0000-0000-0000-000000000101', 1, '4 (6 oz) salmon fillets', 4, 'fillet', 'salmon', '6 oz each', false, null),
  ('00000000-0000-0000-0000-000000000101', 2, '1 lb broccoli florets', 1, 'lb', 'broccoli florets', null, false, null),
  ('00000000-0000-0000-0000-000000000101', 3, '1 red bell pepper, sliced', 1, null, 'red bell pepper', 'sliced', false, null),
  ('00000000-0000-0000-0000-000000000101', 4, '2 tbsp olive oil', 2, 'tbsp', 'olive oil', null, false, null),
  ('00000000-0000-0000-0000-000000000101', 5, '1 lemon, cut into wedges', 1, null, 'lemon', 'cut into wedges', false, null),
  ('00000000-0000-0000-0000-000000000101', 6, 'salt and pepper to taste', null, null, 'salt and pepper', 'to taste', true, null);

-- ============================================================
-- recipe 2 — health rubric anchor for the 70-89 band
-- ============================================================

insert into recipes (
  id, household_id, created_by, title, description, source_type,
  servings, prep_minutes, cook_minutes, instructions,
  nutrition, health_score, health_rationale,
  allergens, may_contain, tags
) values (
  '00000000-0000-0000-0000-000000000102',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'Chicken Burrito Bowl',
  'Rice bowl with seared chicken thighs, black beans, and salsa.',
  'manual',
  4, 15, 20,
  '[
    {"step": 1, "text": "Season chicken thighs with cumin, chili powder, salt, and pepper. Sear 6-7 minutes per side, then slice.", "image_path": null},
    {"step": 2, "text": "Warm the rice and black beans. Divide between bowls.", "image_path": null},
    {"step": 3, "text": "Top with chicken, corn, salsa, shredded cheese, and cilantro. Serve with lime wedges.", "image_path": null}
  ]'::jsonb,
  '{"calories": 560, "protein_g": 36, "carbs_g": 58, "fat_g": 18, "fiber_g": 9, "sugar_g": 4, "sodium_mg": 640, "confidence": "medium"}'::jsonb,
  76,
  'Balanced protein and fiber from beans and rice, with moderate fat from cheese and cooking oil.',
  '{milk}'::allergen_t[],
  '{}'::allergen_t[],
  '{dinner,mexican,meal-prep}'
)
on conflict (id) do nothing;

insert into ingredients (recipe_id, position, raw_text, quantity, unit, item, prep_note, is_optional, group_label) values
  ('00000000-0000-0000-0000-000000000102', 1, '1.5 lb boneless chicken thighs', 1.5, 'lb', 'chicken thighs', 'boneless', false, null),
  ('00000000-0000-0000-0000-000000000102', 2, '2 cups cooked rice', 2, 'cup', 'rice', 'cooked', false, null),
  ('00000000-0000-0000-0000-000000000102', 3, '1 (15 oz) can black beans, drained', 15, 'oz', 'black beans', 'drained', false, null),
  ('00000000-0000-0000-0000-000000000102', 4, '1 cup corn', 1, 'cup', 'corn', null, false, null),
  ('00000000-0000-0000-0000-000000000102', 5, '1 cup salsa', 1, 'cup', 'salsa', null, false, null),
  ('00000000-0000-0000-0000-000000000102', 6, '1/2 cup shredded cheddar', 0.5, 'cup', 'cheddar cheese', 'shredded', true, null),
  ('00000000-0000-0000-0000-000000000102', 7, 'cilantro and lime wedges, to serve', null, null, 'cilantro and lime', 'to serve', true, null);

-- ============================================================
-- recipe 3 — health rubric anchor for the 0-29 band
-- ============================================================

insert into recipes (
  id, household_id, created_by, title, description, source_type,
  servings, prep_minutes, cook_minutes, instructions,
  nutrition, health_score, health_rationale,
  allergens, may_contain, tags
) values (
  '00000000-0000-0000-0000-000000000103',
  '00000000-0000-0000-0000-000000000001',
  '00000000-0000-0000-0000-000000000011',
  'Skillet Chocolate Chip Cookie',
  'One giant cookie baked in a cast iron skillet, served warm.',
  'manual',
  8, 10, 25,
  '[
    {"step": 1, "text": "Cream softened butter with brown and white sugar until fluffy.", "image_path": null},
    {"step": 2, "text": "Mix in egg and vanilla, then fold in flour, baking soda, salt, and chocolate chips.", "image_path": null},
    {"step": 3, "text": "Press into a greased skillet and bake at 350F for 20-25 minutes until golden. Serve warm.", "image_path": null}
  ]'::jsonb,
  '{"calories": 610, "protein_g": 6, "carbs_g": 72, "fat_g": 32, "fiber_g": 2, "sugar_g": 48, "sodium_mg": 310, "confidence": "medium"}'::jsonb,
  12,
  'Butter, sugar, and refined flour dominate with minimal fiber or protein.',
  '{wheat,egg,milk}'::allergen_t[],
  '{tree_nut}'::allergen_t[],
  '{dessert,baking,comfort}'
)
on conflict (id) do nothing;

insert into ingredients (recipe_id, position, raw_text, quantity, unit, item, prep_note, is_optional, group_label) values
  ('00000000-0000-0000-0000-000000000103', 1, '1/2 cup butter, softened', 0.5, 'cup', 'butter', 'softened', false, null),
  ('00000000-0000-0000-0000-000000000103', 2, '1/4 cup brown sugar', 0.25, 'cup', 'brown sugar', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 3, '1/4 cup white sugar', 0.25, 'cup', 'white sugar', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 4, '1 egg', 1, null, 'egg', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 5, '1 tsp vanilla extract', 1, 'tsp', 'vanilla extract', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 6, '1.5 cups flour', 1.5, 'cup', 'flour', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 7, '1/2 tsp baking soda', 0.5, 'tsp', 'baking soda', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 8, '1/4 tsp salt', 0.25, 'tsp', 'salt', null, false, null),
  ('00000000-0000-0000-0000-000000000103', 9, '1 cup chocolate chips', 1, 'cup', 'chocolate chips', null, false, null);
