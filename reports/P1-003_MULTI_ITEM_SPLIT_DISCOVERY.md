# P1-003 Multi-Item Split Discovery

Task ID: P1-003-DISCOVERY

Scope: Read-only product-code discovery for the safest implementation strategy for P1-003 Multi-Item Split. This report is the only requested artifact. No implementation changes, roadmap changes, commits, or pushes are included.

# Current Logging Flow

## Single-item nutrition logging

Primary file inspected: `src/features/nutrition/application/usecases/LogFoodFromRawInputUseCase.ts`.

Current single-item flow:

1. `execute({ rawText, rawInput }, dateISO?)` receives one raw item-like string.
2. `DeterministicFoodParser.parse(rawText)` extracts:
   - `name`
   - `quantityGrams`
   - `quantityCount`
   - `unit`
3. `detectCanonicalEntity(parsed.name)` is used for canonical hints and default portions.
4. Date is selected from `dateISO` or `clock.now()`.
5. Quantity is interpreted:
   - explicit grams become `quantityGrams`
   - count plus canonical default portion can become grams
   - count without default portion remains zero grams
   - no quantity remains zero grams
6. `PortionParser.parse(rawText, { hasBaseGrams })` creates portion metadata for explainability.
7. A base `FoodEntry` is built with zero macros and initial confidence.
8. `detectInputType(rawInput)` classifies the input as `generic`, `branded`, or `ambiguous`.
9. `resolveCanonicalFood(parsed.name, originalRawInput, traceId, inputType)` performs resolution:
   - normalizes parsed name using `normalizeText`
   - checks alias cache via `FoodAliasRepository`
   - uses `FoodCatalogResolver.resolve(...)` if available
   - falls back to catalog search and AI food mapper only if resolver path does not return
10. If a resolver result is accepted, macros are calculated via:
    - `resolvePortionGrams(parsed.name, quantityGrams, parsed.quantityCount)`
    - `computeTotals(result.canonicalFood.per100g, targetGrams, 1)`
11. Explainability and assumptions are added via resolver decision summaries and portion metadata.
12. Strict zero-macro blocker throws `RESOLVER_FAILED_OR_NO_MACROS` if calories are missing or zero.
13. The entry is persisted through `FoodEntryRepository.addEntry(entry)`.
14. The persisted `FoodEntry` is returned.

This path is currently the safest and most complete logging path because it includes the current resolver integration, portion/default portion handling, macro calculation, assumption tags, zero-macro blocking, and persistence.

## Meal/multi-item nutrition logging

Primary file inspected: `src/features/nutrition/application/usecases/LogMealFromRawInputUseCase.ts`.

Current meal flow:

1. `execute(rawInput, dateISO?)` starts with an empty `createdEntries` array.
2. It checks `isComplexMealInput(rawInput) && this.aiMealParser`.
3. If the condition is true:
   - it calls `aiMealParser.parseMeal(rawInput)`
   - loops over `aiResult.items`
   - creates entries through private `createEntryFromAiItem(...)`
   - persists each item directly inside `createEntryFromAiItem(...)`
4. If the condition is false:
   - it delegates to `this.singleItemUseCase.execute({ rawText: rawInput, rawInput }, dateISO)`
   - returns a one-entry array

Important observation: the AI/multi-item branch in `LogMealFromRawInputUseCase` does **not** reuse `LogFoodFromRawInputUseCase` per item. It has its own private item-to-entry logic, its own private `resolveCanonicalFood`, and uses `NutritionEngine.calculateFromPer100g(...)` rather than the newer `computeTotals(...)`/`resolvePortionGrams(...)` path used by the single-item flow.

# Current Parser Flow

## Parser dependencies directly referenced by inspected use cases

The inspected use cases reference these parser-related dependencies:

- `src/features/nutrition/infrastructure/parsers/DeterministicFoodParser.ts`
  - injected into both logging use cases
  - actually used directly by `LogFoodFromRawInputUseCase`
  - passed through by `LogMealFromRawInputUseCase` to its internal single-item use case
- `src/features/nutrition/application/utils/InputComplexity.ts`
  - `isComplexMealInput(rawInput)` is used by `LogMealFromRawInputUseCase` to decide whether to use AI meal parsing
- `src/features/nutrition/application/ports/AiMealParser.ts`
  - optional port used by `LogMealFromRawInputUseCase` for complex meal parsing
- `src/features/nutrition/infrastructure/ai/FakeAiMealParser.ts`
  - deterministic development/test implementation of `AiMealParser`
  - not directly imported by the use case, but used by DI/tests as the parser implementation
- `src/features/nutrition/domain/models/AiMealTypes.ts`
  - defines `AiParsedMeal`, `AiParsedMealItem`, `AiQuantityUnit`, and `AiSizeHint`

Related parser pipeline discovered outside the two requested use cases:

- `src/features/input/application/parseInput.ts`
- `src/features/input/infrastructure/simpleParser.ts`
- `src/features/input/application/prepareNutritionResolverDispatch.ts`
- `src/features/input/application/resolvePreparedNutritionInputs.ts`
- `src/features/input/application/logResolvedNutritionInput.ts`

This separate input pipeline already supports some multi-item preparation and per-item resolver dispatch in tests, but it is separate from the nutrition use cases inspected as the primary current logging pipeline.

## DeterministicFoodParser behavior

File: `src/features/nutrition/infrastructure/parsers/DeterministicFoodParser.ts`.

Current capabilities:

- trims and lowercases input
- extracts grams anywhere in the string via `(\d+(?:[.,]\d+)?)\s*g\b`
- extracts German `Xer` count forms such as `20er nuggets`
- extracts leading numeric count such as `2 eggs` or `3x eggs`
- extracts leading German number words from one to ten, such as `zwei äpfel`
- returns one `DeterministicParseResult`, not an array

Current limitation: it is a single-item parser. It does not split `and`, `with`, `und`, `mit`, commas, plus signs, or ampersands into separate parsed items.

## InputComplexity behavior

File: `src/features/nutrition/application/utils/InputComplexity.ts`.

Current capabilities:

- returns true for German connector tokens:
  - ` mit `
  - ` und `
- returns true for:
  - `+`
  - `&`
  - comma-separated inputs with at least two non-empty parts
- deliberately returns false for German count forms like `20er nuggets`

Current limitation: it does not detect English `and` or `with`, so English multi-item inputs may fall into the single-item path.

## FakeAiMealParser behavior

File: `src/features/nutrition/infrastructure/ai/FakeAiMealParser.ts`.

Current capabilities:

- detects connectors:
  - ` mit `
  - ` und `
  - `+`
  - `&`
  - `,`
- splits by those connectors
- parses per-part:
  - German `Xer` count as `piece`
  - leading numeric count as `piece`
  - leading grams only when grams are at the start of the part, e.g. `200g quark`
  - default drink quantity as `400ml`
  - default side quantity as `1 portion`

Current limitation: despite being deterministic in implementation, it is the AI meal parser path and creates entries labeled/explained as AI-structured multi-item meals.

# Current Limitation

Multi-item input is only partially supported today.

## Supported today

When using `LogMealFromRawInputUseCase` with an `AiMealParser` instance and an input detected by `isComplexMealInput`, multi-item splitting can occur through `aiMealParser.parseMeal(rawInput)`.

Examples from existing tests:

- `20er nuggets mit cola und pommes` creates three entries.
- `burger mit cola` creates two entries.

## Not safely supported in the target P1-003 sense

The current P1-003 roadmap requirement is deterministic splitting at `und`, `mit`, and `,`, followed by resolver per item. The current implementation does not yet provide a dedicated deterministic multi-item split layer in the nutrition pipeline.

Specific limitations:

- `DeterministicFoodParser` returns only one parsed result.
- `LogFoodFromRawInputUseCase` treats its input as one item.
- `LogMealFromRawInputUseCase` uses AI parser branching for complex input, not a deterministic split-first path.
- The AI/multi-item branch duplicates older resolution and macro logic instead of reusing the newer single-item path.
- English connectors `and` and `with` are not detected by `isComplexMealInput` or `FakeAiMealParser`.
- Inputs containing a comma plus English `and` may partially split on comma but leave a combined residual item such as `banana and skyr`.
- Connector word `mit`/`with` is semantically ambiguous: sometimes it means a separate item, sometimes it describes a composed food/dish/topping context.

## Requested example behavior today

### `2 eggs and 200g quark`

Likely current behavior through `LogMealFromRawInputUseCase`:

- `isComplexMealInput` does not detect English ` and `.
- The input falls back to single-item flow.
- `DeterministicFoodParser` sees leading count `2` and returns approximately:
  - `quantityCount = 2`
  - `name = "eggs and 200g quark"`
- Because the grams parser is checked before count parser and detects `200g` anywhere, actual parser precedence likely returns:
  - `quantityGrams = 200`
  - `name = "2 eggs and quark"`
  - `unit = "g"`
- The resolver receives a combined name/query instead of separate `eggs` and `quark` items.
- Expected result: not a reliable two-entry log; likely resolver failure, wrong match, or zero-macro block depending on resolver candidates.

### `apple, banana and skyr`

Likely current behavior through `LogMealFromRawInputUseCase`:

- `isComplexMealInput` detects the comma and enters AI parser path if `aiMealParser` is available.
- `FakeAiMealParser` splits by comma but does not split English `and`.
- Parsed parts likely become:
  - `apple`
  - `banana and skyr`
- Expected result: two attempted entries, not three. The second item may be unresolved or incorrectly resolved as a combined phrase.

If no `aiMealParser` is injected, it falls back to single-item flow and treats the full input as one combined item.

### `2 toast with butter and jam`

Likely current behavior through `LogMealFromRawInputUseCase`:

- `isComplexMealInput` does not detect English `with` or `and`.
- The input falls back to single-item flow.
- `DeterministicFoodParser` sees leading count `2` and returns approximately:
  - `quantityCount = 2`
  - `name = "toast with butter and jam"`
  - `unit = "count"`
- The resolver receives the full combined phrase as one item.
- Expected result: not reliable three-entry logging. It may match `toast` poorly or fail/zero-block depending on resolver behavior.

# Candidate Insertion Points

## Option A: Inside `DeterministicFoodParser`

Description: change `DeterministicFoodParser.parse(...)` to support multi-item outputs.

Pros:

- Parser owns parsing.
- Could centralize quantity and split logic.

Cons:

- High regression risk because `LogFoodFromRawInputUseCase` and many tests expect a single `DeterministicParseResult`.
- Would require interface changes or awkward overloading.
- Risks destabilizing the current P0/P1 single-item flow.

Assessment: not recommended as the first/safest insertion point.

## Option B: At the start of `LogFoodFromRawInputUseCase`

Description: split inside the single-item use case before parsing.

Pros:

- Close to resolver/persistence.

Cons:

- `LogFoodFromRawInputUseCase.execute(...)` returns one `FoodEntry`, so multi-item support would require a return type change or hidden multiple persists.
- Return type changes would affect many callers and tests.
- Hidden multiple persists while returning one entry would be surprising and unsafe.

Assessment: not recommended.

## Option C: At the start of `LogMealFromRawInputUseCase.execute(...)`

Description: add deterministic split before AI parser branching; for multiple split items, call `singleItemUseCase.execute(...)` once per item.

Pros:

- `LogMealFromRawInputUseCase.execute(...)` already returns `Promise<FoodEntry[]>`.
- It can preserve `LogFoodFromRawInputUseCase` as the authoritative single-item resolver/logging path.
- Avoids changing `DeterministicFoodParser`'s existing single-result contract.
- Avoids duplicating macro/resolver/persistence behavior.
- Allows AI meal parsing to remain disabled or fallback-only.

Cons:

- Requires a new deterministic splitter abstraction or utility.
- Needs careful connector handling to avoid splitting true dish names or composed foods incorrectly.

Assessment: recommended safest insertion point for P1-003.

## Option D: Use existing `src/features/input/application` pipeline

Description: route meal logging through `prepareNutritionResolverDispatch`/`resolvePreparedNutritionInputs`.

Pros:

- Some multi-item behavior and tests already exist.
- Already models parsed items, matches, confidence, resolver requests, and unresolved requests.

Cons:

- It is a separate input feature pipeline and not currently the primary inspected nutrition use-case path.
- It may introduce broader integration changes than needed for P1-003.
- Current `resolvePreparedNutritionInputs` passes only `input.raw` to `LogFoodFromRawInputUseCase`, which may lose normalized/canonical intent in some cases.
- Broader architecture decision needed before replacing the current nutrition use-case flow.

Assessment: useful reference, but not the smallest safe insertion point for this task.

# Recommended Architecture

Recommended architecture: introduce a small deterministic multi-item splitter used by `LogMealFromRawInputUseCase` before AI meal parsing, while preserving `LogFoodFromRawInputUseCase` as the only per-item logging implementation.

Recommended shape:

1. New deterministic splitter module, for example:
   - `src/features/nutrition/application/utils/splitMultiItemInput.ts`
   - or `src/features/nutrition/infrastructure/parsers/DeterministicMultiItemSplitter.ts`
2. Splitter returns an explicit structure, not just strings, for example:
   - original raw input
   - `items: { rawText: string; connectorBefore?: string; index: number }[]`
   - `wasSplit: boolean`
   - optional notes/reason codes
3. `LogMealFromRawInputUseCase.execute(...)` flow becomes:
   - call deterministic splitter first
   - if it returns more than one item, loop over items and call `singleItemUseCase.execute({ rawText: item.rawText, rawInput: item.rawText }, dateISO)`
   - if one item only, use existing behavior
   - only use `aiMealParser` as fallback for cases not handled deterministically, if still desired
4. Keep `LogFoodFromRawInputUseCase` unchanged for P1-003 implementation unless a later task explicitly needs metadata preservation.
5. Keep resolver untouched: multi-item split should feed cleaner per-item strings into existing resolver behavior rather than changing resolver ranking/resolution.

This architecture minimizes parser, resolver, and persistence regressions by limiting new behavior to pre-resolution item segmentation.

# Files Likely Affected

Likely implementation files for a future P1-003 implementation:

- `src/features/nutrition/application/usecases/LogMealFromRawInputUseCase.ts`
  - add deterministic split-first branch and delegate each split item to `singleItemUseCase.execute(...)`
- New splitter utility/module, likely one of:
  - `src/features/nutrition/application/utils/splitMultiItemInput.ts`
  - `src/features/nutrition/infrastructure/parsers/DeterministicMultiItemSplitter.ts`
- `src/features/nutrition/application/utils/InputComplexity.ts`
  - possibly update or de-emphasize if deterministic splitter replaces complexity detection for simple connector cases
- `src/features/nutrition/infrastructure/ai/FakeAiMealParser.ts`
  - likely not needed for deterministic P1-003 except tests may need adjustment if AI branch is no longer first for simple connector cases

Likely tests affected or added:

- `src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts`
- `src/features/nutrition/__tests__/InputComplexity.test.ts`
- `src/features/nutrition/__tests__/DeterministicFoodParser.test.ts`
  - only if parser behavior changes; recommended strategy avoids changing this file
- New test file for splitter, for example:
  - `src/features/nutrition/__tests__/splitMultiItemInput.test.ts`

Existing related input-pipeline files/tests that may be affected only if architecture is unified later:

- `src/features/input/application/parseInput.ts`
- `src/features/input/infrastructure/simpleParser.ts`
- `src/features/input/application/prepareNutritionResolverDispatch.ts`
- `src/features/input/application/resolvePreparedNutritionInputs.ts`
- `src/features/input/application/logResolvedNutritionInput.ts`
- `src/features/input/application/__tests__/prepareNutritionResolverDispatch.test.ts`
- `src/features/input/application/__tests__/resolvePreparedNutritionInputs.test.ts`
- `src/features/input/application/__tests__/logResolvedNutritionInput.test.ts`

# Test Impact

Existing tests likely impacted:

- `src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts`
  - Current tests expect AI-structured explanations for connector-based multi-item inputs when `aiMealParser` is present.
  - A deterministic split-first implementation may remove AI explanation for simple connector splits.
  - Tests around `20er nuggets mit cola und pommes`, `burger mit cola`, and `AI explanation in Entries aufnehmen` would need explicit expectations based on the new policy.
- `src/features/nutrition/__tests__/InputComplexity.test.ts`
  - May need additions for English `and`/`with` if complexity detection remains relevant.
  - May remain unchanged if a new splitter supersedes it for deterministic split decisions.
- `src/features/nutrition/__tests__/DeterministicFoodParser.test.ts`
  - Should remain unchanged under the recommended strategy.
- `src/features/input/application/__tests__/*`
  - Should remain unchanged under the recommended smallest strategy because the separate input pipeline is not modified.

New tests recommended:

- splitter unit tests:
  - `2 eggs and 200g quark` -> `2 eggs`, `200g quark`
  - `apple, banana and skyr` -> `apple`, `banana`, `skyr`
  - `2 toast with butter and jam` -> cautiously expected split policy, likely `2 toast`, `butter`, `jam` if English connectors are in scope
  - `20er nuggets` remains one item
  - empty/leading/trailing delimiters are ignored or handled safely
  - no split inside normal single-item names
- meal use-case integration tests:
  - deterministic split produces multiple persisted entries
  - each item uses `LogFoodFromRawInputUseCase` path
  - one failing item behavior is defined before implementation: either fail whole operation or persist successes and surface partial failure

# Risk Analysis

## Parser regressions

Risk level: medium.

Risks:

- Over-eager splitting can break composed foods/dishes, e.g. `bread and butter` may be intended as one common combined food or two items.
- Connector `mit`/`with` can indicate toppings or preparation rather than separate foods.
- Existing German `Xer` count behavior must remain single-item.
- English connectors are currently not handled by `InputComplexity`/`FakeAiMealParser`; adding them changes behavior.
- Splitting before quantity parsing can incorrectly associate quantities if grammar is ambiguous.

Mitigations:

- Do not change `DeterministicFoodParser.parse(...)` contract.
- Add a separate splitter with narrow, well-tested rules.
- Preserve per-item raw text exactly where possible.
- Start with obvious delimiter patterns and explicit tests.
- Avoid splitting unknown connector cases unless the resulting items are non-empty and individually plausible.

## Resolver regressions

Risk level: low to medium.

Risks:

- Resolver may receive shorter per-item strings, changing candidate ranking versus current combined phrase behavior.
- More resolver calls per input can expose source latency/failure more often.
- Alias storage may save aliases per split item instead of the full raw phrase, which is likely desired but changes cache behavior.

Mitigations:

- Keep resolver code unchanged.
- Call the existing `LogFoodFromRawInputUseCase` per item.
- Add tests using mock resolver to verify resolver call count and per-item raw inputs.
- Preserve trace logging to debug per-item resolution.

## Logging regressions

Risk level: medium.

Risks:

- Partial persistence semantics are currently not explicit for deterministic multi-item split.
- If item 1 persists and item 2 fails zero-macro blocking, the operation may leave partial logs unless transaction-like handling is added.
- Current `LogMealFromRawInputUseCase` AI branch persists each entry during the loop, so partial persistence may already be possible.
- Returning `FoodEntry[]` is compatible, but UI/callers must handle multiple entries and errors consistently.

Mitigations:

- Define failure semantics before implementation.
- Smallest implementation can preserve current behavior: sequential per-item persistence and throw on first failure.
- Safer later improvement would be pre-resolve all items before persisting, but that is larger and may require repository changes.
- Add tests for multi-item success and one-item failure behavior.

# Smallest Safe Implementation Plan

The smallest safe future implementation is:

1. Add a deterministic multi-item splitter as a new isolated module.
2. Keep `DeterministicFoodParser` unchanged.
3. In `LogMealFromRawInputUseCase.execute(...)`, call the splitter before `isComplexMealInput(...)`/`aiMealParser`.
4. If splitter returns more than one item:
   - iterate over split items
   - call `this.singleItemUseCase.execute({ rawText: item.rawText, rawInput: item.rawText }, dateISO)` for each
   - collect and return `FoodEntry[]`
5. If splitter returns one item:
   - keep existing behavior unchanged.
6. Do not modify resolver, catalog, macro calculation, or persistence repositories.
7. Add focused tests for splitter and `LogMealFromRawInputUseCase` deterministic split behavior.

This plan directly satisfies the roadmap requirement to split input and force resolver per item while minimizing changes to the stable logging/resolver path.

# Recommended Implementation Sequence

Recommended future sequence for P1-003 implementation:

1. Add tests for deterministic splitter behavior first.
2. Implement splitter with conservative connector support:
   - German: `und`, `mit`
   - punctuation: `,`
   - optionally English: `and`, `with` if accepted as part of P1-003 scope despite roadmap naming only `und`, `mit`, `,`
3. Add `LogMealFromRawInputUseCase` tests proving deterministic split calls/persists per item through the single-item path.
4. Modify `LogMealFromRawInputUseCase.execute(...)` to use deterministic split-first logic.
5. Keep AI meal parsing as fallback for complex cases not deterministically split, or leave it behind the deterministic split branch.
6. Run narrow tests:
   - `npm run test -- --runTestsByPath src/features/nutrition/__tests__/LogMealFromRawInputUseCase.test.ts`
   - splitter test path once created
7. Run full required verification for product/runtime changes per `VERIFY.md`:
   - `npm run verify`
8. Only after verification passes, update `ROADMAP.md` task status in the actual implementation task, not in this discovery task.

Recommended policy decision before implementation:

- Decide whether English `and`/`with` are included in P1-003 scope. The requested discovery examples include English connectors, but the roadmap text specifically says split at `und`, `mit`, and `,`.
- Decide deterministic multi-item failure semantics: fail whole operation on first failed item, or persist successes and report partial failures.