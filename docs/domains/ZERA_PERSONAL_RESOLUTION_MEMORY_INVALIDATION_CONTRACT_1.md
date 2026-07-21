# Zera — Personal Resolution Memory Invalidation Contract 1

Status: `accepted` for RESOLVER-V3-018. Contract version: `personal-resolution-memory-invalidation-v1`.

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
`invalid_request`, or `failed`; error codes are closed and never contain private payloads.

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
both state and edges. Traversal is breadth-first, deterministic by stored dependency order in the in-memory
contract adapter, rejects cycles, and stops at 100 nodes. Each action produces a stable `actionId:memoryId`
event ID, so retrying an already applied event is a no-op and does not add audit history. Cross-user edges are
not traversed. The migration adds RLS, authenticated-only owner policies, and no anon/global access.

## Available integration signals and V3-019 handoff

The current repository has a private state/event schema and contracts but no production personal-memory
writer or invalidation adapter wired into correction, journal deletion, alias deletion, portion-hint deletion,
or source-update flows. Consequently no user intent is inferred and no journal action is coupled here.
Correction and journal actions are technically identifiable but do not currently carry a memory ID/action
mapping; source supersession/unavailability and identity changes likewise have no product signal. They are
therefore available only through this explicit port. V3-019 may add a private, exact-match read path only
after preserving this inactive-state contract; it must not re-enable invalidated entries.
