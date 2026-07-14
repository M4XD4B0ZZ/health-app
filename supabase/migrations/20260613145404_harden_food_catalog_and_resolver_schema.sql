begin;

-- 1) Source registry with licensing/attribution metadata.
create table if not exists public.food_sources (
  id text primary key,
  display_name text not null,
  license_name text,
  attribution_text text,
  homepage_url text,
  region text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.food_sources enable row level security;

insert into public.food_sources (id, display_name, license_name, attribution_text, region)
values
  ('off', 'Open Food Facts', null, null, 'global'),
  ('usda', 'USDA FoodData Central', null, null, 'us'),
  ('bls', 'Bundeslebensmittelschlüssel', 'CC BY 4.0', 'Quelle: Max Rubner-Institut (MRI), Bundeslebensmittelschlüssel', 'de'),
  ('ai', 'AI-generated', null, null, 'global'),
  ('user', 'User-provided', null, null, 'global')
on conflict (id) do update set
  display_name = excluded.display_name,
  license_name = excluded.license_name,
  attribution_text = excluded.attribution_text,
  region = excluded.region,
  updated_at = now();

-- 2) Expand source model and add explicit quality controls.
alter table public.food_catalog_items
  drop constraint if exists food_catalog_items_source_check;

alter table public.food_catalog_items
  add constraint food_catalog_items_source_fkey
  foreign key (source) references public.food_sources(id);

alter table public.food_catalog_items
  add constraint food_catalog_items_confidence_check
  check (confidence between 0 and 1) not valid;

alter table public.food_catalog_items validate constraint food_catalog_items_confidence_check;

alter table public.food_catalog_items
  add constraint food_catalog_items_macros_shape_check
  check (
    jsonb_typeof(macros_per_100g) = 'object'
    and macros_per_100g ? 'kcal'
    and macros_per_100g ? 'protein'
    and macros_per_100g ? 'carbs'
    and macros_per_100g ? 'fat'
    and jsonb_typeof(macros_per_100g->'kcal') = 'number'
    and jsonb_typeof(macros_per_100g->'protein') = 'number'
    and jsonb_typeof(macros_per_100g->'carbs') = 'number'
    and jsonb_typeof(macros_per_100g->'fat') = 'number'
    and (macros_per_100g->>'kcal')::numeric >= 0
    and (macros_per_100g->>'protein')::numeric >= 0
    and (macros_per_100g->>'carbs')::numeric >= 0
    and (macros_per_100g->>'fat')::numeric >= 0
  ) not valid;

alter table public.food_catalog_items validate constraint food_catalog_items_macros_shape_check;

-- Keep external IDs mandatory for externally sourced records.
alter table public.food_catalog_items
  add constraint food_catalog_items_external_id_required_check
  check (source in ('ai','user') or external_id is not null) not valid;

alter table public.food_catalog_items validate constraint food_catalog_items_external_id_required_check;

-- 3) Normalize query-cache results into a relation table.
create table if not exists public.food_query_cache_results (
  query_cache_id uuid not null references public.food_query_cache(id) on delete cascade,
  food_catalog_item_id uuid not null references public.food_catalog_items(id) on delete cascade,
  rank integer not null check (rank > 0),
  score double precision check (score is null or (score between 0 and 1)),
  source text references public.food_sources(id),
  created_at timestamptz not null default now(),
  primary key (query_cache_id, food_catalog_item_id),
  unique (query_cache_id, rank)
);

create index if not exists idx_food_query_cache_results_item
  on public.food_query_cache_results(food_catalog_item_id);

alter table public.food_query_cache_results enable row level security;

-- 4) Preserve compatibility while adding an audit trail for resolver activity.
create table if not exists public.food_resolver_runs (
  id uuid primary key default extensions.uuid_generate_v4(),
  normalized_query text not null,
  locale text not null,
  user_id uuid references auth.users(id) on delete set null,
  winner_item_id uuid references public.food_catalog_items(id) on delete set null,
  winner_source text references public.food_sources(id),
  winner_confidence double precision check (winner_confidence is null or (winner_confidence between 0 and 1)),
  cache_hit boolean not null default false,
  resolver_version text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_food_resolver_runs_query_locale
  on public.food_resolver_runs(normalized_query, locale, created_at desc);

create index if not exists idx_food_resolver_runs_user
  on public.food_resolver_runs(user_id, created_at desc);

alter table public.food_resolver_runs enable row level security;

-- 5) Tighten grants: no direct anonymous access; authenticated gets only intended rights.
revoke all on table public.food_catalog_items from anon, authenticated;
revoke all on table public.food_query_cache from anon, authenticated;
revoke all on table public.user_food_aliases from anon, authenticated;
revoke all on table public.food_sources from anon, authenticated;
revoke all on table public.food_query_cache_results from anon, authenticated;
revoke all on table public.food_resolver_runs from anon, authenticated;

grant select on table public.food_catalog_items to authenticated;
grant select on table public.food_query_cache to authenticated;
grant select on table public.food_sources to authenticated;
grant select on table public.food_query_cache_results to authenticated;

grant select, insert, update, delete on table public.user_food_aliases to authenticated;

grant select on table public.food_resolver_runs to authenticated;

-- 6) Replace RLS policies with role-scoped, initplan-friendly definitions.
drop policy if exists "Allow SELECT for authenticated users" on public.food_catalog_items;
create policy "Authenticated users can read catalog"
on public.food_catalog_items
for select
to authenticated
using (true);

drop policy if exists "Allow SELECT for authenticated users" on public.food_query_cache;
create policy "Authenticated users can read query cache"
on public.food_query_cache
for select
to authenticated
using (true);

drop policy if exists "Users can read their own aliases" on public.user_food_aliases;
drop policy if exists "Users can insert their own aliases" on public.user_food_aliases;
drop policy if exists "Users can update their own aliases" on public.user_food_aliases;
drop policy if exists "Users can delete their own aliases" on public.user_food_aliases;

create policy "Users can read their own aliases"
on public.user_food_aliases
for select
to authenticated
using ((select auth.uid()) = user_id);

create policy "Users can insert their own aliases"
on public.user_food_aliases
for insert
to authenticated
with check ((select auth.uid()) = user_id);

create policy "Users can update their own aliases"
on public.user_food_aliases
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create policy "Users can delete their own aliases"
on public.user_food_aliases
for delete
to authenticated
using ((select auth.uid()) = user_id);

create policy "Authenticated users can read sources"
on public.food_sources
for select
to authenticated
using (true);

create policy "Authenticated users can read cache results"
on public.food_query_cache_results
for select
to authenticated
using (true);

create policy "Users can read their own resolver runs"
on public.food_resolver_runs
for select
to authenticated
using (user_id is null or (select auth.uid()) = user_id);

-- 7) Remove the redundant duplicate index.
drop index if exists public.idx_food_catalog_items_source_external_id;

commit;
