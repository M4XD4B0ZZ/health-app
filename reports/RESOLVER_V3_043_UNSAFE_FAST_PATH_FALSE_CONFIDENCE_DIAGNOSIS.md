# RESOLVER-V3-043 — Unsafe Fast-Path and False-Confidence Remediation (Phase A: D771900)

Task ID: RESOLVER-V3-043
Status: **`in_progress`** (Phase A complete and merged; the task's umbrella acceptance across all
eight canonical false-confidence cases is **not** yet fulfilled — see §6/§7 for the explicit,
evidence-backed deferrals).

Depends on: RESOLVER-V3-041 (`done`, formal verdict `RESOLVER_V3_G2_NOT_PASSED`, merge commit
`271cadca593b339ef12a30b8db6f2efccde340fe`).

## 0. Document history and status correction

A prior **review-only** diagnosis of the same defect class exists on the noncanonical, unmerged
branch `claude/resolver-v3-041-haiku-binding-a1glb1`
(`reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md` there, commit `3fb2539`).
That document is **not canonical** — it was never merged, and RESOLVER-V3-041 itself was not yet
formally decided when it was written. This document supersedes it as the canonical V3-043 report on
`chore/clean-arch-structure`. Its causal findings for D771900 were directionally correct and are
carried forward below (independently re-verified against the real, current, merged source before
being relied on), but its self-description as "diagnosis only, no code changed" no longer applies:
**this document also records the implemented, tested, and merged Phase A fix.**

## 1. Canonical starting state

- Canonical `origin/chore/clean-arch-structure` tip at task start: `271cadca593b339ef12a30b8db6f2efccde340fe`
  (PR #170, RESOLVER-V3-041's formal gate re-decision).
- RESOLVER-V3-041: `done`. Formal verdict `RESOLVER_V3_G2_NOT_PASSED`. `productionWiringAuthorized: false`.
  G2-B (false confidence) failed on the hard, non-averageable criterion: Development Variant C's
  false-confidence rate (6.48%, 7/108) was not strictly below Variant A's (5.00%, 4/80). Controlling
  case: `RH-RES-DACH-DEV-006` ("Brötchen", BLS `D771900`) — present in **both** Variant A's and
  Variant C's false-confident case-ID lists (Variant C's fast path is literally Variant A's
  resolver, so it inherits the identical defect).
- RESOLVER-V3-010: `blocked`, unaffected by this task.
- Claude Haiku 4.5 remains the sole locked production-model candidate
  (`HAIKU_4_5_LOCKED_AS_PRODUCTION_CANDIDATE`) — unaffected by and unrelated to this task.

## 2. Scope correction: the task's own acceptance criteria vs. what the evidence supports

RESOLVER-V3-043's `ROADMAP.md` entry lists its affected subsystem as "resolver fast-path / BLS
lookup engine ... never the benchmark harness or evaluator code", and names the controlling
`RH-RES-DACH-DEV-006` case plus "the remaining 6 Development + 1 Holdout false-confident case IDs"
from `reports/RESOLVER_V3_041_REPRESENTATIVE_HYBRID_GATE_REDECISION.md` §6 as in scope.

Before writing any fix, this task extracted the complete, exact false-confidence case-ID inventory
directly from the frozen `logs/resolver-v3-039-controlled-representative-live-evidence.json` (never
inferred or copied from a prior report) and empirically root-caused every one of the eight cases
against the **real, current, merged production code** — offline, zero provider calls, using the
actual `SequentialFoodCatalogResolver` + `BlsStaticSource` + `DeterministicFoodParser` (a temporary,
untracked probe test was used for this and deleted immediately after; `git status --short` was
clean before this report was written, and no historical evidence file was read through a
write-capable path). This is the complete inventory (§3), and it does **not** support fixing all
eight cases as a single, uniformly-scoped BLS-fast-path change: three cases are purely AI-routed
(the BLS fast path returns zero candidates for them at all — confirmed empirically) and one is a
benchmark-harness artifact that does not reproduce against real production. Treating all eight as
in-scope for a "resolver fast-path / BLS lookup engine" change would be scope creep into
RESOLVER-V3-044/045 territory and into fixing a benchmark bug as if it were a production bug —
both explicitly against this task's own non-goals and against `AGENTS.md`'s "no broad refactors
outside the scope of the current task."

**Decision (approved before implementation):** Phase A of this task fixes exactly the case this
task's `ROADMAP.md` acceptance criterion names by ID — `RH-RES-DACH-DEV-006` / D771900 / historical
`RV3-0011` — completely, across every matching stage, with full regression coverage. The other seven
cases are root-caused below and given explicit, named successor-task ownership (§6, §7) rather than
being silently left unaddressed or force-fixed with an unreviewed, broad-blast-radius change. This
task remains `in_progress`, not `done`, until those successor tasks close the remaining cases.

## 3. Complete eight-case false-confidence inventory (RESOLVER-V3-041 §6 Development ×7 + Holdout ×1)

Extracted directly from `logs/resolver-v3-039-controlled-representative-live-evidence.json`
(`development.falseConfidence.variantC.caseIds`, `holdout.falseConfidence.variantC.caseIds`) and
cross-referenced against `logs/resolver-v3-039-development-checkpoint.json`'s per-case
`developmentCaseRecords` (Holdout has no equivalent per-case record — see §5's note on that
evidence-contract gap).

| #   | Case ID                          | Raw input                                 | Frozen `fastPathUsed`/`aiCalled` | Root cause                                                                                                                                                                                                                                          | In V3-043 scope?                                                  |
| --- | -------------------------------- | ----------------------------------------- | -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| 1   | `RH-RES-DACH-DEV-006#C0`         | "Brötchen"                                | fast path, no AI                 | D771900 bogus exact alias (paren-stripped display name) short-circuits 81 legitimate candidates                                                                                                                                                     | **Yes — fixed (Phase A)**                                         |
| 2   | `RH-RES-PREPARATION-DEV-002#C0`  | "Haferflocken"                            | fast path, no AI                 | Two real exact-tied candidates (raw 348kcal vs. cooked 66kcal); early-return applies no ambiguity/delta check                                                                                                                                       | Yes — real fast-path defect, **deferred to RESOLVER-V3-049**      |
| 3   | `RH-RES-PREPARATION-DEV-004#C0`  | "Pommes frites"                           | fast path, no AI                 | A 4th, uncatalogued exact-alias record (`X654042`, 239kcal) pre-empts the 3-variant family (123/167/203kcal) the corpus curator knew about, via Stage-1 short-circuit                                                                               | Yes — real fast-path defect, **deferred to RESOLVER-V3-049**      |
| 4   | `RH-RES-PREPARATION-HOLD-002#C0` | "Pommes"                                  | not persisted (Holdout)          | Empirically reproduced against real code: 3 token-matched near-tied candidates (scores 1.0/0.905/0.493), no delta check                                                                                                                             | Yes — real fast-path defect, **deferred to RESOLVER-V3-049**      |
| 5   | `RH-RES-SIMPLE-DEV-003#C0`       | "Ein Apfel"                               | fast path, no AI                 | Only false-confident when the **benchmark adapter** skips `DeterministicFoodParser` (spurious "ein apfel" substring collision inside "…küchlein apfelringe…"); with the real production parser, correctly resolves `ambiguous`                      | **No — benchmark-fidelity artifact, deferred to RESOLVER-V3-050** |
| 6   | `RH-RES-HOUSEHOLD-DEV-005#C0`    | "Ein Becher Magerquark"                   | **no fast path**, AI called      | BLS fast path returns zero candidates (multi-token compound guard); false confidence introduced entirely by the AI-routed confidence policy (flagged despite an exact macro match, because `expectedBehavior` was `multiple_candidates_acceptable`) | **No — AI-routed, deferred to RESOLVER-V3-044**                   |
| 7   | `RH-RES-UNRELIABLE-DEV-006#C0`   | "ApfelApfelApfel!!!123"                   | **no fast path**, AI called      | BLS fast path returns zero candidates; AI resolved with an assumption instead of clarifying an unclear quantity                                                                                                                                     | **No — AI-routed, deferred to RESOLVER-V3-044**                   |
| 8   | `RH-RES-OVERLAY-DEV-010#C1`      | "Reis, ein bisschen" (consistency re-run) | **no fast path**, AI called      | BLS fast path returns zero candidates; AI repeat-run inconsistency (run0 abstained, run1 resolved wrong, run2 abstained)                                                                                                                            | **No — AI-routed/consistency, deferred to RESOLVER-V3-045**       |

`fastPathUsed`/`aiCalled` for cases 1–3 and 6–8 came directly from the frozen per-case
`developmentCaseRecords`. Case 4 (Holdout) has no equivalent frozen per-case record — Holdout's
checkpoint only persists aggregate/budget bookkeeping, and `rawTelemetry` only logs Variant B's raw
AI-provider calls, never Variant C's — so `fastPathUsed` for that specific historical run could not
be read from evidence. It is empirically reproduced instead: querying the real, current
`SequentialFoodCatalogResolver` + `BlsStaticSource` with "Pommes" (both with and without
`DeterministicFoodParser`) deterministically, offline, returns the same 3-candidate near-tie in both
raw and parsed forms — the same shape of defect as cases 2–3, and structurally identical to case 3
("Pommes" is the colloquial short form of "Pommes frites", same underlying BLS family).

## 4. Root cause — `RH-RES-DACH-DEV-006` / D771900 (fixed in this task)

**Confirmed against real, current, merged code** (not assumed from the prior noncanonical
diagnosis):

- `LogFoodFromRawInputUseCase.execute()` (`LogFoodFromRawInputUseCase.ts:121`) always calls
  `DeterministicFoodParser.parse(rawText)` before resolving — production already strips
  quantity/article prefixes ("200g", "Ein", German number words). Empirically confirmed: `parser.parse('Ein Brötchen').name === parser.parse('Brötchen').name === parser.parse('200g Brötchen').name === 'brötchen'`.
  The benchmark's `ResolverV3VariantAAdapter.runVariantACase()` (`ResolverV3VariantAAdapter.ts:98`)
  sends `normalizeText(rawInput)` straight to the resolver, without that step — a benchmark-harness
  fidelity gap (deferred, RESOLVER-V3-050), not a production defect, and **not** something this
  task adds quantity/article stripping to `SequentialFoodCatalogResolver` to "fix" (explicitly
  forbidden by this task's own restrictions).
- The real, precise root cause of the false-confidence case is a BLS alias-generation defect,
  confirmed against the real 7,090-record production BLS dataset (`bls-runtime-compact.v1.json`) —
  the same file `BlsStaticSource`/`blsGenericFoods.ts` load in the shipping app and the benchmark's
  Variant A adapter both use. `buildBlsRuntimeAliases()`/`normalizeBlsRuntimeText()`
  (`BlsCompactRuntimeAdapter.ts`) strip **all** parenthetical content when generating a record's
  normalized name/exact alias, including material identity-changing qualifiers like "(Blätterteig)"
  (puff pastry) — not just incidental state annotations. This makes `D771900` ("Brötchen
  (Blätterteig)", 425 kcal) falsely claim the bare word "Brötchen" as an exact alias: no other
  record in the real dataset reduces to that bare form. `BlsLookupEngine.findExactMatches()` returns
  immediately on any exact-alias hit (`BlsLookupEngine.ts`, Stage 1 of `search()`), pre-empting the
  81 other, more-plausible "Brötchen"-family candidates (e.g. `B511000` "Weizenbrötchen", 280 kcal,
  confirmed present in the real artifact) before they are ever scored. Empirically confirmed before
  the fix: `resolver.resolve({raw:'Brötchen', normalized:'broetchen', locale:'de', inputType:'ambiguous'})`
  returned `status: 'accepted'`, `reasonCodes: ['ACCEPTED_STRONG_MATCH']`, `best.food.sourceId: 'D771900'`,
  `best.score: 1` (exact match, not a borderline fuzzy score), with exactly one BLS candidate
  returned at all.
- **Why exact-alias removal alone is not sufficient** (per this task's explicit critical
  correction, verified by direct code trace before writing any fix): `buildBlsRuntimeTokens()`
  independently tokenizes the record's display name, so D771900's token list contains "broetchen"
  regardless of what is or isn't in its alias list. Its own `normalizeBlsRuntimeText(displayName)`-
  derived alias ("broetchen") and its qualified alias ("broetchen blaetterteig", produced by
  `splitAliasCandidates()`, which strips only the parenthesis _characters_, keeping the content)
  both contain "broetchen" as a literal substring, reachable via `findIncludesMatches()`'s substring
  check once Stage 1 is bypassed. A fix that only deletes one generated alias string leaves both the
  includes path and the token path able to reach D771900 for the same bare query.

## 5. Implemented fix (Phase A)

**Semantic rule:** D771900 must not claim the unqualified generic query `broetchen`, through any
matching stage, while remaining fully reachable for the qualified query it actually names.

**Mechanism — `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`** (`BlsCompactRuntimeAdapter.ts`), a
source-ID-scoped negative-compatibility contract, the mirror image of the existing (positive)
`COMPATIBILITY_ALIASES_BY_SOURCE_ID` mechanism already used for the `M713100`/`B314000`/`Y720143`
compatibility aliases — architecturally consistent, not a new abstraction, and scoped to exactly one
record (`D771900: ['broetchen']`).

Design: rather than mutating the generated alias/token lists at adaptation time (which would need to
separately anticipate every downstream matching stage), the adapter threads the exclusion list onto
the adapted `BlsFoodRecord` as a new optional field, `incompatibleGenericQueries`.
`BlsLookupEngine` consults it as a filter at **every** stage that can produce a match —
`findExactMatches`, `findIncludesMatches`, `findTokenMatches`, `findRankedTokenMatches` — so alias
and token generation for D771900 are completely unchanged (verified: its aliases still contain both
`"broetchen"` and `"broetchen blaetterteig"`, its tokens still contain `"broetchen"`), but the
record can never be _returned as a match result_ for the excluded query string, from any stage. A
longer, qualified query normalizes to a different string ("broetchen blaetterteig" ≠ "broetchen")
and is completely unaffected by the exclusion.

**Files changed:**

- `src/features/nutrition/infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter.ts` —
  `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID` constant, `getIncompatibleGenericQueries()` accessor,
  `incompatibleGenericQueries` populated on every adapted record.
- `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts` —
  `incompatibleGenericQueries?: readonly string[]` added to `BlsFoodRecord`; new private
  `isIncompatibleGenericQuery()` predicate; applied as a filter in `findExactMatches`,
  `findIncludesMatches`, `findTokenMatches` (now takes `normalizedInput`), `findRankedTokenMatches`
  (now takes `normalizedInput`).
- `src/features/nutrition/__tests__/ResolverV3043BroetchenFalseConfidenceRemediation.test.ts` (new)
  — 19 focused tests across four boundaries (adapter, BLS lookup, resolver, production-call) plus
  unaffected-record regression, all against real code/real artifact.
- `src/features/nutrition/benchmark/representativeHybridV1/__tests__/RepresentativeHybridV1ThreeArmBoundary.test.ts`
  — one pre-existing test updated (it asserted the _old, defective_ behavior as expected; see §5.2).
- `src/features/nutrition/benchmark/__tests__/runResolverV3VariantABenchmark.test.ts` — one
  pre-existing test updated, same reason.

### 5.1 Post-fix behavior, empirically confirmed

**Bare `Brötchen` (both via the benchmark-style raw path and the real
`DeterministicFoodParser`-parsed production path — identical result either way):**

- `decision.status`: `'ambiguous'`, `reasonCodes: ['MULTIPLE_CLOSE_MATCHES']` (previously `'accepted'`).
- `decision.candidates` never contains `D771900` at all — not merely "not best".
- Top-3 tied candidates (all real BLS records, all score 1.0 via token matching once D771900 stops
  short-circuiting Stage 1): `B8A2000` "Brötchen glutenfrei", `Y780043` "Brötchen mit Tilsiter und
  saurer Sahne überbacken", `X041910` "Brötchen mit Fleischkäse". This is a genuine, honest
  three-way ambiguity among real records that share the literal word "Brötchen" — not a forced
  acceptance. (Observation for RESOLVER-V3-049, not fixed here: these three outrank the
  single-compound-word "-brötchen" family, e.g. `B511000` "Weizenbrötchen", in the current ranking
  heuristic, because they match the query token exactly while compound words only match via a
  substring-recall fallback — a ranking-quality question, not a false-confidence/safety one, since
  the final status is honestly `ambiguous` either way.)
- This satisfies the required post-fix behavior exactly: the final resolver decision is never
  `accepted` with sourceId `D771900`; D771900 never claims exact identity with the bare query; the
  resolver returns an honest ambiguous decision rather than a forced acceptance.

**Qualified `Brötchen Blätterteig` / `Brötchen (Blätterteig)`:** both still resolve
`status: 'accepted'`, `reasonCodes: ['ACCEPTED_STRONG_MATCH']`, `best.food.sourceId: 'D771900'`,
`best.score: 1` — unchanged, D771900 remains fully discoverable and resolvable as the intended food.

**Production-call boundary (`LogFoodFromRawInputUseCase`, real resolver + real parser):** all three
of `'Brötchen'`, `'Ein Brötchen'`, `'200g Brötchen'` parse to the identical food name (`'brötchen'`)
via the real, unduplicated `DeterministicFoodParser`, and none of the three ever produces a
D771900-sourced result (verified directly on `entry.foodCatalogRef?.sourceId`, or — for the
count-without-explicit-grams "Ein Brötchen" case, which legitimately requires a portion-hint edit
before macro computation, unrelated to this defect — on the resolved food identity carried in that
edit prompt).

**Historical RV3-0011** (the original, retired 14-case smoke corpus's own definition of this
defect, `resolverV3VariantASmokeCorpus.ts`, independent of the `representativeHybridV1` corpus):
previously `report.metrics.falseConfidentCases` contained `'RV3-0011'`; now it is empty for this
case (`falseConfident: false`, `isCriticalFailure: false`, `resolverStatus: 'ambiguous'`). This
corpus's `expectedBehavior` is `direct_resolution` to `B511000` specifically — the current fix
achieves an honest `ambiguous` rather than that single "correct" answer, which is deliberate: this
task's binding instruction is "do not force acceptance solely to make a benchmark case green," and
picking a specific winner among the three tied real candidates is exactly the ranking-quality
question deferred to RESOLVER-V3-049.

### 5.2 Pre-existing tests updated (not regressions — their premise was the defect itself)

Two pre-existing tests asserted the _old, defective_ behavior as their expected outcome — they were
themselves regression fixtures proving the historical defect reproduced through the benchmark
harness, not tests of desired production behavior:

- `RepresentativeHybridV1ThreeArmBoundary.test.ts`: `'a false-confident Variant A fast-path
acceptance is inherited and visible on Variant C (DACH RV3-0011 regression)'` asserted
  `result.variantA.falseConfident === true`. Updated (renamed, with full historical-context comment
  preserved) to assert the corrected reality: `status: 'ambiguous'`, `falseConfident: false` on both
  arms; Variant C's fast path is no longer used at all for this case, since it is only eligible when
  Variant A's decision is `'accepted'` (it now correctly falls through to the AI-interpretation
  branch instead — itself now `falseConfident: false` too, since no `variantCAiInterpreter` is
  injected in this particular test and the fallback outcome is `'unavailable'`, not a false
  acceptance).
- `runResolverV3VariantABenchmark.test.ts`: `'flags the committed Brötchen case as a critical
(false-confident) failure'` asserted `report.metrics.falseConfidentCases` contained `'RV3-0011'`.
  Updated (renamed, historical-context comment added) to assert the corrected reality (§5.1).

Both updates were verified by first observing the actual, current values via a temporary probe
(deleted immediately after use) before writing the new assertions — no expected value was guessed
or reverse-fit to "make the test pass."

## 6. Deferred: BLS generic fast-path ambiguity policy (RESOLVER-V3-049)

Cases 2–4 (§3) share a real defect class distinct from D771900's alias-generation problem: the BLS
fast-path early return (`SequentialFoodCatalogResolver.ts`, the `source.type === 'bls'` branch)
applies no score-delta/ambiguity check before accepting, and/or `BlsLookupEngine.search()`'s Stage-1
exact-match short-circuit can hide a real, materially different alternative record before it is
ever scored (case 3's `X654042` pre-empting the `K130xxx` family entirely). This was **not** fixed
in this task because a safe, narrow fix could not be established within Phase A's scope:

- Reusing the existing, already-reviewed `ResolverDecisionPolicy.ts` ambiguity delta
  (`DELTA_THRESHOLD = 0.08`) does **not** catch either case: Haferflocken's real gap is 0.107
  (1.0 vs. 0.893), Pommes's is 0.095 (1.0 vs. 0.905) — both exceed the existing, policy-consistent
  threshold, so simply reusing it would not change either outcome.
- Inventing a new, untested delta value tuned specifically to flip these cases would be exactly the
  kind of reverse-engineered, benchmark-case-specific threshold this task's own instructions forbid
  ("do not force acceptance solely to make a benchmark case green" applies symmetrically to forcing
  a rejection/ambiguity to do the same).
- Fixing case 3 (Pommes frites) specifically requires restructuring `BlsLookupEngine.search()`'s
  stage short-circuit behavior itself (Stage 1 must not prevent Stage 3's includes-matching from
  ever being computed when a single exact match exists) — a broader, unreviewed change whose impact
  this task did not have budget to measure against the complete deterministic BLS regression corpus.

RESOLVER-V3-049 ("BLS Generic Fast-Path Ambiguity Policy Remediation") is the correctly-scoped
successor task for exactly these three cases — see `ROADMAP.md` for its full definition. It must
derive a generalized, policy-based rule (not a per-case-tuned threshold), evaluate exact/includes/
token/early-return behavior together, and measure blast radius against the full deterministic BLS
regression corpus before any threshold or short-circuit-behavior change is accepted.

## 7. Deferred: benchmark production-call-path fidelity (RESOLVER-V3-050) and AI-routed cases (RESOLVER-V3-044/045)

- Case 5 (`SIMPLE-DEV-003`, "Ein Apfel") is a benchmark-harness fidelity artifact, not a production
  defect (§4, §3) — owned by RESOLVER-V3-050, which must make the benchmark's fast-path execution
  reproduce the real `DeterministicFoodParser → resolver` call order, without touching production
  code and without rewriting historical V3-038/V3-039 evidence.
- Cases 6–7 (`HOUSEHOLD-DEV-005`, `UNRELIABLE-DEV-006`) are purely AI-routed confidence-policy
  defects (the BLS fast path returns zero candidates for both, confirmed empirically) — owned by
  RESOLVER-V3-044 ("Clarification, Abstention, and Confidence-Policy Remediation").
- Case 8 (`OVERLAY-DEV-010#C1`) is an AI repeat-consistency defect — owned by RESOLVER-V3-045
  ("Haiku Interpretation Determinism and Repeat-Consistency Remediation").

This task does not implement any part of RESOLVER-V3-044, RESOLVER-V3-045, RESOLVER-V3-049, or
RESOLVER-V3-050 — see `ROADMAP.md` for their full definitions and dependency ordering.

## 8. Constraints honored

- No `ANTHROPIC_API_KEY` value was ever printed, inspected, copied, requested, or persisted (boolean
  presence check only, confirmed absent).
- Zero Anthropic/AI provider calls; zero benchmark cost; Development and Holdout were not re-run.
- No frozen `RESOLVER-V3-039` evidence file was modified (this task's diff touches no `logs/`
  path at all).
- No BLS source workbook and no generated BLS artifact (`bls-runtime-compact.v1.json`) was modified
  — the fix is entirely in adapter/lookup-engine matching logic, not the underlying data.
- No historical `RESOLVER-V3-024`/`038`/`039`/`041`/`042` report was rewritten.
- No production quantity/article stripping was added to `SequentialFoodCatalogResolver` (production
  already had this via `DeterministicFoodParser`; the benchmark-harness gap is deferred, §7).
- No RESOLVER-V3-044/045/046/047/048 work was started; no production wiring; RESOLVER-V3-010 stays
  `blocked`.
- Full regression run before commit: `npm run typecheck` clean; targeted BLS/resolver suite
  (238 suites) green; full repository suite `npm run test` — 238/238 suites, 2335/2335 tests green,
  zero regressions beyond the two intentionally-updated stale-defect-assertion tests (§5.2).
