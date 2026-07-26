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

1. Model confidence is weak evidence. A single interpreted component below `0.5` requests the
   smallest identity/preparation/brand/quantity clarification supported by its evidence.
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
resolved result. Additional fixtures prove supported direct resolution still proceeds, low
single-component confidence clarifies identity, and recognized retrieval misses clarify rather
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
