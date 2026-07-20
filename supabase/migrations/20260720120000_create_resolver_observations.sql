-- RESOLVER-V3-015A: dedicated, private, immutable storage for resolver-observation-v1.
-- This is not a resolver/cache/memory/candidate/global-knowledge source.
begin;

create table public.resolver_observations (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  observation_id text not null,
  resolver_run_id text not null,
  contract_version text not null check (contract_version = 'resolver-observation-v1'),
  occurred_at timestamptz not null,
  observation_payload jsonb not null,
  created_at timestamptz not null default now(),
  constraint resolver_observations_owner_observation_unique unique (owner_id, observation_id),
  constraint resolver_observations_payload_object_check check (jsonb_typeof(observation_payload) = 'object'),
  constraint resolver_observations_payload_identity_check check (
    observation_payload ->> 'contractVersion' = contract_version
    and observation_payload ->> 'observationId' = observation_id
    and observation_payload ->> 'resolverRunId' = resolver_run_id
    and observation_payload ? 'input'
    and observation_payload ? 'decision'
    and observation_payload ? 'versions'
    and observation_payload ? 'operational'
  )
);

create index idx_resolver_observations_owner_occurred_at
  on public.resolver_observations (owner_id, occurred_at desc);

alter table public.resolver_observations enable row level security;
revoke all on table public.resolver_observations from anon, authenticated;
grant select, insert, delete on table public.resolver_observations to authenticated;

create policy "Users can read their own resolver observations"
on public.resolver_observations for select to authenticated
using ((select auth.uid()) = owner_id);
create policy "Users can insert their own resolver observations"
on public.resolver_observations for insert to authenticated
with check ((select auth.uid()) = owner_id);
create policy "Users can delete their own resolver observations"
on public.resolver_observations for delete to authenticated
using ((select auth.uid()) = owner_id);

commit;
