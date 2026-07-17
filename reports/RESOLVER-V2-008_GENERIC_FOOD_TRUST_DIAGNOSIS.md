# RESOLVER-V2-008 — Generic-Food Resolver Trust Diagnosis (review-only)

- **Date:** 2026-07-17
- **Mode:** review-only technical diagnosis — **no product code, aliases, rankings, source
  order, nutrition values, schema or migrations changed**
- **Branch:** `claude/resolver-v2-008-generic-trust-diagnosis`
- **Origin:** native Android dogfooding 2026-07-17,
  [`reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md`](NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md)
  Finding 2 / ROADMAP RESOLVER-V2-008.
- **Verification category:** VERIFY.md **Category 1** (documentation-only).

## 0. Method (reproducible, evidence-based)

The four native inputs were traced against the **committed** BLS runtime artifact
(`src/features/nutrition/infrastructure/catalog/sources/bls/generated/bls-runtime-compact.v1.json`)
through the real lookup path — `blsGenericFoods.searchBlsGenericFoods()` →
`BlsLookupEngine.search()` → `adaptBlsCompactRuntimeRecord()` — via a throwaway diagnostic
test that dumped, per query: the candidate set, each candidate's `sourceId`, `displayName`,
`matchKind`/similarity, and per-100 g macros, plus every artifact record whose displayName or
aliases contain the food stem. The harness was **deleted** after tracing (it is not part of
this PR). BLS is the winning source for all four inputs: each native kcal value maps **exactly**
to a specific committed BLS record (see the trace table), which OFF/USDA could not coincidentally
reproduce, and BLS is prioritized ahead of OFF/USDA in `resolverSources`
(`SequentialFoodCatalogResolver`).

The resolver query is the raw lowercased food name (`buildNutritionResolverInputs`:
`normalized: request.query`; `buildResolverFoodRequests`: `rawName: item.name.toLowerCase()`),
so `100 g Himbeeren → "himbeeren"`, `100 g Haferflocken → "haferflocken"`, `100 g Speck →
"speck"`, `100 g Magerquark → "magerquark"` — the plural/compact form is preserved into BLS.

## 1. Verdict per input

| Input          | Selected BLS record                                            | sourceId  | kcal/100 g | Match            | Verdict                                                                                                         |
| -------------- | -------------------------------------------------------------- | --------- | ---------- | ---------------- | --------------------------------------------------------------------------------------------------------------- |
| `Himbeeren`    | „Nussbiskuitrolle/Nussbiskuitroulade, mit Himbeeren und Sahne" | `D3A4000` | **275**    | `includes` (0.7) | **Wrong variant** — a dessert; the plain „Himbeere roh" (43) was never in the candidate set                     |
| `Haferflocken` | „Milchsuppe gesüßt, gebunden mit Haferflocken"                 | `X475243` | **102**    | `includes` (0.7) | **Wrong variant** — a milk soup; the plain „Hafer Flocken" (348) was never in the candidate set                 |
| `Speck`        | „Schwein Speck/Rückenspeck (grüner Speck) roh"                 | `W412000` | **746**    | `token` (1.0)    | **Ambiguity** — a legitimate BLS „Speck" (raw back fat), but not the commonly-intended bacon; no disambiguation |
| `Magerquark`   | „Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr."        | `M713100` | **66**     | `exact` (1.0)    | **Correct** despite surprising value — 66 kcal/100 g is accurate for Magerquark; no defect                      |

## 2. Full candidate traces

### 2.1 `himbeeren` — candidate set (all `includes`, sim 0.7)

| #   | displayName                                    | sourceId    | kcal                    |
| --- | ---------------------------------------------- | ----------- | ----------------------- |
| 0   | Quarkspeise mit Himbeeren                      | Y881610     | 112                     |
| 1   | Himbeeren gezuckert                            | Y847840     | 65                      |
| 2   | **Nussbiskuitrolle … mit Himbeeren und Sahne** | **D3A4000** | **275** ← native result |

Plain fruit present in the artifact but **absent from the candidate set**: „Himbeere roh"
(`F302100`, 43), „Wald-Himbeere roh" (`F411100`, 43). With the **singular** query `himbeere`,
BLS _does_ return „Himbeere roh" (43) at rank 0 — proving the fruit is reachable only when the
query happens to match the singular, space-form alias.

### 2.2 `haferflocken` — candidate set (all `includes`, sim 0.7; 17 candidates)

| #   | displayName                                      | sourceId    | kcal                    |
| --- | ------------------------------------------------ | ----------- | ----------------------- |
| 0   | Haferflockenplätzchen                            | D701600     | 448                     |
| 1   | Haferflocken-Nussplätzchen                       | D701700     | 517                     |
| 2   | **Milchsuppe gesüßt, gebunden mit Haferflocken** | **X475243** | **102** ← native result |
| 3   | Haferflockensuppe gesüßt, mit Milch 3,5 % Fett   | X4B2000     | 103                     |

Plain oat flakes present in the artifact but **absent from the candidate set**: „Hafer Flocken"
(`C133000`, **348**), stored with a **space** and alias `hafer flocken`.

### 2.3 `speck` — candidate set (`token`, sim 1.0; top 3)

| #   | displayName                                          | sourceId    | kcal                    |
| --- | ---------------------------------------------------- | ----------- | ----------------------- |
| 0   | Schwein Speck, ohne Schwartenzug (S VII) roh         | U605700     | 660                     |
| 1   | **Schwein Speck/Rückenspeck (grüner Speck) roh**     | **W412000** | **746** ← native result |
| 2   | Schwein Speck (Rückenspeck) Rohpökelware, geräuchert | W411000     | 699                     |

Bacon variants exist (`Schwein Frühstücksspeck`/`Bauchspeck …`, `W415000`/`W411300`, ~304 kcal)
but score **0.8** (partial token `…speck`.includes) and lose to the pure-`Speck` token match
(1.0). „Speck" is genuinely ambiguous (fatback vs. bacon).

### 2.4 `magerquark` — candidate set (`exact`, sim 1.0)

| #   | displayName                                           | sourceId | kcal |
| --- | ----------------------------------------------------- | -------- | ---- |
| 0   | Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr. | M713100  | 66   |

The compatibility overlay `COMPATIBILITY_ALIASES_BY_SOURCE_ID` (`BlsCompactRuntimeAdapter.ts`)
adds the exact aliases `['magerquark','quark','speisequark','magerstufe']` to `M713100`, so the
query exact-matches the correct food. 66 kcal is accurate.

## 3. Proven root cause

### 3.1 Himbeeren + Haferflocken — one shared, provable mechanism

Two compounding causes make the **plain generic food unreachable**, so no downstream ranking
could ever have selected it:

1. **Alias form mismatch (normalization).** The plain records' only aliases are the
   singular/space displayName forms — `himbeere roh`, `hafer flocken`. The user's compact
   plural/one-word query — `himbeeren`, `haferflocken` — is **not a substring** of those
   aliases (`"himbeere roh".includes("himbeeren") === false`;
   `"hafer flocken".includes("haferflocken") === false`), so the plain record cannot be found
   by the `includes` matcher.
2. **Retrieval stage-ordering (`BlsLookupEngine.search`).** For a single long token (>6 chars),
   Stage 2 runs `findIncludesMatches` and **returns immediately** when any record's alias
   _contains the query as a substring_ — which the processed/compound records do
   (`himbeeren gezuckert`, `…mit Himbeeren und Sahne`; `haferflockenplätzchen`,
   `…mit Haferflocken`). This short-circuits **before** Stage 4 token matching, which _would_
   have surfaced the plain food as a partial-token match: `calculateTokenScore(["haferflocken"],
["hafer","flocken"]) = 0.8` and `calculateTokenScore(["himbeeren"], ["himbeere","roh"]) =
0.8`. So a weaker `includes` match (0.7) on a processed food pre-empts a **stronger** token
   match (0.8) on the plain food that is never computed.

Net effect: the candidate set for these generic queries contains **only** processed/compound
foods, and the flat 0.7 `includes` score gives the resolver no way to prefer a plainer entry.
The specific processed winner (275 of 3, 102 of 17) is a downstream tie-break among equal-score
`includes` candidates and is **not** the root cause — the defect is that the plain food is
absent from the candidate set to begin with.

**Classification:** retrieval + normalization issue (BLS lookup). Reproducible, source-data is
correct (the plain records exist with correct macros); the selection logic excludes them.

### 3.2 Speck — ambiguity, not a data defect

`token` matching scores the pure „Schwein Speck" fatback records at 1.0 and the bacon variants
(single-word compounds `Frühstücksspeck`/`Bauchspeck`) at 0.8 (partial), so the highest-energy
fatback wins. All candidates are legitimate BLS „Speck" records with correct macros; the generic
term „Speck" is inherently ambiguous (fatback ~660–746 vs. bacon ~304). **Classification:
ambiguity requiring a product/UX decision (disambiguation or an intent-based ranking
preference), not a source-data or code-correctness defect.**

### 3.3 Magerquark — correct

**Classification: correct result despite a surprising value.** No change justified.

## 4. Smallest safe remediation proposals (for later Act tasks — not implemented here)

### 4.1 Plain-generic reachability (Himbeeren + Haferflocken) → **RESOLVER-V2-009**

Smallest safe, deterministic fixes (any one closes the gap; the first is preferred):

- **Whitespace-insensitive matching in `BlsLookupEngine`:** compare a space-collapsed form of
  both the query and the record alias/normalizedName (`"hafer flocken"`↔`"haferflocken"`). This
  is a normalization rule, **not** a speculative alias, and directly makes „Hafer Flocken"
  reachable for `haferflocken`.
- **Do not let a weaker `includes` match pre-empt a stronger `token` match:** in
  `search()`, when Stage 2/3 `includes` matches are all low-score processed/compound records,
  also compute Stage 4 token matches and return the higher-scoring set (or merge and rank by
  score) rather than early-returning `includes`.
- **De-preference processed/compound variants for a plain generic query:** a deterministic
  qualifier penalty (records whose displayName carries `gezuckert`, `getrocknet`, `-plätzchen`,
  `suppe`, `kompott`, `eis`, `mit … Sahne`, `Milchsuppe`, …) so a plain entry outranks a
  dessert/soup when both are candidates. No new per-food aliases, no artifact edit.
- **Singular/plural fold** for German generic queries (`himbeeren`↔`himbeere`) as a normalization
  step — again a rule, not per-food aliases.

The proof shows the first two are sufficient for the two reported cases; the qualifier penalty
is the robustness layer. Whichever is chosen must be evidence-gated (candidate-set + score
before/after) per the acceptance rule.

- **Affected files (Act):** `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts`
  (matching/stage logic), possibly `BlsCompactRuntimeAdapter.ts` (normalization used to build
  aliases/tokens — keep symmetric with query normalization). **No** artifact edit, **no** source
  precedence change.
- **Tests (Act):** new `BlsLookupEngine` cases asserting `himbeeren → "Himbeere roh" (F302100,
43)` and `haferflocken → "Hafer Flocken" (C133000, 348)` outrank the processed variants;
  regression guards that `magerquark → M713100 (66)` and existing exact/shortcut behavior
  (`buttertoast`, `ei`) are unchanged; the existing resolver suites
  (`--testPathPattern="resolver|Resolver|Bls"`) stay green.

### 4.2 Ambiguous generic term „Speck" → **RESOLVER-V2-010** (planning/decision first)

Requires a product decision before any code: should a bare „Speck" (a) resolve deterministically
to a chosen canonical variant (e.g. Frühstücksspeck/bacon), (b) trigger honest disambiguation
(„Welchen Speck?"), or (c) remain an honest low-confidence result? No implementation until the
decision is made; this is **not** a proven code defect. Do **not** hardcode a calorie value or a
speculative alias.

### 4.3 Magerquark — **no code change justified.**

## 5. Constraints honored

No hardcoded replacement calories, no speculative aliases, no artifact edit, no source-precedence
change, no candidate-picker/corrections-table, RESOLVER-V2-005/006 untouched, no product code
changed. Common nutrition knowledge was used only to _flag_ candidates for tracing, never as
proof — every verdict is backed by the actual selected record, its macros, match kind and score.

## 6. Recommended follow-up task order

1. **RESOLVER-V2-009** (proven fix, ready to implement) — plain-generic reachability for
   Himbeeren + Haferflocken (one shared root cause, independently scoped).
2. **RESOLVER-V2-010** (planning/decision first) — ambiguous „Speck" handling.

RESOLVER-V2-008 (this diagnosis) is complete: root cause proven for the two mismatches, the
third classified as ambiguity needing a product decision, the fourth confirmed correct.
