# Latest Handoff

## RESOLVER-V3-028 — Developer Review Governance and Atomic Promotion

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD (`339a982`, merge of PR
  #116), clean working tree, no divergence from origin. Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`,
  `VERIFY.md`, `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md`, the Knowledge-Growth Decision
  Record, the Resolver Knowledge Review Contract, and
  `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md` before touching code.
  Only RESOLVER-V3-028's own scope was changed; RESOLVER-V3-029/030/023 were not started.
- **Pre-implementation inventory (verified by direct code reading, not assumed):**
  `independentUserEvidence` was typed as the single literal `'not_evaluable'` (not even a union),
  and the validator threw unless it was exactly that value — i.e. it was structurally impossible
  to represent any other evidence state. The review service's approval condition
  (`candidate.evidence.independentUserEvidence !== 'not_evaluable'` → `blocked_privacy`) meant
  `not_evaluable` was the _passing_ condition, backwards from "insufficient evidence must not
  approve" — though since `not_evaluable` was the only value that could ever exist, this gate
  never actually blocked anything in practice. All 8 actions were accepted by the service, but
  only `approve`/`revoke_approval`/`rollback` did anything beyond appending an event;
  `reject`/`needs_more_evidence`/`quarantine` fell through to the same `appendEvent` call with no
  candidate-state mutation, and `mark_duplicate`/`supersede` had no target field at all and no
  distinct handling. The service held only a read-only `ResolverKnowledgeReviewCandidateReader`
  (`getById` only) — it had no port capable of mutating candidate lifecycle state at all, so
  reject/etc. could not have transitioned candidate status even if the logic had wanted to.
  `saveApproved`/`appendEvent` were two separate non-transactional repository calls inside one
  `try`. No Supabase review repository or production caller exists anywhere in `src/` (grep
  confirmed only the in-memory adapter and test imports). The RESOLVER-V3-021 migration created
  3 tables with RLS enabled and no `anon`/`authenticated` grants, but no reviewer/version/reason/
  snapshot/risk/restriction columns, and its `resolver_knowledge_candidates.status` /
  `resolver_knowledge_candidate_events.next_status` check constraints excluded `'approved'`
  entirely — consistent with the domain type's own `Exclude<ResolverKnowledgeCandidateStatus,
'approved'>` on `ResolverKnowledgeCandidate.status`, which forced an `as never` cast at
  `ResolverKnowledgeReviewService.ts:56` to compare a value the type system said could never occur
  — the exact "cast/exclusion hiding an illegal lifecycle state" pattern the task asked to verify.
  Duplicate/supersession targets were represented on the candidate domain model
  (`duplicateOfCandidateId`/`supersededByCandidateId`) but never populated by any code path.
- **Implementation:** `independentUserEvidence` is now a closed two-value type
  (`RESOLVER_KNOWLEDGE_INDEPENDENT_USER_EVIDENCE_STATUSES`: `not_evaluable` |
  `independently_confirmed`); the aggregator still only emits `not_evaluable`, so no candidate can
  reach `approved` today — intentional fail-closed behavior, no candidate-type exemption
  implemented (none is authorized by an accepted source). `ResolverKnowledgeCandidate.status` was
  widened to the full closed status set including `approved`, removing the type-level exclusion
  and the `as never` cast it forced (the aggregation/`upsertInactive` path still runtime-rejects
  `approved` candidates via the existing validator, now without the redundant `as string` cast).
  `ResolverKnowledgeReviewRequest` is now a discriminated union keyed on `action`, requiring
  `targetCandidateId` only for `mark_duplicate`/`supersede`; self-reference and missing targets
  fail closed (`validation_failed`/`candidate_not_found`) before persistence. Every request also
  carries `reviewContractVersion`, `privacyPolicyVersion`, `candidateVersionAtDecision` (checked
  against the freshly-fetched candidate's `updatedAt` — a stale value fails closed),
  `riskDecision` (must equal the candidate's own risk), a closed `localeRestriction`
  (`not_applicable`/`restricted_to_candidate_locale`/`unknown` — no invented region taxonomy;
  `unknown` fails closed for `approve`), and a closed `reasonCode` legal-per-action via
  `RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS`. The reviewer identity comes only from
  `ResolverKnowledgeReviewAuthorizer.authorizeDeveloperReview()`'s trusted result, never from
  request input. `ResolverKnowledgeReviewRepository` now exposes a single atomic
  `applyDecision(plan)` method (no more separate `saveApproved`/`appendEvent`); `plan` is a
  fully-computed `ResolverKnowledgeReviewDecisionPlan` built by the service (candidate transition,
  approved-payload value, finished event) so the adapter makes no business decisions of its own.
  The reference `InMemoryResolverKnowledgeReviewRepository` snapshots the candidate row, the
  candidate's own lifecycle-event log, the approved-payload table, and the review-event table
  before mutating, and restores all four completely if any internal step throws — proven by tests
  injecting a failure at each of the three stages (candidate/payload/event). `approve` now
  transitions `pending_review → approved` together with creating the active payload;
  `reject`/`needs_more_evidence`/`quarantine`/`mark_duplicate`/`supersede` all transition
  persisted candidate lifecycle state (previously none did); `revoke_approval`/`rollback`
  atomically flip only the payload's own status (`active→revoked`/`rolled_back`) without changing
  `candidate.status` (which stays `approved` as a permanent historical record) or deleting the
  payload. Every persisted `ResolverKnowledgeReviewEvent` now carries reviewer identity,
  review-contract/privacy-policy versions, the exact candidate version reviewed, a closed decision
  reason, risk decision, locale/region restriction, an optional duplicate/supersession target, and
  an immutable `reviewMaterialSnapshot` built by the service from the fetched candidate (never
  trusted verbatim from caller input). Private/linkable fields are now rejected via a recursive
  key-name walk over the entire candidate object at any nesting depth
  (`containsPrivateField`), not only a top-level check. A decisionId already recorded is compared
  field-by-field against the incoming request: an exact match returns `already_applied` with zero
  mutation; any difference returns the new closed result `conflict` instead of a false
  `already_applied`.
- **Migration:** one additive migration,
  `supabase/migrations/20260721160000_extend_resolver_knowledge_review_governance.sql` — widens
  the `resolver_knowledge_candidates.status` and `resolver_knowledge_candidate_events.next_status`/
  `reason_code` check constraints to allow `approved`/`APPROVED_BY_REVIEW`, and adds the new audit
  columns to `resolver_knowledge_review_events`. No historical migration file is edited (verified:
  the two RESOLVER-V3-020/021 migration files are untouched; their own pre-existing migration
  tests still pass unmodified). No new `anon`/`authenticated` grant, no view, no trigger. **This
  migration has not been applied to any live Supabase project as part of this task** — no
  production Supabase adapter for this port exists (in-memory only), so this remains a
  server/admin-only schema definition, not operational, production-wired, or live-migrated
  infrastructure. Its correctness (in particular the assumption that Postgres auto-names an
  unnamed single-column `CHECK` constraint as `<table>_<column>_check`, which is standard
  documented Postgres behavior but was never executed against a live database in this task) is a
  residual, explicitly unverified risk.
- **Contract doc:** updated
  [`docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md`](../docs/domains/ZERA_RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_1.md)
  with a new "Amendment (RESOLVER-V3-028)" section documenting the evidence-gating fix, the
  discriminated command/lifecycle-transition table, the atomic decision operation, the persisted
  audit fields, semantic idempotency, and the additive migration.
- **Non-effect:** no app-facing (`anon`/`authenticated`) grant; no application view or resolver
  trigger; no resolver read effect; no feature flag or production resolver integration; no
  automatic promotion; no live Supabase deployment; no dependency/`package.json` change; no
  unrelated refactor. RESOLVER-V3-029/030/023 were not started.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test`
  all green via `npm run verify` — 183 test suites, 1636 tests, no regressions (up from 182
  suites/1602 tests). Focused suites:
  `ResolverKnowledgeReview.test.ts` (rewritten — evidence gating incl. no-numeric-threshold check,
  unauthorized zero-mutation, all 8 actions' legal transitions, invalid-transition zero-mutation,
  duplicate/supersede target validation incl. self-reference and missing-target, atomicity via
  deterministic failure injection at each of 3 stages for `approve` and for `reject`, literal-retry
  idempotency, conflicting-decisionId-reuse rejection, full audit-field assertions, recursive
  private-field rejection, unknown-version/enum fail-closed cases, stale-candidate-version
  rejection, and a source-scan proving no dependency on the production resolver decision path),
  `ResolverKnowledgeReviewGovernanceMigration.test.ts` (new — additive-only, no historical-migration
  edit, constraint/column presence, no grant/view/trigger), plus unmodified
  `ResolverKnowledgeCandidate(Migration).test.ts` and `ResolverKnowledgeReviewMigration.test.ts`
  (V3-020/021 baseline) still pass unchanged. Full `resolver`-pattern suite (283 tests) and the
  complete suite both pass with no regressions.
- **Known/residual limits (explicit, not claimed complete):** no candidate can currently reach
  `approved` in production because the only evidence-producing pipeline (RESOLVER-V3-020's
  aggregator) never emits `independently_confirmed` — this is correct fail-closed behavior per the
  Decision Record, not a bug, but it means approval remains untestable end-to-end outside unit
  tests that construct a candidate directly. The additive migration's constraint-renaming
  assumption is unexecuted against a live database (see above). No production Supabase adapter for
  review exists at all — the atomic contract is enforced by the port shape and proven by the
  in-memory reference adapter's tests, not by a real transactional adapter. PR/merge-commit
  reference and the independent post-merge review outcome will be added in a documentation-only
  follow-up once merged, matching this repository's established RESOLVER-V3-02x pattern.

## RESOLVER-V3-019 — Personal Cache/Memory Read Path

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD (`8af09c24ea6c618a65add9bf8784d9def6a33718`,
  merge of PR #113). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, this handoff, the
  Knowledge-Growth Decision Record, and the Personal Resolution Memory / Invalidation / Recording
  contract docs before touching code. Only this task's own scope (a read contract, eligibility
  policy, read port/use case/Supabase adapter, telemetry port/adapter, a new resolver-decorator
  service, one `container.ts` composition-root wiring change, focused tests, a new read contract
  doc, an addendum to the invalidation contract doc, `ROADMAP.md`, and this handoff) was changed.
- **Technical inventory (pre-implementation):** confirmed by direct code reading (see the
  `ROADMAP.md` entry for the full list) that `personal_resolution_memories.scope_key` is keyed on
  the **resolved food identity**, not raw query text; that no AI `FoodCatalogSource` is composed
  into any production resolver (`RESOLVER-V3-010` remains genuinely blocked, unrelated to this
  task); that `personal_resolution_memories` already grants `authenticated` `select` (no migration
  needed); and that `LogFoodFromRawInputUseCase`/`LogMealFromRawInputUseCase` gate acceptance on
  `resolved.score >= 0.7` / `status === 'accepted'` respectively — both had to be satisfied for a
  memory-confirmed override to actually take effect downstream.
- **Implementation:** Added the closed `personal-resolution-memory-read-v1` contract (exact-match
  `{sourceType, sourceId}` targets, identical scope-key shape to the write path),
  `PersonalResolutionMemoryReadEligibilityPolicy` (P2_confirmed → deterministic reuse + preferred;
  P1_provisional → preferred only, never a forced override; P0_observed → neither — Decision
  Record §6 verbatim), the `PersonalResolutionMemoryReadRepository` port (owner-scoped,
  `active`-status-only, fails closed), `ReadPersonalResolutionMemoryUseCase`, and
  `SupabasePersonalResolutionMemoryReadRepository` (single read-only `select`, no new grant).
  Resolver integration is `PersonalResolutionMemoryAwareFoodCatalogResolver`, a decorator around
  any `FoodCatalogResolver` — deliberately not a change inside `SequentialFoodCatalogResolver`
  itself. It excludes `'user'`-sourced candidates, fails open (returns the exact original decision
  object) on no owner/no candidates/no match/any error, and on a `P2_confirmed` match
  deterministically selects that candidate as `best` (`status: 'accepted'`, fixed `0.95` score,
  `PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI` reason code) or, for `P1_provisional` only, appends
  `PERSONAL_MEMORY_P1_PREFERRED` without touching `best`/`status`. `PersonalResolutionMemoryReadTelemetry`
  records real per-lookup counts plus an honest `avoided` flag (only true when the override
  actually changed the outcome). The production telemetry adapter,
  `ConsolePersonalResolutionMemoryReadTelemetry`, is dependency-free and gated behind
  `isDebugLoggingEnabled()`. `container.ts` now wraps the previously-direct
  `SequentialFoodCatalogResolver` instance in this decorator; both consuming use cases already
  depended on the `FoodCatalogResolver` interface, so no other call site changed.
- **Migration:** none. `personal_resolution_memories` already grants `authenticated` `select`
  under RESOLVER-V3-017's owner-scoped `for all` RLS policy; the new adapter filters `owner_id` in
  the query itself and RLS enforces the same scope again independently.
- **Contract doc:** added
  [`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_1.md`](../docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_1.md);
  added a dated update note to the invalidation contract doc pointing at it.
- **Non-effect:** no resolver read effect on any input the deterministic sources did not already
  independently resolve as a candidate; no cross-user data; no global candidate path; no change to
  RESOLVER-V3-017/018/026/027's own contracts, migrations, or adapters; no live Supabase migration
  or provider/network/AI call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test`
  were run full-suite via `npm run verify` — 182 test suites, 1601 tests, all green, no regressions
  (up from 178 suites/1571 tests). New/focused suites:
  `PersonalResolutionMemoryReadEligibilityPolicy.test.ts`,
  `ReadPersonalResolutionMemoryUseCase.test.ts`,
  `SupabasePersonalResolutionMemoryReadRepository.test.ts`, and
  `PersonalResolutionMemoryAwareFoodCatalogResolver.test.ts` (fail-open proven via reference
  identity, `'user'`-source exclusion, deterministic override from both `ambiguous` and `rejected`
  base status, no redundant override/avoided-flag when already accepted as the same candidate, P1
  annotate-only behavior, P0 fully ignored, query pass-through unchanged). All 178 pre-existing
  suites still pass unmodified.
- **Known/residual limits (explicit, not claimed complete):** this decorator's added reason codes
  are not persisted into the pre-existing `ResolverRunLogger`/`ResolverObservationWriter` telemetry
  sinks (those fire inside `SequentialFoodCatalogResolver.resolve()`, before this decorator sees
  the decision, and correctly record the base/pre-override decision) — a future task may unify the
  channels. No near-match/fuzzy transfer exists (exact scope-key match only, by design). No
  AI/hybrid production wiring was added — RESOLVER-V3-010 remains blocked and unrelated.
- **Post-merge review (same run, after PR #114 merged):** independent self-review found that
  `SupabasePersonalResolutionMemoryReadRepository`'s query has no `ORDER BY`, so
  `PersonalResolutionMemoryAwareFoodCatalogResolver`'s original `result.matches.find(...)` picked
  the winner among multiple active matches by unspecified Postgres row order, not a deterministic
  rule. Fixed in follow-up PR #115 (merged, `738740d`): the decorator now walks `eligibleCandidates`
  in the base resolver's own already-deterministic, score-sorted order instead. Added a regression
  test for the exact two-match, reversed-row-order scenario. No other defects were found; `npm run
verify` stayed green (182 suites/1602 tests) after the fix. No other findings required action.

## RESOLVER-V3-026 — Personal Memory Write Integration and Audit Hardening

- **Basis and scope:** Started from `chore/clean-arch-structure` HEAD
  (`18ba596edfbb369e4178288fead4a10660d598cd`, PR #112 merged). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`,
  `VERIFY.md`, this handoff, the Knowledge-Growth Decision Record, the Personal Resolution Memory
  Invalidation Contract, and the RESOLVER-V3-017/018/020/021/022 post-implementation review before
  touching code. Only RESOLVER-V3-026's own scope (a production `record` use case, its Supabase adapter,
  one additive migration, the three real production call sites identified below, focused tests, a new
  recording contract doc, `ROADMAP.md`, and this handoff) was changed.
- **Technical inventory (pre-implementation):** dispatched a dedicated research pass over the codebase
  before writing any code, per this task's explicit prerequisite not to invent signals. Findings: (1)
  `PersonalResolutionMemoryRepository` had zero implementations and zero call sites anywhere in `src/`
  — completely unused outside the port definition itself; (2) the only real, wired journal-logging
  pipeline is `logResolvedNutritionInput` → `resolvePreparedNutritionInputs` →
  `LogFoodFromRawInputUseCase`, used by `InputBar.tsx` and `JournalScreen.tsx`'s normal submit — this is
  where "unchanged logging" (P0) genuinely happens; (3) `ResolverDecision.candidates` is produced
  internally but never surfaced to any general candidate-picker UI — the only real "deliberate candidate
  selection" (P1) signal anywhere in the product is the narrow Speck-disambiguation resubmission in
  `JournalScreen.tsx`'s `handleSelectSpeckChoice`; (4) `CreateSavedMealFromDateUseCase` (reachable from
  `SavedMealsScreen.tsx`'s "create from today" action) is a genuine, deliberate, named user action that
  matches the Decision Record's `deliberately_saved_personal_meal` (P2) evidence type exactly; (5) no
  "confirm this food" UI exists anywhere (the post-submit panel is passive display; `confirmUserPrivateHint`
  confirms a different domain object, a portion hint) — `explicit_confirmation` has no real signal; (6)
  `EditFoodEntryFromNaturalLanguageUseCase`/`ApplyNaturalLanguageEditUseCase` only ever correct
  quantity/portion, never `foodCatalogRef`/food identity, and the latter has no caller anywhere in the UI
  — `explicit_correction` has no real identity-correction signal either; (7) the
  RESOLVER-V3-017 migration grants `authenticated` `update`/`delete` on `personal_resolution_memory_events`
  under a single `for all` policy, confirming the audit-append-only gap named in the post-implementation
  review; (8) the closest existing production adapter precedent for an owner-scoped, no-read-API write
  port is `SupabaseResolverObservationWriter` (plain sequential inserts, duplicate detection via Postgres
  `23505`, no RPC/transaction) — there is no RPC/stored-function precedent anywhere in this codebase, same
  finding as RESOLVER-V3-027 made for the sibling invalidation port.
- **Implementation:** Added `RecordPersonalResolutionMemoryUseCase` (RESOLVER-V3-017's port's first
  production caller), which derives `memoryId = actionId` and every event ID from `actionId` deterministically
  (idempotent-by-construction — a literal retry re-derives byte-identical rows, absorbed by the tables'
  unique constraints), reuses the existing `promotionForEvidence` mapping unchanged, and enforces correction
  precedence structurally: `explicit_correction` is rejected with `correction_requires_prior_memory_id`
  unless the caller names the specific prior memory it overrides, and naming one always produces a
  `PersonalResolutionNegativeEvidence` event against it. Added `SupabasePersonalResolutionMemoryRepository`
  (the port's first production adapter), inserting into `personal_resolution_memories` then each event row
  in `personal_resolution_memory_events`, mapping `23505` to `duplicate` and any other error to `failed`
  (even after a partial write, so a caller never mistakes an incomplete action for a complete one). Wired
  exactly the three real signals found above, each fire-and-forget and owner-gated (silently skip without
  an authenticated owner or without a `foodCatalogRef` target, never blocking or failing the user-visible
  action they observe): P0 in `resolvePreparedNutritionInputs.ts` right after a persisted entry; P1 via a
  new optional `evidenceType` parameter threaded through `logResolvedNutritionInput`/
  `resolvePreparedNutritionInputs`, set by `JournalScreen.tsx`'s Speck resubmission; P2 in
  `CreateSavedMealFromDateUseCase` for each saved item with a `foodCatalogRef`. `explicit_confirmation` and
  `explicit_correction` remain fully implemented and directly unit-tested in the use case (so correction
  precedence is provably enforced) but have no production caller — stated explicitly in the new contract
  doc, the same pattern RESOLVER-V3-018/027 used for its own uncalled invalidation port.
- **Migration:** one additive migration,
  `supabase/migrations/20260721150000_harden_personal_resolution_memory_audit_append_only.sql`, revokes
  `update`/`delete` on `personal_resolution_memory_events` from `authenticated`. RLS policies are evaluated
  only after the table-level privilege check, so this alone makes the table genuinely append-only; no RLS,
  policy, or historical-migration change, and `personal_resolution_memories`' own `update` grant (still
  needed for invalidation/state transitions) is untouched.
- **Contract doc:** added
  [`docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_1.md`](../docs/domains/ZERA_PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_1.md);
  added a dated update note to the existing invalidation contract doc correcting its "no production
  personal-memory writer" statement now that one exists (while confirming it is still not wired into
  correction/deletion/source-update flows, since none of those carry a real memory-ID/action mapping yet).
- **Non-effect:** no resolver read path, ranking/query effect, candidate effect, or AI-avoidance behavior
  was introduced. The RESOLVER-V3-018/027 invalidation port, its migrations, and its own (still uncalled)
  production adapter boundary are unchanged. No live Supabase migration was applied or attempted; no
  provider/network call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` were
  run full-suite via `npm run verify` — 178 test suites, 1571 tests, all green, no regressions in any
  pre-existing suite. New/focused suites: `RecordPersonalResolutionMemoryUseCase.test.ts` (10 tests:
  evidence-level correctness for every evidence type, actionId-retry idempotence, cross-owner isolation,
  correction-requires-prior-memory rejection, correction-precedence negative-evidence enforcement, closed
  invalid-request error codes, repository-failure and repository-throw surfacing);
  `SupabasePersonalResolutionMemoryRepository.test.ts` (6 tests: multi-table insert sequencing, duplicate-key
  mapping, non-duplicate-failure mapping including after a partial write, owner-required fail-closed);
  `PersonalResolutionMemoryAuditAppendOnlyMigration.test.ts` (5 tests: reserved unique migration prefix,
  exact revoke statement, no RLS/policy/grant/anon touch, additive-only, prior migration file unchanged);
  `CreateSavedMealFromDateUseCasePersonalMemory.test.ts` (5 tests: P2 recording per source-grounded item, no
  owner ⇒ no recording, template creation unaffected when recording is unwired or throws, no target ⇒ no
  recording). Pre-existing `resolvePreparedNutritionInputs`/`logResolvedNutritionInput`/`SavedMeals`/
  `PersonalResolutionMemory*`/`JournalScreen` suites (117 tests) all still pass unmodified, confirming the
  new fire-and-forget hooks are safe no-ops in test env (no authenticated owner ⇒ they skip immediately).
- **Known/residual limits (explicit, not claimed complete):** `explicit_confirmation`/`explicit_correction`
  have no production caller (no real signal exists yet — see the contract doc's signal table);
  `SupabasePersonalResolutionMemoryRepository` performs sequential inserts, not a single cross-table
  transaction (safety instead comes from actionId-derived deterministic IDs and unique-constraint
  absorption, documented explicitly); RESOLVER-V3-019 (personal-memory read path) is now unblocked in
  `ROADMAP.md` but starting it is out of scope for this task and left for a separate run.

---

## RESOLVER-V3-027 — Atomic and Correct Memory Invalidation

- **Basis and scope:** Started from the canonical merge commit of PR #111
  (`4e4c11196514899359e1d92064cbde45acc73251`, `chore/clean-arch-structure`). Read `SSOK.md`, `AGENTS.md`,
  `ROADMAP.md`, `VERIFY.md`, `README.md`, `.governance/SYSTEM.md`/`RULES.md`/`SAFETY.md`/`REVIEW_POLICY.md`,
  this handoff, `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`, the Knowledge-Growth
  Decision Record, the Personal Resolution Memory Contract, and the Invalidation Contract before touching
  code. Only RESOLVER-V3-027's own scope (invalidation use case, its port, its in-memory adapter, one
  additive migration, focused tests, the invalidation contract doc, `ROADMAP.md`, this handoff) was changed.
- **Technical inventory (pre-implementation):** (1) `PersonalResolutionMemoryInvalidationRepository` is the
  only invalidation port; (2) its only implementation is
  `InMemoryPersonalResolutionMemoryInvalidationRepository` — **no production Supabase adapter for this port
  exists anywhere in `src/`**, confirmed by grep across the repo; (3) consequently there was and is no live
  persistence implementation to make atomic; (4) the pre-existing in-memory adapter mutated a `Map` directly
  inside the use case's BFS loop, once per iteration, with no staging/rollback; (5) the only idempotency
  boundary was per-node event-ID dedup (`actionId:memoryId`), not a whole-action ledger, which could not
  reproduce a consistent result on retry against already-mutated state; (6) `personal_resolution_memories`
  (state) and `personal_resolution_memory_events` (audit) tables and RLS already existed from RESOLVER-V3-017;
  `personal_resolution_memory_dependencies` (edges) existed from RESOLVER-V3-018 with **no foreign key** to
  the memories table; (7) no RPC/stored-function/`security definer` pattern exists anywhere in this codebase
  (verified by grep over `src/` and `supabase/migrations/`) — every real Supabase write path in the repo is a
  plain client-side `.from(...).insert()/.update()` call, so there is no existing atomic-transaction adapter
  pattern to extend for a production adapter; (8) `personal_resolution_memories` already has a
  `unique(owner_id, memory_id)` constraint, which is what makes a composite foreign key from the dependency
  table possible; (9) the request/result/event contract shape from RESOLVER-V3-018 could remain unchanged —
  only the internal planning/commit mechanics and the repository port needed to change; (10) true all-or-
  nothing semantics required replacing the immediate-write BFS with a read-only planning phase and a single
  atomic commit method on the port, plus a whole-action idempotency ledger separate from per-node event dedup.
- **Implementation:** Rewrote `InvalidatePersonalResolutionMemoryUseCase` as a strict two-phase
  plan-then-commit: Phase 1 is a pure, read-only pre-order DFS with explicit `visiting`/`done` node coloring
  (true cycle = revisit while `visiting`; diamond revisit = revisit while `done`, planned once, no duplicate
  event; already-inactive nodes are classified `noop` but their dependents are still traversed; the 100-node
  traversal limit is checked as each new node is first discovered, before any write is planned) that produces
  a single immutable `PersonalResolutionMemoryInvalidationPlan`. Phase 2 is the repository port's only write
  method, `applyInvalidationPlanAtomically`, which the in-memory adapter implements by staging all writes
  against copies of its internal maps and swapping them into live state only after the entire plan applies
  without error — proven via a test-only `injectCommitFailureAtWriteIndex` hook that forces a throw at the
  first, a middle, and the last planned write, in every case leaving both state and event history unchanged.
  Idempotence is enforced _before_ planning via a new `findCommittedAction(ownerId, actionId)` port method: a
  repeated action ID returns the exact previously committed result without re-touching the graph, which
  matters because re-planning from already-mutated current state would otherwise compute a different (though
  individually correct) all-noop result on a literal retry. Added `invalid_dependency` (a dangling or
  cross-owner dependency edge — checked in the use case itself as defense in depth, not only enforced by the
  migration) and `atomic_commit_failed` (Phase 2 failure) to the closed error-code set.
- **Migration:** One additive migration,
  `supabase/migrations/20260721140000_harden_personal_resolution_memory_invalidation.sql`, adds a composite
  foreign key from both `personal_resolution_memory_dependencies` edge sides
  (`(owner_id, memory_id)` and `(owner_id, depends_on_memory_id)`) to
  `personal_resolution_memories(owner_id, memory_id)` with `on delete cascade`. Because both foreign keys
  force the _same_ `owner_id` column value to resolve to a real memory row, cross-owner edges become
  structurally impossible, not just application-checked. No RLS, grant, or historical-migration change; the
  RESOLVER-V3-018 migration file is untouched (verified in a dedicated migration test and by `git diff`).
- **Non-effect:** No resolver read path, AI avoidance, catalog mutation, candidate effect, ranking/query
  effect, or new invalidation reason type was introduced. No production Supabase adapter was built for this
  port — the contract doc now states explicitly that only the in-memory adapter exists, and that a future
  production adapter would need a `security definer` Postgres function (no precedent for this exists yet in
  the repo) to get the same atomicity guarantee across multiple tables from client-side Supabase calls. No
  live Supabase migration was applied or attempted; no provider/network call was made.
- **Verification:** `npm run typecheck`, `npm run lint`, `npm run format:check`, and `npm run test` were run
  full-suite via `npm run verify`. Focused suite: `PersonalResolutionMemoryInvalidation.test.ts` — 32 tests
  (9 pre-existing behavior-preserving + 23 new: diamond/cycle graph correctness, atomicity via failure
  injection at first/middle/last write, already-inactive-node propagation to active dependents, idempotence
  including post-commit-failure retry and cross-action-ID safety on an already-inactive graph, and owner
  isolation including a corrupted-edge fake-repository test for `invalid_dependency`). New
  `PersonalResolutionMemoryInvalidationHardening.test.ts` — 7 tests on the new migration (reserved prefix,
  composite FK, cascade count, no anon/grant/view, no RLS/authenticated-grant change, additive-only, prior
  migration file unchanged). Pre-existing `PersonalResolutionMemoryInvalidationMigration.test.ts` (V3-018) and
  `PersonalResolutionMemoryPromotionPolicy.test.ts` (V3-017, confirmed unaffected — it only imports
  `promotionForEvidence` and has no dependency on the invalidation use case/repository) both still pass
  unmodified. Exact full-suite/CI numbers are recorded in the PR; see the git history for the merge commit.
- **Known/residual limits (explicit, not claimed complete):** no production Supabase adapter exists for
  invalidation (unchanged limit, now explicitly documented rather than implied); RESOLVER-V3-026 (production
  write integration) remains fully separate, `todo`, and still blocks RESOLVER-V3-019 on its own; the audit
  event table's mutability hardening remains RESOLVER-V3-026's scope, not touched here.

## RESOLVER-V3-025 — Documentation and Status Reconciliation (post-implementation review)

- **Basis and scope:** Reviewed the canonical branch at `df4accd02c7d79c44a0cb4d6f57f599c1809b458` (HEAD
  of `chore/clean-arch-structure` at review time, per `git log --oneline -15`; no further commits were
  found on top of it). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, the Knowledge-Growth
  Decision Record, and this handoff, then independently re-derived the RESOLVER-V3-017/018/020/021/022
  findings by reading the actual merged code rather than trusting prior status text.
- **What was reconciled:** `ROADMAP.md` had RESOLVER-V3-022 stuck on `todo` despite PR #110 being merged
  as `HEAD`, and RESOLVER-V3-018 simultaneously marked `done` and "(in progress)". Both are corrected.
  RESOLVER-V3-017/-018/-020/-021/-022 each now carry an inline "Post-implementation findings" note.
  RESOLVER-V3-019 and RESOLVER-V3-023 are changed from `todo` to `blocked`, with explicit new dependencies
  on the remediation tasks below. This handoff gained the missing RESOLVER-V3-021 and RESOLVER-V3-022
  sections (see below).
- **New remediation series:** RESOLVER-V3-025 (this task) through RESOLVER-V3-030 were added to
  `ROADMAP.md` to close the gaps found — personal-memory write integration/audit hardening (026),
  atomic/correct invalidation (027), review governance/atomic promotion (028), privacy-safe shadow
  projection/real metrics (029), and candidate-aggregation operational boundary (030).
- **Full findings:** see `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`.
- **Non-effect:** documentation-only change. No product code, migration, or dependency was touched. No
  live Supabase migration was applied or attempted (Supabase MCP access was unauthorized in this session,
  so live-database state is reported as carried over from the source review, not independently
  re-confirmed). No further live provider run was performed or authorized.
- **Verification:** documentation-only per `VERIFY.md` — `git --no-pager status --short`,
  `git --no-pager diff --stat`, `git diff --check` were run against the touched files.

## RESOLVER-V3-021 — Developer Review and Global Promotion

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`, merged twice by
  process error as PR #108 (`codex/implementiere-developer-review-vertrag`) and PR #109
  (`codex/implementiere-developer-review-vertrag-rqhv0v`); `git diff` between the two merge commits is
  empty, confirming identical content and no conflicting logic — only a duplicate-merge history.
- **Inventory:** No developer-review, approval, or global-activation mechanism existed before this task;
  candidates were inactive-only per RESOLVER-V3-020.
- **Implemented contract:** `resolver-knowledge-review-v1` with actions `approve`, `reject`,
  `needs_more_evidence`, `quarantine`, `mark_duplicate`, `supersede`, `revoke_approval`, `rollback`; a
  server-side authorization port, candidate reader port, review repository port, and
  `ResolverKnowledgeReviewService`; an in-memory review repository; Supabase tables
  `resolver_knowledge_reviews`, `approved_resolver_knowledge`, `resolver_knowledge_review_events` with RLS
  and no `anon`/`authenticated` grants.
- **Known gaps (see post-implementation review):** the service currently requires
  `independentUserEvidence === 'not_evaluable'` to allow approval, effectively treating "not evaluated" as
  passing evidence rather than blocking on it; `saveApproved`/`appendEvent` are non-atomic; `reject`/
  `needs_more_evidence`/`quarantine` do not transition candidate lifecycle state; the review event omits
  reviewer identity, decision reason, contract/candidate/privacy versions, and a material snapshot.
  Tracked as RESOLVER-V3-028.
- **Non-effect:** no app-facing grants, no resolver-effect wiring, no automatic approval.

## RESOLVER-V3-022 — Shadow Mode for Global Candidates

- **Basis and scope:** Implemented from the RESOLVER-V3-021 merge state on
  `codex/implementiere-shadow-mode-fur-globale-kandidaten`, merged as PR #110
  (`df4accd02c7d79c44a0cb4d6f57f599c1809b458`).
- **Implemented:** `resolver-knowledge-shadow-evaluation-v1` contract; a pure
  `ResolverKnowledgeShadowEvaluator` with no external ports, no network/provider calls, and no resolver
  mutation; development/holdout partitioning (duplicate case-ID rejection within one evaluation call);
  candidate-type/locale/input-type checks; delta categories (`no_change`, `hypothetical_source_change`,
  `hypothetical_abstention`, `hypothetical_clarification`, `hypothetical_provenance_warning`,
  `blocked_locale`, `not_evaluable`, `invalid_candidate`, `privacy_blocked`); an aggregate-metrics helper.
- **Known gaps (see post-implementation review):** `productionDecision` is typed as the full
  `ResolverDecision` (including `normalizedQuery`, candidates, source data), and the privacy check only
  inspects top-level keys of `candidate`/`candidate.payload` — it never inspects `productionDecision`, so
  private/linkable resolver data currently passes through shadow requests/results unfiltered.
  `falseConfidenceRegressionCount`, `falseConfidenceImprovementCount`, and `regressionCount` are hard-coded
  to `0`; `identificationAccuracy`, `abstentionPrecision`, and `clarificationRate` are always `'unknown'`;
  `fixtureExpectedStatus` is carried in the contract but never used to compute any of them. Holdout
  separation does not persist across runs. Tracked as RESOLVER-V3-029.
- **Non-effect:** confirmed no external ports, no network calls, no provider calls, no resolver mutation.

## RESOLVER-V3-018 — Personal Memory Invalidation

- **Basis and scope:** Started from the required `4c960d0b6a3abf78906661a660ea4fbde7963958` and created `codex/resolver-v3-018-personal-memory-invalidation`. Only the V3-018 private-memory contract, one authorized additive migration, focused tests, canonical documentation, roadmap status, and this handoff changed.
- **Inventory:** The actual implementation before this task consisted of the `personal-resolution-memory-v1` domain contract (P0/P1/P2; active/superseded/contradicted/deleted), promotion policy, write-only `record` port, and private state/event tables. There was no production writer, Supabase adapter, in-memory memory adapter, resolver read path, candidate link, source-update signal, or stored dependency edge. Correction logs and journal soft-delete/restore flows exist, but none carries an attributable personal-memory ID or action mapping. Alias/portion-hint deletion is likewise not connectable safely. Account cascade existed on state/events; source supersession, source unavailability, and source identity change therefore remain explicit-port-only signals.
- **Implementation:** Added the closed `personal-resolution-memory-invalidation-v1` request/result/event contract with nine closed reasons and closed failure codes. The use case is owner-scoped and fail-closed, preserves historical evidence through append-only events, turns P1 source-unavailability into P0 weakening, and can deactivate P2. The in-memory private adapter makes action/event retries idempotent and supports direct dependency storage. It neither logs raw inputs/owners/source user text nor imports resolver, AI, catalog, or candidates.
- **Dependencies and persistence:** One reserved-prefix migration adds same-owner direct dependency edges with account cascade, RLS, authenticated-only grants, no anon access, and a constrained `invalidation` event type. Traversal is bounded at 100 entries, detects cycles, and propagates via `dependency_invalidated`; cross-owner links are not traversed. There is no global view/function, generic metadata store, dummy owner, or real Supabase/network call.
- **Integration/non-effect:** No correction/journal action was wired because invalidation failure must not change a successful journal action and no safe memory identity signal exists. No resolver read, AI avoidance, ranking/query/fast path, candidate creation, source call, or catalog mutation was added. V3-019 receives only the inactive-state contract and must add its own exact private read policy.
- **Verification:** Focused invalidation/migration suites: 2 suites, 11 tests passed; personal-memory, correction, and journal regressions: 3 suites, 16 tests passed. Typecheck and lint were invoked without reported errors; touched-file Prettier check passed. `git diff --check`, no dependency drift, migration timestamp uniqueness, and secret-safe diff checks passed. No UI file changed, so no manual UI gap entry applies. PR #107 subsequently merged with green CI (`bd5bd7f2281e7aade99d05bcf7a1bfec401e9ff0`).
- **Post-implementation findings (RESOLVER-V3-025, 2026-07-21):** independent code review after merge found the traversal writes each transition immediately rather than planning fully first (no atomicity/rollback on later failure), the "detects cycles" behavior above is a false positive on diamond dependency graphs (a node reached via two valid paths is wrongly reported as a cycle), an already-inactive node's dependents are never enqueued for propagation, and `personal_resolution_memory_dependencies` has no foreign key to `personal_resolution_memories`. None of this was exercised by the test suite above. Full detail in `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`; tracked for remediation as RESOLVER-V3-027. RESOLVER-V3-019 must not build on this path until that remediation lands.

## RESOLVER-V3-020 — Privacy-Safe Knowledge Candidate Aggregation

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7` on branch `feat/resolver-v3-020-knowledge-candidates`. This task does not change personal memory, resolver composition, provider wiring, dependencies, or the V3-017 scope.
- **Inventory:** The current privacy projection contains privacy/observation contract versions, locale, input type, outcome, candidate count, selected BLS/OFF/USDA source type and ID, provenance, resolver version, latency, and closed reason codes. V1 consequently supports only structured route, abstention, clarification, provenance-gap and negative-source-routing signals. It cannot derive aliases, terms, typo/locale mappings, meal names, searches, free-text templates, or independent-user counts; that status is always `not_evaluable`.
- **Implementation:** Added closed `resolver-knowledge-candidate-v1` model, fail-closed projection aggregator, deterministic safe-payload fingerprint deduplication, contradiction and negative-evidence preservation, and an in-memory server-boundary repository limited to inactive lifecycle transitions. `approved` is reserved and rejected. The aggregator has no import or read path for `resolver_observations`; source IDs are discarded before payload/fingerprint creation.
- **Persistence:** Added one additive migration defining `resolver_knowledge_candidates` and append-only `resolver_knowledge_candidate_events`, both RLS-enabled and fully revoked from `anon` and `authenticated`. It has no grants, app/global/resolver view, trigger, candidate activation, or curated-knowledge path. Existing observations, resolver runs, cache results, aliases, catalog and personal-memory structures remain untouched.
- **Documentation and follow-up:** `docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md` records the candidate inventory, contract, lifecycle, persistence boundary and V3-021/V3-022 handoff. Developer review/promotion belongs to V3-021; shadow evaluation belongs to V3-022. RESOLVER-V3-017 remains unchanged.
- **Verification:** Focused candidate/privacy/migration suites: 3 suites, 22 tests passed. `npm run typecheck` and `npm run lint` passed. The full prettier/verify commands were invoked but the command runner ended after starting their repository-wide formatting stages without printing a completion footer; rerun `npm run format:check` and `npm run verify` in CI before merge. No live Supabase, provider, network or AI call was performed.

## RESOLVER-V3-017 — Personal Memory Promotion and Correction Precedence

- **Basis:** `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`.
- **Inventory:** logging is an implicit weak action; correction logs distinguish user/system edits; saved meals exist as personal templates; aliases, portion hints, resolver observations and journal snapshots are not reused as memory. Canonical catalog references are source-grounded; `user` source records are personal/manual. A dedicated private boundary is required.
- **Implemented contract:** `personal-resolution-memory-v1` defines closed P0/P1/P2, status, target references, evidence, transitions, and private correction negative evidence. The policy fails closed for unknown evidence/version and intentionally has no repetition threshold.
- **Storage:** one additive owner-scoped Supabase migration creates state/events tables with account cascade, RLS, no anon grant, and no views/aggregation.
- **Non-effect:** no resolver read/fast path/ranking/AI avoidance/global candidate path was added. V3-018 remains responsible for dependency invalidation and V3-019 for reads; V3-020 must not consume private memory.

## RESOLVER-V3-016 — Privacy Boundary Enforcement

- **Basiscommit:** `e67fb043e21796a937f5585475d80549ff2167ed` on expected base content; task branch `codex/resolver-v3-016-privacy-boundary`.
- **Policy:** `resolver-observation-privacy-v1`; executable field catalogs cover private storage columns and every V1 nested contract field. `owner_id`, row/observation/run IDs, and exact timestamps were corrected/treated as private or linkable exclusions, not operational projection fields.
- **Inventory:** raw/normalized inputs are free text; owner and IDs are direct/linkable; source `user` and its IDs are private; reason codes are only projectable from a closed allowlist. Structured V1 fields allowed in the in-memory-only projection are policy/contract version, locale, input type, outcome, candidate count, approved BLS/OFF/USDA source pair, provenance, resolver version, latency, and safe reason codes.
- **Excluded:** owner, raw/normalized text, all IDs/timestamps, journal/food-entry/correction links, metadata, provider data, prompts, secrets, headers, and stack traces. Normalized text remains blocked pending an explicit later policy/process; no hash or threshold is claimed as anonymization.
- **Deletion/retention/access:** deletion obtains the current owner through the canonical provider and deletes only that owner's private rows; missing owner fails closed. Existing account cascade and owner RLS remain unchanged. No automatic retention duration/job is introduced; no automatic candidate/global transfer exists.
- **Logging:** unconditional resolver logs containing raw or normalized query were converted to explicit debug-gated logs without input values. Observation errors log only closed codes; full Supabase response and owner are not logged.
- **Open questions:** future semantic alias/term aggregation, retention duration, and any controlled server path require a separate accepted policy. RESOLVER-V3-017 and V3-020 may begin in parallel on separate branches; V3-020 cannot read private rows as global candidates.
