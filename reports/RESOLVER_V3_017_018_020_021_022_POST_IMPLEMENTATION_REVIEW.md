# RESOLVER-V3-017/018/020/021/022 — Post-Implementation Review

**Review date:** 2026-07-21
**Reviewed branch/commit:** `chore/clean-arch-structure` at `df4accd02c7d79c44a0cb4d6f57f599c1809b458` (HEAD of this review; no commits found on top of it at review time)
**Domain authority governing this review:** [`docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`](../docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md) (`accepted`, Level 2)
**Review type:** documentation/governance review, no product code changed by this review itself.

## 0. Purpose and method

This report reconciles the actual merged state of RESOLVER-V3-017, -018, -020, -021, and -022 against
their roadmap acceptance criteria and against the binding Knowledge-Growth Decision Record. Green CI and
a completed merge are treated as necessary but **not sufficient** evidence of acceptance (`ROADMAP.md`
invariant, see `VERIFY.md`). Every finding below marked "Verified in code" was independently reproduced by
reading the current implementation in this checkout; it is not merely repeated from a prior handoff.

Not independently re-verified in this session (carried over as reported, not re-confirmed against a live
system): the RESOLVER-V3-013 live-provider cost/token/accuracy figures, and the live Supabase project's
current table/migration ledger state (Supabase MCP access in this session returned `Unauthorized`, so the
live-database claims in this report are attributed to the source handoff, not independently re-queried).

## 1. Status classification legend

| Term                   | Meaning                                                                                                       |
| ---------------------- | ------------------------------------------------------------------------------------------------------------- |
| `implemented`          | Code exists matching the contract/type-level design                                                           |
| `tested`               | Unit tests exist and pass for the stated behavior                                                             |
| `merged`               | PR is merged into the canonical branch                                                                        |
| `operational`          | Wired into a real, reachable code path (not just an isolated port/adapter)                                    |
| `production-wired`     | Reachable from a real user action (logging, journal, review UI)                                               |
| `live-migrated`        | Migration has been applied to the live Supabase project                                                       |
| `accepted`             | Meets its ROADMAP.md acceptance criterion in full                                                             |
| `blocked`              | Cannot proceed until a dependency is resolved                                                                 |
| `remediation-required` | Merged, but has a correctness/safety/governance/privacy gap that must be closed before dependents build on it |

## 2. Per-task findings

### RESOLVER-V3-017 — Personal Memory Promotion and Correction Precedence (PR #104, `e39d6682ade29979096cb3bcae1e23af50acccb0`)

`implemented` · `tested` · `merged` · **not** `operational` · **not** `production-wired` · **not** `accepted` in full

- Domain contract (`personal-resolution-memory-v1`), P0/P1/P2 levels, closed evidence types, promotion
  policy, write-only repository port, and `personal_resolution_memories` /
  `personal_resolution_memory_events` migration with RLS all exist as designed.
- **Verified in code** (`supabase/migrations/20260720130000_create_personal_resolution_memory.sql:6`):
  the migration grants `select, insert, update, delete` to `authenticated` on
  `personal_resolution_memory_events`, and its RLS policy uses `for all`. An events table intended as an
  append-only audit/evidence trail is therefore not technically append-only — a client with a valid session
  can update or delete its own historical evidence rows. This directly weakens the "auditable" /
  "historical evidence is not overwritten" requirement in the Decision Record §6/§7.
- No production `record`-use-case caller exists anywhere in `src/` outside tests: there is no integration
  into food logging, meal logging, deliberate candidate selection, explicit confirmation, or correction
  logs. The repository port is write-only and unused by any real user-facing flow.
- **Verdict:** usable contract foundation; not a functioning correction-precedence feature yet.
  Remediation tracked as **RESOLVER-V3-026**.

### RESOLVER-V3-018 — Personal Memory Invalidation (PR #107, `bd5bd7f2281e7aade99d05bcf7a1bfec401e9ff0`)

`implemented` · `tested` · `merged` · **not** `accepted` — contains correctness/safety defects

Three defects were independently reproduced by reading
`src/features/nutrition/application/usecases/InvalidatePersonalResolutionMemoryUseCase.ts`:

1. **Partial mutation before failure (no atomicity).** Each BFS iteration calls
   `this.repository.applyInvalidation(...)` immediately (line 67) and only afterwards continues
   traversal. If a later iteration hits `cycle_detected`, `traversal_limit_exceeded`, or
   `repository_failed`, the use case returns `status: 'failed'` while previously-written transitions in
   `affected` remain committed. There is no planning phase and no rollback.
2. **False positive cycle detection on diamond graphs.** `visited` (line 30/38) is a single global
   BFS-visited set; the check `if (visited.has(memoryId)) return result('failed', 'cycle_detected', ...)`
   fires on _any_ re-visited node, not only true back-edges. A diamond dependency (`A → B → D`, `A → C →
D`) reaches `D` twice through two valid, acyclic paths and is incorrectly reported as
   `cycle_detected`, aborting the whole traversal.
3. **Inactive parent silently stops dependent propagation.** When `next()` returns `null` for an
   already-inactive node (line 48-51), the code does `continue` _before_ reaching the
   `findDependents`/enqueue step at the bottom of the loop (line 70-71). Dependents of an already-inactive
   node are therefore never enqueued, so active entries that depend on an already-invalidated parent are
   left untouched — most dangerous on a retry after a partial failure (defect #1), where some nodes are
   already inactive from the aborted first attempt.
4. **No referential integrity for dependency edges.** `personal_resolution_memory_dependencies` stores
   `memory_id` / `depends_on_memory_id` as free `text` columns with no foreign key to
   `personal_resolution_memories`, so orphaned edges and references to non-existent memory rows are
   possible (verified in `supabase/migrations/20260721110000_add_personal_resolution_memory_invalidation.sql`).

`ROADMAP.md` currently shows this task as `done` while its own "Implementation notes (in progress)" line
contradicts that status — that inconsistency is corrected by this review (§4 below), but the underlying
code defects are **not** cosmetic documentation problems; they are real. **RESOLVER-V3-019 must not be
built on this invalidation path until it is fixed.** Remediation tracked as **RESOLVER-V3-027**.

### RESOLVER-V3-020 — Privacy-Safe Knowledge Candidate Aggregation (PR #105 + hotfix PR #106)

`implemented` · `tested` · `merged` · **not** `operational`

- `resolver-knowledge-candidate-v1`, fail-closed validator, deterministic fingerprint dedup, and inactive
  lifecycle states are implemented and confirmed to accept only
  `ResolverObservationAggregationProjectionV1` input.
- **Verified in code** (`src/features/nutrition/application/knowledge/ResolverKnowledgeCandidateAggregator.ts:132`):
  the aggregator hard-codes `contradictingEvidenceCount: 0` for every freshly built candidate. It does not
  itself detect contradictions across multiple observation projections — accumulation across duplicate
  candidates happens later in `InMemoryResolverKnowledgeCandidateRepository`, and the existing
  contradiction test constructs a pre-contradicted candidate by hand rather than exercising real
  cross-event detection.
- There is no production Supabase adapter, no aggregation job, and no pipeline from private observations →
  privacy projection → candidate repository. This is an inactive, isolated architectural boundary, not an
  operational pipeline.
- **Verdict:** acceptable inactive foundation; not yet a knowledge-growth pipeline. Operational-boundary
  design questions tracked as **RESOLVER-V3-030**.

### RESOLVER-V3-021 — Developer Review and Global Promotion (PR #108 **and** duplicate PR #109)

`implemented` · `tested` · `merged` · **not** `accepted` — governance, audit, and atomicity gaps

- **Duplicate merge confirmed.** `git diff 8af57565f7a62eaacd599f75afe9d569b989ff36
20f7e30381c419519b9cd6a61031e321bc1d7c15 --stat` is empty: PR #109 merged no additional file changes
  beyond PR #108. Both PRs implemented the identical `RESOLVER-V3-021` work from near-identical branch
  names (`codex/implementiere-developer-review-vertrag` and
  `codex/implementiere-developer-review-vertrag-rqhv0v`). This is a process error (duplicate-merge
  history) and is recorded here for the record; it produced no conflicting or duplicated logic.
- **Verified in code** (`src/features/nutrition/application/knowledge/ResolverKnowledgeReviewService.ts:43`):
  the approval-eligibility check is
  `candidate.evidence.independentUserEvidence !== 'not_evaluable'` → `blocked_privacy`. Read literally,
  this means a candidate is only allowed to proceed toward `approve` when its independent-user-evidence
  field equals exactly `not_evaluable` — i.e. when it is _not evaluated at all_. `not_evaluable` is being
  used as a passing state rather than as "insufficient evidence, do not approve." This directly conflicts
  with Decision Record §7 / this project's invariant that a single user must not be able to found a global
  rule, since nothing currently requires positive, privacy-safe, multi-user evidence before approval.
- **Verified in code** (same file, lines 74-95): `approve`/`revoke_approval`/`rollback` call
  `this.repository.saveApproved(...)` and then `this.repository.appendEvent(...)` as two separate
  operations inside one `try`. If `appendEvent` throws after `saveApproved` succeeded, the method returns
  `'persistence_failed'` while an `active`/`revoked`/`rolled_back` approved-knowledge row already exists
  with no corresponding audit event — not atomic.
- **Verified in code** (same file): `reject`, `needs_more_evidence`, and `quarantine` fall through to the
  same `appendEvent(...)` call with no candidate-state mutation at all — the review action is recorded as
  an event, but the candidate's persisted lifecycle status is not actually transitioned. The existing test
  only asserts that no `ApprovedResolverKnowledgePayload` was created, which does not prove the candidate
  lifecycle state was updated to match the review action.
- **Verified in code**: the appended event object (`eventId`, `decisionId`, `candidateId`, `action`,
  `result`, `occurredAt`, `approvedKnowledgeId`) does not carry reviewer identity, a closed decision
  reason, the review request/candidate/privacy-policy contract versions at decision time, or a persisted
  review-material snapshot, even though `ResolverKnowledgeReviewMaterial` exists as a type. Later audit of
  "what was approved, based on what evidence, by whom, why" is not currently possible from persisted data.
- **Verdict:** not safe for global knowledge promotion as currently implemented. Remediation tracked as
  **RESOLVER-V3-028**.

### RESOLVER-V3-022 — Shadow Mode for Global Candidates (PR #110, `df4accd02c7d79c44a0cb4d6f57f599c1809b458`)

`implemented` · `tested` · `merged` · **not** `accepted` — privacy and metrics gaps; `ROADMAP.md` status was stale

- **`ROADMAP.md` was showing this task as `todo` despite PR #110 being merged as the current HEAD of the
  branch.** Corrected by this review (§4).
- **Verified in code** (`src/features/nutrition/domain/models/ResolverKnowledgeShadowEvaluation.ts:35` and
  `src/features/nutrition/domain/models/ResolverDecision.ts:30-39`): `ResolverKnowledgeShadowEvaluationRequest.productionDecision`
  is typed as the full `ResolverDecision`, which includes `normalizedQuery: string`, the full `candidates`
  array, `best`/`secondBest` candidates (with source data), and `createdAt`. This contradicts the shadow
  contract's own stated intent (no normalized inputs or IDs).
- **Verified in code** (`src/features/nutrition/application/shadow/ResolverKnowledgeShadowEvaluator.ts:57-63`):
  the privacy check only inspects the top-level keys of `request.candidate` and `request.candidate.payload`
  against a `privateKeys` list. It never inspects `request.productionDecision` at all, so a fully private
  `ResolverDecision` (query text, source IDs, food candidate data) passes through every shadow evaluation
  and into every shadow result unfiltered.
- **Verified in code** (`aggregateResolverKnowledgeShadowMetrics`, same file, lines 125-133):
  `falseConfidenceRegressionCount`, `falseConfidenceImprovementCount`, and `regressionCount` are hard-coded
  to `0` for every corpus. `identificationAccuracy`, `abstentionPrecision`, and `clarificationRate` are
  typed as the literal `'unknown'` and always return that value. `fixtureExpectedStatus` is threaded
  through the request/result types but is never read inside `aggregateResolverKnowledgeShadowMetrics` —
  none of the task's core false-confidence/regression/accuracy requirements are actually computed.
- **Holdout separation** is currently limited to rejecting duplicate `caseId`s within a single
  `evaluateShadowCorpus` call (`Set` at line 140-147 of the evaluator file); there is no corpus registry or
  persisted-partition mechanism preventing holdout leakage across runs.
- **Verdict:** the no-production-effect evaluator is a sound base, but the task does not yet meet its
  privacy or false-confidence/regression-metric acceptance criteria. Remediation tracked as
  **RESOLVER-V3-029**.

## 3. Cross-cutting observations

- All five tasks followed the intended workflow (implement → PR → green CI → merge) and CI was green in
  every case. Per this repository's own verification model (`VERIFY.md`), green CI proves the touched
  automated checks passed; it does not by itself prove the roadmap acceptance criterion was met. All five
  tasks needed a separate post-merge reading of the actual code against their stated acceptance criteria,
  which this review performed.
- The five tasks are consistently strong on: closed/fail-closed contracts, RLS on new tables, no `anon`
  grants, no resolver-effect wiring, and no live/network/provider calls. They are consistently weak on:
  atomicity of multi-step writes, real (non-top-level, non-manually-constructed) evidence/contradiction
  derivation, audit completeness, and — for two tasks (V3-018, V3-021) — algorithmic correctness under
  realistic graph/lifecycle shapes.
- No evidence was found of any additional commits landing on top of `df4accd...` before this review began;
  `git log --oneline -15` at review start showed `df4accd` as `HEAD`.
- Per binding invariants: `RESOLVER-V3-010` remains `blocked`; `RESOLVER-V3-013`'s production gate remains
  `NOT PASSED`; no further live provider run is authorized by this review; no live Supabase migration is
  authorized by this review.

## 4. Documentation corrections made alongside this report

- `ROADMAP.md`: RESOLVER-V3-022 status corrected from `todo` to `done` (merged), with the findings above
  added inline. RESOLVER-V3-018's contradictory "done" + "(in progress)" phrasing was resolved to a single
  consistent status with findings and an explicit forward reference to RESOLVER-V3-027. RESOLVER-V3-017,
  -020, and -021 gained inline "Post-implementation findings" referencing this report and their
  remediation task IDs. RESOLVER-V3-019 and RESOLVER-V3-023 statuses were changed from `todo` to `blocked`
  with explicit remediation dependencies added, consistent with §22 of the source handoff and this
  review's own findings. Six new remediation tasks (RESOLVER-V3-025 through RESOLVER-V3-030) were added.
- `handoffs/latest-handoff.md`: sections added for RESOLVER-V3-021 and RESOLVER-V3-022 (previously
  missing), and the RESOLVER-V3-018 section's "remains `in_progress`" framing was reconciled with its
  actual merged/CI-green state while preserving the underlying technical caveat.

## 5. What must happen before RESOLVER-V3-019 / RESOLVER-V3-023 / RESOLVER-V3-024

Per the Decision Record's invariants (no silent globalization, corrections override unconfirmed results,
one user cannot found a global rule, all knowledge reversible/auditable) and the defects verified above:

- **RESOLVER-V3-019** (personal memory read path) must not start until RESOLVER-V3-026 (write integration)
  and RESOLVER-V3-027 (atomic/correct invalidation) are complete — reading from a memory store that can be
  partially mutated or silently miss dependent invalidations is unsafe.
- **RESOLVER-V3-023** (Learning Benchmark V2) must not start until RESOLVER-V3-028 (review governance/
  atomicity), RESOLVER-V3-029 (shadow privacy/real metrics), and RESOLVER-V3-030 (aggregation operational
  boundary) are complete — benchmarking a review/shadow system that cannot yet compute its own required
  metrics or safely gate on evidence would not produce meaningful results.
- **RESOLVER-V3-024** remains downstream of RESOLVER-V3-023 and RESOLVER-V3-013 (`NOT PASSED`); no change
  to that dependency is made here.

No thresholds are invented anywhere in this report, consistent with the Decision Record's explicit
prohibition on inventing numeric thresholds.
