# RESOLVER-V3-050 — Benchmark Production-Call-Path Fidelity

**Status:** done
**Canonical starting commit:** `04e742e751b3622901cfe57d474e2fe6c6b9ca84` (PR #172 / RESOLVER-V3-049 merge
commit, `origin/chore/clean-arch-structure` tip at task start — confirmed identical, no later
commits to inspect).
**Provider-call policy:** zero provider calls throughout. `ANTHROPIC_API_KEY` never inspected,
printed, copied, set, or used — only its boolean presence was checked (absent, as required).
**Worktree/branch:** `D:\Workspaces_VSCode\HealthApp-resolver-v3-050`,
`fix/resolver-v3-050-benchmark-production-call-path-fidelity`.

---

## 1. Production boundary

`LogFoodFromRawInputUseCase.execute()` / `resolveCanonicalFood()` (the only two call sites; every
real caller — `LogMealFromRawInputUseCase`'s single-item and multi-item flows,
`resolvePreparedNutritionInputs.ts` — always passes `rawText === rawInput`, verified by direct
inspection of all four call sites) does, in order:

1. `const parsed = this.parser.parse(rawText)` — the real `DeterministicFoodParser`
   (`src/features/nutrition/infrastructure/parsers/DeterministicFoodParser.ts`), never a
   benchmark-invented parser.
2. `originalParsedName = parsed.name` is preserved separately from `rawInput`.
3. `const inputType = detectInputType(rawInput)` — derived from the **original, unparsed** raw
   input, not the parsed name (`LogFoodFromRawInputUseCase.ts:202`).
4. `resolveCanonicalFood(parsed.name, originalRawInput, traceId, inputType)` is called with the
   **parsed** food name as its `parsedName` argument and the **original, unparsed** raw input as
   its `rawInput` argument.
5. Inside `resolveCanonicalFood`: `const normalized = normalizeText(parsedName)` — normalizes the
   **parsed** name, never the raw string (`LogFoodFromRawInputUseCase.ts:558`).
6. `this.resolver.resolve({ raw: rawInput, normalized, locale: 'de', inputType }, { traceId })` —
   `raw` carries the **original, unparsed** `rawInput` argument (step 4); `normalized` carries the
   normalized **parsed** name (step 5); `inputType` carries the value derived from the **original**
   raw input (step 3).

Net production contract for `FoodSearchQuery`:

| Field        | Source                                                                    |
| ------------ | ------------------------------------------------------------------------- |
| `raw`        | original, unparsed `rawInput`                                             |
| `normalized` | `normalizeText(DeterministicFoodParser.parse(rawInput).name)`             |
| `inputType`  | `detectInputType(rawInput)` — original, unparsed, **not** the parsed name |

## 2. Old benchmark boundary

`ResolverV3VariantAAdapter.runVariantACase()` (pre-fix):

```ts
const normalized = normalizeText(benchmarkCase.rawInput); // BUG: raw input, not parsed name
const inputType = detectInputType(benchmarkCase.rawInput); // already correct
const query = { raw: benchmarkCase.rawInput, normalized, locale, inputType, traceId };
```

`raw` and `inputType` already matched the production contract exactly. Only `normalized` diverged:
it normalized the complete, unparsed `rawInput` directly, skipping `DeterministicFoodParser`
entirely — a call path real production never takes.

## 3. Exact fidelity defect

For any input with a removable quantity/article/count/unit prefix, the old boundary's `normalized`
field retained that prefix (`"ein apfel"`, `"200g broetchen"`, `"2x apfel"`, …) while production —
and now the corrected boundary — sends only the parsed food name (`"apfel"`, `"broetchen"`,
`"apfel"`, …). This benchmark-only divergence could (a) spuriously collide with an unrelated BLS
record whose normalized name happens to contain the polluted string as a substring (the target
case), or (b) simply fail to match anything that the parsed name alone would have matched,
producing a false `rejected` instead of the real `ambiguous`/`accepted` outcome.

`detectInputType` and the `raw` field were **not** defective — both already matched production
before this task and are unchanged by this fix.

## 4. Target-case reproduction

**`RH-RES-SIMPLE-DEV-003`** ("Ein Apfel"):

- Old boundary: `normalized = "ein apfel"` → `resolver.resolve()` → **`accepted`**, winner
  `Y845242` ("Apfelküchlein (Apfelringe im Milchbackteig) gebraten") — a real, unrelated BLS
  pastry record. Mechanism: `"ein apfel"` is a literal substring of that record's normalized name
  `"apfelkuechlein apfelringe im milchbackteig gebraten"` (`...kuechl[ein] [apfel]ringe...`),
  matched via `BlsLookupEngine`'s includes-match stage. **False confident** (per
  `evaluateVariantACase.isFalseConfident`: `status === 'accepted'` and
  `expectedBehavior === 'resolution_with_assumption'` ≠ `direct_resolution`).
- Corrected boundary: `DeterministicFoodParser.parse("Ein Apfel").name === "apfel"` (article
  stripped, `quantityCount: 1`) → `normalized = "apfel"` → `resolver.resolve()` → **`ambiguous`**,
  no winner. Not false confident.
- The corrected result is the **existing honest ambiguity result**, not the historical false
  acceptance — confirmed via a real resolver call, not asserted from the diagnosis alone.

Reproduced as a permanent regression test:
`src/features/nutrition/benchmark/__tests__/ResolverV3050BenchmarkProductionCallPathFidelity.test.ts`
(`describe('target case: RH-RES-SIMPLE-DEV-003 ("Ein Apfel")')`, 6 tests), which pins both the OLD
boundary (reproduced verbatim, frozen, for regression purposes only) and the corrected boundary's
behavior forever.

## 5. Selected implementation contract

Fixed the single shared call site, `ResolverV3VariantAAdapter.runVariantACase()`:

```ts
const parser = new DeterministicFoodParser();
const parserResult = parser.parse(benchmarkCase.rawInput);
const normalized = normalizeText(parserResult.name); // FIX: parsed name, not raw input
const inputType = detectInputType(benchmarkCase.rawInput); // unchanged — already correct
const query = { raw: benchmarkCase.rawInput, normalized, locale, inputType, traceId };
```

`VariantARawResult` was extended (not redesigned) with two new fields for provenance —
`originalRawInput` and `parserResult` (the real `DeterministicParseResult`, carrying `.name`,
`.quantityGrams`, `.quantityCount`, `.unit`) — satisfying the task's "preserve separately" contract
without duplication: `query.normalized` **is** the "normalized parsed food name" (they are the same
value by construction of the fix, documented as such in the type's own docstring, not silently
assumed); `query.raw`/`query.locale`/`query.inputType`/`query.traceId` already carry the remaining
required fields.

No new regex, number-word table, quantity-removal, or unit-parsing logic was written in the
benchmark adapter — the real, unmodified `DeterministicFoodParser` class is instantiated and called
directly. No shared standalone helper module was introduced: `runVariantACase` was already the
single call site every benchmark execution path funnels through (see §6/§7), so fixing it in place
is the narrowest change that eliminates the divergence — inventing a separate helper would have
added indirection without reducing it.

## 6. Variant A changes

`ResolverV3VariantAAdapter.runVariantACase()` is the only production-benchmark-boundary code
changed. Its docstring and the module docstring were updated to state the corrected contract
explicitly, including the deliberate asymmetry (`normalized` now parser-derived, `raw`/`inputType`
unchanged).

## 7. Variant C fast-path changes

No separate code change was needed. `ResolverV3VariantCAdapter.buildFastPathMealResult()` calls
`runVariantACase()` directly and uses the fast path iff its `decision.status === 'accepted'` — so
Variant C's fast path inherits the fix automatically and completely. Verified by direct inspection
of the call graph and by the offline impact analysis (§8), which shows Variant C's fast-path
outcome is bit-for-bit identical to Variant A's own outcome on every one of the 104 corpus cases,
both before and after the fix (`ResolverV3050OfflineImpactAnalysis.test.ts`, "Variant C's fast-path
outcome exactly mirrors Variant A's own outcome" test).

The same call graph confirms the fix also automatically reaches, with zero further code changes:

- `RepresentativeHybridV1ThreeArmRunner.runRepresentativeHybridV1ThreeArms()` (fixture execution
  for both Variant A and Variant C's fast path);
- `RepresentativeHybridV1LiveRunner.ts` (live execution preparation — calls `runVariantACase`/
  `runVariantCCase` directly, per its own docstring reason for not using the ThreeArmRunner
  wrapper);
- `LearningBenchmarkV2`'s `evaluateLearningBenchmarkV2ResolutionScenario.ts` (a different,
  unrelated benchmark that happens to reuse the same shared adapter — fixed as a zero-risk
  side-effect, not a scope expansion).

No AI-routed interpretation input (Variant C's post-fast-path branch, `ResolverV3VariantCRetrieval.ts`)
was touched — its two `normalizeText()` calls operate on AI-interpreted native queries/scoring
anchors, never on the raw benchmark input, and are unaffected by this defect.

## 8. Complete offline corpus impact analysis

Ran both boundaries over the entire frozen `REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS` corpus
(104 resolution-decomposition cases: 80 development + 24 holdout) — zero provider calls, real
deterministic BLS-backed resolver only. Implementation:
`src/features/nutrition/benchmark/resolverV3050OfflineImpactAnalysis.ts` (the OLD boundary is
reproduced verbatim there, frozen, solely for this comparison — no current call path uses it).
Regression-protected by `ResolverV3050OfflineImpactAnalysis.test.ts` (6 tests, including structural
invariants: transitions are mutually exclusive, Variant C mirrors Variant A exactly, no-op cases
never show an outcome change). Full per-case data written to
`logs/resolver-v3-050-offline-impact-analysis.json` (gitignored; regenerate on demand).

### Totals

| Metric                                      | Count                             |
| ------------------------------------------- | --------------------------------- |
| All cases                                   | 104 (80 development + 24 holdout) |
| Changed resolver input (boundary changed)   | 44                                |
| Changed outcome (status changed)            | 13                                |
| `accepted` → `ambiguous`                    | 1                                 |
| `ambiguous` → `accepted`                    | 0                                 |
| `accepted` → `rejected`/no-match            | 0                                 |
| `rejected`/no-match → `accepted`            | 5                                 |
| Winner `sourceId` changes                   | 11                                |
| False-confidence changes (either direction) | 2                                 |
| — newly false-confident                     | 1                                 |
| — no longer false-confident                 | 1                                 |
| Identification changes                      | 10                                |

### Category/partition distribution of the 13 changed-outcome cases

| Category  | Count |
| --------- | ----- |
| SIMPLE    | 8     |
| HOUSEHOLD | 3     |
| BRANDED   | 1     |
| VAGUE     | 1     |

| Partition   | Count |
| ----------- | ----- |
| development | 11    |
| holdout     | 2     |

### The 13 changed-outcome cases

| Case ID                   | Category  | Partition   | Raw input                  | Old → corrected      | Winner change    | False confidence                      |
| ------------------------- | --------- | ----------- | -------------------------- | -------------------- | ---------------- | ------------------------------------- |
| RH-RES-SIMPLE-DEV-003     | SIMPLE    | development | Ein Apfel                  | accepted → ambiguous | Y845242 → (none) | **true → false** (target case)        |
| RH-RES-VAGUE-DEV-004      | VAGUE     | development | Ein Snack                  | rejected → accepted  | (none) → X5A1030 | **false → true** (residual risk, §11) |
| RH-RES-HOUSEHOLD-DEV-001  | HOUSEHOLD | development | 2 Scheiben Vollkornbrot    | rejected → accepted  | (none) → B101000 | unchanged (false)                     |
| RH-RES-HOUSEHOLD-HOLD-001 | HOUSEHOLD | holdout     | 1 Scheibe Gouda            | rejected → ambiguous | (none) → M402500 | unchanged (false)                     |
| RH-RES-OVERLAY-DEV-001    | SIMPLE    | development | 100g Reis roh              | rejected → ambiguous | (none) → C354100 | unchanged (false)                     |
| RH-RES-OVERLAY-DEV-002    | SIMPLE    | development | Ein Apfel (roh)            | rejected → accepted  | (none) → F110100 | unchanged (false)                     |
| RH-RES-OVERLAY-DEV-003    | HOUSEHOLD | development | Zwei Scheiben Vollkornbrot | rejected → accepted  | (none) → B101000 | unchanged (false)                     |
| RH-RES-OVERLAY-DEV-006    | BRANDED   | development | Eine Cola                  | rejected → ambiguous | (none) → N390100 | unchanged (false)                     |
| RH-RES-OVERLAY-DEV-013    | SIMPLE    | development | 20g Zucker                 | rejected → ambiguous | (none) → S111000 | unchanged (false)                     |
| RH-RES-SIMPLE-DEV-001     | SIMPLE    | development | 100g Reis roh              | rejected → ambiguous | (none) → C354100 | unchanged (false)                     |
| RH-RES-SIMPLE-DEV-002     | SIMPLE    | development | Ein Ei                     | rejected → accepted  | (none) → Y720100 | unchanged (false)                     |
| RH-RES-SIMPLE-DEV-004     | SIMPLE    | development | 20g Butter                 | rejected → ambiguous | (none) → (none)  | unchanged (false)                     |
| RH-RES-SIMPLE-HOLD-001    | SIMPLE    | holdout     | Eine Karotte               | rejected → ambiguous | (none) → (none)  | unchanged (false)                     |

**Reading the totals**: 44 of 104 cases had a removable quantity/article/count/unit prefix (the
boundary itself changed), but only 13 of those 44 produced a different resolver _outcome_ — most
prefix removals simply changed which no-match `normalized` string was sent, without changing
whether the (already-unmatched) query resolved. Every change strictly improves or corrects honesty
except one (§11): 5 previously-clean `rejected` cases now correctly `accept` or surface a real
`ambiguous` set (the old boundary's polluted query matched nothing at all); 1 case moves from a
false-confident `accepted` to an honest `ambiguous` (the target case); 1 case (§11) newly becomes
`accepted` and is newly false-confident — a genuine, pre-existing, previously-invisible BLS
fast-path defect the corrected fidelity now surfaces, not a defect this task introduces or may fix.

## 9. Historical-evidence treatment

The seven `logs/resolver-v3-039-*` frozen evidence files, the V3-039 closeout report, and the
evidence manifest are **untouched** — confirmed by `git diff --stat` across the full change range
showing zero bytes touched under `logs/**` and zero touched generated-artifact files. `RESOLVER-V3-038`'s
frozen corpus fixtures (`src/features/nutrition/benchmark/representativeHybridV1/*Corpus.ts`) are
also unchanged — this task fixed only the benchmark's _execution_ boundary
(`ResolverV3VariantAAdapter.ts`), never the corpus data.

Explicit disclosure:

- **Protocol v3** (RESOLVER-V3-038/V3-039) used the OLD, article/quantity-polluted benchmark
  boundary. Its results — including RESOLVER-V3-041's gate re-decision figures (Development Variant
  C false-confidence rate 6.48%, controlling case `RH-RES-DACH-DEV-006`) — remain valid as an
  immutable historical record of what that specific, now-known-unfaithful harness measured. They
  are **not** reinterpreted, recomputed, or silently corrected by this task.
- **Protocol v4** (RESOLVER-V3-048, not yet started) MUST use the corrected, production-faithful
  boundary this task establishes.
- Any future comparison between protocol v3 and protocol v4 metrics MUST explicitly disclose the
  input-boundary semantic change — a metric improvement or regression across that boundary is not
  directly attributable to a resolver/BLS change unless the offline impact analysis (§8) is first
  consulted to separate boundary-fidelity effects from genuine behavior effects.

## 10. Protocol-v4 requirement

This task supplies the binding input-boundary decision RESOLVER-V3-048 must incorporate: future
Variant A and Variant C deterministic fast-path benchmark execution reproduces
`DeterministicFoodParser.parse(rawInput).name → normalizeText → resolver.resolve()` exactly, with
`raw`/`inputType` derived from the original, unparsed raw input. RESOLVER-V3-048 owns the full
protocol-v4 evidence contract, execution-tree hash, frozen plan, and budget authorization; this
task does not create those artifacts.

## 11. Residual risks

1. **`RH-RES-VAGUE-DEV-004` ("Ein Snack") — newly surfaced, pre-existing BLS fast-path
   substring-collision false confidence.** Under the corrected boundary, "Ein Snack" parses to
   "snack", which substring/token-matches the single real BLS record "Kichererbsensnack gebacken"
   (`X5A1030`) and is confidently `accepted` — even though this case's own ground truth
   (`expectedBehavior: 'abstention_expected'`, `criticalFailureConditions: ['Reports a specific
numeric estimate for the bare word "Snack".']`) says a bare "Snack" should never resolve to a
   specific numeric estimate. **This is not a defect introduced by RESOLVER-V3-050**: real
   production, today, already parses "Ein Snack" → "snack" and would already send exactly this
   query to the resolver — the OLD benchmark boundary simply never exercised this call path (it
   sent "ein snack" verbatim, which does not collide with "Kichererbsensnack"). The corrected
   fidelity now makes this pre-existing production exposure visible where it was previously hidden.
   RESOLVER-V3-050 does not fix it (out of its own explicit scope: no resolver/BLS/parser behavior
   change). Recorded here, and as a dedicated regression test
   (`RepresentativeHybridV1ThreeArmBoundary.test.ts`, "RESOLVER-V3-050 residual risk" test), for a
   future BLS generic fast-path remediation task (structurally similar to RESOLVER-V3-043/049's
   substring/token-collision family of defects) to pick up.
2. **Benchmark-only vs. production-only divergence risk going forward.** Because the fix lives in
   benchmark code (`ResolverV3VariantAAdapter.ts`) that deliberately re-derives the production call
   order rather than calling `LogFoodFromRawInputUseCase` itself, any _future_ change to production's
   parser→resolver call order (e.g. a change to which raw/parsed value feeds `inputType`) would
   silently re-diverge the benchmark from production unless a corresponding benchmark-adapter change
   is made in lockstep. No automated cross-check enforces this beyond the tests added by this task,
   which pin today's exact contract.
3. **Materiality of the 44 boundary-changed-but-outcome-unchanged cases (31 of 44) was not
   individually re-verified beyond structural invariants** — the offline analysis confirms their
   resolver `status`/winner did not change, but their `normalizedResolverInput` string did (e.g. a
   different no-match string), which is expected and benign but not exhaustively hand-reviewed
   case-by-case beyond the automated comparison.

## 12. Consequence for V3-043, V3-047, and V3-048

- **RESOLVER-V3-043** stays `in_progress`. This task closes the benchmark-fidelity-owned
  false-confidence case (`RH-RES-SIMPLE-DEV-003` / "Ein Apfel") for future protocol semantics — it
  was never a production defect, so there is nothing to fix in production code, only in the
  benchmark boundary (now fixed). RESOLVER-V3-043's remaining owned closure conditions are now only
  the explicitly assigned RESOLVER-V3-044 and RESOLVER-V3-045 AI-routed case IDs. The full
  eight-case umbrella is **not** claimed closed by this task alone (RESOLVER-V3-044/045 still
  outstanding).
- **RESOLVER-V3-047** (Haiku-only optimization candidate evaluation) depends on RESOLVER-V3-043
  through 046, 049, and 050 — this task's completion removes one of its two remaining upstream
  blockers (049 was already done; 050 is now done too). RESOLVER-V3-044/045/046 remain outstanding.
- **RESOLVER-V3-048** (protocol-v4 controlled live re-evidence, first task authorized to spend live
  provider budget) now has both of its RESOLVER-V3-049/050 prerequisites satisfied, and inherits
  this task's binding input-boundary decision (§10) as a hard requirement for its own protocol-v4
  evidence contract. It remains otherwise unstarted; this task does not begin it.
- **RESOLVER-V3-010** remains `blocked` — unaffected by this task.

## 13. Test-count documentation reconciliation

PR #172 / RESOLVER-V3-049's `ROADMAP.md` entry and `handoffs/latest-handoff.md` both state **"246
suites, 2,377 tests green"**, described as the "existing BLS/resolver regression suite" produced by
`--testPathPattern="Bls|Resolver|resolver"`.

Re-running that exact literal command against the exact canonical base commit (`04e742e`) today:

```
npx jest --testPathPattern="Bls|Resolver|resolver" --runInBand
→ Test Suites: 57 passed, 57 total
→ Tests:       719 passed, 719 total
```

This does **not** reproduce 246/2,377 — the literal command described in the handoff produces
57 suites / 719 tests, a much narrower subset (only files whose _path_ contains "Bls", "Resolver",
or "resolver" — most resolver-adjacent test files, e.g. anything under
`benchmark/representativeHybridV1/**`, do not match this pattern by filename).

Separately, running the true, unfiltered full repository suite (`npm run test` /
`npx jest --runInBand`, no pattern) against the same canonical base commit produces:

```
Test Suites: 239 passed, 239 total
Tests:       2368 passed, 2368 total
```

**Conclusion**: 246 suites/2,377 tests is neither the literal `--testPathPattern="Bls|Resolver|
resolver"` command's output (57/719) nor the single full-repository suite (239/2,368). It is most
consistent with an **aggregate of multiple overlapping targeted jest invocations run during
RESOLVER-V3-049's own iterative development** (e.g. summing several narrower pattern runs whose
file sets overlap, or a full run plus one or more re-runs of newly-added/changed files) — a
legitimate development-workflow artifact, but not a single reproducible command output, and
certainly not "the full repository suite." Per task instruction, this value is corrected in
`ROADMAP.md` and `handoffs/latest-handoff.md` (§ "ROADMAP status" of this report / the handoff
entry itself) to state the true, reproducible full-repository count instead, explicitly labeled as
such, without altering RESOLVER-V3-049's substantive technical result (the 73/14,690-query blast
radius, the two intentionally-updated stale assertions, and the `done` status are all unchanged).

## 14. Verification

| Check                                                                                                                        | Result                                                         |
| ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| New regression tests (target case + quantity/count + no-op controls)                                                         | 16/16 green                                                    |
| New offline impact analysis tests                                                                                            | 6/6 green                                                      |
| Full related-suite run (representativeHybridV1, Variant A/B/C adapters, DeterministicFoodParser, LogFoodFromRawInputUseCase) | 361/361 green                                                  |
| Full repository suite, canonical base commit (baseline)                                                                      | 239 suites / 2,368 tests green                                 |
| Full repository suite, after this task                                                                                       | **241 suites / 2,391 tests green** (net +2 suites / +23 tests) |
| `npx tsc --noEmit`                                                                                                           | clean                                                          |
| `npm run verify`                                                                                                             | green                                                          |
| `git diff --check`                                                                                                           | clean                                                          |
| Frozen `logs/resolver-v3-039-*` evidence                                                                                     | byte-unchanged (confirmed via `git diff --stat`)               |
| Corpus fixture files (`*Corpus.ts`)                                                                                          | byte-unchanged                                                 |
| Provider calls                                                                                                               | 0                                                              |
| Benchmark cost                                                                                                               | $0                                                             |
| `ANTHROPIC_API_KEY`                                                                                                          | never inspected, only boolean-presence-checked (absent)        |
| Development/Holdout rerun                                                                                                    | none                                                           |
| Production `application/**`/`infrastructure/**` files touched                                                                | none                                                           |
| BLS artifact/model-policy change                                                                                             | none                                                           |
