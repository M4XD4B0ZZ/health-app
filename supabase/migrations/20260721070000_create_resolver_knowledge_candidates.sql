-- RESOLVER-V3-020: inactive, server/admin-only global candidate quarantine.
-- This migration deliberately has no observation read path, app grants, views, or activation automation.
begin;

create table public.resolver_knowledge_candidates (
  candidate_id text primary key,
  contract_version text not null check (contract_version = 'resolver-knowledge-candidate-v1'),
  candidate_type text not null check (candidate_type in ('source-routing-pattern', 'abstention-policy-signal', 'clarification-policy-signal', 'provenance-gap', 'negative-source-routing-rule')),
  fingerprint text not null unique,
  payload jsonb not null check (jsonb_typeof(payload) = 'object'),
  evidence jsonb not null check (jsonb_typeof(evidence) = 'object'),
  risk text not null check (risk in ('low', 'medium', 'high')),
  status text not null check (status in ('candidate', 'needs_more_evidence', 'pending_review', 'rejected', 'duplicate', 'superseded', 'quarantined')),
  duplicate_of_candidate_id text references public.resolver_knowledge_candidates(candidate_id),
  superseded_by_candidate_id text references public.resolver_knowledge_candidates(candidate_id),
  quarantine_reason_code text,
  created_at timestamptz not null,
  updated_at timestamptz not null
);

create table public.resolver_knowledge_candidate_events (
  event_id text primary key,
  candidate_id text not null references public.resolver_knowledge_candidates(candidate_id),
  previous_status text,
  next_status text not null check (next_status in ('candidate', 'needs_more_evidence', 'pending_review', 'rejected', 'duplicate', 'superseded', 'quarantined')),
  reason_code text not null check (reason_code in ('OBSERVATION_PATTERN', 'CONTRADICTING_PROJECTION', 'INSUFFICIENT_EVIDENCE', 'READY_FOR_REVIEW', 'DUPLICATE_FINGERPRINT', 'QUARANTINE_PRIVACY_REVIEW', 'REJECTED_BY_REVIEW', 'SUPERSEDED_BY_CANDIDATE')),
  actor_type text not null check (actor_type in ('system', 'developer')),
  payload_version text not null check (payload_version = 'resolver-knowledge-candidate-v1'),
  occurred_at timestamptz not null
);

alter table public.resolver_knowledge_candidates enable row level security;
alter table public.resolver_knowledge_candidate_events enable row level security;
revoke all on table public.resolver_knowledge_candidates from anon, authenticated;
revoke all on table public.resolver_knowledge_candidate_events from anon, authenticated;

commit;
