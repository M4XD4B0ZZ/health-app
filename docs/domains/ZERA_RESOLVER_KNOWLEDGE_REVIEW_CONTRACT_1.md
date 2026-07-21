# Zera Resolver Knowledge Review Contract 1

**Contract:** `resolver-knowledge-review-v1`. **Status:** accepted for RESOLVER-V3-021; amended and
hardened by RESOLVER-V3-028 (2026-07-21, see §"Amendment" below). The contract version identifier
itself is unchanged — the RESOLVER-V3-028 amendment adds fields/enforcement, it does not replace
the payload/event schema wholesale, so no `v2` was minted.

## Inventory and boundary

Candidates contain only their closed type/payload, aggregate counts and contradiction/negative summaries, locale/input/source/provenance/reason-code/version summaries, risk, `not_evaluable` independent-user evidence, and lifecycle history. They do not contain raw or normalized input, owner, observation/run/row IDs, personal source IDs, journal/correction references, provider output, prompts, or secrets. All five V3-020 types are reviewable; routing candidates require source-grounded provenance, while abstention/clarification/provenance-gap and negative rules remain policy proposals requiring later shadow evaluation. One user and `not_evaluable` evidence cannot justify a global rule.

The repository boundary is server/admin-only: `ResolverKnowledgeReviewAuthorizer` has no app-user, owner-ID, client Boolean, or public-port input. The distinct curated table is required because candidates are immutable evidence/lifecycle proposals, whereas approved payloads are explicit, versioned, locale-bounded, reversible review output. Hashes remain only fingerprints, never anonymisation.

## Closed review contract

Requests have a decision ID, candidate ID, action, and time. Actions are `approve`, `reject`, `needs_more_evidence`, `quarantine`, `mark_duplicate`, `supersede`, `revoke_approval`, and `rollback`; results are closed as `applied`, `already_applied`, `blocked_unauthorized`, `blocked_privacy`, `invalid_transition`, `candidate_not_found`, `validation_failed`, or `persistence_failed`. There are no free reason or metadata fields. Unknown candidate/privacy versions, private fields, personal sources, unknown reason codes, or incomplete privacy-safe evidence fail closed.

Approval creates a separate `ApprovedResolverKnowledgePayload` tied to candidate and decision, with closed discriminated payload, locale, risk, provenance, and active/revoked/rolled-back state. Rejection, quarantine, and evidence requests preserve candidate history. Negative knowledge is reviewable but never automatically active. Every decision is append-only audited and a Decision ID is idempotent. Revocation and rollback deactivate the curated payload without deletion.

## No production effect and handoff

This migration grants neither `anon` nor `authenticated`, enables RLS, creates no application view and contains no trigger. No productive resolver reads curated knowledge. V3-022 may shadow-evaluate it; V3-023 benchmarks it; V3-024 alone revisits the representative gate. V3-010 remains blocked.

## Amendment (RESOLVER-V3-028): fail-closed evidence, atomicity, full lifecycle, and audit

A post-implementation review of RESOLVER-V3-021
(`reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`) found the originally
merged service treated `not_evaluable` independent-user evidence as the *passing* condition for
approval (the literal opposite of "insufficient evidence"), performed the approved-payload write and
the audit-event write as two separate non-transactional calls, only ever appended an event for
`reject`/`needs_more_evidence`/`quarantine` without transitioning candidate lifecycle state, and
persisted no reviewer identity, decision reason, contract/privacy-policy versions, review-material
snapshot, risk decision, or locale/region restriction. RESOLVER-V3-028 closes these gaps. This
section is authoritative for the current implementation; the sections above describe the
RESOLVER-V3-021 baseline this amends.

### Independent-user evidence (fail-closed)

`ResolverKnowledgeCandidateEvidence.independentUserEvidence` is now a closed two-value type:
`not_evaluable` (not evaluated / insufficient) and `independently_confirmed` (positively evaluated
through a privacy-safe independent-user boundary). No numeric user-count threshold is invented. The
current aggregation pipeline (RESOLVER-V3-020) only ever produces `not_evaluable`, so **no candidate
can reach `approved` today** — this is the intended fail-closed behavior, not a defect to route
around, until an accepted independent-user aggregation mechanism exists. No candidate-type exemption
is implemented; no accepted authority currently authorizes one.

### Discriminated review command and full lifecycle transitions

`ResolverKnowledgeReviewRequest` is a discriminated union keyed on `action`. `mark_duplicate` and
`supersede` require an explicit `targetCandidateId`; a self-reference or a target that does not
exist fails closed (`validation_failed` / `candidate_not_found`) before any persistence. Every
request also carries `reviewContractVersion`, `privacyPolicyVersion`, `candidateVersionAtDecision`
(the exact `candidate.updatedAt` the reviewer decided against — a stale value fails closed),
`riskDecision` (must equal the candidate's own computed risk), `localeRestriction` (closed:
`not_applicable` / `restricted_to_candidate_locale` / `unknown` — no invented region taxonomy;
`unknown` fails closed for `approve`), and a closed `reasonCode` restricted per-action by
`RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS`.

The candidate's own `status` field (previously type-excluded from ever legally being `approved`,
forcing an `as never`-style cast in the review service) is now a full closed status including
`approved`. Lifecycle transitions:

| Action | Legal source status | Result candidate status | Payload effect |
| --- | --- | --- | --- |
| `approve` | `pending_review` | `approved` | creates active `ApprovedResolverKnowledgePayload` |
| `reject` | `pending_review` | `rejected` | none |
| `needs_more_evidence` | `pending_review` | `needs_more_evidence` | none |
| `quarantine` | `pending_review` | `quarantined` (+ quarantine reason) | none |
| `mark_duplicate` | `pending_review` | `duplicate` (+ `duplicateOfCandidateId`) | none |
| `supersede` | `pending_review` | `superseded` (+ `supersededByCandidateId`) | none |
| `revoke_approval` | `approved` (+ active payload) | unchanged (`approved`) | payload → `revoked` |
| `rollback` | `approved` (+ active payload) | unchanged (`approved`) | payload → `rolled_back` |

`revoke_approval`/`rollback` deliberately leave `candidate.status` at `approved`: it is a permanent
historical record that the candidate's payload was once approved, while the payload's own `status`
(`active`/`revoked`/`rolled_back`) governs current operational effect — this matches "revocation and
rollback deactivate the curated payload without deletion" without overloading candidate status with
payload-level nuance. Any other source status for a given action is `invalid_transition` with zero
mutation.

### Single atomic decision operation

`ResolverKnowledgeReviewRepository` no longer exposes `saveApproved`/`appendEvent` as separately
callable steps. The only write method is `applyDecision(plan)`, where `plan` is a fully-computed,
business-rule-free `ResolverKnowledgeReviewDecisionPlan` (candidate transition, approved-payload
value, and the finished immutable event) built by the service. A conforming adapter has no way to
expose a partial write through this port at all; the reference `InMemoryResolverKnowledgeReviewRepository`
demonstrates the required all-or-nothing behavior by snapshotting the candidate row, the candidate's
own lifecycle-event log, the approved-payload table, and the review-event table before mutating, and
restoring all four from that snapshot if any internal step throws (verified by tests that inject a
failure at each of the three internal stages — candidate, payload, event).

### Persisted audit fields

`ResolverKnowledgeReviewEvent` now persists: `reviewerId` (from the trusted authorizer's
`authorizeDeveloperReview()` result — never an app-user-supplied value or request field),
`reviewContractVersion`, `privacyPolicyVersion`, `candidateVersionAtDecision`, `riskDecision`,
`localeRestriction`, `targetCandidateId` (nullable), a closed `reasonCode`, and an immutable
`reviewMaterialSnapshot` (`ResolverKnowledgeReviewMaterial`, built by the service from the fetched
candidate — never trusted verbatim from caller input) — in addition to the existing
eventId/decisionId/candidateId/action/result/occurredAt/approvedKnowledgeId fields. Private/linkable
fields are rejected by a recursive key-name walk over the entire candidate object (any nesting
depth), not only a top-level check.

### Semantic idempotency

A decisionId already recorded is compared field-by-field (candidateId, action, reasonCode,
reviewerId, target, riskDecision, localeRestriction, versions, candidateVersionAtDecision,
occurredAt) against the incoming request. An exact match returns `already_applied` with zero
mutation. Any difference returns the new closed result value `conflict` — reusing a decisionId for a
different decision is never reported as a false `already_applied`.

### Additive migration

`supabase/migrations/20260721160000_extend_resolver_knowledge_review_governance.sql` is additive
only: it widens the `resolver_knowledge_candidates.status` and
`resolver_knowledge_candidate_events.next_status`/`reason_code` check constraints to allow
`approved`/`APPROVED_BY_REVIEW`, and adds the new audit columns to `resolver_knowledge_review_events`.
No historical migration file is edited. It grants nothing new to `anon`/`authenticated`, creates no
view or trigger, and has **not been applied to any live Supabase project** as part of this task — no
production Supabase adapter for this port exists (only the in-memory reference adapter), so this
remains a server/admin-only schema definition, not operational or live-migrated infrastructure.

### Scope explicitly not touched by this amendment

No app-facing grant, no resolver-effect wiring, no aggregation batch job, no production Supabase
adapter, and no dependency/`package.json` change. RESOLVER-V3-029 (shadow privacy/metrics) and
RESOLVER-V3-030 (aggregation operational boundary) remain separate, unstarted tasks.
