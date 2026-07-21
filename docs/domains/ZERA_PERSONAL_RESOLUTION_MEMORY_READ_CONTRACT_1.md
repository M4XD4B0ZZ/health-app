# Zera — Personal Resolution Memory Read Contract 1

Status: `accepted` for RESOLVER-V3-019.
Contract version: `personal-resolution-memory-read-v1`.

## Boundary

The read path is private, owner-scoped, and exact-match only. A "target" is the same
`{sourceType, sourceId}` pair the write path (RESOLVER-V3-017/026) already records against — the
scope key `${sourceType}:${sourceId}` is identical on both sides. There is no raw-query lookup, no
fuzzy/near-match store, no cross-user cache, and no global candidate effect. The port only ever
returns rows with `status = 'active'`; invalidated/superseded/contradicted/deleted memories
(RESOLVER-V3-018/027) are never eligible and this task does not re-enable them.

## Why exact-match, target-keyed, not query-keyed

`personal_resolution_memories.scope_key` is built from the **resolved food identity**
(`${foodCatalogRef.source}:${foodCatalogRef.sourceId}`), not from the raw or normalized input
text — this is what RESOLVER-V3-026 already writes from `resolvePreparedNutritionInputs.ts`. The
read path therefore cannot answer "what did this raw text mean before?" (that would require
storing/matching free text, and the Decision Record explicitly forbids personal raw text
silently globalizing or being used for aggressive similar-input transfer). It can only answer "has
this owner previously confirmed _this specific, already-independently-found_ catalog item?" — a
strictly narrower, privacy-safer question that requires the deterministic sources (BLS/OFF/USDA)
to have already found the candidate on their own.

## Contract

```
PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION = 'personal-resolution-memory-read-v1'

ReadPersonalResolutionMemoryRequest { contractVersion, ownerId, targets: {sourceType, sourceId}[] }
PersonalResolutionMemoryReadResult  { status, code?, matches: PersonalResolutionMemoryReadMatch[] }
PersonalResolutionMemoryReadMatch   { memoryId, sourceType, sourceId, level, eligibility }
PersonalResolutionMemoryReadEligibility { deterministicReuse: boolean, preferred: boolean }
```

Status is exactly `ok | no_owner | invalid_request | failed`. Error codes are exactly
`unknown_contract_version | missing_owner | no_targets`. A `no_owner`/`invalid_request`/`failed`
result always carries an empty `matches` array — there is no partial-failure shape.

## Eligibility policy (Decision Record §6, verbatim)

| Level            | `deterministicReuse` | `preferred` | Rationale                                                                 |
| ---------------- | -------------------- | ----------- | ------------------------------------------------------------------------- |
| `P0_observed`    | `false`              | `false`     | Weak, analyzable/re-suggestible only; MUST NOT aggressively transfer.     |
| `P1_provisional` | `false`              | `true`      | MAY be preferred for identical/very close input; MUST remain correctable. |
| `P2_confirmed`   | `true`               | `true`      | MAY be deterministically reused for this owner and MAY avoid an AI call.  |

This mapping lives in exactly one place, `PersonalResolutionMemoryReadEligibilityPolicy`, so no
call site can invent its own reuse rule. `findActiveByScopeKeys` still returns `P0_observed` rows
(so the caller can distinguish "no memory" from "only weak memory") — it is the eligibility
policy, not the repository filter, that makes P0 unusable for reuse or preference.

## Resolver integration (`PersonalResolutionMemoryAwareFoodCatalogResolver`)

RESOLVER-V3-019 wires the read path in as a decorator around any `FoodCatalogResolver`, not as a
change inside `SequentialFoodCatalogResolver` itself — this keeps the new capability fully
isolated from that resolver's existing, heavily-tested internals, and makes the integration a
one-line composition-root change (`container.ts`) rather than a change to a shared hot path.

1. The base resolver runs unchanged and returns its normal `ResolverDecision`, complete with
   `candidates` (deterministic sources always populate this, even for a `rejected`/`ambiguous`
   decision — that is exactly the "would otherwise need AI/clarification" case this task targets).
2. `'user'`-sourced candidates (`SupabaseUserAliasSource`, the alias fast path) are excluded from
   lookup — a different, already-deterministic personal-data mechanism; mixing the two would blur
   this read boundary.
3. If there is no authenticated owner, no non-`user` candidates, the read use case fails, or there
   is no match at all, the original decision is returned completely unchanged (`===`, not a
   reconstructed equal object) — this is a hard fail-open guarantee, proven by reference-identity
   assertions in the test suite, not just value equality.
4. A `P2_confirmed` active match on one of the resolver's own candidates deterministically selects
   that candidate as `best`, sets `status: 'accepted'`, and its score/`breakdown.finalScore` to a
   fixed `0.95` (below `1.0`, reserved for a literal exact deterministic match elsewhere; above
   `ACCEPT_THRESHOLD` and any plausible second-best delta) so it wins in
   `LogFoodFromRawInputUseCase`'s `resolved.score >= 0.7` gate and `LogMealFromRawInputUseCase`'s
   `status === 'accepted'` gate. `reasonCodes` gains `PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI`.
   If the decision was already `accepted` with that exact candidate as `best`, the object is left
   untouched (only the reason code is appended) and the outcome is not counted as "avoided" in
   telemetry — a redundant confirmation is not a saved call.
5. A `P1_provisional`-only match never overrides `best`/`status` (per the Decision Record, it "MUST
   remain visibly correctable") — it only appends `PERSONAL_MEMORY_P1_PREFERRED` to `reasonCodes`
   for transparency/telemetry.
6. A `P0_observed`-only match changes nothing at all — no reason code, no telemetry side channel
   beyond the raw counts (which are always recorded).
7. Any exception anywhere in the lookup (owner provider throw, read use case throw, anything) is
   caught in `resolve()` itself and the original base decision is returned — a personal-memory
   failure can never become a resolution failure.

## Telemetry ("avoided AI calls MUST be measurable")

`PersonalResolutionMemoryReadTelemetry.record(...)` is called on every lookup attempt (never
skipped, never hard-coded to a fixed value) with real counts: `targetCount`, `matchCount`,
`deterministicReuseMatchCount`, `preferredMatchCount`, and a boolean `avoided` that is only `true`
when a `P2_confirmed` match genuinely changed the outcome (see point 4 above). The production
adapter, `ConsolePersonalResolutionMemoryReadTelemetry`, is deliberately dependency-free: it prints
only counts and closed enum values (no raw input, no food/candidate identity, no owner ID) behind
the same `isDebugLoggingEnabled()` gate already used for other resolver diagnostics, and is a
guaranteed no-op outside that gate. This is a real, honest measurement mechanism — not the
hard-coded-to-zero pattern the RESOLVER-V3-020/022 post-implementation review flagged as a defect.

**Known boundary:** this telemetry channel is independent of the pre-existing
`ResolverRunLogger`/`ResolverObservationWriter` sinks. Those are called _inside_
`SequentialFoodCatalogResolver.resolve()`, before this decorator ever sees the decision, so they
persist the **base** decision (pre-personal-memory-override) — this is intentional (it records what
the deterministic sources actually found) but means the P2/P1 reason codes added by this decorator
are not currently persisted to `food_resolver_runs`/`resolver_observations`. A future task may
choose to also feed this decorator's output back into those sinks; this task does not, to keep its
own blast radius limited to the new files plus one composition-root wiring change.

## Why no migration

`personal_resolution_memories` already grants `authenticated` `select` (under the RESOLVER-V3-017
`for all` owner-scoped RLS policy — `for all` covers `select`) — nothing in this task needs a new
privilege, a new table, or a new column. `SupabasePersonalResolutionMemoryReadRepository` filters
`owner_id`/`status`/`scope_key` explicitly in the query and RLS enforces the same owner scope again
independently (defense in depth). This task therefore ships **zero** migrations.

## Non-goals (explicit)

No cross-user cache; no global candidate read/effect; no near-match/fuzzy transfer; no change to
`SequentialFoodCatalogResolver` itself; no actual AI/hybrid production wiring (RESOLVER-V3-010
remains blocked and unrelated — "avoiding an AI call" is measured against what a future hybrid path
would need to escalate for, not against a real AI call that exists today); no re-activation of an
invalidated memory; no persistence of this decorator's reason codes into the pre-existing resolver
telemetry sinks (see the Known boundary above).
