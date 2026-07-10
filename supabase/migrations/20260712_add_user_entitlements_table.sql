-- Migration: User entitlements table (P2-009-A)
-- Created: 2026-07-12
-- Purpose: Track each user's subscription ("Pro") state, synced from RevenueCat via a
-- webhook (P2-009-B, separate task) into this table. Schema/RLS only -- no RevenueCat
-- credentials required for this migration; the webhook that writes to this table is a
-- separate, later task once a real RevenueCat project + webhook secret exist.

CREATE TABLE IF NOT EXISTS public.user_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id),
  is_pro boolean NOT NULL DEFAULT false,
  product_id text NULL,
  expires_at timestamptz NULL,
  revenuecat_app_user_id text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_user_entitlements_is_pro
  ON public.user_entitlements (is_pro)
  WHERE is_pro = true;

-- =====================================================================
-- RLS Policies
-- =====================================================================
-- Same shape as food_catalog_items/food_query_cache: clients may only read their own row.
-- Writes happen exclusively via the (not-yet-built) RevenueCat webhook edge function using
-- the service role key, which bypasses RLS -- no INSERT/UPDATE/DELETE policy is defined here
-- on purpose.

ALTER TABLE public.user_entitlements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own entitlement" ON public.user_entitlements;
CREATE POLICY "Users can read their own entitlement"
  ON public.user_entitlements
  FOR SELECT
  USING ((SELECT auth.uid()) = user_id);

COMMENT ON TABLE public.user_entitlements IS 'Subscription/entitlement state per user, synced from RevenueCat via webhook (service role writes only). See P2-009 in ROADMAP.md.';
COMMENT ON COLUMN public.user_entitlements.is_pro IS 'Whether the user currently has an active Pro entitlement.';
COMMENT ON COLUMN public.user_entitlements.product_id IS 'RevenueCat/store product identifier for the active entitlement, if any.';
COMMENT ON COLUMN public.user_entitlements.expires_at IS 'Expiration timestamp of the current entitlement, if known (null for lifetime/unknown).';
COMMENT ON COLUMN public.user_entitlements.revenuecat_app_user_id IS 'RevenueCat app_user_id this row was last synced from, for webhook idempotency/debugging.';
