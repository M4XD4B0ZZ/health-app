# CLINE-REAL-006 — Product-Code Read-only Diagnostic Audit

**Date:** 2026-05-20  
**Scope:** Nutrition logging / resolver pipeline (read-only)  
**Task Type:** Diagnostic audit without product-code edits

---

## 1) Files inspected

### Governance / context

- `AGENTS.md`
- `VERIFY.md`
- `SSOK.md`
- `handoffs/latest-handoff.md`

### Product-code (read-only)

- `src/features/nutrition/application/usecases/LogFoodFromRawInputUseCase.ts`
- `src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts`
- `src/features/nutrition/domain/portion/resolvePortionGrams.ts`
- `src/features/nutrition/domain/fusion/CandidateScorer.ts`
- `src/features/nutrition/domain/fusion/FusionCandidate.ts`

### Relevant tests inspected (read-only)

- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.test.ts`
- `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`
- `src/features/nutrition/__tests__/resolvePortionGrams.test.ts`
- `src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts`
- `src/features/nutrition/__tests__/SequentialFoodCatalogResolver.debug.test.ts`

---

## 2) Current pipeline summary (nutrition logging / resolver)

Observed primary entry point for raw food logging:

- **`LogFoodFromRawInputUseCase.execute()`**

High-level flow currently implemented:

1. Parse raw input via `DeterministicFoodParser`.
2. Preserve original parsed name and raw input for downstream resolver behavior and logging.
3. Derive initial quantity/confidence (grams, count-based fallback, or low-confidence zero-grams state).
4. Resolve food candidate via `resolveCanonicalFood()`:
   - alias cache lookup first,
   - then `FoodCatalogResolver` (multi-source path via `SequentialFoodCatalogResolver`),
   - deterministic catalog fallback,
   - optional AI mapper fallback.
5. Compute target grams using `resolvePortionGrams()` (explicit grams priority, canonical default portion fallback, else 100g).
6. Compute totals via `computeTotals(...)` and enrich `FoodEntry`.
7. Attach explainability metadata (`buildLogDecisionMeta`, resolver summary, assumptions tags).
8. Enforce strict macro guard (see safeguards below).
9. Persist via `FoodEntryRepository.addEntry(...)`.

Resolver service involved:

- **`SequentialFoodCatalogResolver.resolve()`** as the core multi-source resolver implementation.
- Implements source routing, early-return logic, scoring, timeout/circuit-breaker behavior, and negative caching.

---

## 3) Key safeguards observed

1. **Strict zero-macro blocker (present):**
   - In `LogFoodFromRawInputUseCase.ts`, entry persistence is blocked when calories are missing/<=0.
   - Throws `RESOLVER_FAILED_OR_NO_MACROS` before repository write.

2. **Resolver operational safeguards:**
   - Per-source timeout budgets.
   - Global resolver budget.
   - Circuit breaker with countable/non-countable error handling.
   - Negative cache for no-candidate outcomes.

3. **Portion safety order:**
   - Explicit grams are never overridden.
   - Canonical default portions used for unit-based foods.
   - Deterministic fallback of 100g for unknowns.

4. **Traceability / explainability hooks:**
   - Rich resolver/use-case proof logs.
   - Decision summary and assumptions tagging.

---

## 4) Relevant tests found

### Use-case and input flow

- `LogFoodFromRawInputUseCase.test.ts`
  - Basic entry creation/persistence/date handling and parsing flow.

### Portion behavior

- `resolvePortionGrams.test.ts`
  - Explicit grams precedence, canonical unit portions, fallback behavior, edge cases.
- `LogFoodFromRawInputUseCase.unitPortions.test.ts`
  - Integration-level verification for unit-based defaults (egg/eier/ei, etc.) and proportional scaling.

### Resolver behavior and reliability

- `SequentialFoodCatalogResolver.test.ts`
  - User-source priority, OFF/USDA sequencing, early return thresholds, error fallback,
    circuit breaker behavior, timeout handling, global budget, negative caching, summary metrics.
- `SequentialFoodCatalogResolver.debug.test.ts`
  - Debug-system coverage for accepted/rejected scenarios and debug output structure expectations.

---

## 5) Obvious risk areas for next safe product-code task

1. **Use-case file complexity and duplication risk**
   - `LogFoodFromRawInputUseCase.ts` is large and contains repeated debug logging blocks.
   - Risk: maintenance drift and inconsistent future edits.

2. **Heuristic fragility in fusion scoring**
   - `CandidateScorer` uses keyword heuristics for generic/branded detection.
   - Risk: locale/product-name edge cases and false penalties.

3. **Resolver behavior drift vs. evolving DACH routing rules**
   - Multiple threshold/routing branches and early-return conditions.
   - Risk: subtle regressions when tuning source priority or thresholds.

4. **High reliance on logging side channels for diagnostics**
   - Proof/debug logging is rich but may be noisy and partially duplicated.
   - Risk: slower triage if log semantics diverge over time.

---

## 6) Recommended next smallest safe product-code task

**Recommendation:**
Add a narrowly scoped regression test that explicitly verifies the **zero-macro guard blocks persistence** when resolver returns no valid macro candidate.

Why this is the smallest safe next step:

- Uses existing architecture and test patterns.
- No broad refactor required.
- Directly protects a critical safety contract already present in runtime logic.
- Low blast radius (test-first, behavior lock-in).

---

## 7) Explicit non-edit confirmation

- ✅ No product-code files were edited during this audit.
- ✅ No `src/` modifications performed.
- ✅ Read-only inspection only for product-code area.
