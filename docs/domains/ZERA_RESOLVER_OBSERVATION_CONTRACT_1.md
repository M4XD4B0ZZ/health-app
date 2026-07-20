# Zera Resolver Observation Contract 1

## Purpose and authority

`resolver-observation-v1` is non-authoritative audit evidence for a completed resolver run. It implements the observation boundary required by the accepted Knowledge Growth Decision Record; it does not alter that record. An observation is neither Food Catalog data, personal memory, a knowledge candidate, nor curated knowledge, and is never read by resolver ranking or fast paths.

## Contract and classification

The typed V1 contract has required identity (`observationId`, `resolverRunId`, timestamp, contract version), private input (raw input, normalized input, locale and deterministic input type), decision (closed outcome, reason codes, candidate count, selected source reference and provenance), resolver version, and operational latency (`unknown` when unavailable). It intentionally contains no AI nutrient fields, prompt/raw provider response, free metadata, owner identifier, journal reference, correction reference, secrets, headers, proxy data, or stack trace.

Classification policy version is the contract version. `private_raw` covers raw input. `private_user_scoped` is reserved for future owner/journal/correction references. Normalized input, locale and source references are `aggregatable_only_after_approved_deidentification`, not anonymous or approved for aggregation. Contract/run identifiers, versions, outcomes, counts and latency are `non_personal_operational`. The field catalogue is closed: a missing classification is invalid; free text defaults to private and no new field becomes aggregatable automatically.

## Writer and integration

`ResolverObservationWriter` is a write-only application port. Its V1 in-memory adapter validates the contract and deduplicates by observation ID. `SequentialFoodCatalogResolver.resolve` invokes it once, after the existing resolver decision has been produced and alongside (not through) the existing `ResolverRunLogger`. It reuses the already available query and decision only; it performs no AI, retrieval, retry, candidate aggregation, cache/memory activation, promotion, correction interpretation, or decision change. Writer failures return an explicit safe code and are warned without raw input; they do not change the resolved result or retry the run.

## Private durable storage (RESOLVER-V3-015A)

Migration `supabase/migrations/20260720120000_create_resolver_observations.sql` creates the dedicated `public.resolver_observations` boundary. It stores private persistence metadata in typed columns (`owner_id`, `observation_id`, `resolver_run_id`, `contract_version`, `occurred_at`, `created_at`) and the complete closed V1 contract in `observation_payload` JSONB. The payload is never named `metadata`: application validation rejects unknown root/nested contract fields before writing, and database checks bind its identity/version to the typed columns. This retains every V1 field without repurposing a V2 or free-form metadata surface.

`owner_id` is private storage context, not a V1 payload field and not aggregatable evidence. The Supabase authenticated-session owner provider supplies it only after the resolver decision; missing authentication fails closed with no insert and never falls back to a shared/dummy owner. The unique `(owner_id, observation_id)` boundary makes retry/idempotence private to that owner. The adapter maps PostgreSQL unique conflicts to `duplicate`; validation and all other failures remain secret-safe failure codes and never emit raw input, Supabase responses, provider data, or secrets.

RLS is enabled. `authenticated` receives only select/insert/delete grants: owner-scoped select, insert `WITH CHECK`, and delete policies each compare `auth.uid()` to `owner_id`; there is no update grant/policy, no anonymous grant, no `true` owner policy, and no application global aggregation policy. Delete is owner-scoped to preserve a safe future V3-016 privacy/retention handoff; V3-016 itself is not implemented.

`SupabaseResolverObservationWriter` is write-only and receives the explicit `{ ownerId, observation }` request. The DI composition root wires it with the canonical Supabase auth-session owner provider outside tests; tests/local no-owner paths use safe no-op/fail-closed behavior. The existing resolver remains post-decision and fire-and-forget: an observation failure cannot change the resolver or journal result, cause a retry, or invoke another AI/source call. No production resolver code reads `resolver_observations`.

## Legacy boundary

`food_resolver_runs` remains legacy V2 telemetry and `food_query_cache_results` remains cache/ranking data. Neither table, its migrations, nor historical rows are modified, relabelled, backfilled, promoted, or treated as valid V1 observations. `resolver_observations` is neither a resolver source, cache, personal memory, candidate table, curated knowledge, alias source, nor global/negative-knowledge source; it enables no aggregation.

## Non-goals and privacy handoff

This does not implement V3-016 de-identification/retention enforcement, personal memory, correction precedence, cache reads, global aggregation/promotion, review UI, new AI providers/prompts, or schema/RLS changes. V3-016 owns enforcement after the storage migration is approved.
