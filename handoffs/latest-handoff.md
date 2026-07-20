# Handoff — RESOLVER-V3-015

## Status

`RESOLVER-V3-015` is **blocked**, not done: the versioned contract boundary is implemented but durable persistence cannot be safely completed without a dedicated migration. No migration, RLS policy, dependency, provider run, or resolver strategy was changed.

## Contract inventory and implementation

- Contract: `resolver-observation-v1`; typed, closed fields for identity/run correlation, private input, deterministic decision/source reference, resolver version and operational latency.
- Classification: `private_raw`, `private_user_scoped`, `aggregatable_only_after_approved_deidentification`, and `non_personal_operational`; the V1 field catalogue is closed and unknown fields fail validation.
- Existing data: resolver already creates query/locale/input type/candidates/decision. `food_resolver_runs` persists legacy V2 telemetry; `food_query_cache_results` holds catalog cache rankings. FoodEntry snapshot/catalog ref, corrections, aliases and portion hints remain separate private concerns.
- Storage: `food_resolver_runs` is not reused because its V2 metadata and columns cannot safely carry the typed V1 contract; `food_query_cache_results` is semantically catalog cache data. The implemented adapter is in-memory only.
- Integration: `SequentialFoodCatalogResolver.resolve`, after the existing decision and beside the legacy logger. It writes exactly one observation per run ID in tests, with no second AI call/source request and no resolver result/ranking/cache/memory/candidate/global effect.
- Error behavior: writer returns explicit `written`/`duplicate`/safe failure codes; resolver emits only a safe failure code and preserves the user result. No raw input or secrets are logged.

## Tests

`npm run verify` passed: 160 suites / 1,444 tests. Focused observation contract/integration tests passed: 2 suites / 3 tests; existing SequentialFoodCatalogResolver and SupabaseResolverRunLogger tests passed: 2 suites / 40 tests. `git diff --check`, TypeScript, ESLint and Prettier checks passed. No network/provider request was run.

## Next dependency

`RESOLVER-V3-015A` is the separately scoped private storage/RLS migration. V3-016 must not begin before that migration and privacy enforcement review.
