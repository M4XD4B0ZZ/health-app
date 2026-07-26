# RESOLVER-V3-045 — Post-Merge Evidence and Reference-Integrity Correction

**Status:** `in_progress`; offline semantic effectiveness is not measured
**Post-merge basis:** PR #180, merge commit `2710832d2d5505d514d015c32964fc31ad48a970`
**Provider calls / cost:** **0 / USD 0**

## 1. Independent post-merge findings and reproduced baseline

The correction started from the exact PR #180 merge commit. New tests first reproduced all three
findings:

1. The unchanged frozen 16-group fixture replay measures Variant C outcome and identification
   agreement at **11/16 = 68.75%**. The previously reported **12/16 = 75.00%** appears only after
   the test directly overwrites the three owned `evaluation` records with
   `clarification_required` / `no_resolution`; no prompt, provider, adapter, or policy path produces
   those replacements.
2. A schema-shaped `clarification_required` response with an unknown
   `clarification.componentId` normalized successfully and silently lost the reference; duplicate
   component IDs were likewise accepted. The failing baseline had two failures and exited 1.
3. The real `runVariantCCase()` AI-routed path passes only `rawInput`, `locale`, and `traceId`.
   `BenchmarkCase` has no authoritative normalized-input field, so the prompt helper's isolated
   `normalizedInput` preference was never exercised by this benchmark/live adapter path.

## 2. Root causes and corrections

### Evidence status

The prompt change can constrain a future provider response but cannot generate a new semantic
answer offline. No deterministic general policy consumes the prompt and creates the three claimed
clarifications. The old test therefore confused a desired counterfactual with executed evidence.
The metric implementation, frozen observations, corpus, and ground truth were not changed.

The evidence classifications are now explicit:

| Claim                                          | Classification                                       | Result                                          |
| ---------------------------------------------- | ---------------------------------------------------- | ----------------------------------------------- |
| Frozen 16-group replay                         | **fixture-executed / measured from frozen fixtures** | 11/16 = **68.75%**                              |
| Directly replaced owned-group records          | **derived counterfactual**                           | 12/16 = **75.00%**, not an observed after-value |
| Prompt/provider semantic improvement           | **live-unverified**                                  | no after-rate                                   |
| Parser/validator and request-shape regressions | **fixture-executed**                                 | deterministic tests only                        |

The honest before/after consistency status is therefore **68.75% measured before; no measured
after-value**. The 75% number is retained only to explain the counterfactual calculation and must
not be presented as improvement evidence. Controlled live proof remains RESOLVER-V3-048.

### Clarification reference integrity

Validation now performs component-ID uniqueness checks before the clarification early return. A
present `clarification.componentId` must be a non-empty reference to an existing component;
unknown or malformed references become the existing structured `error` outcome with a
`schema_validation_failed` message. An omitted optional reference remains valid. Valid references
are still stably remapped to `c1..cn`.

For interpreted outcomes, validation now also enforces the prompt's existing statement that every
component has exactly one search plan. This is the minimum reference/cardinality integrity check;
it does not otherwise pre-empt RESOLVER-V3-046's broader contract/reliability scope.

### `normalizedInput` boundary

`AiInterpretationRequest` may carry an optional authoritative `normalizedInput`, and
`buildVariantCPrompt()` safely canonicalizes it when supplied. `BenchmarkCase`, however, exposes no
such authoritative value. The adapter therefore continues to pass the raw input rather than
inventing a normalization or deriving one from ground truth. A real-adapter regression proves the
exact request and preserves brands, negations, quantities, punctuation, and component boundaries.
Documentation no longer claims that the actual Variant-C benchmark/live path uses
`normalizedInput`; raw input still receives representation-only NFKC/whitespace canonicalization
inside prompt construction.

## 3. Scope and integrity

This correction changes no provider/model, sampling configuration, production wiring, UI,
journal, Supabase, DI, corpus, ground truth, metric, or frozen V3-039 evidence. It makes no provider
call, reads no provider credential, and runs neither Development nor Holdout. There is no case-ID or
food-specific production rule. RESOLVER-V3-010 remains `blocked`.

Because V3-045's acceptance requires an evidence-based reduction in run-to-run disagreement and no
such reduction has been measured, RESOLVER-V3-045 returns to `in_progress`. V3-043 also returns to
`in_progress`: its umbrella closeout depended on V3-045 closing the final owned AI-routed class.
Acceptance criteria were not weakened.

## 4. Verification record

The pre-fix focused command failed exactly on unknown clarification references and duplicate IDs
(2 failed, 29 passed; exit 1), while the request-path and counterfactual-classification tests
confirmed the other two defects. After the validator correction, prompt/provider/adapter focused
coverage passed. Final prompt/provider/adapter coverage passed (3 suites / 36 tests), and split V3-044
policy/quantity coverage passed (2 suites / 15 tests). A larger 13-suite regression invocation
visibly passed the V3-043, V3-049, V3-050 call-path, V3-051 generic-safety, and Representative
Hybrid metrics/protocol suites but did not terminate or print a complete Jest summary; it was
interrupted with exit 130 and is not represented as wholly green. `npm run typecheck`, `npm run
lint`, and `npm run format:check` passed. `npm run verify` passed those three stages, then its full
Jest run continued through many passing suites and repeated OFF/USDA provider logs without
terminating after more than three minutes; it too was interrupted with exit 130 and is not claimed
green. `git diff --check`, package/base/path integrity, and all seven manifest SHA-256 checks
passed. Green GitHub CI remains required before merge.

## 5. Residual risk and next step

Temperature zero and prompt constraints may reduce provider variance, but offline code cannot
establish their semantic effect. V3-045 remains open until its existing acceptance criterion is
satisfied with legitimate evidence. RESOLVER-V3-048 owns controlled live re-evidence; V3-046 owns
broader response-contract, parsing, error-taxonomy, reliability, and latency work. No production
wiring is authorized.
