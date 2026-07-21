-- RESOLVER-V3-026: make the personal resolution memory audit-event table genuinely append-only.
-- Additive-only hardening: the RESOLVER-V3-017 migration granted `authenticated` `update`/`delete`
-- on `personal_resolution_memory_events` under a single `for all` owner policy, which made
-- audit-event tampering/removal technically possible for the row's own owner. RLS policies are
-- only evaluated after the table-level privilege check, so revoking the privilege here is
-- sufficient on its own to close the gap without touching the existing policy, RLS enablement,
-- or `personal_resolution_memories` (whose own `update` grant is unaffected and still needed for
-- state transitions written by invalidation/recording flows). No historical migration is modified.
begin;
revoke update, delete on public.personal_resolution_memory_events from authenticated;
commit;
