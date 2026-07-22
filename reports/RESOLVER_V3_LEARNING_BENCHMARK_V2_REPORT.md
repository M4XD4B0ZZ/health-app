# RESOLVER-V3-023 Learning Benchmark V2 Report

**Harness version:** 1.0.0  
**Corpus version:** resolver-learning-benchmark-v2-corpus-1.0.0  
**Corpus hash:** 6daad25ad83d7789391604d3628933f720562399a484026de9d0831039c45255  
**Registry version:** resolver-learning-benchmark-v2-registry-v1  
**Partitions run:** development, holdout  
**Generated at:** 2026-07-22T10:59:31.380Z  
**Benchmark-runtime measured (diagnostic only, not production latency):** 427.46ms

## Executive conclusion

**Task completion:** complete (this run).  
**System verdict:** NOT_PASSED

Task completion and system-passing are explicitly distinct: this benchmark task is complete because the corpus is frozen, development/holdout are separated, the harness executes real learning-system logic, and results are reported honestly -- regardless of whether the system itself passed every invariant. A NOT_PASSED or PARTIALLY_EVALUABLE system verdict does not mean the benchmark failed.

## No-live/no-production statement

Zero network calls were made. No production code path was modified. No feature flag was changed. RESOLVER-V3-010 remains blocked. This benchmark does not activate global knowledge, does not choose a provider, and does not change ranking, source precedence, personal-memory eligibility, or review policy.

## Development results

### Development partition

- Scenario count: 30
- Resolution/decomposition: 16 cases, 8 matched expected behavior, 0 false-confidence
- Category breakdown: {"BRANDED":2,"COMPOSED":2,"HOMEMADE":1,"RESTAURANT":2,"VAGUE":1,"PREPARATION":1,"NEGATION_MODIFIER":1,"UNRELIABLE":1,"SIMPLE":2,"HOUSEHOLD":1,"DACH":2}
- Personal-memory sequences: 3 (3 passed), avoided interpretation calls: 2, invoked: 3
- Global candidate scenarios: 6 (6 passed) -- contributionsRecorded=11, idempotentRetriesSkipped=1, contributionConflicts=0, candidatesCreated=8, reviewOperations=7, retractionsApplied=1, shadowEvaluations=1
- Privacy scenarios: 3 (3 passed), cross-user leak total: 0, global-candidate leak detections: 0
- Economics scenarios: 2 (2 passed), avoided calls: 3, invoked calls: 2, fixture billed cost: $0 (production cost: unknown, DB batch cost: not_evaluable)

## Holdout results

### Holdout partition

- Scenario count: 9
- Resolution/decomposition: 4 cases, 3 matched expected behavior, 0 false-confidence
- Category breakdown: {"BRANDED":1,"UNRELIABLE":1,"COMPOSED":1,"SIMPLE":1}
- Personal-memory sequences: 1 (1 passed), avoided interpretation calls: 1, invoked: 1
- Global candidate scenarios: 2 (2 passed) -- contributionsRecorded=3, idempotentRetriesSkipped=0, contributionConflicts=0, candidatesCreated=3, reviewOperations=1, retractionsApplied=0, shadowEvaluations=1
- Privacy scenarios: 1 (1 passed), cross-user leak total: 0, global-candidate leak detections: 0
- Economics scenarios: 1 (1 passed), avoided calls: 1, invoked calls: 0, fixture billed cost: $0 (production cost: unknown, DB batch cost: not_evaluable)

## Historical 14-case Variant A smoke corpus

Not pooled into any primary metric above. Independently rerun via `node scripts/benchmark-resolver-v3-variant-a.mjs` as a separately labeled historical regression check per binding requirement §5 -- see the canonical `RESOLVER_V3_THREE_VARIANT_COMPARISON_REPORT.md` for its own established evidence-class framing.

## Invariant verdicts

| ID     | Description                                                                                         | Status | Evidence class  | Observed                | Expected                | Reason                                          |
| ------ | --------------------------------------------------------------------------------------------------- | ------ | --------------- | ----------------------- | ----------------------- | ----------------------------------------------- |
| INV-01 | Personal memory remains owner-private (no cross-user read hit).                                     | passed | measured        | 0                       | 0                       | CROSS_USER_LEAK_COUNT                           |
| INV-02 | A P2-confirmed exact repeat may avoid an interpretation call.                                       | passed | measured        | 2                       | >0                      | AVOIDED_CALL_OBSERVED                           |
| INV-03 | A near (non-exact) repeat does not deterministically overgeneralize.                                | passed | measured        | true                    | true                    | NEAR_REPEAT_ELIGIBILITY_MATCH                   |
| INV-04 | Correction/contradiction invalidation weakens or deactivates stale memory.                          | passed | measured        | true                    | true                    | INVALIDATION_TRANSITION_MATCH                   |
| INV-05 | Deletion removes personal-memory effect (no stale avoided-call claim survives).                     | passed | measured        | true                    | true                    | DELETION_READ_MATCH_COUNT                       |
| INV-06 | One user (`independentUserEvidence: not_evaluable`) cannot create a global rule.                    | passed | measured        | blocked_privacy         | blocked_privacy         | REVIEW_SERVICE_RESULT                           |
| INV-07 | Once independent-user evidence is hypothetically satisfied, contradiction still prevents promotion. | failed | fixture-derived | applied                 | not applied (blocked)   | APPROVAL_SUCCEEDED_DESPITE_CONTRADICTION        |
| INV-08 | Shadow evaluation has no production effect (pure, read-only evaluator).                             | passed | measured        | 2                       | no mutation             | EVALUATOR_HAS_NO_WRITE_PORT                     |
| INV-09 | Review is auditable (every decision produces an immutable event).                                   | passed | measured        | 8                       | >0                      | REPOSITORY_APPEND_ONLY_EVENT_LOG                |
| INV-10 | Review decision and candidate/payload state transition remain atomic and idempotent.                | passed | measured        | applied/already_applied | applied/already_applied | IDEMPOTENT_RETRY_MATCH                          |
| INV-11 | Rollback/revocation deactivates the approved payload without deletion.                              | passed | measured        | applied                 | applied                 | ROLLBACK_APPLIED                                |
| INV-12 | Rejected candidates are not endlessly recreated (new evidence preserves rejected status).           | passed | measured        | rejected                | rejected                | REJECTED_STATUS_PRESERVED                       |
| INV-13 | Duplicate/supersession chains resolve safely (self-link/missing-target/cycle fail closed).          | passed | measured        | true                    | true                    | CHAIN_STEP_MATCH                                |
| INV-14 | Retractions recompute affected candidate summaries.                                                 | passed | measured        | 1                       | >0                      | SUMMARY_RECOMPUTED                              |
| INV-15 | Global candidate output contains no user/owner reference.                                           | passed | measured        | false                   | false                   | RECURSIVE_PRIVATE_FIELD_SCAN                    |
| INV-16 | Raw personal text never crosses the global candidate/shadow boundary.                               | passed | measured        | false                   | false                   | STRUCTURAL_PROJECTION_HAS_NO_RAW_TEXT_FIELD     |
| INV-17 | Development and holdout remain separated (registry-enforced, no partition move).                    | passed | measured        | development,holdout     | development,holdout     | REGISTRY_PARTITION_ENFORCEMENT                  |
| INV-18 | No live network/provider call occurs.                                                               | passed | measured        | false                   | false                   | ZERO_NETWORK_CONFIRMED                          |
| INV-19 | No AI-generated nutrient value becomes authoritative.                                               | passed | measured        | false                   | false                   | FIXTURE_PROVIDER_NEVER_WIRED_AS_NUTRIENT_SOURCE |
| INV-20 | RESOLVER-V3-010 remains blocked and unaffected by this benchmark.                                   | passed | measured        | blocked                 | blocked                 | NO_PRODUCTION_WIRING_CHANGE                     |

## Failed invariants (1)

- **INV-07** (Once independent-user evidence is hypothetically satisfied, contradiction still prevents promotion.): observed `applied`, expected `not applied (blocked)` -- supporting scenarios: LBV2-GC-DEV-006

## Not-evaluable invariants (0)

None.

## Discovered defects and required follow-up

- **INV-07 FAILED**: `ResolverKnowledgeReviewService.review()`'s `approve` action checks only `independentUserEvidence` and `localeRestriction`; it never inspects `contradictionStatus`/`contradictingEvidenceCount`. A fixture-only candidate with `independentUserEvidence: independently_confirmed` and nonzero contradiction evidence was approved (`'applied'`). This does not claim any production candidate can currently reach this state (aggregation only ever produces `not_evaluable`), but the review-policy gap is real. Tracked as a new, narrowly scoped remediation task (see `ROADMAP.md`); production review-policy code was NOT changed by this task.

## Residual limitations

- The historical 14-case corpus was not independently re-verified against BLS in this task; new resolution/decomposition cases' expected-behavior labels are best-effort, not independently reproduced evidence -- a real mismatch is recorded honestly, not suppressed.
- A source-controlled holdout partition is not a truly external blind benchmark; it is frozen after the corpus-freeze commit but was authored by the same task that built the harness.
- Shadow-evaluation steps use an ad-hoc single-case internal registry per step, decoupled from the outer Learning Benchmark V2 registry partition of the containing scenario.
- `measured` evidence in this report means measured within this deterministic benchmark run, never production telemetry.
