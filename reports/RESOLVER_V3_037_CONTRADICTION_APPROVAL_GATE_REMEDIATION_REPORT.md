# RESOLVER-V3-037 Contradiction-Aware Review Approval Gate — Remediation Report

## 1. Defect source

`ResolverKnowledgeReviewService.review()`'s `approve` branch checked only
`candidate.evidence.independentUserEvidence` and `request.localeRestriction` before approving a
candidate — it never inspected `candidate.evidence.contradictionStatus` or
`candidate.evidence.contradictingEvidenceCount`. A candidate carrying valid, coherent contradiction
evidence (`contradictionStatus: 'present'`, `contradictingEvidenceCount > 0`) could therefore be
approved as long as `independentUserEvidence === 'independently_confirmed'` and
`localeRestriction !== 'unknown'`.

## 2. RESOLVER-V3-023 report and scenario reference

Discovered by RESOLVER-V3-023's Learning Benchmark V2 harness exercising the real, unmodified
review service through fixture scenario **`LBV2-GC-DEV-006`** (step `contradictionGateApprove`),
recorded as invariant **`INV-07: failed`**, reason code
`APPROVAL_SUCCEEDED_DESPITE_CONTRADICTION`, in the canonical
`reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md` and
`reports/resolver-v3-learning-v2-benchmark.json`. **Those two files, their recorded corpus hash, and
the historical `NOT_PASSED` system verdict are unchanged by this task** — they remain historical
evidence of the pre-fix state and were not rewritten, regenerated, or reinterpreted.

## 3. Pre-fix observed result

For the fixture-only candidate (`independentUserEvidence: 'independently_confirmed'`,
`contradictionStatus: 'present'`, `contradictingEvidenceCount: 1`, otherwise valid locale/risk/
versions/provenance/authorization), the real service returned **`applied`** and created an active
`ApprovedResolverKnowledgePayload`.

## 4. Accepted policy decision

Per the binding task instruction: approval requires exactly `contradictionStatus === 'none'` and
`contradictingEvidenceCount === 0`. A coherent contradictory state
(`contradictionStatus === 'present'`, `contradictingEvidenceCount > 0`) is refused. No numerical
threshold is authorized — a contradiction count of `1` and a count far larger than `1` are refused
identically. A blocked `approve` attempt does **not** automatically transition the candidate to
`needs_more_evidence` or `quarantined`, does not reject it, and performs zero mutation — `approve`,
`needs_more_evidence`, `quarantine`, and `reject` remain distinct, explicit reviewer commands. A
reviewer may subsequently submit a separate, explicit `needs_more_evidence` or `reject` decision with
reason code `CONTRADICTING_EVIDENCE` (both already legal per the pre-existing
`RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS` map — unchanged by this task).

## 5. New result value

`ResolverKnowledgeReviewResult` gains a tenth closed value: **`blocked_contradiction`**
(`src/features/nutrition/domain/models/ResolverKnowledgeReview.ts`). It is distinct from
`blocked_privacy` (privacy/provenance-risk block), `validation_failed` (malformed/incoherent
request or candidate), and `invalid_transition` (illegal lifecycle source-state) — none of those
three is reused. The review contract version remains `resolver-knowledge-review-v1`; this is a
fail-closed behavioral tightening of the existing gate, following the RESOLVER-V3-028 amendment
precedent (adding enforcement without minting a new contract version).

## 6. Exact gate conditions

Within the `approve` branch of `ResolverKnowledgeReviewService.review()`
(`src/features/nutrition/application/knowledge/ResolverKnowledgeReviewService.ts`), the
contradiction check runs **before** the independent-user-evidence check:

| `contradictionStatus` | `contradictingEvidenceCount` | Result                    |
| --------------------- | ---------------------------- | ------------------------- |
| `none`                | `0`                          | contradiction gate passes |
| `present`             | integer `> 0`                | `blocked_contradiction`   |

This applies to every reviewable candidate type (`source-routing-pattern`,
`abstention-policy-signal`, `clarification-policy-signal`, `provenance-gap`,
`negative-source-routing-rule`) with no exemption, regardless of risk, supporting-evidence count, or
independent-user-evidence state (`not_evaluable` or `independently_confirmed`) — confirmed by
dedicated tests for all five types and both independent-user-evidence values. A source-scan test
(`does not invent a numeric contradiction-count threshold in source`) confirms no comparison against
any nonzero contradiction count exists anywhere in the service.

## 7. Inconsistent-evidence behavior

The service does not trust the candidate's static TypeScript type alone (it accepts whatever its
`ResolverKnowledgeReviewCandidateReader.getById` port returns, including an adversarial runtime-cast
object) and validates coherence at runtime for `approve`:

| `contradictionStatus`   | `contradictingEvidenceCount`                                     | Result              |
| ----------------------- | ---------------------------------------------------------------- | ------------------- |
| `none`                  | nonzero                                                          | `validation_failed` |
| `present`               | `0`                                                              | `validation_failed` |
| any other/unknown value | any                                                              | `validation_failed` |
| `none` or `present`     | negative, fractional, `NaN`, `+Infinity`/`-Infinity`, non-number | `validation_failed` |

No incoherent or malformed evidence is silently normalized; every invalid case produces zero
mutation.

## 8. Zero-mutation proof

For `blocked_contradiction` and every `validation_failed` case above:
`ResolverKnowledgeReviewRepository.applyDecision()` is never called (proven directly via a spy in the
exact-defect-reproduction test), and a full store snapshot (candidate fields, candidate lifecycle
events, approved-payload table, review-event table) taken before the call is byte-for-byte identical
to a snapshot taken after — including for the repeated/idempotent case. This mirrors the existing
zero-mutation proof pattern already used for `blocked_unauthorized`, `invalid_transition`, and other
pre-persistence blocks in `ResolverKnowledgeReview.test.ts`.

## 9. Result-ordering rationale

The contradiction check is placed before the independent-user-evidence check (both within the
existing "approval evidence checks" stage, ahead of the stale candidate-version check and lifecycle
validation) so the contradiction gate is genuinely independent — its result never depends on whether
`independentUserEvidence` is `not_evaluable` or `independently_confirmed`. This is verified directly:
contradiction present + `independently_confirmed` → `blocked_contradiction`; contradiction present +
`not_evaluable` → `blocked_contradiction` (both, not `blocked_privacy`).

## 10. No-automatic-lifecycle-transition rationale

`approve`, `reject`, `needs_more_evidence`, and `quarantine` are distinct, explicit reviewer
commands audited separately. Silently converting a blocked `approve` into any of the other three
would create an unaudited decision the reviewer never submitted — the reviewer, having observed
`blocked_contradiction`, must submit their own separate, explicit follow-up decision (already
possible today via the pre-existing `CONTRADICTING_EVIDENCE` reason code on `reject` and
`needs_more_evidence`). This is why the gate is a pure, zero-write refusal rather than a rerouted
outcome.

## 11. Tests executed

Focused suite: `src/features/nutrition/__tests__/ResolverKnowledgeReview.test.ts` — 63 tests (34
pre-existing, unchanged and green; 29 new, covering exact-defect reproduction, independent gate
ordering, zero-threshold behavior, runtime coherence for every invalid/adversarial case, all five
candidate types, non-approve-action preservation, and idempotency of a blocked attempt).

Benchmark suite: all 12 suites under `src/features/nutrition/benchmark/learningV2/` (89 tests) —
green, including two updated assertions in `LearningBenchmarkV2GlobalCandidateAdapter.test.ts` (the
real service now returns `blocked_contradiction` for the exact `LBV2-GC-DEV-006` fixture state
instead of `applied`; the same scenario's `rollback`/`rollbackRetry` steps now correctly return
`invalid_transition` since the candidate was never approved — see §16) and one added test plus one
updated assertion in `runLearningBenchmarkV2.test.ts` (documented in §16 and §12).

## 12. Full verification result

`npm run verify` (typecheck + lint + format:check + test) — **green**. See the handoff/`ROADMAP.md`
entry for the exact suite/test counts from this run. Zero type errors, zero lint errors, zero format
violations.

## 13. Original V3-023 report preservation

`reports/RESOLVER_V3_LEARNING_BENCHMARK_V2_REPORT.md` and
`reports/resolver-v3-learning-v2-benchmark.json` are **byte-for-byte unchanged** by this task. Their
recorded corpus hash, scenario IDs, partitions, holdout inputs/expectations, and system verdict
(`NOT_PASSED`, 19 of 20 invariants passed, `INV-07` failed) remain the historical record of what the
pre-fix service actually did when benchmarked. This report does not claim that historical report is
now `PASSED`, that the whole Learning Benchmark V2 was rerun, or that its full system verdict is
retroactively changed.

## 14. Relationship to RESOLVER-V3-024

`RESOLVER-V3-024` (Representative Learning/Hybrid Gate Re-decision) remains `todo` and was not
started by this task. Its dependency list is updated (see `ROADMAP.md`) to add `RESOLVER-V3-037` —
it is now eligible for separate authorization using both the original RESOLVER-V3-023 benchmark
evidence and this focused RESOLVER-V3-037 remediation evidence.

## 15. No-production-effect statement

`ResolverKnowledgeReviewService` remains unwired: zero production callers exist for this service
(confirmed by search — no caller outside benchmark/test code). No aggregation, ledger, shadow,
personal-memory, resolver, or journal code was touched. No migration, Supabase adapter, RPC,
DI/container registration, package/lockfile, environment file, or UI file was changed. No production
independent-user-evidence policy exists or was implied to exist (RESOLVER-V3-035 remains
`blocked`/`todo`, untouched).

## 16. Residual limitations

- **Historical-fixture consequence for INV-10/INV-11:** the frozen `LBV2-GC-DEV-006` fixture
  (`LearningBenchmarkV2GlobalCandidateCorpus.ts`, untouched by this task) tags its rollback steps
  with `review-rollback` on the _same_ scenario used for the `contradiction-gate` tag, and it is the
  only scenario in the corpus carrying the `review-rollback` tag. Once the contradiction gate
  correctly blocks that scenario's `contradictionGateApprove` step, the candidate is never approved,
  so its later `rollback`/`rollbackRetry` steps (which require a prior active approval) now correctly
  return `invalid_transition` instead of `applied`/`already_applied`. Live-running
  `evaluateLearningBenchmarkV2Invariants` against the real, fixed service therefore now reports
  `INV-10` (review atomicity/idempotency) and `INV-11` (rollback deactivation) as `failed` for this
  fixture, where `INV-07` newly reports `passed`. This is a direct, disclosed, and expected
  consequence of correctly tightening the gate against a fixture that combined both concerns onto one
  scenario — **it is not a regression in rollback/revocation logic itself**, which remains fully
  covered and green via a legitimately approved, contradiction-free candidate in the dedicated
  `ResolverKnowledgeReview.test.ts` unit suite (`revoke_approval and rollback commit payload state
and event atomically without changing candidate.status`). Per the binding task instruction, the
  frozen corpus fixture was not modified to avoid this consequence, and production logic was not
  loosened to let the fixture's contradictory candidate reach `approved` merely so its rollback steps
  would remain reachable. `runLearningBenchmarkV2.test.ts` and
  `LearningBenchmarkV2GlobalCandidateAdapter.test.ts` were updated to assert this real, current
  behavior honestly (see their respective RESOLVER-V3-037-labeled tests/comments) instead of
  continuing to assert the pre-fix `applied` result as current behavior.
- `buildLearningBenchmarkV2Reports.ts`'s "Discovered defects and required follow-up" narrative
  section previously only special-cased an `INV-07` failure and otherwise unconditionally claimed "No
  invariant failures were recorded in this run" — which would have become a false statement now that
  INV-10/INV-11 can fail while INV-07 passes. This narrow reporting bug (exposed by, not preexisting
  before, this task's fix) was corrected to a three-way branch: no failures → the original message;
  `INV-07` specifically failing → the original historical narrative (dead code today, preserved for
  defensive completeness); any other failure → a generic pointer to the "Failed invariants" section
  above. This is the only change to benchmark harness (non-test) code in this task.
- The current aggregation pipeline (RESOLVER-V3-020) only ever produces `not_evaluable`
  `independentUserEvidence`, so no production candidate can reach the `independently_confirmed` state
  this gate also depends on — the contradiction gate itself is exercised only by fixture/benchmark
  data today, exactly as RESOLVER-V3-023 already found. This task does not change that.
- RESOLVER-V3-035 (independent-user evidence aggregation policy decision) remains `blocked`; no
  numeric contradiction threshold is authorized by any accepted decision record, and none was
  invented here.

## Verdict

**INV-07 focused remediation: PASSED.** The real `ResolverKnowledgeReviewService.review()` now
returns `blocked_contradiction` — not `applied` — for the exact `LBV2-GC-DEV-006` fixture state that
RESOLVER-V3-023 used to discover the gap, with zero mutation, regardless of independent-user-evidence
state, candidate type, or contradiction count. This report does not claim the original V3-023
Learning Benchmark V2 report is now `PASSED`, that the full benchmark was rerun, or that any
production resolver effect now exists.
