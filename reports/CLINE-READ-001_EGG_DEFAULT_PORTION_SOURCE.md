# CLINE-READ-001 — Trace Egg Default Portion Source

**Task Type:** Read-only investigation (no code changes)
**Date:** 2026-05-21

---

## 1) Canonical default portion for egg: file location

Primary runtime source used by portion resolution:

- `src/features/nutrition/domain/canonicalFoods.ts`
  - `CANONICAL_FOODS` entry with `id: 'egg'`
  - `defaultPortion: { unit: 'piece', grams: 60 }`

Related canonical dictionary (query/routing metadata) also contains the same hint:

- `src/features/nutrition/domain/catalog/CanonicalFood.ts`
  - `CANONICAL_FOODS` entry with `canonicalId: 'egg'`
  - `defaultPortionHints: [{ unit: 'piece', grams: 60, labelDe: '1 Ei (≈60 g)' }]`

---

## 2) Value currently configured

For `egg` / `ei` / `eier` / `eggs`, the configured canonical default portion is:

- **60 g per piece**

Evidence:

- `src/features/nutrition/domain/canonicalFoods.ts` (`grams: 60`)
- `src/features/nutrition/domain/catalog/CanonicalFood.ts` (`grams: 60`, label `1 Ei (≈60 g)`)

---

## 3) Are tests hardcoded against that value?

**Yes.** Tests explicitly assert `60` for egg default portion behavior.

Direct examples:

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`
  - `expect(targetGrams).toBe(60)` for `egg`
  - `expect(targetGrams).toBe(120)` for `2 eier`
  - `expect(targetGrams).toBe(180)` for `3 eggs`

- `src/features/nutrition/__tests__/resolvePortionGrams.test.ts`
  - contains explicit `60g` expectations for `egg`, `eier`, `ei`

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.test.ts`
  - checks `2 eggs * 60g each` via `expect(entry.quantityGrams).toBe(120)`

Additional corroboration:

- `reports/CLINE-REAL-009_DEFAULT_PORTION_REGRESSION_TEST_REPORT.md` documents a dedicated regression test asserting `targetGrams === 60` and `targetGrams !== 100`.

---

## 4) Provenance: USDA/BLS/OFF vs local application constants

The egg default portion value is from **local application constants**, not dynamically sourced from USDA/BLS/OFF.

Reasoning:

1. Portion resolution uses local canonical entity metadata:
   - `src/features/nutrition/domain/portion/resolvePortionGrams.ts`
   - It calls `detectCanonicalEntity(parsedName)` and returns `count * canonicalEntity.defaultPortion.grams`.

2. If no canonical default exists, code falls back to hardcoded `100` grams.
   - This indicates local deterministic control of portion defaults.

3. USDA/BLS/OFF appear as search/source query providers for food matching/macros, but no evidence was found that they supply the `egg default portion = 60g` value at runtime.

Conclusion:

- **Origin = local canonical constant (application-defined default).**
- **Not externalized to USDA/BLS/OFF source data during portion defaulting.**

---

## 5) Summary (requested determinations)

- **File location:**
  - `src/features/nutrition/domain/canonicalFoods.ts` (runtime canonical default portion)
  - `src/features/nutrition/domain/catalog/CanonicalFood.ts` (parallel canonical hints)
- **Current configured value:** `60 g` per egg (piece)
- **Tests hardcoded against value:** Yes (multiple explicit assertions)
- **Value origin:** Local application constants, not USDA/BLS/OFF runtime source data
