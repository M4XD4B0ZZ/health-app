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
