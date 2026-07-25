# RESOLVER-V3-051 — Generic BLS Substring-Collision Safety Remediation

**Status:** done
**Canonical starting commit:** `fd6efb581046b529d5b517ced0ac981b59696379` (PR #173 / RESOLVER-V3-050
merge commit, `origin/chore/clean-arch-structure` tip at task start — confirmed identical, no later
commits to inspect).
**Provider-call policy:** zero provider calls throughout. `ANTHROPIC_API_KEY` never inspected,
printed, copied, set, or used — only its boolean presence was checked (absent, as required).

---

## 1. Defect discovery through RESOLVER-V3-050

RESOLVER-V3-050 fixed `ResolverV3VariantAAdapter.runVariantACase()` to reproduce the real
production call order — `DeterministicFoodParser.parse(rawInput)` first, then
`normalizeText(parsed.name)` sent to the resolver — instead of normalizing the raw benchmark input
directly. That fix's own offline impact analysis surfaced a **residual risk**, not fixed by that
task (out of its declared scope): the frozen representative-corpus case
`RH-RES-VAGUE-DEV-004` ("Ein Snack", `expectedBehavior: abstention_expected`) now reproduces a
real, pre-existing production defect — `DeterministicFoodParser` parses "Ein Snack" to the food
name `"snack"`, which the BLS fast path then substring/token-matches against the single real BLS
record `X5A1030` ("Kichererbsensnack gebacken", 231 kcal) and confidently accepts, in direct
violation of the case's `criticalFailureConditions: ["Reports a specific numeric estimate for the
bare word \"Snack\"."]`. This was not introduced by RESOLVER-V3-050 — production already parsed
"Ein Snack" to "snack" before that task; the _old_, unfaithful benchmark boundary simply never
exercised the call path that exposed it, so the defect was invisible to the benchmark until then.

## 2. Production reproduction

Reproduced and verified at every required boundary, against the real, unmodified, currently-merged
code (offline, zero provider calls), before any fix:

| Boundary                                                                                   | Verified behavior                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `DeterministicFoodParser`                                                                  | `"Ein Snack"` → `{ name: "snack", quantityCount: 1, unit: "count" }`                                                                                                                                                                                                                                                                       |
| `BlsLookupEngine.search("snack")`                                                          | Reaches Stage 4 (`findTokenMatches`); `calculateTokenScore`'s partial-match branch (`recordToken.includes(inputToken)`) awards `0.8` for `"kichererbsensnack".includes("snack")`, the only signal above the `0.5` Stage-4 threshold                                                                                                        |
| `BlsStaticSource` / `searchBlsGenericFoods`                                                | Returns `X5A1030` (`matchKind: 'token'`, `score: 0.8`, `match.exact: false`) as sole candidate; provenance fully traceable via `[DEBUG] BLS TOKEN_MATCH`                                                                                                                                                                                   |
| `SequentialFoodCatalogResolver` (bare `"Snack"`, `inputType: 'generic'`)                   | `ScoreCalculator` combines `metadata.similarity=0.8` with `containsBonus=0.1` (from `normalizedName.includes(query)`) into `finalScore ≈ 0.827` after the `prepared_simple` semantic penalty (`"gebacken"` matches `SIMPLE_PREP_INDICATORS`) — clears the `0.75` generic-accept threshold with no competing candidate to trigger ambiguity |
| `LogFoodFromRawInputUseCase` (real production path, `"Ein Snack"`)                         | Persisted a confidently-resolved food entry referencing `X5A1030` / 231 kcal                                                                                                                                                                                                                                                               |
| Variant A / Variant C fast-path fixture (`RH-RES-VAGUE-DEV-004` under the V3-050 boundary) | `variantA.status === 'accepted'`, `variantC.fastPathUsed === true`                                                                                                                                                                                                                                                                         |

Exact fields verified: `sourceId` (`X5A1030`), display name (`"Kichererbsensnack gebacken"`),
aliases (deterministic split/normalized forms of the display name, no compatibility-alias override),
normalized name (`"kichererbsensnack gebacken"`), tokens (`["kichererbsensnack", "gebacken"]`,
compound-fused — no separate `"snack"` token exists), lookup stage (Stage 4, `findTokenMatches`),
match type (`token`, partial credit, `exact: false`), candidate population (exactly 1 candidate for
bare `"snack"`), score/breakdown (`matchScore≈0.8`, `dataQualityScore=1.0`,
`kcalConsistencyScore≈0.95–1.0`, `sourceTrustScore=0.99`, semantic multiplier `0.92`,
`finalScore≈0.827`), resolver status (`accepted`), reason codes (`ACCEPTED_STRONG_MATCH`),
selected nutrients (231 kcal / 100 g), production use-case outcome (persisted), and both benchmark
fixture outcomes. None of these values were assumed — every one was independently verified against
the real merged code before any change.

## 3. Lookup and acceptance root cause

Two independent, stage-agnostic mechanisms can produce this defect, both driven by the same
underlying gap — no distinction between _discoverability_ (a query textually related to a
candidate) and _identity_ (a query naming that candidate specifically):

1. **`BlsLookupEngine.calculateTokenScore` (Stage 4, `findTokenMatches`)** — awards `0.8` partial
   credit symmetrically for either substring direction
   (`inputToken.includes(recordToken) || recordToken.includes(inputToken)`), with no distinction
   between "query is a compound whose component matches a shorter/generic record" (safe — e.g.
   `"Bauchspeck"` naming its own record) and "query is a bare generic word fused inside a more
   specific German compound noun" (unsafe — `"snack"` fused inside `"kichererbsensnack"`).
2. **`BlsLookupEngine.findIncludesMatches` (Stage 2/3/5)** — a structurally identical risk one
   stage later, via alias-substring containment (`alias.includes(normalizedInput)`), confirmed by
   direct calculation: had Stage 4 alone been patched, `"snack"` would have fallen through to
   Stage 5's `findIncludesMatches`, matched the same record via its alias list, and still scored
   `≈0.786` — still above the `0.75` accept threshold. **A single-stage fix would not have closed
   the defect.**

A third, independent gap was found and fixed during Phase 5 verification: the resolver's dedicated
BLS generic-truth early-return gate (`SequentialFoodCatalogResolver.ts`) uses a **higher** score
threshold (`0.85` for `inputType: 'ambiguous'`) than the generic multi-source fallback decision it
falls through to when that gate's condition isn't met (`0.75`, `ResolverDecisionPolicy`'s
`ACCEPT_THRESHOLD`). `detectInputType("Ein Snack")` classifies as `'ambiguous'` (no match in
`genericFoods`/`knownBrands`), so the specialized gate's `0.85` threshold is _not_ met by the
`≈0.827` score — meaning a fix applied only inside that gate is silently bypassable by any query
landing in this `[0.75, 0.85)` band for `'ambiguous'`-classified inputs. Confirmed empirically via
the benchmark fast-path adapter (`ResolverV3VariantAAdapter`, which uses `detectInputType` exactly
this way): the fix had to be applied at **both** sites.

## 4. General substring/compound taxonomy

Built and applied uniformly across the audit population:

- **`exact_identity`** — the query equals (or whitespace-collapses to) a real alias of the record.
  Always safe; the established, reviewed mechanism.
- **`whole_token`** — every query token is a complete, space-delimited token of the candidate's own
  name (e.g. `"pommes frites"` against `"pommes frites tiefgefroren"`, or `"bauchspeck"` against
  `"bauchspeck roh"`). Safe — the query names a real component of the candidate, not merely a
  textual fragment.
- **`sub_token_substring_record_specific`** _(the unsafe direction)_ — the query is a proper
  substring of one of the candidate's own (possibly compound-fused) tokens, and is not itself a
  whole token of the candidate name. The candidate is strictly more specific than the query; a
  generic category word or short phrase embedded inside a more specific German compound noun.
  **This is the defect class.**
- **`sub_token_substring_query_specific`** _(the safe compound-query direction)_ — the query itself
  is the longer/more specific compound, and one of the candidate's own tokens is a substring of the
  query. A specific compound query legitimately matching a shorter, more generic candidate
  component. Preserved untouched by this task — this is exactly the mechanism German-compound
  discoverability (and RESOLVER-V2-010's qualified Speck sub-terms) already relies on.
- **`alias_substring`** — the query is a substring of a full alias string but not of any single
  token (comma/slash-derived aliases, parenthetical variants). Same unsafe direction as above, one
  stage later (`findIncludesMatches`).
- **`no_relation`** — the winning candidate was found through non-textual signal (fuzzy plural
  folding, ranked-token scoring) with no direct substring relationship to the query at all — out of
  this task's scope (not a substring-collision case).
- **`no_candidates`** — the query produced no BLS results at all.

The policy deliberately does **not** assume every German compound substring is invalid: the
`sub_token_substring_query_specific` and `whole_token` classes remain fully accepted, preserving
compound-food discoverability.

## 5. Policy alternatives considered

- **A hand-curated generic-word list** (e.g. explicitly listing `"snack"`, `"pastete"`, …) —
  rejected: not generalizable, requires ongoing manual curation as the BLS corpus evolves, and the
  task instructions explicitly forbid this without a complete governance/coverage case, which was
  never attempted because a general, source-grounded alternative was available and proven to work.
- **A reverse-engineered score-delta threshold** tuned to flip the `"snack"` case specifically —
  rejected: the task instructions explicitly forbid choosing a numeric threshold after inspecting
  the target score, and the existing `DELTA_THRESHOLD` (0.08) is irrelevant here (there was only
  ever one candidate for bare `"snack"` — no second-place score to compare against).
- **A source-ID-only exception** (`INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID`, the
  RESOLVER-V3-043 Phase A mechanism) for `X5A1030` alone — rejected as insufficiently general: the
  audit in §8 below independently found ten _further_, previously-unknown real BLS records with the
  identical defect class (`"pastete"`, `"schenkel"`, `"russisch"`, `"fladenbrot"`, `"rohkost"`,
  `"the"`, `"krapfen"`, `"muscheln"`, `"pina"`, `"lasagne"`) — a per-sourceId list would have missed
  all ten, disproving that a source-ID-only fix was sufficient before it was ever adopted.
- **Globally disabling substring matching in `BlsLookupEngine`** — rejected without measurement:
  would have discarded the entire `sub_token_substring_query_specific` direction too (380 queries in
  the audited population, including RESOLVER-V2-010's approved qualified Speck sub-terms), a
  disproportionate loss of legitimate compound-food discoverability for a defect that only actually
  manifested in 11 of the 13,055 audited queries.
- **A blanket "compound word → never accept" rule** at the `BlsLookupEngine` search stage — rejected:
  would remove the candidate from _retrieval_ entirely, conflating discoverability with identity
  confidence (explicitly warned against by the task's guidance) and losing ranking/discovery value
  for legitimate future callers (e.g. a future clarification UI listing "did you mean
  Kichererbsensnack gebacken?").

## 6. Selected policy

**A categorical, source-grounded, stage-agnostic resolver-level check** —
`hasBlsGenericSubstringOnlyIdentity(normalizedQuery, winner)` in `BlsLookupEngine.ts`:

```
if (winner.exact) → safe (real exact/whole-alias identity)
else if every query token is a whole, space-delimited token of winner.normalizedName → safe
else if winner.normalizedName (whitespace-collapsed) strictly contains the query as a substring → UNSAFE
else → safe (no textual relation at all — out of scope)
```

Applied via a single shared helper, `guardAgainstBlsGenericSubstringCollision`, called at **both**
places a BLS candidate can become a confidently `accepted` decision winner
(`SequentialFoodCatalogResolver.ts`): the dedicated BLS generic-truth fast-path gate, and the
generic multi-source fallback decision (closing the threshold-bypass gap found in §3). When it
fires, the decision is downgraded to an honest `ambiguous` with a new reason code
(`BLS_GENERIC_SUBSTRING_COLLISION_RISK`), `best`/`secondBest` cleared (so no downstream caller —
including `LogFoodFromRawInputUseCase`'s own confidence gate — can still treat it as resolved), and
`candidates` preserved unmodified (retrieval/ranking are untouched; only confident acceptance is
blocked). This matches the task's own stated preferred semantic principle: _a substring-only
candidate may participate in retrieval and ranking, but must not be promoted to a confident accepted
identity when the query is strictly less specific than the candidate and acceptance would add an
unstated ingredient, preparation, or subtype._

General and source-grounded: driven only by each candidate's own name and match provenance, no
per-food, per-word, or per-sourceId list, and no numeric threshold tuned to any specific case.

## 7. Rejected case-specific or threshold-tuned fixes

See §5. No `INCOMPATIBLE_GENERIC_QUERIES_BY_SOURCE_ID` entry was added for `X5A1030`; no new
`DELTA_THRESHOLD`-style numeric constant was introduced; no hand-curated word list was added to
`BlsLookupEngine.ts` or `BlsCompactRuntimeAdapter.ts`.

## 8. Before/after audit methodology

`resolverV3051SubstringCollisionAudit.ts` builds a deterministic, reproducible query population
(deduplicated, in `Set` insertion order) from the real, committed BLS runtime population (7,090
records) and the frozen 104-case representative corpus, extending the RESOLVER-V3-049 methodology
specifically for substring containment:

- every unique record `normalizedName` (6,822 raw, deduplicated into the shared query set),
- every unique deterministic alias — including comma/slash-derived split aliases and
  compatibility aliases (3,791 raw),
- every unique single BLS record token, including generic category-like suffixes/prefixes embedded
  in compound names (2,366 raw),
- every unique `DeterministicFoodParser`-parsed, normalized query from the full 104-case frozen
  representative corpus (76 raw; parenthetical BLS record variants are inherently covered by the
  `normalizedName` set, since `normalizeBlsRuntimeText` strips parentheticals into the canonical
  form audited).

For each of the resulting **13,055 unique queries**, the real `BlsLookupEngine.search()` (candidate
provenance/match kind) and the real `SequentialFoodCatalogResolver` + `BlsStaticSource`
(`locale: 'de'`, `inputType: 'generic'`) were run — zero provider calls, zero mocked resolver logic.
"Before" (pre-fix) status is derived analytically rather than by reverting the fix: because
`guardAgainstBlsGenericSubstringCollision` only ever clears a `decision.best` that is BLS-sourced
with `score >= 0.7` (`LogFoodFromRawInputUseCase`'s own persistence gate — see §14), and preserves
the original ranked `candidates` list unmodified when it fires, the pre-fix _production-effective_
decision is reconstructible for every guarded query (winner = `candidates[0]`) without duplicating
or risking drift from the resolver's real acceptance logic. **Note on the `statusBefore` label:**
the audit labels every guarded query's reconstructed pre-fix status as `'accepted'` — an intentional
simplification, not a literal replay of the resolver's own nominal status field. As §14 explains,
the guard now also fires on queries whose pre-fix resolver _status_ was already the ordinary
`ambiguous` (`MULTIPLE_CLOSE_MATCHES`, an ordinary near-tie, nothing to do with this task) while
`best` remained populated at a persistence-eligible score — for those queries, "accepted" in this
report means "would have been confidently persisted by production," the fact that actually matters,
not the resolver's own status label. Full per-query data:
`logs/resolver-v3-051-substring-collision-audit.json` (gitignored, regenerate via
`npx jest src/features/nutrition/__tests__/ResolverV3051SubstringCollisionAudit.test.ts`).

### Baseline totals (before fix, final corrected figures — see §14)

| Metric                                                                 | Count  |
| ---------------------------------------------------------------------- | ------ |
| Total unique queries                                                   | 13,055 |
| Queries with ≥1 BLS candidate                                          | 12,882 |
| `exact_identity` matches                                               | 10,148 |
| `whole_token` matches                                                  | 1,789  |
| `sub_token_substring_record_specific` (unsafe direction)               | 83     |
| `sub_token_substring_query_specific` (safe compound-query direction)   | 381    |
| `alias_substring`                                                      | 1      |
| `no_relation`                                                          | 480    |
| `no_candidates`                                                        | 173    |
| Accepted (before)                                                      | 9,581  |
| Ambiguous (before)                                                     | 3,100  |
| Rejected/no-match (before)                                             | 374    |
| Production-effective accepted substring-only-relation matches (before) | **81** |
| Substring-only-relation queries with exactly 1 candidate               | 1      |
| Substring-only-relation queries with >1 candidate                      | 83     |

Every one of the 83 `sub_token_substring_record_specific` queries had a non-null pre-fix winner by
construction (classification requires a winner record); all 81 were production-effectively
"accepted" pre-fix (i.e. would have been persisted) — once correctly measured including the
ordinary-`ambiguous`-with-populated-`best` pathway (§14), the defect's real footprint was
substantially larger than the 11 originally reported.

## 9. Exact blast radius (after fix, final corrected figures — see §14)

| Metric                                                       | Count / %                          |
| ------------------------------------------------------------ | ---------------------------------- |
| Total queries                                                | 13,055                             |
| Changed outcomes                                             | **85 (0.651%)**                    |
| `accepted` (production-effective) → `ambiguous`              | 85                                 |
| `accepted` → `no_match`/`rejected`                           | 0                                  |
| `ambiguous` → `accepted`                                     | 0                                  |
| `no_match` → `accepted`                                      | 0                                  |
| Winner `sourceId` changes (among unchanged-status queries)   | 0                                  |
| Substring-only-relation accepted queries remaining after fix | **0**                              |
| Accepted (after)                                             | 9,496                              |
| Ambiguous (after)                                            | 3,185                              |
| Rejected/no-match (after)                                    | 374 (byte-identical set to before) |

All 85 changed queries transition to `ambiguous` with `best` cleared; none transition to
`rejected`/`no_match`, none introduce a new acceptance anywhere in the audited population, and the
`rejected` bucket is untouched. The fix is provably fail-safe within this audit: it only ever
removes false confidence, never adds a new acceptance and never produces a hard rejection where an
honest `ambiguous` is more appropriate.

### The 85 changed queries (representative sample — full list in the JSON report)

| Query        | Winner (before)                                             | sourceId | kcal | Note                                                                 |
| ------------ | ----------------------------------------------------------- | -------- | ---- | -------------------------------------------------------------------- |
| `snack`      | Kichererbsensnack gebacken                                  | X5A1030  | 231  | **Motivating case**                                                  |
| `pastete`    | Pasteten mit Himbeersahne                                   | D771300  | 315  | Generic word vs. specific sweet pastry                               |
| `schenkel`   | Hähnchenschenkel mariniert, gebraten, mit Curryjoghurtsauce | Y569533  | 262  | Generic "thigh" vs. fully composite dish                             |
| `russisch`   | Russische Creme mit Schlagsahne                             | Y859440  | 205  | Adjective fragment vs. specific dessert                              |
| `fladenbrot` | Weizenfladenbrot                                            | B782100  | 248  | Generic flatbread vs. wheat-specific variant                         |
| `rohkost`    | Fenchelrohkost mit Joghurtmarinade                          | X2A1040  | 54   | Generic raw-veg vs. specific fennel dish                             |
| `the`        | Korinthe                                                    | F840300  | 309  | Unrelated word fragment coincidentally embedded                      |
| `krapfen`    | Husarenkrapfen                                              | D734700  | 489  | Generic donut word vs. specific pastry                               |
| `muscheln`   | Jakobsmuscheln, gebraten, provenzalische Art                | Y684562  | 89   | Generic mussels vs. specific scallop dish                            |
| `pina`       | Spinat, roh                                                 | G211100  | 18   | Unrelated fragment coincidentally embedded ("s**pina**t")            |
| `lasagne`    | Lasagnette mit Ricotta und Tomaten, mit Spinat, gedünstet   | X730243  | 138  | Generic dish name vs. a differently-named, differently-composed dish |
| `anis`       | Japanische Wollmispel/Loquat, roh                           | F529100  | 48   | **Post-merge-review case**: unrelated word, was `ambiguous` + `best` |
| `mate`       | Tomate, roh                                                 | G561100  | 18   | **Post-merge-review case**: unrelated word, was `ambiguous` + `best` |
| `tee`        | Teewurst fein/grob (Rügenwalder Art)                        | W121100  | 316  | **Post-merge-review case**: unrelated word, was `ambiguous` + `best` |
| `fleisch`    | Schweinefleischsülze                                        | W851000  | 113  | **Post-merge-review case**: unrelated word, was `ambiguous` + `best` |
| `erdbeere`   | Erdbeeren mit Schlagsahne                                   | Y872460  | 116  | **Post-merge-review case**: unrelated word, was `ambiguous` + `best` |

74 further queries follow the same "post-merge-review case" shape (e.g. `gruetze`, `heidelbeere`,
`kuemmel`, `schnitzel`, `aprikose`, `mandarine`, `geschmack`, `gefuellt`) — full list with winner
sourceId/name/kcal in `reports/resolver-v3-051-generic-bls-substring-collision-safety.json`'s
`changedQueries` array and `logs/resolver-v3-051-substring-collision-audit.json`. Several of these
(`"the"` inside `"Korinthe"`, `"pina"` inside `"Spinat"`, `"mate"` inside `"Tomate"`) are not even
semantically related words — pure coincidental character-sequence collisions — underscoring that
this defect class was never limited to plausible-sounding cases like `"snack"`.

## 10. Target-case post-fix result

`"Ein Snack"` → `DeterministicFoodParser` → `"snack"` → BLS still finds `X5A1030` as a candidate
(retrieval unaffected) → `hasBlsGenericSubstringOnlyIdentity('snack', { normalizedName:
'kichererbsensnack gebacken', exact: false })` returns `true` → resolver returns
`status: 'ambiguous'`, `reasonCodes: ['BLS_GENERIC_SUBSTRING_COLLISION_RISK']`, `best: undefined`.
`LogFoodFromRawInputUseCase.execute({ rawInput: 'Ein Snack' })` no longer persists a confidently-
resolved food entry. The frozen benchmark scenario `RH-RES-VAGUE-DEV-004` under the real,
production-faithful V3-050 call path now resolves `variantA.status: 'ambiguous'`,
`variantC.fastPathUsed: false` — no forced specific snack candidate, matching the task's acceptance
criterion (ambiguous is an honest, non-accepted, non-forced outcome).

## 11. Positive controls

All verified passing after the fix (permanent regression coverage in
`ResolverV3051GenericBlsSubstringCollisionSafety.test.ts`):

- Qualified compound-food queries remain resolvable: `Kichererbsensnack gebacken` → `X5A1030`
  (exact identity), `Hafer Flocken, gekocht` → `C133032`, `Pommes frites tiefgefroren, gebacken` →
  `K130262` (both RESOLVER-V3-049 family-extension outcomes).
- Existing exact-identity accepted controls unaffected: `Quark`/`Magerquark` → `M713100`,
  `Rührei` → `Y720143`, `Eier` → `Y720100`.
- RESOLVER-V3-043 Phase A: bare `Brötchen` still never wins via `D771900`; qualified
  `Brötchen Blätterteig` still accepted to `D771900`.
- RESOLVER-V3-049: `Haferflocken`/`Pommes` preparation-state ambiguity still fires with
  `BLS_GENERIC_PREPARATION_STATE_AMBIGUITY` and both real candidates listed; none of the flagged
  `sub_token_substring_record_specific` queries collide with these cases.
- RESOLVER-V2-010: `Bauchspeck` → `W411300`, `Schinkenspeck` → `U685142`, `Rückenspeck` → `U605000`
  all still resolve `best` to the same deterministic sourceId (their pre-existing, unrelated
  `MULTIPLE_CLOSE_MATCHES` ambiguous status — a genuine near-tied second candidate — is untouched by
  this task; `hasBlsGenericSubstringOnlyIdentity` never engages for them, since each query is a
  `whole_token` match against its own record's name).
- V3-050 parser-boundary fidelity: unaffected — this task changes only resolver-level acceptance
  policy, never `DeterministicFoodParser` or the benchmark adapter's call order.

## 12. Residual risks

- The `sub_token_substring_query_specific` (safe) direction and `no_relation` matches were not
  touched by this task and could themselves harbor unrelated correctness issues (e.g. the 479
  `no_relation` accepted-before queries were not individually reviewed for accuracy — out of this
  task's declared scope, which is specifically substring-collision safety).
- The audit population, while large (13,055 queries) and reproducible, is not exhaustive of every
  possible user phrasing (e.g. it does not include arbitrary multi-word paraphrases beyond the
  104-case corpus). A previously-unseen bare word that happens to be a substring of a not-yet-
  identified BLS compound token could still surface a new instance of this same class in the
  future; the fix is general (not a per-case list), so any such future instance would be caught
  automatically by the same policy without requiring a new patch.
- `no_relation` (fuzzy/plural-fold token) matches remain outside this policy's scope — they are a
  different match mechanism (`tokenRecall`'s `foldToken` plural handling), not a textual-
  containment identity claim, and were not part of this task's diagnosed defect class.

## 13. Implications for V3-044, V3-047, and V3-048

- **RESOLVER-V3-044** (AI-routed clarification/abstention remediation): unaffected — this task's
  fix is entirely inside the BLS deterministic fast path; V3-044's owned cases already confirmed to
  never reach the BLS fast path at all.
- **RESOLVER-V3-047** (Haiku optimization candidate evaluation): its `Depends on` list is updated to
  add `RESOLVER-V3-051` — a candidate comparison run against a deterministic fast path that still
  had this substring-collision defect would not be measuring what it claims to measure, for the
  same reason it already waits on RESOLVER-V3-049/050.
- **RESOLVER-V3-048** (protocol-v4 live re-evidence): its `Depends on` list is updated to add
  `RESOLVER-V3-051` — Haiku optimization and protocol-v4 live evidence must not run against a known
  unsafe deterministic fast path.

## 14. Post-merge correction (2026-07-25)

This task's first version was merged as PR #174 (merge commit `b8eb90cc10e7593df794f1f79ee96eb2ff50d847`).
Per the task's own workflow requirement, an independent post-merge review was then performed
(general-purpose review agent, no access to this task's own reasoning). It found a real, blocking
gap in `guardAgainstBlsGenericSubstringCollision`'s original implementation, verified directly
against the merged code before any correction:

**The gap:** the guard originally required `decision.status === 'accepted'` before it would run at
either call site. `ResolverDecisionPolicy.buildResolverDecision` always sets `best = sorted[0]`
whenever any BLS candidate exists, **regardless of the computed status** — an ordinary `ambiguous`
decision (`MULTIPLE_CLOSE_MATCHES`, a real near-tied second candidate under `DELTA_THRESHOLD`,
entirely unrelated to this task) still carries a populated, often high-scoring `best`.
`LogFoodFromRawInputUseCase.execute()` reads `decision.best` and persists it whenever
`resolved.score >= 0.7` — **it never consults `decision.status` at all**. So any substring-collision
candidate whose query happened to have a close second-place competitor (putting the resolver's own
status at `ambiguous` rather than `accepted`, purely by coincidence of scoring) sailed straight
through the original guard, fully exploitable through the exact production path this task exists to
close. Empirically confirmed with five real queries before the correction: `"Anis"` (→ "Japanische
Wollmispel/Loquat, roh", score 1.0, `ambiguous`), `"Mate"` (→ "Tomate, roh"), `"Tee"` (→ "Teewurst
fein/grob"), `"Fleisch"` (→ "Schweinefleischsülze"), `"Erdbeere"` (→ "Erdbeeren mit Schlagsahne") —
all reproduced independently by both the reviewing agent and this task's own follow-up verification.

**The fix:** `guardAgainstBlsGenericSubstringCollision` no longer requires `decision.status ===
'accepted'`. It now runs whenever `decision.best` is populated, is BLS-sourced, and has
`score >= 0.7` (mirroring `LogFoodFromRawInputUseCase`'s own persistence gate exactly, so the guard
can never again be bypassed by whichever nominal status the resolver's ordinary scoring happens to
produce). The `>= 0.7` scoping deliberately avoids relabeling a genuinely low-confidence,
already-`rejected` `best` that production would never have persisted regardless.

**Audit tooling correction:** re-running the same 13,055-query audit under the corrected guard
surfaced two further inconsistencies in the _audit script's own_ classifier (not the production
fix) — both fixed and documented in `resolverV3051SubstringCollisionAudit.ts`'s `classifyMatch`:

1. Its `whole_token` exemption originally checked `record.tokens` (which includes words generated
   from parenthetical BLS grading-code/qualifier content that alias-generation keeps literal, e.g.
   `"(KA II)"` surviving as bare tokens `"ka"`/`"ii"`), disagreeing with production's own
   `normalizedName`-based check (which strips parentheticals). Fixed to use `normalizedName`,
   matching production exactly.
2. Its `alias_substring` classification did not distinguish a query that is a whole, space-delimited
   word within a real documented-synonym alias (e.g. `"mezcal"` within the generated alias
   `"agavenbrand mezcal"`, itself derived from the display name's own `"Agavenbrand
(Mezcal/Tequila)"` parenthetical) from a genuine substring-fragment coincidence — mislabeling 25
   legitimate synonym matches as false-confidence risk. Fixed with an explicit whole-alias-word
   exemption.

One documented, deliberate residual disagreement remains and is intentional, not a bug: bare query
`"ka"` against `U403100` ("Kalb, Fleisch, ..., (KA II), roh") is a whole word within a generated
alias (same shape as the `"mezcal"` case), but `hasBlsGenericSubstringOnlyIdentity` still flags it
(its own whole-token exemption only ever consults `normalizedName`, never generated aliases). Unlike
`"mezcal"` (a real 6-character synonym), `"ka"` is a 2-character commercial-grading-code fragment,
not a word a user would type meaning "veal" — production's conservative `ambiguous` result here is
the safer of the two possible outcomes and is retained deliberately (see the dedicated code comment
in `ResolverV3051SubstringCollisionAudit.test.ts`).

**Corrected numbers:** the true audited blast radius is **85 changed queries (0.651%)**, not the
originally reported 11 (0.084%) — the additional 74 are exactly the previously-invisible
ordinary-`ambiguous`-with-populated-`best` exploit class. All other properties proven in §9 remain
true under the corrected figures: zero winner `sourceId` changes, zero new acceptances, zero
`rejected` transitions, `substringOnlyAcceptedAfter: 0`. New permanent regression tests
(`ResolverV3051GenericBlsSubstringCollisionSafety.test.ts`, "post-merge review finding" describe
block) cover all five originally-found exploit cases at both the resolver and
`LogFoodFromRawInputUseCase` production boundaries. Shipped as a follow-up PR/commit on top of the
merged PR #174, following the same verify → commit → push → PR → CI → merge workflow.

---

## Files changed

- `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts` — new exported
  `hasBlsGenericSubstringOnlyIdentity`.
- `src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts` — new shared
  `guardAgainstBlsGenericSubstringCollision` helper, applied at both the BLS fast-path gate and the
  generic multi-source fallback decision.
- `src/features/nutrition/application/services/ResolverDebugTypes.ts` — extended `DecisionInfo`
  reason union with `'bls_generic_substring_collision_risk'`.
- `src/features/nutrition/resolverV3051SubstringCollisionAudit.ts` — new audit module (Phase 3/6);
  post-merge-corrected classifier (§14).
- `src/features/nutrition/__tests__/ResolverV3051GenericBlsSubstringCollisionSafety.test.ts` — new,
  39 tests (29 original Phase 1 permanent regression coverage plus positive controls, +10 added by
  the post-merge correction in §14 covering the previously-invisible exploit class).
- `src/features/nutrition/__tests__/ResolverV3051SubstringCollisionAudit.test.ts` — new, 8 tests
  (audit harness + assertions over the full audited population).
- `src/features/nutrition/benchmark/representativeHybridV1/__tests__/RepresentativeHybridV1ThreeArmBoundary.test.ts`
  — 1 stale assertion (had encoded the pre-fix defective behavior as expected, per the same
  precedent established by RESOLVER-V3-043/049/050) updated to assert the corrected reality, with
  historical context preserved in comments.
- `ROADMAP.md`, `handoffs/latest-handoff.md` — this task's entry; `RESOLVER-V3-047`/`048`
  dependencies updated.

## Verification

Full repository suite (`npm run test`): **243 suites, 2,428 tests green** (baseline at the canonical
commit was 241 suites/2,391 tests, per RESOLVER-V3-050's own reported final count — this task
net-added 2 new suites and 37 new tests). `npx tsc --noEmit`: clean. `npm run verify`: green.
`git diff --check`: clean. Zero provider calls,
zero benchmark cost, `ANTHROPIC_API_KEY` never touched, no Development/Holdout rerun, frozen
`logs/resolver-v3-039-*` evidence untouched, frozen corpus/BLS workbooks/generated BLS artifact
unchanged, Haiku model policy unchanged, no production wiring, `RESOLVER-V3-010` remains `blocked`.
