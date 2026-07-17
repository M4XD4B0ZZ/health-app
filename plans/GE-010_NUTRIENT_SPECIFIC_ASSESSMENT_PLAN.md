# GE-010 — Nutrient-Specific Mixed-State Daily Assessment — Planning

Status: `planning` (review-only — no product code, tests, schema, formulas or thresholds
changed by this document)
Owner task: **GE-010** (ROADMAP.md, Dashboard & Insights)
Origin: native dogfooding 2026-07-17,
[`reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md`](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md)
Finding 4. Grounded in the accepted `docs/vision/ZERA_PRODUCT_BIBLE.md` (§3/§4).

---

## 0. Purpose

Design the **smallest safe** change so the daily assessment truthfully represents **mixed**
states — naming the actually out-of-corridor nutrient instead of the blanket „Über dem Ziel" —
without changing targets, thresholds or formulas, without turning macro corridors into medical
limits, without moralizing language, and without the summary contradicting the detailed rule
output. This is review-only; each decision below feeds a later GE-010 **Act** step.

---

## 1. Current-state flow (verified by code inspection)

```
Journal entries ─(aggregateConsumed)→ consumed macros
        │
        ▼
calculateDailyProgress(consumed, goals)  ── features/goals ProgressCalculator (unchanged)
        │
        ▼
dailyProgressToEvaluationOutput(progress, goals, overCaloriesWarning)  ── GE-004
        │  builds goalProgress[] (calories/protein/carbs/fat), each status via statusFor()
        │  assessment = goalProgress.some(over) ? 'over' : 'on-track'   ◀── the defect
        ▼
Rule.evaluate (CalorieMacroCorridorRule | ProteinPreservingDeficitRule)
        │  adds per-dimension insights + recommendations (already nutrient-specific)
        ▼
mergeRuleResults(results[])  ── GE-003
        │  assessment = some('over') ? 'over' : every('on-track') ? 'on-track' : results[0]
        │  (empty results[] → 'no-data')
        ▼
EvaluationOutput { assessment: string, insights[], warnings[], recommendations[], goalProgress[] }
        │
        ▼
EvaluationSummaryScreen → formatAssessment(assessment) → „Heutige Bewertung"
        │  ASSESSMENT_LABELS: 'on-track'→„Im Zielkorridor", 'over'→„Über dem Ziel",
        │  'no-data'→„Keine Daten"
        ▼
also renders Fortschritt (per-dimension), Einordnung (insights), Empfehlungen, Hinweise
```

### 1.1 Key facts (answers to the planning questions)

- **Q1 global-status model:** `EvaluationOutput.assessment` is a single `string`. In practice
  only three values are ever produced: `'over'`, `'on-track'`, `'no-data'`. **It is never
  `'under'`.**
- **Q2 producible statuses:** per **dimension**, `statusFor()` yields `'under' | 'ontrack' |
'over'`. The **global** assessment yields only `'over' | 'on-track' | 'no-data'` — there is no
  global „under" and no global „mixed".
- **Q3 mergeRuleResults selection:** `some('over') → 'over'`, else `every('on-track') →
'on-track'`, else `results[0].assessment`; empty → `'no-data'`. Today every profile has
  exactly one rule, so the merge is effectively pass-through.
- **Q4 does one „over" dominate:** **Yes.** In `dailyProgressToEvaluationOutput`,
  `goalProgress.some((g) => g.status === 'over')` makes a single over-corridor macro (fat) set
  the whole-day assessment to `'over'` → „Über dem Ziel", even when calories/protein/carbs are
  all `under`. This is the native reproduction.
- **Q5 corridor rules that exist:** exactly one — `statusFor(consumed, target)`:
  `target ≤ 0 → 'under'`; `consumed > target*1.05 → 'over'`; `consumed ≥ target*0.95 →
'ontrack'`; else `'under'`. A single symmetric **±5 %** corridor. **No** severity/magnitude
  tiers (no „slight vs. material") exist anywhere.
- **Q6 thresholds per profile:** the **corridor width is identical** (±5 %) for Evidence-based
  Standard and Weight Loss — both call the same `statusFor`/`dailyProgressToEvaluationOutput`.
  What differs is the **targets**: Weight Loss uses `suggestDailyGoals(tdee*0.8, 'high_protein')`
  (deficit + high-protein split); Evidence-based uses the user's `DailyGoals`. So the _meaning_
  of „calories under target" differs by profile even though the threshold is the same.
- **Q7 evaluated dimensions:** calories, protein, carbs, fat — exactly these four. No fiber/
  sugar/cholesterol dimensions are evaluated today (those are Bible §10 future rules).
- **Q8 summary/insight/recommendation generation:** `assessment` from the collapse above;
  `warnings` from `progress.isOverCalories` (calorie-only); `insights`/`recommendations` added
  per rule from **individual** dimension statuses (e.g. protein-under → „Noch N g Protein
  übrig…"; Weight-Loss calories-not-over → deficit-pace insight; protein-under →
  protein-priority recommendation).
- **Q9 can summary contradict detail:** **Yes, today it does.** Native case: `assessment='over'`
  („Über dem Ziel") while `recommendations` includes „Kalorienziel ist noch nicht erreicht…"
  and `insights` includes „Noch N g Protein übrig…". Summary says over, detail says under.
- **Q10 accepted wording:** the Product Bible fixes **no** exact assessment strings; §3 uses the
  example „Tag im Zielkorridor" and §4 requires an explainable „Ampel-/Fortschrittsstatus". The
  only strings currently **locked by tests** are the presentation labels
  („Im Zielkorridor" / „Über dem Ziel" / „Keine Daten",
  `evaluationSummaryDisplay.test.ts`). Treat those three as **accepted**; any new string is
  **proposed, approval-pending**.
- **Q11 domain vs. presentation:** removing the contradiction requires a **domain** change (the
  collapse lives in `dailyProgressToEvaluationOutput`/`mergeRuleResults`). The per-dimension
  facts already exist in `goalProgress`; the presentation must **not** re-derive status (that
  would duplicate rule logic — forbidden). Presentation should only _format_ domain-provided
  structured facts.
- **Q12 one global status or structured:** recommendation is to **keep a single overall
  orientation for back-compat consumers but add explicit dimension-level detail** the summary
  and recommendations both read from — see §4.

### 1.2 Second, related defect found (in scope to fix, same root)

Because the collapse is `some over ? 'over' : 'on-track'`, a day where **nothing** is over but
several dimensions are **under** (including an **empty journal**: consumed 0 → every dimension
`under`) currently returns `assessment = 'on-track'` → „Im Zielkorridor". An empty or
substantially-under day should not read as „im Korridor". This is the same collapse bug in the
opposite direction and must be covered by the target model (scenarios 6, 10, 11).

---

## 2. Proven root cause

`dailyProgressToEvaluationOutput` (`src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts:66`)
reduces four independent per-dimension corridor statuses to a single global label with a pure
OR over „over": `assessment: goalProgress.some((g) => g.status === 'over') ? 'over' :
'on-track'`. This (a) lets one over-corridor macro classify the whole day as over, and (b) maps
every not-over day — including all-under and empty — to on-track. `mergeRuleResults` preserves
the same OR-over semantics across rules. The presentation faithfully renders whatever string it
is given, so **the fix belongs in the evaluation domain output model, not in the label map.**

---

## 3. Semantic principles the target model must hold (from the brief + Product Bible)

1. Numerical facts (`goalProgress` consumed/target/remaining) stay authoritative and unchanged.
2. A mixed state stays visibly mixed; one over-macro must not globally classify the day.
3. The summary names the relevant dimension where useful.
4. Macro corridors are **orientation values, not medical maximums** (Bible §3: „Makro-Korridor"
   vs. „Grenzwert"). No „limit/exceeded-limit" framing for macros.
5. No moral language („gut/schlecht/ungesund/gescheitert") — consistent with Bible §2.
6. No alarm language for small deviations.
7. Preserve honest uncertainty when data is missing/partial.
8. Summary and recommendation must not contradict (both derive from the same `goalProgress`).
9. Evaluation stays profile-dependent; Weight-Loss interpretation of „calories under" (desired
   deficit) must not be worded like Evidence-based (possible under-eating).
10. **No new thresholds** without an accepted source — only the existing ±5 % corridor may be
    used unless a magnitude threshold is explicitly approved (see §5 wording matrix).

---

## 4. Proposed target model

### 4.1 Recommended architecture — Option C (minimal structured aggregate)

Add a small, **additive** structured field to `EvaluationOutput`, computed deterministically in
the domain from the already-existing `goalProgress` statuses; keep the legacy `assessment`
string field for back-compat, but change how it is derived so it is no longer contradictory.

```ts
// additive to EvaluationOutput (domain)
type AssessmentOrientation = 'in-corridor' | 'below' | 'over' | 'mixed' | 'no-data';

interface DimensionDeviation {
  label: 'calories' | 'protein' | 'carbs' | 'fat';
  direction: 'under' | 'over';
}

interface AssessmentDetail {
  orientation: AssessmentOrientation;
  deviations: DimensionDeviation[]; // dimensions outside their corridor, in a stable order
  primary?: DimensionDeviation; // the one dimension to name in the summary (see §4.3)
}
```

- `orientation` derivation (facts only, no new thresholds — see §4.2).
- `deviations` = the `goalProgress` entries whose status ≠ `ontrack`, mapped to
  under/over, in a fixed dimension order (calories, protein, carbs, fat).
- `primary` = the deviation the summary should name (precedence in §4.3).

The **presentation** renders a nutrient-specific summary from `AssessmentDetail` via an extended
`formatAssessment` (facts → wording; no status logic in the UI). Recommendations/insights are
unchanged (already nutrient-specific) and now consistent with the summary because both derive
from the same `goalProgress`.

**Why Option C over the alternatives (brief A/B/C/D):**

- **A (presentation-only composition)** — rejected: the UI would re-derive over/under from
  `goalProgress`, duplicating rule logic (explicitly forbidden) and making the domain output
  still self-contradictory for any other consumer.
- **B (a new mixed-state aggregate _type_ only)** — subset of C; C additionally keeps a single
  orientation for back-compat and defines the primary-dimension precedence, which B leaves
  unspecified.
- **D (reuse an existing abstraction)** — `goalProgress[].status` is the existing per-dimension
  abstraction and is reused as the single source; C adds only the _aggregation_ that is missing.
  No smaller existing abstraction expresses „overall orientation + named dimension".

**Legacy `assessment` string:** keep the field, but redefine its produced values to match the
orientation enum (`'in-corridor' | 'below' | 'over' | 'mixed' | 'no-data'`). This is the one
domain-visible behavior change and will require updating the assessment-asserting tests (§6).

### 4.2 `orientation` derivation (deterministic, only the existing corridor)

Let `over` = count of dimensions with status `over`, `under` = count with status `under`,
`total` = evaluated dimensions (4 today), `hasData` = at least one journal entry / any consumed

> 0.

| Condition                                          | orientation   |
| -------------------------------------------------- | ------------- |
| no rule results / no goals resolvable              | `no-data`     |
| `hasData` is false (empty journal, all consumed 0) | `no-data`     |
| `over == 0 && under == 0`                          | `in-corridor` |
| `over > 0 && under == 0`                           | `over`        |
| `over == 0 && under > 0`                           | `below`       |
| `over > 0 && under > 0`                            | `mixed`       |

No magnitude tier is used here — only the existing ±5 % corridor. „mixed" is the native case
(fat over, others under). This removes both the false-`over` and the false-`on-track` (empty/
all-under) collapses.

> **Open decision D-1 (empty journal):** treat an empty/all-under-with-zero-consumed day as
> `no-data` („Noch nichts protokolliert") rather than `below`. Recommended: `no-data` when
> nothing is logged; `below` only when there is real consumption that is under corridor. Confirm
> against the accepted „Keine Daten" label at implementation time.

### 4.3 `primary` dimension precedence (which nutrient the summary names)

When several dimensions deviate, name one in the summary (others go to secondary context).
Deterministic precedence, **profile-aware only in wording, not in fact selection**:

1. If any `over` deviation exists → `primary` = the first `over` deviation in fixed order
   (calories, protein, carbs, fat). Rationale: an over-corridor value is the more actionable
   „achtung"-signal; naming it is the native expectation („Fettziel … überschritten").
2. Else (only `under`) → `primary` = calories if calories is under, else the first under in
   fixed order. Rationale: calories is the top-level orientation dimension.
3. `no-data`/`in-corridor` → no `primary`.

Ties are broken by the fixed dimension order, so the output is fully deterministic.

### 4.4 Profile-dependence of wording (not of facts)

The `AssessmentDetail` facts are profile-neutral. The **interpretation** differs only in the
already-per-profile insights/recommendations and, if needed, in the secondary-context wording:

- Evidence-based Standard: „Kalorien unter dem Ziel" reads as informational (may still eat).
- Weight Loss: „Kalorien unter dem Ziel" is the **intended** deficit — the existing
  ProteinPreservingDeficitRule already frames this positively; the summary must therefore state
  the **fact** („Kalorien unter dem Tagesziel") **without** an Evidence-based „iss mehr"
  implication. Recommendation D-2: the primary summary states the neutral fact; any „eat
  more"/„good deficit" nuance stays in the profile's own recommendation (already the case),
  keeping summary↔recommendation non-contradictory.

---

## 5. Decision & wording matrix (required scenarios)

Corridor = ±5 %. „over/under/in" = per-dimension `statusFor`. Wording status: **[A]** accepted
existing, **[P]** proposed, approval-pending. All proposed strings are examples for the Act task
to finalize against accepted terminology — none are locked here.

| #   | Scenario (profile)                                           | Dimension states                  | orientation    | primary    | Proposed primary summary                                    | Secondary context                                      | Recommendation behavior                      |
| --- | ------------------------------------------------------------ | --------------------------------- | -------------- | ---------- | ----------------------------------------------------------- | ------------------------------------------------------ | -------------------------------------------- |
| 1   | All within corridor (either)                                 | all `ontrack`                     | `in-corridor`  | –          | „Im Zielkorridor" **[A]**                                   | none                                                   | none new                                     |
| 2   | **Native**: cal 1363/2449, P 97/153, C 47/276, F 87/82 (Evi) | cal/P/C under, fat over           | `mixed`        | fat over   | „Fettziel überschritten" **[P]**                            | „Kalorien liegen noch unter deinem Tagesziel." **[P]** | existing protein-remaining / cal-not-reached |
| 3   | Calories above, macros within (either)                       | cal over, others `ontrack`        | `over`         | cal over   | „Kalorienziel überschritten" **[P]**                        | none                                                   | existing calorie warning                     |
| 4   | Protein below, others within (either)                        | protein under, others `ontrack`   | `below`        | protein    | „Proteinziel noch nicht erreicht" **[P]**                   | none                                                   | existing protein insight                     |
| 5   | Several dimensions above (either)                            | ≥2 `over`                         | `over`         | first over | „Mehrere Ziele überschritten (z. B. Fett)" **[P]**          | list other over dims **[P]**                           | existing warnings                            |
| 6   | Calories + several macros below (either)                     | cal + macros under                | `below`        | calories   | „Unter dem Tagesziel" **[P]**                               | name under dims **[P]**                                | none alarmist                                |
| 7   | Calories above while protein below (either)                  | cal over, protein under           | `mixed`        | cal over   | „Kalorienziel überschritten" **[P]**                        | „Protein liegt noch unter dem Ziel." **[P]**           | existing protein recommendation              |
| 8   | One dimension slightly outside                               | one `over`/`under` (≈±5–10 %)     | `over`/`below` | that dim   | dimension-named, **no** „leicht/deutlich" **[P]**           | none                                                   | none new                                     |
| 9   | One dimension substantially outside                          | one `over`/`under` (large)        | `over`/`below` | that dim   | dimension-named **[P]**                                     | none                                                   | existing warning if calorie-over             |
| 10  | No journal entries                                           | all `under` (consumed 0), no data | `no-data`      | –          | „Noch nichts protokolliert" **[P]** / „Keine Daten" **[A]** | none                                                   | none                                         |
| 11  | Partial-day data                                             | mix, real consumption             | per §4.2       | per §4.3   | as above, no „end-of-day" framing **[P]**                   | optional „bisher heute" **[P]**                        | non-alarmist                                 |
| 12  | Missing/unavailable targets (`target ≤ 0`)                   | affected dims `under` (statusFor) | see D-3        | see D-3    | avoid implying a real target **[P]**                        | „Ziel nicht gesetzt" **[P]**                           | link to Ziele                                |
| 13  | Evidence-based Standard (baseline)                           | —                                 | per §4.2       | per §4.3   | as above                                                    | informational                                          | Evidence-based recommendations               |
| 14  | Weight Loss                                                  | calories under = intended deficit | per §4.2       | per §4.3   | neutral fact, **no** „iss mehr" **[P]**                     | deficit-positive stays in recommendation               | deficit/protein recommendations              |
| 15  | Manual macro distribution × both goals                       | targets from manual/preset goals  | per §4.2       | per §4.3   | identical logic; targets differ only                        | as per profile                                         | as per profile                               |

> **Open decision D-3 (missing targets):** `statusFor` returns `under` when `target ≤ 0`. The
> summary must not then say „unter dem Ziel" as if a real target existed. Recommended: detect
> `target ≤ 0` and treat that dimension as „Ziel nicht gesetzt" (excluded from over/under counts,
> surfaced as its own note). Confirm against how Ziele currently guarantees targets before the
> Auswertung renders (GoalsNotFoundError path already blocks the no-goals case).

### 5.1 Magnitude words („leicht/deutlich") — deferred

The report's illustrative „Fettziel **leicht** überschritten" needs a **second** threshold
(slight vs. material) that does not exist today. Per principle 10, **do not invent it** in the
first Act pass. Recommendation: ship the nutrient-specific summary **without** magnitude
adjectives („Fettziel überschritten"); register a magnitude tier as a **proposed, approval-
pending** follow-up only if product wants „leicht/deutlich", with an explicit accepted threshold
(e.g. a second corridor band). Marked **[P]**, out of scope for the minimal Act.

---

## 6. Exact affected files (later GE-010 Act task)

- `src/features/evaluation/domain/models/EvaluationContract.ts` — add the additive
  `AssessmentDetail`/`AssessmentOrientation`/`DimensionDeviation` types; keep `EvaluationOutput`
  fields, add `assessmentDetail`.
- `src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts` — replace the
  `some(over) ? 'over' : 'on-track'` collapse with the §4.2 orientation + §4.3 primary +
  `deviations`; set `assessment` to the orientation code; **no** change to `statusFor`/targets.
- `src/features/evaluation/application/mergeRuleResults.ts` — aggregate `assessmentDetail`
  across rules consistently with the new orientation (today single-rule, so effectively
  pass-through; define multi-rule merge = union of deviations, orientation recomputed).
- `src/presentation/features/evaluationSummary/evaluationSummaryDisplay.ts` — extend
  `formatAssessment` (and add a small pure `buildAssessmentSummary(detail)`), mapping orientation
  - primary + secondary deviations to accepted/approved German strings; keep „Im Zielkorridor"/
    „Keine Daten".
- `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — render the primary
  summary + optional secondary context from `assessmentDetail` (presentation only, no status
  logic).
- **No change** to: `statusFor` corridor, targets, `calculateDailyProgress`, `suggestDailyGoals`,
  metabolism, journal, persistence/schema, resolver, navigation.

---

## 7. Test plan (later Act task)

- **Domain unit** (`dailyProgressToEvaluationOutput`): scenarios 1–12 → assert `orientation`,
  `deviations` (set + directions), `primary`, and that `goalProgress` numbers are unchanged;
  explicit native case (2) → `mixed` + `primary=fat/over` + calories/protein/carbs in
  `deviations` as `under`; empty/all-under (10/6) → not `over`/`in-corridor`.
- **Merge** (`mergeRuleResults`): single-rule pass-through unchanged; a synthetic two-rule case
  → union of deviations + recomputed orientation; empty → `no-data`.
- **Composition** (`evaluationSummaryDisplay`): each orientation + primary → the accepted/
  approved string; „Im Zielkorridor"/„Keine Daten" preserved; summary never contradicts the
  deviation set (a property test: if `primary.direction==='under'` the string contains no
  „überschritten").
- **Profile regression:** EvidenceBasedStandardProfile and WeightLoss end-to-end — the existing
  `assessment==='over'/'on-track'` assertions (see §8) updated to the new orientation values;
  Weight-Loss calories-under keeps its positive recommendation and a neutral summary.
- **Screen tests:** none automatable (no RN render harness — as with DI-002/007/008); covered by
  the native retest checklist (§11) + a `docs/MANUAL_TESTING_GAPS.md` entry.
- **Accessibility:** the summary + secondary context are plain `AppText`; assert (composition
  level) that a screen-reader-consumable single string can be produced from `AssessmentDetail`
  (primary + secondary), no reliance on color/orange alone.

### 8. Tests that lock the current collapse (must be updated by the Act task)

`assessment` value assertions to migrate to the new orientation enum:
`EvaluationDomainRegressionCoverage.test.ts` (73/83/89), `EvaluationProfileContract.test.ts`
(16), `GetActiveEvaluationOutputUseCase.test.ts` (42), `ProfileSwappability.test.ts` (76/83/86),
`EvidenceBasedStandardProfile.test.ts` (104/120), `ProteinPreservingDeficitRule.test.ts` (54).
`evaluationSummaryDisplay.test.ts` (16–18) keeps the accepted labels and gains the new mappings.
These are **expected, intentional** updates (the collapse behavior they assert is the defect).

---

## 9. Risk analysis

| #   | Risk                                                 | Mitigation                                                                                                   |
| --- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| R1  | Hidden rule-precedence change in `mergeRuleResults`  | Keep single-rule pass-through identical; define multi-rule merge explicitly + test; do not change rule order |
| R2  | Contradictory summary vs. recommendation             | Both derive from the same `goalProgress`; property test asserts direction-consistency                        |
| R3  | Profile regression (Evidence-based / Weight Loss)    | End-to-end profile tests; Weight-Loss under-calories wording neutral, recommendation unchanged               |
| R4  | Turning macro corridors into medical „limits"        | Wording uses „über/unter dem Ziel", never „Grenzwert/überschritten das Limit"; principle 4 + Bible §3        |
| R5  | Over-complex global-status model                     | One orientation enum + a flat deviation list; no severity tiers in the minimal pass (§5.1 deferred)          |
| R6  | Duplicated status logic in UI                        | Presentation only formats `assessmentDetail`; never recomputes over/under                                    |
| R7  | New threshold smuggled in via „leicht/deutlich"      | Magnitude words deferred as proposed/approval-pending (§5.1); minimal pass uses only ±5 % corridor           |
| R8  | Empty-day / missing-target edge (D-1/D-3) mis-worded | Explicit open decisions D-1/D-3 resolved before Act; „Keine Daten" reused where accurate                     |

---

## 10. Smallest implementation sequence (for the Act task)

1. Add additive `AssessmentDetail` types (contract) — no behavior change yet.
2. Compute `orientation`/`deviations`/`primary` in `dailyProgressToEvaluationOutput`; set
   `assessment` to the orientation code; keep `goalProgress` numbers identical.
3. Aggregate in `mergeRuleResults` (pass-through today).
4. Extend `formatAssessment`/add `buildAssessmentSummary`; render primary + secondary in the
   screen.
5. Update the locked tests (§8) + add scenario/property tests (§7).
6. `npm run verify`; add `docs/MANUAL_TESTING_GAPS.md` entry (UI-relevant, headless).
7. Resolve D-1/D-3 wording with accepted terminology before finalizing strings.

---

## 11. Native retest checklist (for the later Android build)

1. Log the native reproduction day (cal ≈ 1363/2449, P 97/153, C 47/276, F 87/82) under
   Evidence-based Standard.
2. Auswertung „Heutige Bewertung" names **fat** as over and states calories are still under —
   **not** a blanket „Über dem Ziel".
3. A fully in-corridor day still shows „Im Zielkorridor".
4. An empty day shows „Keine Daten"/„Noch nichts protokolliert", **not** „Im Zielkorridor".
5. A calories-over, macros-in day shows a calorie-named summary.
6. Switch to Weight Loss with calories under the deficit target → summary states the fact
   neutrally; the deficit/protein recommendation is unchanged and not contradictory.
7. Summary and Empfehlungen never contradict each other.

---

## 12. Out of scope

Changing calorie/macro targets, BMR/TDEE or the ±5 % corridor; adding magnitude tiers/thresholds
(§5.1, deferred); body-data validation; resolver; DI-010; Saved Meals; Journal confirmation;
J-012; Speck ambiguity; account/sync; medical advice or new nutrition doctrine; unrelated
cleanup.

---

## 13. ROADMAP handling

GE-010 stays a single **Act** task (the functional outcome „nutrient-specific assessment"). This
plan is its prerequisite artifact — no separate implementation task ID is created (repo
convention only splits IDs when deliverables are genuinely separate, e.g. RESOLVER-V2-008
diagnosis → 009 fix; here plan and fix are one coherent evaluation change). GE-010 is therefore
**not** marked `done`; its ROADMAP entry records „planning complete — see this plan; Act
pending". Priorities of other tasks are unchanged.

---

## 14. Verification for this planning PR

Documentation-only → VERIFY.md **Category 1** readback checks (`git status --short`,
`git diff --stat`, `git diff --name-only`). Only this plan and `ROADMAP.md` (GE-010 note) change;
no product code, tests, schema, or dependencies.
