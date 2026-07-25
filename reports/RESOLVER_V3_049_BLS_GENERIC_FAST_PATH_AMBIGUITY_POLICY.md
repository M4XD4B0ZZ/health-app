# RESOLVER-V3-049: BLS Generic Fast-Path Ambiguity Policy

Status: implemented, verified, zero provider calls, zero benchmark cost.

Canonical starting commit: `740af0a6a36ba17d43fc449b1b9d61e760621dab` (PR #171, RESOLVER-V3-043
Phase A merge commit). Confirmed identical to the live `origin/chore/clean-arch-structure` tip at
task start — no later commits to inspect.

## 0. Dependency-cycle correction

`ROADMAP.md` previously had RESOLVER-V3-049 and RESOLVER-V3-050 each declare `Depends on:
RESOLVER-V3-043` — a governance defect, not an intentional blocker, since RESOLVER-V3-043 itself
cannot reach `done` until RESOLVER-V3-049/050 (and RESOLVER-V3-044/045) close their share of its
eight-case false-confidence inventory. Both entries are corrected to `Depends on: RESOLVER-V3-041`
with an added "Prerequisite implementation baseline: RESOLVER-V3-043 Phase A, merge commit
740af0a6a36ba17d43fc449b1b9d61e760621dab" note. RESOLVER-V3-043's entry gained an explicit
umbrella-completion statement naming all four successor tasks (044/045/049/050) whose closure is
required before V3-043 itself may close. RESOLVER-V3-043 is **not** marked done by this task.

## 1. Original defect

RESOLVER-V3-043 Phase A's diagnosis (`reports/RESOLVER_V3_043_UNSAFE_FAST_PATH_FALSE_CONFIDENCE_DIAGNOSIS.md`
§6) found two independent, general defects in the BLS generic fast-path, distinct from the D771900
alias-generation defect Phase A fixed:

1. **Search-stage visibility**: `BlsLookupEngine.search()`'s Stage-1 exact-match short-circuit can
   return a single record even when other, real, materially plausible same-family preparation-state
   siblings exist in the BLS corpus and are never scored at all.
2. **Resolver acceptance**: the BLS generic fast-path in `SequentialFoodCatalogResolver.ts` applies
   only a bare `best.score >= 0.75/0.85` gate before accepting — no check for whether the winning
   margin reflects genuine confidence versus a semantic _ranking preference_ (raw/plain candidates
   are deliberately boosted over prepared ones by `ScoreCalculator`'s existing semantic-adjustment
   system) that can clear even the existing `DELTA_THRESHOLD = 0.08` ambiguity check while the
   underlying candidates are, in fact, materially different foods.

Both defects were explicitly deferred from RESOLVER-V3-043 Phase A because (a) reusing the
existing `DELTA_THRESHOLD` doesn't catch either target gap (0.107, 0.095, both exceed 0.08), (b)
inventing a new delta tuned to these gaps would be a reverse-engineered, benchmark-case-specific
threshold, and (c) fixing the Pommes-frites case specifically requires changing
`BlsLookupEngine.search()`'s Stage-1 short-circuit behavior — a broader change whose blast radius
had to be measured before acceptance.

## 2. Three-case evidence (verified against real, current production code and data)

| Case ID                       | Raw input       | Root cause                                                                                                                          | Frozen candidates (sourceId / kcal)                                                                                                                                                                     |
| ----------------------------- | --------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RH-RES-PREPARATION-DEV-002`  | "Haferflocken"  | Two real exact-tied BLS records for the bare query; no ambiguity check at accept time                                               | C133000 "Hafer Flocken" (raw) 348 kcal; C133032 "Hafer Flocken, gekocht" (cooked) 66 kcal — 5.3x                                                                                                        |
| `RH-RES-PREPARATION-DEV-004`  | "Pommes frites" | A 4th, uncatalogued exact-alias record pre-empted the known 3-variant family via Stage-1 short-circuit before they were ever scored | X654042 "Pommes frites" 239 kcal (exact, sole Stage-1 match before this fix); K130200 "…tiefgefroren" 123 kcal; K130262 "…tiefgefroren, gebacken" 167 kcal; K130492 "…tiefgefroren, frittiert" 203 kcal |
| `RH-RES-PREPARATION-HOLD-002` | "Pommes"        | 3 token-matched near-tied candidates; no ambiguity check at accept time                                                             | K130200 123 kcal; K130262 167 kcal; K130492 203 kcal (same 3 records as above, reached via Stage-4 plain token matching for the shorter query)                                                          |

All source IDs, aliases, macros, and match stages above were re-extracted directly from the real,
current `bls-runtime-compact.v1.json` runtime artifact and the real `BlsLookupEngine`/`BlsStaticSource`
call path (offline, zero provider calls) — not copied from a prior report.

## 3. Existing architecture (relevant pieces)

- `BlsLookupEngine.search()`: 5-stage cascade (exact → single-long-token override → multi-token
  compound guard → plain token match → fallback includes). Stage 1 short-circuits on any exact
  alias hit. Stage 2 (`findRankedTokenMatches`) is RESOLVER-V2-009's own deliberate, already-
  reviewed ranked-demotion system (recall + head-match bonus − processed-qualifier penalty),
  purpose-built to pick a confident winner for single-long-token queries.
- `ScoreCalculator`: blends match score, data-quality, kcal-consistency, source-trust, and a
  **semantic ranking adjustment** that already classifies candidates as
  plain*raw/simple_generic/prepared_simple/prepared_complex/composite_dish and boosts/penalizes
  them for generic-short queries — this is \_why* Haferflocken's raw candidate outscores the cooked
  one by 0.107 even though the underlying BLS match is a perfect tie.
- `ResolverDecisionPolicy.buildResolverDecision()`: `ACCEPT_THRESHOLD=0.75`,
  `AMBIGUOUS_THRESHOLD=0.7`, `DELTA_THRESHOLD=0.08` — a generic, source-agnostic score-delta
  ambiguity check used everywhere, including inside the BLS fast-path's own `buildDecision()` call.
- `SpeckAmbiguity.ts` / RESOLVER-V2-010: an explicit, already-approved, narrowly-scoped exception —
  a pre-resolver intercept for the bare word "Speck" specifically, because a generic
  `ResolverDecision.status`/score-gap framework was proven (in that task's own decision plan) to
  misfire on "Bauchspeck"/"Schinkenspeck"/"Frühstücksspeck", which must stay deterministic.
- `LogFoodFromRawInputUseCase.resolveCanonicalFood()`: treats a resolver decision as confidently
  resolved whenever `decision.best.score >= 0.7` — **it does not check `decision.status` at all**.
  This means an existing `'ambiguous'` decision with a populated `best` (which
  `ResolverDecisionPolicy` always produces whenever any candidate exists, regardless of status) is
  _still_ silently persisted today, for any source, not just BLS. This pre-existing gap is why
  simply reaching `'ambiguous'` is not sufficient — the fix must ensure `best` itself is absent for
  a genuinely unresolved case.

## 4. Policy alternatives considered

1. **Reuse `DELTA_THRESHOLD=0.08` as-is.** Rejected: does not change either target outcome (both
   gaps, 0.107 and 0.095, already exceed it).
2. **Invent a new delta value (e.g. 0.11/0.12) tuned to flip the observed gaps.** Rejected per this
   task's own explicit instructions — a reverse-engineered, benchmark-case-specific threshold.
3. **Remove Stage-1's short-circuit entirely for all queries (always run Stage 3 after Stage 1).**
   Rejected: unreviewed, unbounded blast radius across the full ~7,090-record corpus; would also
   resurface exactly the kind of "early exact match hides plausible alternatives" problem for
   composite dishes that merely mention a word (e.g. "Schaschlik mit Pommes frites"), which Stage 1
   is correctly protecting against in the general case.
4. **A purely categorical preparation-state-qualifier check with no materiality gate.** Attempted
   first; caused real regressions (see §5) against "Eier" (raw vs. boiled egg, ~1.5% kcal
   difference — nutritionally negligible) and the RESOLVER-V2-010 "Schinkenspeck" cluster (~31%
   spread, ordinary same-cut cooking-method variance). Refined into the selected policy (§6) with a
   materiality floor.
5. **Re-litigate Stage 2's ranked-token-override output with the same categorical check.** Rejected
   after discovering it collides with RESOLVER-V2-010's explicitly-approved, already-shipped
   deterministic behavior for "Bauchspeck"/"Schinkenspeck"/"Rückenspeck" (all three reach the
   resolver via that exact stage). Stage 2 is a separate, already-reviewed winner-picking
   mechanism (RESOLVER-V2-009) that this task does not re-litigate — see §6.

## 5. Rejected threshold-tuning approaches (explicit)

No score-delta threshold of any value was adopted for the accept/ambiguous decision. The one
numeric threshold in the final policy — `MATERIALITY_KCAL_RATIO = 1.4` — is not a score-delta and
was derived from real BLS data unrelated to the three target cases (see §6 for its exact
derivation and sensitivity range), not from the target cases' own 0.107/0.095 score gaps.

## 6. Selected general policy

Two complementary, source-grounded mechanisms, both scoped to the BLS generic fast-path:

**(a) Search-stage visibility — `BlsLookupEngine.findFamilyExtensionMatches()`.** When Stage 1
resolves to exactly one exact-alias record, look for other BLS records whose display name is that
same query, extended with further word(s) that are themselves recognized preparation-state
qualifiers or connector words (`isPureQualifierSuffix`) — never an arbitrary substring, never a
hyphen-fused compound word (checked via `looseNormalize`, which preserves hyphens so
"Quark-Frucht-Plunder" is never mistaken for "Quark" + qualifier), never a "mit"-clause ingredient
addition (the same convention `splitAliasCandidates()` already uses when building a record's own
aliases). The whole extension set is surfaced only if it is _collectively_ materially divergent in
kcal from the exact match (§ below) — an all-or-nothing decision, not a per-candidate filter.

**(b) Resolver acceptance — `hasBlsGenericPreparationStateConflict()`.** Before the BLS fast-path
accepts its top candidate, check whether the competing BLS candidates disagree on preparation
state (reusing the exact same, already-reviewed `PROCESSED_QUALIFIER_TOKENS` lexicon that already
governs Stage-2 ranked-token scoring, extended only with explicit frozen-state markers
"tiefgefroren"/"gefroren" per this task's own "raw/cooked/fried/frozen" policy concept) _and_ that
disagreement is nutritionally material. A query that already contains a qualifier token is exempt
(it already disambiguated itself). **Scoping exclusion**: the check does not apply when the
candidates arrived via `BlsLookupEngine`'s single-long-token ranked-token-override branch (query is
one token, length > 6, and no candidate is an exact match) — that branch is RESOLVER-V2-009's own,
separate, already-reviewed winner-picking system, relied upon by RESOLVER-V2-010's explicitly
approved deterministic Speck sub-terms. When conflict is detected, the decision is rebuilt with
`status: 'ambiguous'`, `reasonCodes: ['BLS_GENERIC_PREPARATION_STATE_AMBIGUITY']`, and **`best`/
`secondBest` explicitly cleared** — not merely re-scored — so no downstream caller (in particular
`LogFoodFromRawInputUseCase`'s own `score >= 0.7` gate, which does not check `status`) can still
treat the decision as confidently resolved.

**Materiality floor — `isMaterialKcalSpread()` / `MATERIALITY_KCAL_RATIO = 1.4`.** A relative
kcal/100g spread (max/min across the candidate set) below this ratio is treated as ordinary
same-preparation-family variance, not a genuine identity conflict. Derived independently of the
three target cases from real BLS data found during this task's own blast-radius audit:

- **Floor side** (must exceed): raw vs. boiled egg, 137/135 kcal, ratio 1.01 (boiling a shell egg
  doesn't meaningfully change its caloric content); the real "Schinkenspeck" BLS cluster
  (127/156/167 kcal across roh/gebraten/geschmort sub-records of the _same_, RESOLVER-V2-010-approved
  clarification choice), ratio 1.31 — ordinary cooking-method variance within one specific cut.
- **Ceiling side** (must not exceed): the smallest real target-case gap, the Pommes/Holdout frozen-
  fries family (123/167/203 kcal), ratio 1.65.
- Selected value 1.4 sits inside the resulting safe window (1.31, 1.65]; any value in that window
  produces the identical accept/ambiguous classification for every case examined in this task
  (Haferflocken 5.27x; Pommes-frites family up to 1.9x; Pommes/Holdout 1.65x; egg 1.01x;
  Schinkenspeck 1.31x; bare Speck top-3, 1.13x). The exact value is therefore not
  outcome-determinative for any diagnosed case.

## 7. Before/after blast-radius methodology

A reproducible, checked-in Jest test
(`src/__tests__/_blastRadiusAudit.test.ts` during development; population-generation logic is
preserved in this report and can be re-created from the real `BLS_GENERIC_FOODS` corpus and the
existing `RESOLVER_V3_VARIANT_A_SMOKE_CORPUS` regression corpus) constructs a deterministic,
zero-provider-call population from:

- every unique BLS record's whole `normalizedName` and `displayName`;
- every unique deterministic alias across all ~7,090 real BLS records;
- every unique single token (length > 2) across all record token lists;
- the existing 14-case `RESOLVER_V3_VARIANT_A_SMOKE_CORPUS` regression corpus;
- an explicit set of 25 target-case / qualified-variant / positive-control queries.

Total unique population: **14,690 queries**. Each query is resolved through a real
`SequentialFoodCatalogResolver` wired to a real `BlsStaticSource` (OFF/USDA stubbed to return no
candidates; no AI source configured — zero provider calls, zero benchmark cost throughout), with
`locale: 'de', inputType: 'generic'`. The sweep was run once on the pristine RESOLVER-V3-043 Phase
A baseline (before this task's code changes) and once after this task's complete, final
implementation, and the two result sets were diffed per-query on `status` and `best.sourceId`.

## 8. Exact blast-radius results

| Metric                  | Before |  After |       Δ |
| ----------------------- | -----: | -----: | ------: |
| Total queries evaluated | 14,690 | 14,690 |       0 |
| `accepted`              | 10,493 | 10,420 | **-73** |
| `ambiguous`             |  3,076 |  3,149 | **+73** |
| `rejected`              |  1,121 |  1,121 |       0 |

- **Changed accepted → ambiguous: exactly 73** (0.50% of the population). Zero of these changed
  to/from `rejected`. Zero queries changed from `ambiguous`/`rejected` → `accepted`. Zero queries
  that remained `accepted` had their winner `sourceId` change (no cross-candidate winner swaps at
  all — the policy only ever downgrades a decision, never re-ranks one).
- **346 additional queries** that were already `ambiguous` before this task (via the pre-existing,
  generic `MULTIPLE_CLOSE_MATCHES` score-delta path) are now reclassified under the new, more
  specific `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` reason code, with `best`/`secondBest` now
  explicitly cleared instead of left populated. This closes the same "status says ambiguous, but a
  populated `best` still leaks through `LogFoodFromRawInputUseCase`'s `score >= 0.7` gate" defect
  class this task fixes for the BLS fast-path specifically, for 346 additional queries beyond the
  three explicitly owned cases — status does not change for these (still `ambiguous`), only the
  reason code and the removal of the residual silent-best leak.
- Candidate-count distribution shifted only slightly: 10 queries moved from a single-candidate
  result to 2–5+ candidates (the search-stage family-extension fix firing for those specific single-
  exact-match queries); `NO_CANDIDATES` count (969) is completely unchanged.
- The 73 accepted→ambiguous queries are overwhelmingly the same defect class as the three owned
  cases: bare grain/cereal-product names with real raw-vs-processed BLS record pairs (Hafer,
  Gerste, Mais, Reis, Quinoa, Weizen, Roggen, Dinkel, Buchweizen, Hirse, Grünkern, Bulgur,
  Mehrkornschrot — ~45 of the 73), plus a handful of other genuine raw/dried/cooked pairs (Banane
  64→290 kcal, Dattel 140→356 kcal, Eigelb/Eiklar ~2x via drying, Karotten/Möhren 6-way
  puree/gekocht/gedünstet/gebraten family, Birnen roh/gekocht variants). A small number
  (`obst`, `chips`, `donuts`, `backen`, `the`, `fuerst`, `pina`) are single-token artifacts of the
  population's own token-extraction method (fragments of compound/foreign names like "Sex on **the**
  Beach", "**Fürst**-Pückler-Eis", "**Pina** Colada") rather than realistic standalone user queries;
  they are disclosed here for completeness but carry negligible real-world impact. Full list of all
  73 queries with their previous winner: `reports/resolver-v3-049-bls-generic-fast-path-ambiguity-policy.json`.
- Frozen `logs/resolver-v3-039-*` evidence: confirmed byte-identical (`git diff --stat` clean)
  before and after this task's changes.

## 9. Target-case outcomes (post-fix)

| Case                 | Status      | `best`      | Candidates                            | Reason code                               |
| -------------------- | ----------- | ----------- | ------------------------------------- | ----------------------------------------- |
| Haferflocken (bare)  | `ambiguous` | `undefined` | C133000 (348 kcal), C133032 (66 kcal) | `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` |
| Pommes frites (bare) | `ambiguous` | `undefined` | X654042, K130200, K130262, K130492    | `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` |
| Pommes (bare)        | `ambiguous` | `undefined` | K130200, K130262, K130492             | `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` |

All three qualified variants remain fully resolvable: "Hafer Flocken, gekocht" → C133032 (66 kcal,
`accepted`); "Pommes frites tiefgefroren, gebacken" → K130262 (167 kcal, `accepted`); "Pommes
frites tiefgefroren, frittiert" → K130492 (203 kcal, `accepted`).

At the real production boundary (`LogFoodFromRawInputUseCase`, real `DeterministicFoodParser`):
all three bare inputs now throw `RESOLVER_FAILED_OR_NO_MACROS` (an honest non-resolution — no
macros silently attributed) instead of silently persisting a false-confident entry; the qualified
variant ("Hafer Flocken, gekocht") persists real, correct macros end-to-end.

## 10. Positive controls (required to remain correct — all verified)

| Control                                                                              | Result                                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D771900 / bare "Brötchen" (RESOLVER-V3-043 Phase A)                                  | Still never wins; `D771900` absent from candidates                                                                                                                                                                                           |
| "Brötchen Blätterteig" / "Brötchen (Blätterteig)" (qualified)                        | Still `accepted`, D771900, 425 kcal                                                                                                                                                                                                          |
| "Quark"                                                                              | Still `accepted`, M713100, 66 kcal                                                                                                                                                                                                           |
| "Magerquark"                                                                         | Still `accepted`, M713100, 66 kcal                                                                                                                                                                                                           |
| "Rührei"                                                                             | Still `accepted`, Y720143, 203 kcal (initially regressed by the raw family-extension fix pulling in "Rührei gebraten in Butter"; fixed by the `isPureQualifierSuffix` "mit"/unrecognized-ingredient exclusion)                               |
| "Eier"                                                                               | Still `accepted`, Y720100, 137 kcal (initially regressed by the family-extension fix pulling in "Eier gekocht", 135 kcal, ~1.5% spread; fixed by the materiality floor)                                                                      |
| "Speck" (bare)                                                                       | Resolver-level winner (W412000) unaffected; RESOLVER-V2-010's dedicated pre-resolver clarification remains the sole disambiguation mechanism in production                                                                                   |
| "Bauchspeck" / "Schinkenspeck" / "Rückenspeck" (RESOLVER-V2-010 qualified sub-terms) | All three remain deterministic (initially regressed — Bauchspeck/Rückenspeck by re-litigating Stage 2's ranked-token-override output, Schinkenspeck by the materiality floor sitting below its 1.31x same-cut spread; both fixed, see §4/§6) |
| Existing BLS/resolver regression suite                                               | 246 suites, 2,377 tests green (see §11 note on 2 intentionally-updated assertions)                                                                                                                                                           |

Two pre-existing test assertions were updated because they encoded the pre-fix false-confidence
behavior as "expected" (the same category of update RESOLVER-V3-043 Phase A made for its own two
stale fixtures): `BlsPlainGenericReachability.test.ts`'s "Haferflocken is selected end-to-end..."
test (previously asserted `C133000` as a confident winner — exactly `RH-RES-PREPARATION-DEV-002`),
and `ResolverV3043BroetchenFalseConfidenceRemediation.test.ts`'s production-boundary test (updated
to accept the new, more honest `RESOLVER_FAILED_OR_NO_MACROS` outcome for the bare query, with an
explanatory comment — D771900 still never wins). Both updates are documented in-line with historical
context, matching the existing convention.

## 11. Residual risks

- The materiality floor (1.4x) and the Stage-2-ranked-token-override exclusion are both,
  necessarily, judgment calls about where "genuine identity ambiguity" ends and "ordinary same-food
  variance" begins. The safe window for the materiality ratio (1.31, 1.65] is real but not wide;
  future BLS data additions could in principle produce a new case that falls inside today's window
  on the wrong side. Re-running this task's blast-radius sweep after any future BLS artifact update
  is recommended.
- 7 of the 73 accepted→ambiguous population queries are single-token artifacts of the population's
  own construction method (not realistic standalone user queries) rather than genuine new coverage;
  they inflate the raw "73" count slightly but do not represent real user-facing behavior change.
- The Stage-2 exclusion is a structural/architectural judgment (this task's new check applies to
  Stage 1 exact ties and Stage 4 plain token matches, not Stage 2's ranked-token override) rather
  than a per-food exclusion — but it does mean any _future_ genuine false-confidence defect that
  happens to route through Stage 2 will not be caught by this policy and would need its own
  successor task, the same way RESOLVER-V2-010's Speck clarification needed its own dedicated,
  narrowly-scoped mechanism instead of a generic framework.
- The blast-radius audit's population, while broad (14,690 queries covering every unique BLS
  display name, alias, and single token, plus the existing smoke corpus), is still a synthetic,
  offline sweep — it does not measure real user query distributions and cannot fully replace a
  live re-evaluation (RESOLVER-V3-048's eventual job).
- Per-candidate macro values for all 73 changed queries are not pre-computed in the JSON companion
  (only the previous winner's `sourceId` is recorded, for size/time reasons); they can be re-derived
  on demand via `searchBlsGenericFoods(query)` against the real, current BLS artifact.

## 12. Implication for RESOLVER-V3-043 and RESOLVER-V3-048

RESOLVER-V3-043's eight-case false-confidence inventory: 1 case (D771900) fixed by Phase A; 3 cases
(this task) now fixed; 3 AI-routed cases remain owned by RESOLVER-V3-044/045; 1 benchmark-fidelity
artifact remains owned by RESOLVER-V3-050. **RESOLVER-V3-043 stays `in_progress`**, per its own
umbrella-completion statement, until RESOLVER-V3-044, RESOLVER-V3-045, and RESOLVER-V3-050 also
close. RESOLVER-V3-050 is unaffected by this task (no benchmark-harness code touched).
RESOLVER-V3-048 (the first task in this chain authorized to make live provider calls) still
requires both RESOLVER-V3-049 (now done) and RESOLVER-V3-050 (still `todo`) before it may begin.
RESOLVER-V3-010 remains `blocked`.
