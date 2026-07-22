# Zera Resolver Cost and Latency Acceptance Policy 1

**Status:** `accepted` (2026-07-22). **Task:** RESOLVER-V3-040. **Effective for:** every
future controlled live Hybrid-C benchmark run, beginning with RESOLVER-V3-039. This is a
pre-results policy decision: it does not evaluate, amend, or retroactively grade RESOLVER-V3-013.

## 1. Decision and safety boundary

The HealthApp product owner authorizes the following acceptance bounds before any representative
live run is observed. They are product constraints, not claims about current provider capability,
production traffic, or invoice cost. A missing measurement, an unknown price component, a fixture
fallback, or a failed hard limit produces `not_passed`, never an inferred pass.

This policy does not authorize a live provider request, production resolver wiring, a feature flag,
or global-knowledge activation. RESOLVER-V3-039 must still receive its own execution authorization,
pinned configuration, budget guard, and live-mode proof.

## 2. Latency policy

Report end-to-end timings separately for deterministic fast-path, AI-routed, and all-attempts
populations. Use nearest-rank percentiles over complete traces; do not add phase percentiles.
Development and holdout results remain separate.

| Metric                                   |  Acceptance bound | Rule                                                 |
| ---------------------------------------- | ----------------: | ---------------------------------------------------- |
| AI-routed successful p50                 |       <= 3,000 ms | Must pass independently.                             |
| AI-routed all-attempts p95               |       <= 8,000 ms | Includes retries and terminal failures.              |
| Deterministic fast-path all-attempts p95 |         <= 500 ms | Measured independently; it cannot offset AI latency. |
| Per-attempt timeout                      | 10,000 ms maximum | A longer client/provider timeout is disallowed.      |
| Total user-visible retry window          | 12,000 ms maximum | At most one retry after the initial attempt.         |
| Terminal technical-error rate            |             <= 2% | Computed over all attempted AI-routed cases.         |

A run with fewer than 20 AI-routed attempts in a partition is `not_evaluable` for that partition's
p95/error gate; it is not rounded into a pass. The successor corpus must therefore be repeated under
the RESOLVER-V3-039 protocol until each reported partition meets this evidentiary minimum, without
case-specific prompt or corpus edits.

## 3. Cost policy

All cost uses USD, records the date-pinned price schedule and source/database charges, and includes
input/output tokens, fixed request/tool/search fees, retries, and terminal failures. A missing
applicable price or usage field makes the affected metric `unknown` and therefore `not_passed`.

| Metric                                  |         Acceptance bound | Denominator                                                                                                                   |
| --------------------------------------- | -----------------------: | ----------------------------------------------------------------------------------------------------------------------------- |
| Cost per attempted new log              |             <= USD 0.010 | Every new-log attempt, including failures/retries.                                                                            |
| Cost per validated log                  |             <= USD 0.015 | Logs with source-grounded, user-acceptable result.                                                                            |
| Cost per correctly resolved complex log |             <= USD 0.025 | COMPOSED, HOMEMADE, RESTAURANT, VAGUE, PREPARATION, NEGATION_MODIFIER, or UNRELIABLE cases that meet the frozen ground truth. |
| Monthly variable cost, low/base/high    | <= USD 100 / 500 / 2,000 | 10,000 / 50,000 / 200,000 attempted new logs per month respectively.                                                          |

The monthly ceilings are aggregate variable-cost guardrails, not forecasts. Source/database cost is
zero only where the dated contract proves it; otherwise it is recorded and included. No cache saving
may be claimed unless a measured, separately reported cache-hit population supplies it.

## 4. Product-tier and cache assumptions

The benchmark assumes a single no-surprise consumer tier: users must not incur a per-log charge
because an AI route was selected. Cost control is internal via deterministic fast paths and the
private exact-match memory path; neither path changes the accepted source-grounded nutrient truth.

For the policy calculation, fast-path and personal-memory cache hit rates are **0%**. They may be
reported as measured overlays but cannot be used to make an otherwise over-budget AI-routed result
pass. Any future tiering, quota, or cache-rate assumption requires a revision to this policy before
it is used in a gate calculation.

## 5. Required evidence and decision rule

RESOLVER-V3-039 must preserve, for every attempt: corpus/hash and partition, live-mode proof,
provider/model/prompt/schema/harness versions, start/end time, route, retries, timeout/error,
source/provenance outcome, token/price inputs, computed cost, and no-fallback status. It must report
all-attempts and successful/validated subsets with their denominators.

G2-D passes only if every applicable latency/error limit above passes for development and holdout.
G2-E passes only if every applicable cost limit above passes for development and holdout. A failed,
unknown, insufficient-sample, or missing-evidence value fails its dimension. No average across
partitions, paths, categories, or cost metrics is permitted, and no threshold may be relaxed after
results are observed without a new accepted policy version.

## 6. Non-goals

This policy does not declare Hybrid C production-ready, select a provider, estimate actual traffic,
change V3-010's blocked status, or execute a live run. It is the explicit precondition that makes a
future live result auditable rather than post-hoc.
