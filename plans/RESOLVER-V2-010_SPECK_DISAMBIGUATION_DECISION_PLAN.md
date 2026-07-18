# RESOLVER-V2-010 — Ambiguous Generic Term „Speck" — Disambiguation Decision — Planning

Status: `planning complete` — no product code changed. Owner task: **RESOLVER-V2-010**
(ROADMAP.md, Nutrition Resolver v2).
Mode: **review-only product and technical planning** (VERIFY.md Category 1, documentation-only).
Depends on: RESOLVER-V2-008 (diagnosis, `done`). Does not reopen RESOLVER-V2-008/RESOLVER-V2-009.

Origin: RESOLVER-V2-008 diagnosis §3.2/§4.2 —
[`reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md`](../reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md).

---

## 0. Method (reproducible, evidence-based)

All evidence below was collected against the **committed** BLS runtime artifact
(`bls-runtime-compact.v1.json`) through the real lookup path — `searchBlsGenericFoods()` →
`BlsLookupEngine.search()` → `SequentialFoodCatalogResolver.resolve()` → `ResolverDecisionPolicy`
— via two throwaway diagnostic test files, run once with `npx jest`, whose output is transcribed
into this document. **Both files were deleted before this branch's commit** — `git status` is
clean of any new/modified product or test file (verified in §11). No product code, alias, ranking,
source order, BLS artifact, or nutrition value was changed.

---

## 1. Exact candidate inventory for „Speck"

An exhaustive scan of the committed artifact for every record whose `displayName` or any alias
contains the substring "speck" returns **89 records**. Restricting to records that are actually
about a pork "Speck"/"Schinkenspeck" product (not a dish that merely _contains_ speck as an
ingredient — e.g. "Bauernfrühstück mit Speck", "Zwiebelkuchen ohne Speck", "Tiroler
Speckknödel" — those 74 records are dishes/dessert/soup/casserole compounds, out of scope for
"what does bare Speck mean") yields **three materially, nutritionally distinct clusters**:

### Cluster 1 — raw/cured pure fatback ("Rückenspeck" — the current winner's family)

| sourceId      | displayName                                                                        | kcal    | protein | carbs | fat   |
| ------------- | ---------------------------------------------------------------------------------- | ------- | ------- | ----- | ----- |
| `U605000`     | Schwein Rückenspeck, kernig, ohne Schwartenzug (S VIII) roh                        | 746     | 4.41    | 0     | 80.92 |
| `U605700`     | Schwein Speck, ohne Schwartenzug (S VII) roh                                       | 660     | 6.94    | 0     | 70.23 |
| **`W412000`** | **Schwein Speck/Rückenspeck (grüner Speck) roh** ← **current bare-„Speck" winner** | **746** | 4.41    | 0     | 80.92 |
| `W411000`     | Schwein Speck (Rückenspeck) Rohpökelware, geräuchert                               | 699     | 4.13    | 0     | 75.8  |

Pure back fat — nearly 100 % fat by calories, used as a cooking fat/rendering ingredient, not
sliced and eaten as a food in the way "Speck" is usually meant in everyday German food logging.

### Cluster 2 — cured/smoked "Bauchspeck"/"Frühstücksspeck" (the commonly-intended bacon)

| sourceId            | displayName                                           | kcal | protein | carbs | fat   |
| ------------------- | ----------------------------------------------------- | ---- | ------- | ----- | ----- |
| `W411300`           | Schwein Bauchspeck, Rohpökelware, geräuchert          | 304  | 16.58   | 0.492 | 26.22 |
| `W411332`           | Schwein Bauchspeck, Rohpökelware, geräuchert, gekocht | 305  | 19.81   | 0.581 | 24.86 |
| `W415000`           | Schwein Frühstücksspeck, Rohpökelware, geräuchert     | 304  | 16.58   | 0.492 | 26.22 |
| `W415000`/`W415072` | …, gegrillt                                           | 337  | 19.12   | 0.561 | 28.69 |
| `W415082`           | …, gebraten ohne Fett (Pfanne)                        | 310  | 18.73   | 0.573 | 25.91 |
| `W415062`           | …, gebraten ohne Fett (Ofen)                          | 306  | 19.15   | 0.58  | 25.28 |
| `W415032`           | …, gekocht                                            | 287  | 18.6    | 0.546 | 23.34 |

This is what German consumers most commonly mean by "Speck" in a meal context (pasta, salads,
Bauernfrühstück, breakfast) — bacon/streaky belly bacon.

### Cluster 3 — "Schinkenspeck" (a leaner, ham-like product — a third, different meaning)

| sourceId                                | displayName                                     | kcal    | protein   | carbs  | fat     |
| --------------------------------------- | ----------------------------------------------- | ------- | --------- | ------ | ------- |
| `U685100`                               | Schwein Hüfte/Schinkenspeck, roh                | 127     | 22.28     | 0      | 4.23    |
| `W410400`                               | Schwein Schinkenspeck, Rohpökelware, geräuchert | 121     | 20.82     | 0.492  | 3.95    |
| `U685142`/`U685162`/`U576162`/`W410482` | various cooked/grilled Schinkenspeck            | 131–167 | 22.6–30.0 | 0–0.58 | 3.9–5.2 |

Nutritionally this is much closer to lean ham/turkey than to bacon or fatback — a **third**,
materially different everyday meaning of "Speck" (sliced deli meat, not a fried/rendered product).

### Magnitude of the ambiguity

Across the three clusters, per-100 g values span **121–746 kcal (≈6.2×)**, **4.1–22.3 g protein
(≈5.4×)**, and **3.9–80.9 g fat (≈20.7×)**. This is a materially larger nutrient swing than the
RESOLVER-V2-008 diagnosis quoted (fatback ~660–746 vs. bacon ~304, ≈2.4×) — the Schinkenspeck
cluster was not previously enumerated.

### Explicit English probe

`"bacon"` was searched to check whether English-loanword phrasing helps: it resolves to
`X6A3000` „Kartoffelsouffle mit Bacon" (a potato soufflé **dish**, 174 kcal) — there is **no
standalone "Bacon" product record in BLS at all** (expected: BLS is a German nutrition database).
This is a **wrong-variant defect of the same class as Himbeeren/Haferflocken** (RESOLVER-V2-009),
not ambiguity — it is out of this task's exact scope (which is "Speck") but is flagged here as a
related, separately-actionable finding (see §13, out of scope).

---

## 2. Why `W412000` currently wins bare „speck" (proven, reproducible)

The normalized query `"speck"` has length 5, so `BlsLookupEngine.search()`'s Stage 2
single-long-token guard (`normalizedInput.length > 6`) does **not** apply (5 is not > 6) — this
is why RESOLVER-V2-009's Stage-2 fix (whitespace-insensitive matching / token-over-includes) left
"speck" **byte-for-byte unchanged**, exactly as that task's regression test asserts. The query
falls through Stage 3 (not applicable, single token) straight to **Stage 4** —
`findTokenMatches()`, the original, un-ranked `calculateTokenScore` logic:

- `"speck"` is an exact **token** for the pure-fatback records (`Speck` appears as its own word in
  `Schwein Speck…`) → `matchedTokens = 1/1` → **score 1.0**.
- `"speck"` is only a **substring** of the compound single words `Bauchspeck`/`Frühstücksspeck`
  (`"bauchspeck".includes("speck") === true` but `"bauchspeck" !== "speck"`) → partial-match
  credit (`0.8`) per `calculateTokenScore`'s `includes` branch → **score 0.8**.
- `Schinkenspeck` scores similarly (`0.8`, substring only) but is additionally 4 records deep and
  gets truncated by `findTokenMatches`'s `.slice(0, 3)` top-3 cutoff, so it never even reaches the
  candidate list for bare "speck".

`findTokenMatches` returns the top 3 by score: `[U605700(1.0), W412000(1.0), W411000(1.0)]` — this
exact array is what RESOLVER-V2-009's regression test locks as "Speck unchanged". Downstream,
`ScoreCalculator` (per-source-agnostic scoring: match/dataQuality/kcalConsistency/sourceTrust +
a semantic-class multiplier) computes **`finalScore = 1.0000`** for all three (verified by direct
inspection — see §3), so `W412000` wins only by the final tie-break rule inside
`ResolverDecisionPolicy.sortResolvedCandidates` (`a.id.localeCompare(b.id)` — alphabetically
`U605700` < `W412000`... actually the observed winner is `W412000`, meaning the true tie-break
path runs through equal scores at every prior comparator down to `id.localeCompare`, and `W412000`
happens to sort ahead of `U605700` for reasons not further decomposed here since it does not
change the conclusion). **The specific fatback record that wins among the three near-identical
fatback candidates is incidental; the root issue is that the entire candidate set the resolver
ever sees for bare "speck" is drawn from one nutrient cluster (fatback) only** — the bacon-style
(`W411300`/`W415000`) and Schinkenspeck-style records are never in the top-3 candidate set for the
bare query at all, so no ranking rule downstream could ever have selected them.

**Classification: ambiguity, not a source-data or ranking defect within the fatback cluster.** All
three top candidates are legitimate, correctly-valued BLS "Speck" records. The defect-shaped part
— that the bacon-style records don't even reach the candidate set — is a genuine **retrieval
limitation** (Stage-4's un-ranked `calculateTokenScore`/`.slice(0,3)` has no concept of "distinct
semantic cluster diversity"), but fixing _that_ alone (e.g. widening the candidate set or raising
the slice limit) would not resolve the ambiguity — it would just add more legitimately-scored
candidates for the same underlying problem: **no signal in the input distinguishes which of three
materially different products the user means.**

---

## 3. Answers to the evidence questions (ROADMAP prompt §1–12)

**1. Does BLS contain a true generic/default "Speck" record?**
No. All 15 pork-Speck records enumerated in §1 carry an explicit cut and/or preparation qualifier
(`Rückenspeck`, `Bauchspeck`, `Frühstücksspeck`, `Schinkenspeck`, `roh`, `geräuchert`, `gekocht`,
`gebraten`, `gegrillt`). There is no unqualified "Speck" entry to fall back to.

**2. Are the plausible candidates different cuts, fat proportions, preparation states, or
genuinely interchangeable?**
Different **cuts** (back fat vs. belly vs. hip/ham) with materially different fat/protein
composition (§1) — not interchangeable. Within Cluster 2, the preparation-state variants
(raw-smoked / gekocht / gebraten / gegrillt) ARE reasonably close to each other (287–337 kcal) and
could be treated as one "bacon-family" concept for a coarse clarification choice; Clusters 1 and 3
cannot be merged with anything.

**3. Is one candidate clearly the ordinary unqualified meaning based on existing authoritative
data?**
No single BLS record is marked as "the" ordinary meaning — nothing in the artifact expresses that.
Common-knowledge intuition (bacon is the everyday meaning) is **not** proof per the diagnosis's own
constraint ("common nutrition knowledge was used only to flag candidates for tracing, never as
proof"), and this plan does not treat it as proof either — see §7 (why a deterministic default is
rejected).

**4. Does the current resolver lose relevant qualifiers?**
No — qualified single-word queries (`bauchspeck`, `fruehstuecksspeck`) already resolve
deterministically and correctly (§4). The qualifier is only "lost" in the sense that **bare
"Speck" carries no qualifier to begin with** — nothing is stripped by the resolver.

**5. Is the ambiguity caused by taxonomy, broad aliases, near-equal scores, a missing generic
record, or unavoidable natural-language ambiguity?**
A combination: (a) **no generic record exists** (Q1), and (b) the underlying natural-language term
genuinely maps to three distinct German butchery/retail concepts. This is **not** a broad-alias or
taxonomy defect — the aliases correctly reflect each record's real identity.

**6. How large are the nutrient differences?**
Up to **6.2× kcal**, **20.7× fat**, **5.4× protein** across the three clusters (§1).

**7. Would choosing the wrong variant materially distort a normal food log?**
Yes. `100 g Speck` logged as fatback (746 kcal) vs. bacon (304 kcal) vs. Schinkenspeck (121 kcal)
is a swing of up to **625 kcal** for a single food-log line — large enough to meaningfully change
a daily calorie total.

**8. Can the current resolver result contract express ambiguity / clarification / multiple
candidates / unresolved state?**
**Yes, already.** `ResolverDecision.status: 'accepted' | 'ambiguous' | 'rejected'` exists today
(`domain/models/ResolverDecision.ts`), and `ResolverDecisionPolicy.buildResolverDecision`
**already computes `status: 'ambiguous'` with `reasonCodes: ['MULTIPLE_CLOSE_MATCHES']` for bare
"speck" right now** — verified directly: all three candidates tie at `finalScore = 1.0000`
(`scoreDelta = 0 < DELTA_THRESHOLD(0.08)`), so the generic ambiguous-detection rule already fires.
`decision.candidates` also already carries the full top-N list (not just `best`).

**9. Does the current UI have a safe clarification path?**
Not for this resolver-level signal. `JournalScreen.tsx` has an existing, structurally-similar
pattern — `portionNeedsEditItems`, a per-item block with a short prompt and **two** `PrimaryButton`
choices ("60g pro Stück verwenden" / "Gramm eingeben") — that is the closest existing precedent for
a compact 2–4-choice clarification row, but it exists for a different signal (missing portion
weight), not for resolver ambiguity. J-007's "Nicht erkannte Einträge" section is populated at the
**parser/matchFood layer** (`dispatch.unresolvedRequests`, before the resolver ever runs) —
"Speck" never reaches that path today because it matches fine at that early stage and only becomes
ambiguous once BLS is queried. Reusing that exact section for a Speck-style outcome would require
a **new** signal threaded from the resolver decision back up through
`resolvePreparedNutritionInputs`/`logResolvedNutritionInput` (§10).

**10. Can clarification be added without building a full candidate-picker system?**
**Yes.** Because qualified single-word terms already resolve deterministically and correctly
today (Q4), a clarification UI does not need to expose raw resolver candidates at all — it can
show 2–3 plain-German buttons that, on tap, **re-dispatch the already-working qualified query**
(e.g. tapping "Bacon" effectively resubmits `Bauchspeck`/`Frühstücksspeck`). No new
candidate-ranking UI, no BLS code exposed to the screen.

**11. Should explicit inputs like "100 g Bauchspeck" remain deterministic even if bare "Speck" is
ambiguous?**
Yes — and this is **already true today** (§4) and must not regress. This is the central
calibration risk identified in §7/§12: naively reusing the _existing_ generic
`decision.status === 'ambiguous'` signal for a persist-gate would **also** flag "Bauchspeck" and
"Frühstücksspeck" as ambiguous (see §5) — so a fix must not just "listen to the existing status"
without a narrower check.

**12. Should previously logged "Speck" entries remain unchanged after a future behavior change?**
Yes — journal entries are immutable historical records (Product Bible / existing J-013 contract);
any future Act task must not touch persisted entries, only future resolutions. See §12.

---

## 4. Qualified single-word terms already resolve deterministically (evidence)

| Query                                   | Resolver path                                                                      | Result                                                   | kcal    |
| --------------------------------------- | ---------------------------------------------------------------------------------- | -------------------------------------------------------- | ------- |
| `bauchspeck`                            | Stage-2 `TOKEN_OVER_INCLUDES` (RESOLVER-V2-009 override; token 0.8 > includes 0.7) | `W411300` „Schwein Bauchspeck, Rohpökelware, geräuchert" | **304** |
| `fruehstuecksspeck` / `frühstücksspeck` | same override                                                                      | `W415072` „…, geräuchert, gegrillt" (see §5 caveat)      | **337** |

Both resolve to a legitimate Cluster-2 (bacon-style) record with a real, plausible kcal value —
**no defect for qualified single-word input.**

### Multi-word German qualifier phrases do **not** resolve at all (critical UX constraint)

Every descriptive adjective+noun phrasing tested — the exact kind of phrase a naive clarification
message might suggest the user type — returns **zero candidates** (Stage-3 multi-token compound
guard rejects them outright, logging `COMPOUND_GUARD: Rejecting unknown multi-token compound`):

| Query                                        | Result           |
| -------------------------------------------- | ---------------- |
| `geräucherter Speck` / `geraeucherter speck` | **0 candidates** |
| `roher Speck`                                | **0 candidates** |
| `magerer Speck`                              | **0 candidates** |
| `gebratener Speck`                           | **0 candidates** |
| `durchwachsener Speck`                       | **0 candidates** |

**Consequence for UX design (§8):** any clarification wording must **not** ask the user to type a
more descriptive phrase ("Beschreibe ihn genauer, zum Beispiel als 'geräucherter Speck'") — the
resolver cannot parse that today and the user would hit a dead end. Clarification must offer
**tappable single-word choices** (Bauchspeck / Frühstücksspeck / Speck-roh-style labels mapped to
plain German), not free-text re-entry with descriptive examples.

---

## 5. Why the _existing_ generic ambiguous-status signal is unsafe to wire up as-is

Direct measurement of `decision.status` for the qualified terms that must stay deterministic:

| Query                    | `decision.status` | `reasonCodes`            | Candidates (finalScore)                                                                     |
| ------------------------ | ----------------- | ------------------------ | ------------------------------------------------------------------------------------------- |
| `speck`                  | `ambiguous`       | `MULTIPLE_CLOSE_MATCHES` | `W412000`(1.0000) / `U605700`(1.0000) / `W411000`(1.0000)                                   |
| `bauchspeck`             | **`ambiguous`**   | `MULTIPLE_CLOSE_MATCHES` | `W411300`(1.0000) / `X928112`„Zwiebelkuchen **ohne** Speck"(**0.9715**) / `X359440`(0.4518) |
| `fruehstuecksspeck`      | **`ambiguous`**   | `MULTIPLE_CLOSE_MATCHES` | `W415072`(1.0000) / `W415000`(1.0000) / `X359440`(0.4518)                                   |
| `magerquark` (control)   | `accepted`        | `ACCEPTED_STRONG_MATCH`  | single candidate, 1.0000                                                                    |
| `haferflocken` (control) | `accepted`        | `ACCEPTED_STRONG_MATCH`  | `C133000`(1.0000) / `C133032`(0.8929) — delta 0.107 ≥ 0.08                                  |

**This is decisive evidence against a blanket fix.** `bauchspeck`'s runner-up is `X928112`
„Zwiebelkuchen **ohne** Speck" (onion cake **without** bacon!) at `0.9715` — within
`DELTA_THRESHOLD (0.08)` of the correct answer purely because `ScoreCalculator`'s semantic-class
boost for "plain_raw"/"simple_generic" candidates and token-overlap scoring produce a near-tie
against an unrelated dish. `fruehstuecksspeck`'s two 1.0000-scored candidates are actually **both
legitimate same-family variants** (raw-smoked vs. grilled) — a tie here is not a real ambiguity in
the product sense, just two acceptable preparation states of the one food the user asked for.

**Conclusion:** `ResolverDecisionPolicy`'s `DELTA_THRESHOLD = 0.08` is calibrated for a different,
general purpose and demonstrably misfires — with real data, not speculation — on exactly the
qualified terms that RESOLVER-V2-010 must keep deterministic. Reusing it as-is for a persist-gate
would be a regression. Recalibrating it generically is explicitly out of scope for a first Act task
(see the ROADMAP prompt's "do not invent thresholds casually" constraint) — this pushes the
recommendation toward a **narrowly-scoped, evidence-backed mechanism specific to bare "Speck"**
rather than a blanket consumption of the existing generic signal (§9).

---

## 6. The ambiguous signal is computed but never consumed (dead-signal finding)

`LogFoodFromRawInputUseCase` (the code path that actually persists a resolved food) reads:

```ts
const decision = await this.resolver.resolve(...);
const resolved = decision.best;
if (resolved && resolved.score >= 0.7) {
  // ... persists resolved.food unconditionally, saves an alias cache entry, returns success
}
```

`decision.status` is **never read** on this path (it is only referenced, for an unrelated
`'ambiguous'` value of a _different_ type, in `EditFoodEntryFromNaturalLanguageUseCase`'s J-013
edit-decision — not the resolver's `ResolverDecision`). The gate is purely
`resolved.score >= 0.7`, and `W412000`'s `finalScore` is `1.0`, so it passes silently despite
`decision.status === 'ambiguous'` already being true. **The architecture already detects this case
correctly; the persistence layer simply ignores the detection.**

### Compounding risk: alias caching locks in the wrong answer

On the same accepted path, `LogFoodFromRawInputUseCase` calls
`this.aliasRepository.saveAlias(aliasKey, resolved.food.id)` — so the **first** time a user logs
"Speck", `W412000` is cached as the alias for that exact text. Every subsequent "Speck" query then
hits the **alias-cache path** (`aliasRepository.getCanonicalId`, checked _before_ the resolver
even runs — see `LogFoodFromRawInputUseCase` Step 2) and never re-enters the resolver/decision
logic at all. **Any future fix must not alias-cache an ambiguous/clarification-pending
resolution**, or the fix will only ever apply on a user's very first "Speck" log.

---

## 7. Decision matrix

| Option                                                                        | Evidence support                                                                                                                                                                                                                           | Risk                                                                                                                                                                                                                                                                                                                                        | Verdict                                                                                                                                                                                          |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **A. Deterministic generic default** (pick one canonical variant, e.g. bacon) | No BLS-owned signal marks any cluster as "the" default (§3 Q1/Q3); would just move the ambiguity risk from over- to under-counting with the same "confidently wrong" failure mode the diagnosis already flagged for the _current_ behavior | Silently wrong ~⅓–⅔ of the time depending on true user intent distribution (unmeasured); violates "do not silently choose... merely because it ranks first" — applies equally to a hand-picked new winner                                                                                                                                   | **Rejected** as MVP default. Could be revisited only with real usage-distribution evidence this repo does not have.                                                                              |
| **B. Clarification before saving**                                            | 2–3 real, already-distinctly-resolvable clusters (§1/§4); existing UI precedent (`portionNeedsEditItems`, §3 Q9); choices can reuse the already-deterministic qualified-term resolver path (§3 Q10) — no candidate-picker needed           | Must curate the 2–3 choices from the _classified clusters_ in this plan, not mechanically from the raw top-3 candidate list (which for bare "speck" is fatback-only, §2) — a UI-only read of "existing candidate traces" would be insufficient on its own                                                                                   | **Recommended primary direction.**                                                                                                                                                               |
| **C. Honest unresolved result**                                               | Reuses J-007's truthful-partial-success framing; safe default when the user does not want to choose right now                                                                                                                              | On its own (no choices shown), lower value than B given the concrete candidates/macros are already known; the ROADMAP-suggested wording ("z. B. als Bauchspeck oder Frühstücksspeck") is only accurate if those exact examples are typed _exactly_ — descriptive multi-word phrasing fails (§4), and prose examples give no calorie context | **Recommended as the fallback state of B** (user cancels/dismisses without choosing → nothing saved, same "not shown as saved" contract as an unresolved item), not as a standalone alternative. |
| **D. Context-dependent deterministic behavior**                               | Already true today for qualified terms (§4)                                                                                                                                                                                                | None — this is a "don't break it" requirement, not new work                                                                                                                                                                                                                                                                                 | **Not a new option** — folded into B/E as an explicit non-regression requirement (Q11).                                                                                                          |

**MVP recommendation: B, with C as its no-selection fallback.** A is rejected for lack of a
product-owned "correct default" signal; a pure-C-only design under-uses evidence we already have.

---

## 8. Clarification UX design (smallest safe flow)

**Where it appears:** inline, directly below the input area — the same position `JournalScreen`
already uses for `portionNeedsEditItems` (structurally the closest existing precedent), not a
modal/full-screen picker.

**Choices (plain German, no BLS codes, no raw catalog strings):**

1. „**Bacon / durchwachsener Speck**" — routes to the Cluster-2 bacon-style value (re-dispatches
   the already-deterministic `Bauchspeck`/`Frühstücksspeck` query internally). _(proposed wording,
   awaiting approval)_
2. „**Speck zum Auslassen (reines Fett)**" — routes to the Cluster-1 fatback value (the current
   default becomes an explicit, opt-in choice instead of a silent one). _(proposed, awaiting
   approval)_
3. „**Magerer Schinkenspeck**" — routes to the Cluster-3 lean ham-style value, only if product
   decides three choices are not too many (see open question in §14). _(proposed, awaiting
   approval)_

Each choice shows its kcal (and ideally macros) **before** selection, e.g. „Bacon / durchwachsener
Speck · ca. 304 kcal/100 g" — directly satisfying "calories/macros shown before selection" and
"user must understand why more detail is needed" without exposing BLS internals.

**Flow properties (per the ROADMAP's clarification-UX checklist):**

- The original input ("100 g Speck") remains visible above the choices.
- **Nothing is saved** until a choice is made — same "not shown as saved" contract as an
  unresolved/blocked item today.
- The user can dismiss/cancel; on cancel, the item behaves exactly like today's
  "Nicht erkannte Einträge" unresolved state (Option C fallback) — available for later correction,
  never silently dropped.
- The explicit quantity ("100 g") is preserved and reused verbatim against whichever variant is
  chosen — no re-parsing of the original quantity.
- Selecting a variant **reuses the original quantity** and re-enters the _existing_, already-tested
  qualified-term resolver path (no new resolution logic — see §9).
- Accessibility label states the question, the available choices, and their kcal (mirrors the
  existing `portionNeedsEditItems` row pattern already in `JournalScreen.tsx`).
- **Multi-food input** (`"2 Eier und 100 g Speck"`): the non-ambiguous item(s) persist normally
  (J-007 partial-success, unchanged); the ambiguous "Speck" item surfaces its own clarification
  row, independent of the others — exactly mirroring how `portionNeedsEditItems` already coexists
  with persisted entries and `unresolvedItems` in a single submission today.
- **Several ambiguous items in one submission:** each gets its own clarification row (same
  pattern as multiple `portionNeedsEditItems` rows today) — no new multi-item architecture needed.
- **An unknown item plus an ambiguous Speck item:** the unknown item stays in "Nicht erkannte
  Einträge" (unchanged J-007 behavior); the ambiguous item gets its own clarification row — the
  two mechanisms coexist without conflict, matching existing multi-section rendering.

---

## 9. Architecture analysis

Evaluating the five options from the ROADMAP prompt against the evidence in §5–§7:

- **A. Food-specific ambiguity policy for "Speck".** ✅ **Recommended for the first Act task.**
  Given §5's proof that the _generic_ score-delta signal already misfires on Bauchspeck/
  Frühstücksspeck, a narrowly-scoped check (e.g. "the normalized query, after alias/canonical
  matching, is exactly the bare, unqualified head noun of a **known multi-cluster** BLS food
  family" — a small, explicit, product-owned list starting with `{'speck'}`) is the smallest
  change that does not require inventing or recalibrating a generic threshold. It sits at the
  use-case layer (`LogFoodFromRawInputUseCase` or a small new pure helper it calls), not inside
  `BlsLookupEngine`/`ResolverDecisionPolicy` — so RESOLVER-V2-009's proven, tested behavior is
  untouched.
- **B. Generic ambiguity result when candidates are "sufficiently close".** ❌ Not for the first
  Act task — §5 proves the existing `DELTA_THRESHOLD` is not safe to reuse without recalibration,
  and recalibrating a generic threshold from a single food's evidence is exactly the
  "do not invent thresholds casually" risk the ROADMAP prompt warns against. Could be revisited
  later with evidence from several more ambiguous foods.
- **C. A resolver-layer candidate result reused by future foods.** Interesting longer-term
  direction (a dedicated `ambiguous_generic` reason code + curated cluster metadata reusable
  beyond Speck) but carries the same calibration risk as B for _detecting_ the condition — defer;
  the _result shape_ (`ResolverDecision.status = 'ambiguous'` already exists) can be reused even
  though the _detection_ stays food-specific for now.
- **D. UI-only clarification built from existing candidate traces.** ❌ Insufficient alone — §2
  proves the raw top-3 candidate trace for bare "speck" is fatback-only; a UI that merely displays
  "whatever the resolver already returned" would never surface the bacon-style choice at all. The
  choice set must be product-curated from the classified clusters in §1, not mechanically derived.
- **E. Honest unresolved behavior using current contracts, no candidate UI.** ✅ Valid as the
  **fallback state** of Option B (§7/§8), not as the sole behavior — reuses the existing
  unresolved-item contract shape, but as discussed in §3 Q9, needs a new signal path from the
  resolver into `dispatch`-level "unresolved" (see §10) regardless of whether a candidate UI is
  ever shown.

**Recommended architecture: A + reuse of E's contract shape for the no-selection fallback,
composed into B's UX.** No broad generic ambiguity framework is proposed for the first Act task.

---

## 10. Exact architecture impact (for a later Act task)

- **New, narrow detection point** — smallest option: a small pure helper (e.g.
  `src/features/nutrition/domain/catalog/ambiguousGenericFoods.ts` or similar) exporting a
  product-owned list/lookup of query→cluster-choice-set, starting with exactly `{'speck': [...]}`
  (no broader alias/mapping table). Consulted by `LogFoodFromRawInputUseCase` **before** the
  `resolved.score >= 0.7` accept-gate, for the BLS source specifically.
- **`LogFoodFromRawInputUseCase.ts`** — when the ambiguous-food check matches, do **not** persist
  and do **not** call `aliasRepository.saveAlias` (closing the §6 alias-cache risk); instead return
  a new outcome shape carrying the candidate choice set (label + kcal/macros + the qualified query
  to re-dispatch on selection) instead of `canonicalFood`.
- **`prepareNutritionResolverDispatch.ts` / `resolvePreparedNutritionInputs.ts` /
  `logResolvedNutritionInput.ts`** — thread the new "needs disambiguation" outcome alongside the
  existing `unresolvedRequests`/`needsEditItems` fields (mirroring the existing
  `PortionNeedsEditItem` pattern architecturally, per §3 Q9) so `JournalScreen.tsx` can render it.
- **`JournalScreen.tsx`** — a new clarification section, structurally modeled on
  `portionNeedsEditItems` (§8); selecting a choice re-submits the original quantity against the
  chosen qualified query through the **existing, unchanged** resolver path.
- **No changes** to `BlsLookupEngine.ts`, `BlsCompactRuntimeAdapter.ts`, the BLS artifact,
  `ResolverDecisionPolicy.ts`'s thresholds, or source priority.

---

## 11. Verification performed for this plan

- All evidence in §1–§6 was produced by two throwaway diagnostic Jest test files
  (`src/features/nutrition/__tests__/_speck_diagnostic_temp*.diagnostic.test.ts`), run via
  `npx jest --config jest.config.js <file>`, then **deleted**. `git status --short` is empty
  before this document/ROADMAP update was written — no product or test file changed.
- No `npm run verify` product-affecting run was needed (no code changed); the diagnostic runs
  themselves passed (trivial `expect(true).toBe(true)`/assertions used only to force console
  output, not to test behavior).
- This document, the ROADMAP.md update, and `docs/MANUAL_TESTING_GAPS.md` (no entry needed — no
  UI/product change in this task) are the only changes on this branch.

---

## 12. Backward compatibility for existing "Speck" entries

Any future Act task must **not** touch previously persisted `FoodEntry` records. A behavior change
only affects **future** resolutions of the bare word "Speck" — existing entries (already carrying
their own frozen `nutritionSnapshot`/`foodCatalogRef` per the existing persistence contract used
throughout J-005/J-009/SM-002) remain exactly as logged, editable only through the existing J-013
edit flow like any other entry.

---

## 13. Risks

- **Over-generalizing from one food.** Mitigated by recommending a narrowly-scoped, explicit
  per-food list (Option A) rather than a generic threshold change (§9).
- **Excessive user friction.** Mitigated by capping choices at 2–3, showing kcal upfront, and
  reusing an existing lightweight interaction pattern (§8) rather than a new picker screen.
- **Candidate-list complexity.** Avoided — the UI never shows raw BLS candidates/codes (§8).
- **False deterministic confidence.** This is the exact defect being fixed — the plan's whole
  point is to stop the silent 746-kcal default.
- **Unstable score-gap rules.** Directly evidenced and avoided — §5 proves why the _existing_
  generic threshold cannot be reused as-is; no new generic threshold is proposed either.
- **Source-taxonomy leakage.** Mitigated — proposed choice labels (§8) are plain German consumer
  terms, not BLS cut/prep taxonomy strings.
- **Breaking multi-food partial success.** Mitigated by design — §8 explicitly specifies the
  ambiguous item coexists with persisted/unresolved items in the same submission, following the
  existing `portionNeedsEditItems`/`unresolvedItems` coexistence pattern already proven in J-007.
- **The related "Bacon" wrong-variant finding (§1)** could be mistaken for part of this decision —
  it is explicitly **not**; it is a RESOLVER-V2-009-class retrieval defect (plain generic
  unreachable, a dish wins instead) and would need its own diagnosis/task if pursued.

---

## 14. Smallest implementation sequence (for a later Act task)

1. Add the narrow per-food ambiguous-cluster lookup (§10) with the 2–3 curated Speck choices,
   their labels/macros, and the qualified query each re-dispatches to.
2. Wire `LogFoodFromRawInputUseCase` to check it before the accept-gate for BLS-sourced bare
   "speck", short-circuiting to a new "needs disambiguation" outcome (no persist, no alias-cache
   write).
3. Thread the new outcome through `resolvePreparedNutritionInputs`/`logResolvedNutritionInput`
   alongside the existing `needsEditItems`/`unresolvedRequests` fields.
4. Render a new `JournalScreen.tsx` section modeled on `portionNeedsEditItems` (§8); selection
   re-submits the original quantity against the chosen qualified query through the existing
   resolver path (no new resolution logic).
5. Tests (§15). `npm run verify`. Native/live verification of the exact wording and interaction.
6. Update ROADMAP.md + `docs/MANUAL_TESTING_GAPS.md` in the Act task, per the standard flow.

**Open product question before an Act task can start (must be resolved by the user, not assumed
here):** exactly 2 choices (bacon-style vs. fatback) or 3 (adding the lean Schinkenspeck cluster)?
Two is simpler; three is more complete given the evidence in §1 shows Schinkenspeck is a real,
materially different, commonly-eaten "Speck" meaning. This plan does not decide it — see §16.

---

## 15. Exact test plan (for a later Act task)

- **Parser tests:** `"100 g Speck"`/`"Speck"` still parse into a single ready request with
  `quantity: 100`/`null`, `unit: 'g'`/`null`, `foodName: 'speck'` — unchanged (parsing is not
  touched by this plan).
- **Resolver tests:** no `BlsLookupEngine`/`ResolverDecisionPolicy` changes proposed, so no new
  resolver-level tests are required by this plan; existing RESOLVER-V2-009 regression tests
  (`BlsPlainGenericReachability.test.ts`) must stay green, asserting `speck` candidates/best are
  still exactly `[U605700, W412000, W411000]` / `W412000` **at the BLS/resolver layer** (the Act
  task intercepts _above_ this layer, in the use-case, so this data must remain unchanged).
- **Use-case tests (`LogFoodFromRawInputUseCase`):** bare `"speck"` → new "needs disambiguation"
  outcome, no `canonicalFood`, no alias-cache write (`aliasRepository.saveAlias` not called);
  `"bauchspeck"`/`"fruehstuecksspeck"` → unchanged deterministic accept (regression, directly
  testing the §5/§11 non-regression requirement); a non-Speck ambiguous BLS result (if any
  existing case triggers `status: 'ambiguous'` elsewhere) is unaffected (the check is scoped to the
  explicit per-food list, not a generic status read).
- **Partial-success tests:** `"2 Eier und 100 g Speck"` → Eier persists normally, Speck surfaces
  the new disambiguation outcome, matching the existing J-007 multi-item coexistence tests'
  pattern.
- **Screen tests:** none possible in this headless environment (no RN render harness, per every
  prior J-_/GE-_ task in this repo) — document via `docs/MANUAL_TESTING_GAPS.md` in the Act task.
- **Accessibility tests:** same headless-environment limitation; document the required label
  content (choice + kcal + selection action) for native verification, mirroring the
  `portionNeedsEditItems` precedent.
- **Persistence regression tests:** an existing (pre-change) `FoodEntry` with `foodCatalogRef`
  pointing at `W412000` (a historical "Speck" log) is read/displayed/edited exactly as today — no
  migration, no re-resolution of historical data.

---

## 16. Explicit approval status for every new string

| String                                                                                       | Status                                                            |
| -------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| „Bacon / durchwachsener Speck"                                                               | **Proposed, awaiting approval**                                   |
| „ca. N kcal/100 g" (per-choice calorie preview)                                              | **Proposed, awaiting approval**                                   |
| „Speck zum Auslassen (reines Fett)"                                                          | **Proposed, awaiting approval**                                   |
| „Magerer Schinkenspeck"                                                                      | **Proposed, awaiting approval** — contingent on the 2-vs-3-choice |
| decision (§14)                                                                               |
| Any clarification question header (e.g. „Welche Art von Speck meinst du?")                   | \*\*Proposed,                                                     |
| awaiting approval\*\* — the ROADMAP prompt's own suggested wording, not yet product-accepted |

| „Speck ist nicht eindeutig. Beschreibe ihn genauer, zum Beispiel als Bauchspeck oder
Frühstücksspeck." (Option-C-only wording) | **Proposed, but flagged as risky** — §4 shows
descriptive multi-word examples like "geräucherter Speck" fail to resolve; if this fallback
wording is used at all, the examples must be exactly `Bauchspeck`/`Frühstücksspeck` (proven to
resolve), not a freely-invented descriptive phrase |

No string in this plan is "existing/accepted" — everything is net-new proposed copy pending
product approval in a later Act task.

---

## 17. Out of scope (this planning task, and reaffirmed for any Act task it spawns)

- Changing nutrient values, BLS artifacts, or source priority.
- Broad fuzzy-search redesign, AI-based food selection, a corrections-learning database.
- RESOLVER-V2-005/RESOLVER-V2-006.
- Barcode products, recipe parsing, a general candidate-picker product.
- The "Bacon" wrong-variant finding (§1) — related evidence surfaced while probing requested
  variant terms, but a RESOLVER-V2-009-class retrieval defect, not part of this ambiguity
  decision; would need its own diagnosis/task.
- Journal grouping (J-009/J-012), Saved Meals (SM-008), J-014 confirmation UX, evaluation logic
  (GE-\*), account/sync architecture (ACC-001) — untouched.
- Recalibrating `ResolverDecisionPolicy`'s generic `DELTA_THRESHOLD`/`AMBIGUOUS_THRESHOLD` (§5/§9).
- Unrelated cleanup.

---

## 18. Summary for the ROADMAP entry

- **Root cause classification:** genuine natural-language/product ambiguity (three materially
  distinct BLS "Speck" clusters, up to 6.2× kcal apart), **not** a source-data or ranking defect —
  confirming and quantitatively extending RESOLVER-V2-008's original verdict.
- **Key new finding:** the resolver-level contract (`ResolverDecision.status`) already correctly
  detects this as `'ambiguous'`, but the persistence layer (`LogFoodFromRawInputUseCase`) ignores
  the signal entirely and gates only on a numeric score — a dead-signal architecture gap, not a
  missing capability.
- **Key risk finding:** the existing generic ambiguous-detection threshold cannot be reused as-is
  — it already misfires (with real data) on the qualified terms ("Bauchspeck"/"Frühstücksspeck")
  that must stay deterministic.
- **Recommended MVP:** Option B (concise 2–3-choice clarification, calories shown, reusing the
  already-deterministic qualified-term resolver path per choice), falling back to Option C's
  honest-unresolved contract when the user does not choose. Architecture: a narrowly-scoped,
  food-specific check (Option A) — no generic ambiguity framework yet.
- **Status:** planning complete; **no code implemented**. A later RESOLVER-V2-010 **Act** task
  (same task ID, per this repo's Plan→Act convention already used for GE-010) is ready to start
  once the user approves the wording in §16 and the 2-vs-3-choice question in §14.
