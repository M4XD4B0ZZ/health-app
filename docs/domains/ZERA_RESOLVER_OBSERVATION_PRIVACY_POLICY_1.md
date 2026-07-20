# Zera Resolver Observation Privacy Policy 1

**Policy version:** `resolver-observation-privacy-v1`
**Status:** accepted for RESOLVER-V3-016; no global aggregation is enabled.

## Boundary and retention

`resolver_observations` is an owner-scoped private evidence store. It is not a resolver read path, cache, memory, knowledge candidate, review object, or global table. Private rows remain until an explicit current-owner deletion, account deletion (`owner_id ... on delete cascade`), or a later accepted retention policy. V1 defines no automatic retention duration or background job.

The only V1 projection is an in-memory application/domain value. It is not persisted or consumed. No raw input, normalized input, owner, row/observation/run ID, exact timestamp, journal/food-entry/correction reference, metadata bag, provider response, prompt, secret, header, or stack trace can enter it. Normalized text remains blocked: aliases/terms require a future explicitly accepted policy revision or controlled server-side process, not a hash, encryption, heuristic, or invented threshold.

## Field inventory and deterministic treatment

| Boundary / field                                                                   | Classification                                              | V1 treatment                                                          |
| ---------------------------------------------------------------------------------- | ----------------------------------------------------------- | --------------------------------------------------------------------- |
| `id`, `owner_id`, `observation_id`, `resolver_run_id`, `occurred_at`, `created_at` | direct/linkable private identifiers or activity correlation | retain private / exclude projection                                   |
| `contract_version`                                                                 | closed operational                                          | project as closed field                                               |
| `observation_payload` and containers                                               | private containers; never recursively approved              | retain private                                                        |
| `input.rawInput`, `input.normalizedInput`                                          | free text / semantically linkable                           | retain private / require later approved de-identification             |
| `input.locale`, `input.inputType`                                                  | closed structured                                           | project as closed fields                                              |
| `decision.outcome`, `candidateCount`, `provenanceStatus`                           | closed structured                                           | project as closed fields                                              |
| `decision.reasonCodes`                                                             | machine-code array, not free text                           | project only from the closed allowlist; otherwise block               |
| `decision.selectedSource.type`                                                     | closed source type                                          | project only for `bls`, `off`, `usda`; otherwise block                |
| `decision.selectedSource.id`                                                       | source identifier                                           | project only with an approved non-personal source type; `user` blocks |
| `versions.resolverVersion`, `operational.totalLatencyMs`                           | controlled operational                                      | project as closed fields                                              |

Every V1 nested field is listed in the executable catalog. Unknown contract fields, contract versions, or policy versions fail closed. `user` source IDs are private. No source ID is projected for unknown types. The reason-code set is deliberately closed (`NO_CANDIDATES`, `ACCEPTED_STRONG_MATCH`, `MULTIPLE_CLOSE_MATCHES`, `LOW_SCORE`, `BLS_GENERIC_TRUTH`, `USER_SOURCE_PRIORITY`); unrecognized values block rather than being exported.

## De-identification result and access

The enforcer returns only `projected` (the closed shape) or `blocked` with a closed secret-safe code. It does not silently drop fields. Owner deletion obtains the owner from the canonical auth provider, then deletes only matching rows through the private deletion port; missing owner and adapter errors fail closed. RLS remains defense in depth: authenticated owner-only select/insert/delete, no update, no anonymous policy, no global read. Account cascade remains in the existing migration.

## Logging

Normal resolver/observation logs use closed codes and do not log raw input or owner ID. Sensitive query/source diagnostics remain behind the explicit resolver debug gate and are not a normal production logging path. No full Supabase response is logged.

## Explicit non-goals and open decisions

This policy creates no multi-user query/count, aggregation job, candidate persistence, alias, promotion, service-role bypass, resolver input, or global effect. A later policy must separately decide safe semantic term aggregation, any retention duration, and any server-side aggregation path.
