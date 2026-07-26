# RESOLVER-V3-045 — Haiku Interpretation Determinism and Repeat-Consistency Remediation

**Status:** offline/fixture remediation complete; no new live or G2 overall decision  
**Basis:** `9eb9639721bc8bd9f2c6f4d2885e2a4e8dcfd7ff` (PR #179 merge)  
**Provider calls / cost:** **0 / USD 0**

## 1. Ausgangsevidenz und reproduzierte Baseline

The canonical final V3-039 report records 16 groups and Variant C outcome and identification
agreement of `0.6875`; the unchanged `computeConsistencyMetrics()` calculation gives 11/16 =
**68.75%**, Variant A's structural baseline `1`, and a **-0.3125 (-31.25pp)** delta. The new replay
test reconstructs the 14 persisted Development groups directly represented in the frozen
checkpoint and the aggregate-constrained two Holdout groups (V3 did not persist Holdout per-case
records). It reproduces both rates exactly with the existing metric implementation; it does not
change the evaluator, corpus, or ground truth.

For `RH-RES-OVERLAY-DEV-010#C1`, the frozen Development checkpoint shows run 0 `abstained` /
`no_resolution`, run 1 `resolved_with_assumptions` / `wrong` and run 2 `abstained` /
`no_resolution`. Run 1 assumed 150 g and cooked white rice from the subjective quantity phrase.
A regression against the real `SequentialFoodCatalogResolver` + `BlsStaticSource` confirms the
input produces zero BLS candidates and is not accepted, so the defect is AI-routed.

## 2. Root-cause matrix

The five persisted Development groups with an outcome and/or identification divergence are below.
The final row covers the frozen aggregate's one additional divergent Holdout group: protocol v3
did not persist Holdout per-case records, so assigning it to either Holdout overlay ID would invent
evidence. Both Holdout overlay IDs therefore remain an explicitly bounded attribution risk.

| Group / case                                         | Observed divergence                                              | Route                                 | Root-cause category                                                                                  | Fixed here       | Basis / residual risk                                                                                                                  |
| ---------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `RH-RES-OVERLAY-DEV-004`                             | outcome and identification                                       | AI                                    | genuine preparation/decomposition ambiguity plus model choice variance                               | no               | Multiple plausible decompositions; must not be hidden by normalization.                                                                |
| `RH-RES-OVERLAY-DEV-006`                             | outcome and identification, including technical error            | AI                                    | response/transport reliability plus model variance                                                   | no               | Error taxonomy/contract reliability belongs to V3-046.                                                                                 |
| `RH-RES-OVERLAY-DEV-007`                             | stable partial outcome, unstable identification                  | AI                                    | genuine multi-component resolution ambiguity                                                         | no               | Canonical IDs remove representational variance only; semantic identity disagreement remains.                                           |
| `RH-RES-OVERLAY-DEV-010` (`#C1` owned)               | abstained / wrong assumed resolution / abstained                 | AI; real fast path has 0 candidates   | underspecified prompt and material vague-quantity policy; unstated sampling; representation variance | **yes, offline** | Prompt now mandates targeted quantity clarification; V3-044 categorical policy blocks material assumptions; live proof remains V3-048. |
| `RH-RES-OVERLAY-DEV-014`                             | multiple candidates vs assumed resolution; identification stable | AI                                    | ambiguity-policy/model outcome variance                                                              | no               | Genuine ambiguity is retained; no outcome coalescing.                                                                                  |
| one of two Holdout overlay groups (ID not persisted) | one aggregate outcome and identification disagreement            | unknown from frozen per-case evidence | evidence-contract attribution gap                                                                    | no               | Cannot honestly assign or remediate without V3-048 protocol-v4 evidence.                                                               |

## 3. Root-cause analysis

1. **Request/sampling.** The request already pinned model, max tokens, system prompt, JSON schema,
   and message order but omitted an explicit sampling field. The adapter now sends `temperature: 0`
   and a fake-transport payload test proves the exact request. This minimizes supported temperature
   randomness but is not claimed to make a remote service mathematically deterministic. Network
   documentation lookup was unavailable (tool returned HTTP 401); no provider call replaced it.
2. **Prompt.** V1 permitted both a numeric standard-portion assumption and clarification for the
   same vague material quantity. It did not bind component ordering/IDs, plan ordering, or the
   distinction between `clarification_required` and `not_interpretable`. V2 binds all of these and
   forbids numeric inference for subjective quantities.
3. **Input.** V1 ignored `normalizedInput`. V2 prefers it, applies NFKC and whitespace collapse,
   and stabilizes typed context order. It deliberately preserves case and punctuation to avoid
   colliding semantically distinct inputs.
4. **Response.** V1 returned provider-generated IDs and incidental whitespace/duplicates verbatim
   and did not validate search-plan reference integrity. The parser now validates unique/referenceable
   IDs, assigns `c1..cn` in semantic component order, remaps plans/clarifications, trims strings,
   and deduplicates non-priority text arrays. Source priorities, native-query order, component order,
   and all semantic outcomes remain unsorted and uncoalesced.
5. **Policy.** V3-044 already established that source lookup cannot validate a model-assumed
   material quantity. V2 aligns the prompt with that categorical fail-closed policy; it adds no
   numerical confidence threshold.
6. **Cache.** Rejected. A cache would freeze the first stochastic answer rather than prove improved
   interpretation and would add key/error-lifecycle complexity. No cache was implemented.
7. **Genuine ambiguity.** Only representation variance and the owned material-quantity defect are
   normalized. The other semantic disagreements remain visible.

## 4. Designentscheidung und verworfene Alternativen

The minimal combined correction is explicit lowest-temperature sampling, a versioned semantic
prompt (`variant-c-prompt-v2`), versioned interpreter behavior (`variant-c-live-interpreter-v2`),
conservative input canonicalization, and post-validation representation normalization. Schema
semantics did not change, so `variant-c-schema-v1` remains correct.

Rejected: cache-as-consistency shortcut; alphabetic sorting of source priorities or queries;
case/food/fixture special cases; metric or ground-truth changes; a new confidence threshold;
semantic outcome coalescing; provider/model changes; and production wiring.

## 5. Failing baseline and before/after result

Before implementation, the new focused suites failed: the canonicalization export did not exist;
the request payload lacked `temperature`; `normalizedInput` was absent from the prompt path; prompt
rules did not require clarification; and provider IDs/queries were returned unchanged. The initial
command exited `1` with two failed suites (one compile-time missing export and the request suite's
new transport test pending its complete fake shape). After implementation those focused tests pass.

Using the unchanged `computeConsistencyMetrics()` definition:

| Metric                             |             Before | Conservative offline after |
| ---------------------------------- | -----------------: | -------------------------: |
| groups                             |                 16 |                         16 |
| Variant C outcome agreement        | 11/16 = **68.75%** |         12/16 = **75.00%** |
| Variant C identification agreement | 11/16 = **68.75%** |         12/16 = **75.00%** |
| Variant A structural baseline      |              ~100% |                      ~100% |
| C delta from A                     |       **-31.25pp** |               **-25.00pp** |

The after value changes only the owned group's three offline outcomes to the same targeted
`clarification_required` / `no_resolution` policy result. It does not predict improvements for the
other groups. The owned group therefore agrees 3/3 offline, avoids retrieval and numeric authority,
and no longer produces its historical false-confident run-1 result.

## 6. Verification and integrity

Focused coverage includes request payload, input/prompt canonicalization, response normalization,
ID/reference integrity, the owned-case policy class, all 16 metric groups, the real no-candidate BLS
path, positive controls, genuine ambiguity preservation, V3-043/044 policy and adapter regressions,
and V3-049/050/051 call-path suites. Typecheck, lint, and format completed successfully in `npm run verify`. Full Jest continued
for 3 minutes 11 seconds, with the last visible state repeatedly entering the OFF edge-provider
suite after many passing suites, but did not terminate; it was interrupted (exit 130), not called
green. The OFF/USDA suites then passed in isolation (2 suites, 14 tests, 9.142 s). Green GitHub CI
is required before merge. Final results are also recorded in the handoff.

The seven manifest-listed V3-039 files were checked against the manifest SHA-256 values and remain
byte-identical. `git diff --name-only` contains no manifest evidence, benchmark corpus/ground-truth,
BLS artifact/workbook, UI, production wiring, DI, journal, Supabase, or feature-flag file. No
credential was read; all HTTP testing uses an injected fake transport; provider calls are 0.

## 7. Residual risks and boundaries

`temperature: 0` plus a stricter prompt reduces but cannot prove remote bit-for-bit determinism.
Only V3-048 may provide controlled live effectiveness under protocol v4. V3-046 retains response
contract/error/latency reliability, and V3-047 retains candidate optimization. This task makes no
new G2 overall judgment, no live cost/latency claim, and no production-wiring authorization.
RESOLVER-V3-010 remains `blocked`; V3-046 remains `todo`.
