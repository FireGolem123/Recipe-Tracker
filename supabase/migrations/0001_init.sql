-- Family Cookbook — schema, RLS, and the auth.users -> members link.
-- Every table is household-scoped; my_household() and the household_rw
-- policy shape below are the entire access-control model (see CLAUDE.md).
--
-- Child tables (ingredients, recipe_images, comments, cooks, cook_photos,
-- cook_ratings, collection_recipes) don't trust a client-supplied
-- household_id: a BEFORE trigger derives it from the parent row instead.
-- The derive query runs under the caller's own RLS, so looking up a parent
-- you can't see returns NULL, which the NOT NULL constraint then rejects —
-- otherwise a caller could pass their own household_id (passing the
-- with-check policy) while pointing recipe_id/cook_id/collection_id at
-- another household's row.

-- gen_random_uuid() has been built into Postgres core since v13;
-- Supabase runs 15+, so no pgcrypto extension is needed.

-- ============================================================
-- shared domains — single definition point for values duplicated
-- across tables/columns
-- ============================================================

create domain source_type_t as text
  check (value in ('web','tiktok','instagram','photo','manual'));

-- Keep in sync with ALLERGENS in packages/shared/src/recipe.ts.
create domain allergen_t as text
  check (value in ('milk','egg','fish','shellfish','tree_nut','peanut','wheat','soy','sesame'));

-- ============================================================
-- identity
-- ============================================================

create table households (
  id         uuid primary key default gen_random_uuid(),
  name       text not null,
  created_at timestamptz not null default now()
);

-- Members are people, not logins. user_id is null for anyone without an
-- account (kids, grandparents) — see CLAUDE.md "members.user_id is nullable".
create table members (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  display_name text not null,
  avatar_path  text,
  allergies    text[] not null default '{}',
  email        text,       -- match target for the invite trigger below
  user_id      uuid unique references auth.users(id) on delete set null,
  created_at   timestamptz not null default now()
);

create index members_household_id_idx on members(household_id);

-- At most one member per email — the invite trigger below matches on this,
-- and an accidental duplicate would make that UPDATE touch two rows at
-- once and fail the unique constraint on user_id, breaking that login.
create unique index members_email_unique_idx on members (lower(email)) where email is not null;

-- ============================================================
-- RLS helper — every policy in this file uses this
-- ============================================================

create function my_household()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from members where user_id = auth.uid()
$$;

alter table households enable row level security;
alter table members    enable row level security;

create policy household_rw on households
  for all using (id = my_household()) with check (id = my_household());

create policy household_rw on members
  for all using (household_id = my_household()) with check (household_id = my_household());

-- ============================================================
-- the core
-- ============================================================

create table recipes (
  id               uuid primary key default gen_random_uuid(),
  household_id     uuid not null references households(id) on delete cascade,
  created_by       uuid references members(id) on delete set null,
  title            text not null,
  description      text,
  hero_image_path  text,
  source_type      source_type_t not null,
  source_url       text,
  source_author    text,
  servings         integer,
  prep_minutes     integer,
  cook_minutes     integer,
  instructions     jsonb not null default '[]',
  nutrition        jsonb,
  health_score     integer check (health_score between 0 and 100),
  health_rationale text,
  allergens        allergen_t[] not null default '{}',
  may_contain      allergen_t[] not null default '{}',
  tags             text[] not null default '{}',
  raw_extract      jsonb,  -- transcript / page text — keep this, never drop
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index recipes_household_id_idx on recipes(household_id);

create function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger recipes_set_updated_at
  before update on recipes
  for each row execute function set_updated_at();

-- ---- household derivation triggers -----------------------------------

create function derive_household_from_recipe()
returns trigger
language plpgsql
as $$
begin
  new.household_id := (select household_id from recipes where id = new.recipe_id);
  return new;
end;
$$;

create function derive_household_from_cook()
returns trigger
language plpgsql
as $$
begin
  new.household_id := (select household_id from cooks where id = new.cook_id);
  return new;
end;
$$;

create function derive_household_from_collection()
returns trigger
language plpgsql
as $$
begin
  new.household_id := (select household_id from collections where id = new.collection_id);
  return new;
end;
$$;

create table ingredients (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id    uuid not null references recipes(id) on delete cascade,
  position     integer not null,
  raw_text     text not null,
  quantity     numeric,
  unit         text,
  item         text not null,
  prep_note    text,
  is_optional  boolean not null default false,
  group_label  text
);

create index ingredients_recipe_id_idx on ingredients(recipe_id);

create trigger ingredients_derive_household
  before insert or update of recipe_id on ingredients
  for each row execute function derive_household_from_recipe();

create table recipe_images (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id    uuid not null references recipes(id) on delete cascade,
  storage_path text not null,
  kind         text not null check (kind in ('hero','step','frame')),
  position     integer not null default 0
);

create index recipe_images_recipe_id_idx on recipe_images(recipe_id);

create trigger recipe_images_derive_household
  before insert or update of recipe_id on recipe_images
  for each row execute function derive_household_from_recipe();

-- ============================================================
-- the cook log
-- ============================================================

create table cooks (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id    uuid not null references recipes(id) on delete cascade,
  cooked_by    uuid references members(id) on delete set null,
  cooked_on    date not null default current_date,
  notes        text,
  tweaks       text,
  created_at   timestamptz not null default now()
);

create index cooks_recipe_id_idx on cooks(recipe_id);

create trigger cooks_derive_household
  before insert or update of recipe_id on cooks
  for each row execute function derive_household_from_recipe();

create table cook_photos (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  cook_id      uuid not null references cooks(id) on delete cascade,
  storage_path text not null,
  position     integer not null default 0,
  caption      text
);

create index cook_photos_cook_id_idx on cook_photos(cook_id);

create trigger cook_photos_derive_household
  before insert or update of cook_id on cook_photos
  for each row execute function derive_household_from_cook();

create table cook_ratings (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  cook_id      uuid not null references cooks(id) on delete cascade,
  member_id    uuid not null references members(id) on delete cascade,
  stars        smallint not null check (stars between 1 and 5),
  comment      text,
  unique (cook_id, member_id)
);

create index cook_ratings_cook_id_idx on cook_ratings(cook_id);

create trigger cook_ratings_derive_household
  before insert or update of cook_id on cook_ratings
  for each row execute function derive_household_from_cook();

-- ============================================================
-- family layer
-- ============================================================

create table comments (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  recipe_id    uuid not null references recipes(id) on delete cascade,
  author_id    uuid references members(id) on delete set null,
  body         text not null,
  created_at   timestamptz not null default now()
);

create index comments_recipe_id_idx on comments(recipe_id);

create trigger comments_derive_household
  before insert or update of recipe_id on comments
  for each row execute function derive_household_from_recipe();

create table collections (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name         text not null,
  created_at   timestamptz not null default now()
);

create table collection_recipes (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  collection_id uuid not null references collections(id) on delete cascade,
  recipe_id     uuid not null references recipes(id) on delete cascade,
  unique (collection_id, recipe_id)
);

create index collection_recipes_collection_id_idx on collection_recipes(collection_id);

create trigger collection_recipes_derive_household
  before insert or update of collection_id on collection_recipes
  for each row execute function derive_household_from_collection();

-- ============================================================
-- plumbing
-- ============================================================

create table ingest_jobs (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references households(id) on delete cascade,
  requested_by  uuid references members(id) on delete set null,
  input_url     text,
  input_type    source_type_t not null,
  status        text not null default 'queued' check (status in ('queued','processing','done','error')),
  status_detail text,
  error         text,
  recipe_id     uuid references recipes(id) on delete set null,
  created_at    timestamptz not null default now()
);

create index ingest_jobs_household_id_idx on ingest_jobs(household_id);

-- ============================================================
-- RLS — same policy shape on every remaining table, no exceptions
-- ============================================================

alter table recipes            enable row level security;
alter table ingredients        enable row level security;
alter table recipe_images      enable row level security;
alter table cooks              enable row level security;
alter table cook_photos        enable row level security;
alter table cook_ratings       enable row level security;
alter table comments           enable row level security;
alter table collections        enable row level security;
alter table collection_recipes enable row level security;
alter table ingest_jobs        enable row level security;

create policy household_rw on recipes
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on ingredients
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on recipe_images
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on cooks
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on cook_photos
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on cook_ratings
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on comments
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on collections
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on collection_recipes
  for all using (household_id = my_household()) with check (household_id = my_household());
create policy household_rw on ingest_jobs
  for all using (household_id = my_household()) with check (household_id = my_household());

-- ============================================================
-- auth.users -> members link
-- Sign-in is Google OAuth, which has no built-in invite-only toggle — any
-- Google account can complete the OAuth flow and would otherwise get a
-- fresh auth.users row. Two triggers split "is this allowed" from "record
-- the link" because they run at different times relative to the row
-- actually existing:
--   - BEFORE INSERT only rejects. It can't do the linking UPDATE itself —
--     members.user_id has an FK to auth.users(id), and the row being
--     inserted doesn't exist yet at BEFORE-trigger time.
--   - AFTER INSERT only links, once the row is safely there.
-- An admin pre-creating a member row with someone's email is the actual
-- invite mechanism: an unrecognized email aborts the auth.users insert
-- entirely, and the whole sign-in transaction rolls back.
-- ============================================================

create function reject_uninvited_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from members
    where user_id is null
      and email is not null
      and lower(email) = lower(new.email)
  ) then
    raise exception 'not invited: % is not a recognized household member', new.email;
  end if;
  return new;
end;
$$;

create trigger reject_uninvited_signup_trigger
  before insert on auth.users
  for each row execute function reject_uninvited_signup();

create function link_invited_member()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  update members
  set user_id = new.id
  where user_id is null
    and email is not null
    and lower(email) = lower(new.email);
  return new;
end;
$$;

create trigger link_invited_member_trigger
  after insert on auth.users
  for each row execute function link_invited_member();
