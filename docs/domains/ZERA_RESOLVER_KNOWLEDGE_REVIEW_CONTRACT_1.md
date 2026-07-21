# Zera Resolver Knowledge Review Contract 1

**Contract:** `resolver-knowledge-review-v1`. **Status:** accepted for RESOLVER-V3-021.

## Inventory and boundary

Candidates contain only their closed type/payload, aggregate counts and contradiction/negative summaries, locale/input/source/provenance/reason-code/version summaries, risk, `not_evaluable` independent-user evidence, and lifecycle history. They do not contain raw or normalized input, owner, observation/run/row IDs, personal source IDs, journal/correction references, provider output, prompts, or secrets. All five V3-020 types are reviewable; routing candidates require source-grounded provenance, while abstention/clarification/provenance-gap and negative rules remain policy proposals requiring later shadow evaluation. One user and `not_evaluable` evidence cannot justify a global rule.

The repository boundary is server/admin-only: `ResolverKnowledgeReviewAuthorizer` has no app-user, owner-ID, client Boolean, or public-port input. The distinct curated table is required because candidates are immutable evidence/lifecycle proposals, whereas approved payloads are explicit, versioned, locale-bounded, reversible review output. Hashes remain only fingerprints, never anonymisation.

## Closed review contract

Requests have a decision ID, candidate ID, action, and time. Actions are `approve`, `reject`, `needs_more_evidence`, `quarantine`, `mark_duplicate`, `supersede`, `revoke_approval`, and `rollback`; results are closed as `applied`, `already_applied`, `blocked_unauthorized`, `blocked_privacy`, `invalid_transition`, `candidate_not_found`, `validation_failed`, or `persistence_failed`. There are no free reason or metadata fields. Unknown candidate/privacy versions, private fields, personal sources, unknown reason codes, or incomplete privacy-safe evidence fail closed.

Approval creates a separate `ApprovedResolverKnowledgePayload` tied to candidate and decision, with closed discriminated payload, locale, risk, provenance, and active/revoked/rolled-back state. Rejection, quarantine, and evidence requests preserve candidate history. Negative knowledge is reviewable but never automatically active. Every decision is append-only audited and a Decision ID is idempotent. Revocation and rollback deactivate the curated payload without deletion.

## No production effect and handoff

This migration grants neither `anon` nor `authenticated`, enables RLS, creates no application view and contains no trigger. No productive resolver reads curated knowledge. V3-022 may shadow-evaluate it; V3-023 benchmarks it; V3-024 alone revisits the representative gate. V3-010 remains blocked.
