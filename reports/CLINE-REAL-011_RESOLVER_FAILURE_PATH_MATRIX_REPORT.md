# CLINE-REAL-011 — Resolver Failure Path Matrix Report

## Chosen failure path

- **Resolver exception** (resolver throws/rejects during `resolve(...)` call).

## Why this path was selected

- Existing `LogFoodFromRawInputUseCase` failure coverage already explicitly protects rejected/no-macro outcomes.
- `SequentialFoodCatalogResolver` has source-error continuation coverage, but `LogFoodFromRawInputUseCase.test.ts` did not explicitly assert the use-case behavior when resolver itself throws.
- This is a high-risk regression path because it must fail explicitly while guaranteeing no persistence side effects.

## Test added

- **File:** `src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.test.ts`
- **Test name:** `sollte Resolver-Exception explizit werfen und Persistenz blockieren`
- **Assertions covered:**
  - explicit failure surfaced: `rejects.toThrow('RESOLVER_EXCEPTION_TIMEOUT')`
  - persistence blocked: `addEntry` not called
  - repository unchanged: `listEntriesForDate('2026-02-15')` remains empty

## Command run

```bash
npm run test -- --runTestsByPath src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.test.ts
```

## Result

- **PASS**
- `Test Suites: 1 passed, 1 total`
- `Tests: 9 passed, 9 total`

## Risks / Follow-ups

- No immediate runtime risk introduced (test-only change).
- Follow-up optional: add similar exception-path guard in other use-case-focused resolver integration tests if needed for broader matrix parity.
