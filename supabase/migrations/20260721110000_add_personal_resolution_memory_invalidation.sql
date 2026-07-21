-- RESOLVER-V3-018: owner-private, append-only invalidation audit and direct dependency edges.
begin;
create table public.personal_resolution_memory_dependencies (
  id uuid primary key default extensions.uuid_generate_v4(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  memory_id text not null,
  depends_on_memory_id text not null,
  created_at timestamptz not null,
  unique(owner_id, memory_id, depends_on_memory_id),
  check (memory_id <> depends_on_memory_id)
);
alter table public.personal_resolution_memory_dependencies enable row level security;
revoke all on public.personal_resolution_memory_dependencies from anon;
grant select, insert, delete on public.personal_resolution_memory_dependencies to authenticated;
create policy "owner private memory dependencies" on public.personal_resolution_memory_dependencies
  for all to authenticated using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
-- Event payload is structured by the v1 contract; unique owner/event_id makes retries idempotent.
alter table public.personal_resolution_memory_events drop constraint if exists personal_resolution_memory_events_event_type_check;
alter table public.personal_resolution_memory_events add constraint personal_resolution_memory_events_event_type_check
  check (event_type in ('evidence', 'transition', 'negative_evidence', 'invalidation'));
commit;
