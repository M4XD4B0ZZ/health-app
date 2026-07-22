# Zera Resolver Knowledge Candidate Contract 1

**Status:** accepted for RESOLVER-V3-020. **Contract:** `resolver-knowledge-candidate-v1`.

**Cross-reference (RESOLVER-V3-031, does not amend this document):** everything below describes the V1
projection/fingerprint exactly as merged for RESOLVER-V3-020 — this history is unchanged. A separate,
explicit V2 successor (own `projectionVersion`, no `selectedSource.id` field at all, a versioned SHA-256
fingerprint, and a closed support/contradiction/orthogonal/not_evaluable relation classifier) was added
alongside it by RESOLVER-V3-031 as new, isolated modules; see
[`ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`](ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md)
§29 and the RESOLVER-V3-031 entry in `ROADMAP.md`.

**Cross-reference (RESOLVER-V3-032, does not amend this document):** the `evidence` field this document
describes (`supportingEvidenceCount`, `contradictingEvidenceCount`, etc.) remains exactly the shape defined
below. RESOLVER-V3-032 added a private, structurally separate contribution-ledger contract
(`resolver-knowledge-contribution-ledger-v1`) whose in-memory reference implementation recomputes this
existing `evidence` field via pure replay over active ledger contributions — it never adds a new field to,
or changes the shape of, `ResolverKnowledgeCandidate`/`ResolverKnowledgeCandidateEvidence` themselves. See
[`ZERA_RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_1.md`](ZERA_RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_1.md)
and the RESOLVER-V3-032 entry in `ROADMAP.md`.

## Candidate inventory and privacy boundary

The sole accepted aggregation input is the validated in-memory
`ResolverObservationAggregationProjectionV1` from
`resolver-observation-privacy-v1`. It currently contains only: privacy-policy and observation
contract versions; locale; input type; outcome; candidate count; selected non-personal source
type and ID; provenance status; resolver version; total latency; and closed safe reason codes.
The candidate boundary deliberately discards the source ID as well as all other input fields.

The V1-safe closed candidate types are `source-routing-pattern`,
`abstention-policy-signal`, `clarification-policy-signal`, `provenance-gap`, and the negative
knowledge type `negative-source-routing-rule`. They are derived only from locale, input type,
outcome, source _type_, provenance and allowlisted reason codes. No normalised term is available;
therefore aliases, typo rules, regional term mappings, meal names, search terms and free-text
decomposition templates are explicitly unsupported. Independent-user evidence is always
`not_evaluable`: the projection contains no privacy-safe user identity, and a hash would not make
one anonymous.

Private `resolver_observations`, owner context, rows, observation/run IDs, raw or normalised input,
exact event timestamps, personal source IDs, journal/correction references, provider responses,
AI prompts and secrets are rejected or absent. The aggregation implementation imports no private
observation repository and performs no database read.

## Contract, evidence and risk

Each candidate has a deterministic FNV-1a fingerprint calculated only from its closed safe payload.
It is deduplication, **not anonymisation**. Its candidate ID is derived from that fingerprint.
Payloads are discriminated and have no metadata bag. Evidence records supporting and contradicting
counts separately, abstention/clarification signals, contradiction state, negative-evidence state,
locale/input/source/provenance/reason-code summaries, and policy/contract/resolver versions.

Risk is one of `low`, `medium`, or `high`; V1 introduces no numerical privacy, frequency or
promotion threshold. Candidate data is never review-ready or promotion-ready solely from this
aggregation.

## Lifecycle and persistence

V1 persists only inactive statuses: `candidate`, `needs_more_evidence`, `pending_review`,
`rejected`, `duplicate`, `superseded`, and `quarantined`. `approved` is reserved for V3-021 and is
not representable through this task's aggregator or repository. Allowed transitions are limited to
candidate-to-inactive handling and `needs_more_evidence → candidate`; every transition writes a
closed-reason, actor-type and payload-version lifecycle event. Duplicate and supersession links,
and a quarantine reason field, are explicit.

The additive persistence boundary is `resolver_knowledge_candidates` and
`resolver_knowledge_candidate_events`. Both use RLS and revoke every `anon` and `authenticated`
grant; no application view, resolver read, activation trigger, curated-knowledge trigger or
service-role bypass is introduced. The existing private observations, resolver-run audit,
query-cache, user-alias, catalog and personal-memory structures are semantically unsuitable and
must not be repurposed.

## Non-effect and handoff

Candidates have no resolver, ranking, fast-path, query, catalog, clarification, abstention or AI
effect. V3-021 owns developer review and any explicit promotion contract. V3-022 owns shadow-mode
evaluation. Future privacy decisions include whether a separately approved aggregation boundary can
provide independent-user evidence and what review material can be safely retained; neither is
decided or implemented here.
