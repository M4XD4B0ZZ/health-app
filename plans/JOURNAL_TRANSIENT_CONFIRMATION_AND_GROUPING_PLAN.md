# Journal — Transient Last-Submit Confirmation & Canonical-Identity Grouped Overview — Implementation Plan

Status: `planning` (review-only — no product code changed by this document)
Owner tasks: **J-008**, **J-009**, **J-010** (ROADMAP.md, Journal Domain)
Related decisions: Journal Decision Record 1 (Entscheidung 1–4), native dogfooding
session 2026-07-16/-17 accepted product decisions (below).

---

## 0. Purpose & origin

During the first native Android dogfooding session the user logged three inputs referring
to the same canonical food:

- „Ei“
- „Ein Ei“
- „Drei Eier“

Persisted result (calculation **correct**):

| rawInput  | kcal    |
| --------- | ------- |
| Ei        | 82,2    |
| Ei        | 82,2    |
| Drei Eier | 246,6   |
| **Daily** | **411** |

The **UI** was confusing, for two independent reasons:

1. „Erkannte Einträge" showed only the most recent submit (246,6 kcal) as a permanent,
   summary-looking list; „Heutige Einträge" showed all three. Both looked like comparable
   totals, so 246,6 read like the day's total.
2. The same canonical food was shown inconsistently as „60 G", „1 STÜCK (60 G)" and
   „3 STÜCK (180 G)".

The user and product orchestrator accepted the product decisions transcribed in
Section 1. This plan turns them into the **smallest architecture-compatible** change set,
split into separately verifiable Act tasks.

**This is a review-only planning document.** It changes no product code. It exists so the
file boundaries and task split can be reviewed before the transient confirmation and the
grouped overview are implemented separately.

---

## 1. Accepted product decisions (binding for the Act tasks)

1. The **Protokoll** tab stays the central home screen for: natural-language input,
   immediate submission feedback, a compact overview of today, daily calorie + macro totals.
2. **No new tab**; the basic daily overview stays on Protokoll.
3. Replace the permanently visible „Erkannte Einträge" list with a **transient
   last-submit confirmation** panel.
4. The transient confirmation:
   - represents only the latest submission;
   - says so explicitly, e.g. „3 Eier gespeichert · 246,6 kcal";
   - for multiple items, e.g. „2 Einträge gespeichert: Eier und Magerquark · 296 kcal";
   - stays visible ~8 seconds;
   - is replaced by the next submission;
   - disappears when navigating away from the tab;
   - must **not** auto-dismiss while the user is interacting with it;
   - lets the just-saved entry/entries be opened for correction.
5. The persistent „Heutige Einträge" overview groups identical foods visually.
6. Grouping uses **canonical food identity**, not raw input text or display name.
   „Ei" and „Eier" group together when they refer to the same canonical food; different
   foods must **not** be grouped just because their names look similar.
7. Grouped example: `Eier` / `5 Stück · 300 g` / `411 kcal`.
8. Grouping is **presentation-only**: preserve every underlying journal entry separately,
   timestamps/order, individual edit/delete, correction-log behavior; do **not** mutate
   persistence, do **not** auto-merge, do **not** change J-005 auto-merge semantics.
9. Tapping a group exposes its individual journal events (inline expansion or the smallest
   existing-compatible detail interaction).
10. Individual entries remain separately editable and deletable inside the expansion/detail.
11. Quantity presentation is consistent: when a known count portion exists prefer
    „1 Stück (60 g)" over „60 G"; grouped rows may show aggregated count + grams; the frozen
    calculation basis (grams) stays visible; do **not** invent a count when only grams are known.
12. Daily totals and grouped totals stay mathematically identical to the ungrouped journal data.

---

## 2. Current implementation (verified by code inspection)

### 2.1 Files that exist today

| Concern                         | File                                                                                                                                            | Notes                                                                                      |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| Screen                          | `src/presentation/features/journal/JournalScreen.tsx` (643 lines)                                                                               | Owns all journal UI + submit orchestration.                                                |
| Submit feedback (pure)          | `src/presentation/features/journal/journalSubmitFeedback.ts`                                                                                    | `deriveSubmitOutcome()` — J-007 truthfulness rules.                                        |
| Entry display + grouping (pure) | `src/presentation/features/journal/journalEntryDisplay.ts`                                                                                      | `buildFoodEntryDisplay()`, `groupJournalEntries()`.                                        |
| Submit guard                    | `src/presentation/features/journal/claimJournalSubmitSlot.ts`                                                                                   | Re-entrancy guard.                                                                         |
| Tests                           | `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts`, `journalSubmitFeedback.test.ts`, `JournalScreen.submitGuard.test.ts` | Pure-function coverage; no rendering harness in these.                                     |
| Logging entrypoint              | `src/features/input/application/logResolvedNutritionInput.ts`                                                                                   | Returns `{ dispatch, persistedEntries, blockedEntries, needsEditItems, resolvedResults }`. |
| Food entry model                | `src/features/nutrition/domain/models/NutritionTypes.ts`                                                                                        | `FoodEntry`, incl. `foodCatalogRef`, `groupId`/`groupLabel`, `deletedAt`, `autoMergeInfo`. |
| Daily totals                    | `GetDailySummaryUseCase` (via `container.getDailySummaryUseCase`)                                                                               | Sums **all** non-tombstoned entries — independent of grouping.                             |
| Portion knowledge               | `src/features/nutrition/domain/portion/` (`PortionKnowledgeService`, `resolvePortionGrams`, `foodIdentity`, `PortionNeedsEdit`)                 | Source of „known count portion" info for decision 11.                                      |

### 2.2 „Erkannte Einträge" today (the panel to replace — decisions 3/4)

- Rendered at `JournalScreen.tsx:364-378` from `recognizedItems` state (a permanent
  `<View style={styles.section}>` with title „Erkannte Einträge").
- `recognizedItems` is set in `submitRawInput` (`:151-168`) by mapping
  `result.dispatch.readyRequests` and pairing each with its persisted entry's `calories`.
- It is cleared **only** by `clearSubmitFeedback()` at the start of the next submit
  (`:105-112`). `handleRawInputChange`→`clearFeedback()` (`:99-103`) does **not** clear it.
  So it lingers after a submit and shows **only the last submit** → the exact „246,6 looks
  like the total" confusion.
- Rows are **non-interactive** display-only `EntryRow`s (no `onPress`) → no correction access.

### 2.3 Grouping today (only composite-dish — not canonical identity)

- `groupJournalEntries(entries)` (`journalEntryDisplay.ts:177-212`) groups entries that share
  a `groupId` (P1-003C composite-dish, e.g. „Fruchtsalat mit Bananen, Kirschen") under one
  `JournalEntryGroup`, summing child macros. Entries without `groupId` pass through as
  `JournalEntryLeaf`.
- „Ei"/„Ein Ei"/„Drei Eier" do **not** share a `groupId`, so today they render as three
  separate leaves. **Canonical-identity grouping (decisions 5–7) does not exist.**
- The screen already renders group children inline with per-child `onPress`
  (`handleOpenEdit`) and `onActionPress`/„Löschen" (`handleDeleteEntry`) — `:455-470`. The
  edit/delete-per-child interaction we need for canonical groups **already exists** and is
  reusable.

### 2.4 Quantity display today (the inconsistency — decision 11)

- `buildFoodEntryDisplay()` → `buildSubtitle()` → `parseDisplayQuantity()`
  (`journalEntryDisplay.ts:70-146`) derive count/unit **purely from `entry.rawInput` text**.
- Consequence for the same canonical food:
  - „Ei" → no count word → gram fallback → „60 g".
  - „Ein Ei" → `NUMBER_WORDS.ein = 1`, unit `count` → „1 Stück (60 g)".
  - „Drei Eier" → `drei = 3`, unit `count` → „3 Stück (180 g)".
- There is **no** lookup into portion knowledge to decide „this food has a known count
  portion, so prefer a Stück display". Grams (`entry.grams ?? entry.quantityGrams`) is the
  calculation basis and is always available.

### 2.5 Identity & data contract (confirms: no migration)

- `FoodEntry.foodCatalogRef = { source, sourceId, displayName, confidence }`
  (`NutritionTypes.ts:56-61`) is the stable canonical identity, populated by **J-004**
  whenever the resolver matched a catalog row; absent for pure AI-fallback / unmatched
  manual input. It is **already serialized/persisted** (J-002 additive field).
- `groupId`/`groupLabel` are the separate composite-dish identity (P1-003C).
- Daily totals: `GetDailySummaryUseCase` sums the non-tombstoned entries directly; it does
  not read the presentation grouping. Grouping cannot change totals.

**Conclusion:** every field the Act tasks need already exists and is already persisted. See
Section 8 for the explicit no-migration statement.

### 2.6 J-005 auto-merge boundary (must stay untouched)

- J-005's 2-minute same-food auto-merge (`LogFoodFromRawInputUseCase.findCorrectionCandidate`
  / `CORRECTION_WINDOW_MS`) and its undo banner (`autoMergeNotice` state, `:350-362`) are a
  **persistence-level** concern and are **out of scope**. The three „Ei" inputs above were
  logged far enough apart that no auto-merge fired — they are three real entries. Canonical
  **display grouping** (J-009) is a separate, presentation-only pass and must not call, mimic,
  or alter the auto-merge path.

---

## 3. Smallest architecture-compatible design

Guiding constraints from AGENTS.md/SSOK.md: touch only relevant files, prefer editing
existing pure helpers over new structure, no new libraries, keep domain/presentation
boundaries, keep changes deterministic. Everything below stays in the **presentation layer**
plus **read-only** use of an existing domain portion-knowledge query.

### 3.1 Task split (three separately verifiable Act tasks)

- **J-008 — Transient last-submit confirmation + correction access** (replaces „Erkannte
  Einträge"). Self-contained in the presentation layer; a new pure helper for the message +
  a small timer/visibility controller, wired into `JournalScreen`.
- **J-009 — Canonical-identity grouped daily overview + individual-detail access.** Extends
  the existing pure `groupJournalEntries` with a canonical-identity pass and adds
  expand/collapse + reuses per-child edit/delete.
- **J-010 — Consistent quantity display normalization** (prefer known count portion). Edits
  the shared display helper so **both** leaf rows and grouped rows read consistently.

Why J-010 is separate (code-boundary justification, per the planning brief's option):
its data dependency is **portion knowledge** (does this food have a known count portion?),
a different source than J-009's `foodCatalogRef` grouping key, and it applies to leaf rows
that are not grouped at all. Splitting keeps each Act task's verification narrow. J-009 and
J-010 share the `journalEntryDisplay.ts` helper, so whichever lands second automatically
picks up the other's improvement (grouped rows show normalized quantities once J-010 lands).
**Recommended order:** J-008 → J-010 → J-009 (normalize the per-entry display first, then
group on top of it), but the two display tasks are independently shippable.

### 3.2 J-008 design — transient confirmation

**New pure helper** `journalLastSubmitConfirmation.ts` (mirrors `journalSubmitFeedback.ts`):

```
buildLastSubmitConfirmation(input): LastSubmitConfirmation | null
```

Input derived from the same `logResolvedNutritionInput` result already available in
`submitRawInput`: the persisted entries of the latest submit (id, canonical/display name,
count where known, kcal). Output:

- `null` when nothing was persisted (no confirmation for a pure failure — J-007 error
  framing still handles that case);
- for exactly one canonical food:
  `„<count?> <name> gespeichert · <kcal> kcal"` → „3 Eier gespeichert · 246,6 kcal"
  (count word omitted when no known count; name from canonical/display name);
- for multiple distinct foods:
  `„<n> Einträge gespeichert: <A> und <B> · <sum kcal> kcal"` → „2 Einträge gespeichert:
  Eier und Magerquark · 296 kcal" (join with „, " / „ und "; `n` = persisted entry count);
- kcal formatted with the existing German decimal comma convention (`formatNumber`), one
  decimal, so 246,6 renders exactly as the user saw it.
- carries the list of just-saved `entryId`s so the panel can open them for correction.

**Visibility/timer controller** — a small `useLastSubmitConfirmation` hook (or an inlined
`useEffect` + `useRef` timer in `JournalScreen`) owning the state machine in Section 5. Kept
minimal; the _derivation_ is unit-tested via the pure helper, the _timing_ via fake timers.

**Wiring in `JournalScreen`:**

- Delete the „Erkannte Einträge" `<section>` (`:364-378`) and its `recognizedItems` state,
  its population block (`:151-168`), and its `clearSubmitFeedback` line — **unless** any of
  that state is still needed elsewhere (it is not: `recognizedItems` is read only by that
  section — verify at implementation time and remove dead state).
- Render the transient confirmation panel just below `InlineStatus`, reusing existing
  primitives (`AppText`, `PrimaryButton`/pressable, existing `tokens`) — **no new UI
  component library**. The panel is visually distinct from a totals summary and reads as a
  past-tense saved confirmation, not a running total (decision 4).
- Correction access (decision 4): tapping the panel opens the just-saved entry for
  correction. Single food → open the existing edit modal (`handleOpenEdit(entry)`) for that
  entry. Multiple foods → open a minimal chooser/list of the just-saved entries, each row
  reusing `handleOpenEdit`/`handleDeleteEntry`. Recommended minimum: single → direct edit
  modal; multiple → a compact inline list within the panel with per-entry „Bearbeiten".

### 3.3 J-009 design — canonical-identity grouping

**Grouping key rules (decision 6) — see Section 6 for the full table:**

- Only entries **without** a composite-dish `groupId` participate in canonical grouping
  (composite-dish members keep their existing P1-003C group — no double grouping).
- Canonical key = `` `${foodCatalogRef.source}:${foodCatalogRef.sourceId}` `` when
  `foodCatalogRef` is present.
- Entries with **no** `foodCatalogRef` are **not** grouped (stay leaves). No name-based
  fallback — decision 6 forbids grouping by name similarity.
- A canonical group is formed only when **≥2** entries share the key; a lone entry stays a
  leaf (no visual grouping of a single item).
- Group label = `foodCatalogRef.displayName` (e.g. „Eier"). Pluralization beyond the
  canonical display name is out of scope.

**Extend the existing pure function** rather than add a parallel structure: after the
current `groupId` pass, run a canonical-identity pass over the remaining leaves. Reuse the
existing `JournalEntryGroup` shape (add a discriminator field, e.g. `groupKind:
'composite' | 'canonical'`, only if the screen needs to distinguish them; otherwise reuse
as-is). Group totals = sum of children (already the pattern) — see decision 12 test.

**Aggregated quantity for the group header (decision 7):** sum children grams; sum children
counts **only if every child has a known count** (via the J-010 helper); otherwise show
grams only. Never invent a count. „5 Stück (300 g)" when all five children have a known
count; „300 g" if any child lacks one.

**Detail access (decisions 9/10):** recommended = collapsed-by-default group header with a
tap toggle (local `Set<groupId>` expand state in the screen) that inline-expands the
children, each rendered with the **existing** per-child `onPress`→`handleOpenEdit` and
„Löschen"→`handleDeleteEntry`. This keeps the daily view compact (decision 1) while
exposing every underlying event on tap (decision 9). Fallback if expand-state proves fiddly:
render children always-inline exactly like today's composite-dish groups. **The group header
itself carries no edit/delete action** — only children do (see risk R2).

### 3.4 J-010 design — consistent quantity display

Edit `buildFoodEntryDisplay`/`buildSubtitle` (and a small shared count-formatting helper) so
that:

- if the entry's food has a **known count portion** (resolved via the existing portion
  knowledge / `resolvePortionGrams`/`PortionKnowledgeService` for the entry's food identity),
  prefer „N Stück (X g)" even when the raw text lacked a count word — deriving N from
  `grams / gramsPerUnit` when it is a clean integer;
- otherwise fall back to the current text-parsed behavior;
- when only grams are known (no count portion), show „X g" — never invent a count;
- the grams basis stays visible in parentheses in all count cases (decision 11).

The exact wiring of the portion-knowledge lookup into a pure display helper is the one
design detail to settle at implementation time: either pass a small
`knownCountPortion?: { unit; gramsPerUnit }` alongside each entry into
`buildFoodEntryDisplay` (keeps the helper pure — **preferred**), or expose a tiny synchronous
query. Do **not** make the display helper asynchronous or reach into infrastructure directly.

---

## 4. Exact affected files

### J-008 (transient confirmation)

- **New** `src/presentation/features/journal/journalLastSubmitConfirmation.ts` — pure
  `buildLastSubmitConfirmation()`.
- **New** `src/presentation/features/journal/__tests__/journalLastSubmitConfirmation.test.ts`.
- **Edit** `src/presentation/features/journal/JournalScreen.tsx` — remove „Erkannte
  Einträge" section + `recognizedItems` state/population; add the transient panel + timer
  controller + correction access. (Optionally **new** `useLastSubmitConfirmation.ts` hook if
  the timer logic is cleaner extracted; add a matching test if so.)
- Possibly **new** `src/presentation/features/journal/__tests__/JournalScreen.transientConfirmation.test.tsx`
  if a rendering harness is available (see Section 7 note on RTL availability).

### J-009 (canonical grouping)

- **Edit** `src/presentation/features/journal/journalEntryDisplay.ts` — add the
  canonical-identity pass + key derivation + group label/aggregation.
- **Edit** `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts` — new
  grouping cases.
- **Edit** `src/presentation/features/journal/JournalScreen.tsx` — expand/collapse state and
  group-header rendering (reusing existing child edit/delete).

### J-010 (quantity normalization)

- **Edit** `src/presentation/features/journal/journalEntryDisplay.ts` — count-portion-aware
  subtitle.
- **Edit** `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts` — new
  count-portion cases.
- **Edit** `src/presentation/features/journal/JournalScreen.tsx` **only if** the
  known-count-portion data must be threaded in from the screen (preferred pure-helper
  approach); read-only use of existing `container.portionKnowledgeService` /
  `resolvePortionGrams` — **no** domain/infra change.

**No changes** to: navigation, `NutritionTypes.ts`/persistence, repositories, use cases,
resolvers/ranking, Saved Meals, J-005 auto-merge, `logResolvedNutritionInput`, or any
`.env`/deps.

---

## 5. State transitions — transient confirmation (J-008)

States: `hidden`, `visible`, `visible-held` (timer paused during interaction).

| From                     | Event                                                                       | To                 | Effect                                                                           |
| ------------------------ | --------------------------------------------------------------------------- | ------------------ | -------------------------------------------------------------------------------- |
| `hidden`                 | submit succeeds, `persistedCount > 0`                                       | `visible`          | set content from `buildLastSubmitConfirmation`; start ~8 s timer                 |
| `hidden`                 | submit fails, `persistedCount == 0`                                         | `hidden`           | no confirmation (J-007 error framing handles it)                                 |
| `visible`                | 8 s timer elapses                                                           | `hidden`           | clear content                                                                    |
| `visible`                | **new** submit succeeds                                                     | `visible`          | replace content; **reset** timer (decision 4: „replaced by the next submission") |
| `visible`                | user starts interacting (press/focus on panel or its correction affordance) | `visible-held`     | **cancel** timer (decision 4: must not auto-dismiss while interacting)           |
| `visible-held`           | interaction ends                                                            | `visible`          | restart timer                                                                    |
| `visible`/`visible-held` | tab loses focus (`useFocusEffect` cleanup / blur)                           | `hidden`           | clear content + timer (decision 4: „disappears when navigating away")            |
| `visible`/`visible-held` | user taps „open for correction"                                             | `hidden` (or held) | open edit modal / chooser for the saved entry/entries; dismiss panel             |
| `visible`/`visible-held` | component unmounts                                                          | `hidden`           | clear timer (no leak)                                                            |

Timer constant: `LAST_SUBMIT_CONFIRMATION_MS = 8000` (named, single source). Only one timer
alive at a time; every transition into `hidden`/replacement clears the prior timer.

---

## 6. Grouping-key rules & fallbacks (J-009)

| Case                                        | Has `groupId`? | Has `foodCatalogRef`?  | Behavior                                                                         |
| ------------------------------------------- | -------------- | ---------------------- | -------------------------------------------------------------------------------- |
| Composite-dish member                       | yes            | any                    | Grouped by `groupId` (existing P1-003C) — **not** touched by canonical pass      |
| Catalog-matched, ≥2 sharing identity        | no             | yes                    | Grouped into one canonical group; key = `source:sourceId`; label = `displayName` |
| Catalog-matched, only 1 of its identity     | no             | yes                    | Stays a leaf (no single-item group)                                              |
| AI-fallback / unmatched manual entry        | no             | **no**                 | Stays a leaf — **never** name-grouped (decision 6)                               |
| Two different foods with similar names      | no             | different `sourceId`   | **Not** grouped (different keys)                                                 |
| Same food, singular vs plural („Ei"/„Eier") | no             | same `source:sourceId` | Grouped (identity matches — this is the target case)                             |

Fallback rationale: grouping only on `foodCatalogRef` identity guarantees decision 6's „same
canonical food groups, different foods don't". The cost is that AI-fallback/manual entries
without a catalog match are never grouped — accepted as the safe default (a false merge is
worse than a missed merge; the compact-overview goal is still met for the common
catalog-matched case). If a future task wants to group unmatched entries, it must introduce a
deliberate canonical identity for them first — out of scope here.

Ordering: a canonical group appears at the position of its **first** member, matching the
existing composite-dish behavior, so timestamps/order are preserved visually (decision 8).

---

## 7. Tests

### 7.1 J-008 — transient confirmation

**Unit (pure, `journalLastSubmitConfirmation.test.ts`):**

- single known-count food → „3 Eier gespeichert · 246,6 kcal" (German comma, one decimal);
- single food without a known count → „Ei gespeichert · 82,2 kcal" (no invented count);
- two distinct foods → „2 Einträge gespeichert: Eier und Magerquark · 296 kcal";
- three+ distinct foods → correct `n` and name join;
- `persistedCount == 0` → returns `null`;
- returned `entryId`s match the just-saved entries (for correction access).

**Timer/state (fake timers, hook or controller test):**

- becomes `hidden` after 8 s;
- a second submit replaces content and resets the timer;
- interaction (`held`) cancels the timer; releasing restarts it;
- blur/unmount clears content and timer (no dangling timer).

**Integration (if RTL harness available — see note):** after a submit the panel renders and
the old „Erkannte Einträge" heading is **absent**; tapping the panel opens the edit modal for
the saved entry; simulated blur removes the panel.

### 7.2 J-009 — canonical grouping (`journalEntryDisplay.test.ts`)

- two entries with the same `foodCatalogRef` (source+sourceId), rawInputs „Ei"/„Eier" →
  one canonical group, label from `displayName`, `children` length 2, distinct child ids;
- three entries (the dogfooding case: „Ei"/„Ein Ei"/„Drei Eier") same identity →
  `totalCalories === 82,2 + 82,2 + 246,6` (== 411) and **=== sum of children** (decision 12);
- two entries with **different** `sourceId` → **not** grouped (two leaves);
- entries with **no** `foodCatalogRef` → leaves (no grouping, no throw);
- a single entry of an identity → leaf (no one-item group);
- composite-dish `groupId` entries still group by dish and are unaffected by the canonical
  pass (existing tests stay green);
- **purity:** grouping returns children referencing the same entry objects, mutates neither
  the input array nor any entry, and performs no persistence call (decision 8).

**Integration (if harness available):** tapping a group header toggles child visibility;
each child row still triggers `handleOpenEdit`/`handleDeleteEntry`; the group header exposes
no group-level delete.

### 7.3 J-010 — quantity normalization (`journalEntryDisplay.test.ts`)

- entry „Ei" with a **known** count portion (60 g/Stück), grams 60 → „1 Stück (60 g)"
  (not „60 g");
- entry „Eier" grams 300 with known 60 g/Stück → „5 Stück (300 g)";
- entry with grams but **no** known count portion → „X g" (no invented count);
- grams-basis remains visible in the parenthesis for all count cases;
- existing gram-only and text-count cases stay green.

### 7.4 Manual native tests (headless-env gap — Section 9)

Because the agent environment is headless, each UI-touching Act task must add a
`docs/MANUAL_TESTING_GAPS.md` entry per AGENTS.md and list these manual checks for a real
device:

- **J-008:** confirmation appears after a submit; auto-dismisses ~8 s; is replaced by the
  next submit; disappears on switching tabs; stays while pressed/focused; opening it lets the
  just-saved entry be corrected.
- **J-009:** the three „Ei" inputs render as one „Eier" group („5 Stück · 300 g · 411 kcal"
  style); tapping expands the three underlying entries; editing/deleting one child works and
  the daily total updates to match; different foods are not merged.
- **J-010:** the same egg shows consistently as „Stück (g)" across leaf and grouped rows.

> **Harness note:** the three existing test files under `__tests__/` are pure-function tests;
> whether a React-Native-Testing-Library render harness is wired for `.tsx` tests must be
> confirmed at implementation time. If it is **not** available, the integration checks fall
> back to manual-native verification (documented in the gap log) and the pure-helper +
> fake-timer unit tests remain the primary automated coverage — matching how J-005's
> UI-visible piece was verified.

---

## 8. No migration / no persistence change (explicit)

Code inspection confirms **no database migration and no persistence-model change is
required**:

- `foodCatalogRef` (the canonical grouping key) already exists on `FoodEntry` and is already
  serialized/persisted (J-002 additive field, J-004 population). J-009 only **reads** it.
- Grouping (J-009) is a pure presentation transform over already-loaded entries; it writes
  nothing.
- The transient confirmation (J-008) is UI-local state derived from the existing
  `logResolvedNutritionInput` result; it persists nothing.
- Quantity normalization (J-010) reads existing grams + existing portion-knowledge; it
  writes nothing and changes no stored macro.

Should implementation uncover a genuine need for a schema/persistence change, that is a
**stop-and-re-plan** condition (it would contradict decisions 8 and 12 and this section) —
not something an Act task may introduce silently.

---

## 9. Risks & mitigations

| #   | Risk                                                                                                                                           | Mitigation                                                                                                                                                                                                           |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| R1  | **Accidental data merging** — canonical _display_ grouping mistaken for a _persistence_ merge, or confused with J-005 auto-merge (decision 8). | `groupJournalEntries` stays a pure, side-effect-free transform; explicit purity test (7.2) asserts no mutation and no persistence call; plan and code comments state „presentation-only". J-005 path is not touched. |
| R2  | **Edit/delete ambiguity in a group** — a group-level delete would ambiguously drop all children (decisions 9/10).                              | Group header carries **no** edit/delete action; only expanded children do, reusing the existing per-child handlers keyed by entry id. Test asserts the header exposes no delete.                                     |
| R3  | **False grouping** of different foods by similar names (decision 6).                                                                           | Grouping key is `foodCatalogRef` identity only; no name fallback; entries without a catalog match stay leaves. Test with two different `sourceId`s asserts no grouping.                                              |
| R4  | **Totals divergence** — grouped total ≠ sum of children, or daily total shifts (decision 12).                                                  | Group total is computed as the child sum; daily total is computed independently by `GetDailySummaryUseCase` and untouched. Tests assert `groupTotal === Σ children` and that daily total is grouping-independent.    |
| R5  | **Transient timer leaks / races** — overlapping submits, stale timers after unmount/blur.                                                      | Single named timer; every transition into `hidden`/replacement clears the prior timer; cleanup on blur (`useFocusEffect`) and unmount. Fake-timer tests cover replace/hold/blur.                                     |
| R6  | **Removing `recognizedItems` breaks another reader.**                                                                                          | Confirm by search that the „Erkannte Einträge" section is its only consumer before deletion; remove dead state in the same task.                                                                                     |
| R7  | **Inventing a count** when only grams are known (decision 11).                                                                                 | J-010 shows count **only** when a known count portion exists and grams/gramsPerUnit is a clean integer; otherwise grams-only. Explicit negative test.                                                                |
| R8  | **Scope creep** into a Journal redesign, new tab, or J-005 changes (out of scope).                                                             | Each Act task's file list (Section 4) is the boundary; group interaction reuses existing primitives; no navigation change.                                                                                           |

---

## 10. Acceptance criteria per Act task

### J-008 — Transient last-submit confirmation + correction access

- The permanent „Erkannte Einträge" list is **gone**; a transient confirmation replaces it.
- Content reflects **only the latest** submit and says so, e.g. „3 Eier gespeichert · 246,6
  kcal" (single food) / „2 Einträge gespeichert: Eier und Magerquark · 296 kcal" (multiple).
- It auto-dismisses after ~8 s, is replaced by the next submit, disappears on leaving the
  tab, and does **not** auto-dismiss while the user interacts with it.
- It lets the just-saved entry/entries be opened for correction (edit modal / chooser).
- `persistedCount == 0` shows **no** confirmation (J-007 error framing unchanged).
- Pure-derivation + timer unit tests pass; `npm run verify` green; `MANUAL_TESTING_GAPS.md`
  entry added.

### J-009 — Canonical-identity grouped overview + detail access

- Entries sharing canonical `foodCatalogRef` identity (incl. „Ei"/„Eier") render as **one**
  group labeled by `displayName`, with an aggregated header; the day's three eggs show as one
  „Eier" group.
- Different foods are **not** grouped; entries without a catalog match stay leaves; a lone
  identity stays a leaf.
- Tapping a group exposes its individual entries; each is separately editable/deletable; no
  group-level delete.
- Every underlying journal entry, its timestamp/order, and correction-log behavior are
  preserved (nothing merged in persistence); J-005 semantics unchanged.
- Grouped total === Σ children; daily total unchanged and === ungrouped sum (411 for the
  egg case). Grouping/purity unit tests pass; `npm run verify` green; gap-log entry added.

### J-010 — Consistent quantity display

- A food with a known count portion shows „N Stück (X g)" consistently on leaf and grouped
  rows („1 Stück (60 g)", group „5 Stück (300 g)"); grams basis stays visible.
- When only grams are known, shows „X g" — no invented count.
- Display unit tests pass; `npm run verify` green; gap-log entry added if UI output changed.

---

## 11. Out of scope (restated)

New navigation tab; date/history navigation; weekly trends; full Journal-screen redesign;
resolver/ranking changes; persistence-level consolidation of journal events; changes to J-005
auto-merge semantics; Saved Meals changes; analytics; unrelated visual cleanup.

---

## 12. Verification for **this planning PR**

Documentation/planning only → VERIFY.md **Category 1** (documentation-only) readback checks:

```
git --no-pager status --short
git --no-pager diff --stat
git --no-pager diff --name-only
```

No product/runtime code changes → no `npm run verify` required by the decision table (only
ROADMAP.md, this plan, and plans/README.md change). Each future **Act** task carries its own
Category 4 verification (`npm run verify`) and, being UI-relevant in a headless environment, a
`docs/MANUAL_TESTING_GAPS.md` entry.
