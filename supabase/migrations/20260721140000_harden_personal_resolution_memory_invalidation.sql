-- RESOLVER-V3-027: referential integrity for personal resolution memory dependency edges.
-- Additive-only hardening of the RESOLVER-V3-018 dependency table. Historical migrations are not
-- modified. Both edge sides are bound to the same-owner memory row via a composite foreign key on
-- (owner_id, memory_id), which structurally rules out cross-owner and dangling edges: since a single
-- dependency row carries one owner_id, both foreign keys forcing that exact owner_id to match a real
-- personal_resolution_memories row make it impossible for memory_id and depends_on_memory_id to
-- belong to different owners, or to reference a memory row that does not exist.
begin;
alter table public.personal_resolution_memory_dependencies
  add constraint personal_resolution_memory_dependencies_memory_fk
  foreign key (owner_id, memory_id)
  references public.personal_resolution_memories (owner_id, memory_id)
  on delete cascade;
alter table public.personal_resolution_memory_dependencies
  add constraint personal_resolution_memory_dependencies_depends_on_fk
  foreign key (owner_id, depends_on_memory_id)
  references public.personal_resolution_memories (owner_id, memory_id)
  on delete cascade;
commit;
