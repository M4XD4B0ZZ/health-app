# Native Android Dogfooding — Consolidated Findings & Task Registration Report

- **Date:** 2026-07-17
- **Mode:** review-only planning / dogfooding consolidation (no product code changed)
- **Session:** first sustained native Android dogfooding session (build predating the
  fixes registered below)
- **Branch:** `claude/native-dogfooding-roadmap-842osw`
- **Verification category:** VERIFY.md **Category 1** (documentation-only) — this report,
  ROADMAP task registration, and gap-log evidence notes only.

> **Scope note.** This document formalizes the native dogfooding findings and registers a
> separate ROADMAP task for each. It changes **no product code, no migrations, no
> dependencies**. Each finding was verified against the actual code before a task was
> written; the resolver-trust finding is registered as a **diagnosis-only** task with its
> implementation deliberately left unwritten until the root cause is proven. Testing with
> the current build is paused because journal editing can corrupt quantities cumulatively
> (Finding 1 / J-013).

---

## 1. Confirmed working (do not re-plan)

Explicitly validated during the native session and **not** turned into tasks:

- Cold start of the native standalone build (see also NATIVE-001 status note in
  `docs/MANUAL_TESTING_GAPS.md`).
- Four-tab navigation.
- Individual entry delete.
- Group expansion.
- Delete of individual children inside a group.
- Group recalculation and dissolution to a single remaining leaf.
- Partial success: „1 Banane und zorbfrucht" persists only the banana and communicates the
  partial success truthfully (J-007 behavior).
- Persistence across app restart.
- J-009 canonical-identity presentation grouping itself (grouping key, aggregation math,
  expand/collapse, per-child edit/delete, J-005 separation) — accepted as correct in full.
  Two **presentation** refinements remain deferred under the already-tracked J-012 (group
  title + chevron); this report does **not** reopen J-009 or fold anything into J-012.

---

## 2. Findings, code verification & registered tasks

Each finding below was reproduced against the code path before registration. Task IDs are
the next genuinely unused IDs in the correct domain (verified against ROADMAP headings:
Journal max J-012, Saved Meals max SM-007, Goals & Evaluation max GE-009, Dashboard &
Insights max DI-009, Resolver v2 max RESOLVER-V2-007, P1 max P1-005).

### Finding 1 — Journal editing is cumulative and non-idempotent — **BLOCKER → J-013**

**Reproduction (native):** start `1 Ei` / 60 g / 82.2 kcal → edit `2` → 120 g → edit `3`
→ 360 g → edit `2` → 720 g. A count change is also rendered afterwards only as a gram
amount, and the edit modal uses the technical label „Bearbeitungsanweisung".

**Code-verified root cause (confirmed, not hypothesized):**

- The Journal edit modal wires `container.editFoodEntryFromNaturalLanguageUseCase`
  (`src/presentation/features/journal/JournalScreen.tsx:446`), i.e.
  [`EditFoodEntryFromNaturalLanguageUseCase`](../src/features/nutrition/application/usecases/EditFoodEntryFromNaturalLanguageUseCase.ts).
  (`ApplyNaturalLanguageEditUseCase` also exists and is wired in the container but is **not**
  the path the screen uses for this action.)
- The edit text is parsed by
  [`PortionParser.parse`](../src/features/nutrition/domain/portion/PortionParser.ts). A bare
  number such as `"2"` matches the `exactToken` branch (`PortionParser.ts:86-92`),
  `parseNumberToken("2") → 2`, and `multiplierResult(2, hasBaseGrams=true)` returns
  `{ status: 'resolved', multiplier: 2 }`. **A bare number is silently interpreted as a
  relative multiplier.**
- In the use case, the multiplier branch (`EditFoodEntryFromNaturalLanguageUseCase.ts:61-70`)
  computes `baseGrams = nextEntry.grams ?? nextEntry.quantityGrams` — the **already-edited**
  value — and `effectiveGrams = baseGrams * multiplier`. So 60 → ×2 = 120 → ×3 = 360 → ×2 =
  720, exactly matching the native reproduction. The edit is relative and therefore
  cumulative and non-idempotent.
- The modal `TextInput` placeholder is literally `"Bearbeitungsanweisung"`
  (`JournalScreen.tsx:676`).
- **Count/`Stück` edits are not modelled at all in the edit path:** `PortionParser` handles
  grams, kg, ml (rejected), the multiplier keywords, `"Nx"`, and a bare single token
  (→ multiplier). `"2 Stück"` is two tokens, matches none of these, and resolves to
  `NO_PORTION_SIGNAL` (unresolved). The edit path has no notion of pieces, so „2 Stück → 2
  Stück / 120 g" cannot currently be produced by an edit even though the **display** layer
  (J-010/J-011 + portion knowledge) does understand pieces.

**Conclusion:** the blocker is real and structural (relative-multiplier semantics + a bare
number guessed as a multiplier + no count-aware absolute edit). Registered as **J-013**
(BLOCKER).

### Finding 2 — Generic-food resolver trust mismatch — **HIGH, diagnosis-only → RESOLVER-V2-008**

**Reproduction (native):** `100 g Himbeeren → 275 kcal`, `100 g Haferflocken → 102 kcal`,
`100 g Speck → 746 kcal`, `100 g Magerquark → 66 kcal`. At least raspberries and oat flakes
do not read like the ordinary user-intended foods (raspberries ≈ 30–50 kcal/100 g; oat
flakes ≈ 370 kcal/100 g).

**Code reconnaissance (review-only, not yet a proven root cause):** the multi-source
resolver stack lives under `src/features/nutrition/application/services/` (e.g.
`FoodCatalogResolver.ts`, `DefaultFoodCatalogResolver.ts`, `FusionCandidateResolver.ts`,
`ResolverDecisionPolicy.ts`) with source adapters under
`src/features/nutrition/infrastructure/catalog/sources/` (BLS compact runtime adapter, OFF,
USDA) and the BLS artifact/manifest. The per-100 g numbers above are almost certainly
selected records, not invented values, so the question is **which** record won and **why**
(wrong variant, over-broad alias, token/qualifier loss in fusion ranking, or source
precedence).

**Explicitly registered as diagnosis-only.** RESOLVER-V2-008 traces parser output,
normalized query/tokens, per-source candidate sets, source/BLS IDs, canonical DE/EN names,
per-100 g macros, match score + reason, fusion/ranking outcome, and the persisted
`foodCatalogRef`/`nutritionSnapshot` for each of the four inputs. **No fix is written into
the task** — any implementation task is created only after the root cause is proven, and
RESOLVER-V2-005/006 stay deferred. Kept separate from resolver implementation per the brief.

### Finding 3 — Duplicated evaluation-goal selection / inverted active optic — **HIGH → DI-010**

**Reproduction (native):** the Auswertung tab's orange goal button represents the
_selectable alternative_, not the _active_ goal, making the active state look inverted; the
goal can be changed in two places.

**Code-verified:** `EvaluationSummaryScreen.tsx` (Dashboard & Insights domain) carries an
interactive per-profile goal toggle (DI-002: „einfacher Ziel-Umschalter (Buttons pro
registriertem Profil)"), while `GoalsScreen.tsx` carries the GE-008 „Ziel wählen" card that
sets the same active profile via `container.setActiveProfileId`. Two mutable surfaces write
the one active-goal state. Both files/behaviors are documented in
`docs/MANUAL_TESTING_GAPS.md` (DI-002, GE-008, DI-009).

**Product decision (accepted):** the active evaluation goal is changed **only** in Ziele;
Auswertung shows it read-only with an optional „Ziel ändern" link to Ziele; `Balanced` /
`High Protein` / `Manuell` remain a separate **Makroverteilung** concept, not evaluation
goals. Registered as **DI-010**.

### Finding 4 — Whole-day „Über dem Ziel" when only one nutrient is over — **HIGH → GE-010**

**Reproduction (native):** calories 1363/2449, protein 97/153, carbs 47/276, fat 87/82 →
the app shows the blanket label „Über dem Ziel" although only fat exceeds its target.

**Code-verified root cause:** the overall assessment is an any-dimension-over reduction, not
a per-nutrient statement:

- `src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts:66` —
  `assessment: goalProgress.some((g) => g.status === 'over') ? 'over' : 'on-track'`.
- `src/features/evaluation/application/mergeRuleResults.ts:19-22` — merged `assessment` is
  `'over'` if **any** rule result is `'over'`.
- `src/presentation/features/evaluationSummary/evaluationSummaryDisplay.ts:19` maps
  `'over' → 'Über dem Ziel'` (display formatting only; the classification is upstream).

So a single over-target macro (fat) forces the whole-day label to „over". The fix is in the
**evaluation domain output model** (nutrient-specific mixed state), not a display string
swap. Registered as **GE-010** (a plan-then-implement task; the exact status model must be
designed against the rules before coding — the brief flags this as needing review).

### Finding 5 — Scrambled-egg („Rührei") phrasings fail — **MEDIUM → P1-006**

**Reproduction (native):** all of `Rührei aus 2 Eiern`, `Rührei aus zwei Eiern`, `Rührei von
zwei Eiern`, `2 Rühreier` failed.

**Code-verified nuance (important for scope):** a Rührei alias **already exists** — the BLS
compact runtime adapter maps `Y720143: ['ruehrei', 'rührei', 'ruehei']`
(`src/features/nutrition/infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter.ts:14`)
and `detectInputType.ts` lists `'ruehrei'`/`'rührei'`. So the gap is **not** a missing food;
it is the **phrasing + egg-count extraction**: „aus 2 Eiern" / „aus zwei Eiern" / „von zwei
Eiern" / „2 Rühreier" are not parsed into _two eggs_ with correct piece/gram quantities. The
product semantics required (resolve to two eggs, invent no butter/oil/milk, keep the
preparation label, still split „… mit 10 g Butter", no regression to existing „mit"/composite
handling) mean the work is in input parsing/normalization. Registered as **P1-006** (Resolver
& Normalization). The precise parser entry point is to be confirmed at implementation time.

### Finding 6 — Saved Meal counts journal events as „Zutaten" — **MEDIUM → SM-008**

**Reproduction (native):** a template created from three separate egg journal events shows
„3 Zutaten · ~575 kcal", although it represents **one** food and **seven** eggs.

**Code-verified root cause:** `src/presentation/features/savedMeals/SavedMealsScreen.tsx:166`
renders `{template.items.length} Zutat{…en}` — the raw count of template items (journal
events), not the number of **unique foods**. Nothing lets the user inspect the template
contents (foods, quantities, units) before logging.

**Target:** count unique foods and show an aggregated user-facing quantity, e.g. „1
Lebensmittel · 7 Eier · ~575 kcal", with an openable content view. Use canonical identity for
display grouping; do not collapse different foods with similar labels; do not introduce a new
persistence model unless proven necessary; logging must still reproduce exact totals.
Registered as **SM-008**.

### Finding 7 — J-008 transient confirmation is too large/repetitive — **MEDIUM → J-014**

**Reproduction (native):** the confirmation stacks a count header (`1 EINTRAG GESPEICHERT`),
a summary sentence (`Haferflocken gespeichert · 102 kcal`), and a full duplicated entry row
simultaneously.

**Code context:** the transient panel is J-008
(`journalLastSubmitConfirmation.ts` + the panel in `JournalScreen.tsx`, already `done`). This
is a **refinement** of that panel toward a compact banner
(„**Haferflocken gespeichert · 102 kcal** **Bearbeiten**") with ~5 s auto-dismiss, hold on
interaction, tab-blur removal, and the existing edit flow reused. Must preserve J-008's
controller/timer guarantees and the partial-success message. Registered as **J-014**
(refines J-008; does not reopen it).

### Finding 8 — Metabolism section dominates and doesn't explain BMR/TDEE — **MEDIUM → GE-011**

**Reproduction (native):** the metabolism section gives useful calculation transparency but
dominates the Ziele screen and never explains, in user terms, what BMR/TDEE mean for the
user's daily target.

**Code-verified:** `src/presentation/features/goals/GoalsScreen.tsx:223` renders the
„Metabolismus-Profil" card with „Grundumsatz (BMR)" (`:368`), „Gesamtumsatz (TDEE)" (`:374`),
and „Berechnungs-Details" (`:384`).

**Target (no formula changes):** rename the section to a clearer term such as „Körperdaten &
Energiebedarf"; lead with a prominent German explanation of the estimated maintenance need
(TDEE) and BMR as a rest-energy estimate that is **not** the recommended target; collapse
formulas under „So wurden die Werte berechnet" (progressive disclosure) while preserving full
transparency. Registered as **GE-011**.

### Finding 9 — J-012 (already tracked)

J-012 (user-friendly canonical group title + expand/collapse chevron) stays `todo` and
remains prioritized **after** the blocker and high findings. This report does not modify it.

### Finding 10 — Local-first account / backup / sync boundary — **DEFERRED architecture → ACC-001**

Review-only architecture planning, lowest priority. Zera stays local-first with no login
required for initial use; optional Google/Apple login via Supabase Auth comes later and does
**not** by itself synchronize the existing local body-data/goals/templates/journal. The plan
must decide sync scope, first-login migration, logout behavior, two-device conflict
resolution, soft-delete/correction-log sync, privacy/deletion/export, anonymous-local-ID vs.
Supabase-user-ID, Google-on-Android / Apple-on-iOS provider boundaries, offline behavior, and
post-reinstall restore. Registered as **ACC-001** (new „Account, Backup & Sync
(Architecture)" domain), review-only, deferred.

---

## 3. Registered task IDs & implementation order

| #   | Priority  | ID                  | Title                                            | Mode                     |
| --- | --------- | ------------------- | ------------------------------------------------ | ------------------------ |
| 1   | Blocker   | **J-013**           | Absolute, idempotent journal quantity editing    | Act                      |
| 2   | High      | **RESOLVER-V2-008** | Generic-food resolver trust diagnosis            | Review-only diagnosis    |
| 3   | High      | **DI-010**          | Single ownership of the active evaluation goal   | Act                      |
| 4   | High      | **GE-010**          | Nutrient-specific mixed-state daily assessment   | Plan → Act               |
| 5   | Medium    | **P1-006**          | Scrambled-egg („Rührei") phrasing support        | Act                      |
| 6   | Medium    | **SM-008**          | Saved Meal composition transparency              | Act                      |
| 7   | Medium    | **J-014**           | Compact last-submit confirmation                 | Act                      |
| 8   | Medium    | **GE-011**          | Energy-need explanation & progressive disclosure | Act                      |
| 9   | (tracked) | **J-012**           | User-friendly group title + chevron              | Act (already `todo`)     |
| 10  | Deferred  | **ACC-001**         | Local-first account/backup/sync boundary         | Review-only architecture |

**Execution order:** J-013 → RESOLVER-V2-008 (→ any proven resolver fix task) → DI-010 →
GE-010 → P1-006 → SM-008 → J-014 → GE-011 → J-012 → ACC-001.

---

## 4. Manual-testing-gap evidence updates

Per the brief, `docs/MANUAL_TESTING_GAPS.md` is updated **only where native evidence changes
an existing status**: native-dogfooding confirmation notes were appended to **NATIVE-001**
(cold start — its core deliverable, only confirmable on a real native build, now observed
working) and **J-009** (grouping/expand/delete/dissolution/persistence exercised natively).
Per that file's own convention, the `✅` flip is left to the human reviewer; the agent records
native evidence only.

---

## 5. Out of scope (this planning PR)

No product code, migrations, dependency, or `.env` changes; no resolver/evaluation/Saved-Meal
implementation; no reopening of J-009; no folding of findings into J-012; no changes to J-005
auto-merge semantics or to the metabolic formulas. Each Act task above carries its own
Category-4 verification when implemented.
