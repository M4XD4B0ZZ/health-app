# CLINE-REAL-010 — Quantity × Configured Default Portion Regression Test

**Date:** 2026-05-21  
**Task Type:** Controlled TEST-ONLY scoped change

---

## Test file changed

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Exact scenario covered

Added exactly one focused regression test:

- **Test:** `regression: multiplies configured canonical egg default portion by quantity when explicit grams are absent`

Scenario details:

1. Unit food: `eggs`
2. Quantity: `2`
3. Explicit grams absent (`quantityGrams = 0`)
4. Configured canonical default portion captured in test pattern:
   - `configuredEggDefaultPortion = 60`
5. Assertion of multiplication behavior:
   - `targetGrams === configuredEggDefaultPortion * quantity`
6. Assertion explicit grams path not used:
   - `targetGrams !== 200`
7. Assertion 100g fallback path not used:
   - `targetGrams !== 100`
8. Calories/macros scale from configured default portion × quantity:
   - calories: `171.6`
   - protein: `15.12`
   - carbs: `0.84`
   - fat: `11.4`

---

## Command run

1. `npm run test -- --runTestsByPath src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`

---

## Result

- ✅ Targeted test suite passed.
- Jest summary:
  - `Test Suites: 1 passed, 1 total`
  - `Tests: 13 passed, 13 total`

Terminal artifact note:

- Spinner/progress artifact text (`RUNS ...` with spinner glyphs) was visible during execution.
- Command completed normally with a final `PASS` result; no unresolved terminal hang remained.

---

## Constraint compliance

- ✅ Exactly one new test added
- ✅ No runtime implementation files changed
- ✅ No changes under `src/features/nutrition/application/`
- ✅ No changes under `src/features/nutrition/domain/`
- ✅ No supabase changes
- ✅ No `package.json` / `package-lock.json` changes
- ✅ No scripts created
- ✅ No `npm audit fix` commands run
- ✅ No push performed
