-- RESOLVER-V3-028: additive-only governance/audit hardening for developer review and promotion.
-- No historical migration is edited. Still server/admin-only: no anon/authenticated grants, no
-- application view, no trigger, no resolver read path, no live wiring. Two things are added:
-- (1) `approved` becomes a legal candidate lifecycle status (RESOLVER-V3-021 previously modeled
--     approval only as a separate table with no consistent candidate-side lifecycle transition);
-- (2) the review-event audit record gains reviewer identity, review-contract/privacy-policy
--     versions, the candidate version reviewed, a closed decision reason, a risk decision, a
--     locale/region restriction, an optional duplicate/supersession target, and the privacy-safe
--     review-material snapshot presented for the decision.
begin;

alter table public.resolver_knowledge_candidates drop constraint resolver_knowledge_candidates_status_check;
alter table public.resolver_knowledge_candidates add constraint resolver_knowledge_candidates_status_check
  check (status in ('candidate', 'needs_more_evidence', 'pending_review', 'rejected', 'duplicate', 'superseded', 'quarantined', 'approved'));

alter table public.resolver_knowledge_candidate_events drop constraint resolver_knowledge_candidate_events_next_status_check;
alter table public.resolver_knowledge_candidate_events add constraint resolver_knowledge_candidate_events_next_status_check
  check (next_status in ('candidate', 'needs_more_evidence', 'pending_review', 'rejected', 'duplicate', 'superseded', 'quarantined', 'approved'));

alter table public.resolver_knowledge_candidate_events drop constraint resolver_knowledge_candidate_events_reason_code_check;
alter table public.resolver_knowledge_candidate_events add constraint resolver_knowledge_candidate_events_reason_code_check
  check (reason_code in ('OBSERVATION_PATTERN', 'CONTRADICTING_PROJECTION', 'INSUFFICIENT_EVIDENCE', 'READY_FOR_REVIEW', 'DUPLICATE_FINGERPRINT', 'QUARANTINE_PRIVACY_REVIEW', 'REJECTED_BY_REVIEW', 'SUPERSEDED_BY_CANDIDATE', 'APPROVED_BY_REVIEW'));

alter table public.resolver_knowledge_review_events
  add column reviewer_id text not null,
  add column reason_code text not null check (reason_code in ('INDEPENDENT_EVIDENCE_CONFIRMED', 'INSUFFICIENT_INDEPENDENT_EVIDENCE', 'PRIVACY_OR_PROVENANCE_RISK', 'CONTRADICTING_EVIDENCE', 'DUPLICATE_OF_EXISTING_CANDIDATE', 'SUPERSEDED_BY_NEWER_CANDIDATE', 'REGRESSION_OR_ERROR_DETECTED', 'ROLLBACK_TO_PRIOR_STATE')),
  add column review_contract_version text not null check (review_contract_version = 'resolver-knowledge-review-v1'),
  add column privacy_policy_version text not null check (privacy_policy_version = 'resolver-observation-privacy-v1'),
  add column candidate_version_at_decision text not null,
  add column risk_decision text not null check (risk_decision in ('low', 'medium', 'high')),
  add column locale_restriction text not null check (locale_restriction in ('not_applicable', 'restricted_to_candidate_locale', 'unknown')),
  add column target_candidate_id text references public.resolver_knowledge_candidates(candidate_id),
  add column review_material_snapshot jsonb not null check (jsonb_typeof(review_material_snapshot) = 'object');

revoke all on table public.resolver_knowledge_reviews from anon, authenticated;
revoke all on table public.approved_resolver_knowledge from anon, authenticated;
revoke all on table public.resolver_knowledge_review_events from anon, authenticated;

commit;
