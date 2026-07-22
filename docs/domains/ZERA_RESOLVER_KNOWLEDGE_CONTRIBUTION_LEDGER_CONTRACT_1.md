# Zera Resolver Knowledge Contribution Ledger — Contract 1

## 1. Status and authority

**Status:** `implemented` (in-memory reference model), `tested`. **Not** `production-wired`,
**not** `live-migrated`, **not** an `accepted` production persistence design beyond what
[`ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`](ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md)
(`accepted`, Level 2) already decided. **Task:** RESOLVER-V3-032. **Contract identifier introduced
here:** `resolver-knowledge-contribution-ledger-v1`.

**Authority:** Level 2 canonical domain authority for the in-memory reference implementation only.
It implements, but does not amend or reinterpret, the operational-boundary document's §8
(contribution-ledger model), §9 (candidate identity/fingerprint), §10 (support/contradiction
matrix — consumed via RESOLVER-V3-031's classifier, not reimplemented), §13 (rejection
suppression), §14 (duplicate/supersession), and §15 (deletion/retraction). It does not implement
§11 (independent-user evidence/contributor token), §16 (atomicity/RPC), or §17 (batch execution) —
those remain RESOLVER-V3-033/034/035 scope, exactly as RESOLVER-V3-031's own implementation note
(operational-boundary §29) already stated.

**This document does not amend
[`ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md`](ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md)**.
The ledger contract is additive and structurally separate from `resolver-knowledge-candidate-v1`;
it consumes the existing `ResolverKnowledgeCandidate` type as a read/write target for its
`evidence` field only, through the same explicit shared-store boundary pattern the review
in-memory repository already uses.

## 2. Private/global trust boundary

Two zones, exactly as decided in the operational-boundary document §4/§6:

- **Private contribution-ledger zone** (this contract): immutable contributions, immutable
  retraction events. Contains `observationId`, `resolverRunId`, and a reserved (always-`null`)
  `contributorToken` slot. Never read by any global-facing candidate/review/shadow/benchmark code
  path.
- **Global candidate zone** (existing `resolver-knowledge-candidate-v1`): the candidate row's
  `evidence` field is a materialized view, always re-derivable by replaying active ledger rows.
  Never contains a contribution ID, observation ID, resolver-run ID, or contributor token.

Enforced by: closed runtime validation (root/nested key allowlists, fail-closed on unknown
fields/versions), a dedicated legacy-evidence mapping function that only ever copies safe
aggregate fields, and adversarial source-scan tests
(`ResolverKnowledgeContributionLedgerIsolation.test.ts`) proving no ledger symbol is referenced
outside its own source/tests, the DI container, or the two global-facing model files
(`ResolverKnowledgeCandidate.ts`, `ResolverKnowledgeReview.ts`).

## 3. Exact contribution fields

`ResolverKnowledgeContribution`
(`src/features/nutrition/domain/models/ResolverKnowledgeContributionLedger.ts`):

| Field                          | Type                                                              | Notes                                                                                         |
| ------------------------------ | ----------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `ledgerContractVersion`        | `'resolver-knowledge-contribution-ledger-v1'`                     | closed literal                                                                                |
| `contributionId`               | `string`                                                          | deterministic, private (§5)                                                                   |
| `observationId`                | `string`                                                          | private-zone-only                                                                             |
| `resolverRunId`                | `string`                                                          | private-zone-only                                                                             |
| `originalCandidateFingerprint` | `{ fingerprintVersion, digest }`                                  | the V2 fingerprint of the **originally matched** candidate                                    |
| `originalCandidateId`          | `string`                                                          | the originally matched candidate's ID (may later become duplicate/superseded)                 |
| `candidatePayload`             | `ResolverKnowledgeCandidatePayload`                               | the incoming payload, validated                                                               |
| `relation`                     | `'support' \| 'contradiction' \| 'orthogonal' \| 'not_evaluable'` | computed once at record time against the original target; replay always recomputes fresh (§9) |
| `projectionVersion`            | `string`                                                          | from the V2 projection                                                                        |
| `privacyPolicyVersion`         | `string`                                                          | from the V2 projection                                                                        |
| `observationContractVersion`   | `string`                                                          | from the V2 projection                                                                        |
| `candidateContractVersion`     | `string`                                                          | `resolver-knowledge-candidate-v1`                                                             |
| `fingerprintVersion`           | `string`                                                          | `resolver-knowledge-fingerprint-v2`                                                           |
| `evidenceSnapshot`             | `ResolverKnowledgeContributionSafeEvidenceSnapshot`               | globally-safe fields only (§6)                                                                |
| `contributorToken`             | `null`                                                            | reserved slot; fails closed on any non-null value (§11)                                       |
| `recordedAt`                   | `string` (ISO timestamp)                                          | aggregation-event time, not the observation's own timestamp                                   |

Never present on this type (verified by closed-key validation and dedicated tests): owner ID, raw
input, normalized input, exact food name, source ID, journal text, correction text, provider
output, prompt content, personal aliases/recipes, nutrient payloads, arbitrary metadata/free text.

## 4. Append-only/retraction representation (explicit resolution)

The operational-boundary document's own §8 text describes the ledger as "append-only" while also
describing a row moving from `status: 'active'` to `status: 'retracted'` — an internal tension the
binding RESOLVER-V3-032 task instructions required resolving explicitly rather than silently
picking one reading.

**Resolution (the strictest auditable representation compatible with the design):**

- `ResolverKnowledgeContribution` itself has **no mutable status field at all**. It is fully
  immutable: no operation ever edits its payload, relation, identifiers, or evidence snapshot after
  creation.
- Retraction is represented by a **separate, immutable, append-only**
  `ResolverKnowledgeContributionRetractionEvent` record, keyed by the contribution it retracts.
- Effective active/retracted state is **derived**: a contribution is active if and only if no
  retraction event references its `contributionId`. There is no in-place mutation of the
  contribution record to reflect retraction.
- **No reactivation/"unretract" operation exists anywhere in this contract.** A contribution can
  only ever move from (implicitly) active to retracted, once, via one retraction event; a second
  retraction event referencing the same contribution is possible in principle (e.g. a different
  reason under a different action) but does not "re-retract" anything meaningful, since the
  contribution was already inactive from the first event onward — the in-memory repository's
  planner only ever selects **currently active** contributions for a new retraction action, so a
  second event against an already-retracted contribution never happens through the ledger's own
  API surface.

This is a stricter model than "a mutable `status` column," which is why this contract does not
call a mutating-row model "append-only" — the accepted design's own §8 text uses that phrasing
loosely; this implementation resolves it as two genuinely append-only tables (contributions,
retraction events) rather than one table with a mutable column.

## 5. Private contribution-ID derivation

`computeResolverKnowledgeContributionId` in
`ResolverKnowledgeContributionIdCalculator.ts`:

```
canonicalInput = JSON.stringify([
  'resolver-knowledge-contribution-id-input-v1',
  'resolver-knowledge-contribution-ledger-v1',
  observationId,
  resolverRunId,
  originalCandidateFingerprint.fingerprintVersion,
  originalCandidateFingerprint.digest,
])
contributionId = sha256Hex(canonicalInput)
```

- Identity is exactly `{observationId, resolverRunId, originalCandidateFingerprint}` — the
  operational-boundary document's §8 text says "derived from `{observationId, resolverRunId}`"
  but its own §10 text corrects this to explicitly include the candidate fingerprint ("not from
  the observation alone"); this implementation follows the corrected, more specific §10 wording,
  as the RESOLVER-V3-032 task instructions require.
- Uses the **original** matched-candidate fingerprint, never a mutable terminal-target identity —
  so a duplicate/supersession chain change never manufactures a second contribution from the same
  observation/target pair, and routing can change during replay without mutating contribution
  identity (§9 below).
- One observation may contribute to more than one candidate target: since the target fingerprint
  is part of the identity, two explicit targets always produce two distinct contribution IDs, and
  a retry against one target never touches the other.
- Never concatenated into a globally exposed string; never returned by any global-facing reader.
- A parallel `computeResolverKnowledgeRetractionEventId(retractionActionId, contributionId, hasher)`
  derives a deterministic retraction-event ID for audit/dedup convenience; the actual
  idempotency/conflict decision for a retraction **action** is made from its full
  `(reason, selector)` content, not from this ID alone (§8 below).

## 6. Semantic idempotency

**Contribution recording:**

- Same `{observationId, resolverRunId, originalCandidateFingerprint}` and **identical** remaining
  content (payload, relation, versions, evidence snapshot — timestamps excluded from the
  comparison, since a literal retry naturally occurs at a different wall-clock time) →
  `already_recorded`, zero mutation.
- Same triple but **any other field differs** → `conflict`, zero mutation.
- New triple → recorded exactly once.

Implemented in `ResolverKnowledgeContributionRecordingPlanner.ts` via a key-order-independent
stable-stringify equality check (`ResolverKnowledgeContributionLedgerEquality.ts`), not a bare
`Set.has()`/"already exists" shortcut — a genuinely different contribution under the same ID is
never silently accepted as a duplicate-looking retry.

**Retraction:** see §11.

## 7. Runtime validation

`ResolverKnowledgeContributionLedgerValidator.ts` provides closed, recursive validators for the
contribution record, the retraction event, and the retraction request — exact root/nested key
sets, closed version literals, closed relation/reason/selector-kind enums, non-null-contributor-
token enforcement, and ISO-timestamp finiteness checks. It reuses (never duplicates) the
RESOLVER-V3-031 `validateResolverKnowledgeCandidatePayloadForFingerprint` for the candidate payload
itself. Malformed input throws a closed-code `Error`; nothing is ever coerced into
`not_evaluable`.

## 8. Safe evidence snapshot

`ResolverKnowledgeContributionSafeEvidenceSnapshot`: `locale`, `inputType`, `outcome`, `sourceType`
(nullable), `provenanceStatus`, `resolverVersion`, `reasonCodes` — sourced only from the already
privacy-safe `ResolverObservationAggregationProjectionV2` (RESOLVER-V3-031). Contains no private
identifier.

## 9. Replay-summary formulas

`ResolverKnowledgeContributionReplaySummaryCalculator.ts` computes
`ResolverKnowledgeContributionReplaySummary` purely from `(terminalCandidatePayload,
activeContributions, candidateContractVersion)`:

- `supportCount` / `contradictionCount` / `orthogonalCount` / `notEvaluableCount`: one contribution
  contributes to exactly one of these four buckets, determined by **recomputing** its relation via
  the RESOLVER-V3-031 classifier against `terminalCandidatePayload` — never by trusting the
  contribution's own stored `relation` field. This is what makes a duplicate/supersession chain
  change correct on the next replay (§13).
- `abstentionSignalCount` / `clarificationSignalCount`: derived from each contribution's
  `evidenceSnapshot.outcome` (`abstained`/`ambiguous`).
- `contradictionStatus`: `'present'` iff `contradictionCount > 0`.
- `negativeEvidenceSummary`: `'source_unsuitable_signal'` iff any active contribution's payload is
  `negative-source-routing-rule`.
- `independentUserEvidence`: always `'not_evaluable'` (RESOLVER-V3-035 is blocked).
- Every array field (`locales`, `inputTypes`, `sourceTypes`, `provenanceStatuses`, `reasonCodes`,
  `privacyPolicyVersions`, `observationContractVersions`, `projectionVersions`, `resolverVersions`,
  `fingerprintVersions`) is deduplicated and sorted — deterministic, byte-for-byte reproducible.
- Empty input → deterministic zero counts and empty arrays.
- Pure: never mutates its inputs; repeated calls with the same input are byte-for-byte identical.

## 10. Relationship to legacy candidate evidence

`mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence` maps the richer replay summary onto
the existing `ResolverKnowledgeCandidateEvidence` shape (unchanged since RESOLVER-V3-020/028).

**Fields the legacy shape cannot represent, intentionally dropped rather than silently amending the
historical contract:** `orthogonalCount`, `notEvaluableCount`, `projectionVersions`,
`fingerprintVersions`. These remain available on the richer
`ResolverKnowledgeContributionReplaySummary` object itself. **Handoff to RESOLVER-V3-033:** if a
future task needs to retain these on the persisted candidate row, that requires an explicit
candidate-schema/contract extension — this task does not perform or authorize that extension.

## 11. Candidate durable identity

- Global candidate ID: `rkc-v2:<fingerprintVersion>::<digest>` — derived from **both** the
  fingerprint-algorithm version and the digest, never the digest alone
  (`ResolverKnowledgeCandidateFingerprintV2IdentityMapper.ts`). Never collides with V1's
  `rkc-v1-XXXXXXXX` IDs.
- First contribution for an unknown V2 fingerprint creates exactly one new inactive
  (`status: 'candidate'`) row. A later contribution with an identical fingerprint always resolves
  to that same row (looked up by the serialized fingerprint string, never re-derived randomly).
- A fingerprint match whose **stored** payload differs from the incoming canonical payload
  (a hash-collision-class corruption) fails closed with `fingerprint_payload_conflict` — zero
  mutation.
- Approximate similarity never merges candidates: matching is exact-fingerprint-string only.
- V1 candidate IDs/fingerprints are never modified by any of this logic.

## 12. Rejection suppression

When an existing candidate at a given fingerprint has `status: 'rejected'` (or any other status),
recording a new contribution for that fingerprint:

- routes to the **existing** candidate row (found by fingerprint), never creates a new one;
- preserves `status`, `duplicateOfCandidateId`, `supersededByCandidateId`,
  `quarantineReasonCode`, and all prior lifecycle events untouched;
- only recomputes the `evidence` field via the pure replay-summary calculator.

A materially changed payload (any closed field differs) produces a different V2 fingerprint and
therefore a different candidate row — never a partial match. The ledger itself never transitions a
candidate's `status`; that remains exclusively `ResolverKnowledgeReviewService.applyDecision`'s
authority (RESOLVER-V3-028), consumed here only as read-only routing input.

## 13. Terminal-chain resolution

`ResolverKnowledgeCandidateTerminalChainResolver.ts`: pure function walking
`duplicateOfCandidateId`/`supersededByCandidateId` to a terminal candidate (neither field set).
Closed failure codes: `start_not_found`, `target_not_found`, `self_reference`, `cycle`,
`both_links_present`, `link_status_inconsistency`, `duplicate_without_target`,
`superseded_without_target`, `non_terminal_corruption`. The visited-set bound is the finite
candidate array itself — no fixed traversal threshold is invented. Never mutates candidates; never
picks an endpoint on an invalid graph.

**Routing across chain changes:** a new contribution's `originalCandidateId`/
`originalCandidateFingerprint` always records the candidate it was explicitly targeted at (or
found via its own fingerprint) — never the terminal target directly. At recording time and at
every later replay, the chain is resolved fresh from the current candidate store, and the
contribution's summary effect is routed to whatever the **current** terminal candidate is. A
duplicate/superseded row is never reactivated or recomputed again once superseded — only the
terminal candidate's `evidence` field is written. Historical contributions recorded before a
duplicate/supersession decision are never rewritten; they are logically included in the terminal's
summary the next time it is replayed, because the replay groups contributions by
current-chain-resolution, not by their original static target.

A broken/cyclic chain encountered while recording a new contribution fails the whole recording
operation closed (`chain_resolution_failed`) with zero mutation.

## 14. Retraction selectors and reasons

Closed reason set: `owner_deletion`, `observation_invalidated`, `privacy_policy_revoked`,
`source_update_invalidated`, `developer_action`. Closed selector-kind set: `contribution_ids`,
`observation_id`, `observation_contract_version`, `projection_version`, `privacy_policy_version`,
`source_type`. Closed reason→selector-kind mapping
(`RESOLVER_KNOWLEDGE_CONTRIBUTION_RETRACTION_ALLOWED_SELECTOR_KINDS`):

| Reason                      | Allowed selector kind(s)                                               |
| --------------------------- | ---------------------------------------------------------------------- |
| `owner_deletion`            | `contribution_ids` (a pre-resolved private ID set — see §15)           |
| `observation_invalidated`   | `observation_id`, `observation_contract_version`, `projection_version` |
| `privacy_policy_revoked`    | `privacy_policy_version`                                               |
| `source_update_invalidated` | `source_type`                                                          |
| `developer_action`          | `contribution_ids`                                                     |

The "unsafe observation/projection contract" bulk case is expressed through the existing
`observation_invalidated` reason with a bulk (`observation_contract_version`/`projection_version`)
selector, per the binding requirement to avoid inventing a new reason string.

## 15. Owner-deletion limitation

RESOLVER-V3-035 (independent-user/contributor-token policy) is blocked and not authorized. This
contract therefore:

- never derives an HMAC or any pseudonymous token;
- never accepts, stores, or searches by an owner ID;
- implements owner-deletion retraction purely as **handling of an explicitly supplied private
  contribution-ID set** (`{kind: 'contribution_ids', ...}` with `reason: 'owner_deletion'`) —
  the ID set is assumed to already have been resolved by a future, separately authorized,
  private-zone owner→contribution lookup.
- **End-to-end owner-deletion lookup (mapping an owner ID to its contribution IDs) remains
  unimplemented.** This is an explicit residual limitation, not a bug.

## 16. Correction-as-contradiction behavior

A correction is recorded as a **new** contribution, classified by the RESOLVER-V3-031 classifier
against the terminal target. When it is the authorized matching-routing/negative-routing pair, it
is recorded as `contradiction`. The earlier supporting contribution is never retracted or altered;
`contradictionCount` increases while `supportCount` is unchanged. There is no `correction`
retraction reason — correction is fundamentally additive history, not a retraction trigger.

## 17. Retraction idempotency and irreversibility

- Retracting an active contribution records exactly one retraction event.
- An exact retraction-action retry (same `retractionActionId`, identical `reason`+`selector`) is a
  zero-mutation no-op (`already_recorded`).
- Reusing the same `retractionActionId` with different content fails closed (`conflict`), zero
  mutation — even for a first-call selector that matched zero rows (`no_op`), the action ID is
  still remembered so a later conflicting reuse fails closed rather than silently succeeding.
- A selector matching zero currently-active contributions returns a closed `no_op` result, never a
  fabricated non-zero count.
- There is no "unretract" operation anywhere in this contract (§4).
- Every retraction recomputes every affected terminal candidate's summary (grouped by
  current-chain-resolution of each retracted contribution's original target); every unaffected
  candidate's `evidence` field is left byte-for-byte unchanged.
- The original contribution record is never deleted by a retraction.

## 18. Approved-candidate residual limitation

If retraction/replay affects a candidate whose `status` is `approved`, this reference
implementation recomputes only that candidate's `evidence` field (allowed per the operational-
boundary design's §15 "MAY emit a reassessment signal... this document does not implement that
signal" framing). It never changes `status`, revokes approval, or touches the separate
`ApprovedResolverKnowledgePayload`/review-event records. A future server-side reassessment signal
(e.g. driving `ResolverKnowledgeReviewService`'s `revoke_approval`/`rollback` actions) remains
outside this task's scope.

## 19. Atomic in-memory reference boundary

`InMemoryResolverKnowledgeContributionLedgerRepository.recordContribution`/`retractContributions`
each stage every internal step (candidate creation, contribution append, retraction-event append,
chain resolution, summary recomputation, cached-summary replacement) against a pre-call snapshot,
committing only if every step completes without throwing; any thrown error — including a
test-injected `failureInjector` — restores every store to its exact pre-call state.

**This proves only the reference in-memory contract's atomicity. It is not evidence that a future
database implementation is atomic — that is RESOLVER-V3-033's own scope, per the operational-
boundary design's §16 (which itself states no RPC/stored-procedure/multi-statement-transaction
precedent exists anywhere in this codebase today).**

## 20. No-production-effect boundary

No migration, RPC, Supabase adapter, batch worker, DI/container registration, resolver-composition
wiring, feature flag, UI, journal use case, AI/provider call, network call, or package/dependency
change was introduced by this task. No RESOLVER-V3-032 symbol is reachable from any user-facing
production path (verified by `ResolverKnowledgeContributionLedgerIsolation.test.ts`).

## 21. Residual limitations

- No independent-user-evidence/contributor-token implementation (RESOLVER-V3-035, blocked).
- No database atomicity (RESOLVER-V3-033, `todo`).
- No batch scheduling/worker (RESOLVER-V3-034, `todo`).
- The legacy evidence mapping (§10) drops orthogonal/not-evaluable/projection-version/fingerprint-
  version information; a future schema extension to retain it is an explicit RESOLVER-V3-033
  handoff item.
- Owner-deletion retraction has no end-to-end owner→contribution-ID lookup (§15).
- No numeric threshold of any kind is invented anywhere in this contract, consistent with the
  Knowledge-Growth Decision Record's binding prohibition.

## 22. RESOLVER-V3-033 handoff requirements

A future server-side persistence adapter must: (1) reproduce the contribution-ID canonical input
and SHA-256 derivation byte-for-byte; (2) implement the append-only contribution table plus a
separate append-only retraction-event table (never a single mutable-status table, per §4); (3)
implement the candidate-summary materialized view exactly as this contract's pure replay function
computes it; (4) implement the atomic RPC boundary the operational-boundary document's §16
describes, using this contract's planners' plan objects as the transaction's write set; (5) decide
whether to extend the persisted candidate schema to retain orthogonal/not-evaluable counts (§10),
documenting that decision explicitly rather than silently amending the historical contract.
