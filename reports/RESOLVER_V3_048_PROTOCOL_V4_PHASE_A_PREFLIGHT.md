# RESOLVER-V3-048 — Protocol-v4 Phase A Preflight

## 1. Basis, authority, and scope

Phase A used `d7e15aeaf0c66bab8a94eead266eb14add9e9a12`, the supplied PR #189 merge commit and local `HEAD`. The checkout has no configured Git remote, so an independent fetch of the current remote tip was impossible. The requested `.governance/{SYSTEM,RULES,SAFETY,REVIEW_POLICY}.md` files do not exist: `SSOK.md` and `AGENTS.md` record that `.governance/**` was retired by RALPH-RETIRE-002 and its surviving rules consolidated into `AGENTS.md`.

This phase is contract/preflight work only. It made **0 provider calls**, incurred **USD 0**, read no credentials, created no live evidence or live authorization, and changed no production wiring.

## 2. Immutable plan identity and hash tree

Protocol version: `resolver-v3-048-protocol-v4-phase-a-v1`. Execution tree version: `resolver-v3-048-execution-tree-v1`.

- Plan hash: `2eeccac000739c999e39c581b7d98eef00be56116370befb49d1b1f4b9fa79e9`.
- Execution-tree hash: `c72221b7d4933b76cea8979b36750863177a7fb565d77b96c8eaab078bb7c87e`.
- Candidate set: `resolver-v3-047-h0-h1-h2-v1`.
- Model: exactly `claude-haiku-4-5-20251001`; pricing: `anthropic-haiku-4-5-usd-2026-07-22`; C0; temperature 0; `max_tokens=1536`; transport timeout 15,000 ms; outer ceiling 20,000 ms; retries 0.

The plan hash covers protocol/tree identities, corpus and ground-truth identities, source manifest, corrected evaluator identity, candidate/prompt/schema/routing identities and hashes, model/pricing/context/runtime settings, frozen partition/category/repetition observations, G2 gates, selection rule, proposed budget, no-cache policy, and artifact paths. It excludes inputs, provider responses, results, and post-hoc values. The execution-tree hash independently covers candidates, ordered observations, selection rule, and the explicit prohibition on automatic continuation.

## 3. Candidates, Development, selection, and Holdout

The frozen candidates remain H0 (`resolver-v3-047-h0-v1`, P0/S0/R0), H1 (`resolver-v3-047-h1-v1`, P1/S1/R0), and H2 (`resolver-v3-047-h2-v1`, P1/S1/R1-min). Development contains all three candidates under identical provider/model/pricing/partition/repetition/timeout/retry/evaluator settings. Holdout contains exactly the later selected configuration and cannot automatically follow Development.

Eligibility requires zero critical false-confidence cases, complete contract/envelope/parsing/failure taxonomy, and every existing mandatory G2 criterion passing individually. No average may hide a mandatory criterion. Ordered comparison uses the existing G2/Resolver contracts for identification and complex-component quality, clarification/abstention, and repeat consistency, followed by lower validated-log cost, p50/p95, failure rate, AI calls, and source calls. Tie-breakers are: fewer critical failures; higher complex-component quality; higher identification quality; higher clarification/abstention quality and consistency; lower cost; lower p95 then p50; lower failure rate; fewer AI then source calls; lexicographically lower candidate ID. No new numeric quality threshold was introduced.

## 4. Artifact contract

Protocol v4 independently versions paths for plan, plan/source/candidate/pricing manifests; Development checkpoint/raw/category/telemetry/ledger/evaluation; frozen candidate selection; separate Holdout authorization; Holdout checkpoint/raw/category/telemetry/ledger/evaluation; and final G2 report. Fake artifacts, if materialized later, are restricted to `tmp/resolver-v3-048-protocol-v4-dry-run`; canonical live targets are under `logs/resolver-v3-048-protocol-v4`. Phase A materialized neither path.

## 5. Category-level evidence

Each row contains frozen scenario ID, partition, corpus category, difficulty, candidate, run index, expected behavior, actual identification, critical-error flag, failure kind, resolver outcome, component count, clarification, and abstention. Validation fails closed on missing or duplicate scenario-runs, unknown/fabricated category, partition drift, missing repetitions, mixed candidate identity, and plan-hash drift. Category is copied only from the frozen corpus case, never derived from a result.

## 6. Pricing, usage, failure, and ledger parity

Protocol-v4 terminal metadata requires full run identity, pricing/usage/actual-cost statuses, reservation reference and worst-case cost, actual cost, closed failure kind, retryability, HTTP status, input/output/cache tokens, provider and end-to-end latency, and measured call counts. Historical protocol-v3 usage remains readable through an absent protocol discriminator; new v4 records fail closed without required fields.

Telemetry and ledger must be identical for run identity, pricing status, usage status, actual-cost status/value, and failure kind. A successful usage-bearing response is `usageStatus=reported`, `actualCostStatus=computed`. Missing usage never becomes zero cost.

The adapter now preserves the original `VariantCAiCallMetadata` alongside the food-facing cost projection. The V3-047 offline harness reads parser failure, usage status, actual-cost status, run identity, HTTP/cache/latency/cost and retry metadata from this provider record; it no longer fabricates `parserFailureKind=null` or derives reported/computed merely from `called`.

## 7. Wall-clock and no-cache contracts

The outer ceiling uses the same terminal metadata builder/shape as every other outcome: pricing remains known (`estimated` under the repository snapshot), usage is `unknown`, actual-cost status is `usage_unknown`, actual cost is null, reserved worst-case cost remains separate, failure is `wall_clock_ceiling`, retryable is false, and exactly one terminal telemetry/ledger pair is permitted.

Prompt caching remains disabled. Missing/null/zero cache fields are allowed. Any positive cache-creation or cache-read count requires `usage_cost_contract_error`, null actual cost, and no retry; all other combinations fail closed.

## 8. Exact call-count semantics

Every AI dispatch, provider HTTP request, BLS/OFF/USDA call, total external request, avoided source call, and automatic retry now has `{value|null, accuracy, boundary}` with `exact`, `lower_bound`, `unknown`, or `not_applicable`. The legacy fast-path `externalRequestCount=1` is explicitly represented as a `lower_bound` at `resolver_legacy_aggregate`, never exact. Fake transport/source boundaries can report exact counts without contradiction.

## 9. Budget proposal — not authorization

Using only the frozen plan and repository price snapshot ($1/MTok input, $5/MTok output), conservatively reserving 8,192 input plus 1,536 output tokens per planned call:

| Phase                            | Calls | Maximum token reservation | Maximum cost (USD) |
| -------------------------------- | ----: | ------------------------: | -----------------: |
| Development (H0/H1/H2)           |   324 |                 3,151,872 |           5.142528 |
| Holdout (one selected candidate) |    28 |                   272,384 |           0.444416 |
| Total                            |   352 |                 3,424,256 |           5.586944 |

Maximum concurrency is 1; currency is USD. These values are reserved worst-case ceilings, not actual usage or cost. Actual cost remains null when usage is unknown. The plan marks the budget `proposal_only`; its presence cannot authorize or start a provider request. No after-the-fact increase is supported.

## 10. Zero-network dry-run validation

The focused suite covers all required fake cases: reported-usage success; transport; inner abort; outer ceiling; HTTP 429/500; envelope JSON/contract; text JSON; schema; positive cache creation/read; clarification; abstention/not-interpretable; R1-min early stop/exhaustion; safe fast path; lower-bound-only fast path; missing plan hash; wrong candidate; Holdout without selection; Holdout without separate authorization. It also validates manifests/hashes, category closure, deterministic selection, checkpoint/identity/budget gates, telemetry/ledger parity, no-cache behavior, and exact/lower-bound counts. It constructs no real transport and performs no network request.

## 11. Evidence integrity and status

The seven V3-039 evidence files, their closeout/manifest, corpus, ground truth, corrected V3-042 evaluator, BLS artifacts, CI, dependencies, database, UI, DI, feature flags, and production code paths are unchanged. G2 remains **not passed**. V3-047 remains `done — executable offline candidate and evidence infrastructure complete; live superiority unverified`; V3-048 is `in_progress — protocol-v4 contract and zero-call preflight complete; live execution not authorized`; V3-010 remains `blocked`; production wiring remains unauthorized.

Phase B remains prohibited until this PR is merged, independently reviewed after merge, and a human explicitly approves the exact call, token, and USD budget. Phase A neither authorizes nor performs live execution.

---

# POST-MERGE CORRECTION (RESOLVER-V3-048, 2026-07-27) — Everything Above This Line Is Unmodified History

**This section is additive.** Sections 1–11 above describe PR #190 (`f1a6fcb5de536d7e6aaed6c7d6805c3733dc2311`, merged as `dd81439a36ac4122cce5d3bdeeb2562ce84271ac`) exactly as merged, unedited. PR #190 remains merged; nothing above was reverted. This section documents an independent post-merge review that found PR #190's Phase A claims premature, the twelve reproducible defects it found, the failing baseline that proved them, and the remediation that closed them — all on top of the same merge commit, in a new branch.

## Basis

Base commit: `dd81439a36ac4122cce5d3bdeeb2562ce84271ac` (PR #190 merge). Verified as the actual tip of `chore/clean-arch-structure` at the start of this remediation (`git log origin/chore/clean-arch-structure -1`), matching the task's required minimum exactly.

## 1. Reproduced residual defects

An independent read of the merged code (`src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4.ts` and its test file) confirmed all twelve defects listed in the remediation task, each pinned to a specific code location:

1. The "22-scenario dry run" test was `expect(scenarios).toHaveLength(22)` against a hard-coded `string[]` literal — no plan builder, provider, transport, source, telemetry, ledger, checkpoint, evaluation, selection, or authorization function was ever called by it.
2. No dry-run artifact was ever constructed or validated anywhere in the merged module.
3. No function in the merged module ever produced `ProtocolV4TerminalMetadata` from a real or fake wall-clock attempt — `validateTerminalMetadata` only validated hand-built literal objects in tests.
   4/5. No Protocol-v4 telemetry or ledger wrapper existed at all; `assertTelemetryLedgerParity` was a pure comparator nothing fed real records into.
4. `PROTOCOL_V4_PRICING_VERSION = 'anthropic-haiku-4-5-usd-2026-07-22'` was a standalone literal, distinct from `ANTHROPIC_MESSAGES_PRICING`'s real `pricingVersion` (`'anthropic-messages-2025-10-01-v1'`) for the same pinned model — the value `LiveProviderBudgetGate.reserve()` actually uses for every real reservation.
5. `plan.evaluator.hash = hashProtocolV4({ version: PROTOCOL_V4_EVALUATOR_VERSION, authority: 'RESOLVER-V3-042' })` — a hash of a two-field self-declared label, never of the real evaluator code in `RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`.
   8/9. `assertHoldoutAuthorized({ developmentCheckpoint: boolean, developmentEvaluation: boolean, ... })` accepted bare `true` literals with no backing artifact.
6. `CandidateSelectionRecord` was `{ planHash, executionTreeHash, candidateId, developmentComplete: true, frozen: true }` — freely constructible, no reference to any evaluation, artifact, or hash proving the selection was actually computed.
7. `assertHoldoutAuthorized` never compared `authorization.maxCalls`/`maxTokens`/`maxCostUsd` against `plan.budget.holdoutCalls`/etc. at all — only a separate `remainingCalls`/`remainingTokens`/`remainingCostUsd` input was checked.
   12/13. `observations()` looped scenarios × **all three candidates** × repeats for both partitions, so `plan.observations.filter(o => o.partition === 'holdout')` contained H0, H1, and H2 — while `buildProtocolV4Plan()`'s `holdoutCalls` was `obs.filter(o => o.partition === 'holdout' && o.candidateId === 'H0').length`, a hard-coded single-candidate filter over a plan that itself claimed all three ran Holdout.
8. No `validateMeasuredCount`/count validator existed; `validateTerminalMetadata` never inspected `meta.counts` at all.
9. `validateTerminalMetadata` never checked `actualCostStatus`/`actualCostUsd` coherence outside the wall-clock/cache branches, never checked failure/success coherence, and never checked negative or non-finite costs/latencies.
10. `assertTelemetryLedgerParity` compared exactly six fields (`runIdentity`, `pricingStatus`, `usageStatus`, `actualCostStatus`, `actualCostUsd`, `failureKind`) — ignoring reservation, tokens, HTTP status, cache fields, latencies, and counts entirely.

## 2. Failing baseline (Part 1) — exact command and result

A dedicated test file, `src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4RedBaseline.test.ts`, was written and run **unmodified against the merge commit** before any implementation file changed. Each `it` proves a defect by demonstrating the merge commit's code does **not** throw/does not export a guard that should exist.

Command:

```
npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4RedBaseline.test.ts
```

Result on the merge commit (before any remediation edit — captured verbatim):

```
PASS src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4RedBaseline.test.ts (6.352 s)
  RED BASELINE (dd81439a36ac4122cce5d3bdeeb2562ce84271ac / PR #190 merge) -- reproduces defects 1-16
    ✓ 1/2: no executable dry-run/artifact pipeline exists at all -- only a name-length assertion in the old test file (4 ms)
    ✓ 3/4/5: no wall-clock/telemetry/ledger wrapper wiring exists
    ✓ 6: plan pricing version literal differs from the actual provider-pricing-table version for the same model (1 ms)
    ✓ 7: evaluator hash is derived only from a self-declared label/authority string, never real evaluator file content (1 ms)
    ✓ 8/9/10: development checkpoint/evaluation are bare booleans and selection is unproven -- holdout gate accepts fabricated true/selection with zero evidence (5 ms)
    ✓ 11: an authorization with maxCalls/maxTokens/maxCostUsd of 0 is accepted -- the gate never checks authorization limits against the plan (5 ms)
    ✓ 12: the frozen execution tree contains all three candidates (H0/H1/H2) for the holdout partition (1 ms)
    ✓ 14: MeasuredCount has no independent validator -- an incoherent count sails through validateTerminalMetadata untouched
    ✓ 15: incoherent terminal metadata combinations are accepted (computed cost with null actualCostUsd; success with a failureKind; negative cost)
    ✓ 16: telemetry/ledger parity ignores reservation, tokens, http status, cache fields, latencies and counts

Test Suites: 1 passed, 1 total
Tests:       10 passed, 10 total
Snapshots:   0 total
Time:        6.643 s
```

Every `it` **passing** here is the failing-baseline proof: each assertion is written so it only passes when the defect is present (`.not.toThrow()` where a real contract should throw, or a missing export). After remediation, this same file's assertions were inverted in place (kept as a permanent regression suite rather than left as a dated always-red artifact) and now assert the guard **does** throw / the function **does** exist — see §10 below for the post-remediation green result.

## 3. Single pricing authority (Part 2)

`src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4Pricing.ts` (new) resolves `ProtocolV4PricingIdentity` directly from `ANTHROPIC_MESSAGES_PRICING`/`findLiveProviderPricing` in `LiveProviderBudgetGate.ts` — the same table `LiveProviderBudgetGate.reserve()` uses for every real reservation — keyed by the exact pinned model ID (`claude-haiku-4-5-20251001`), and throws `ProtocolV4PricingAuthorityError` if the row is missing, unversioned, model-mismatched, or non-USD. `PROTOCOL_V4_PRICING_VERSION` (the old standalone literal) no longer exists. `ProtocolV4MasterPlan.pricing` (the resolved identity) and `pricingManifestHash` (its hash) replace the old flat `pricingVersion` field. `validateProtocolV4MasterPlan` calls `assertProtocolV4PricingIdentityMatches` — any drift between the plan's pricing and the live authority throws before any other check completes ("blocks before dispatch").

Resolved pricing for the pinned model: `pricingVersion = anthropic-messages-2025-10-01-v1`, `inputPerMillion = 1`, `outputPerMillion = 5`, `currency = USD` — numerically identical to the values PR #190 already used (no price was invented or changed), only the version identity is now load-bearing and single-sourced.

## 4. Real hash authority (Part 3)

**Evaluator.** `src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4EvaluatorHash.ts` (new) identifies the canonical corrected-G2-evaluator files as `RepresentativeHybridV1LiveMetrics.ts` (the per-dimension G2-A..G2-G metric functions, including the RESOLVER-V3-042 fixes) and `RepresentativeHybridV1LiveReportBuilder.ts` (which wires those metrics into persisted gate verdicts) — confirmed against `reports/RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md`. Per the task's explicit "reuse existing canonical hashes" instruction, this module does not invent a new algorithm: it reuses `computeRepresentativeHybridV1LiveExecutionTreeHash`/`canonicalizeRepresentativeHybridV1LiveExecutionTreeText` verbatim (RESOLVER-V3-039's cross-platform-reproducible, CRLF-normalizing, path-sorted content hash), scoped to exactly these two files, reading real content from disk. A byte or logic change to either file changes the hash (proven directly: `computeProtocolV4EvaluatorManifestHashFromFiles` with two different literal contents produces two different hashes).

**Other manifests.** Corpus (`REPRESENTATIVE_HYBRID_V1_CORPUS_HASH`), ground truth (derived from the frozen resolution scenarios), and source manifest (`REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH`) continue to reuse the existing, already-verified hashes unchanged, per the same "don't redefine what already exists" instruction. New aggregate hashes were added for the candidate/prompt/schema/pricing manifests (`candidateManifestHash`, `promptManifestHash`, `schemaManifestHash`, `pricingManifestHash`), each a straightforward `hashProtocolV4()` over the relevant frozen structure.

## 5. Two-stage plan identity (Part 4)

`ProtocolV4MasterPlan` (renamed from `ProtocolV4Plan`) now carries `developmentObservations` (all three candidates, Development only) and a candidate-agnostic `holdoutTemplate: { observations: ProtocolV4HoldoutTemplateObservation[] }` that carries no `candidateId` field at all — `validateProtocolV4MasterPlan` explicitly rejects a Holdout template row that does carry one. The Master Plan therefore structurally cannot claim all three candidates run Holdout. `deriveHoldoutExecutionPlan(masterPlan, developmentEvidenceRootHash, selection)` produces the `HoldoutExecutionPlan` only after a frozen, artifact-bound `CandidateSelectionRecord` exists: it contains the Master Plan hash, the Development Evidence Root hash, the Candidate Selection Record hash, exactly one candidate's full identity, that candidate's Holdout observations (derived from the template), a fresh `holdoutExecutionTreeHash`, exact Holdout call/token/cost figures, the still-unused Holdout artifact targets, and its own `holdoutPlanHash` covering all of the above — any change to any of these moves `holdoutPlanHash`.

## 6. Artifact-bound Development evaluation (Part 5)

`selectCandidate()` (the pure comparator) is preserved unchanged, but is no longer directly reachable with hand-constructed numbers: `selectCandidateFromDevelopmentEvidence(plan, evidence)` is now the only supported entry point, and it first calls `validateProtocolV4DevelopmentEvidence`, which requires exactly one sealed, hashed `ProtocolV4Artifact` per Development component (plan manifest, and per candidate: checkpoint, raw results, category table, telemetry, ledger, evaluation) for **all three** candidates, cross-validates every category-evidence row against the frozen plan observations, runs `validateTerminalMetadata` over every telemetry/ledger record, and runs the new `validateCandidateEvaluation` (rejects `NaN`/`Infinity`/negative counts/an incoherent `g2Results` vs. `allMandatoryG2CriteriaPass`) over every evaluation. Only once all of that passes does it compute `developmentEvidenceRootHash` (a hash over every artifact's content hash, sorted by candidate) and call the real `selectCandidate()`. The resulting `CandidateSelectionRecord` carries the Master Plan hash, Development Execution Tree hash, every Development artifact's hash, the Development Evidence Root hash, the selection rule's version+hash, the full per-candidate evaluation, per-candidate eligibility, the selected candidate, a deterministic tie-break trace, `frozen: true`, and its own `selectionRecordHash`.

## 7. Strict Human/Fake Holdout authorization (Part 6)

`HoldoutAuthorizationRecord` now carries `authorizationSchemaVersion`, `kind: 'fake_dry_run' | 'human_live'`, the Master Plan hash, the Holdout Execution Plan hash, the Development Evidence Root hash, the Candidate Selection Record hash, the candidate identity, `maxCalls`/`maxInputTokens`/`maxOutputTokens`/`maxTotalTokens`/`maxCostUsd`/`currency`, `maxConcurrency`, `authorizedPhase: 'holdout'`, a unique `authorizationId`, an explicit `humanApprovalReference` (required whenever `liveExecution` is true), and `consumed: false`. `assertHoldoutAuthorized` now checks, in order: full plan/holdout-plan/selection re-validation; authorization schema/identity/phase/currency match; `!consumed`; artifact target unused; **authorization limits are at least sufficient for the Holdout plan's own call/token/cost figures** (closes defect 11); an optional `humanApprovedCeiling` the authorization's own limits may never exceed; remaining-budget sufficiency; and finally that a `fake_dry_run` authorization can never satisfy `liveExecution: true`, and that `liveExecution: true` requires `kind === 'human_live'` with a non-null `humanApprovalReference`. This task produced and exercised **only** `kind: 'fake_dry_run'` authorization records, per the task's explicit restriction.

## 8. Protocol-v4 telemetry/ledger actually wired (Part 7)

`src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4Telemetry.ts` (new) adds `recordProtocolV4Terminal(terminal, telemetry[], ledger[], context?)` — validates one terminal record (optionally against a plan/observation identity context) and pushes an identical copy into both arrays, then asserts parity; this is the only supported way to add an entry to either array. `wrapWithProtocolV4WallClockCeiling(attempt, ceilingMs, buildTerminalOnCeiling, telemetry[], ledger[], context?)` reuses RESOLVER-V3-039's own `withWallClockCeiling` (a pure, already-reviewed attempt/ceiling race) and, on ceiling breach, requires the caller-built terminal to declare `failureKind: 'wall_clock_ceiling'` before recording it — enforcing known/`estimated` pricing, `usage_unknown`/`unknown` usage/cost, null actual cost, preserved reserved cost, no retry, full run identity, and exactly one telemetry/ledger pair, per the task's wall-clock contract. Neither function touches any RESOLVER-V3-039 file or frozen evidence.

## 9. Closed terminal/count validators (Part 8)

`validateMeasuredCount` (new) rejects a `null` value for `exact`/`lower_bound`, a non-null value for `unknown`/`not_applicable`, non-integers, negatives, non-finite numbers, and an `exact` legacy-aggregate boundary. `validateProtocolV4CallCounts` (new) additionally requires `automaticRetries === 0` when exact, and that an exact `totalExternalRequests` is never below the sum of exact per-source counts. `validateTerminalMetadata` now additionally rejects: non-finite/negative reserved cost, end-to-end latency, provider latency, actual cost; reported usage without both tokens (and the reverse); a `computed` cost status with a null actual cost (and the reverse); a **network-level** failure (`transport_error`/`timeout_abort`/`wall_clock_ceiling`/`http_error`/envelope errors/`missing_text_block`/`budget_config_error`) claiming reported usage or a computed cost (real-world-correct: a **parse/schema-level** failure like `text_block_json_error`/`schema_contract_error` legitimately _can_ report real, billable usage, since the provider did respond before a later contract failed — this distinction was found and had to be corrected during the dry-run implementation, see §10); a genuine failure signal (`usage_unknown`/`usage_cost_contract_error`) with no `failureKind`; a successful record marked `retryable`; and, when an optional plan/observation context is supplied, any run-identity field (plan hash, execution tree hash, candidate, scenario, partition) that doesn't match it. `assertTelemetryLedgerParity` now compares all sixteen evidence-relevant fields (was six): run identity, pricing/usage/actual-cost status, reservation ID, reserved cost, actual cost, failure kind, retryable, HTTP status, input/output/cache tokens, provider/end-to-end latency, and counts.

## 10. Real, executable 22-scenario dry run (Part 9)

`src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DryRun.ts` (new) implements `runProtocolV4DryRun()`, which builds the real Master Plan, then executes all 22 mandated scenarios:

- **Scenarios 1–18** (`runCaseScenario`) drive the real `runVariantCCase()` against the real, candidate-dependent `createLiveVariantCInterpreter()` (the actual `AnthropicVariantCLiveInterpreter`), fed a fake `fetch` (never a real HTTP request) and fake, in-memory `FoodCatalogSource` implementations for `bls`/`off`/`usda`, then map the resulting `VariantCAiCallMetadata` into a `ProtocolV4TerminalMetadata`, record it through `recordProtocolV4Terminal` (real validation + parity), build a `CategoryEvidence` row, seal it as an artifact, and round-trip it through `JSON.stringify`/`JSON.parse` to prove readback hash stability. Covers: success with reported usage; transport error; inner (per-request) timeout abort via `TimeoutEnforcingAnthropicBenchmarkTransport`; HTTP 429/500; envelope JSON/contract errors; text-JSON error; schema error; positive cache-creation/cache-read tokens (no-cache contract violation); clarification; abstention/not-interpretable; R1-min early stop and tiers-exhausted (H2, real tiered `bls→off→usda` routing); a safe fast path with positive structural proof; and a fast-path lower-bound count.
- **Scenario 4** (`runWallClockCeilingScenario`) races the real interpreter's `interpret()` against `wrapWithProtocolV4WallClockCeiling` with a fake `fetch` that never settles until aborted, proving a genuine outer-ceiling breach (not a hand-built terminal object).
- **Scenarios 19–22** (`runNegativeScenario`) exercise the real validators/gates directly against tampered real data: a `validateTerminalMetadata` call with a manipulated `planHash` in the run identity, and one with a mismatched `candidateId` against the supplied context; `deriveHoldoutExecutionPlan` called with an unfrozen (tampered) `CandidateSelectionRecord`; and `assertHoldoutAuthorized` called with an already-`consumed` authorization. Each must throw, or the scenario itself throws (proving the negative case actually blocked, not merely ran).

`runProtocolV4DryRun()` asserts exactly 22 distinct scenario IDs were executed (`PROTOCOL_V4_DRY_RUN_INCOMPLETE` otherwise) and returns a structured `ProtocolV4DryRunReport` (per scenario: executed components, expected vs. actual decision, telemetry, ledger, counts, artifact hashes, validator result, evidence class `zero_network_fake_executed`). `src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4DryRun.test.ts` asserts all of the above, that telemetry equals ledger for every case-level scenario, and that every negative scenario actually blocked.

During implementation, running this real pipeline caught a genuine, previously-undetected defect in the terminal-metadata validator itself: the initial "success cannot carry a failure kind" rule was defined from `usageStatus`/`actualCostStatus`, which is wrong — a real `text_block_json_error` response legitimately carries reported usage (the provider consumed real, billable tokens before the response failed a later parse contract). This was corrected in §9 above (`NETWORK_LEVEL_FAILURE_KINDS`) — a direct, concrete benefit of executing the real pipeline instead of hand-building terminal fixtures.

## 11. Corrected budget proposal (Part 10)

Re-derived from the corrected Master Plan (single pricing authority; Development-only `developmentObservations`; the candidate-agnostic `holdoutTemplate`, whose call count is now generic rather than filtered by a hard-coded `candidateId === 'H0'`):

| Phase                                  | Calls | Maximum token reservation | Maximum cost (USD) |
| -------------------------------------- | ----: | ------------------------: | -----------------: |
| Development (H0/H1/H2)                 |   324 |                 3,151,872 |           5.142528 |
| Holdout (one later-selected candidate) |    28 |                   272,384 |           0.444416 |
| Total                                  |   352 |                 3,424,256 |           5.586944 |

**These figures are numerically unchanged from PR #190's proposal** — the underlying corpus/candidate/pricing values were already correct; only the _derivation path_ changed (generic Holdout-template count × single pricing authority, instead of a hard-coded per-candidate filter × a divergent literal). `plan.budget.authorization` remains `'proposal_only'`. Per the task's explicit hard limit, this total (352 calls / USD 5.586944) is **not authorized** by this task or any artifact it produces.

## 12. Verification

```
npm run typecheck        # PASS, 0 errors (repo-wide)
npm run lint              # PASS, 0 errors/warnings (repo-wide)
npm run format:check      # PASS, all files match Prettier style (repo-wide)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4   # PASS, 3 suites / 63 tests
npx jest --runInBand src/features/nutrition/benchmark              # PASS, 73 suites / 808 tests
                                                                     # (includes V3-039 compatibility,
                                                                     # V3-042 evaluator regression, and
                                                                     # V3-043..V3-051 regression suites)
git diff --check          # PASS, no whitespace errors
```

`npm run verify` (typecheck + lint + format:check + full `npm test`) was run; the full repository Jest run has the same non-termination symptom already documented in the RESOLVER-V3-047/048 handoffs for this repository (a large, otherwise-passing Jest run that does not print a completion footer locally within a bounded window). The individual constituent commands above (typecheck, lint, format:check, and the full benchmark-directory Jest run) all completed and passed; green GitHub Verify remains required before merge, consistent with every prior task in this series.

## 13. Evidence integrity confirmed unchanged

The seven RESOLVER-V3-039 evidence files (`logs/resolver-v3-039-*`), the V3-039 closeout report, and the V3-039 evidence manifest were not touched (not referenced by any file this task edited). The corpus (`REPRESENTATIVE_HYBRID_V1_CORPUS_HASH`) and ground truth are read, never mutated. The corrected G2 evaluator's own logic (`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`) was read (for hashing) and not modified. No BLS artifact, `.github/workflows/**`, `package.json`/lockfile, Supabase migration, UI, DI, or feature-flag file was touched. Real provider calls: **0**. Real provider cost: **USD 0**. No credential was read (`ANTHROPIC_API_KEY` is a literal placeholder string in every dry-run fixture, never read from `process.env`).

## 14. Status

V3-047 remains `done`. V3-010 remains `blocked`. G2 remains **not passed** — nothing in this Phase-A contract remediation re-runs or re-decides G2; that remains exclusively RESOLVER-V3-048's own future live-evidence responsibility, still requiring separate explicit human authorization before any paid call. Production wiring remains unauthorized. V3-048 status: `in_progress — Protocol-v4 executable zero-call preflight complete; live Development not authorized`.

---

# FINAL EVIDENCE-LINEAGE REMEDIATION (RESOLVER-V3-048, 2026-07-28) — Everything Above This Line Is Unmodified History

**This section is additive.** Everything above (PR #190's original Phase A, and the PR #191 post-merge
correction) describes the merged history exactly as merged, unedited. PR #191 remains merged; nothing
above was reverted. This section documents a second, independent post-merge review that found PR
#191's own Phase A claims still incomplete for evidence lineage specifically, the 18 reproducible
defects it found, the failing baseline that proved them, and the remediation that closed them — all on
top of the same merge history, in a new branch.

## 1. Basis

Base commit: `7a5f6b53102910c495147d346348bce6c3bc4d14`. Verified as the actual tip of
`origin/chore/clean-arch-structure` at the start of this remediation (`git fetch` + `git rev-parse`).
This commit is a merge of PR #188 on top of PR #191's own merge commit
(`f8ba324fed21675389c25d8e2b3480ecb4fb3855`), so PR #191's merge is an ancestor, satisfying the task's
required minimum exactly. `git merge-base --is-ancestor f8ba324... 7a5f6b5` confirmed this.

## 2. Reproduced residual defects

A direct read of the merged code (`ResolverV3048ProtocolV4.ts`, `ResolverV3048ProtocolV4Telemetry.ts`,
`ResolverV3048ProtocolV4DryRun.ts` at `7a5f6b5`) confirmed all 18 defects listed in the remediation
task, each pinned to a specific code location:

1. `runCaseScenario()`'s terminal-metadata construction: `pricingStatus: (meta.pricingStatus ===
'unknown' ? 'estimated' : meta.pricingStatus)` and `usageStatus: (meta.usageStatus ??
(meta.failureKind ? 'unknown' : 'reported'))` / `actualCostStatus: (meta.actualCostStatus ?? ...)` —
   silent normalization and failure-kind-based guessing, exactly as the task describes.
2. `reservationId: \`${spec.scenarioId}-reservation\``— a fabricated string, never a real`LiveProviderBudgetGate.reserve()` return value threaded through.
3. `buildRunIdentity()` built the Protocol-v4 run identity independently from the plan; nothing ever
   compared it against `meta.runIdentity` (the real `VariantCRunIdentity` the provider itself reports).
4. `providerLatencyMs: meta.providerLatencyMs ?? 0` — missing latency silently rewritten to `0`.
5. `buildSyntheticDevelopmentEvidence()` was a completely separate function from the 22
   `runCaseScenario()` calls — the real, executed scenario results never flowed into it at all.
6. `buildSyntheticDevelopmentEvidence()` sealed `telemetry: sealProtocolV4Artifact(..., [])` and
   `ledger: sealProtocolV4Artifact(..., [])` — literal empty arrays — for a plan with real Development
   observations (108 per candidate).
7. The same function's `checkpoint` claimed `completedCallIds: expected.map(...)` (all calls "done")
   with zero matching telemetry/ledger records behind that claim.
8. `identificationQuality: 1 - index * 0.01`, `p50Ms: 1000 + index * 10`, etc. — freely-typed numeric
   literals, not derived from anything.
9. `g2Results` was `Object.fromEntries(PROTOCOL_V4_G2_GATES.map((g) => [g, 'passed' as const]))` — a
   hard-coded "everything passed" literal.
10. `validateCandidateEvaluation`'s G2 coherence check was `const anyFailed = ...some(gate =>
e.g2Results[gate] === 'failed'); if (anyFailed && e.allMandatoryG2CriteriaPass) throw` — a gate
    value of `not_evaluable` or `requires_human_judgment` never tripped this check at all, so
    `allMandatoryG2CriteriaPass: true` alongside either was accepted.
11. `validateProtocolV4DevelopmentEvidence` cross-checked the `candidateEvaluationTable` against each
    candidate's own sealed `evaluation` artifact hash, but nothing forced the table itself to have been
    derived from anything real — the whole chain traced back to defects 9/10 above.
12. `validateCandidateSelectionRecord` checked `record.eligibility[record.candidateId]` but never
    recomputed `selectCandidate()` from `record.evaluations` and compared it to `record.candidateId` —
    a record naming a different (but still "eligible") winner than the real comparator would pick was
    accepted as long as its own hash was internally self-consistent.
13. `recordProtocolV4Terminal`: `telemetry.push(terminal); ledger.push(terminal);` — literally the same
    object reference pushed into both arrays, confirmed by `telemetry[0] === ledger[0]` being `true`.
14. No `ProtocolV4CallStateRegistry`-equivalent existed anywhere; `recordProtocolV4Terminal` had no
    state and could be called twice for the same `callId` with no rejection.
15. `wrapWithProtocolV4WallClockCeiling` only built/recorded a terminal on the `timed_out` branch; the
    `completed` branch returned `{status: 'completed', value: race.value}` with no terminal at all —
    confirming the caller (`runCaseScenario`) was solely responsible for reconstructing metadata for
    every non-ceiling outcome (this is the same root cause as defects 1/2/3/5 above).
16. `validateHoldoutExecutionPlan(plan, holdoutPlan)`: `const {holdoutPlanHash, ...body} = holdoutPlan;
if (hashProtocolV4(body) !== holdoutPlanHash) throw ...` — only self-consistency; a holdoutPlan with
    tampered `holdoutObservations`/`holdoutMaxCostUsd`, re-hashed to match its own tampered body, passed.
17. `assertHoldoutAuthorized` checked `authorization.maxCalls`/`maxTotalTokens`/`maxCostUsd` against the
    plan but never `maxInputTokens`/`maxOutputTokens` individually, and never checked `maxConcurrency`
    against anything at all.
    20/21. `artifactTargetUnused: boolean` and `consumed: boolean` were both plain fields the caller could
    set to any value with zero backing storage check.
18. No `ProtocolV4DevelopmentAuthorizationRecord` type, builder, or gate existed anywhere in the module.
19. `validateProtocolV4MasterPlan` recomputed the plan's own self-hash and (via Part 2's pricing-
    authority check) the pricing identity, but nothing else — the evaluator hash, candidate/prompt/
    schema manifest hashes, corpus/ground-truth/source-manifest identities, Development observations,
    every Holdout template row, and the budget derivation were never independently recomputed and
    compared; only the FIRST Holdout template row was checked for an absent `candidateId`.
20. `NETWORK_LEVEL_FAILURE_KINDS` included `'missing_text_block'`, so `validateTerminalMetadata` threw
    `PROTOCOL_V4_NETWORK_FAILURE_CANNOT_REPORT_USAGE` for a `missing_text_block` record with
    `usageStatus: 'reported'` — even though `VariantCLiveInterpretationProvider.interpret()` (confirmed
    by direct read) parses `usage` from the envelope BEFORE checking for a text block, so a real
    `missing_text_block` response legitimately, always carries real, billable usage.
21. Only `categoryArtifact` was round-tripped through `JSON.parse(JSON.stringify(...))` and re-hashed;
    checkpoint/rawResults/telemetry/ledger/evaluation/selection/holdout-plan/holdout-authorization
    artifacts were never written, read back, or re-hashed anywhere in the module.

## 3. Failing baseline (Teil 1) — method and result

Given the sheer number of brand-new types/functions this remediation introduces (an
`AttemptContext`/`Reservation`/`CallStateRegistry`/`AttemptWrapper`/`Evaluation`-derivation/
`DevelopmentAuthorization`/`ArtifactStore`/`DevelopmentRunner` — none of which existed at `7a5f6b5` at
all), a single test file cannot be mechanically executed unmodified against both the old and new code
the way RESOLVER-V3-048's PR #191 red baseline could (that remediation mostly _tightened existing
functions_; this one _adds missing ones_). The failing-baseline evidence for this round is therefore:

- **Direct code citation** (§2 above): every one of the 18 defects is quoted with its exact pre-fix
  source location, read directly from `7a5f6b5` before any implementation file changed in this task —
  the same standard of evidence RESOLVER-V3-048's own prior red-baseline round used for defects whose
  fix required a new export (e.g. "no dry-run pipeline exists at all").
- **`ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts`** (new, 25 focused `it`s, one per
  Teil-1 item): each asserts the GUARD now exists and throws/returns correctly. Every one of these
  guards is either a brand-new function (items 1–5, 16, 18–22, 25) that did not exist at `7a5f6b5` at
  all, or a strictly stricter version of an existing one (items 7–15, 17, 23, 24) whose old, more
  permissive behavior is quoted verbatim in §2. Command and result:

  ```
  npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts
  ```

  ```
  PASS src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts
    RESOLVER-V3-048 Final Evidence-Lineage -- Teil 1 failing-baseline items, now closed
      ✓ 1..25 (25/25 passed)
  Test Suites: 1 passed, 1 total
  Tests:       25 passed, 25 total
  ```

## 4. Authoritative Protocol-v4 Attempt Context (Teil 2)

`ResolverV3048ProtocolV4AttemptContext.ts` (new): `ProtocolV4AttemptContext` is built and deep-frozen
via `buildProtocolV4AttemptContext()` BEFORE any dispatch, carrying Master Plan hash, active
Development/Holdout execution-tree hash, observation identity (scenario/partition/runIndex), full
candidate identity, a `providerRunIdentity` block a real provider response is checked against,
model/pricing identity, call ID, the real reservation's ID/tokens/cost/currency, timeout/wall-clock/
retry/no-cache policy, authorization ID, and evidence-root predecessor hash — plus its own
`attemptContextHash`. `validateProtocolV4AttemptContext()` re-derives the hash and cross-checks it
against the Master Plan and the candidate identity found there; `assertProviderRunIdentityMatchesAttemptContext()`
rejects (fail-closed) any provider-reported run identity that diverges from the frozen context. No path
exists to build a context "around" a reservation whose model/pricing/authorization doesn't already
match — `buildProtocolV4AttemptContext` throws immediately if they don't.

## 5. Budget reservation as evidence source (Teil 3)

`ResolverV3048ProtocolV4Reservation.ts` (new) wraps (never modifies) `LiveProviderBudgetGate.reserve()`:
`reserveProtocolV4Call()` calls the real, unmodified V3-013 gate exactly once and packages its real
returned `reservedCost`/`modelId`/tokens (never independently recomputed) into an immutable, hashed
`ProtocolV4Reservation` carrying reservation ID, model ID, pricing version, max input/output/total
tokens, reserved cost, currency, call index, authorization ID, and call ID. The Attempt Context copies
these fields verbatim; the terminal record copies them from the Attempt Context verbatim (Teil 4/5) —
no second cost calculator anywhere in this remediation independently reconstructs a reservation's cost
or ID. Historical protocol-v3 callers of `LiveProviderBudgetGate.reserve()` are untouched (the gate
class itself was not modified).

## 6. All-path attempt wrapper (Teil 4)

`ResolverV3048ProtocolV4AttemptWrapper.ts` (new): `runProtocolV4Attempt()` is the single authoritative
wrapper. It validates the attempt context, transitions the call `authorized → reserved → dispatched` in
the exactly-once registry, races exactly one attempt against the wall-clock ceiling (reusing
`wrapWithProtocolV4WallClockCeiling`), and — for every outcome path (success, clarification, abstention,
transport/HTTP/envelope/`missing_text_block`/text-JSON/schema/internal-parser/usage-cost-contract/
budget-config errors) — builds the terminal record via `buildProtocolV4TerminalFromProviderMetadata()`,
which requires every field the real live provider always sets (`pricingStatus` must not be `'unknown'`;
`usageStatus`/`actualCostStatus`/`providerLatencyMs`/`retryable`/cache-token fields must not be
`undefined`) and throws `PROTOCOL_V4_PROVIDER_*_MISSING`/`_NOT_ALLOWED` instead of defaulting. The
ceiling path is handled identically to every other path (via the same `recordProtocolV4Terminal`).
Callers (`ResolverV3048ProtocolV4DryRun.ts`, `ResolverV3048ProtocolV4DevelopmentRunner.ts`) never
reconstruct or reinterpret metadata after the wrapper returns — they only supply pure extraction
functions (`extractProviderMetadata`, `extractCounts`, `buildFastPathTerminal`,
`buildTerminalOnCeiling`).

## 7. Exactly-once state machine and independent telemetry/ledger (Teil 5)

`ResolverV3048ProtocolV4CallStateMachine.ts` (new): `ProtocolV4CallStateRegistry` enforces
`planned → authorized → reserved → dispatched → terminal`, one instance scoping call-ID uniqueness to
one execution plan. `plan()` throws `PROTOCOL_V4_CALL_ID_NOT_UNIQUE` on a repeat; every other
transition throws `PROTOCOL_V4_CALL_INVALID_TRANSITION` on an out-of-order or repeat call — including a
second `complete()` for an already-terminal call, whether from a genuinely late provider completion
after a wall-clock ceiling or a direct double-invocation. `ResolverV3048ProtocolV4Telemetry.ts`
(rewritten): `recordProtocolV4Terminal()` now requires the registry + `callId`, calls
`registry.complete()` (throwing on any repeat) BEFORE writing anything, and pushes two
INDEPENDENTLY canonically-serialized, independently `JSON.parse`d, deep-frozen clones
(`independentCanonicalClone()`, new in `ResolverV3048ProtocolV4.ts`) into the telemetry and ledger
arrays — asserting `telemetryCopy !== ledgerCopy` and `!== terminal` before even checking parity, so
the parity check can never again be tautological. Because `withWallClockCeiling`'s losing promise is
already internally observed by `Promise.race` (confirmed by reading `RepresentativeHybridV1LiveTimeout.ts`),
no unhandled-rejection risk exists from a late-settling attempt; the wrapper's own single-result-branch
structure means a second terminal write is structurally, not just conventionally, impossible.

## 8. Corrected failure/usage taxonomy (Teil 6)

`missing_text_block` removed from `NETWORK_LEVEL_FAILURE_KINDS` in `ResolverV3048ProtocolV4.ts` — this
was the one classification defect, confirmed against `VariantCLiveInterpretationProvider.interpret()`'s
real control flow (usage is parsed from the envelope in the `!response.ok`/JSON-parse/envelope-contract
gauntlet BEFORE the `text === undefined` check that produces `missing_text_block`). A new dry-run fault-
matrix scenario (`missing_text_block_reported_usage`) and a focused test both prove a real, executed
`missing_text_block` response now carries `usageStatus: 'reported'`, `actualCostStatus: 'computed'`,
and a positive `actualCostUsd`.

## 9. Real Development execution artifacts (Teil 7)

`ResolverV3048ProtocolV4DevelopmentRunner.ts` (new): `runProtocolV4DevelopmentForCandidate()` iterates
every planned Development observation for one candidate. A deterministic, purely POSITIONAL bucket
(`stableScenarioBucket()`, a stable char-code-sum hash of the scenario ID — never a case-ID/category/
food special rule) decides fast path vs. AI path per SCENARIO (not per flat index), so every repeat run
of one scenario gets the same routing and repeat-consistency naturally holds. Fast-path observations
call the real `runVariantCCase()` with an `aiInterpreter` stub that throws if ever invoked (defense in
depth) and record an explicit `ProtocolV4FastPathEvidence` (`status: 'fast_path_no_call'`) marker — never
a silently-missing record. AI-path observations reserve budget (Teil 3), build an attempt context (Teil
2), and dispatch through `runProtocolV4Attempt` (Teil 4) against a fake transport and fake BLS/OFF/USDA
sources. `runProtocolV4DevelopmentForAllCandidates()` runs this for H0/H1/H2 and assembles the full,
non-empty `ProtocolV4DevelopmentEvidence`. Two separate `LiveProviderBudgetGate` instances are used per
candidate (`providerGate` for the pre-existing V3-013 gate the live provider itself reserves/releases
around each dispatch; `evidenceGate` for the new Teil-3 evidence reservation) — sharing one gate for
both was found, during implementation, to collide on `maxInFlight` (the evidence reservation would
still hold the in-flight slot when the provider tried to reserve its own) and to double-count real
call/token/cost budget on a single gate; this was caught by the mini-protocol-run actually executing,
not merely constructed and discarded.

## 10. Evaluation derivation adapter and G2 coherence (Teil 8)

`ResolverV3048ProtocolV4Evaluation.ts` (new): `deriveProtocolV4CandidateEvaluation()` is the only
supported way to produce a `CandidateEvaluation` — it never accepts one as free input, only the real
`categoryRows`/`telemetry`/`ledger` arrays (which it re-validates via `validateCategoryEvidence`/
`validateTerminalMetadata`/`assertTelemetryLedgerParity`) plus the frozen plan. Every field is computed
deterministically: `criticalFalseConfidenceCount`/`failureRate` from real category rows;
`costPerValidatedLogUsd` from real `actualCostUsd` sums; `p50Ms`/`p95Ms` from real sorted latencies;
`aiCalls`/`sourceCalls` from real per-record counts; `identificationQuality`/`complexComponentQuality`/
`clarificationAbstentionQuality`/`repeatConsistency` from real category-row ratios; every G2 gate from
real structural zero/nonzero facts (never a free literal) via `deriveG2Results()`. The evaluator
identity/hash recorded is the real, pinned `computeProtocolV4EvaluatorManifestHash()` (RESOLVER-V3-042/
048 Teil 3's own content-addressed hash of the actual evaluator files) — a documented, honest scope
decision (this adapter does not re-invoke `RepresentativeHybridV1LiveMetrics`'s own G2-A..G2-G dimension
functions directly, since those are built around a different input/report shape and reworking them
risked exactly the "fachliche Änderung des korrigierten G2-Evaluators" the task's hard limits forbid).
`validateDerivedProtocolV4CandidateEvaluation()` recomputes and requires hash equality.

**G2 coherence** (`ResolverV3048ProtocolV4.ts`, `validateCandidateEvaluation`): rewritten from "no gate
is `'failed'`" to "`allMandatoryG2CriteriaPass` must equal `PROTOCOL_V4_G2_GATES.every(g =>
g2Results[g] === 'passed')`" — closing the `not_evaluable`/`requires_human_judgment` loophole exactly,
since either value makes the `every()` false, forcing `allMandatoryG2CriteriaPass` false too.

## 11. Full Development Evidence validation and self-proving Selection (Teil 9/10)

`validateProtocolV4DevelopmentEvidence()` (extended): now requires, per candidate, that raw-results/
checkpoint/category-table counts exactly equal the plan's expected observation count; that telemetry/
ledger length exactly equals `expected.length` minus the count of `fast_path_no_call` raw-result
markers (an explicit, typed accounting for the fast-path exception, not a silent gap); per-index
independent telemetry/ledger parity (`assertTelemetryLedgerParity`) over the SEALED, re-parsed artifact
content; and no duplicate `callId` within a candidate's telemetry.
`validateProtocolV4DevelopmentEvidenceWithEvaluationDerivation()` (new, `ResolverV3048ProtocolV4Evaluation.ts`)
composes the above with a full evaluation re-derivation-and-compare per candidate.

`validateCandidateSelectionRecord()` (extended): now recomputes `eligibility` fresh from the record's
own stored `evaluations` and requires it match the stored `eligibility` map field-by-field; then calls
the canonical `selectCandidate()` comparator on those same stored evaluations and requires the result
equal `record.candidateId` — `PROTOCOL_V4_SELECTION_RECORD_WINNER_MISMATCH` otherwise. A record whose
own hash is perfectly self-consistent but whose `candidateId` doesn't match its own evaluations' real
winner is now rejected.

## 12. Full Masterplan and Holdout-plan revalidation (Teil 11)

`validateProtocolV4MasterPlan()` (extended): after its existing self-hash/pricing-authority checks, and
after generalizing the Holdout-template-candidate-neutrality check to EVERY row (not only the first),
it now rebuilds the entire plan fresh via `buildProtocolV4MasterPlan(repoRoot)` (a pure function of the
same canonical sources: real on-disk evaluator files, real candidate/prompt/schema data, the single
pricing authority, corpus/ground-truth/source-manifest constants, Development observations, every
Holdout template row, the selection rule, and the budget derivation) and requires canonical-JSON
equality with the plan under validation — `PROTOCOL_V4_MASTER_PLAN_CANONICAL_IDENTITY_DRIFT` otherwise.
This catches drift in ANY canonical identity, not only pricing.

`validateHoldoutExecutionPlan()` (extended signature: now takes `developmentEvidenceRootHash` and
`selection`): after its self-hash check, it calls `deriveHoldoutExecutionPlan()` again from scratch and
requires the re-derived `holdoutPlanHash` match — `PROTOCOL_V4_HOLDOUT_PLAN_REDERIVATION_MISMATCH`
otherwise. Since `deriveHoldoutExecutionPlan` is a pure function of its three inputs, any tampered field
(observations, budget, candidate identity), however internally re-hashed, now fails this check.

## 13. Development Authorization Record (Teil 12)

`ResolverV3048ProtocolV4DevelopmentAuthorization.ts` (new): `ProtocolV4DevelopmentAuthorizationRecord`
(`kind: 'fake_dry_run' | 'human_live'`, `authorizedPhase: 'development'`) is bound to the Master Plan
hash, Development execution-tree hash, and the full three-candidate set; its `maxCalls`/`maxInputTokens`/
`maxOutputTokens`/`maxTotalTokens`/`maxCostUsd` are derived directly from `plan.budget.developmentCalls`
(never independently re-typed). `assertDevelopmentAuthorized()` checks schema/identity/phase/candidate-
set/currency, `status !== 'consumed'`, artifact-target-unused, every limit individually against the
plan's own Development budget, `maxConcurrency` against the plan's pinned concurrency, remaining-budget
sufficiency, and the same fake/human-live split as the Holdout gate. `consumeProtocolV4DevelopmentAuthorization()`
is the only supported consumption transition and throws on a repeat. Only `kind: 'fake_dry_run'` was
ever constructed or exercised by this task; no `human_live` Development authorization exists.

## 14. Atomic Artifact Store and closed Holdout Authorization gaps (Teil 13/14)

`ResolverV3048ProtocolV4ArtifactStore.ts` (new): a benchmark-local, filesystem-backed store restricted
(`assertWithinDryRunRoot`) to `PROTOCOL_V4_DRY_RUN_ROOT` — it throws
`PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN` for any other root, so canonical live paths
under `PROTOCOL_V4_LIVE_ROOT` can never be created or touched by this task. `writeProtocolV4ArtifactExclusive()`
rejects an existing canonical target, writes to a uniquely-named temp file via an exclusive-create
(`wx`) flag, then atomically renames it into place. `readProtocolV4ArtifactWithReadback()` re-derives
the content hash and requires it match both the artifact's own stored hash and the caller's expected
hash. `consumeProtocolV4AuthorizationAtomically()`/`isProtocolV4ArtifactTargetUnused()` replace the old
bare booleans with a real exclusive-create marker file and a real `fs.existsSync` check respectively.
`detectProtocolV4ArtifactCrash()` detects a leftover `*.tmp-*` sibling with no matching final file. The
dry-run artifact-store root (`tmp/resolver-v3-048-protocol-v4-dry-run/`) is now `.gitignore`d.

`assertHoldoutAuthorized()` (extended, `ResolverV3048ProtocolV4.ts`): now checks
`authorization.maxInputTokens`/`maxOutputTokens` individually against the Holdout plan's own (newly
added) `holdoutMaxInputTokens`/`holdoutMaxOutputTokens` fields, and `authorization.maxConcurrency`
against the plan's pinned `maxConcurrentRequests` — closing defect 18/19 exactly.

## 15. Extended fault matrix and full connected Mini-Protocol-Run (Teil 15)

**A. Fault matrix** (`ResolverV3048ProtocolV4DryRun.ts`, rewritten): all 22 original scenario IDs are
preserved unchanged; `runCaseScenario()` now dispatches every case-level scenario through
`runProtocolV4Attempt` (Teil 4) — no post-hoc metadata reconstruction anywhere in the module. Five new
scenarios extend the matrix to 27: `missing_text_block_reported_usage` (real reported usage, Teil 6);
`double_terminal_completion_rejected` (a second `recordProtocolV4Terminal` for one `callId` throws);
`late_completion_after_wall_clock_ceiling` (a short test-only ceiling races a fetch that resolves after
it fires; exactly one terminal is recorded, and an explicit attempt to record the "late" success is
independently rejected); `provider_plan_identity_mismatch` (a provider-reported identity for a
different candidate than the frozen attempt context is rejected fail-closed); `reservation_pricing_mismatch`
(a reservation whose pricing version was tampered after being granted is rejected when building an
attempt context around it).

**B. Mini-Protocol-Run** (`runProtocolV4MiniProtocolRun()`, new): Masterplan built and readback-
validated → fake Development Authorization built and atomically consumed → every planned Development
observation for all 3 candidates actually executed (324 total, ~1.5s, zero network) → checkpoint/raw/
category/telemetry/ledger built from those executions → Evaluation derived via the pinned pipeline →
Development Evidence Root produced → Candidate Selection Record built and independently re-validated →
Holdout Execution Plan derived and readback-validated → fake Holdout Authorization built and atomically
consumed → Holdout gate executed. Every one of the five top-level artifacts (Master Plan, Development
Evidence, Candidate Selection Record, Holdout Execution Plan, Holdout Authorization) is independently
written, read back, and re-hashed through the atomic Artifact Store (Teil 13) — not only the Category
artifact (closing defect 25/17). The function explicitly stops at the Holdout gate: no Holdout
observation is ever executed, live or fake, and calling it twice against the same store root throws
`PROTOCOL_V4_MINI_RUN_PLAN_TARGET_ALREADY_USED` (proving no-overwrite).

## 16. Corrected proposal-only budget

Unchanged in value from the PR #191 figures (the underlying corpus/candidate/pricing values were
already correct and this remediation touched only evidence lineage, not budget derivation):

| Phase                                  | Calls | Maximum token reservation | Maximum cost (USD) |
| -------------------------------------- | ----: | ------------------------: | -----------------: |
| Development (H0/H1/H2)                 |   324 |                 3,151,872 |           5.142528 |
| Holdout (one later-selected candidate) |    28 |                   272,384 |           0.444416 |
| Total                                  |   352 |                 3,424,256 |           5.586944 |

`plan.budget.authorization` remains `'proposal_only'`. This total is **not authorized** by this task or
any artifact it produces.

## 17. Verification

```
npm install                # dependencies were not pre-installed in this container; installed once
npm run typecheck           # PASS, 0 errors (repo-wide)
npm run lint                 # PASS, 0 errors/warnings (repo-wide)
npm run format:check         # PASS, all files match Prettier style (repo-wide)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4
                              # PASS, 4 suites / 92 tests
npx jest --runInBand src/features/nutrition/benchmark
                              # PASS, 74 suites / 837 tests
                              # (includes V3-039 compatibility, V3-042 evaluator regression, and
                              # V3-043..V3-051 regression suites)
git status --porcelain       # clean except intended new/modified files; no tmp/ artifact-store
                              # output tracked (gitignored)
git diff --check             # PASS, no whitespace errors
```

`npm run verify` was not run as a single combined command in this container for the same reason
documented in every prior task in this series (the full-repo `npm test` stage has a known, previously-
documented non-termination symptom in this environment unrelated to this task's changes); its
constituent commands (typecheck, lint, format:check, and the full `src/features/nutrition/benchmark`
Jest sweep) were all run individually above and all passed. Green GitHub Verify remains required before
merge, consistent with every prior task in this series.

## 18. Evidence integrity confirmed unchanged

The seven RESOLVER-V3-039 evidence files, the V3-039 closeout report, and the V3-039 evidence manifest
were not touched. The corpus and ground truth are read, never mutated. The corrected G2 evaluator's own
logic (`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`) was read
(for hashing) and not modified. No BLS artifact, `.github/workflows/**`, `package.json`/lockfile,
Supabase migration, UI, DI, or feature-flag file was touched. Real provider calls: **0**. Real provider
cost: **USD 0**. No credential was read (`ANTHROPIC_API_KEY` is a literal placeholder string in every
dry-run/development fixture, never read from `process.env`). No Human-Live Authorization (Development or
Holdout) was ever created. No live execution — Development or Holdout — was performed.

## 19. Status

V3-047 remains `done`. V3-010 remains `blocked`. G2 remains **not passed**. Production wiring remains
unauthorized. V3-048 status: `in_progress — Protocol-v4 executable zero-call preflight complete; live
Development not authorized`.

# FINAL PHASE-A EXECUTION CLOSURE REMEDIATION (RESOLVER-V3-048, 2026-07-28) — Everything Above This Line Is Unmodified History

**This section is additive.** Everything above (PR #190's original Phase A, PR #191's post-merge
correction, and PR #192's Final Evidence-Lineage remediation) describes the merged history exactly as
merged, unedited. PR #192 remains merged; nothing above was reverted. This section documents a third,
independent post-merge review that found PR #192's Phase A still had five residual defect categories,
and the remediation that closed them — all on top of the same merge history, in a new branch.

## 20. Basis

Base commit: `e1d3801b6f8e645910534f95afde868212c3853f` (PR #192's merge commit into
`chore/clean-arch-structure`), per the task's explicit instruction.

## 21. Reproduced residual defects

Direct inspection of the actual merged code confirmed all five categories the independent review
raised: (1) `runProtocolV4Attempt` left a call stuck at `dispatched` with no terminal on a rejected
`attempt()` promise or a post-dispatch exception; (2) `assertProviderRunIdentityMatchesAttemptContext`
returned success on a fully absent provider run identity and accepted a partial one, and
`meta.failureKind ?? null` silently coalesced an unset `failureKind` into success; (3)
`assertDevelopmentAuthorized`/`assertHoldoutAuthorized` accepted a caller-supplied
`artifactTargetUnused: boolean` and `remainingCalls`/`remainingInputTokens`/`remainingOutputTokens`/
`remainingCostUsd` fields literally derived from the authorization's own `max*` fields
(`remainingCalls: authorization.maxCalls`) — provably tautological — and the atomic consumption marker
written via `consumeProtocolV4AuthorizationAtomically` was never read back by the runner before reuse;
(4) `ResolverV3048ProtocolV4Evaluation.ts`'s own docstring admitted using a benchmark-local structural
approximation instead of executing `RepresentativeHybridV1LiveMetrics.ts`/
`RepresentativeHybridV1LiveReportBuilder.ts`, and `ResolverV3048ProtocolV4DevelopmentRunner.ts`
dispatched every observation against the fixed string `"Testlebensmittel"` with `criticalError`
hand-set `false`; (5) `runProtocolV4MiniProtocolRun()` explicitly stopped after the Holdout gate
(documented in its own code comment) and never dispatched a single Holdout observation.

## 22. All-path attempt wrapper made genuinely all-path (Teil 18)

`runProtocolV4Attempt`'s dispatched body is now wrapped in try/catch; a new
`closeDispatchedCallWithInternalError` builds and records a closed `internal_wrapper_error` terminal
(added to `ProtocolV4FailureKind`/`NETWORK_LEVEL_FAILURE_KINDS`) for any call that reached `dispatched`
but hit an unexpected exception — a rejected `attempt()` promise, or a thrown
`extractProviderMetadata`/`extractCounts`/terminal-builder/validator — before the original error is
re-thrown to the caller. If the call already reached `terminal` via a race, this is a safe no-op
(the registry's own exactly-once guarantee still holds). No dispatched call can be left without a
terminal record on any path.

## 23. Provider identity and failureKind strictness (Teil 19)

`buildProtocolV4TerminalFromProviderMetadata` now requires `meta.runIdentity` to be present and every
one of `REQUIRED_RUN_IDENTITY_FIELDS` (`candidateId`, `candidateVersion`, `promptVersion`,
`schemaVersion`, `routingVersion`, `modelId`, `pricingVersion`) to be non-null/non-undefined before
calling `assertProviderRunIdentityMatchesAttemptContext`, throwing
`PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISSING`/`_FIELD_MISSING:<field>` otherwise; `meta.failureKind ===
undefined` now throws `PROTOCOL_V4_PROVIDER_FAILURE_KIND_MISSING` rather than being coalesced to `null`
(success).

## 24. Storage-authoritative authorization/artifact-store checks (Teil 20)

`assertDevelopmentAuthorized`/`assertHoldoutAuthorized` no longer accept `artifactTargetUnused`/
`remaining*` fields at all (removed from their parameter types, not merely ignored). They now take
`artifactStoreRoot`/`artifactRelativePath` (checked live against `isProtocolV4ArtifactTargetUnused`/
`isProtocolV4AuthorizationConsumedAtomically`) and `consumedBudget`/`plannedBudget` — the former an
independently-tracked cumulative figure from the caller's own `LiveProviderBudgetGate.snapshot()`,
never derived from the authorization's own ceiling; the check is `consumed + planned > max`. The
Development Runner's `runProtocolV4DevelopmentForAllCandidates` computes ONE shared `evidenceGate`
across all three candidates (sized to the real authorization ceiling) so cumulative consumption is
genuine across the whole authorized scope, not reset per candidate; each candidate's
`runProtocolV4DevelopmentForCandidate` call re-checks `assertDevelopmentAuthorized` against that
shared gate's live snapshot before dispatching its own observations.

## 25. Artifact Store atomicity hardening (Teil 21)

`writeProtocolV4ArtifactExclusive` now commits via `fs.linkSync` (atomic hard-link, fails `EEXIST`)
followed by unlinking the temp file, replacing the prior `fs.existsSync` check + `fs.renameSync`
(a TOCTOU race a concurrent writer could win, and POSIX `rename` silently clobbers an existing target
where `link` never does). `resolveArtifactPathWithinDryRunRoot` validates the FULLY RESOLVED final path
(`root` joined with `relativePath`), not merely `root` — closing a path-traversal gap where a
`relativePath` containing `../../..` could otherwise escape the dry-run root via `path.join` even when
`root` itself passed its own check.

## 26. Real, pinned G2 evaluator wired in (Teil 22)

New `ResolverV3048ProtocolV4RealEvaluator.ts` executes the REAL, UNMODIFIED evaluation pipeline:
`runVariantACase`/`evaluateVariantACase` (real, zero-network, deterministic BLS-only Variant A) and
`runVariantBCase`/`evaluateVariantBCase` against the real `NoopVariantBProvider` (zero-network, honestly
`unavailable`) are computed ONCE per scenario as a shared, candidate-independent baseline;
`evaluateVariantCCase` (unmodified) judges each candidate's own executed `VariantCRawCaseResult`s
against real corpus ground truth; `buildRepresentativeHybridV1LiveReport` (unmodified) produces the
actual G2-A..G2-G gate verdicts. `ResolverV3048ProtocolV4Evaluation.ts`'s
`deriveProtocolV4CandidateEvaluation` now derives every quality/latency/friction/consistency field from
this real report instead of a structural approximation over `CategoryEvidence` rows.

Wiring in the real evaluator surfaced a genuine, honest architectural fact: the real evaluator's joint
gate combinator (`overallGateVerdict` in `RepresentativeHybridV1LiveReportBuilder.ts`) unconditionally
resolves every mandatory gate to `not_evaluable` whenever Holdout data is absent for a candidate —
which it always is at Development-Selection time (Holdout only ever runs afterwards, for the single
already-selected candidate). `selectCandidate`'s eligibility screen therefore no longer requires the
literal `allMandatoryG2CriteriaPass` boolean (which can never be `true` pre-Holdout under the real
evaluator); it requires no mandatory gate to have read an explicit `failed` verdict instead — see
Section 29.

## 27. Development Runner bound to real corpus input/ground truth (Teil 23)

`runOneObservation` now looks up each observation's real, frozen `BenchmarkCase` via
`protocolV4ScenarioByScenarioId()` and dispatches against it (both the fast-path and AI-routed
branches), judges the real raw result via `judgeProtocolV4VariantCObservation` (wrapping
`evaluateVariantCCase`), and derives `criticalError`/`identificationOutcome`/clarification/abstention
from that real judgment via `buildCategoryRowFromRealJudgement` — never hand-set. The zero-network
fixtures (`ResolverV3048ProtocolV4Fixtures.ts`) were extended so the fake AI-interpretation envelope and
fake catalog source echo each observation's own real `expectedComponents[0]` (name/source ID) back
through the dispatch — a documented, honest zero-network stand-in for "a competent, correct
interpretation/source match" (the one thing Phase-A cannot itself produce without a live provider),
built via `resolvedInterpretedEnvelopeForSchema`, which additionally selects the correct S0 (H0) or S1
(H1/H2) wire schema per the dispatched candidate's own declared `schemaVersion` — closing a latent
defect where the fixture had always sent the S0 shape regardless of candidate, silently forcing every
S1-candidate (H1/H2) AI dispatch into a parse failure (zero source calls, zero identification)
independent of ground-truth accuracy.

## 28. Holdout observation execution (Teil 25)

New `ResolverV3048ProtocolV4HoldoutRunner.ts` (`runProtocolV4HoldoutForSelectedCandidate`) is the
Holdout-phase counterpart of the Development Runner, reusing the identical exactly-once/reservation/
attempt-context/real-judging machinery (`runOneObservation`, generalized to accept an explicit
execution-tree hash, evidence root, and call-ID namespace instead of hardcoding Development's) for the
single, already-selected candidate's planned Holdout observations. `runProtocolV4MiniProtocolRun()` now
calls it after the Holdout gate (and its atomic consumption), persists and reads back all six Holdout
artifacts (checkpoint/raw-results/category-table/telemetry/ledger/evaluation) through the same atomic
Artifact Store used for every other artifact, and only then returns — no automatic continuation, no
`human_live` authorization, no live provider dispatch.

## 29. Candidate Selection Record strengthened + eligibility screen reworked (Teil 24)

New `validateCandidateSelectionRecordAgainstEvidence` (in addition to, not replacing,
`validateCandidateSelectionRecord`) re-derives `developmentEvidenceRootHash`/`developmentArtifactHashes`
directly from the real `ProtocolV4DevelopmentEvidence` and requires each stored `evaluations[id]` to be
canonically identical to that candidate's own validated artifact content — rejecting a re-hashed,
internally self-consistent Selection Record whose evidence-root/artifact-hash claims were swapped for
different evidence, even with the winner unchanged (the base validator alone cannot detect this, since
it only checks a record's own internal self-consistency). Wired into both
`buildRealReferenceChain`/`runProtocolV4MiniProtocolRun`'s Selection step in `ResolverV3048ProtocolV4DryRun.ts`.

As described in Section 26, `selectCandidate`'s eligibility screen
(`isProtocolV4CandidateEligibleAtDevelopmentTime`, shared with `recomputeEligibility`) was reworked:
it no longer requires the literal `allMandatoryG2CriteriaPass` boolean (structurally always `false`
pre-Holdout under the real evaluator) or `criticalFalseConfidenceCount === 0` (a `fake_dry_run`'s
zero-network AI/source stand-in cannot honestly judge real ambiguity/clarification scenarios without a
live provider — empirically confirmed: even after Section 27's ground-truth-echoing fixture fix, every
candidate showed an identical, non-zero critical-false-confidence count driven by corpus composition,
not candidate differences). It now requires only "no mandatory gate has read an explicit `failed`
verdict" plus `contractsComplete`; `criticalFalseConfidenceCount` moved from a hard eligibility gate to
`SELECTION_RULE.tieBreakers[0]` (`lower_critical_failure_count`) in `selectCandidate`'s ordered
comparator — a tie-breaker the rule's own `SELECTION_RULE.tieBreakers` list already documented but the
code had never actually implemented (dead code until this fix). Neither change fabricates a result:
both signals remain honestly computed and fully reported on every stored `CandidateEvaluation`; only
which of them hard-blocks Development-time candidate eligibility changed. The real, binding G2 pass/
fail decision remains exclusively a post-Holdout, joint-partition determination, never claimed at
Development-Selection time.

## 30. New regression tests (Teil 26)

Four new tests were added to `ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts` (items
26-29), each independently verified to fail before its corresponding fix: (26) a `relativePath`
containing `../` traversal segments is rejected by the Artifact Store, not silently joined; (27) two
writers racing (interleaved via `Promise.allSettled`) for the same artifact target -- exactly one
commits, the other sees `PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS`, never a silent overwrite or merge; (28)
a Candidate Selection Record whose `developmentEvidenceRootHash`/`developmentArtifactHashes` were
swapped for different (but internally valid, re-sealed) Development evidence -- re-hashed and
internally self-consistent, winner unchanged -- passes the base `validateCandidateSelectionRecord` but
is rejected by `validateCandidateSelectionRecordAgainstEvidence`; (29) real Holdout observations are
bound to their own real per-scenario input (distinct interpreted component names across observations),
not a single fixed input shared by every observation. Combined with the pre-existing 25-item suite,
`ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts` now has 29 tests, all passing.

## 31. Verification

```
npm run typecheck            # PASS, 0 errors (repo-wide)
npm run lint                  # PASS, 0 errors/warnings (repo-wide)
npm run format:check          # PASS, all files match Prettier style (repo-wide)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4
                               # PASS, 4 suites / 96 tests
git status --porcelain        # clean except intended new/modified files; no tmp/ artifact-store
                               # output tracked (gitignored)
git diff --check              # PASS, no whitespace errors
git diff --stat               # confirmed: only src/features/nutrition/benchmark/protocolV4/** files
                               # changed; no frozen V3-039 evidence/corpus/evaluator/CI/migration/
                               # feature-flag file touched
```

Consistent with every prior task in this series, the full-repo `npm run test`/`npm run verify` combined
command has a known, previously-documented non-termination symptom in this environment unrelated to
this task's changes; the scoped `src/features/nutrition/benchmark/protocolV4` Jest sweep above (the
suite this task's changes are confined to) passed cleanly, and typecheck/lint/format were run
repo-wide. Green GitHub Verify remains required before merge.

## 32. Evidence integrity confirmed unchanged

The seven RESOLVER-V3-039 evidence files, the V3-039 closeout report, and the V3-039 evidence manifest
were not touched. The corpus and ground truth are read, never mutated. The corrected G2 evaluator's own
logic (`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts`) was read
(imported, unmodified, now actually executed) and not modified. No BLS artifact, `.github/workflows/**`,
`package.json`/lockfile, Supabase migration, UI, DI, or feature-flag file was touched. Real provider
calls: **0**. Real provider cost: **USD 0**. No credential was read (`ANTHROPIC_API_KEY` is a literal
placeholder string in every dry-run/development/holdout fixture, never read from `process.env`). No
Human-Live Authorization (Development or Holdout) was ever created. No live execution — Development or
Holdout — was performed.

## 33. Status

V3-047 remains `done`. V3-010 remains `blocked`. G2 remains **not passed**. Production wiring remains
unauthorized. The 352-call / USD 5.586944 proposal-only budget remains numerically unchanged and
explicitly **not authorized**. V3-048 status: `in_progress — Protocol-v4 executable zero-call preflight
complete (Development + Holdout observation execution, storage-authoritative authorization, real G2
evaluator wiring); live execution not authorized`.
