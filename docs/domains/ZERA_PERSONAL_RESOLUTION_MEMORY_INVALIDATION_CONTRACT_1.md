# Zera — Personal Resolution Memory Invalidation Contract 1

Status: `accepted` for RESOLVER-V3-018, hardened for atomicity/graph-correctness by RESOLVER-V3-027.
Contract version: `personal-resolution-memory-invalidation-v1` (request/result/event shape unchanged by
V3-027; only the internal planning/commit mechanics and the repository port changed).

## Boundary

Invalidation is private and owner-scoped. It has no resolver read path, AI avoidance, catalog mutation,
candidate effect, similarity rule, or global projection. The repository fails closed if the caller has no
owner, names an unknown contract/reason, or attempts to target another owner. Audit records contain only
contract IDs, action IDs, memory IDs, closed reason/status/level values and timestamps—never raw input,
owner IDs, source user text, or arbitrary metadata.

## Closed request and result contract

Requests require a contract version, owner ID, memory ID, action ID, closed reason, and occurrence time.
Allowed reasons are `user_correction`, `explicit_user_delete`, `source_superseded`, `source_unavailable`,
`source_identity_changed`, `contradiction`, `dependency_invalidated`, `rollback`, and `account_deletion`.
Results are exactly `invalidated`, `weakened`, `already_inactive`, `not_found`, `blocked_owner_mismatch`,
`invalid_request`, or `failed`. Error codes are closed and never contain private payloads:
`unknown_contract_version`, `unknown_reason`, `missing_owner`, `missing_memory_id`, `owner_mismatch`,
`cycle_detected`, `traversal_limit_exceeded`, `invalid_dependency` (a dangling or cross-owner dependency edge;
added by RESOLVER-V3-027), `atomic_commit_failed` (the atomic commit phase itself failed; added by
RESOLVER-V3-027), and `repository_failed` (a planning-phase repository read failed unexpectedly).

## Transition matrix

| Current   | Cause                                 | Next         | Result           |
| --------- | ------------------------------------- | ------------ | ---------------- |
| active P0 | contradiction / identity changed      | contradicted | invalidated      |
| active P1 | user correction / source supersession | superseded   | invalidated      |
| active P1 | source unavailable                    | active P0    | weakened         |
| active P2 | explicit delete / source unavailable  | deleted      | invalidated      |
| inactive  | repeated event                        | unchanged    | already_inactive |
| any       | cross-owner, unknown version/reason   | unchanged    | fail closed      |

No invalidation returns a memory to `active`; a future restoration operation must be separately versioned
and audit its own transition. Historical evidence is never overwritten: invalidation writes one append-only
event while changing the current-state row.

## Dependencies and idempotence

Direct same-owner edges are persisted in `personal_resolution_memory_dependencies`; account deletion cascades
both state and edges. Cross-user edges are not traversed, and (as of RESOLVER-V3-027) cannot exist at all: a
composite foreign key binds both `(owner_id, memory_id)` and `(owner_id, depends_on_memory_id)` to
`personal_resolution_memories(owner_id, memory_id)` with `on delete cascade`, so an edge can only ever
reference a real row of the _same_ owner as the edge itself. The migration adds RLS, authenticated-only owner
policies, and no anon/global access.

## Plan-then-commit architecture (RESOLVER-V3-027)

RESOLVER-V3-018's original traversal wrote each transition immediately during a single BFS pass, so a later
`cycle_detected`/`traversal_limit_exceeded`/`repository_failed` result could leave earlier nodes already
mutated, its `visited` set treated every revisit (including a legitimate diamond re-convergence) as a cycle,
and an already-inactive node's `continue` skipped enqueueing its own dependents. RESOLVER-V3-027 replaces this
with two strictly separated phases; the request/result contract shape is unchanged.

**Phase 1 — plan (read-only).** The use case performs a pre-order depth-first traversal from the root, using
explicit `visiting`/`done` node coloring instead of a single visited set:

- a node reached while still `visiting` (on the current recursion path) is a **true cycle** — the whole plan
  is discarded and `cycle_detected` is returned with zero mutations;
- a node already `done` (fully planned via a different path) is a **legitimate diamond revisit** — it is not
  re-planned and does not produce a duplicate entry or event;
- an unvisited node is looked up, classified (`write` if `next()` produces a transition, `noop` if the node is
  already inactive), and its dependents are still traversed regardless of its own classification, so an
  already-inactive parent never blocks propagation to its active dependents;
- the traversal-limit check (100 distinct nodes) happens as each new node is first discovered, i.e. strictly
  before any write is even planned, let alone committed;
- a dependency lookup that returns `not_found` or `owner_mismatch` (a dangling or cross-owner edge — normally
  impossible after the migration above, but defended in depth at the application layer too) aborts the plan
  with `invalid_dependency`.

The result is a single immutable `PersonalResolutionMemoryInvalidationPlan`: action ID, owner scope, root
memory ID, an ordered list of entries (memory ID, reason, previous/next status and level, `write`/`noop`
classification, and — for `write` entries — the fully-formed audit event with its `actionId:memoryId` event
ID), and the final business result (`invalidated` / `weakened` / `already_inactive`, based on the root entry's
own classification, plus the ordered list of actually-written memory IDs).

**Phase 2 — atomic commit.** `PersonalResolutionMemoryInvalidationRepository.applyInvalidationPlanAtomically`
is the only write operation on the port. It must apply every planned state change and every planned audit
event as one all-or-nothing unit — no per-node write is ever separately committed, and a failure at any point
must leave the previously observable state and event history byte-for-byte unchanged. The in-memory adapter
implements this by staging every write against a copy of its internal maps and only swapping the copies into
the live state after the entire plan has applied without error; a test-only failure-injection hook
(`injectCommitFailureAtWriteIndex`) can force a throw at any position to prove the rollback is real, including
for the first, a middle, and the last planned write.

**Idempotence.** The action ID is the sole idempotency boundary, enforced _before_ planning: the use case asks
the repository for a previously committed result for `(ownerId, actionId)` and, if found, returns it directly
without touching the graph again. This is important because re-planning from _current_ state after a
successful run would see already-inactivated nodes and (correctly, but confusingly) compute a fresh
`already_inactive` plan with no writes — which is not the same business result as the original run. Returning
the previously committed result instead guarantees a literal repeat produces the exact same result and no new
mutation or audit event, while a genuinely new action ID against an already-inactive graph still gets its own
(zero-write, `already_inactive`) outcome rather than silently reusing someone else's.

## Current productive adapter boundary (explicit, RESOLVER-V3-027)

The only implementation of `PersonalResolutionMemoryInvalidationRepository` in this repository is the
in-memory contract adapter (`InMemoryPersonalResolutionMemoryInvalidationRepository`), which now provides
true plan-then-commit atomicity as specified above. **There is no production Supabase adapter for this port.**
No repository, RPC function, or stored procedure exists anywhere in this codebase — this task did not invent
one, because there is no existing precedent in the codebase for calling a Postgres RPC/stored function from a
repository adapter (every real Supabase write path in this repository is a plain client-side
`.from(...).insert()/.update()/.delete()` call, not a server-side transaction). A future production adapter
that needs the same all-or-nothing guarantee across multiple tables would most likely need a `security
definer`, owner-scoped, closed-input Postgres function performing the plan write inside one transaction, since
client-side sequential Supabase calls cannot themselves guarantee atomicity across multiple `update`/`insert`
statements. This task deliberately does not build or authorize such a function; it hardens the schema
(referential integrity, still no RLS/grant change) and the pure planning/application logic, which is what
RESOLVER-V3-019 (a read path) and any future production writer both depend on being correct first.

## Available integration signals and V3-019 handoff

The current repository has a private state/event schema and contracts but no production personal-memory
writer or invalidation adapter wired into correction, journal deletion, alias deletion, portion-hint deletion,
or source-update flows. Consequently no user intent is inferred and no journal action is coupled here.
Correction and journal actions are technically identifiable but do not currently carry a memory ID/action
mapping; source supersession/unavailability and identity changes likewise have no product signal. They are
therefore available only through this explicit port. V3-019 may add a private, exact-match read path only
after preserving this inactive-state contract; it must not re-enable invalidated entries. RESOLVER-V3-019 may
now build on this invalidation path once RESOLVER-V3-026 (write integration) is also complete — the previous
`RESOLVER-V3-027`-in-progress block on V3-019 is lifted as of this task, but V3-026 is untouched and remains a
separate, still-open dependency (see `ROADMAP.md`).
