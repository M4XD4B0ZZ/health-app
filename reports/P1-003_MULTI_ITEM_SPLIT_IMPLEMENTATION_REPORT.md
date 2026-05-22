# P1-003 Multi-Item Split Implementation Report

**Task ID:** P1-003  
**Task Type:** Product code  
**Date:** 2026-05-22  
**Status:** Implemented, verification blocked by pre-existing repository-wide formatting warnings in `npm run verify`

---

## Objective

Implement deterministic Multi-Item Split for nutrition logging using the approved architecture from `reports/P1-003_MULTI_ITEM_SPLIT_DISCOVERY.md`:

```text
Input
↓
Deterministic Splitter
↓
Item 1 / Item 2 / Item 3
↓
LogFoodFromRawInputUseCase
↓
Resolver
↓
Persist
```

---

## Files Changed

- `src/features/nutrition/application/utils/splitMultiItemInput.ts`
- `src/features/nutrition/application/usecases/LogMealFromRawInputUseCase.ts`
- `src/features/nutrition/__tests__/splitMultiItemInput.test.ts`
- `src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts`
- `src/features/nutrition/__tests__/helpers/MockResolverBuilder.ts`
- `ROADMAP.md`
- `reports/P1-003_MULTI_ITEM_SPLIT_IMPLEMENTATION_REPORT.md`
- `handoffs/latest-handoff.md`

---

## Implementation Summary

### Deterministic splitter

Added `splitMultiItemInput(rawInput)` in `src/features/nutrition/application/utils/splitMultiItemInput.ts`.

Supported connectors from day one:

- German: `und`, `mit`
- English: `and`, `with`
- comma: `,`

Behavior:

- Returns `{ items, wasSplit }`.
- Preserves per-item raw text after trimming.
- Ignores empty fragments safely.
- Does not change `DeterministicFoodParser` contract.

### Meal logging integration

Updated `LogMealFromRawInputUseCase` to call the deterministic splitter before the previous complex/AI branch.

Flow:

- Single item / no split: preserves existing behavior.
- Multiple deterministic items:
  - resolves each item through `LogFoodFromRawInputUseCase` using a staged in-memory repository,
  - collects successful and failed item outcomes,
  - persists to the real repository only if all items resolve successfully.

The implementation does not modify:

- `DeterministicFoodParser` contract
- resolver ranking
- `computeTotals`
- `resolvePortionGrams`
- Supabase files
- package files

---

## Partial-Success Behavior

Default behavior implemented:

- If all split items resolve successfully:
  - all recognized entries are persisted.
- If one or more items fail:
  - no entries are persisted to the real repository,
  - recognized items are returned in a structured failure result,
  - failed items are returned with reason details,
  - explanation states that save was blocked and nothing was saved automatically.

Failure result shape:

```ts
{
  status: 'blocked_partial_failure',
  recognizedItems: Array<{ rawText: string; parsedName: string; calories: number }>;
  failedItems: Array<{ rawText: string; index: number; reason: string }>;
  explanation: string;
}
```

Future recovery support:

- The returned `recognizedItems` and staged all-or-nothing behavior keep the architecture compatible with a future explicit UI action such as **"Save recognized items only"**.
- That CTA was intentionally not implemented in this task.

---

## Tests Added / Updated

Added splitter unit coverage in `src/features/nutrition/__tests__/splitMultiItemInput.test.ts`:

- German: `2 Eier und 200g Quark`
- English: `2 eggs and 200g quark`
- Comma: `apple, banana, skyr`
- Mixed: `apple, banana and skyr`
- Empty fragment handling
- Single-item no-split behavior

Updated meal use-case integration coverage in `src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts`:

- German multi-item persistence
- English multi-item persistence
- Comma multi-item persistence
- Mixed comma + English connector persistence
- Partial-success failure:
  - two valid items recognized,
  - one invalid item failed,
  - no real repository persistence,
  - recognized and failed items surfaced.
- Deterministic split works without `AiMealParser`.

Updated mock resolver food coverage for quark and German split examples in `src/features/nutrition/__tests__/helpers/MockResolverBuilder.ts`.

---

## Verification Result

### Passed

Narrow tests:

```bash
npm run test -- --runTestsByPath src/features/nutrition/__tests__/splitMultiItemInput.test.ts src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts
```

Result:

- 2 test suites passed
- 16 tests passed

Typecheck:

```bash
npm run typecheck
```

Result: passed.

Task-local formatting check:

```bash
npx prettier --check src/features/nutrition/application/utils/splitMultiItemInput.ts src/features/nutrition/application/usecases/LogMealFromRawInputUseCase.ts src/features/nutrition/__tests__/splitMultiItemInput.test.ts src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts src/features/nutrition/__tests__/helpers/MockResolverBuilder.ts ROADMAP.md
```

Result: passed.

Full Jest suite:

```bash
npm run test
```

Result:

- 81 test suites passed
- 583 tests passed

### Blocking issue

Required product verification was run:

```bash
npm run verify
```

Result: failed at `npm run format:check` due repository-wide formatting warnings in unrelated pre-existing files. After formatting the files touched by this task only, `npm run verify` was rerun and still failed at `format:check` on 61 unrelated files.

Per repository governance, P1-003 must not be claimed fully done until required blocking verification passes. `ROADMAP.md` remains `in_progress` rather than `done`.

---

## Known Limitations

- Splitter is intentionally simple and deterministic; it may split semantically composed foods containing connector words, e.g. `bread and butter`.
- `mit` / `with` can mean a separate item or a topping/context; P1-003 explicitly required support, so the splitter treats them as connectors.
- The future **"Save recognized items only"** UI action is not implemented.
- Full `npm run verify` is blocked by pre-existing repository-wide formatting warnings outside the scope of P1-003.

---

## Scope Confirmations

- No package changes.
- No Supabase changes.
- No scripts created.
- No push performed.
- No resolver ranking changes.
- No parser contract changes.
- No `computeTotals` changes.
- No `resolvePortionGrams` changes.