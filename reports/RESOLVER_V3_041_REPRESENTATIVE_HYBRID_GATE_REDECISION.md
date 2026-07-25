# RESOLVER-V3-041 — Representative Hybrid Gate Re-Decision After Controlled Live Evidence

Task ID: RESOLVER-V3-041
Status: **done** (formal re-decision complete). This does **not** mean the Hybrid production gate
passed — see §14.

Machine-readable companion:
[`reports/resolver-v3-041-representative-hybrid-gate-redecision.json`](resolver-v3-041-representative-hybrid-gate-redecision.json).
Every fact in this document agrees exactly with that file.

## 1. Executive decision

**Formal overall verdict: `RESOLVER_V3_G2_NOT_PASSED`.**

Two G2 dimensions fail under deterministic, predeclared, hard/binding criteria computed directly
from byte-verified frozen evidence:

- **G2-B (false confidence):** Development Variant C's false-confidence rate (6.48%) is not
  strictly below Variant A's (5.00%), violating the hard, non-averageable "strictly lower than
  both A and B" criterion.
- **G2-D (latency):** Holdout's AI-routed p95 (12,417.52 ms) and all-attempts p95 (12,428.31 ms)
  both exceed the predeclared 12,000 ms ceiling, violating the one-violation, per-partition-
  independent rule.

Under the binding gate rule ("Kombinierte Dimensionen — alle müssen erfüllt sein", §11), **every**
mandatory dimension must be fulfilled; either failure alone is sufficient to fail G2. Both are
present. Independently, G2-A is indeterminate at the category level, G2-C and G2-G resolve to
`requires_human_judgment` with this task's own explicit adverse judgment on both, and G2-E remains
`not_evaluable`. Only G2-F (provenance) is affirmatively fulfilled.

**`productionWiringAuthorized: false`. RESOLVER-V3-010 remains `blocked`.** Claude Haiku 4.5
remains the sole locked production-model candidate (`HAIKU_4_5_LOCKED_AS_PRODUCTION_CANDIDATE`) —
see §16. Six successor remediation/re-evidence tasks (RESOLVER-V3-043 through RESOLVER-V3-048) are
added — see §17.

This task made **zero provider calls**, reran neither Development nor Holdout, and changed no
production source code.

## 2. Authority hierarchy

Applied in this precedence order, per this task's own binding instructions:

1. Accepted benchmark and gate specifications (`ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11;
   `ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md`).
2. Predeclared cost/latency policy (`ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`).
3. Immutable RESOLVER-V3-039 raw evidence and checkpoints (`logs/resolver-v3-039-*`).
4. RESOLVER-V3-042 evaluator-fidelity erratum and corrected derived audit.
5. Historical reports and `ROADMAP.md` summaries.
6. This task's own prompt and any noncanonical side-branch draft (lowest precedence, used for
   wording ideas only, never as evidence).

Authority files read in full or by targeted section before writing this decision: `AGENTS.md`,
`SSOK.md`, `VERIFY.md`, `ROADMAP.md`, `docs/domains/ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md`,
`docs/domains/ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md`,
`docs/domains/ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md`,
`reports/RESOLVER_V3_024_REPRESENTATIVE_LEARNING_HYBRID_GATE_REDECISION.md`,
`reports/RESOLVER_V3_039_CONTROLLED_LIVE_EVIDENCE_CLOSEOUT.md`,
`reports/resolver-v3-039-controlled-live-evidence-manifest.json`,
`reports/RESOLVER_V3_042_GATE_EVALUATOR_FIDELITY_AUDIT.md`,
`reports/resolver-v3-042-gate-evaluator-fidelity-audit.json`, the corrected
`RepresentativeHybridV1LiveMetrics.ts`/`RepresentativeHybridV1LiveReportBuilder.ts` (PR #169), and
their regression tests, plus all seven canonical V3-039 evidence files.

**Canonical starting commit:** `e5a3a24f97ddb8e56fe19f5f98cff6cf90335a65` (merge commit of PR #169 /
RESOLVER-V3-042). Confirmed as the exact live `origin/chore/clean-arch-structure` tip before any
change — the branch had not advanced, so no later-commit inspection was required.

## 3. Evidence identity and integrity

Byte size and canonical (LF) Git-blob SHA-256 of all seven V3-039 evidence files were recomputed at
the start of this task and compare identical to
`reports/resolver-v3-039-controlled-live-evidence-manifest.json` (which RESOLVER-V3-042 had already
independently reconfirmed). Working-tree CRLF hashes differ from these values on this Windows
checkout (`core.autocrlf=true`, no `.gitattributes eol=lf` override on these paths) — this is
expected and unrelated to file content, per the same class of issue already diagnosed during
RESOLVER-V3-039's own protocol v2→v3 remediation.

| File                                                                | Bytes   | SHA-256 (canonical git blob)                                       |
| ------------------------------------------------------------------- | ------- | ------------------------------------------------------------------ |
| `logs/resolver-v3-039-call-ledger.jsonl`                            | 344296  | `a7a039e7c9035a893c06462751af65332639cf7e110a2afee4153ad99733adf8` |
| `logs/resolver-v3-039-development-checkpoint.json`                  | 1013531 | `1600e9b6f985e1c01978a26ebcc3c2c200add874dd73de97d49a3019b52b0cb4` |
| `logs/resolver-v3-039-development-diagnostic.json`                  | 104301  | `f9e7baa0da355502f36a3279bd65698db6a1c55f2443478b4f112336b78de6c3` |
| `logs/resolver-v3-039-development-diagnostic.md`                    | 4389    | `68d18d604c0069daec9214175e6bd67b9673105f1ee48e8f123fc01ac67cbd4e` |
| `logs/resolver-v3-039-holdout-checkpoint.json`                      | 5828    | `4441247832cc02585384dbf78e4372fe8226947d1aa69c3fd4874de33574a593` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.json` | 134939  | `e27d14a5ee3ba309b4dcf24c9265310baca8d2c393dfcfb949bab2d68f4530e9` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.md`   | 5627    | `a2d636370e4b69d89acf2d4435ecb63c3acd583a092dd54b3bfdfd963e9f1fef` |

**Result: all seven files byte-identical to the manifest.** No evidence file was opened through a
write-capable code path; no formatter or line-ending normalization was run over any evidence file.
Hashes were recomputed a second time immediately before commit — see §19.

## 4. Historical stored verdicts versus RESOLVER-V3-042 corrections

| Dimension | Original V3-039 stored verdict | V3-042 fidelity finding                                                                                                                                                                          |
| --------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| G2-A      | `passed`                       | Aggregate, not per-category; strict `>` not the binding `≥`. Historical per-case category data never persisted → **indeterminate at category level**, not confirmable.                           |
| G2-B      | `failed`                       | Not audited by V3-042; independently re-verified in this task — no defect, evaluator logic is faithful.                                                                                          |
| G2-C      | `passed`                       | Manufactured from `denominator ≥ 30` only, zero correctness check → real figures now exposed, dimension is **`requires_human_judgment`**.                                                        |
| G2-D      | `failed`                       | Not audited by V3-042; independently re-verified in this task — no defect.                                                                                                                       |
| G2-E      | `not_evaluable`                | Blended Development+Holdout telemetry used for both partitions; corrected, partition-scoped computation yields the **same final verdict** (`not_evaluable`), only the underlying numbers change. |
| G2-F      | `passed`                       | Not audited by V3-042; independently re-verified in this task — genuinely per-case computed fields, no defect (one residual note, §11).                                                          |
| G2-G      | `passed`                       | Manufactured from `overlayGroupCount ≥ 1` only, real agreement never consulted → real −31.25pp gap now exposed, dimension is **`requires_human_judgment`**.                                      |

The historical `passed` verdicts for G2-A, G2-C, and G2-G are **discarded as defectively derived**
and are not treated as valid inputs to this re-decision, per this task's own binding instruction.

## 5. G2-A — Representative identification and category quality

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, Gate G2(a): _"Top-1-
Identifikation ≥ Variante A mindestens in `DACH`/`COMPOSED`/`RESTAURANT`, ohne Regression in
`SIMPLE`/`HOUSEHOLD`"_ — per-category, both partitions independently, never a single blended rate.

**Original stored verdict:** `passed`. **V3-042 defect:** aggregate-only whole-corpus comparison
using strict `>`, not the binding per-category `≥`.

**Development evidence (aggregate only — no persisted per-category breakdown):**
identificationMatchRate A=8.75% (7/80), B=28.57% (30/105 evaluable), C=30.56% original /
33.0% corrected-denominator (33/100 evaluable, after the Variant C `technicalFailureCount` fix).

**Holdout evidence (aggregate only):** A=12.50% (3/24), B=50.00% (13/26 evaluable), C=22.58%
original / 25.0% corrected-denominator (7/28 evaluable).

**Holdout controls:** No — neither partition can be evaluated at the category level.

**Evaluability:** `not_evaluable_at_category_level`. The seven evidence files persist only the
already-blended aggregate rates, never a per-case `{scenarioId, category, identification}` table.
Category is derivable from scenario-ID naming convention and the frozen corpus, but the per-case
outcome of the historical live run was never persisted outside process memory — recomputing it
would require re-execution, which this task's hard constraints forbid.

**Formal corrected decision: `indeterminate`.** No human judgment required (this is a data-
availability limitation, not a qualitative question). **Confidence:** high confidence the
historical `passed` is unverified and must not be cited; zero confidence in either a category-level
pass or fail.

**Production consequence:** cannot be cited as satisfying G2(a); treated as not fulfilled.

## 6. G2-B — False confidence

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, Gate G2(b): _"streng
niedriger als A und B (hartes, nicht-vorläufiges Kriterium)"_ — hard, non-provisional, non-
averageable criterion; Variant C strictly lower than **both** A and B.

**Original stored verdict:** `failed`. **V3-042 finding:** G2-B was outside V3-042's audit scope.
Independently re-verified in this task by reading `computeFalseConfidenceMetrics` in
`RepresentativeHybridV1LiveMetrics.ts` side-by-side with the binding rule — the evaluator faithfully
implements "C strictly lower than both A and B" with a `denominator ≥ 30` (all three arms)
evaluability gate. No defect found.

**Development evidence:** n(A)=80, n(B)=108, n(C)=108, all ≥ 30 (evaluable). Rates: A=5.00%
(4/80), B=25.93% (28/108), C=6.48% (7/108). C < B (passes vs. B) but C is **not** < A (0.0648 >
0.05) → **FAILED**. **Controlling case:** `RH-RES-DACH-DEV-006` ("Brötchen", BLS `D771900`)
appears in **both** Variant A's and Variant C's false-confident case-ID lists — Variant C's fast
path is literally Variant A's resolver and inherits the identical false-confidence defect, exactly
as documented in `ZERA_REPRESENTATIVE_HYBRID_BENCHMARK_SPEC_1.md` §10.

**Holdout evidence:** n(A)=24 (< 30) → **not_evaluable** by the predeclared minimum-sample rule,
even though B=35.71% (10/28) and C=3.23% (1/31) are individually computed.
`RH-RES-PREPARATION-HOLD-002` is the one Holdout case flagged false-confident for both A and C.

**Holdout controls:** No. **Evaluability:** Development evaluable, Holdout not_evaluable.

**Formal corrected decision: `failed`.** No human judgment required — hard, deterministic
criterion. **Confidence:** high — recomputed directly from the frozen per-case `caseIds` arrays in
the final evidence report.

**Unresolved limitations:** the dimension's failure rests on Development alone (Holdout is
not_evaluable); per the hard, non-averageable criterion this is sufficient on its own. Root-cause
diagnosis of the controlling Brötchen/`D771900` case (the separate, review-only V3-043 diagnosis on
a noncanonical branch) was **not** used to alter this frozen-evidence verdict, per this task's own
binding instruction — it may inform RESOLVER-V3-043's remediation scope only.

**Production consequence: hard gate failure.** G2 cannot pass regardless of any other dimension.

## 7. G2-C — Clarification, abstention, and user friction

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, Gate G2(c): _"Rückfragenrate
nicht drastisch über dem bestehenden Speck-Präzedenzfall-Volumen — qualitativ zu prüfen, kein
Fixwert"_ — explicitly qualitative, no fixed numeric threshold.

**Original stored verdict:** `passed`. **V3-042 defect:** manufactured purely from
`friction.denominator ≥ 30`, zero correctness check of any kind.

**Development evidence:** denominator=108, clarifications=2 (1.85%), correctClarificationRate=
50.0%, abstentions=43 (39.81%), correctAbstentionRate=**4.65%**.

**Holdout evidence:** denominator=31, clarifications=1 (3.23%), correctClarificationRate=0%,
abstentions=17 (54.84%), correctAbstentionRate=**5.88%**.

**Evaluability:** evaluable, but inherently qualitative.

**Formal corrected decision: `requires_human_judgment`.**

**Human judgment (explicit):** **NOT compatible with a production-quality food-logging experience
as currently observed.** Abstention rates of 39.8% (Development) and 54.8% (Holdout) mean Variant C
declines to resolve roughly two-in-five to one-in-two logs outright; of those abstentions, only
~4.65% (Development) and ~5.88% (Holdout) were actually correct per ground truth — the
overwhelming majority of abstentions were cases Variant C should plausibly have resolved but did
not. This directly conflicts with `SSOK.md`'s "minimize user input friction at all costs" product
principle. Clarification correctness (50% on 2 Development cases, 0% on 1 Holdout case) is too
small-n to draw an independent conclusion, but is not a positive counter-signal either.

**Confidence:** moderate-high on the abstention-correctness conclusion (n=43/17 is a reasonable
sample); low confidence specifically on the clarification sub-metric (n=2/1).

**Unresolved limitations:** per-case category/expected-behavior cross-tabulation was never
persisted, so it is not possible to say which categories drive the poor abstention correctness.

**Production consequence:** formally `requires_human_judgment` (not a hard-failure literal), but
the judgment above is adverse and is treated as **not fulfilled**.

## 8. G2-D — Latency

**Binding authority:** `ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md` §3, §4, §10
(predeclared, binding). Ceilings: fast path ≤1,000 ms; AI-routed single attempt ≤12,000 ms;
retrieval ≤2,000 ms; all-attempts ≤12,000 ms — p95, nearest-rank, over complete end-to-end traces
including technical failures and any retry; `n < 30` for a path/partition is not_evaluable;
partitions evaluated independently, **both must pass**; a single ceiling violation in any gate-
evaluable path/partition fails the dimension for that partition (non-averageable, one-violation
rule).

**Original stored verdict:** `failed`. **V3-042 finding:** G2-D was outside V3-042's audit scope.
Independently re-verified in this task against the policy text — no defect found in the latency
computation or gate logic.

**Development evidence:** fast path n=11 → not_evaluable (n<30). AI-routed single attempt n=97,
p50=4987.46 ms, p95=10117.80 ms → **PASSED** (≤12,000 ms). Retrieval n=86, p50=17.44 ms,
p95=88.86 ms → **PASSED** (≤2,000 ms). All-attempts n=108, p50=4842.31 ms, p95=9401.22 ms →
**PASSED** (≤12,000 ms). Wall-clock ceiling breaches: 0. Development is fully gate-evaluable and
passes every evaluable row.

**Holdout evidence:** fast path n=1 → not_evaluable. AI-routed single attempt n=30 (exactly at the
evaluability floor), p50=4578.23 ms, **p95=12,417.52 ms → FAILED** (exceeds the 12,000 ms ceiling by
417.52 ms, ~3.48%). Retrieval n=25 → not_evaluable (n<30). All-attempts n=31, p50=4612.06 ms,
**p95=12,428.31 ms → FAILED**. Wall-clock ceiling breaches: 0.

**Holdout controls:** Yes — per the policy's per-partition-independent, one-violation rule,
Holdout's failure alone fails G2-D overall; Development's pass does not offset it.

**Formal corrected decision: `failed`.** No human judgment required — deterministic p95 ceiling
check. **Confidence:** high — the Holdout AI-routed p95 (12,417.5241 ms) matches this task's own
pre-verification expectation exactly.

**Unresolved limitations:** Holdout's AI-routed population (n=30) sits exactly at the predeclared
minimum-evaluable sample size — the smallest population the policy still treats as gate-evaluable.
The margin of violation (~3.48% over ceiling) is real but modest, not gross. The policy explicitly
forbids widening the threshold post hoc, and this task does not do so.

**Production consequence: hard gate failure.** G2 cannot pass regardless of any other dimension.

## 9. G2-E — Cost

**Binding authority:** `ZERA_RESOLVER_V3_COST_LATENCY_ACCEPTANCE_POLICY_1.md` §5, §10. Partition-
level mean cost of attempted AI-routed logs ≤ USD 0.02, each partition's own telemetry only; a
missing/unknown-cost record makes the containing partition `not_evaluable`, never `$0` and never a
default pass, unless the missing-usage minority is small enough to still compute a defensible mean
— that determination must be disclosed explicitly, not silently decided.

**Original stored verdict:** `not_evaluable`. **V3-042 defect:** both partitions' cost metrics were
computed over the full combined Development+Holdout Variant C telemetry (n=127 for both) instead of
each partition's own share; the corrected, partition-scoped computation does not change the final
verdict.

**Development evidence (corrected, partition-scoped):** n=97 attempted AI-routed logs, known-
cost=95, unknown-cost=2 (2.06%), sumKnownCostUsd=$0.358223, meanKnownCostUsd=**$0.003771**,
inputTokens=154,728, outputTokens=40,699.

**Holdout evidence (corrected, partition-scoped):** n=30 attempted AI-routed logs, known-cost=29,
unknown-cost=1 (3.33%), sumKnownCostUsd=$0.102962, meanKnownCostUsd=**$0.003550**,
inputTokens=47,172, outputTokens=11,158.

**Evaluability:** `not_evaluable`, both partitions.

**Formal corrected decision: `not_evaluable`.**

**Explicit disclosure required by the policy's own discretion clause:** the policy text allows
discretion to still compute a defensible mean when the missing-usage minority is small (here 2.06%
Development, 3.33% Holdout). The actual evaluator code implements a stricter any-unknown-record-
fails rule, and both partitions remain `not_evaluable` under that implemented rule. This task does
not modify evaluator code, so the implemented rule's output is what is formally cited. **As a
disclosed observation only, not a formal override:** both partitions' known-cost means ($0.003771,
$0.003550) sit approximately 5.3x–5.6x below the $0.02 ceiling. Complete provider cost remains
unknown — 8 of 263 total records across the full run have unknown usage/cost, and no external
Anthropic Console billing export has been supplied.

**Confidence:** high on the corrected per-partition arithmetic (matches RESOLVER-V3-042's own table
exactly).

**Production consequence:** not fulfilled; does not independently change the overall verdict since
G2-B and G2-D already fail.

## 10. G2-F — Provenance and nutrient authority

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, Gate G2(f): _"keine
unbelegten autoritativen Zahlen — hartes Kriterium, keine Ausnahme"_ — hard criterion, no
exception; `ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md` (AI outputs are observations,
never authoritative nutrients).

**Original stored verdict:** `passed`. **V3-042 finding:** G2-F was outside V3-042's audit scope.
Independently re-verified in this task by reading `computeProvenanceMetrics`.

**Development evidence:** n=108: sourceGroundedRate=54.63% (59/108), missingProvenanceCount=0,
unbackedNumericResultCount=0, aiNutrientBecameAuthorityCount=0.

**Holdout evidence:** n=31: sourceGroundedRate=35.48% (11/31), missingProvenanceCount=0,
unbackedNumericResultCount=0, aiNutrientBecameAuthorityCount=0.

**Evaluability:** evaluable. **Formal corrected decision: `passed`.** No human judgment required.

**Confidence:** high — zero unbacked numeric results and zero missing provenance across all 139
combined Variant C cases. `unbackedNumericResultCount`/`missingProvenanceCount` are genuinely
per-case computed fields, independently confirmed by code reading (used in
`RepresentativeHybridV1MetricsAggregator.ts` and asserted directly in
`RepresentativeHybridV1ThreeArmBoundary.test.ts`).

**Unresolved limitations (residual note, not a defect):** `aiNutrientBecameAuthorityCount` is a
code-inspection-verified structural invariant — the source comments it as always `0` by
construction, since no code path in the Variant C adapter ever assigns an AI-produced numeric value
as an authoritative macro — rather than a per-case runtime measurement like the other two
provenance fields. This is a residual evidence-contract limitation worth closing in
RESOLVER-V3-048's category-level/per-case evidence persistence. `sourceGroundedRate` itself
(54.6%/35.5%) is materially below 100%, a related but distinct signal from the hard pass/fail
criterion, disclosed for completeness.

**Production consequence:** fulfilled. Does not independently change the overall verdict since
G2-B and G2-D already fail.

## 11. G2-G — Repeat consistency

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, Gate G2(g): _"Konsistenz:
Wiederholungs-Übereinstimmungsrate nicht wesentlich schlechter als As (die strukturell nahe 100%
liegt)"_ — qualitative, no fixed multiplier.

**Original stored verdict:** `passed`. **V3-042 defect:** manufactured purely from
`overlayGroupCount ≥ 1`, real agreement never consulted.

**Combined evidence (not partition-split — computed once over all 16 frozen overlay groups):**
overlayGroupCount=16, Variant B outcome/identification agreement=62.5%, **Variant C outcome/
identification agreement=68.75%**, Variant C fast-path deterministic consistency=100%, **Variant A
structural baseline=100%** (structural, not separately measured — Variant A is deterministic,
BLS-only, no source of run-to-run variance), **Variant C gap from baseline=−31.25 percentage
points**.

**Evaluability:** evaluable, but inherently qualitative.

**Formal corrected decision: `requires_human_judgment`.**

**Human judgment (explicit):** a 31.25-percentage-point gap between Variant C's real repeat
agreement (68.75%) and Variant A's structural ~100% baseline is a substantial, non-trivial
degradation — roughly one in three semantically-identical repeated/paraphrased log entries would be
classified differently on repetition. In this task's judgment this qualifies as "wesentlich
schlechter" (substantially worse) than the baseline and does not meet the qualitative bar the spec
intends, representing a real user-facing consistency problem.

**Confidence:** moderate — n=16 overlay groups is a small sample for a percentage-point estimate;
Variant B's own agreement (62.5%) is also mediocre, suggesting part of the gap may reflect corpus/
ground-truth ambiguity rather than being attributable to Variant C alone, which tempers but does not
reverse the adverse judgment.

**Unresolved limitations:** small n=16 sample; metric is not partition-split; attribution between
corpus-level ambiguity and model-level inconsistency is not fully separable from this evidence
alone.

**Production consequence:** formally `requires_human_judgment` (not a hard-failure literal), but
the judgment above is adverse and is treated as **not fulfilled**.

## 12. Reliability and terminal-failure implications

263 planned calls, **16 terminal failures (6.08%)** — 11 Development / 5 Holdout, 5 Variant B / 11
Variant C. Of these, **8 returned HTTP 200 with billed usage but were still classified
`network_error`** at the parse/interpretation layer, not the transport layer — an error-taxonomy
defect distinct from the seven named G2 dimensions, feeding RESOLVER-V3-046's scope. A ~6%
terminal-failure rate is itself a production-readiness concern independent of the G2 gate.

## 13. Overall gate rule

**Binding authority:** `ZERA_FOOD_RESOLUTION_BENCHMARK_SPEC_1.md` §11, gate table row G2:
_"Kombinierte Dimensionen (alle müssen erfüllt sein)"_ — all seven G2 sub-dimensions (a–g) must be
fulfilled (resolve to an affirmative `passed`) for G2 to pass. A dimension resolving to `failed`,
`not_evaluable`, `indeterminate`, or an adverse `requires_human_judgment` is **not** fulfilled. No
dimension is averaged against another; a single unfulfilled mandatory dimension is sufficient to
fail G2. No conditional-pass path is defined by the binding spec. G3 (RESOLVER-V3-010's own
justification gate) requires G2 passed **and** the cost/latency model reviewed **and** the
personal-memory cache read path existing — since G2 fails, G3 is not reached.

## 14. Overall formal verdict

**`RESOLVER_V3_G2_NOT_PASSED`.**

This verdict is decidable, not indeterminate: G2-B and G2-D rest on deterministic evidence and
predeclared, non-post-hoc thresholds that require no qualitative judgment to apply, and both fail.
Under the binding "all dimensions must be fulfilled" rule, either failure alone is sufficient. This
is not chosen because the task prompt expected a result — it is the direct, evidence-cited
consequence of applying the binding rule to the byte-verified frozen evidence.

## 15. RESOLVER-V3-010 consequence

**`productionWiringAuthorized: false`. RESOLVER-V3-010 remains `blocked`.** Its `ROADMAP.md`
dependency list is updated to add RESOLVER-V3-041 and RESOLVER-V3-048 (in addition to its existing
RESOLVER-V3-006/RESOLVER-V3-019 dependencies). It may only become unblocked once RESOLVER-V3-048
produces new, complete, Haiku-only live evidence that genuinely passes every mandatory G2 dimension
under this same binding rule.

## 16. Haiku-only model policy

Per this task's own binding product-owner instruction, recorded as a decision (not derived from
benchmark evidence):

- **Claude Haiku 4.5 is the sole intended production-model candidate** for the Hybrid Resolver P0
  critical path. Reference identity (from V3-039): provider `anthropic`, alias `claude-haiku-4-5`,
  snapshot `claude-haiku-4-5-20251001`.
- Sonnet is not part of the current critical path; no larger-model fallback or escalation is
  authorized.
- Failure of the current implementation (this re-decision's `NOT_PASSED` verdict) is **not** proof
  that Haiku itself is unsuitable — routing, fast-path safety, prompt/schema design, parsing,
  clarification, abstention, consistency, reliability, and latency must be remediated first (§17).
- Domain/application contracts remain provider-neutral; AI remains non-authoritative for nutrient
  values (confirmed by G2-F, §10).
- Status literal: `HAIKU_4_5_LOCKED_AS_PRODUCTION_CANDIDATE`. Model selection is **not** described
  as unresolved. A future larger-model reconsideration is not scheduled and requires a separate,
  explicit product-owner decision after complete Haiku remediation and valid re-evidence.

## 17. Mandatory remediation path

Six successor tasks are added to `ROADMAP.md` under Hybrid production readiness (project priority
**P0**):

- **RESOLVER-V3-043 — Unsafe Fast-Path and False-Confidence Remediation.** Fixes the G2-B
  controlling defect (the `RH-RES-DACH-DEV-006` "Brötchen"/`D771900` fast-path false-confidence case
  and the other 6 Development + 1 Holdout flagged cases). Depends on RESOLVER-V3-041.
- **RESOLVER-V3-044 — Clarification, Abstention, and Confidence-Policy Remediation.** Fixes the
  G2-C poor abstention-correctness finding (~4.65%/5.88%). Depends on RESOLVER-V3-041.
- **RESOLVER-V3-045 — Haiku Interpretation Determinism and Repeat-Consistency Remediation.** Fixes
  the G2-G −31.25pp consistency gap. Depends on RESOLVER-V3-041.
- **RESOLVER-V3-046 — Haiku Response Contract, Parsing, Reliability, Error Taxonomy, and Latency
  Remediation.** Fixes the 16/263 terminal-failure rate (including the 8 HTTP-200-but-misclassified
  records, §12) and the G2-D Holdout latency ceiling breach. Depends on RESOLVER-V3-041.
- **RESOLVER-V3-047 — Haiku Optimization Candidate Evaluation.** Haiku-only comparison of controlled
  prompt/schema/normalization/routing/validation/timeout/retry/context variants against the
  remediated baseline — not a model bakeoff. Depends on RESOLVER-V3-043 through RESOLVER-V3-046.
- **RESOLVER-V3-048 — Protocol-v4 Evidence Contract and Controlled Haiku Live Re-Evidence.** New
  protocol version, fresh execution-tree hash, frozen corpus/source/plan identities, category-level
  evidence persistence (closing G2-A's indeterminacy), the already-corrected evaluator (V3-042),
  complete cost/failure telemetry, explicit budget authorization, immutable preservation of V3-039
  history, Development → inspection → Holdout, no production wiring. Depends on RESOLVER-V3-042 and
  RESOLVER-V3-043 through RESOLVER-V3-047.

Full definitions (status, dependencies, goal, scope, affected subsystems, non-goals, risks, tests,
acceptance, provider-call policy, evidence-mutation policy) are recorded in `ROADMAP.md`.

**This task does not implement any of RESOLVER-V3-043 through RESOLVER-V3-048.** The existing
review-only Brötchen root-cause diagnosis on the noncanonical
`claude/resolver-v3-041-haiku-binding-a1glb1` branch may later refine RESOLVER-V3-043's scope but is
not itself versioned or implemented by this task.

## 18. No-production-effect statement

This task made **zero Anthropic/provider calls**, incurred **zero additional benchmark cost**,
reran neither Development nor Holdout, and changed no BLS data, alias, lookup, parser, routing,
prompt, provider, or feature-flag code. Its only repository effects are this report, its JSON
companion, `ROADMAP.md`, and `handoffs/latest-handoff.md`. All seven RESOLVER-V3-039 evidence files
remain byte-identical to their PR #168-merged content (§3, §19). `ANTHROPIC_API_KEY` presence was
checked as a boolean only (absent) at the start of this task; its value was never printed, inspected,
copied, requested, or persisted.

## 19. Evidence-hash appendix

Recomputed immediately before commit, identical to §3:

| File                                                                | SHA-256 (canonical git blob)                                       |
| ------------------------------------------------------------------- | ------------------------------------------------------------------ |
| `logs/resolver-v3-039-call-ledger.jsonl`                            | `a7a039e7c9035a893c06462751af65332639cf7e110a2afee4153ad99733adf8` |
| `logs/resolver-v3-039-development-checkpoint.json`                  | `1600e9b6f985e1c01978a26ebcc3c2c200add874dd73de97d49a3019b52b0cb4` |
| `logs/resolver-v3-039-development-diagnostic.json`                  | `f9e7baa0da355502f36a3279bd65698db6a1c55f2443478b4f112336b78de6c3` |
| `logs/resolver-v3-039-development-diagnostic.md`                    | `68d18d604c0069daec9214175e6bd67b9673105f1ee48e8f123fc01ac67cbd4e` |
| `logs/resolver-v3-039-holdout-checkpoint.json`                      | `4441247832cc02585384dbf78e4372fe8226947d1aa69c3fd4874de33574a593` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.json` | `e27d14a5ee3ba309b4dcf24c9265310baca8d2c393dfcfb949bab2d68f4530e9` |
| `logs/resolver-v3-039-controlled-representative-live-evidence.md`   | `a2d636370e4b69d89acf2d4435ecb63c3acd583a092dd54b3bfdfd963e9f1fef` |

Zero drift confirmed — see §21 (verification) in the handoff for the exact re-verification command
output.
