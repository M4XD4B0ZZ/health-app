-- Migration: Document pre-existing knowledge-layer tables (schema drift backfill)
-- Created: 2026-07-10
-- Purpose: RESOLVER-V2-005 discovery found four tables already live on the remote project
-- (food_sources, food_query_cache_results, food_resolver_runs, user_food_aliases) with no
-- corresponding migration file in this repo -- they were created directly against the
-- database (e.g. via the Supabase Dashboard SQL editor) at some point after 20260215's
-- migration and never committed. This migration brings supabase/migrations/ back in sync
-- with what is actually live. Every statement is written to be a safe no-op against the
-- existing remote project (IF NOT EXISTS / DROP...IF EXISTS guards) while still being a
-- correct "create from scratch" script for a fresh/local database.
--
-- Not covered here (left for a future, separately-scoped task):
--   - a `corrections` table (user feedback on resolver decisions) does not exist yet, live
--     or otherwise -- RESOLVER-V2-005's DoD asks for one and it is still genuinely missing.
--   - none of food_sources / food_query_cache_results / food_resolver_runs are referenced by
--     any application code (grep across src/** and supabase/functions/**) -- they are
--     effectively dead/unused infrastructure right now. Wiring the resolver (client or edge
--     function) to actually write to food_resolver_runs per resolution is RESOLVER-V2-006,
--     not this migration.
--   - food_catalog_items.source was originally a CHECK constraint (20260215 migration) and
--     is now, live, a foreign key to food_sources.id -- that change is also undocumented
--     drift, but altering an already-in-use, already-correct table here felt riskier than
--     leaving a note; not touched by this migration.

-- =====================================================================
-- Table: food_sources
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

DROP POLICY IF EXISTS "Authenticated users can read sources" ON public.food_sources;
CREATE POLICY "Authenticated users can read sources"
  ON public.food_sources
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- =====================================================================
-- Table: user_food_aliases
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.user_food_aliases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  alias_text text NOT NULL,
  normalized_alias text NOT NULL,
  locale text NOT NULL,
  -- NOTE (documented as-is): no FK constraint exists live on target_item_id, despite the
  -- name implying a reference to food_catalog_items.id. Preserved as-is rather than
  -- "fixed" here since fixing it could break existing rows/writers.
  target_item_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_alias_lookup
  ON public.user_food_aliases (user_id, normalized_alias, locale);

ALTER TABLE public.user_food_aliases ENABLE ROW LEVEL SECURITY;

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
-- Table: food_query_cache_results
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
  USING (auth.role() = 'authenticated');

-- =====================================================================
-- Table: food_resolver_runs
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

DROP POLICY IF EXISTS "Users can read their own resolver runs" ON public.food_resolver_runs;
CREATE POLICY "Users can read their own resolver runs"
  ON public.food_resolver_runs
  FOR SELECT
  USING ((user_id IS NULL) OR ((SELECT auth.uid()) = user_id));

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE public.food_sources IS 'Reference table of resolver source metadata (off, usda, bls, user, ...).';
COMMENT ON TABLE public.user_food_aliases IS 'User-private alias -> catalog item mappings (RESOLVER-V2-005 food_aliases equivalent).';
COMMENT ON TABLE public.food_query_cache_results IS 'Per-source-candidate ranking results for a cached query (query -> ranked candidates).';
COMMENT ON TABLE public.food_resolver_runs IS 'One row per resolver decision: query, winner, confidence, cache hit, metadata (RESOLVER-V2-005/006 query_logs equivalent). Not currently written to by any app or edge function code -- see RESOLVER-V2-006.';
