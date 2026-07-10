# CLINE-REAL-009 — Default Portion Regression Test

**Date:** 2026-05-21  
**Task Type:** Controlled TEST-ONLY scoped change

---

## Test file changed

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Exact scenario covered

Added exactly one focused regression test:

- **Test:** `should apply canonical default portion for "1 egg" when explicit grams are absent`

Scenario details:

1. Resolve portion grams for canonical unit food `egg` with no explicit gram override:
   - `resolvePortionGrams('egg', 0, 1)`
2. Verify canonical default portion is applied:
   - `targetGrams === 60`
3. Verify no explicit-gram/fallback path is used:
   - `targetGrams !== 100`
4. Compute totals and verify calories/macros match 60g nutrition values:
   - calories: `85.8`
   - protein: `7.56`
   - carbs: `0.42`
   - fat: `5.7`

---

## Command run

1. `npm run test -- --runTestsByPath src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Result

- ✅ Targeted test suite passed.
- Jest summary:
  - `Test Suites: 1 passed, 1 total`
  - `Tests: 12 passed, 12 total`

Terminal artifact note:

- Spinner/progress artifact text (`RUNS ...` with spinner glyphs) was visible during execution.
- Command completed normally with a `PASS` result; no unresolved terminal hang remained.

---

## Whether implementation changes were needed

- **No runtime implementation changes were needed or made.**
- Change was test-only.

---

## Constraint compliance

- ✅ Exactly one focused regression test added
- ✅ No runtime implementation changes
- ✅ No refactors
- ✅ Existing test mocks/helpers pattern preserved
- ✅ Only requested test command executed
- ✅ No push performed
