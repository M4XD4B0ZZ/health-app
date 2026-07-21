# Zera Resolver Knowledge Candidate Aggregation — Operational Boundary 1

## 1. Status and authority

**Status:** `accepted` (design only). **Task:** RESOLVER-V3-030. **Contract identifier introduced
here:** `resolver-knowledge-aggregation-operational-boundary-v1` (a design/governance contract, not a
runtime payload contract).

**Authority:** Level 2 canonical domain authority, binding for any future implementation of RESOLVER-V3-020's
operational pipeline. It is constrained by, and must not conflict with, the
[Knowledge-Growth Decision Record](ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md) (`accepted`,
Level 2) and the existing accepted contracts: the
[Candidate Contract](ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md) (`resolver-knowledge-candidate-v1`),
the [Review Contract](ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md) (`resolver-knowledge-review-v1`,
amended by RESOLVER-V3-028), and the
[Shadow Mode Contract](ZERA_RESOLVER_KNOWLEDGE_SHADOW_MODE_CONTRACT_1.md) (superseded to
`resolver-knowledge-shadow-evaluation-v2` by RESOLVER-V3-029). No conflict with any of these was found
during this task; see §27.

**This document does not amend, replace, or reinterpret `ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md`.**
That document remains the accepted description of RESOLVER-V3-020's isolated, inactive architecture as
merged. This document is additive: it defines what an operational successor **would** need to look like,
without claiming any of it exists yet.

**Decision owner:** encoded from the maintainer-authorized boundary decisions supplied for RESOLVER-V3-030.
Future change requires an explicit revision; implementation MUST NOT silently diverge from this design
without a documented amendment (the same pattern RESOLVER-V3-028/029 used against V3-020/021/022).

## 2. Purpose

RESOLVER-V3-020 built an isolated, inactive, privacy-safe candidate aggregation contract with no production
caller, no batch job, and no persistence adapter. The post-implementation review
(`reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`) found this acceptable as a
bounded architectural building block but explicitly not yet an operational pipeline, and tracked the
operational design question as RESOLVER-V3-030 so that RESOLVER-V3-023 (Learning Benchmark V2) would not
benchmark a pipeline whose privacy boundary, atomicity model, and evidence-derivation rules were still
undecided.

This document's purpose is exactly that decision: how RESOLVER-V3-020's inactive architecture **could
later** become a real, server-side, privacy-safe aggregation pipeline — without building it here. It closes
the architectural questions the review raised (real contradiction derivation, private/global storage
separation, idempotent atomic writes, fingerprint privacy, rejection suppression, duplicate/supersession
durability, batch mechanics, cost/privacy bounds, and independent-user evidence) as an accepted design, and
decomposes the remaining work into separately verifiable follow-up tasks. It does not implement, migrate, or
wire any of it, and it does not start RESOLVER-V3-023/024/010 or any candidate-aggregation implementation
follow-up.

## 3. Verified present state

Every claim below was independently confirmed by reading the current implementation in this checkout
(branch `claude/resolver-v3-030-operational-boundary-hs0dve`, based on `origin/chore/clean-arch-structure`
at `7c886d7e55c71d30e047758657b3963ba5c0b14f`), not inferred from prior handoffs or from the existence of
interfaces/in-memory adapters/migrations alone.

1. **Producer of `ResolverObservationAggregationProjectionV1`:** `ResolverObservationPrivacyEnforcer.project()`
   (`src/features/nutrition/application/observations/ResolverObservationPrivacyEnforcer.ts`) is the sole
   producer. It is a pure function: fail-closed contract/policy-version checks, then a closed-field
   projection.
2. **Real production path:** none. `grep` across `src/` confirms the only importers of
   `ResolverObservationPrivacyEnforcer`, `ResolverKnowledgeCandidateAggregator`,
   `ResolverKnowledgeCandidateRepository`, and `InMemoryResolverKnowledgeCandidateRepository` are each
   other, `src/features/nutrition/application/ports/index.ts` (a type re-export), and test files. No
   composition-root (`container.ts`), use case, script, or Supabase function calls any of them.
3. **Private fields before projection:** `ResolverObservation` (`domain/models/ResolverObservation.ts`)
   carries `observationId`, `resolverRunId`, `occurredAt`, `input.rawInput`, `input.normalizedInput`,
   `input.locale`, `input.inputType`, `decision.outcome`, `decision.reasonCodes`, `decision.candidateCount`,
   `decision.selectedSource.{type,id}`, `decision.provenanceStatus`, `versions.resolverVersion`,
   `operational.totalLatencyMs`. Its own `RESOLVER_OBSERVATION_FIELD_CLASSIFICATIONS` table classifies most
   of these as `private_raw` or `private_user_scoped`, plus `owner_id` at the storage layer (added by
   `SupabaseResolverObservationWriter`, not present on the domain object itself).
4. **Fields crossing the current aggregation projection boundary:** exactly
   `privacyPolicyVersion`, `contractVersion`, `locale`, `inputType`, `outcome`, `candidateCount`,
   `selectedSource: {type, id} | null`, `provenanceStatus`, `resolverVersion`, `totalLatencyMs`,
   `reasonCodes` (`ResolverObservationAggregationProjectionV1`, `domain/models/ResolverObservationPrivacy.ts`).
5. **Confirmed: the current projection still carries a selected source ID.**
   `ResolverObservationAggregationProjectionV1.selectedSource` is typed `{ type: 'bls' | 'off' | 'usda'; id:
string } | null`, and `ResolverObservationPrivacyEnforcer.project()` copies `observation.decision
.selectedSource` through unchanged (line 76). The candidate aggregator (`payloadFor()` in
   `ResolverKnowledgeCandidateAggregator.ts`) only ever reads `projection.selectedSource.type`, never
   `.id`, so the ID never reaches a candidate payload — but it is present in the projection object itself,
   which is exactly the shape decision #2 in this document's mandate requires closing (see §6).
6. **Fields participating in the current fingerprint:** `fingerprintFor()` hashes
   `JSON.stringify(payload)`, i.e. only the closed candidate payload
   (`type`, `locale`, `inputType`, and type-specific `sourceType`/`reasonCode`) — never evidence counts,
   timestamps, or the projection's `selectedSource.id`.
7. **Confirmed: FNV-1a is deduplication, not anonymisation.** `fingerprintFor()` implements the standard
   32-bit FNV-1a algorithm over the payload's JSON string. It is a fast, collision-tolerant hash with no
   cryptographic or privacy property; the Candidate Contract itself already states this ("It is
   deduplication, **not anonymisation**"). This document does not change that characterization; it decides
   the operational successor (§9).
8. **Candidate types (5, closed):** `source-routing-pattern`, `abstention-policy-signal`,
   `clarification-policy-signal`, `provenance-gap`, `negative-source-routing-rule`
   (`RESOLVER_KNOWLEDGE_CANDIDATE_TYPES`).
9. **Which projection conditions produce each type** (`payloadFor()` in
   `ResolverKnowledgeCandidateAggregator.ts`, checked in this order):
   - `outcome === 'accepted' && provenanceStatus === 'source_grounded' && selectedSource` →
     `source-routing-pattern`.
   - `outcome === 'ambiguous' && reasonCodes` contains `MULTIPLE_CLOSE_MATCHES` →
     `clarification-policy-signal`.
   - `provenanceStatus === 'not_resolved'` → `provenance-gap`.
   - `outcome === 'abstained' && reasonCodes` contains `NO_CANDIDATES`/`LOW_SCORE`, with `selectedSource`
     present → `negative-source-routing-rule`; without `selectedSource` → `abstention-policy-signal`.
   - Anything else → `null` (no candidate produced).
10. **Confirmed: one projection currently produces exactly one candidate with
    `supportingEvidenceCount: 1`, `contradictingEvidenceCount: 0`, `independentUserEvidence:
'not_evaluable'`** — hard-coded in `ResolverKnowledgeCandidateAggregator.aggregate()`'s evidence object
    literal (lines 131-138), for every non-null payload, regardless of projection content.
11. **Confirmed: current contradiction evidence is not derived across real observations by the
    aggregator.** `contradictingEvidenceCount` is always `0` from `aggregate()`; the only way a candidate's
    persisted `contradictingEvidenceCount` becomes nonzero is by additive merge in the repository (finding 12) or by a test hand-constructing a candidate object directly
    (confirmed by reading `ResolverKnowledgeCandidate.test.ts`).
12. **In-memory repository merge behavior:** `InMemoryResolverKnowledgeCandidateRepository.upsertInactive()`
    looks up an existing row by `fingerprint` (not by any per-contribution key). If found, it **additively
    sums** `supportingEvidenceCount`, `contradictingEvidenceCount`, `abstentionSignalCount`,
    `clarificationSignalCount` onto the existing row, unions the array fields, and recomputes
    `contradictionStatus` from the summed counts. There is no contribution-level record kept; only the
    running aggregate mutates.
13. **Confirmed: evidence accumulation does not create an immutable contribution record.** The only
    persisted objects are the mutable `ResolverKnowledgeCandidate` row (whose `evidence` counters are
    overwritten in place) and lifecycle events on `transitionInactive` (status transitions only, not
    evidence contributions). No per-contribution row exists anywhere in the codebase.
14. **Confirmed: retries can currently double-count evidence.** `upsertInactive` has no idempotency key —
    calling it twice with logically the same source contribution (same fingerprint, same evidence deltas)
    adds the deltas twice. Nothing in the aggregator, validator, or repository rejects or deduplicates a
    repeated call.
15. **Confirmed: candidate evidence summaries cannot currently be reconstructed from source
    contributions.** Because contributions are merged destructively into running counters with no
    contribution-level ledger, the summary cannot be recomputed from anything but itself; there is no
    lower-level record to replay.
16. **No production candidate repository adapter exists.** `find`/`grep` across
    `src/features/nutrition/infrastructure` show only `InMemoryResolverKnowledgeCandidateRepository`; no
    `Supabase*CandidateRepository` file exists anywhere in the repository.
17. **No server-side aggregation job exists.** No script, edge function, or scheduled workflow reads
    `resolver_observations` and calls the aggregator; `supabase/functions/` contains only
    `food-off-search`, `food-usda-search`, and `_shared` — no aggregation function.
18. **No scheduling, cursor, retry, deletion, replay, or partial-failure mechanism exists** for candidate
    aggregation. These concepts do not appear anywhere in `src/features/nutrition` outside this design's own
    new document.
19. **No live candidate migration has been applied.** Per the RESOLVER-V3-025/028 post-implementation
    findings (Supabase MCP access was `Unauthorized` in that review session, so live-project state is
    attributed to the source handoffs, not independently re-queried in that review or this one): the
    `resolver_knowledge_candidates`/`resolver_knowledge_candidate_events`/`resolver_knowledge_reviews`/
    `approved_resolver_knowledge`/`resolver_knowledge_review_events` migrations exist only as committed SQL
    files under `supabase/migrations/`; this task does not claim they have been applied to any live Supabase
    project, and does not apply them.
20. **Current RLS and grants** (read directly from
    `supabase/migrations/20260721070000_create_resolver_knowledge_candidates.sql` and
    `supabase/migrations/20260721120000_create_resolver_knowledge_reviews.sql`): RLS is enabled on all five
    tables (`resolver_knowledge_candidates`, `resolver_knowledge_candidate_events`,
    `resolver_knowledge_reviews`, `approved_resolver_knowledge`, `resolver_knowledge_review_events`), and
    every one of them explicitly `revoke`s all privileges from both `anon` and `authenticated`. No policy
    grants any row to any client role; no view, trigger, or RPC function exists over them. `resolver_observations`
    itself (`supabase/migrations/20260720120000_create_resolver_observations.sql`, per the
    RESOLVER-V3-017/similar precedent read alongside this inventory) is owner-scoped RLS for the writer path
    only — this design does not alter that table or its policies.
21. **Representation of rejected/duplicate/superseded/quarantined/approved candidates today:**
    `resolver_knowledge_candidates.status` is a closed check constraint including all of `candidate`,
    `needs_more_evidence`, `pending_review`, `rejected`, `duplicate`, `superseded`, `quarantined` (the
    RESOLVER-V3-028 migration widened it to also allow `approved`). `duplicate_of_candidate_id` and
    `superseded_by_candidate_id` are nullable self-referencing foreign keys, present on the schema and the
    domain type, but — confirmed by grep — never populated by any code path in this repository; no
    duplicate-detection or supersession logic exists yet anywhere outside the type definitions.
22. **Implemented / tested / merged / operational / production-wired / live-migrated / accepted status of
    current candidate-aggregation behavior**, using the RESOLVER-V3-025 classification legend:
    `implemented` (aggregator, validator, repository port, in-memory adapter, migrations all exist and
    typecheck against their contracts) · `tested` (`ResolverKnowledgeCandidate.test.ts`,
    `ResolverObservationPrivacyEnforcer.test.ts`, `ResolverKnowledgeCandidateMigration.test.ts` all pass) ·
    `merged` (PR #105 + hotfix PR #106, `89c5966aa1231e1a045210925402afd52fe8509d`) · **not** `operational`
    (finding 2) · **not** `production-wired` (finding 2) · **not** `live-migrated` (finding 19) · **not**
    `accepted` as an operational pipeline — accepted only as the isolated architectural boundary RESOLVER-V3-020
    itself claimed. This document changes none of these facts; it designs what would need to change them.

## 4. Trust-boundary diagram

```
┌─────────────────────────────── USER-FACING / APPLICATION BOUNDARY ───────────────────────────────┐
│  Journal logging, resolver decisions, personal memory  →  writes resolver_observations (owner-scoped RLS)  │
│  No app client, developer review UI, or benchmark harness ever reads this boundary's private tables.        │
└───────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │ (server-only batch worker, never a client SDK)
                                        ▼
┌───────────────────────────── PRIVATE AGGREGATION ZONE (server/admin-only) ─────────────────────────────┐
│  resolver_observations (existing, unchanged)                                                             │
│      │  bounded page read, deterministic cursor order                                                    │
│      ▼                                                                                                    │
│  Versioned privacy projection boundary (V2, §6)  — fails closed / quarantines unsafe rows                │
│      │  in-memory only; the full private observation is never handed to the candidate aggregator          │
│      ▼                                                                                                    │
│  Support/contradiction classification (§10)  — pure function over {projection, existing candidate view}  │
│      │                                                                                                    │
│      ▼                                                                                                    │
│  resolver_knowledge_contribution_ledger (new, private-zone-only, §8)                                       │
│      - private contribution key (idempotent, derived from observationId/resolverRunId)                    │
│      - pseudonymous contributor token (§11), key-managed, never leaves this zone                          │
│      - candidate fingerprint (safe — see §9), relation classification, active/retracted state              │
│  RLS: no `anon`/`authenticated` grant. No app view. No developer-review read path. No benchmark read path. │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │ atomic write boundary (§16); global summary is DERIVED, not authored
                                        ▼
┌────────────────────────────── GLOBAL CANDIDATE ZONE (server/admin-only, existing) ──────────────────────┐
│  resolver_knowledge_candidates / resolver_knowledge_candidate_events (existing RESOLVER-V3-020 tables)     │
│      - closed candidate payload, safe fingerprint, aggregate evidence SUMMARY, lifecycle state             │
│      - contract/privacy-policy versions, non-personal audit info                                           │
│      - NEVER: owner ID, observation/run/row ID, raw/normalized text, source ID, provider output, prompts,  │
│        personal aliases/recipes, per-user token, or any reversible user linkage                            │
│  RLS: no `anon`/`authenticated` grant (unchanged from V3-020).                                             │
└─────────────────────────────────────────────────────────────────────────────────────────────────────────┘
                                        │ RESOLVER-V3-021/028 review boundary (existing, unchanged by this design)
                                        ▼
                          approved_resolver_knowledge (existing) — still no resolver-effect wiring (V3-010 blocked)
```

The private aggregation zone and the global candidate zone are always two distinct storage surfaces. No
migration, adapter, or job introduced by a future follow-up task may collapse them into one table or one
RLS boundary.

## 5. Data-flow sequence

1. A server-only batch worker (§17) acquires a run identity and a bounded page of `resolver_observations`
   rows in deterministic cursor order.
2. Each row is projected through the versioned privacy boundary (§6). A row that fails projection is
   quarantined **in the private zone only** — it never reaches the global zone or any candidate payload.
3. For each successfully projected row, the worker computes the closed candidate payload (unchanged logic
   from `payloadFor()`, operating on the V2 projection) and its fingerprint (§9).
4. The worker classifies the contribution's relation to any existing candidate sharing that fingerprint
   (§10): `support`, `contradiction`, `orthogonal`, or `not_evaluable`.
5. The worker derives a private contribution key from private identifiers (never the fingerprint alone,
   never a random ID that would break idempotency) and, in one atomic operation (§16): inserts-or-no-ops the
   contribution ledger row, creates-or-updates the global candidate summary, records the lifecycle event
   where applicable, and advances the checkpoint.
6. The worker emits privacy-safe operational metrics (§21) and repeats from step 1 until the page is
   exhausted or a bound (§22) is reached.
7. Nothing in this sequence ever writes to `approved_resolver_knowledge`, mutates resolver ranking, or
   becomes visible to any user-facing code path.

## 6. Public/global versus private field matrix

| Field / concept                                                |           Private aggregation zone            |                                                             Global candidate zone                                                              | Notes                                                                                                                                                   |
| -------------------------------------------------------------- | :-------------------------------------------: | :--------------------------------------------------------------------------------------------------------------------------------------------: | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ownerId`                                                      |           never stored here either            |                                                                     never                                                                      | Not needed by either zone; the batch worker reads it only transiently from `resolver_observations` to scope its own read, never persists it downstream. |
| `observationId` / `resolverRunId`                              |  yes (as private contribution key material)   |                                                                     never                                                                      | Needed for idempotency/replay/retraction (§8); MUST NOT appear in any global row.                                                                       |
| raw/normalized input text                                      |   never persisted past the projection step    |                                                                     never                                                                      | Excluded by the V2 projection boundary itself (§6.1) — not merely filtered later.                                                                       |
| `decision.selectedSource.id` (source ID)                       |  never — the V2 projection drops it entirely  |                                                                     never                                                                      | Present-state finding 5: V1's projection still carries it even though the aggregator ignores it. V2 must not carry it at all.                           |
| `decision.selectedSource.type`                                 |          pass-through (operational)           |                                                           pass-through (operational)                                                           | Classification only, matches existing `sourceType` closed enum.                                                                                         |
| locale, input type, outcome, provenance status, reason codes   |      pass-through (already closed enums)      |                                                      pass-through (already closed enums)                                                       | Unchanged from V1's closed set.                                                                                                                         |
| exact private timestamps (`occurredAt`)                        | private-zone-only, for cursor/replay ordering | never (only lifecycle `occurredAt`, which is operational metadata about the aggregation event itself, not the private observation's timestamp) |                                                                                                                                                         |
| candidate fingerprint (safe, versioned)                        |       stored as a foreign reference key       |                                                             authoritative identity                                                             | Safe in both zones by construction (§9).                                                                                                                |
| contribution relation classification (support/contradiction/…) |            stored per-contribution            |                                                         summarized as aggregate counts                                                         | Global zone never sees which private contribution produced which count.                                                                                 |
| pseudonymous contributor token (§11)                           |               private-zone-only               |                                                                     never                                                                      | Never crosses into logs, fingerprints, review material, or benchmark artifacts.                                                                         |
| aggregate evidence counts, lifecycle status, risk              |          derived, not authoritative           |                                                                 authoritative                                                                  | Global row is a materialized view over active private-zone contributions.                                                                               |
| contract/privacy-policy/fingerprint-algorithm versions         |           recorded per-contribution           |                                                             recorded per-candidate                                                             | Both zones are version-stamped independently.                                                                                                           |

## 7. Contract-version strategy

Three independent version axes exist and must not be conflated:

1. **Observation contract version** (`resolver-observation-v1`, unchanged) — governs what a
   `ResolverObservation` looks like before any projection.
2. **Aggregation projection version** — today implicitly `resolver-observation-privacy-v1` (a _policy_
   version string reused as if it were a projection version; there is no explicit `projectionVersion`
   discriminant field on `ResolverObservationAggregationProjectionV1` today, unlike the shadow-mode
   pattern's explicit `projectionVersion` literal). This document requires a new, explicit
   `resolver-observation-aggregation-projection-v2` contract (§6 field table) with its own
   `projectionVersion` literal field, following the RESOLVER-V3-029 `ResolverProductionDecisionProjectionV1`
   precedent exactly. **V1 is not reinterpreted or silently upgraded.** A future operational pipeline MUST
   reject any input that is not exactly `v2`; `v1` objects, unknown versions, and mixed-version batches all
   fail closed, mirroring the shadow contract's `SHADOW_UNKNOWN_EVALUATION_VERSION` fail-closed pattern.
   V1's isolated aggregator (as merged in RESOLVER-V3-020) is unaffected and continues to exist as
   documented in the Candidate Contract; it is simply never fed by any operational job.
3. **Candidate contract version** (`resolver-knowledge-candidate-v1`, unchanged) — the closed candidate
   payload/evidence shape stays as accepted. Nothing in this design requires a new candidate contract
   version; the operational boundary changes _how_ candidates are produced and stored, not their shape.
4. **Fingerprint algorithm version** — new, independent of all the above (§9).

Any future code that cannot determine all four versions for a given row MUST treat it as unsafe and
quarantine it (§18), never guess or default.

## 8. Contribution-ledger model

A new private-zone-only table, `resolver_knowledge_contribution_ledger` (name illustrative; exact schema is
implementation scope, not decided here), append-only per contribution:

- `contribution_id` (private, deterministic from `{observationId, resolverRunId}` — a literal retry of the
  same observation re-derives the identical ID, so a unique constraint on it makes retries idempotent
  no-ops, exactly like `SupabaseResolverObservationWriter`'s existing `23505`-duplicate pattern).
- `candidate_fingerprint` (references the global zone's safe fingerprint — this is the _only_ link back to
  the global zone, and it is safe by construction).
- `relation` (`support` | `contradiction` | `orthogonal` | `not_evaluable`, §10).
- `contributor_token` (pseudonymous, §11; nullable if independent-user evidence is out of scope for this
  contribution's candidate type).
- `projection_version`, `fingerprint_version`, `candidate_contract_version` (recorded per row, not assumed).
- `status` (`active` | `retracted`), `retracted_at`, `retraction_reason` (closed enum: `owner_deletion` |
  `observation_invalidated` | `privacy_policy_revoked` | `source_update_invalidated` | `developer_action`).
- `created_at` (aggregation-event time, not the private observation's own timestamp — that stays in
  `resolver_observations`).

**Why append-only-with-retraction rather than mutable counters:** an accepted contribution is never edited
in place. Retraction sets `status = 'retracted'` and a reason; it never deletes the row outright, so the
audit trail ("why did this count change") survives even after the personal linkage it once represented is
gone (the `contributor_token` and any private key material referenced by it are what get destroyed/rotated
out on deletion — see §15 — not the ledger row's existence).

**Global summary derivation:** `resolver_knowledge_candidates.evidence` MUST be a materialized view that is
always re-derivable by replaying every `active` ledger row for a given fingerprint. A future implementation
MAY cache the summary in the global row for read performance, but the private ledger, not the cached
summary, is the source of truth. This directly answers present-state finding 15 (today, summaries cannot be
reconstructed from anything) and finding 13 (today, there is no immutable contribution record).

## 9. Candidate identity and fingerprint strategy

- **V1 (existing, unchanged):** FNV-1a over the closed payload JSON. Confirmed deduplication-only, not
  collision-resistant, not a privacy mechanism (finding 6-7). Continues to exist exactly as merged; this
  document does not touch `ResolverKnowledgeCandidateAggregator.fingerprintFor()`.
- **V2 (operational successor, decided here, not implemented here):** a versioned digest,
  `resolver-knowledge-fingerprint-v2`, computed only over the canonical serialization of
  `{candidateContractVersion, candidateType, closedGloballySafePayload}` — explicitly excluding source IDs,
  raw/normalized text fragments, observation IDs, owner-derived values, timestamps, evidence counts,
  resolver-run IDs, and provider/model identifiers (all of which V1 already excludes at the payload level,
  since the payload itself never carried them — V2's change is the algorithm, not the input shape).
- **Algorithm decision:** the operational fingerprint SHOULD use SHA-256 (or an equivalent deterministic
  cryptographic digest) rather than FNV-1a, because an operational pipeline's fingerprint is now also an
  idempotency and durable-identity key (§8, §12) where accidental collisions have a real correctness cost
  (merging two distinct candidates), not merely a cosmetic one. **This is a design decision, not an
  implementation** — no code changes are made in RESOLVER-V3-030.
- **Exact-match-only deduplication.** Fingerprint equality (exact digest match) MAY drive automatic
  deduplication. Approximate/semantic similarity between payloads MUST NOT automatically merge or
  supersede candidates (§13) — that always requires an explicit developer action or an explicit new
  candidate-contract/payload version with a stated supersession relation.
- Every candidate row and every contribution-ledger row records which fingerprint-algorithm version
  produced its fingerprint; a future migration path from v1 to v2 fingerprints (if ever undertaken) is out
  of scope here and would itself need an explicit follow-up design.

## 10. Support/contradiction matrix

Closed relation type: `support | contradiction | orthogonal | not_evaluable`. Applied per candidate type:

| Candidate type                 | Support rule                                                                  | Contradiction rule                                                                                                                                                                    | Orthogonal                                                                                                                                                                                                        | Not evaluable                                                                                                                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `source-routing-pattern`       | Identical safe payload and fingerprint (same locale, input type, source type) | An accepted `negative-source-routing-rule` contribution exists for the **same** `{locale, inputType, sourceType}` (positive routing vs. negative routing for the identical scope key) | A `source-routing-pattern` for a **different** `sourceType`, `inputType`, or `locale` is never automatically a contradiction — different source types are not automatically contradictions (explicit requirement) | Any relation this matrix does not explicitly enumerate                                                                                                                                                  |
| `negative-source-routing-rule` | Identical safe payload and fingerprint                                        | A `source-routing-pattern` contribution exists for the same `{locale, inputType, sourceType}` (mirror of the rule above)                                                              | Different `sourceType`/`inputType`/`locale`                                                                                                                                                                       | Unclassified combinations                                                                                                                                                                               |
| `abstention-policy-signal`     | Identical safe payload and fingerprint                                        | No closed contradiction rule is defined for this type in this design                                                                                                                  | A `source-routing-pattern`/`clarification-policy-signal` for the same scope is a distinct signal, not a contradiction, unless a future closed rule says otherwise                                                 | Everything else — **clarification, abstention, and provenance-gap signals must not be treated as contradictory unless an explicit closed rule says so** (explicit requirement; none is authorized here) |
| `clarification-policy-signal`  | Identical safe payload and fingerprint                                        | No closed contradiction rule defined here                                                                                                                                             | As above                                                                                                                                                                                                          | As above                                                                                                                                                                                                |
| `provenance-gap`               | Identical safe payload and fingerprint                                        | No closed contradiction rule defined here                                                                                                                                             | As above                                                                                                                                                                                                          | As above (routing signals for the same scope are not automatically contradictory with a provenance-gap signal)                                                                                          |

Unknown or unclassified relationships between any two candidate types, or between two payloads that do not
match one of the rules above exactly, MUST resolve to `not_evaluable` — **never guessed**, per the explicit
requirement. `not_evaluable` relations are still recorded in the ledger (they are real, classified
contributions, just not support or contradiction) but do not change `supportingEvidenceCount` or
`contradictingEvidenceCount`.

**Double-counting prevention:** one observation MAY contribute to more than one candidate (e.g. a single
projected row can match both a `source-routing-pattern` fingerprint and, independently, a
`provenance-gap` fingerprint if `payloadFor()`'s precedence ever produced more than one payload — today it
produces at most one payload per projection, so in practice one observation currently yields at most one
contribution; this design keeps that constraint but states it explicitly so a future payload change cannot
silently violate it). Whether one observation produces one or several contributions, each is a **separate**
ledger row with its own `contribution_id` derived from `{observationId, resolverRunId, candidateFingerprint}`
(not from the observation alone), so a retry of the same observation cannot double-count against any one
candidate, and one observation contributing to two distinct candidates is not treated as double-counting.

Contradiction counts on a candidate MUST always equal the count of `active` ledger rows classified
`contradiction` against that fingerprint — never a hand-constructed evidence object, closing present-state
finding 11.

## 11. Independent-user evidence boundary

A future server-only process MAY compute a **pseudonymous contributor token** entirely inside the private
aggregation zone (e.g. an HMAC of the owning user's ID under a server-held, rotatable key, scoped to a key
epoch). This token:

- is pseudonymisation, not anonymisation, and is documented as such, never described otherwise;
- MUST NOT leave the private aggregation zone under any circumstance — not into logs, candidate rows,
  fingerprints, review material, or benchmark artifacts (matching §6's field matrix);
- MUST be deletable: deleting a user's data MUST make their token unrecoverable (key/derivation-scoped
  deletion or per-user salt rotation — the exact mechanism is implementation scope, not decided here, but
  the requirement that deletion is possible is binding);
- key management: the HMAC key (or equivalent) MUST be rotatable on a schedule and on incident response;
  rotation invalidates the ability to recompute a given owner's token from scratch but does not need to
  retroactively invalidate already-recorded tokens unless a specific incident requires it (an incident
  response procedure, not designed further here).

**No numeric independent-user threshold is invented by this document**, consistent with the Decision
Record's explicit prohibition. Until a **separate, explicitly accepted** policy decision defines what counts
as sufficient independent evidence, the operational pipeline MUST continue emitting
`independentUserEvidence: 'not_evaluable'` for every candidate — never `'independently_confirmed'` merely
because more than one row or more than one distinct contributor token was observed. This is tracked as its
own blocked follow-up task (§25, RESOLVER-V3-035) rather than decided here.

## 12. Candidate lifecycle interaction

The lifecycle states, transitions, and review boundary defined by the Candidate Contract and the
RESOLVER-V3-028-amended Review Contract are unchanged by this design. The operational pipeline only ever
writes to the **inactive** side of the lifecycle (`candidate`, `needs_more_evidence`, `pending_review`,
`rejected`, `duplicate`, `superseded`, `quarantined`) exactly as `ResolverKnowledgeCandidateRepository`'s
port already restricts (`Exclude<..., 'approved'>`). The aggregation job:

- MAY create a new inactive candidate row (first `active` ledger contribution for a fingerprint).
- MAY update an existing inactive candidate's evidence summary (recomputed from the ledger, §8).
- MAY append a lifecycle event when a closed rule requires a state change (e.g. sufficient support moving
  `candidate → pending_review` once such a rule is separately accepted — no such rule is authorized by this
  document).
- MUST NOT transition any candidate to or from `approved` — that remains exclusively
  `ResolverKnowledgeReviewService`'s atomic `applyDecision` boundary (RESOLVER-V3-028).
- MUST NOT auto-reopen a `rejected`, `duplicate`, or `superseded` candidate (§13).

## 13. Rejection suppression

A candidate's versioned safe fingerprint is its durable identity, independent of lifecycle status. When a
candidate reaches `rejected`:

- new contributions whose payload produces the **same fingerprint** MUST be recorded as new `active` ledger
  rows against the **existing, retained** candidate identity — never as a new candidate row with a new ID.
- the rejected candidate row and its full lifecycle/review history are retained, never deleted.
- new evidence MAY accumulate in the candidate's evidence summary (it is still derived from the ledger, §8),
  but the batch job MUST NOT automatically transition the candidate out of `rejected` — `rejected →
pending_review`/`approved` transitions remain forbidden to any automated process.
- **Reconsideration requires either** an explicit, audited developer action (a new review decision, itself
  atomic and audited per RESOLVER-V3-028) **or** a new candidate-contract/payload version whose payload
  differs and therefore fingerprints differently, with an explicit supersession relation recorded (§14) —
  never a silent implicit reopening.

**Materially changed payload vs. a retry of the rejected payload:** a "retry" is, by definition, a
contribution whose closed payload serializes identically to the rejected candidate's payload (same
fingerprint). A "materially changed payload" is one where at least one closed field differs — which, by
construction, produces a **different** fingerprint and therefore a **different** candidate identity. There
is no partial-match middle ground: the fingerprint is the payload's entire identity, so any material change
is definitionally a new candidate, and any exact repeat is definitionally the same (rejected) candidate.

## 14. Duplicate/supersession rules

- **Exact fingerprint duplicates** always resolve to one durable candidate identity — this is definitional
  (§9), not a separate mechanism: two contributions producing the same fingerprint are, by construction, the
  same candidate row.
- **Developer-marked duplicates** (`mark_duplicate`, existing Review Contract action) set
  `duplicateOfCandidateId` to an explicit, existing, different candidate. Self-reference
  (`duplicateOfCandidateId === candidateId`) is forbidden and fails closed at write time (already true of
  the Review Contract's `validation_failed`/`candidate_not_found` fail-closed behavior; this design does not
  weaken it).
- **Supersession** (`supersede`) sets `supersededByCandidateId` similarly, with the same self-reference
  prohibition.
- **Canonical-target selection:** when routing a new contribution that matches a candidate which is itself
  `duplicate` or `superseded`, the aggregation job MUST resolve to the **terminal** candidate in the
  duplicate/supersession chain (follow `duplicateOfCandidateId`/`supersededByCandidateId` links until
  reaching a candidate with neither field set), and MUST detect and refuse to write through a cycle (a chain
  that revisits a candidate ID already seen in the current resolution) — a cycle is a data-integrity fault
  to be quarantined/alerted on, never silently resolved by picking either endpoint.
- **Target existence:** if a chain link points at a candidate ID that does not exist (a data-integrity
  fault, not expected under the referential-integrity foreign keys already present in the V3-020 migration),
  the write fails closed rather than falling back to the broken link's own row.
- **A duplicate or superseded candidate cannot silently reactivate.** New contributions routed to its
  canonical target update the target's summary, never the duplicate/superseded row's own status.
- **Historical rows and review decisions are retained** in all cases — no duplicate/supersession decision
  deletes a row.
- **Approximate similarity alone cannot create a duplicate or supersession relation** — only exact
  fingerprint equality (automatic) or an explicit developer/review action (`mark_duplicate`/`supersede`) can,
  matching §9's exact-match-only deduplication rule.
- **Contribution routing after a duplicate/supersession decision:** all future contributions matching the
  original (now-duplicate/superseded) fingerprint route to the canonical target's summary from the moment
  the decision is recorded onward; contributions already recorded before the decision are not retroactively
  rewritten (the ledger is append-only, §8) but are logically included when the canonical target's summary
  is recomputed, since the recomputation walks the canonical chain.
- **Candidate-version changes:** if a future candidate-contract version changes the payload shape, rows on
  the old version are never silently reinterpreted as the new version's shape; an explicit supersession
  relation across versions is the only sanctioned link, consistent with §7's version fail-closed rule.

## 15. Deletion and retraction behavior

| Trigger                                         | Private aggregation zone effect                                                                                                                                                                                                                                | Global candidate zone effect                                                                                                     |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| User deletes their data                         | Every ledger row whose `contributor_token` traces to that user (via key-scoped lookup, never a reverse index stored globally) is marked `retracted` with reason `owner_deletion`; the token's own key material is destroyed/rotated so it cannot be recomputed | Affected candidates' evidence summaries are recomputed from remaining `active` rows; no user linkage ever existed here to remove |
| A private observation is invalidated            | The specific ledger row(s) derived from that `observationId` are retracted (`observation_invalidated`)                                                                                                                                                         | Summary recomputed                                                                                                               |
| An observation contract is found unsafe         | All ledger rows produced under the affected `projection_version`/`observation_contract_version` are retracted in bulk (`observation_invalidated`), and that version is marked unsafe for any future run (§7 fail-closed)                                       | Summaries recomputed for every affected fingerprint                                                                              |
| A source update invalidates prior evidence      | Ledger rows referencing the affected `sourceType` scope are retracted (`source_update_invalidated`)                                                                                                                                                            | Summary recomputed; may drop the candidate to `needs_more_evidence` per a closed transition rule (not authorized further here)   |
| A correction contradicts an earlier observation | A **new** contribution is recorded with `relation: contradiction` against the appropriate fingerprint (§10); the earlier contribution is not deleted — contradictory evidence is additive history, not a retraction                                            | Contradiction count increases; existing support count is unchanged (the earlier support was real evidence at the time)           |
| A privacy-policy version is revoked             | All ledger rows produced under that `privacyPolicyVersion` are retracted (`privacy_policy_revoked`) in bulk                                                                                                                                                    | Summaries recomputed                                                                                                             |

**For already-`approved` curated knowledge:** the aggregation job MUST NOT silently change production
behavior when evidence underlying an approved payload is retracted. It MAY emit a server-side reassessment
signal for the existing review/revocation workflow (RESOLVER-V3-028's `revoke_approval`/`rollback` actions)
— **this document does not implement that signal**; it only reserves the requirement. The global candidate
row never retains user linkage after a retraction, because it never held any user linkage to begin with
(§6's field matrix) — retraction only ever changes derived counts, never adds or removes identity data at
the global layer.

## 16. Atomicity and idempotency model

**Present-state constraint that shapes this decision:** this repository has **no existing RPC, stored
procedure, or multi-statement transaction precedent** anywhere (confirmed by `grep` across
`supabase/migrations` and `src` for `create function`/`.rpc(`) — every existing "atomic" write in this
codebase is one of two patterns: (a) a single-table insert relying on a unique constraint and a `23505`
duplicate-code catch (`SupabaseResolverObservationWriter`, `SupabasePersonalResolutionMemoryRepository`), or
(b) an in-memory reference adapter that snapshots and restores multiple internal maps around a `try`/`catch`
to _simulate_ multi-step atomicity for tests (`InMemoryResolverKnowledgeReviewRepository`, per RESOLVER-V3-028).
Neither pattern, as-is, can atomically span the ledger insert + candidate summary upsert + lifecycle event +
checkpoint advance this design requires across **two separate tables in two zones**.

**Chosen atomic boundary:** a single **Postgres function** (`SECURITY DEFINER`, owned by a migration, never
callable by `anon`/`authenticated`), invoked via one `supabase.rpc(...)` call from the server-only batch
worker process. A single Postgres function body executes inside one implicit transaction, so it can
atomically: (1) insert the contribution-ledger row with `ON CONFLICT (contribution_id) DO NOTHING` (idempotent
no-op on retry), (2) if newly inserted, upsert the candidate summary row and append a lifecycle event where
a closed rule requires one, and (3) advance the run's checkpoint row — all-or-nothing. **This is a new
architectural pattern for this codebase (first RPC/stored-function precedent) and is stated as such — it is
a design decision, not implemented, tested, or migrated by RESOLVER-V3-030.**

Rejected alternative: a client-side multi-step sequence (insert ledger row, then separately update candidate
row, then separately insert event) mirroring the in-memory snapshot/restore pattern. This was rejected
because supabase-js has no multi-statement client transaction primitive equivalent to a real database
transaction, and a partial client-side failure between steps would reproduce exactly the
non-atomicity defects RESOLVER-V3-021/028 already had to remediate (two separate non-transactional writes).
A single RPC avoids re-introducing that defect class.

**Idempotency guarantee:** the contribution ledger's unique `contribution_id` (deterministic from
`{observationId, resolverRunId, candidateFingerprint}`) is the sole idempotency key. A literal retry of the
same batch page re-derives the same IDs, hits the `ON CONFLICT DO NOTHING` branch, and performs zero
additional mutation — directly closing present-state finding 14 (today's unbounded double-counting risk).

**Partial-failure guarantees required of this boundary** (restated from the mandate, all satisfied by a
single-transaction RPC): a partial failure must not advance the checkpoint without recording the
contribution; must not record a contribution without updating its candidate summary; must not update a
candidate count twice; must not leave contradictory evidence in only one of the relevant records. Because
steps (1)-(3) above are one transaction, a failure at any point rolls back all of them together — there is
no partial state to reason about beyond "committed" or "not committed."

## 17. Batch execution model

1. **Acquire a server-only run identity.** A new run row (private zone) records a unique run ID, start
   time, and a lease (expiry timestamp) so a crashed worker's lease can be reclaimed by a later run rather
   than blocking forever.
2. **Read a bounded private-observation page**, ordered by a stable, deterministic cursor
   (`(occurred_at, observation_id)` composite, matching this codebase's existing pattern of using
   `observation_id` as a stable tiebreaker) — never an unordered `LIMIT` scan, so retries and resumes are
   reproducible.
3. **Project each observation** through the V2 privacy boundary (§6/§7).
4. **Fail closed or quarantine unsafe projections** — a row that fails projection is recorded in a
   private-zone-only quarantine table (poison-row handling) with a closed reason and is skipped for
   candidate purposes; it never blocks the rest of the page and never reaches the global zone.
5. **Classify support/contradiction** (§10) against existing candidates sharing the resulting fingerprint.
6. **Write contributions and candidate summaries atomically** via the RPC boundary (§16).
7. **Persist a deterministic checkpoint** (the cursor position of the last successfully committed row),
   advanced only inside the same atomic unit as the row it corresponds to (never batched separately from the
   contribution it describes, per §16's partial-failure guarantee).
8. **Emit privacy-safe operational metrics** (§21) for the page.
9. **Finish, retry, or stop with a closed run status** (`completed`, `partial` [hit a bound, resumable],
   `failed` [poison rows exceeded a bound or a hard error occurred], `dry_run_completed`).

**Additional required properties:**

- **Stable cursor semantics / retries / replay:** the `(occurred_at, observation_id)` cursor is
  reconstructible from `resolver_observations` alone; replaying from an earlier checkpoint is safe because
  every write downstream is idempotent (§16).
- **Concurrency / locking / lease:** the run-lease mechanism (step 1) prevents two concurrent workers from
  processing the same page; a lease that expires without a heartbeat is reclaimable.
- **Poison rows / quarantine:** handled at step 4, private-zone-only, bounded by a configurable per-run
  quarantine limit (§22) above which the run reports `failed` rather than silently discarding an unbounded
  number of rows.
- **Timeout / bounded pages:** page size and per-run wall-clock duration are both configurable hard bounds
  (§22), not unbounded scans.
- **Crash recovery:** the lease + idempotent-write design means a crashed worker's partial page can be
  safely reprocessed by a new run from the last committed checkpoint.
- **Deterministic ordering:** guaranteed by the cursor (step 2); no worker may reorder within a page.
- **Schema and policy version changes:** any row whose `contract_version`/`privacy_policy_version`/
  `projection_version` the current worker does not recognize is quarantined (step 4), never guessed.
- **Dry-run behavior:** a `--dry-run` mode runs steps 1-5 and computes what _would_ be written, emitting
  metrics only, with the RPC boundary never invoked — useful for verifying a new projection/classification
  version before it can mutate anything.
- **Operator-visible diagnostics without private data:** all diagnostics come from the metrics set in §21,
  never from raw row contents.

**Deployment mechanism comparison** (a decision, not an implementation): this repository has exactly two
existing "runs on a schedule / runs server-side" precedents to compare against: (a) Supabase Edge Functions
(`supabase/functions/food-off-search`, `food-usda-search` — request-triggered, not scheduled, and today
callable from the client, which is the wrong trust boundary for a service-role batch job), and (b) the
benchmark scripts under `scripts/*.mjs` (operator-invoked Node scripts, never scheduled, never holding
service-role credentials). **Neither existing precedent is directly reusable as-is** — a is client-triggerable
today (wrong trust boundary) and b is not currently scheduled or service-role-authorized. The batch worker
this design requires is therefore a **new** operator/scheduler-invoked process (e.g. a scheduled Supabase Edge
Function variant restricted to service-role internal invocation, or an external scheduled job holding a
service-role key never exposed to any app client) — **no app client may hold service-role credentials or
invoke the raw aggregation operation directly**, and choosing the exact scheduling substrate is implementation
scope for a follow-up task (§25, RESOLVER-V3-034), not decided further here beyond this comparison and the
binding constraint that it must not be client-reachable.

## 18. Failure and recovery matrix

| Failure                                                                                    | Detection                                                                                              | Recovery                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Worker crashes mid-page                                                                    | Lease expiry (no heartbeat)                                                                            | A later run reclaims the lease and resumes from the last committed checkpoint; already-committed contributions are untouched (idempotent)                                                     |
| RPC call fails mid-transaction                                                             | Postgres rolls back the whole function body                                                            | Retry the same row(s) safely — idempotent by `contribution_id`                                                                                                                                |
| Unrecognized contract/policy/projection version                                            | Version check in the projection boundary (§6/§7)                                                       | Row quarantined, never processed; run continues; version added to an explicit denylist for operator triage                                                                                    |
| Poison row (malformed observation)                                                         | Projection/validation failure (existing fail-closed pattern from `ResolverObservationPrivacyEnforcer`) | Quarantined (private zone only), counted, run continues unless quarantine bound (§22) exceeded                                                                                                |
| Duplicate/supersession cycle detected                                                      | Chain-walk cycle check (§14)                                                                           | Write refused for that contribution; flagged for operator/developer triage, never silently resolved                                                                                           |
| Checkpoint and ledger disagree after a crash (should be structurally impossible given §16) | Startup consistency check comparing checkpoint cursor against the ledger's max committed row           | Run refuses to proceed automatically; escalates for manual review rather than guessing which is correct                                                                                       |
| Independent-user token key rotation mid-run                                                | Key epoch mismatch on token derivation                                                                 | Contributions in that run's remaining rows use the new epoch; already-recorded tokens under the prior epoch are unaffected unless an explicit incident-response retraction is triggered (§15) |

## 19. Security and access-control model

- The private aggregation zone and the global candidate zone are both server/admin-only: RLS enabled, no
  `anon`/`authenticated` grant, no application view, exactly like the existing V3-020/021/028 tables (§3
  finding 20) — this design does not weaken that posture anywhere.
- The batch worker itself is the only principal permitted to invoke the atomic RPC boundary (§16); it runs
  with service-role credentials that no app client ever holds, per the explicit "no app client may hold
  service-role credentials or invoke the raw aggregation operation directly" requirement.
- Developer review material (RESOLVER-V3-021/028) and any future benchmark harness read only the global
  candidate zone and the review tables — never the private aggregation zone, never a contributor token,
  never a private contribution ID.
- No production resolver code path gains read access to either zone; RESOLVER-V3-010 remains blocked and
  unrelated.

## 20. Retention and key-management requirements

- Contribution-ledger rows are retained (with `retracted` status where applicable) for as long as needed
  for audit and recomputation; a hard retention bound is a pre-implementation policy gate (§22), not a
  number invented here.
- The pseudonymous-token key (§11) is rotatable on a schedule and on incident response; rotation policy
  specifics (interval, incident triggers) are implementation scope for the independent-user-evidence policy
  follow-up (§25, RESOLVER-V3-035), not decided here beyond "must be rotatable and deletion-compatible."
- Quarantined/poison-row records (§17 step 4, §18) are private-zone-only and subject to the same retention
  and deletion rules as any other private-zone row.

## 21. Privacy-safe operational metrics

All metrics below are counts/durations/enums only — never user, observation, source, query, or food
identifiers:

- `observationsScanned`, `projectionsAccepted`, `projectionsBlockedByReason` (keyed by the existing closed
  `ResolverObservationDeidentificationResult` blocked-reason enum), `contributionsCreated`,
  `idempotentRetriesSkipped`, `candidatesCreated`, `candidatesUpdated`, `supportRelationsRecorded`,
  `contradictionRelationsRecorded`, `orthogonalRelationsRecorded`, `notEvaluableRelationsRecorded`,
  `quarantinedRowCount`, `rejectedCandidateMatchesRetained`, `batchDurationMs`, and
  `databaseOperationsOrEstimatedCost` (where measurable, following the RESOLVER-V3-029 pattern of a typed
  `evidenceClass` on every rate/derived metric rather than a bare number).

## 22. Cost controls

Aggregation makes no AI/provider calls (unlike the resolver's own decision path); its only cost surface is
database operations and worker wall-clock time. The following MUST be configurable hard bounds before any
implementation runs against real data — **no numeric value is invented here**, consistent with the
Decision Record's explicit prohibition on inventing thresholds. Each is marked as an explicit
pre-implementation policy gate requiring its own accepted value before the batch worker (RESOLVER-V3-034)
may run outside dry-run mode:

- rows per batch page; maximum execution duration per run; maximum retries per contribution; maximum
  concurrent runs (interacting with the lease mechanism, §17); retained private-contribution-history
  duration; maximum diagnostic/log output size; maximum candidate updates per run; maximum replay range
  (how far back a replay may re-scan).

## 23. Benchmark interface

RESOLVER-V3-023 (Learning Benchmark V2) MAY consume, once the relevant follow-up tasks below exist:

- versioned privacy-safe projections (V2, §6/§7) as fixture inputs;
- deterministic contribution classifications (§10) computed by the same pure classification function the
  operational pipeline would use;
- **immutable fixture contribution ledgers** — synthetic, versioned, source-controlled ledger fixtures built
  the same way the RESOLVER-V3-029 corpus registry manifest is source-controlled data, never a live-database
  export;
- candidate snapshots (existing shape, unchanged);
- support/contradiction summaries derived the same way the operational pipeline would derive them;
- duplicate/rejection/supersession behavior (§13/§14), exercised against fixture candidates;
- deletion/retraction sequences (§15), exercised against fixture ledgers;
- batch cost and operation counts (§21), from a dry-run or fixture-driven execution, never a live run;
- development/holdout registry information from RESOLVER-V3-029's
  `ResolverKnowledgeShadowCorpusRegistry` pattern.

**It must not consume real private user rows as fixtures.** This document does not build the Learning
Benchmark V2 corpus (that remains RESOLVER-V3-023's own scope).

**Critical assessment: is this design alone sufficient to unblock RESOLVER-V3-023? No.** A design document
does not give the benchmark any code to call. Specifically, the benchmark's required "deterministic
contribution classifications" (§10) and "duplicate/rejection/supersession behavior" (§13/§14) do not exist
as callable, testable logic anywhere in `src/` today — only as rules in this document. Those rules are pure
domain/application logic (they do not require a live Supabase adapter, a batch worker, or a service-role
credential to be exercised against in-memory fixtures), so they do not need the full operational pipeline
built — but they **do** need to be implemented and tested before a benchmark can exercise them.
Consequently: **RESOLVER-V3-023 remains `blocked`**, and this document adds RESOLVER-V3-031 (projection V2 /
fingerprint V2 / classification logic) and RESOLVER-V3-032 (contribution ledger, rejection-suppression,
duplicate/supersession, and deletion/retraction logic — all implementable and fixture-testable without a
live backend) as **new, explicit dependencies** of RESOLVER-V3-023, in addition to its existing dependencies.
RESOLVER-V3-033/034 (server-side persistence adapter and batch worker) and RESOLVER-V3-035 (independent-user
policy) are **not** added as RESOLVER-V3-023 blockers, because the benchmark's own scope (fixture/dev-holdout
based, per the Decision Record §10) does not require live production infrastructure or a settled
independent-user threshold to exercise the classification and lifecycle rules above against fixtures. This
document does not claim RESOLVER-V3-030's completion alone makes the benchmark executable.

## 24. Migration/deployment non-authorization

This document authorizes no migration, no RPC/stored-function creation, no Supabase adapter, no batch
worker deployment, no scheduling configuration, and no live database change of any kind. Every SQL/RPC/
adapter/worker sketch above is illustrative of the accepted architecture, not a schema to apply. Any future
implementation task that touches `supabase/migrations/**` requires its own explicit task authorization per
`.governance/SAFETY.md`'s conditional-protection rule for database migrations, and its own `npm run verify`
plus edge/schema verification per `VERIFY.md`'s Category 5 requirements where applicable.

## 25. Implementation decomposition

Six new follow-up tasks are added (§26 lists dependency edges; full ROADMAP entries are in `ROADMAP.md`):

- **RESOLVER-V3-031** — Aggregation Projection V2, Fingerprint Versioning, and Closed Support/Contradiction
  Classification.
- **RESOLVER-V3-032** — Private Contribution Ledger, Rejection Suppression, Duplicate/Supersession, and
  Deletion/Retraction Recomputation.
- **RESOLVER-V3-033** — Server-Side Atomic Aggregation Persistence Adapter.
- **RESOLVER-V3-034** — Supervised Aggregation Batch Worker.
- **RESOLVER-V3-035** — Independent-User Evidence Aggregation Policy Decision.
- **RESOLVER-V3-036** — Aggregation Operational Smoke Verification.

None of these is started by RESOLVER-V3-030 itself.

## 26. Residual limitations

- No numeric cost/privacy bound is decided (§22) — every one is an explicit pre-implementation policy gate
  for RESOLVER-V3-034.
- No independent-user-evidence sufficiency policy is decided (§11) — a separate, explicitly blocked follow-up
  (RESOLVER-V3-035).
- The RPC/stored-function pattern this design requires (§16) has no precedent anywhere in this codebase; the
  first implementation of it is architecturally novel for this repository and will need its own careful
  review beyond what this design can anticipate.
- The exact scheduling substrate for the batch worker (§17) is not chosen, only bounded by the constraint
  that no app client may hold service-role credentials.
- The fingerprint-version migration path (v1 → v2, §9) is explicitly out of scope and unresolved.
- This design does not re-examine whether the five existing candidate types (§3 finding 8) are sufficient
  for a real operational pipeline; that question is deferred to whoever implements RESOLVER-V3-031.

## 27. Supersession/conflict analysis

No conflict was found between this document and any higher canonical authority:

- **Knowledge-Growth Decision Record:** this design's private/global zone separation, fail-closed versioning,
  no-auto-promotion rule, negative-knowledge preservation, and "one user cannot found a global rule" fail-closed
  independent-user-evidence default are all direct implementations of that record's binding invariants (§4,
  §6-9 there). No divergence found.
- **Candidate Contract (`resolver-knowledge-candidate-v1`):** this design does not change the candidate
  payload/evidence shape, the closed candidate types, or the RLS/grant posture it established; it is
  additive around it. No conflict.
- **Review Contract (amended by RESOLVER-V3-028):** this design does not touch the review action set,
  atomic `applyDecision` boundary, or the fail-closed `independentUserEvidence` gate — it explicitly
  preserves "no candidate can reach `approved` on `not_evaluable` evidence alone." No conflict.
- **Shadow Mode Contract (`resolver-knowledge-shadow-evaluation-v2`):** this design explicitly does **not**
  reuse the shadow projection for candidate aggregation (per the maintainer-authorized instruction that
  shadow evaluation and candidate aggregation are distinct contracts with distinct purposes), even though
  both are privacy-safe projections of related source data. No conflict; this is a deliberate non-reuse, not
  an oversight.
- **`.governance/SAFETY.md` / `AGENTS.md` (git-workflow authority):** `.governance/SAFETY.md` lists "push to
  remote repositories" among actions "never allowed for all agents," which appears to conflict with this
  task's required git/PR/merge workflow. `AGENTS.md`'s own "Dual Governance During Transition" section
  resolves this: `.governance/` policy is binding for Ralph-Loop (`RALPH-XXX`) tasks specifically, while
  existing product tasks (this one is `RESOLVER-V3-030`) continue under the Roo/root-file operational model,
  where push/PR/merge is permitted with the explicit task-level authorization this task's instructions
  provide (matching the precedent already set by the merged RESOLVER-V3-025 through RESOLVER-V3-029 PRs).
  This is reported here explicitly per this task's own instruction to surface any conflict found during the
  mandatory source reading, and is not treated as blocking.

No other conflicts were found.

## 28. Explicit acceptance decision

The maintainer-authorized boundary decisions supplied for RESOLVER-V3-030 are accepted as binding for any
future implementation of RESOLVER-V3-020's operational successor, as encoded in §4-§23 above. This document
itself authorizes planning only — no product code, migration, live database change, or aggregation job. The
follow-up tasks in §25/§26 are the only sanctioned path to implementation, each requiring its own separate
task authorization, verification, and review before it may proceed.
