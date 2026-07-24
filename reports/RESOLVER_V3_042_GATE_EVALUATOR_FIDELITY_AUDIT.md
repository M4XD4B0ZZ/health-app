# RESOLVER-V3-042 — Gate Evaluator Fidelity Remediation and Derived Evidence Audit

Task ID: RESOLVER-V3-042
Status: **done** (this audit, the code fixes, and their regression tests are complete and verified;
see §11).

## 0. This is an additive erratum, not a mutation of the original evidence

**This report and its JSON companion (`reports/resolver-v3-042-gate-evaluator-fidelity-audit.json`)
sit alongside the immutable RESOLVER-V3-039 evidence — they do not replace, edit, or regenerate any
of it.** The seven canonical evidence files, the closeout report
(`reports/RESOLVER_V3_039_CONTROLLED_LIVE_EVIDENCE_CLOSEOUT.md`), and the evidence manifest
(`reports/resolver-v3-039-controlled-live-evidence-manifest.json`) remain exactly as merged in PR
#168. Every number in this report is *derived* from that frozen evidence (plus, where noted, from
direct code inspection) — never re-run, never re-collected, zero provider calls made anywhere in
this task. §2 records the SHA-256 proof that none of the seven files changed during this task.

This audit exists because RESOLVER-V3-039's own report-builder code (used to *compute* its stored
gate verdicts) had real defects, found by re-reading the code that produced those verdicts, not by
re-executing anything. Correcting that code is a RESOLVER-V3-042 concern; the historical verdicts
computed by the old code remain frozen, historical facts about what that code produced — they are
not silently overwritten, only annotated here as **defective in their derivation**.

## 1. Mandatory inventory (read before writing anything)

Read in full or by targeted section before any code change: `ROADMAP.md`, `AGENTS.md`, `SSOK.md`,
`VERIFY.md`, `docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` (§6, §11 — the binding G2 gate
table), `docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md`,
`docs/domains/ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`,
`reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md`,
`reports/RESOLVER_V3_039_CONTROLLED_LIVE_EVIDENCE_CLOSEOUT.md`,
`reports/resolver-v3-039-controlled-live-evidence-manifest.json`, all seven canonical evidence
files (`logs/resolver-v3-039-*`), `RepresentativeHybridV1LiveReportBuilder.ts`,
`RepresentativeHybridV1LiveMetrics.ts`, and their existing test files.

## 2. SHA-256 confirmation: seven evidence files unchanged

Two independent checks were performed, both proving zero mutation:

### 2a. Working-tree self-consistency (before this task's first edit vs. immediately before the
final commit, same tool, same checkout)

| File | SHA-256 (working tree, CRLF checkout) |
| --- | --- |
| `logs/resolver-v3-039-call-ledger.jsonl` | `31ad1bf373f71147775b5960e90a1ab9ee0b12f7d4e9d9d6b413b74806ce5069` |
| `logs/resolver-v3-039-development-checkpoint.json` | `f271c4e93ea75e1a40c2be7c97a050d921c12917b7b820a9a574207bfd68ae1e` |
| `logs/resolver-v3-039-development-diagnostic.json` | `50bb8d9e84d89f09d7f54fa260db57bdf1043dc1b0cbbb3cd4ff865f04d10aa5` |
| `logs/resolver-v3-039-development-diagnostic.md` | `52984936dde72cf8c1485dc316aa2e0207505156f3b0ededae9ab4e0566578ba` |
| `logs/resolver-v3-039-holdout-checkpoint.json` | `22e7cd14a7485186e81ebf531a9e8caad44abb0d7dfbc9b145b611d6bf15ce85` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.json` | `d651ad484f4ae9cc9d8d88d41309fe7782a8761f188f88a6b3cbae805e01193e` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.md` | `2ab6289ee2f73d6e991d1183948b7e55db953a28366564d733fa179d72fad537` |

These exact values were computed at the very start of this task, before any file was touched, and
recomputed identically immediately before the final commit below — **byte-for-byte identical, no
drift.**

### 2b. Canonical git-blob cross-check against the frozen manifest

The working-tree hashes above do **not** equal `reports/resolver-v3-039-controlled-live-evidence-manifest.json`'s
recorded values. This is expected and unrelated to this task: this checkout has
`core.autocrlf=true` and none of these seven paths carry a `.gitattributes` `eol=lf` override, so
git checks them out with CRLF line endings on this Windows environment, while the manifest's hashes
were recorded over the canonical LF blob content — the exact same class of checkout-dependent
byte-difference already diagnosed for source files during RESOLVER-V3-039's own protocol v2→v3
execution-tree-hash remediation (`reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md`).
`git show HEAD:<path> | sha256sum` (the canonical, checkout-independent blob content) was computed
for all seven files and found to equal the manifest's recorded SHA-256 **exactly**, for every file:

| File | Canonical (git blob) SHA-256 | Manifest SHA-256 | Match |
| --- | --- | --- | --- |
| call-ledger.jsonl | `a7a039e7c9035a893c06462751af65332639cf7e110a2afee4153ad99733adf8` | same | ✅ |
| development-checkpoint.json | `1600e9b6f985e1c01978a26ebcc3c2c200add874dd73de97d49a3019b52b0cb4` | same | ✅ |
| development-diagnostic.json | `f9e7baa0da355502f36a3279bd65698db6a1c55f2443478b4f112336b78de6c3` | same | ✅ |
| development-diagnostic.md | `68d18d604c0069daec9214175e6bd67b9673105f1ee48e8f123fc01ac67cbd4e` | same | ✅ |
| holdout-checkpoint.json | `4441247832cc02585384dbf78e4372fe8226947d1aa69c3fd4874de33574a593` | same | ✅ |
| controlled-representative-live-evidence.json | `e27d14a5ee3ba309b4dcf24c9265310baca8d2c393dfcfb949bab2d68f4530e9` | same | ✅ |
| controlled-representative-live-evidence.md | `a2d636370e4b69d89acf2d4435ecb63c3acd583a092dd54b3bfdfd963e9f1fef` | same | ✅ |

**Conclusion: zero mutation, both by working-tree self-consistency and by canonical content
cross-check.** No evidence file was written to, force-added, or regenerated by this task. All
validator/hash tooling in this task's own tests operates on external copies (a scratch temp
directory) whenever it might theoretically write, per this task's own hard constraint.

## 3. Method

Every defect below was found by **reading the code that computes the historical gate verdicts**
(`RepresentativeHybridV1LiveReportBuilder.ts`, `RepresentativeHybridV1LiveMetrics.ts`) side-by-side
with the binding authority (`ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11's G2 table) and the
actually-stored evidence (`logs/resolver-v3-039-*`, `reports/resolver-v3-039-controlled-live-evidence-manifest.json`).
Corrected numbers below are either (a) recomputed directly from stored aggregate fields using
arithmetic alone (shown with the exact derivation), or (b) explicitly marked **not retroactively
recoverable** when the stored evidence does not persist the per-case data a correct recomputation
would require — this task never invents a number it cannot derive.

---

## 4. G2-A — Representative quality

**Binding rule** (spec §11, G2(a), German original quoted verbatim so nothing is lost in
translation): *"Top-1-Identifikation ≥ Variante A mindestens in `DACH`/`COMPOSED`/`RESTAURANT`, ohne
Regression in `SIMPLE`/`HOUSEHOLD`"* — i.e. Variant C's Top-1 identification rate must be **≥**
Variant A's, evaluated **per category**, for exactly five named categories in two groups (three
requiring "at least as good," two requiring "no regression") — never a single blended rate across
the whole corpus.

**Original stored verdict:** `passed` (both Development and Holdout; final combined report
`gateVerdicts.g2a_representativeQuality`).

**Defect** (`RepresentativeHybridV1LiveReportBuilder.ts`, pre-fix, was lines ~245–252):

```ts
g2a_representativeQuality: overallGateVerdict(development, holdout, (p) =>
  p.quality.variantC.identificationMatchRate !== null &&
  p.quality.variantC.identificationMatchRate > p.quality.variantA.identificationMatchRate!
    ? 'passed'
    : p.quality.variantC.evaluableCount < 30
      ? 'not_evaluable'
      : 'failed',
),
```

Two independent problems, both confirmed by inspection:
1. **Aggregate, not category-specific.** `p.quality.variantC.identificationMatchRate` and
   `p.quality.variantA.identificationMatchRate` (from `computeQualityMetrics`) are single rates
   blended across **every** category in the corpus (`BRANDED`, `HOMEMADE`, `PREPARATION`, `VAGUE`,
   `UNRELIABLE`, `NEGATION_MODIFIER` included) — the binding rule names exactly five categories in
   two distinct treatments and none of the others.
2. **Strict `>`, not the binding `≥`.** Even ignoring (1), the comparison operator does not match
   "≥" — a category where C exactly equals A's rate would be reported as a failure to meet the
   requirement under the old code (in the `not_evaluable`/`failed` branch), which is not what the
   spec asks.

**Corrected code**
(`RepresentativeHybridV1LiveMetrics.ts`: `computeCategoryQualityBreakdown`, `G2A_AT_LEAST_VARIANT_A_CATEGORIES`,
`G2A_NO_REGRESSION_CATEGORIES`; `RepresentativeHybridV1LiveReportBuilder.ts`: `categoryByScenarioId`
param, `categoryQuality` field, corrected `g2a_representativeQuality`): computes Top-1 identification
match rate for Variant A and Variant C's **primary** observation (never a `consistency`/
`sample_floor_supplement` repeat — see rationale in the code comment: counting a repeated overlay
case 2–3× would overweight it relative to Variant A, which never repeats), separately for `DACH`,
`COMPOSED`, `RESTAURANT`, `SIMPLE`, `HOUSEHOLD`, using `≥` for all five (the binding text uses "≥"
for the first group and "ohne Regression" — practically the same inequality — for the second). The
gate passes only if all five conditions hold in **both** partitions independently (no averaging
across partitions to hide one that fails, matching the binding "both must independently pass" rule
already used elsewhere in this codebase).

**Can the historical RESOLVER-V3-039 verdict be recomputed retroactively? No — and this is stated
honestly rather than guessed.** The seven canonical evidence files persist only the already-blended,
already-aggregated `quality.variantA`/`quality.variantC` arm totals (see e.g.
`logs/resolver-v3-039-development-diagnostic.json`'s `development.quality` object) — they do not
persist a per-case `{scenarioId, category, identification}` table. Category is derivable from a
scenario ID's naming convention plus the frozen corpus definition (e.g. `RepresentativeHybridV1DachCorpus.ts`),
but the *per-case Variant A/C identification outcome* for the historical live run was never
persisted anywhere outside the process memory of the (already-completed, already-closed-out) live
execution — only the blended rate survived into the stored report. Recomputing the true historical
per-category rate would require re-running the benchmark, which this task's hard constraints
explicitly forbid. **Verdict on the historical run: indeterminate at the category level — the
stored `passed` cannot be confirmed or refuted from persisted evidence alone.**

**Implication for RESOLVER-V3-041:** treat RESOLVER-V3-039's historical G2-A `passed` as
**unverified, not certified** — it was computed by code that is now proven not to implement the
binding rule. RESOLVER-V3-041 must not cite the historical G2-A `passed` as satisfying the binding
category-specific requirement. Any *future* live execution (which RESOLVER-V3-041 itself does not
authorize) will, from this fix onward, receive a faithful, category-specific G2-A verdict as long as
a `categoryByScenarioId` map is supplied to the report builder (now wired by default in
`runRepresentativeHybridV1Live.harness.ts`).

---

## 5. G2-C — User friction

**Binding rule** (spec §11, G2(c)): *"Rückfragenrate nicht drastisch über dem bestehenden
Speck-Präzedenzfall-Volumen (RESOLVER-V2-010) — **qualitativ zu prüfen, kein Fixwert**"* — explicitly
qualitative, explicitly **no fixed numeric threshold**. This is stated as plainly as the spec ever
states anything: there is no deterministic pass/fail rule to implement here.

**Original stored verdict:** `passed` (both partitions).

**Defect** (`RepresentativeHybridV1LiveReportBuilder.ts`, pre-fix):

```ts
g2c_userFriction: overallGateVerdict(development, holdout, (p) =>
  p.friction.denominator >= 30 ? 'passed' : 'not_evaluable',
),
```

Confirmed exactly as suspected: **the only condition checked is `denominator >= 30`.** No
correctness rate, no comparison to any precedent volume, no qualitative judgment of any kind is
applied — a partition with a 100% *incorrect* clarification/abstention rate and n≥30 would report
`passed` identically to a partition with a 100% correct rate. This is a genuine defect: the code
manufactured a numeric threshold (`n>=30`) as a stand-in for a rule the spec explicitly says has no
numeric threshold.

**Real, complete friction data derivable from stored evidence** (exact — `friction.denominator ×
rate` is always an integer here, checked):

| Partition | n (C cases w/ expected behavior) | Clarifications | Correct clarifications | Abstentions | Correct abstentions |
| --- | --- | --- | --- | --- | --- |
| Development | 108 | 2 (1.85%) | 1 (50.0%) | 43 (39.8%) | 2 (4.65%) |
| Holdout | 31 | 1 (3.23%) | 0 (0%) | 17 (54.8%) | 1 (5.88%) |

(Derived from `logs/resolver-v3-039-development-diagnostic.json`'s `development.friction` object and
the final combined report's `holdout.friction` object: e.g. Development clarifications =
`clarificationRate × denominator` = `0.018518518518518517 × 108` = `2` exactly; correct
clarifications = `correctClarificationRate × clarifications` = `0.5 × 2` = `1`; abstentions =
`0.39814814814814814 × 108` = `43`; correct abstentions = `0.046511627906976744 × 43` ≈ `2`. Holdout
likewise: `0.03225806451612903 × 31 = 1`; `0 × 1 = 0`; `0.5483870967741935 × 31 = 17`;
`0.058823529411764705 × 17 ≈ 1`.)

Both partitions' abstention *correctness* rate is low (≈4.65% Development, ≈5.88% Holdout) — i.e.
when Variant C abstains, it is very rarely the case the ground truth actually called for
`abstention_expected`. This is exactly the kind of number a human should weigh under the binding
qualitative rule; the corrected code reports it rather than hiding it behind an automated `passed`.

**Per-case category distribution and full expected-behavior cross-tabulation:** like G2-A, this is
**not retroactively recoverable** from the seven persisted evidence files — only the already-computed
aggregate `friction` rates survive, not a per-case `{category, expectedBehavior, actualOutcome}`
table.

**Corrected code:** `g2c_userFriction` now resolves to `requires_human_judgment` whenever real
friction data exists (`friction.denominator > 0`), and `not_evaluable` only when there is none —
**it can never resolve to `passed` or `failed`,** matching the spec's own explicit statement that
this dimension has no fixed value to check against.

**Implication for RESOLVER-V3-041:** the historical `passed` must be discarded as a defective,
manufactured verdict — RESOLVER-V3-041 must perform its own qualitative judgment of the friction
numbers in §5's table (in particular the low abstention-correctness rates) rather than treating
"n≥30 ⇒ acceptable" as ever having been a real evaluation.

---

## 6. G2-G — Consistency

**Binding rule** (spec §11, G2(g)): *"Konsistenz: Wiederholungs-Übereinstimmungsrate nicht wesentlich
schlechter als As (die strukturell nahe 100% liegt)"* — repeat-agreement rate not *substantially*
worse than Variant A's (which is structurally near 100%) — again qualitative, no fixed multiplier.

**Original stored verdict:** `passed`.

**Defect** (`RepresentativeHybridV1LiveReportBuilder.ts`, pre-fix):

```ts
g2g_consistency: consistency
  ? consistency.overlayGroupCount >= 1
    ? 'passed'
    : 'not_evaluable'
  : 'not_evaluable',
```

Confirmed exactly as suspected: **the only condition checked is `overlayGroupCount >= 1`** — the
gate would report `passed` even if every single overlay group disagreed completely (0% real
agreement). The genuinely-computed agreement rates (`computeConsistencyMetrics`'s
`variantCOutcomeAgreementRate`/`variantCIdentificationAgreementRate`) were already present on the
report object but were **never consulted** by the gate verdict itself.

**Real Variant B/C agreement, vs. the binding Variant A baseline** (from the final combined report's
`consistency` object, over all 16 frozen overlay groups):

| Metric | Value |
| --- | --- |
| Overlay groups evaluated | 16 |
| Variant B outcome agreement | 62.5% |
| Variant B identification agreement | 62.5% |
| **Variant C outcome agreement** | **68.75%** |
| **Variant C identification agreement** | **68.75%** |
| Variant C fast-path deterministic consistency | 100% |
| **Variant A structural baseline** (deterministic, zero-AI, no source of run-to-run variance — `ResolverV3VariantAAdapter.ts`) | **100%** |
| **Variant C gap from A's baseline** | **−31.25 percentage points** |

Variant A never repeats a case in this harness (`RepresentativeHybridV1LiveCaseRecord.variantA` is a
single `CaseEvaluation`, never an array) — its "repeat consistency" is not separately measured
because it is structurally guaranteed by the adapter being a pure, deterministic, BLS-only resolver
with no AI call and no other source of run-to-run variance. This is exactly the "die strukturell nahe
100% liegt" the spec's own parenthetical names, not an assumption invented for this audit.

A 31.25-percentage-point gap between Variant C's real repeat-consistency and Variant A's structural
~100% baseline is a *substantial*, non-trivial number — plausibly what the binding "nicht wesentlich
schlechter" language is meant to catch — but the spec supplies no fixed multiplier/percentage that
would make this decidable by code, and this audit does not invent one.

**Corrected code:** `computeConsistencyMetrics` now also returns `variantAStructuralBaselineRate:
1`, `variantCOutcomeAgreementDeltaFromBaseline`, and `variantCIdentificationAgreementDeltaFromBaseline`,
so the real gap is a first-class, inspectable field, not something a reader has to hand-derive.
`g2g_consistency` now resolves to `requires_human_judgment` when real overlay observations exist,
`not_evaluable` only when there are none — it can never resolve to `passed` purely from group
existence.

**Implication for RESOLVER-V3-041:** the historical `passed` must be discarded. RESOLVER-V3-041
should weigh the real −31.25pp gap above directly, alongside G2-B (false confidence, already
`failed`) and G2-D (latency, already `failed`) — three of seven dimensions now carry genuinely
adverse or unresolved evidence once G2-A/G2-C/G2-G's manufactured `passed` verdicts are corrected.

---

## 7. G2-E — Cost

**Binding rule:** development and holdout must each be evaluated against their **own** telemetry;
averaging or blending the two partitions to hide one is the same anti-pattern this task's own
`overallGateVerdict` combinator already refuses for pass/fail results.

**Original stored verdict:** `not_evaluable` (both partitions) — **this happens to be the correct
final verdict**, but for the wrong reason, computed from the wrong numbers (see below). This is the
one dimension in this audit where the underlying defect did not change the final gate verdict, only
the descriptive numbers behind it — an important, checkable distinction this audit does not gloss
over.

**Defect** (`RepresentativeHybridV1LiveReportBuilder.ts`, pre-fix — `buildRepresentativeHybridV1LiveReport`):

```ts
const development = devByPartition
  ? buildPartitionReport('development', devByPartition, rawTelemetry, params.expectedBehaviorByScenarioId)
  : null;
const holdout = holdByPartition
  ? buildPartitionReport('holdout', holdByPartition, rawTelemetry, params.expectedBehaviorByScenarioId)
  : null;
```

`rawTelemetry` here is the **same, full, combined** Development+Holdout telemetry array
(`runRepresentativeHybridV1Live.harness.ts` builds it as
`combinedTelemetry = [...checkpoint.rawTelemetry, ...rawTelemetry]` before calling the report
builder once for the final report) — and it is passed, **unfiltered, to both** partition-report
calls. Inside `buildPartitionReport`, `cost: computeCostMetrics(telemetry.filter(t => t.variant === 'C'))`
then computes over the full combined C-routed telemetry (97 Development + 30 Holdout = 127 records)
**for both partitions identically.**

**Directly observed in the stored evidence, confirming the defect:** the final combined report
(`logs/resolver-v3-039-controlled-representative-live-evidence.json`) has
`development.cost.n === holdout.cost.n === 127` and
`development.cost.meanCostUsd === holdout.cost.meanCostUsd === 0.003719233870967744` — **byte-identical
between the two partitions**, which is only possible if both were computed over the same underlying
records. (Contrast with `logs/resolver-v3-039-development-diagnostic.json`, generated *before*
Holdout ran, whose `development.cost.n` correctly reads `97` — the defect only manifests once the
final, combined report is built with both partitions present.)

**Corrected numbers, derived from the final report's own `rawTelemetry` array (263 total
records — every field below independently recomputed from that array, not assumed):**

| Partition | Variant | n | known | unknown | sum known cost | mean known cost | input tok | output tok |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Development | B | 108 | 105 | 3 | $0.383359 | $0.003651 | 207,699 | 35,132 |
| **Development** | **C** | **97** | **95** | **2** | **$0.358223** | **$0.003771** | **154,728** | **40,699** |
| Holdout | B | 28 | 26 | 2 | $0.092622 | $0.003562 | 51,422 | 8,240 |
| **Holdout** | **C** | **30** | **29** | **1** | **$0.102962** | **$0.003550** | **47,172** | **11,158** |

(97 + 30 = 127, matching the combined total the buggy code reported for *both* partitions — the sum
was right, the per-partition split was not.)

**Does the corrected result remain `not_evaluable`? Yes — verified directly, not assumed.** Applying
`computeCostMetrics`'s own rule (`not_evaluable` whenever `known.length < n`, i.e. any record has
unknown usage/cost): Development has 2 unknown-cost C records (95 < 97) and Holdout has 1 (29 < 30)
— both partitions independently remain `not_evaluable` under the corrected, partition-scoped
computation, so the combined gate (`overallGateVerdict` requiring both to pass) is unaffected:
**`not_evaluable`, exactly as originally stored.** The coincidence that the corrected per-partition
mean costs ($0.003771 Development, $0.003550 Holdout) are numerically close to the old buggy
combined mean ($0.003719) reflects that both partitions happened to have a similar real per-call
cost profile — it is not evidence the bug was harmless in general, only in this specific instance.

**Corrected code** (`RepresentativeHybridV1LiveReportBuilder.ts`): a `scenarioPartition` map is built
from the real Development/Holdout case records (never from string-matching a case ID's naming
convention), and `rawTelemetry` is filtered through that map into `developmentTelemetry`/
`holdoutTelemetry` **before** either partition's report is built — each partition now receives only
its own share.

**Implication for RESOLVER-V3-041:** the final verdict (`not_evaluable`) is unchanged and remains
correct, but RESOLVER-V3-041 must not cite the old `development.cost.n=127`/`holdout.cost.n=127`
figures — cite the corrected per-partition table in this section instead. If a future live execution
resolves the unknown-cost records (a currently-unresolved evidence limitation, §14 of the closeout
report), the corrected, partition-scoped code will be able to produce a genuine `passed`/`failed`
verdict where the old code structurally could not (it was always going to show a blended, not a
partition-scoped, number).

---

## 8. Technical failures — Variant C `technicalFailureCount`

**Original stored verdict:** `quality.variantC.technicalFailureCount = 0` in **both** partitions
(`logs/resolver-v3-039-development-diagnostic.json`'s `development.quality.variantC.technicalFailureCount`,
and the same field in the final combined report's `holdout.quality.variantC`), despite
`actualUsage.technicalFailureCount` (a *different*, correctly-computed, telemetry-level field) being
`11` for Development and `5` for Holdout.

**Defect** (`RepresentativeHybridV1LiveMetrics.ts`, `computeQualityMetrics`, pre-fix):

```ts
return {
  variantA: armMetrics(a, () => false),
  variantB: armMetrics(bAll, (e) => e.technicalFailure),
  variantC: armMetrics(cAll, () => false),   // <-- hard-coded, always 0
};
```

Variant B's technical-failure predicate correctly reads its own evaluation's `technicalFailure`
boolean field. Variant C's evaluation type (`CaseEvaluationC`, `evaluateVariantCCase.ts`) has no
equivalent boolean field, but it does carry `outcome: VariantCMealResult['outcome']`, whose
10-literal vocabulary (`VariantCTypes.ts`) reserves `'error'` specifically for a call that failed at
the provider/parse layer — confirmed by `RepresentativeHybridV1LiveTelemetryProviders.ts` line
~152–157, which classifies a telemetry record's `providerStatus` as `'network_error'` **if and only
if** `result.outcome === 'error'`. Whoever wrote `armMetrics(cAll, () => false)` never wired this
real signal through — Variant C's technical failures were silently, unconditionally suppressed to
zero at the quality-arm level.

**Corrected code:** `variantC: armMetrics(cAll, (e) => e.outcome === 'error')`.

**Corrected historical numbers.** The stored evidence's `identificationMatchCount`/
`expectedBehaviorMatchCount` numerators are **unaffected** by this fix (verified by code inspection,
not assumed): `evaluateIdentificationC` returns `'no_resolution'` for an outcome with no resolved
component (never `'correct'`/`'acceptable_equivalent'`), and `evaluateExpectedBehaviorC`'s switch has
no branch that returns `{result: 'match'}` for `outcome === 'error'` under any `expectedBehavior`
value — so a technical failure was never counted as a match under the old code either. Only the
**denominator** (`evaluableCount`) was wrong. Recomputed from the ledger's real per-variant,
per-partition terminal-failure counts (§9) cross-referenced against the stored aggregate numerators:

| Partition | caseCount | technicalFailureCount (corrected) | evaluableCount (corrected) | identificationMatchCount | identificationMatchRate (corrected) | expectedBehaviorMatchCount | expectedBehaviorMatchRate (corrected) |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Development | 108 | **8** (was 0) | **100** (was 108) | 33 (unchanged) | **0.330** (was 0.3056) | 16 (unchanged) | **0.160** (was 0.1481) |
| Holdout | 31 | **3** (was 0) | **28** (was 31) | 7 (unchanged) | **0.250** (was 0.2258) | 1 (unchanged) | **0.0357** (was 0.0323) |

`criticalFailureCount` (7 Development, 1 Holdout) is unaffected: `isCriticalFailure = falseConfident
|| partialMisreportedAsComplete`, and `isFalseConfidentC` explicitly returns `false` immediately
whenever the outcome is not `resolved`/`resolved_with_assumptions` — `'error'` never reaches that
branch as true.

**Implication for RESOLVER-V3-041:** the historical Variant C identification/expected-behavior rates
were understated relative to their true evaluable-only value (evaluable denominator was inflated by
including technical failures that could never have counted as matches) — the corrected rates in the
table above are the ones RESOLVER-V3-041 should cite, not the original stored 0.3056/0.1481/0.2258/0.0323.

---

## 9. Terminal failures — complete 16-item reconciliation

All 16 terminal-failure ledger entries were read directly from `logs/resolver-v3-039-call-ledger.jsonl`
(789 rows; a temporary, external, read-only copy was parsed — the original was only ever opened by
the standard `Read`/`sha256sum` tools, never written) and cross-referenced by `callId` against each
call's own `reserved` entry (which carries `scenarioId`/`partition`/`variant`/`kind`) and its own
`terminal_failure` entry (which carries `httpStatus`/`providerStatus`).

### 9a. `httpStatus=null` group (8 records)

| # | Scenario ID | Partition | Variant |
| --- | --- | --- | --- |
| 1 | RH-RES-BRANDED-DEV-001 | Development | B |
| 2 | RH-RES-BRANDED-DEV-001 | Development | C |
| 3 | RH-RES-COMPOSED-DEV-006 | Development | B |
| 4 | RH-RES-OVERLAY-DEV-006 | Development | C |
| 5 | RH-RES-PREPARATION-DEV-005 | Development | B |
| 6 | RH-RES-HOUSEHOLD-HOLD-001 | Holdout | C |
| 7 | RH-RES-HOUSEHOLD-HOLD-002 | Holdout | B |
| 8 | RH-RES-PREPARATION-HOLD-002 | Holdout | B |

(This group mixes Variant B and Variant C failures — note `RH-RES-BRANDED-DEV-001` appears twice,
once per variant, matching the closeout report's "×2 variants" note in its §13.)

### 9b. `httpStatus=200` group (8 records — all Variant C, confirming the closeout's own claim)

| # | Scenario ID | Partition | Variant |
| --- | --- | --- | --- |
| 1 | RH-RES-HOMEMADE-DEV-004 | Development | C |
| 2 | RH-RES-UNRELIABLE-DEV-003 | Development | C |
| 3 | RH-RES-VAGUE-DEV-003 | Development | C |
| 4 | RH-RES-VAGUE-DEV-004 | Development | C |
| 5 | RH-RES-VAGUE-DEV-005 | Development | C |
| 6 | RH-RES-VAGUE-DEV-006 | Development | C |
| 7 | RH-RES-VAGUE-HOLD-001 | Holdout | C |
| 8 | RH-RES-VAGUE-HOLD-002 | Holdout | C |

### 9c. Reconciliation against the flagged prior rehearsal report

A prior read-only rehearsal report (distinct from the closeout report, which already had the correct
8-item list above) listed only 5 Development HTTP-200 IDs — `HOMEMADE-DEV-004`, `UNRELIABLE-DEV-003`,
`UNRELIABLE-DEV-004`, `UNRELIABLE-DEV-005`, `UNRELIABLE-DEV-006` — plus 2 Holdout IDs, totaling 7, one
short of the real 8. Comparing that list against §9b: the rehearsal correctly identified
`HOMEMADE-DEV-004` and `UNRELIABLE-DEV-003`, but **mislabeled three real `VAGUE-DEV-004/005/006`
failures as `UNRELIABLE-DEV-004/005/006`** (a plausible category-name mix-up between the corpus's
`UNRELIABLE` and `VAGUE` case families) and, in doing so, **never listed `RH-RES-VAGUE-DEV-003` at
all**. **The missing 8th HTTP-200 Development call ID is `RH-RES-VAGUE-DEV-003`**
(`callId: call_8c584d9acca59d6e467586d58ca87c21`), found directly in the real call ledger, not
inferred or guessed.

### 9d. By-variant, by-partition totals (all independently recomputed from the ledger, cross-checked
against §8's table and the closeout's own summary)

| | Development | Holdout | Total |
| --- | --- | --- | --- |
| Variant B terminal failures | 3 | 2 | 5 |
| Variant C terminal failures | 8 | 3 | 11 |
| **Total** | **11** | **5** | **16** |

No stored `providerStatus`/`httpStatus`/reason code was relabeled anywhere in this audit — every
value above is quoted exactly as stored in the ledger.

---

## 10. Files changed

**Code (production logic, affects only future executions):**
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveMetrics.ts`
  — extended `GateVerdict`; fixed Variant C `technicalFailureCount` predicate; added
  `computeCategoryQualityBreakdown`/`isIdentificationMatch`/`G2A_AT_LEAST_VARIANT_A_CATEGORIES`/
  `G2A_NO_REGRESSION_CATEGORIES`; added Variant A structural baseline + delta fields to
  `computeConsistencyMetrics`.
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder.ts`
  — fixed G2-E partition-scoped telemetry (scenario→partition map, filtered per partition); fixed
  G2-A to use the category breakdown; fixed G2-C/G2-G to resolve to `requires_human_judgment` instead
  of a manufactured `passed`; added `categoryQuality` to the partition report; Markdown renderer
  updated to surface the new fields.
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportValidator.ts`
  — accepts `requires_human_judgment` as a valid gate-verdict literal.
- `src/features/nutrition/benchmark/representativeHybridV1/live/runRepresentativeHybridV1Live.harness.ts`
  — wires a real `categoryByScenarioId` map (from the frozen corpus) into both report-builder calls,
  so any future live execution gets a faithful G2-A verdict by default.

**Tests (new/extended regression coverage):**
- `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/RepresentativeHybridV1LiveMetrics.test.ts`
  — category-breakdown tests (including the "aggregate would say passed, category-specific correctly
  says failed" case), Variant C technical-failure tests, consistency-baseline/delta tests.
- `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/RepresentativeHybridV1LiveReportBuilder.test.ts`
  (new file) — G2-E partition-scoping proof, G2-C/G2-G never-silently-passing proofs, G2-A
  category-specific proof, and the read-only evidence-file guard (SHA-256 before/after a corrected
  report build).
- `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/RepresentativeHybridV1LiveProtocolV3.test.ts`
  — updated two tests that asserted the frozen protocol-v3 `executionTreeHash` still equals a fresh
  computation; correctly expected to diverge now that this task deliberately changed execution-relevant
  metrics/report-builder code (both files are on that hash's own tracked path list), which is the
  drift-protection mechanism working as designed, not a new defect. The real, already-executed live
  run (execution commit `a67a4d051fd1616cad3a59428b117a717d84f002`) is unaffected — see §2.

**Report/audit (this task's own additive output):**
- `reports/RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md` (this file).
- `reports/resolver-v3-042-gate-evaluator-fidelity-audit.json` (machine-readable companion).
- `ROADMAP.md` — new RESOLVER-V3-042 entry; RESOLVER-V3-041 entry updated to depend on both
  RESOLVER-V3-039 and RESOLVER-V3-042.

**Not touched:** any of the seven canonical evidence files, the closeout report, the evidence
manifest, any production DI/feature-flag/migration/RPC/Supabase/UI file, `ANTHROPIC_API_KEY` (never
read, never set, never inspected).

## 11. Verification

- Focused tests (`RepresentativeHybridV1LiveMetrics.test.ts`, `RepresentativeHybridV1LiveReportBuilder.test.ts`,
  `RepresentativeHybridV1LiveProtocolV3.test.ts`): all pass.
- Full `representativeHybridV1/**` suite: **245/245 tests, 28/28 suites green.**
- Full repository test suite (`npm run test`): **2316/2316 tests, 237/237 suites green.**
- `npm run typecheck`: clean, zero errors.
- `npm run lint`: clean, zero errors.
- `npm run format:check`: reports the same pre-existing 863-file warning count both **before and
  after** every change in this task (confirmed via `git stash`/`git stash pop` against the pristine
  base commit `7d3fa53`) — a repository-wide, environment-level CRLF/LF Prettier mismatch unrelated
  to this task (the same `core.autocrlf=true` condition documented in §2b), not introduced by any
  file this task touched.
- SHA-256 of all seven evidence files: identical before and after (§2).

## 12. Explicit confirmations

- **Zero provider calls made.** No `fetch()`, no live transport, no Anthropic API request anywhere
  in this task's work.
- **Zero benchmark cost incurred.** No Development or Holdout execution was run; no budget gate was
  constructed against a real provider.
- **`ANTHROPIC_API_KEY` never touched** — not read, not set, not inspected, not logged, in any shell
  command, test, or source file written in this task.
- **RESOLVER-V3-041 remains unstarted** (`ROADMAP.md` still reads `todo`) — this task performs no
  gate re-decision, only corrects the evaluator code and reports what the corrected code shows.
- **RESOLVER-V3-010 remains `blocked`** — unaffected by this task.
- No production DI registration, feature flag, migration, RPC, Supabase adapter, or UI/journal file
  was created, modified, or deleted.
