# CLINE-REAL-008 — Unit Portion Regression Test Expansion

**Date:** 2026-05-21  
**Task Type:** Controlled TEST-ONLY scoped change

---

## Test file changed

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Exact scenario covered

Added exactly one focused regression test:

- **Test:** `should prioritize explicit grams over unit default for eggs: "150g egg" → 150g totals`

Scenario details:

1. Resolve portion grams for a canonical unit-based food (`egg`) with explicit grams present:
   - `resolvePortionGrams('egg', 150, 1)`
2. Assert explicit grams take precedence over canonical unit default (60g):
   - `targetGrams === 150`
3. Compute totals and assert calories/macros reflect 150g explicitly:
   - calories: `214.5`
   - protein: `18.9`
   - carbs: `1.05`
   - fat: `14.25`

---

## Command run

1. `npm run test -- --runTestsByPath src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Result

- ✅ Targeted test suite passed.
- Jest summary:
  - `Test Suites: 1 passed, 1 total`
  - `Tests: 11 passed, 11 total`

Terminal artifact note:

- Spinner/progress artifact text (`RUNS ...` with spinner glyphs) was visible during execution.
- Command completed normally with a `PASS` result; no unresolved terminal hang remained.

---

## Whether implementation changes were needed

- **No implementation changes were needed or made.**
- Change was test-only.

---

## Risks / follow-ups

1. Existing suite now includes overlapping explicit-grams assertions (`200g ei` and new `150g egg`); acceptable for regression confidence but may be consolidated in a later cleanup-only task if desired.
2. No runtime risk introduced by this task because runtime code was not modified.

---

## Constraint compliance

- ✅ Exactly one focused regression test added
- ✅ No runtime implementation files changed
- ✅ No `src/features/nutrition/application/` changes
- ✅ No `src/features/nutrition/domain/` changes
- ✅ No `supabase/` changes
- ✅ No `package.json` changes
- ✅ No `package-lock.json` changes
- ✅ No scripts created
- ✅ No audit fix commands run
- ✅ No push performed
