# RESOLVER-V3-038 Representative Hybrid Benchmark Readiness Report

## 1. Exact versions

| Axis                                                           | Value                                                         |
| -------------------------------------------------------------- | ------------------------------------------------------------- |
| Corpus contract                                                | `resolver-representative-hybrid-benchmark-corpus-1.0.0`       |
| Registry contract                                              | `resolver-representative-hybrid-benchmark-registry-v1`        |
| Harness version                                                | `1.0.0`                                                       |
| Report schema version                                          | `resolver-representative-hybrid-benchmark-report-v1`          |
| Source-snapshot manifest version                               | `resolver-representative-hybrid-benchmark-source-manifest-v1` |
| Inner `BenchmarkCase.corpusVersion` (all resolution scenarios) | `1.0.0`                                                       |

## 2. Corpus-freeze commit

- Commit SHA: `639e940ed22a30d1146ba295b898569ffabec589`
- Branch: `claude/resolver-v3-038-representative-hybrid-benchmark-a9csqu`
- Base: `origin/chore/clean-arch-structure` @ `a37312b211232ead4ac1e288bbb42f7fbcda0035`
- Scope: closed scenario-union contracts, exact-key validator, full development/holdout resolution
  corpus, governance-fixture scenarios, source-snapshot manifest, registry, coverage report. No
  harness/runner/CLI/test/doc code is in this commit.
- The harness (runner, evaluators reuse, aggregator, report builder, CLI, tests, docs) was
  implemented in commit(s) after this freeze commit, on top of the frozen corpus, per the required
  freeze protocol.

## 3. Corpus hash and source-manifest hash

- Corpus hash (`computeRepresentativeHybridV1CorpusHash`): `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`
- Source-manifest hash (`computeRepresentativeHybridV1SourceManifestHash`): `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52`
- Both are deterministic and order-independent (proven by
  `RepresentativeHybridV1Registry.test.ts`'s hash-reversal tests).

## 4. Exact generated counts

All counts below are generated at runtime by `RepresentativeHybridV1CoverageReport.ts` from the
frozen corpus — never hand-maintained.

- Total scenarios: **114**
- Development: **86**
- Holdout: **28**
- Resolution base cases: **88** (66 development / 22 holdout)
- Repeat/paraphrase overlay cases: **16** (≈18.2% of base)
- Governance-fixture scenarios: **10** (2 personal-memory, 4 global-candidate, 2 privacy, 2 economics)
- Holdout share of resolution base: **25.0%**
- DACH-weighted share: **14.8%** (13/88 — below the 25–30% target, disclosed as a residual limitation)
- Complex-meal share (COMPOSED+HOMEMADE+RESTAURANT): **27.3%** (24/88 — within the ~30% target)

## 5. Category x partition matrix

| Category          | Development | Holdout | Total |
| ----------------- | ----------- | ------- | ----- |
| SIMPLE            | 6           | 2       | 8     |
| HOUSEHOLD         | 6           | 2       | 8     |
| DACH              | 6           | 2       | 8     |
| BRANDED           | 6           | 2       | 8     |
| COMPOSED          | 6           | 2       | 8     |
| HOMEMADE          | 6           | 2       | 8     |
| RESTAURANT        | 6           | 2       | 8     |
| VAGUE             | 6           | 2       | 8     |
| PREPARATION       | 6           | 2       | 8     |
| NEGATION_MODIFIER | 6           | 2       | 8     |
| UNRELIABLE        | 6           | 2       | 8     |

Every category meets the accepted 8-per-category minimum and appears in both partitions.

## 6. Behavior x partition matrix

| Behavior                       | Development | Holdout | Total |
| ------------------------------ | ----------- | ------- | ----- |
| direct_resolution              | 26          | 11      | 37    |
| resolution_with_assumption     | 11          | 5       | 16    |
| clarification_required         | 13          | 2       | 15    |
| multiple_candidates_acceptable | 6           | 1       | 7     |
| abstention_expected            | 10          | 3       | 13    |

Every expected behavior appears in both partitions.

## 7. Difficulty matrix

| Difficulty  | Development | Holdout | Total |
| ----------- | ----------- | ------- | ----- |
| easy        | 17          | 10      | 27    |
| medium      | 28          | 3       | 31    |
| hard        | 9           | 8       | 17    |
| adversarial | 12          | 1       | 13    |

Every difficulty appears in both partitions.

## 8. Ground-truth distribution

| Source                   | Count |
| ------------------------ | ----- |
| bls_generic              | 34    |
| documented_recipe        | 13    |
| manufacturer_label       | 7     |
| official_restaurant_data | 3     |
| curated_reference_range  | 6     |
| no_numeric_ground_truth  | 25    |

Restaurant subtype coverage: `official_data` 3, `no_official_data` 2, `regional_independent` 3 — all
three accepted subtypes present.

## 9. Source coverage

6 committed source snapshots (`RepresentativeHybridV1SourceSnapshotManifest.ts`): 4
`manufacturer_label` (Nutella, Coca-Cola, Coca-Cola Zero Sugar, Milka Alpenmilch) and 2
`official_restaurant_data` (McDonald's Cheeseburger DE, Subway Veggie Delite DE). Plus the existing,
unmodified, separately-committed BLS static artifact (`bls-runtime-compact.v1.json`), used by 79 of
the 88 base cases (all `bls_generic`/`documented_recipe`-sourced cases).

## 10. A/B/C harness readiness

`RepresentativeHybridV1ThreeArmRunner.ts` reuses the real, unmodified RESOLVER-V3-003/004/005
adapter/evaluator pairs for all three arms. Verified end-to-end via
`RepresentativeHybridV1ThreeArmBoundary.test.ts` and the full-corpus smoke test
(`runRepresentativeHybridV1.smoke.test.ts`): both development and holdout partitions execute through
all three arms without error. Provider injection is optional and defaults to zero-network stand-ins.

## 11. Conformance-run result

The six-case harness-conformance fixture set (`RH-CONF-*`) runs cleanly through all three arms
(`--conformance` CLI flag / `includeConformance` runner option), exercising: multi-component search
planning + deterministic calculation, clarification, abstention, invalid Variant-B response
(`invalid_response` outcome — no fixture entry recorded for that case), technical error (`error`
outcome — `NoopVariantBProvider`), and source retrieval + deterministic calculation. All six records
are labeled `isFixtureOnly: true` and structurally excluded from representative-quality metrics.

## 12. Zero-network proof

`RepresentativeHybridV1Isolation.test.ts` proves: no live-transport import
(`AnthropicBenchmarkTransport`/`LiveProviderBudgetGate`/live provider adapters), no direct
`fetch()` call, no `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`*_API_KEY` env read, no DI/container
reference, no migration/edge-function/RPC reference, no package/lockfile reference, no feature-flag
reference. The CLI has no `--live` flag at all (absent, not merely blocked).

## 13. Holdout leakage proof

`RepresentativeHybridV1Leakage.test.ts` proves: no non-corpus implementation file hardcodes a
holdout scenario ID, a holdout raw input, or a holdout expected source ID; no evaluator/runner file
branches on a `RH-RES-*` scenario ID; no scenario ID appears twice in the corpus.

## 14. Contradiction/rollback separation proof

`RepresentativeHybridV1Governance.test.ts` proves: `RH-GC-DEV-CONTRA-001` has zero rollback steps
and only the `contradiction-gate` tag; `RH-GC-DEV-ROLLBACK-001` has zero contradiction-forcing steps
and only the `review-rollback` tag; contradiction approval returns `blocked_contradiction` with zero
approved payload; legitimate approval on the separate rollback candidate succeeds, rollback
deactivates it, retry is idempotent (`already_applied`), and a conflicting decision-ID reuse under a
different action fails (`conflict`); running the contradiction fixture first does not affect the
rollback fixture's own fresh, isolated run.

## 15. Known architecture limitations

1. Corpus size (88 base cases) is at the spec's per-category floor, not the 150–200 target.
2. DACH weighting (14.8%) is below the 25–30% target.
3. Manufacturer-label/official-restaurant-data snapshot values are reconstructed from general
   knowledge, not independently re-verified via live fetch (zero-network constraint).
4. Variant A's fast path does not parse quantity-prefixed natural-language input (a pre-existing,
   documented architecture characteristic, verified during authoring, not introduced by this task).
5. Both B and C default to zero-network stand-ins in this task; no live provider/model was ever
   selected or pinned.

See `docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md` §17 for the full residual-
limitations list.

## 16. Explicit statement: no live quality evidence was generated

This task ran the harness exclusively in fixture mode (zero network, zero provider credentials).
Every report produced during this task is stamped `runMode: 'fixture'`, `fixtureOnly: true`,
`noLiveQualityEvidence: true`. **No claim is made about live Anthropic/OpenAI/other-provider
quality, live Hybrid C accuracy, live false-confidence rate, live consistency, production latency,
or production cost.** No live quality winner between A/B/C is declared anywhere in this task's
output.

## 17. V3-039 interface/handoff

V3-039 must inject live `VariantBProvider`/`VariantCAiInterpreter` implementations (plus a shared
budget gate and pinned provider/model run-protocol metadata) through
`RepresentativeHybridV1RunnerDependencies` (`RepresentativeHybridV1ThreeArmRunner.ts`) — no change
to this harness's own code is required. V3-039 must not modify this successor corpus after its
protocol is declared, must gate holdout execution behind an explicit final-evaluation flag (already
enforced by the CLI's `--final-evaluation` requirement), and must never silently fall back from live
to fixture.

## 18. G2-B and the B control arm

The accepted Benchmark Spec §11 G2 false-confidence dimension requires Hybrid C to be strictly
better than **both** Variant A and Variant B. No binding authority removes B from G2 scope. This
successor therefore implements a genuine three-arm (A/B/C) harness boundary — not an A/C-only
harness — specifically so G2-B remains structurally evaluable once V3-039 collects live evidence.
`ROADMAP.md`'s RESOLVER-V3-039 entry is updated to state explicitly that its later controlled
protocol must collect both live B and live C evidence on this same successor corpus.

## 19. No-production-effect statement

No live provider call, no source-network call, no production resolver caller, no feature flag, no
migration, no RPC, no Supabase adapter, no package/dependency change, no DI/container registration,
no UI/journal file change occurred during this task. `RepresentativeHybridV1Isolation.test.ts` and
the Git readback in the final handoff verify this.
