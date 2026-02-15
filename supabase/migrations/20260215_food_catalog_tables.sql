-- Migration: Food Catalog Tables
-- Created: 2026-02-15
-- Purpose: Canonical shared cache layer for food items and query cache

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =====================================================================
-- Table: food_catalog_items
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.food_catalog_items (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  canonical_name text NOT NULL,
  brand text NULL,
  source text NOT NULL CHECK (source IN ('off', 'usda', 'ai', 'user')),
  external_id text NULL,
  locale text NOT NULL,
  macros_per_100g jsonb NOT NULL,
  micros_per_100g jsonb NULL,
  confidence float NOT NULL DEFAULT 1.0,
  last_verified_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes for food_catalog_items
CREATE INDEX IF NOT EXISTS idx_food_catalog_items_source_external_id 
  ON public.food_catalog_items(source, external_id);

CREATE INDEX IF NOT EXISTS idx_food_catalog_items_locale_canonical_name 
  ON public.food_catalog_items(locale, canonical_name);

-- =====================================================================
-- Table: food_query_cache
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.food_query_cache (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  normalized_query text NOT NULL,
  locale text NOT NULL,
  cache_type text NOT NULL CHECK (cache_type IN ('positive', 'negative')),
  winner_source text NULL,
  winner_confidence float NULL,
  result_item_ids uuid[] NULL,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint for food_query_cache
ALTER TABLE public.food_query_cache 
  ADD CONSTRAINT food_query_cache_normalized_query_locale_key 
  UNIQUE (normalized_query, locale);

-- Index for food_query_cache
CREATE INDEX IF NOT EXISTS idx_food_query_cache_expires_at 
  ON public.food_query_cache(expires_at);

-- =====================================================================
-- RLS Policies: food_catalog_items
-- =====================================================================

-- Enable RLS
ALTER TABLE public.food_catalog_items ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT for authenticated users
CREATE POLICY "Allow SELECT for authenticated users"
  ON public.food_catalog_items
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies for clients (Service Role only)

-- =====================================================================
-- RLS Policies: food_query_cache
-- =====================================================================

-- Enable RLS
ALTER TABLE public.food_query_cache ENABLE ROW LEVEL SECURITY;

-- Policy: SELECT for authenticated users (optional)
CREATE POLICY "Allow SELECT for authenticated users"
  ON public.food_query_cache
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- No INSERT/UPDATE/DELETE policies for clients (Service Role only)

-- =====================================================================
-- Comments
-- =====================================================================

COMMENT ON TABLE public.food_catalog_items IS 'Canonical shared food catalog cache. Writes via Edge Functions (Service Role) only.';
COMMENT ON TABLE public.food_query_cache IS 'Query result cache for food lookups. Writes via Edge Functions (Service Role) only.';

COMMENT ON COLUMN public.food_catalog_items.source IS 'Source type: off, usda, ai, or user';
COMMENT ON COLUMN public.food_catalog_items.macros_per_100g IS 'JSON object with kcal, protein, carbs, fat';
COMMENT ON COLUMN public.food_catalog_items.confidence IS 'Confidence score 0.0 to 1.0';

COMMENT ON COLUMN public.food_query_cache.cache_type IS 'positive (found) or negative (not found)';
COMMENT ON COLUMN public.food_query_cache.result_item_ids IS 'Array of food_catalog_items.id UUIDs';
COMMENT ON COLUMN public.food_query_cache.expires_at IS 'Cache expiration timestamp';
