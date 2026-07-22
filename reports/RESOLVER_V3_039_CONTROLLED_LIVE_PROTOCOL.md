# RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence — Frozen Protocol

Status: `frozen` (Phase A)
Task ID: RESOLVER-V3-039
Protocol version: `resolver-representative-hybrid-live-protocol-v1`
Execution-plan version: `1`

This document, together with `reports/resolver-v3-039-controlled-live-protocol.json`, is the
frozen protocol for RESOLVER-V3-039. No paid provider request may occur before the commit that
introduces both files exists (the "protocol-freeze commit"), and no live execution may deviate
from the exact call plan recorded here.

## 1. Scope and authorization

This protocol is authorized to spend **no more than USD 5.00** in real, billed Anthropic API
requests, using one shared `LiveProviderBudgetGate` instance (`maxInFlight: 1`) for every live
Variant B and Variant C request. It collects controlled representative live evidence for a later
gate re-decision (RESOLVER-V3-041, `todo`, not started by this task). It does not wire Hybrid C
into production, does not choose a permanent provider, and does not enable RESOLVER-V3-010.

## 2. Corpus / registry / harness / source-manifest versions and hashes

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Corpus version          | `resolver-representative-hybrid-benchmark-corpus-1.0.0`            |
| Corpus hash             | `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a` |
| Registry version        | `resolver-representative-hybrid-benchmark-registry-v1`             |
| Harness version         | `1.0.0`                                                            |
| Source-manifest version | `resolver-representative-hybrid-benchmark-source-manifest-v1`      |
| Source-manifest hash    | `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52` |
| Plan hash               | `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e` |

All four hashes/versions are computed at runtime by the existing RESOLVER-V3-038 modules
(`RepresentativeHybridV1Manifest.ts`, `RepresentativeHybridV1SourceSnapshotManifest.ts`) —
this task reuses them unmodified, never recomputes or overrides them, and refuses to execute if a
future run computes a different value (drift detection, `runRepresentativeHybridV1Live.harness.ts`).

## 3. Provider, model, pricing

- Provider: `anthropic`
- Model: `claude-haiku-4-5` (Claude API alias), pinned snapshot `claude-haiku-4-5-20251001`
- Pricing verified from an official Anthropic source only:
  - `https://platform.claude.com/docs/en/about-claude/pricing` (redirected from
    `https://docs.claude.com/en/docs/about-claude/pricing`), retrieved 2026-07-22:
    Claude Haiku 4.5 — **$1 / MTok input, $5 / MTok output**.
  - Model ID confirmed available and current at
    `https://platform.claude.com/docs/en/about-claude/models/overview`, retrieved 2026-07-22.
  - This matches the repository's existing pricing constants
    (`LiveProviderBudgetGate.ts`'s `ANTHROPIC_MESSAGES_PRICING`, `VariantBLiveProvider.ts`'s
    `ANTHROPIC_HAIKU_PRICE_PER_M_TOKENS`) exactly — **no drift detected**, so those constants
    remain usable unchanged.
- Same model is used for both Variant B and Variant C (never substituted silently).

## 4. Prompt / schema / interpreter / estimator versions (pinned, unchanged)

| Field                                          | Value                           |
| ---------------------------------------------- | ------------------------------- |
| Variant B prompt version                       | `variant-b-prompt-v1`           |
| Variant B schema version                       | `variant-b-schema-v3`           |
| Variant B estimator version                    | `variant-b-ai-only-v1`          |
| Variant B contract version                     | `1`                             |
| Variant C prompt version                       | `variant-c-prompt-v1`           |
| Variant C schema version                       | `variant-c-schema-v1`           |
| Variant C interpreter version                  | `variant-c-live-interpreter-v1` |
| Variant C (AI interpretation) contract version | `1`                             |

## 5. Per-request reservation

Both Variant B and Variant C requests reserve, per attempt, the same existing conservative
ceilings already pinned in `VariantBLiveProvider.ts`/`VariantCLiveInterpretationProvider.ts`:

- Max input tokens: 8,192
- Max output tokens: 1,536
- Worst-case cost per request: `(8192/1e6)*$1 + (1536/1e6)*$5 = $0.015872`

## 6. Canonical execution population

The frozen RESOLVER-V3-038 successor corpus has 114 total scenarios: 88 resolution base cases, 16
repeat/paraphrase overlay cases (104 primary resolution scenarios), and 10 governance-only
scenarios (personal-memory/global-candidate/privacy/economics — never invoke live B/C).

| Partition   | Base cases | Overlay cases | Governance-only |
| ----------- | ---------- | ------------- | --------------- |
| Development | 66         | 14            | 6               |
| Holdout     | 22         | 2             | 4               |
| **Total**   | **88**     | **16**        | **10**          |

## 7. Route classification (deterministic, zero-network preflight)

Every one of the 104 primary resolution scenarios was classified, before any provider request and
before any credential check, using the real Variant A resolver's own accept threshold (the same
fast-path check `ResolverV3VariantCAdapter.ts` already uses): `fast_path` if
`ResolverDecision.status === 'accepted'`, otherwise `ai_routed`. This never depends on any live
provider result.

Result (counted per planned Variant C observation, not per unique scenario — an overlay
scenario's 3 observations each carry their own route):

- Fast-path observations: **12**
- AI-routed observations: **127** (development: 97, holdout: 30 after supplementation — see §9)

## 8. Exact call plan

| Item                                           | Count                                 |
| ---------------------------------------------- | ------------------------------------- |
| Variant B calls (total)                        | **136** (development 108, holdout 28) |
| Variant C primary+consistency attempts (total) | 136                                   |
| Variant C fast-path attempts                   | 12                                    |
| Variant C AI-routed calls (max)                | **127** (development 97, holdout 30)  |
| Sample-floor supplement observations           | 3 (all in holdout)                    |
| **Total planned observations (B+C)**           | **275**                               |

Every resolution base case gets exactly 1 Variant B call and exactly 1 Variant C attempt
(fast path first, live AI only if the fast path does not accept). Every one of the 16 overlay
scenarios gets exactly 3 total Variant B calls and exactly 3 total Variant C attempts (the
consistency protocol's "at least three total observations" requirement, satisfied exactly, not
exceeded).

## 9. Minimum-sample supplementation (V3-040 n ≥ 30)

The holdout partition's Variant C AI-routed population naturally reached 27 observations. Per the
deterministic lexicographic-cycle supplementation rule, exactly **3** additional repeated Variant C
AI-routed observations were added, cycling through the holdout partition's already-`ai_routed`
scenario IDs in lexicographic order, to reach the n ≥ 30 floor. The development partition's
Variant C AI-routed population (97) already exceeded 30 and required no supplementation. This
schedule was frozen before any provider result was observed and cannot change after this commit.

No other path required supplementation for this protocol run; any path/partition that remains
below 30 after this schedule (or is structurally empty) is reported as `not_evaluable` in the
final evidence report, never manufactured or defaulted to a pass.

## 10. Budget arithmetic (hard reservation ceiling)

```text
maxCalls        = variantBCalls (136) + variantCMaxAiRoutedCalls (127) = 263
maxInputTokens  = 263 * 8,192  = 2,154,496
maxOutputTokens = 263 * 1,536  =   403,968
perRequestWorstCaseCostUsd = (8192/1e6)*1 + (1536/1e6)*5 = 0.015872
maxCost         = 263 * 0.015872 = 4.174336
```

`maxCost` (**USD 4.174336**) is **within** the USD 5.00 authorized ceiling, with **USD 0.825664**
of headroom never allocated to any planned call. `maxInFlight` is `1`. This is a fresh,
task-specific `LiveProviderBudgetGate` instance — it does **not** reuse RESOLVER-V3-013's 29-call
/ USD 5 flat-ceiling constants, which were sized for a 14-case smoke corpus, not this task's
104-scenario successor corpus.

## 11. Timeout and retry policy (V3-040 §4, applied exactly)

- Provider timeout: 15,000 ms per request (enforced via `AbortController`, truly aborts the
  underlying fetch).
- Outer wall-clock ceiling: 20,000 ms per attempted log (authoritative; a breach fails the attempt
  closed, retains elapsed time, retains its budget reservation, never produces a
  confident-looking fallback result).
- Automatic retries: **0** (valid because V3-040 allows at most one retry; it does not require
  one — this protocol deliberately makes zero, to keep the budget deterministic).

## 12. Credential handling

`ANTHROPIC_API_KEY` presence is checked only; its value is never printed, hashed, partially
revealed, persisted, or copied into another variable. A missing or invalid credential fails before
any request, with no fixture fallback.

## 13. Frozen artifacts (must not change after this commit)

See `reports/resolver-v3-039-controlled-live-protocol.json`'s `isolation.frozenArtifacts` list —
every RESOLVER-V3-038 corpus/registry/manifest/hash file, RESOLVER-V3-023 (Learning Benchmark V2)
artifacts, the RESOLVER-V3-024 report, and the RESOLVER-V3-040 policy document. This task's own
code lives exclusively in additive files
(`src/features/nutrition/benchmark/representativeHybridV1/live/**`,
`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`), plus two minimal, backward-compatible
optional-parameter additions to `VariantBLiveProvider.ts`/`VariantCLiveInterpretationProvider.ts`
(an optional transport override, needed to truly abort the underlying fetch on timeout — every
existing caller/test is unaffected since the parameter is optional and unused by them).

## 14. Two-phase workflow

**Phase A (this document + its JSON twin + code + tests) is complete once this commit exists,**
focused tests pass, and `npm run verify` passes. **Phase B (actual live execution)** may only run
after this exact commit, using `node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs
--partition=development --protocol=reports/resolver-v3-039-controlled-live-protocol.json`, followed
by holdout with `--partition=holdout --final-evaluation` after development completes and no
protocol/code change has been made in between.
