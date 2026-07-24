# RESOLVER-V3-039 Controlled Representative Live Hybrid Evidence -- Report

**Execution status:** `development_complete`

## Versions & Hashes
- Report version: `resolver-representative-hybrid-live-evidence-report-v2`
- Protocol version: `resolver-representative-hybrid-live-protocol-v3`
- Execution plan version: `1`
- Corpus version: `resolver-representative-hybrid-benchmark-corpus-1.0.0` / hash: `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`
- Registry version: `resolver-representative-hybrid-benchmark-registry-v1`
- Harness version: `1.0.0`
- Source manifest version: `resolver-representative-hybrid-benchmark-source-manifest-v1` / hash: `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52`
- Plan hash: `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e`
- Protocol-freeze commit: `unknown`
- Evidence commit: `a67a4d051fd1616cad3a59428b117a717d84f002`

## Provider / Pricing
- Provider: `anthropic`, model: `claude-haiku-4-5` (snapshot `claude-haiku-4-5-20251001`)
- Pricing: $1/MTok input, $5/MTok output -- source https://platform.claude.com/docs/en/about-claude/pricing, retrieved 2026-07-22

## Budget
- Limits: maxCalls=263, maxInputTokens=2154496, maxOutputTokens=403968, maxCost=$4.174336, maxInFlight=1
- Plan worst-case reservation: $4.174336
- Actual usage: calls=205, inputTokens=362427, outputTokens=75831, estimatedCost=$0.7415819999999997
- Technical failures: 11, timeouts: 0, retries: 0

## Development
- Case count: 80
- Quality:
  - Variant A: cases=80, evaluable=80, technicalFailures=0, identificationMatchRate=0.0875, expectedBehaviorMatchRate=0.2250, criticalFailures=4
  - Variant B: cases=108, evaluable=105, technicalFailures=3, identificationMatchRate=0.2857, expectedBehaviorMatchRate=0.5333, criticalFailures=30
  - Variant C: cases=108, evaluable=108, technicalFailures=0, identificationMatchRate=0.3056, expectedBehaviorMatchRate=0.1481, criticalFailures=7
- False confidence: A=0.050 (4/80), B=0.259 (28/108), C=0.065 (7/108) -- FAILED
- Friction: clarificationRate=0.019, correctClarificationRate=0.500, abstentionRate=0.398, correctAbstentionRate=0.047 (n=108)
- Latency (nearest-rank):
  - Fast path: n=11, p50=20ms, p95=25ms, threshold=1000ms -- NOT_EVALUABLE
  - AI-routed single attempt: n=97, p50=4987ms, p95=10118ms, threshold=12000ms -- PASSED
  - Retrieval: n=86, p50=17ms, p95=89ms, threshold=2000ms -- PASSED
  - All attempts: n=108, p50=4842ms, p95=9401ms, threshold=12000ms -- PASSED
  - Wall-clock ceiling breaches: 0
- Cost (attempted AI-routed C logs): n=97, unknownCost=2, mean=0.003771, threshold=0.02 -- NOT_EVALUABLE
- Provenance: sourceGroundedRate=0.546 (59/108), missingProvenance=0, unbackedNumeric=0, aiNutrientBecameAuthority=0

## Holdout
_Not executed._

## Consistency (16 frozen overlay groups)
- Overlay groups evaluated: 14
- Variant B outcome agreement: 0.571
- Variant B identification agreement: 0.571
- Variant C outcome agreement: 0.714
- Variant C identification agreement: 0.714
- Variant C fast-path deterministic consistency: 1.000

## Gate Verdicts
| Gate | Verdict |
|---|---|
| G2-A Representative quality | NOT_EVALUABLE |
| G2-B False confidence | NOT_EVALUABLE |
| G2-C User friction | NOT_EVALUABLE |
| G2-D Latency | NOT_EVALUABLE |
| G2-E Cost | NOT_EVALUABLE |
| G2-F Provenance/nutrient authority | NOT_EVALUABLE |
| G2-G Consistency | PASSED |

This task states evidence-level findings only. It does not replace the historical RESOLVER-V3-024 gate decision, does not wire Hybrid C into production, and does not enable RESOLVER-V3-010. A separate RESOLVER-V3-041 gate re-decision task is required before any of those may change.

## No-Fixture-Fallback Proof
Live B/C providers were constructed exclusively via createLiveVariantBProvider/createLiveVariantCInterpreter, which throw a config error before any network call when ANTHROPIC_API_KEY or the shared budget gate is missing; neither FixtureVariantBProvider/NoopVariantBProvider nor FixtureCostAiInterpreter/NoopAiInterpretationProvider was ever passed into the live runner.

## No-Production-Effect Proof
No production DI registration, feature flag, migration, RPC, Supabase adapter, or UI/journal change was made. This report and its underlying runner exist only under src/features/nutrition/benchmark/representativeHybridV1/live/ and scripts/, never imported by any production code path.
