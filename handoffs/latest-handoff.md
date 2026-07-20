# Handoff — RESOLVER-V3-015A

## Status and basis

- Base verified before changes: `54963c176639e90e2041b326032c7048dbdbea6c` on the local `work` checkout (PR #100 merge); task branch: `feat/resolver-v3-015a-private-observation-storage`.
- `RESOLVER-V3-015A` and its previously blocked prerequisite `RESOLVER-V3-015` are now `done`. `RESOLVER-V3-016` remains `todo` and can safely start; V3-010 remains blocked and V3-013 remains NOT PASSED.

## Storage boundary

- Exactly one additive migration: `supabase/migrations/20260720120000_create_resolver_observations.sql`; table: `public.resolver_observations`.
- It separates typed private metadata (`owner_id`, identity/run/version/timestamps) from the complete closed `resolver-observation-v1` JSONB `observation_payload`. The payload is not generic metadata; application validation rejects unknown contract fields and database checks bind payload identity/version to columns.
- Owner is supplied through the canonical Supabase authenticated-session provider and passed explicitly as `{ ownerId, observation }` to the write-only port. It is not copied into the V1 payload. No session/no owner fails closed without an insert or dummy owner.
- Private idempotence is `unique (owner_id, observation_id)`. Unique conflicts return `duplicate`; validation failures return `validation_failed`; other persistence failures return secret-safe `write_failed` and log only a stable code.
- RLS is enabled with authenticated owner-only select/insert/delete policies using `auth.uid() = owner_id`; no anon access, unrestricted policy, update grant, or update policy exists. Delete is intentionally owner-scoped as the safe structural handoff to V3-016 retention/deletion work, not an implementation of V3-016.

## Integration and non-effects

- `SupabaseResolverObservationWriter` is write-only and DI-wired outside test mode with `SupabaseResolverObservationOwnerProvider`. Test/local-safe paths are no-op/fail-closed; no actual Supabase connection was made.
- Resolver writes remain exactly once and post-decision. Owner lookup/write failures cannot affect the resolver/journal result, retry the resolver, or trigger AI/source execution. No resolver code reads the new table.
- `food_resolver_runs` stays legacy V2 telemetry and `food_query_cache_results` stays cache/ranking data. No legacy migration changed, no backfill/relabel/promotion occurred, and no aggregation, memory, candidate, cache read path, or global knowledge behavior was introduced.

## Verification

- Focused: 5 suites / 15 tests passed (`ResolverObservation`, integration, new writer/migration, existing resolver-run logger); the integration asserts exactly one source call and full owner-bound observation request.
- Full runtime verification, diff checks, SQL readback, migration-count/legacy/dependency checks and secret-oriented diff scan are to be recorded after the final implementation review. No live provider or Supabase calls were run.
