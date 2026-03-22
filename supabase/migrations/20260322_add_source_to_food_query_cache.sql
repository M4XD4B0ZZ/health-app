-- Add source column to food_query_cache for source-specific caching
-- This prevents OFF and USDA from sharing cache entries for identical queries

-- Add source column
ALTER TABLE public.food_query_cache 
ADD COLUMN source text NOT NULL DEFAULT 'unknown';

-- Drop old unique index
DROP INDEX IF EXISTS food_query_cache_normalized_query_locale_uniq;

-- Create new unique index including source
CREATE UNIQUE INDEX food_query_cache_normalized_query_locale_source_uniq 
  ON public.food_query_cache (normalized_query, locale, source);

-- Update comment
COMMENT ON COLUMN public.food_query_cache.source IS 'Source type (off, usda) to prevent cross-contamination';