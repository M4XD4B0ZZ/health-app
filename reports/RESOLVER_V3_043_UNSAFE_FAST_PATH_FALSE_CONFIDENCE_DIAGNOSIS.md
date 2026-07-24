# RESOLVER-V3-043 — Unsafe Fast-Path and False-Confidence Diagnosis (review-only, no code changed)

**Status of this document:** diagnosis only, per the same "review-only" convention as
`reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md`. No production, benchmark, or data file
was modified while producing it. One temporary, untracked Jest test file
(`_tmp_broetchen_probe.test.ts`) was created to empirically observe real resolver/BLS behavior and
was deleted immediately after use (`git status --short` confirmed clean before this report was
written). `npm ci --ignore-scripts` was run to restore missing `node_modules` in this container
(same precedent as `RALPH-RETIRE-001`); no `package.json`/`package-lock.json` change resulted.

## 0. Why this document exists

`RESOLVER-V3-043` ("Unsafe Fast-Path and False-Confidence Remediation") was added to `ROADMAP.md`
on 2026-07-24 as the first task in the binding Hybrid P0 remediation sequence (see
`RESOLVER-V3-041`'s entry). Its stated scope, taken directly from prior reports, was: (a) fix the
documented gap where "Variant A's fast path does not strip a leading quantity/article token before
searching BLS"; (b) fix whatever caused Hybrid C to not be strictly better than both Variant A and
B (G2-B `failed`); (c) fix the historical `RV3-0011`/"Brötchen" false-confidence case reproduced by
benchmark scenario `RH-RES-DACH-DEV-006`.

Before writing any fix, this diagnosis traced both claims to their actual, current code. **Both
turned out to be more precisely — and differently — rooted than the prior reports stated.** This
matters because at least one prior report's causal claim does not hold for the real production
code path, and the true root cause of the false-confidence case is a specific, previously
unidentified data-generation defect with a measurable blast radius. Both findings change what
"remediation" should mean here, so they are recorded before any code is touched, per this
repository's "measure twice, cut once" convention for consequential changes.

## 1. Finding 1 — the "fast path doesn't strip quantity" claim is a benchmark-harness fidelity gap, not a live production defect

**Claim under test** (`reports/RESOLVER_V3_038_REPRESENTATIVE_HYBRID_BENCHMARK_READINESS_REPORT.md`
and the comment at `RepresentativeHybridV1DachCorpus.ts:104-108`): "the real resolver's fast path
does not strip quantity/article prefixes before searching BLS (verified empirically during
authoring)."

**What the real production call path actually does:**
`LogFoodFromRawInputUseCase.execute()` (`src/features/nutrition/application/usecases/LogFoodFromRawInputUseCase.ts:121`)
calls `this.parser.parse(rawText)` (`DeterministicFoodParser`,
`src/features/nutrition/infrastructure/parsers/DeterministicFoodParser.ts`) **before** any resolver
call. That parser already strips grams ("250g"), counts ("2x", German number words "zwei"/"drei"
…), and "Xer" patterns from the front of the string (lines 60-115 of that file), returning a
`parsed.name` with the quantity/count removed. `resolveCanonicalFood()`
(`LogFoodFromRawInputUseCase.ts:531-566`) then normalizes and resolves using `parsed.name`
(line 209/558), never the raw, quantity-prefixed string. So for a real user typing "200g Brötchen"
in the shipping app, the resolver is queried with `"brötchen"`, already stripped — not
`"200g brötchen"`.

**What the benchmark harness actually does:** `runVariantACase()`
(`src/features/nutrition/benchmark/ResolverV3VariantAAdapter.ts:94-108`) computes
`normalizeText(benchmarkCase.rawInput)` and passes it straight to `resolver.resolve()` — it never
calls `DeterministicFoodParser` first. So a benchmark case whose `rawInput` is quantity-prefixed
(e.g. "Ein Brötchen") is sent to the exact same production `SequentialFoodCatalogResolver` the real
app uses, but **without** the pre-processing step every real call in the app actually performs
first.

**Implication:** the documented gap is real in the sense that
`SequentialFoodCatalogResolver`/`normalizeText` alone, in isolation, do not strip such prefixes —
but the real, shipping call path never invokes the resolver in isolation like that; it always goes
through `DeterministicFoodParser` first. The benchmark's Variant A adapter is a **narrower** call
path than production (skips a real pre-processing step everyone else already gets), which means:
any RESOLVER-V3-038/039 benchmark case relying on a quantity-prefixed `rawInput` to defeat Variant
A's fast path is measuring an artifact of the harness, not of the shipping app. This does not by
itself invalidate G2-B (Hybrid C not being strictly better than A/B) — that finding does not depend
on quantity prefixing — but it does mean **"add quantity stripping to the fast path" is not a
correct description of what needs to change in production code**, since production already has that
step. If the benchmark harness itself should be made more representative (calling
`DeterministicFoodParser` before `resolver.resolve()`, matching real usage), that is a narrower,
separate, lower-risk fix than editing the production resolver — recorded as a proposal in §4, not
implemented here.

## 2. Finding 2 — the real, precise root cause of the `RV3-0011`/"Brötchen" false-confidence case

This is a genuine, currently-live defect in the real production BLS data/matching pipeline — not a
benchmark artifact. Traced empirically (temporary probe test, deleted after use; full raw output
kept in this session's working notes) against the actual runtime dataset
(`src/features/nutrition/infrastructure/catalog/sources/bls/generated/bls-runtime-compact.v1.json`,
7,090 records — the same file `BlsStaticSource`/`blsGenericFoods.ts` load in the real app; the
benchmark's `ResolverV3VariantAAdapter.ts:11` imports this exact same production class, not a mock).

**Empirical result for query `"Brötchen"` (locale `de`) against the real resolver:**

```
DECISION {
  status: "accepted", reasonCodes: ["ACCEPTED_STRONG_MATCH"],
  best: { name: "Brötchen (Blätterteig)", sourceId: "D771900", kcal: 425, score: 1,
          breakdown: { matchScore: 1, ... notes: ["heuristic_alias", ...,
                        "semantic_class_simple_generic", "semantic_simple_generic_boost"] } },
  top5: [ { name: "Brötchen (Blätterteig)", score: 1 } ]   // only one candidate returned at all
}
```

**Why only one candidate, and why score `1` (exact), not a borderline fuzzy score:**
`BlsLookupEngine.search()` (`src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts:110-119`)
tries `findExactMatches()` first and **returns immediately if it finds any exact-alias hit at all**
— it never proceeds to the token/includes stages that would otherwise surface the real production
dataset's 81 other, more-relevant "Brötchen"-family candidates (confirmed present in the same
runtime file — e.g. `B511000` "Weizenbrötchen", 280 kcal, close to the intended plain-roll range).

The single exact match comes from `D771900`'s **generated alias list**, built by
`buildBlsRuntimeAliases()` (`src/features/nutrition/infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter.ts:57-68`).
That function includes `normalizeBlsRuntimeText(record.displayName)` as one alias for every record.
`normalizeBlsRuntimeText()` (same file, line 36) unconditionally strips **all** parenthetical
content (`.replace(/\([^)]*\)/g, ' ')`) before folding/lowercasing. Applied to the raw display name
`"Brötchen (Blätterteig)"`, this produces the bare alias `"broetchen"` — silently discarding
`"(Blätterteig)"` (puff pastry), which is not an incidental state annotation (like "(roh)"/"(TK)")
but the entire reason this record is a *different food* from a plain bread roll. Confirmed
empirically: **no record in the real 7,090-row dataset is named plain "Brötchen"** — `D771900` is
the only record whose display name reduces to bare "Brötchen" once its parenthetical is stripped
(script output: 1 match, `D771900` only). Every genuine plain-roll candidate uses a compound noun
instead ("Weizenbrötchen", "Roggenbrötchen", …), which the alias generator does not conflate with
the bare word.

**Root cause, stated precisely:** `buildBlsRuntimeAliases()` generates a bare-word alias for
`D771900` that falsely claims exact identity with an unqualified, extremely common generic German
word, and `BlsLookupEngine.findExactMatches()`'s "any exact hit short-circuits everything else" rule
then lets that one mis-generated alias pre-empt 81 more plausible candidates before they are ever
scored. This reproduces the exact, already-documented `RV3-0011` pattern
(`RESOLVER-V3-024`'s "Variant A's fast path resolves confidently to the wrong (pastry) roll") — but
the true mechanism is an **alias-generation defect in the BLS data-adaptation layer**, not a
"fast-path doesn't check ambiguity" policy gap. (A secondary, independent architectural gap does
exist — the BLS early-return at `SequentialFoodCatalogResolver.ts:403-429` never checks a
score-delta/ambiguity condition the way `buildResolverDecision()`'s general path does at
`ResolverDecisionPolicy.ts:49-56` — but for this specific case that gap is not the proximate cause:
there is only one BLS-side candidate at all once the exact-match stage short-circuits, so no
"second candidate" ever exists to trigger an ambiguity check even if one were added to the fast
path. Both are real, but they are two different defects with two different fixes.)

## 3. Blast-radius check (why no fix was applied to alias generation tonight)

Before proposing any change to `buildBlsRuntimeAliases()`/`normalizeBlsRuntimeText()`, this session
computed how many of the 7,090 real records would be affected by the most obvious generic fix
("don't generate a bare alias when the parenthetical content is a known processed/variant
qualifier," reusing the existing `PROCESSED_QUALIFIER_TOKENS` lexicon already used elsewhere in
`BlsLookupEngine.ts` for ranking de-preference, plus adding "blaetterteig" to it):

- **51 records** have a parenthetical whose content hits that lexicon (existing terms plus
  "blaetterteig"). Of those, **~10 are other "(Blätterteig)" pastries** — e.g. `D4A1000`
  "Apfelstrudel (Blätterteig)", `D7A7800` "Apfeltasche (Blätterteig)", `D771500` "Hörnchen
  (Blätterteig)", `D770100` "Mohnschnecken (Blätterteig)". **Only `D771900` ("Brötchen") is a
  dangerous collision** — for the others, the paren-stripped bare form ("Apfelstrudel",
  "Hörnchen", "Mohnschnecken", …) *is* the correct, unambiguous common name for that specific
  pastry; there is no competing everyday food commonly called by that same bare word. Blanket-
  removing the bare alias for all ~10 would very likely **regress** currently-correct exact
  matches for those foods (they would fall back to a lower-confidence token/includes match for no
  reason), while only one of the ten (Brötchen) is actually unsafe.
- This means the danger is not "parenthetical qualifier present" in general — it is specifically
  "the paren-stripped bare form collides with a common, unrelated, more general food term that most
  users mean something else by." That is a judgment about real-world word ambiguity, not a
  mechanically detectable property of the string alone, and this repository's own architecture
  principle for `ScoreCalculator.ts` is explicit: "generic token-based semantic analysis... no
  per-food hardcoding." A fix narrow enough to be safe (target `D771900` only) would be exactly the
  kind of per-food hardcoding the codebase deliberately avoids elsewhere; a fix general enough to
  avoid hardcoding (the lexicon-based one tested above) has a confirmed, non-trivial regression
  risk across ~10 records this session could not fully hand-verify against real-world naming
  conventions for German pastries in the time available tonight.
- Separately, this session also did **not** verify whether this same "single mis-generated bare
  alias short-circuits everything else" pattern exists for any *other* bare word in the 7,090-record
  set outside the 51 qualifier-paren cases already checked (e.g. via non-qualifier parens like
  "(TK)", "(roh)", or via `splitAliasCandidates`'s comma/slash-segment logic instead of the
  paren-stripping path). A full audit of that would itself be a non-trivial task.

**Decision:** given real, live production food-identification accuracy is at stake, and the
smallest safe scope for tonight could not be established with confidence within the remaining
session budget, no change was made to `BlsCompactRuntimeAdapter.ts`, `BlsLookupEngine.ts`,
`SequentialFoodCatalogResolver.ts`, or the generated BLS artifact. This is a deliberate choice to
avoid a rushed, under-verified change to the deterministic core the rest of the app depends on for
calorie accuracy, consistent with `AGENTS.md`'s "no broad refactors outside the scope of the
current task" and this repository's general practice of flagging consequential, wide-blast-radius
findings for explicit review rather than silently patching them.

## 4. Smallest safe remediation proposals (for a follow-up Act task — not implemented here)

1. **Narrowest, lowest-risk, `D771900`-specific fix:** add an explicit compatibility/override entry
   for `D771900` analogous to the existing `COMPATIBILITY_ALIASES_BY_SOURCE_ID` mechanism in
   `BlsCompactRuntimeAdapter.ts:11-15` — but as a *removal* list (aliases a specific record must
   **not** claim), not an addition list. This is the same "explicit, sourceId-keyed override,
   reviewed per record" pattern the codebase already uses for the `M713100`/`B314000`/`Y720143`
   compatibility aliases, so it is architecturally consistent, not a new abstraction, and has zero
   blast radius beyond the one record named.
2. **Broader, lexicon-based fix** (only after a human reviews the ~10-record impact list in §3 and
   confirms each one individually): extend the `PROCESSED_QUALIFIER_TOKENS`-style de-preference
   mechanism to also suppress bare-alias *generation* (not just ranking de-preference) when a
   parenthetical qualifier is present — but this requires per-record sign-off given the confirmed
   regression risk above, not a blanket rule change.
3. **Defense-in-depth, independent of either fix above:** make the BLS fast-path early return at
   `SequentialFoodCatalogResolver.ts:403-429` apply the same score-delta/ambiguity check
   `ResolverDecisionPolicy.ts` already applies elsewhere, so that *future* cases where BLS itself
   returns two or more close-scoring candidates cannot silently early-return as confidently
   "accepted." This would not, by itself, have fixed the Brötchen case (only one candidate is ever
   returned there, per §2), so it does not replace fix 1/2, but it closes the second, independent
   architectural gap noted in §2. Not implemented tonight because it changes the accept-vs-fall-
   through behavior for every BLS generic/ambiguous query, which needs its own full-regression
   verification pass this session did not have budget for after the investigation above.
4. **Benchmark-harness fidelity fix** (separate from all production fixes above): have
   `ResolverV3VariantAAdapter.runVariantACase()` (and whatever Variant C fast-path adapter code
   calls the same resolver) run `DeterministicFoodParser.parse()` first, matching real production's
   call order, so future benchmark evidence is not measuring a call path the shipping app never
   actually takes. This is a benchmark-only change (no production/domain code), but it would
   invalidate the quantity-prefixed portions of the existing RESOLVER-V3-038 corpus's assumptions
   and would need to be reconciled with the already-frozen, hash-pinned RESOLVER-V3-039 evidence
   before being treated as authoritative — a decision for a human, not this session.

## 5. Constraints honored

- No `src/**` production/domain/application code was modified.
- No benchmark corpus, protocol document, or frozen evidence file (RESOLVER-V3-038/039/042) was
  modified.
- No BLS artifact/data file was modified.
- The one temporary Jest test file created for empirical observation was deleted immediately after
  use; `git status --short` was clean before this report was written.
- No Anthropic/AI provider call was made anywhere in this diagnosis (pure deterministic-code and
  static-data investigation only).
- `npm ci --ignore-scripts` was run only to restore missing `node_modules` (present in this
  container's `.gitignore`, not committed); no dependency file changed.

## 6. Recommended next step (explicit human decision needed)

This diagnosis recommends starting `RESOLVER-V3-043`'s actual code change with **proposal 1** in
§4 (the narrowest, zero-blast-radius, `D771900`-specific alias override) plus a regression test
reproducing exactly the empirical trace in §2, and treating proposals 2–4 as separate, explicitly
human-reviewed follow-up decisions rather than bundling them into the same change. This is a
recommendation for the next working session, not an authorization to proceed automatically — per
`RESOLVER-V3-041`'s binding decision, none of this changes the Haiku-only model policy, and per
`AGENTS.md`, consequential production data-matching changes should be reviewed before being
committed, not just before being merged.
