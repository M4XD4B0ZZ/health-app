-- Migration: Harden food catalog and resolver schema
-- Created: 2026-06-13
-- Purpose: RESOLVER-V2-005 knowledge-layer hardening -- introduces the food_sources
-- reference table plus food_query_cache_results and food_resolver_runs, adds explicit
-- quality constraints to food_catalog_items, hardens grants, and switches every RLS SELECT
-- policy touched here from the row-by-row `auth.role() = 'authenticated'` check (20260215's
-- original form) to the role-scoped `TO authenticated USING (true)` / `(SELECT auth.uid())`
-- form, which Postgres evaluates once per query instead of once per row.
--
-- Backfilled 2026-07-14 (RESOLVER-V2-008, repo-only, not applied to remote -- see
-- ROADMAP.md): this file did not exist in supabase/migrations/ even though the Supabase
-- migration ledger records version 20260613145404 / "harden_food_catalog_and_resolver_schema"
-- as already applied to the remote "HealthDatabase" project (kbplfcqluqqowmvchvhc) --
-- confirmed via mcp__Supabase__list_migrations. Reconstructed from live schema introspection
-- (mcp__Supabase__execute_sql against pg_policies/pg_constraint/information_schema, plus
-- mcp__Supabase__get_advisors) rather than a recovered original file. NOT re-applied to
-- remote -- every statement below is IF NOT EXISTS / DROP...IF EXISTS guarded, matching the
-- pattern already used by 20260710_document_existing_knowledge_layer_tables.sql, so this is
-- also a safe no-op against the live project and a correct create-from-scratch script for a
-- fresh/local database. Purely a local migration-history/reproducibility fix.
--
-- Known live drift NOT restored here (left to a separate, already-pending follow-up task --
-- see RESOLVER-V2-009 in ROADMAP.md): two of this migration's policies --
-- "Authenticated users can read sources" on food_sources and "Authenticated users can read
-- cache results" on food_query_cache_results -- were later reset back to the unoptimized
-- `auth.role() = 'authenticated'` form by
-- 20260710_document_existing_knowledge_layer_tables.sql, which re-creates both policies
-- without carrying this migration's optimization forward (confirmed live via
-- mcp__Supabase__get_advisors' auth_rls_initplan WARNs and by reading that file's own SQL).
-- Re-declaring the optimized form again here would be a safe no-op against a fresh local DB
-- (this file runs before 20260710's, so 20260710 would just overwrite it again on a fresh
-- rebuild too -- reproducing the same regression locally, which is the accurate history) but
-- would NOT change anything on the already-migrated remote project, since `supabase db push`
-- only runs migrations whose ledger version isn't already recorded as applied. The actual fix
-- for the live regression is
-- 20260713_harden_food_catalog_grants_and_constraints.sql, not this file.

BEGIN;

-- =====================================================================
-- Harden user_food_aliases (created in 20260201000000_create_user_food_aliases.sql):
-- add the missing write policies and switch to the initplan-friendly auth.uid() form.
-- =====================================================================

DROP POLICY IF EXISTS "Users can read their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can read their own aliases"
  ON public.user_food_aliases
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can insert their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can insert their own aliases"
  ON public.user_food_aliases
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can update their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can update their own aliases"
  ON public.user_food_aliases
  FOR UPDATE
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK ((SELECT auth.uid()) = user_id);

DROP POLICY IF EXISTS "Users can delete their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can delete their own aliases"
  ON public.user_food_aliases
  FOR DELETE
  USING ((SELECT auth.uid()) = user_id);

-- =====================================================================
-- Table: food_sources -- reference table of resolver source metadata.
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.food_sources (
  id text PRIMARY KEY,
  display_name text NOT NULL,
  license_name text NULL,
  attribution_text text NULL,
  homepage_url text NULL,
  region text NULL,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.food_sources ENABLE ROW LEVEL SECURITY;

INSERT INTO public.food_sources (id, display_name, license_name, attribution_text, region)
VALUES
  ('off', 'Open Food Facts', NULL, NULL, 'global'),
  ('usda', 'USDA FoodData Central', NULL, NULL, 'us'),
  (
    'bls',
    'Bundeslebensmittelschlüssel',
    'CC BY 4.0',
    'Quelle: Max Rubner-Institut (MRI), Bundeslebensmittelschlüssel',
    'de'
  ),
  ('ai', 'AI-generated', NULL, NULL, 'global'),
  ('user', 'User-provided', NULL, NULL, 'global')
ON CONFLICT (id) DO UPDATE SET
  display_name = excluded.display_name,
  license_name = excluded.license_name,
  attribution_text = excluded.attribution_text,
  region = excluded.region,
  updated_at = now();

DROP POLICY IF EXISTS "Authenticated users can read sources" ON public.food_sources;
CREATE POLICY "Authenticated users can read sources"
  ON public.food_sources
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================================
-- Harden food_catalog_items: explicit quality constraints beyond 20260215's original
-- CHECK, plus a real foreign key to food_sources.
-- =====================================================================

ALTER TABLE public.food_catalog_items
  DROP CONSTRAINT IF EXISTS food_catalog_items_source_check;

ALTER TABLE public.food_catalog_items
  DROP CONSTRAINT IF EXISTS food_catalog_items_source_fkey;

ALTER TABLE public.food_catalog_items
  ADD CONSTRAINT food_catalog_items_source_fkey
  FOREIGN KEY (source) REFERENCES public.food_sources (id);

ALTER TABLE public.food_catalog_items
  DROP CONSTRAINT IF EXISTS food_catalog_items_confidence_check;

ALTER TABLE public.food_catalog_items
  ADD CONSTRAINT food_catalog_items_confidence_check
  CHECK (confidence BETWEEN 0 AND 1) NOT VALID;

ALTER TABLE public.food_catalog_items
  VALIDATE CONSTRAINT food_catalog_items_confidence_check;

ALTER TABLE public.food_catalog_items
  DROP CONSTRAINT IF EXISTS food_catalog_items_macros_shape_check;

ALTER TABLE public.food_catalog_items
  ADD CONSTRAINT food_catalog_items_macros_shape_check
  CHECK (
    jsonb_typeof(macros_per_100g) = 'object'
    AND macros_per_100g ? 'kcal'
    AND macros_per_100g ? 'protein'
    AND macros_per_100g ? 'carbs'
    AND macros_per_100g ? 'fat'
    AND jsonb_typeof(macros_per_100g -> 'kcal') = 'number'
    AND jsonb_typeof(macros_per_100g -> 'protein') = 'number'
    AND jsonb_typeof(macros_per_100g -> 'carbs') = 'number'
    AND jsonb_typeof(macros_per_100g -> 'fat') = 'number'
    AND (macros_per_100g ->> 'kcal')::numeric >= 0
    AND (macros_per_100g ->> 'protein')::numeric >= 0
    AND (macros_per_100g ->> 'carbs')::numeric >= 0
    AND (macros_per_100g ->> 'fat')::numeric >= 0
  ) NOT VALID;

ALTER TABLE public.food_catalog_items
  VALIDATE CONSTRAINT food_catalog_items_macros_shape_check;

ALTER TABLE public.food_catalog_items
  DROP CONSTRAINT IF EXISTS food_catalog_items_external_id_required_check;

ALTER TABLE public.food_catalog_items
  ADD CONSTRAINT food_catalog_items_external_id_required_check
  CHECK (source IN ('ai', 'user') OR external_id IS NOT NULL) NOT VALID;

ALTER TABLE public.food_catalog_items
  VALIDATE CONSTRAINT food_catalog_items_external_id_required_check;

DROP POLICY IF EXISTS "Allow SELECT for authenticated users" ON public.food_catalog_items;
CREATE POLICY "Authenticated users can read catalog"
  ON public.food_catalog_items
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================================
-- Harden food_query_cache: switch to the initplan-friendly, role-scoped policy form.
-- =====================================================================

DROP POLICY IF EXISTS "Allow SELECT for authenticated users" ON public.food_query_cache;
CREATE POLICY "Authenticated users can read query cache"
  ON public.food_query_cache
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================================
-- Table: food_query_cache_results -- per-source-candidate ranking results for a
-- cached query (query -> ranked candidates).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.food_query_cache_results (
  query_cache_id uuid NOT NULL REFERENCES public.food_query_cache(id),
  food_catalog_item_id uuid NOT NULL REFERENCES public.food_catalog_items(id),
  rank integer NOT NULL CHECK (rank > 0),
  score double precision NULL CHECK (score IS NULL OR (score >= 0 AND score <= 1)),
  source text NULL REFERENCES public.food_sources(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (query_cache_id, food_catalog_item_id)
);

CREATE UNIQUE INDEX IF NOT EXISTS food_query_cache_results_query_cache_id_rank_key
  ON public.food_query_cache_results (query_cache_id, rank);

CREATE INDEX IF NOT EXISTS idx_food_query_cache_results_item
  ON public.food_query_cache_results (food_catalog_item_id);

ALTER TABLE public.food_query_cache_results ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can read cache results" ON public.food_query_cache_results;
CREATE POLICY "Authenticated users can read cache results"
  ON public.food_query_cache_results
  FOR SELECT
  TO authenticated
  USING (true);

-- =====================================================================
-- Table: food_resolver_runs -- one row per resolver decision (query_logs equivalent).
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.food_resolver_runs (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_query text NOT NULL,
  locale text NOT NULL,
  user_id uuid NULL REFERENCES auth.users(id),
  winner_item_id uuid NULL REFERENCES public.food_catalog_items(id),
  winner_source text NULL REFERENCES public.food_sources(id),
  winner_confidence double precision NULL
    CHECK (winner_confidence IS NULL OR (winner_confidence >= 0 AND winner_confidence <= 1)),
  cache_hit boolean NOT NULL DEFAULT false,
  resolver_version text NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_food_resolver_runs_query_locale
  ON public.food_resolver_runs (normalized_query, locale, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_food_resolver_runs_user
  ON public.food_resolver_runs (user_id, created_at DESC);

ALTER TABLE public.food_resolver_runs ENABLE ROW LEVEL SECURITY;

-- SELECT only at this point in history; the INSERT policy is added by
-- 20260711_add_resolver_run_insert_policy.sql.
DROP POLICY IF EXISTS "Users can read their own resolver runs" ON public.food_resolver_runs;
CREATE POLICY "Users can read their own resolver runs"
  ON public.food_resolver_runs
  FOR SELECT
  USING ((user_id IS NULL) OR ((SELECT auth.uid()) = user_id));

-- =====================================================================
-- Tighten grants: no direct anonymous access; authenticated gets only intended rights.
-- =====================================================================

REVOKE ALL ON TABLE public.food_catalog_items FROM anon, authenticated;
REVOKE ALL ON TABLE public.food_query_cache FROM anon, authenticated;
REVOKE ALL ON TABLE public.user_food_aliases FROM anon, authenticated;
REVOKE ALL ON TABLE public.food_sources FROM anon, authenticated;
REVOKE ALL ON TABLE public.food_query_cache_results FROM anon, authenticated;
REVOKE ALL ON TABLE public.food_resolver_runs FROM anon, authenticated;

GRANT SELECT ON TABLE public.food_catalog_items TO authenticated;
GRANT SELECT ON TABLE public.food_query_cache TO authenticated;
GRANT SELECT ON TABLE public.food_sources TO authenticated;
GRANT SELECT ON TABLE public.food_query_cache_results TO authenticated;

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_food_aliases TO authenticated;

GRANT SELECT ON TABLE public.food_resolver_runs TO authenticated;

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE public.food_sources IS 'Reference table of resolver source metadata (off, usda, bls, user, ...).';
COMMENT ON TABLE public.food_query_cache_results IS 'Per-source-candidate ranking results for a cached query (query -> ranked candidates).';
COMMENT ON TABLE public.food_resolver_runs IS 'One row per resolver decision: query, winner, confidence, cache hit, metadata (RESOLVER-V2-005/006 query_logs equivalent).';

COMMIT;
