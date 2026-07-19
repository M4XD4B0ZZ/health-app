# RESOLVER-V3-006 — Three-Variant Comparison Report

**Status:** completed evidence review; **not** a production decision.
**Evidence run:** 2026-07-19, commit `e26a151b19e81ab617be2a182d4ccbc14ce96c76`.
**Corpus / harness:** v1.0.0 / 14 shared smoke cases (`RV3-0001` through `RV3-0014`).

## Executive result and gate

All three harnesses ran successfully on the same case-ID set and corpus version. Variant A is a
real, reproducible baseline measurement of the current resolver plus the committed BLS artifact.
Variants B and C ran in deterministic **fixture** mode. Their numerical scores demonstrate their
respective harnesses and contracts, not a live AI provider's quality.

**RESOLVER-V3-006 production-wiring gate: NOT PASSED / decision deferred.** It would be
methodologically invalid to conclude that C outperforms A, or that B outperforms either, from
the current 91.7% (B), 83.3% (C), and 75.0% (A) figures. No downstream production-wiring task
may treat this report as the required performance proof.

## Method and reproducibility

The following commands were run from the repository root on the commit named above:

```bash
node scripts/benchmark-resolver-v3-variant-a.mjs
node scripts/benchmark-resolver-v3-variant-b.mjs
node scripts/benchmark-resolver-v3-variant-c.mjs
```

They produced the ignored, run-local source artifacts:

- `logs/resolver-v3-variant-a-benchmark.{json,md}`
- `logs/resolver-v3-variant-b-benchmark.{json,md}`
- `logs/resolver-v3-variant-c-benchmark.{json,md}`

All three JSON reports declare `harnessVersion: 1.0.0`, `corpusVersion: 1.0.0`, 14 cases, and
the identical ordered case-ID set. This report is a read-only interpretation of those artifacts;
it deliberately adds no comparison aggregator because the Roadmap DoD requires a report, and a
new executable layer would not create missing live evidence.

## Evidence classes (binding interpretation for this report)

| Variant | What ran                                                                            | What the present run establishes                                                                                                                                                     | What it does **not** establish                                                                                                  |
| ------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------- |
| A       | Current `SequentialFoodCatalogResolver` and committed BLS artifact, no AI           | Real behavior of this resolver/source configuration on this 14-case smoke corpus, including source IDs, false-confidence behavior, provenance, and deterministic repeat pairs        | General production quality; OFF/USDA behavior; real-user distribution; a 150–200-case corpus result                             |
| B       | Deterministic direct-estimation fixtures                                            | Request/response contract, validation, component/quantity/macro metric plumbing, reports, zero-network operation, and credential/no-fallback path                                    | Real AI identification or nutrient accuracy, hallucination rate, consistency, provider cost, or provider latency                |
| C       | Deterministic interpretation fixtures plus real BLS retrieval/ranking/decision code | Hybrid orchestration, existing fast path, execution of source-constrained native queries, source grounding, provenance, deterministic scaling/summing, and partial-result safeguards | Real AI interpretation/search-plan quality, provider consistency, provider cost/latency, or overall live accuracy versus A or B |

Thus A's baseline measurements and B/C's fixture numbers belong in the same report but not in a
single quality ranking. Fixture responses were intentionally authored test inputs; their outputs
cannot be promoted to model evidence merely because the same corpus IDs were used.

## Harness-readiness matrix

| Capability                               | A                                          | B                                                        | C                                                    |
| ---------------------------------------- | ------------------------------------------ | -------------------------------------------------------- | ---------------------------------------------------- |
| Default run network-free / reproducible  | Baseline-belegt                            | Fixture-belegt                                           | Fixture-belegt                                       |
| Live mode                                | Nicht vorhanden / nicht relevant           | Implemented; live evidence absent                        | Implemented; live evidence absent                    |
| Credential guard and no fixture fallback | n/a                                        | Fixture-belegt                                           | Fixture-belegt                                       |
| Structured response validation           | Resolver decision boundary                 | Fixture-belegt                                           | Fixture-belegt                                       |
| JSON and Markdown reports                | Baseline-belegt                            | Fixture-belegt                                           | Fixture-belegt                                       |
| Cost / latency fields                    | Local-resolver measurements                | Infrastructure-belegt, real provider values absent       | Infrastructure-belegt, real provider values absent   |
| Repeat support                           | Two cross-input repeat groups              | Cross-input groups plus deterministic same-input repeats | Two cross-input repeat groups                        |
| Production separation                    | Baseline calls existing resolver read-only | Fixture/live benchmark only                              | Fixture/live benchmark only; no app/container wiring |

## Measured output (shown with its evidence class)

| Metric             | A — real resolver baseline                                     | B — fixture harness                          | C — fixture hybrid harness                                |
| ------------------ | -------------------------------------------------------------- | -------------------------------------------- | --------------------------------------------------------- |
| Identification     | 9/12 applicable, **75.0%**                                     | 11/12 applicable, **91.7%**                  | 10/12 applicable, **83.3%**                               |
| Critical cases     | 1 (`RV3-0011`)                                                 | 1 (`RV3-0009`)                               | 1 (`RV3-0011`)                                            |
| Components P/R/F1  | Not supported at this resolver boundary; **not 0**             | 91.7% / 84.6% / 0.88                         | 76.9% / 76.9% / 0.77                                      |
| Nutrient authority | BLS source candidate                                           | Direct AI estimate; not source-grounded      | Source candidate only; AI nutrients structurally excluded |
| Provenance         | Source-ID rate 100%; no AI source / no unbacked numeric result | `ai_estimate`; no source ID is expected      | Source-ID rate 100%; zero unbacked numeric results        |
| Fast path          | n/a                                                            | n/a                                          | 7/14 used; 7 fixture AI calls avoided                     |
| Fixture cost       | n/a (no AI calls)                                              | $0                                           | $0                                                        |
| Reported p50/p95   | 35.44 / 119.06 ms local harness/resolver                       | 0 / 0 ms fixture metadata                    | 81.05 / 147.70 ms fixture + local retrieval harness       |
| Repeat groups      | Both consistent                                                | Both consistent; same-input fixture ranges 0 | Both consistent                                           |

The percentages in this table are **side-by-side telemetry, not a rank ordering**. Component
coverage is `not supported` for A at this harness boundary, not a zero score. B's direct estimate
macros and C's source-grounded macros also have different authority semantics. Null/not-evaluable
values remain null/not-evaluable and are not converted to zero.

## What can and cannot be compared now

### Permitted comparisons

1. **Harness readiness:** all variants can execute the shared smoke corpus and emit stable reports.
2. **A baseline defects:** A really selected BLS-backed but unsuitable records on the tested commit.
3. **Architecture:** C demonstrably separates AI interpretation from nutrient authority, invokes
   planned source-native retrieval, retains IDs/provenance, and prevents an ungrounded numerical
   result. B deliberately does not have those grounding properties because it is the AI-only
   control architecture.
4. **Safety mechanisms:** C's fixture tests/run prove its fast-path accounting and its
   partial-as-complete guard are wired; B/C prove their fixture-mode validation paths.
5. **Experiment design:** the exact case set, prompt/schema versions, report formats, and metrics
   are ready for controlled live runs.

### Explicitly not comparable / not permitted

- **No A/B/C accuracy league table.** B and C fixture scores are not real provider outputs.
- **No macro-accuracy winner.** B's values are authored direct estimates; C's source selection is
  conditioned on authored interpretations; A is a real baseline with a small corpus.
- **No common confidence percentage.** A uses `accepted`; B uses an estimator confidence plus
  estimate-specific macro rule; C uses disposition/result rules. Their false-confidence counters
  are variantspecific safety signals, not one calibrated scale.
- **No cost or latency ranking.** `$0` and B's zero latency are fixture properties. C's avoided
  calls are a real orchestration counter but not a real monetary saving without a provider price
  and live input distribution.
- **No production readiness/cutover claim.** The corpus is too small and B/C have no live quality,
  consistency, token, cost, or latency evidence.

## Grounding, quantities, and safety

| Property                             | A                                              | B                           | C                                                                                     |
| ------------------------------------ | ---------------------------------------------- | --------------------------- | ------------------------------------------------------------------------------------- |
| Authoritative values                 | Existing BLS resolver result                   | AI estimate by design       | Retrieved BLS/OFF/USDA-style source candidate; current corpus exercises BLS           |
| AI can provide canonical nutrition   | No AI path                                     | Yes, control-group contract | No; contract excludes nutrient authority                                              |
| Source type / ID on resolved value   | Present                                        | Intentionally absent        | Required and checked                                                                  |
| Quantity behavior                    | Out of scope at single-query resolver boundary | Fixture metric plumbing     | Existing portion hints + deterministic scaling; non-convertible stays non-convertible |
| Partial meal represented as complete | Not a meal-decomposition harness               | Contract-specific result    | Explicitly guarded; zero observed in fixture run                                      |
| Cache evidence                       | None                                           | None                        | Fast path only; **not** a personal-cache hit rate                                     |

C's source-grounding and provenance properties are therefore an architectural advantage over B's
control design. They do not prove that C will identify foods more accurately than B or A in live
use.

## Case-level findings and required live checks

| Case                           | Empirical A baseline                                                  | B fixture behavior                                      | C fixture behavior                                       | Required next evidence                                                                         |
| ------------------------------ | --------------------------------------------------------------------- | ------------------------------------------------------- | -------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| Brötchen (`RV3-0011`)          | Real critical false confidence: accepted BLS `Brötchen (Blätterteig)` | Authored fixture is correct; not evidence of a live fix | Inherits the fast-path error; remains critical           | Test live B/C and any later fast-path policy against this false-confidence regression          |
| Tomate (`RV3-0009`)            | Real wrong BLS `Tomate-Mozzarella`                                    | Intentionally wrong/confident fixture critical case     | Authored planned query resolves source-grounded tomato   | Live search-plan and false-confidence evaluation; do not call the fixture a fix                |
| Gurke (`RV3-0010`)             | Real wrong BLS `Gemüsesaft aus Gurke`                                 | Authored correct fixture                                | Authored planned query resolves source-grounded cucumber | Live query-planning/source-selection evaluation                                                |
| Speck (`RV3-0008`)             | Ambiguous result is only a clarification proxy                        | Fixture asks clarification                              | Fixture asks clarification without retrieval             | Measure whether live models request clarification consistently rather than invent values       |
| Zwiebelrostbraten (`RV3-0014`) | Correct BLS abstention; no numeric ground truth                       | Fixture abstains                                        | Fixture interprets then source-groundedly abstains       | Regional/restaurant holdout with abstention correctness; never use an invented nutrient target |

The benchmark implementation also has a dedicated three-component input (`Zwei Scheiben Toast mit
Butter und Gouda`) for B/C contract and safety testing. The common 14-case smoke corpus itself is
single-component and BLS-only, so it does not yet provide a corpus-level multi-component or
OFF/USDA comparison.

## False confidence, consistency, cost, and latency limits

Each critical count is one under a **different, documented variant-local rule**: A flags a wrong
`accepted` resolver result; B can additionally flag a confident estimate outside macro tolerance
or a hallucinated brand; C flags resolved-like wrong outcomes and partial-as-complete. Retain these
as comparable _error-class labels_, not comparable confidence values. Confidence calibration
remains open; this task does not normalize it.

The repeat groups are deterministic in all three observed runs. Only A establishes deterministic
behavior of the actual current resolver. B/C's zero fixture variation does not measure a model's
sampling or provider variability. Similarly, the reported A/C timings include local execution;
B's 0 ms is fixture metadata. No real provider token or cost value exists, and neither `$0` nor
the seven avoided C fixture calls is a real production-cost claim. Cache-hit rate remains deferred
until RESOLVER-V3-008.

## Decisions and blocked decisions

### Decidable now

- The current resolver has materially relevant, source-grounded but wrong selections on this
  smoke corpus, including one real false-confidence failure.
- All three benchmark harnesses are technically available and reproducible.
- C can implement the target separation of AI interpretation and source-authoritative nutrients,
  fast-path avoidance, provenance capture, deterministic calculation, and safe partial handling.
- B and C are ready for controlled live evidence collection, subject to credentials and explicit
  run configuration.

### Still blocked

- Provider/model selection and any direct-AI-vs-hybrid quality claim.
- A claim that C outperforms A or B in real identification, macro error, safety, consistency,
  cost, or latency.
- A production feature flag, cutover, confidence threshold, cache/knowledge-layer decision, or
  cost limit.

## Minimum live-evidence protocol before revisiting the gate

1. Run B and C in explicit live mode with authorized credentials; never fall back to fixtures.
2. Use the same versioned corpus and preserve the unchanged A baseline.
3. Pin and record provider, model, prompt, schema, and interpreter/estimator versions.
4. Use an identical provider/configuration where the comparison asks a provider-quality question,
   or explicitly justify the difference.
5. Include controlled repeat runs, real token/cost/latency metadata, and the full
   variant-specific false-confidence analysis.
6. Separate development cases from a larger holdout; grow toward the specification's target
   corpus and cover multi-component, regional, OFF/USDA, clarification, and abstention behavior.
7. Audit prompts/fixtures for ground-truth leakage and retain source provenance for C.

RESOLVER-V3-007 may analyse the cost/latency model once live measurements exist. Until then it
can document field availability and unknowns but cannot derive a production cost bound. Persistent
cache effects are not measured here: C's seven avoided calls arise from the existing resolver fast
path, not RESOLVER-V3-008's future personal cache.

## Follow-up

The Roadmap dependency makes **RESOLVER-V3-007** the next unblocked task. Its first question
must be whether a useful cost/latency analysis can proceed from instrumentation only, or whether a
separate controlled live-evidence task is required first. A new context window is recommended:
the next task needs a distinct cost/latency methodology and potentially credential-gated empirical
work, whereas this report intentionally makes no such live measurement.
