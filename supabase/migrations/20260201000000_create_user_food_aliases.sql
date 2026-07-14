-- Migration: User Food Aliases
-- Purpose: Per-user alias -> canonical food item mappings for the resolver's
-- highest-priority "user" source (see SupabaseUserAliasSource).
--
-- Recovery note: this migration was reconstructed from the live schema of the
-- "HealthDatabase" Supabase project (kbplfcqluqqowmvchvhc) — the table predates
-- migration tracking in this repo and has no corresponding entry in
-- supabase_migrations.schema_migrations. Column types/constraints/indexes were
-- read back exactly from the live database; the exact original CREATE POLICY/
-- GRANT wording could not be recovered from history (unlike later tracked
-- migrations) and is reconstructed to match the table's current, in-production
-- behavior. Statements are written defensively (IF NOT EXISTS / DROP POLICY IF
-- EXISTS) so this file is safe to run even though the objects already exist.

CREATE TABLE IF NOT EXISTS public.user_food_aliases (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  alias_text text NOT NULL,
  normalized_alias text NOT NULL,
  locale text NOT NULL,
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
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can insert their own aliases"
  ON public.user_food_aliases
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can update their own aliases"
  ON public.user_food_aliases
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own aliases" ON public.user_food_aliases;
CREATE POLICY "Users can delete their own aliases"
  ON public.user_food_aliases
  FOR DELETE
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_food_aliases TO authenticated;

COMMENT ON TABLE public.user_food_aliases IS 'Per-user alias -> canonical food item mappings (RLS: owner-only). Reconstructed migration, see file header.';
