# Zera Resolver Observation Contract 1

## Purpose and authority

`resolver-observation-v1` is non-authoritative audit evidence for a completed resolver run. It implements the observation boundary required by the accepted Knowledge Growth Decision Record; it does not alter that record. An observation is neither Food Catalog data, personal memory, a knowledge candidate, nor curated knowledge, and is never read by resolver ranking or fast paths.

## Contract and classification

The typed V1 contract has required identity (`observationId`, `resolverRunId`, timestamp, contract version), private input (raw input, normalized input, locale and deterministic input type), decision (closed outcome, reason codes, candidate count, selected source reference and provenance), resolver version, and operational latency (`unknown` when unavailable). It intentionally contains no AI nutrient fields, prompt/raw provider response, free metadata, owner identifier, journal reference, correction reference, secrets, headers, proxy data, or stack trace.

Classification policy version is the contract version. `private_raw` covers raw input. `private_user_scoped` is reserved for future owner/journal/correction references. Normalized input, locale and source references are `aggregatable_only_after_approved_deidentification`, not anonymous or approved for aggregation. Contract/run identifiers, versions, outcomes, counts and latency are `non_personal_operational`. The field catalogue is closed: a missing classification is invalid; free text defaults to private and no new field becomes aggregatable automatically.

## Writer and integration

`ResolverObservationWriter` is a write-only application port. Its V1 in-memory adapter validates the contract and deduplicates by observation ID. `SequentialFoodCatalogResolver.resolve` invokes it once, after the existing resolver decision has been produced and alongside (not through) the existing `ResolverRunLogger`. It reuses the already available query and decision only; it performs no AI, retrieval, retry, candidate aggregation, cache/memory activation, promotion, correction interpretation, or decision change. Writer failures return an explicit safe code and are warned without raw input; they do not change the resolved result or retry the run.

## Current storage reality and migration blocker

Inventory: the resolver already produces raw/normalized query, locale, input type, candidates, source IDs, ranking decision/status/reason codes and a decision timestamp. `ResolverRunLogger` persists a separate legacy `food_resolver_runs` telemetry row containing normalized query, locale, user ID, winner source/confidence, cache hit and V2-specific metadata. `food_query_cache_results` stores cached ranked catalog-item results only. `FoodEntry` can retain a nutrition snapshot/catalog reference; corrections, aliases and portion hints are user-private and separate.

Neither table is a semantically safe V1 observation store: `food_resolver_runs.metadata` is an existing V2 logger payload rather than a typed observation contract, its columns cannot carry all required V1 identity/classification/decision fields, and `food_query_cache_results` is catalog cache data. No column is repurposed and no pseudopersistence is performed. Therefore the application boundary and in-memory test adapter are implemented, but durable V1 persistence is blocked pending a separately scoped migration with private RLS and a dedicated typed storage boundary.

Legacy `food_resolver_runs` remain legacy telemetry, never validated/relabelled/backfilled as V1 observations. V3-016 may not start safely until durable storage and its privacy-enforcement dependency are reviewed.

## Non-goals and privacy handoff

This does not implement V3-016 de-identification/retention enforcement, personal memory, correction precedence, cache reads, global aggregation/promotion, review UI, new AI providers/prompts, or schema/RLS changes. V3-016 owns enforcement after the storage migration is approved.
