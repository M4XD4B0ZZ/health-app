-- Migration: Create user_food_aliases table
-- Created: 2026-02-01
-- Purpose: Per-user alias -> catalog item mappings for the food resolver's user-alias
-- fast path (a user's own past corrections/nicknames for a food item).
--
-- Backfilled 2026-07-14 (RESOLVER-V2-008, repo-only, not applied to remote -- see
-- ROADMAP.md): this file did not exist in supabase/migrations/ even though the Supabase
-- migration ledger records version 20260201000000 / "create_user_food_aliases" as already
-- applied to the remote "HealthDatabase" project (kbplfcqluqqowmvchvhc) -- confirmed via
-- mcp__Supabase__list_migrations. The table was evidently created directly against the
-- database (e.g. via the Supabase Dashboard SQL editor) before this repo's migration files
-- were kept in sync with every remote change -- same root cause as the RESOLVER-V2-005
-- schema drift documented in 20260710_document_existing_knowledge_layer_tables.sql.
-- Reconstructed from live schema introspection (mcp__Supabase__execute_sql against
-- pg_policies/information_schema) and the shape re-declared by later migrations, written to
-- match the ledger's recorded version and name exactly. NOT re-applied to remote -- the
-- table is already there; every statement below is IF NOT EXISTS / DROP...IF EXISTS guarded,
-- so this is also a safe no-op against the live project and a correct create-from-scratch
-- script for a fresh/local database. Purely a local migration-history/reproducibility fix.

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS public.user_food_aliases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id),
  alias_text text NOT NULL,
  normalized_alias text NOT NULL,
  locale text NOT NULL,
  -- No FK constraint on target_item_id despite the name implying a reference to
  -- food_catalog_items.id -- preserved as-is to match the live table (see
  -- 20260710_document_existing_knowledge_layer_tables.sql's identical note).
  target_item_id uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_alias_lookup
  ON public.user_food_aliases (user_id, normalized_alias, locale);

ALTER TABLE public.user_food_aliases ENABLE ROW LEVEL SECURITY;

-- Read-only at this point in history; write policies are added by
-- 20260613145404_harden_food_catalog_and_resolver_schema.sql.
DROP POLICY IF EXISTS "Users can read their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can read their own aliases"
  ON public.user_food_aliases
  FOR SELECT
  USING (auth.uid() = user_id);

COMMENT ON TABLE public.user_food_aliases IS 'User-private alias -> catalog item mappings (RESOLVER-V2-005 food_aliases equivalent).';
