# RESOLVER-V3-044 — Clarification, Abstention, and Confidence-Policy Remediation

## Verdict

`PASSED` for the fixture-only remediation scope. Live proof remains assigned to RESOLVER-V3-048;
this report does not re-decide G2 or authorize production wiring.

## Evidence and diagnosis

The immutable RESOLVER-V3-039 Development checkpoint records both owned cases as AI-routed
`resolved_with_assumptions` results and `falseConfident: true`:

- `RH-RES-HOUSEHOLD-DEV-005` resolved one Magerquark cup as 150 g despite recording that cup size
  varies and is unknown.
- `RH-RES-UNRELIABLE-DEV-006` converted three repeated `Apfel` strings plus `123` noise into exactly
  three apples despite recording that the repetition/number meaning is unclear.

In both cases source retrieval validated food identity only. It supplied no evidence for the
assumed quantity. Model confidence and an exact source identity therefore could not justify a
complete numeric result.

## Remediation policy

`variant-c-confidence-policy-v1` is applied only after Variant C AI interpretation and before
source retrieval:

1. Model confidence is weak diagnostic evidence, not a standalone decision boundary. The original
   `0.5` cutoff was removed by the post-merge correction below because it had no canonical basis.
2. An `interpreted_with_assumptions` result with an explicit unresolved quantity, preparation, or
   brand uncertainty requests that targeted clarification before retrieval. Retrieval cannot
   validate those semantic assumptions.
3. If retrieval resolves none of the recognized components, Variant C asks an identity-targeted
   clarification instead of mechanically abstaining. Genuine `not_interpretable` inputs continue
   to abstain; technical unavailable/error outcomes remain distinct.
4. Multi-component partial results are preserved rather than replacing the entire meal with a
   clarification due to one low-confidence component.

This replaces neither provider output nor source truth. It selects the safe downstream action from
provider-neutral evidence already present in the interpretation contract.

## Fixture results

The two frozen observations were transcribed into deterministic, no-I/O policy fixtures. Both now
select `clarification_required / missing_quantity` before retrieval and cannot emit a numeric
resolved result. Additional fixtures prove supported direct resolution still proceeds, categorical uncertainty
clarifies, and recognized retrieval misses clarify rather
than inflate incorrect abstentions. Existing Variant C adapter tests and the RESOLVER-V3-043
representative three-arm false-confidence boundary remain green.

No Variant A/B source, corpus fixture, benchmark metric, evaluator, or live provider code changed.
Provider-call count: **0**.

## Frozen evidence integrity

All seven RESOLVER-V3-039 artifacts were SHA-256 checked against
`reports/resolver-v3-039-controlled-live-evidence-manifest.json` before and after implementation.
Every digest remained identical. No evidence file was regenerated.

## Residual risk

The lexical evidence classifier is deliberately narrow and versioned. Live effectiveness and
friction remain unknown until RESOLVER-V3-048 performs new controlled evidence. The policy does not
claim a new G2-C percentage from two fixtures and does not special-case case IDs.

## Production gate

RESOLVER-V3-010 remains `blocked`; `productionWiringAuthorized: false`.

## Post-merge correction — consumer-boundary fail-closed contract (2026-07-26)

**Original merge:** PR #176, merge commit `22c47409c2b4ee6dcb53d6ee527fe9c1eb03fd14`.
An independent review of that merged tree found that pre-retrieval clarification returned no
components, but an all-unresolved post-retrieval result returned the internal `componentResults`
unchanged. A real `runVariantCCase()` regression reproduced `clarification_required` after ranking
had selected BLS source `M713100`: `chosenCandidateName="Quark"`, `nativeScore=1`, grounded BLS
provenance (`sourceId=M713100`), and all four `macrosPer100g` values leaked. `scaledNutrients` and
`gramsUsed` happened to be null only because missing quantity caused this path; they were not
protected structurally.

The corrected final-result contract is outcome- and component-authority based:

- `resolved` and `resolved_with_assumptions` retain their legitimately selected source, score,
  per-100g macros, scaled nutrients, grams, and meal totals.
- `partially_resolved` retains that payload only for components that are both accepted and
  deterministically scaled. Every other component is sanitized.
- `clarification_required`, `abstained`, and `multiple_candidates` expose no selected candidate from
  any component. `not_interpretable`, `unavailable`, and `error` continue to expose no components
  or totals and remain semantically distinct, including technical-failure diagnostics.
- Sanitization clears `chosenCandidateName`, `nativeScore`, selected provenance/source ID,
  `macrosPer100g`, `scaledNutrients`, and `gramsUsed`; an internal `accepted` resolver status is
  downgraded to `rejected`, while diagnostic `ambiguous`/`not_searched`/`rejected` states remain;
  meal totals remain null for every
  non-complete outcome. Component identity, original/interpreted text, quantity interpretation,
  uncertainty/assumption diagnostics, source traces, search-plan metadata, candidate count,
  clarification requests, and unresolved IDs may remain because none identifies a selected result.

This is enforced once at the `runVariantCCase()` final consumer boundary, not by case ID and not by
adding status checks to individual consumers. The correction also makes the previously shadowed
all-ambiguous branch return `multiple_candidates` before the general all-unresolved branch; its
candidate diagnostics remain available while every single-selection field is cleared.

### Confidence-threshold disposition

Repository-wide source, fixture, corpus, report, and ROADMAP review found no independent derivation,
sensitivity analysis, or canonical fixture/corpus basis for
`VARIANT_C_MIN_INTERPRETATION_CONFIDENCE = 0.5`. Neither owned V3-044 case depends on it: both carry
explicit unresolved quantity evidence and still select `missing_quantity`. The undocumented global
numeric cutoff was therefore removed. Categorical uncertainty evidence remains the policy input;
confidence is retained as diagnostic model output but cannot by itself invent a global action
boundary. The complete deterministic fixture impact is one intentional policy expectation: the
synthetic low-confidence/no-uncertainty fixture now continues to retrieval. The two owned fixtures
and the representative offline regression inventory remain unchanged.

### Consumer-boundary verification

Boundary tests cover pre- and post-retrieval clarification, abstention, multiple candidates,
technical `not_interpretable`/`unavailable`/`error`, partial sanitization, and resolved retention.
Evaluator and aggregation suites prove sanitized non-resolutions classify as no resolution and do
not contribute macro/provenance truth. Focused Variant C, representative Hybrid V1 offline, and
V3-043/V3-049/V3-050/V3-051 regression suites plus full `npm run verify` are the completion gate. In this checkout the final full verify passed typecheck, lint, and formatting, but the Jest phase stalled for more than ten minutes in pre-existing OFF edge-provider network waits and was terminated; V3-044 therefore remains `in_progress`.
Provider calls and benchmark cost remain **0**; no Development or Holdout run occurred and no frozen
evidence or corpus file changed.

### Follow-up review correction — accepted-status leak

A second consumer-boundary audit found that the initial sanitizer still copied
`resolverStatus: "accepted"` from a candidate whose quantity could not be resolved. Although the
selected name, score, source, and nutrients were null, an `accepted` status is itself an
authoritative completion signal and violated the same fail-closed invariant. The boundary
regression was strengthened first and failed against the initial correction (`expected rejected`,
`received accepted`). The sanitizer now downgrades only internal `accepted` on unauthorized
components to `rejected`; `ambiguous`, `not_searched`, and `rejected` remain useful diagnostic
states. Fully resolved components retain `accepted`, and multiple-candidate components retain
`ambiguous` without any single-selection payload.
