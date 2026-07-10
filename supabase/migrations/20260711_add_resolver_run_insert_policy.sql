-- Migration: Allow authenticated users to insert their own resolver runs
-- Created: 2026-07-11
-- Purpose: RESOLVER-V2-006 -- SequentialFoodCatalogResolver.resolve() persists one row per
-- decision to public.food_resolver_runs via SupabaseResolverRunLogger. That table (backfilled
-- in 20260710_document_existing_knowledge_layer_tables.sql) previously only had a SELECT
-- policy; without an INSERT policy, every write from an authenticated client was silently
-- rejected by RLS.

DROP POLICY IF EXISTS "Users can insert their own resolver runs" ON public.food_resolver_runs;
CREATE POLICY "Users can insert their own resolver runs"
  ON public.food_resolver_runs
  FOR INSERT
  WITH CHECK ((SELECT auth.uid()) = user_id);
