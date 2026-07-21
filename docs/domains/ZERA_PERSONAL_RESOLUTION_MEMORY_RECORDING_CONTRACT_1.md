# Zera — Personal Resolution Memory Recording Contract 1

Status: `accepted` for RESOLVER-V3-026.
Contract version: `personal-resolution-memory-recording-v1` (the use case's own request/result
contract; distinct from the memory model's own `personal-resolution-memory-v1`, exactly as the
sibling invalidation port has its own `personal-resolution-memory-invalidation-v1`).

## Boundary

Recording is private and owner-scoped. It has no resolver read effect, no AI-avoidance behavior,
no candidate effect, and no global projection — it only turns a real signal into one new,
immutable `PersonalResolutionMemory` plus its evidence/transition (and, for corrections, negative
evidence) audit events, through RESOLVER-V3-017's `PersonalResolutionMemoryRepository.record` port.

## What this task closes from the RESOLVER-V3-017 review findings

Per `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`, RESOLVER-V3-017
shipped a correct contract and migration but no production use case ever called `record`, and
`personal_resolution_memory_events` granted `authenticated` `update`/`delete` under a single
`for all` policy, so the audit trail was not actually append-only. This task adds:

- `RecordPersonalResolutionMemoryUseCase` (`src/features/nutrition/application/usecases/RecordPersonalResolutionMemoryUseCase.ts`),
  the first and only production caller of `PersonalResolutionMemoryRepository.record`.
- `SupabasePersonalResolutionMemoryRepository`, the first production adapter for that port
  (previously it had zero implementations and zero call sites anywhere in `src/`).
- Migration `supabase/migrations/20260721150000_harden_personal_resolution_memory_audit_append_only.sql`,
  which revokes `update`/`delete` on `personal_resolution_memory_events` from `authenticated`. RLS
  policies are evaluated only after the table-level privilege check, so this alone makes the table
  genuinely append-only without touching the existing policy, RLS enablement, or
  `personal_resolution_memories` (whose own `update` grant is unchanged and still required for
  state transitions written by the invalidation flow).

## Idempotent action-ID boundary

Every call creates exactly one new memory — there is no read path to merge into an existing one
(that is RESOLVER-V3-019's job, and remains out of scope here). The action ID supplied by the
caller is the sole idempotency boundary and, by construction, is also the new memory's ID:
`memoryId = actionId`, `evidenceId = ${actionId}:evidence`, `transitionId =
${actionId}:transition`, and (for corrections) `negativeEvidenceId = ${actionId}:negative`. A
literal retry therefore always re-derives byte-identical IDs; the underlying tables are unique on
`(owner_id, memory_id)` and `(owner_id, event_id)`, so a retry is absorbed by the database rather
than requiring the use case itself to check for a prior write first (there is no read API to do
so with).

## Evidence-to-level mapping and correction precedence

`RecordPersonalResolutionMemoryUseCase` reuses RESOLVER-V3-017's existing
`promotionForEvidence(contractVersion, evidenceType)` unchanged — it does not re-derive the
evidence→level mapping. Correction precedence is enforced structurally, not inferred:
`explicit_correction` evidence is rejected with `correction_requires_prior_memory_id` unless the
caller names the specific prior memory it overrides; naming one always produces a
`PersonalResolutionNegativeEvidence` event (`reason: 'user_correction'`) against that prior memory
and sets the new memory's `supersedesMemoryId`/`correctionReference`. A correction can therefore
never be silently dropped or misrecorded as mere confirmation. This task does not additionally
invalidate (transition to `contradicted`/`superseded`) the prior memory's own row — that remains
RESOLVER-V3-018/027's separate invalidation port's responsibility, composed only where a real
caller supplies both a `priorMemoryId` and drives that separate flow. No such composition exists
today because no real correction-of-identity signal exists yet (see below).

## Available integration signals (what is real today, and what is not)

Per an explicit pre-implementation inventory (do not invent a signal not found here):

| Evidence type                                                                 | Real, wired signal?           | Where                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ----------------------------------------------------------------------------- | ----------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `logged_without_explicit_confirmation` (P0)                                   | **Yes**                       | `resolvePreparedNutritionInputs.ts`, immediately after `LogFoodFromRawInputUseCase.execute()` returns a persisted entry with a `foodCatalogRef`. This is the sole real journal-logging pipeline (`logResolvedNutritionInput` → `resolvePreparedNutritionInputs`, used by `InputBar.tsx` and `JournalScreen.tsx`'s normal submit).                                                                                                                                                                                                                                                        |
| `deliberate_candidate_selection` (P1)                                         | **Yes, narrowly**             | Only the Speck disambiguation flow: `JournalScreen.tsx`'s `handleSelectSpeckChoice` passes `{ evidenceType: 'deliberate_candidate_selection' }` when resubmitting the user's chosen qualified term. There is no general resolver-candidates picker anywhere else in the product — `ResolverDecision.candidates` is produced internally but never surfaced to any UI, so this evidence type must not be wired to any other call site until a real one exists.                                                                                                                             |
| `deliberately_saved_personal_meal` (P2)                                       | **Yes**                       | `CreateSavedMealFromDateUseCase`, after persisting a named template the user explicitly created from `SavedMealsScreen.tsx`'s "create from today" action — for each item that carries a `foodCatalogRef`.                                                                                                                                                                                                                                                                                                                                                                                |
| `explicit_confirmation` (P2)                                                  | **No**                        | No confirm-this-food/swipe-to-confirm UI exists anywhere. `PortionKnowledgeService.confirmUserPrivateHint` confirms a portion/grams-per-unit hint, a different domain object; the post-submit "N gespeichert" panel is passive display, not a user action, and fires on every save including plain logging. Neither is a legitimate signal for this evidence type.                                                                                                                                                                                                                       |
| `explicit_correction` (P2)                                                    | **No**, not for food identity | `EditFoodEntryFromNaturalLanguageUseCase`/`ApplyNaturalLanguageEditUseCase` only correct quantity/portion (grams, multiplier, count); neither ever changes `foodCatalogRef` or invokes the resolver. Wiring `explicit_correction` there would invent an identity-correction intent the user never expressed. The use case itself fully supports this evidence type (tested directly), but it has no production caller today — exactly like RESOLVER-V3-018/027's invalidation port, which also ships complete, tested logic with no production caller because no real signal exists yet. |
| `manual_personal_definition`, `repeated_source_grounded_use`, `contradiction` | **No**                        | No wired signal for any of these exists in the current product either.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

`locale` is always `'de'` in production today — the resolver is called with a hardcoded locale
everywhere; this is not a gap introduced by this task.

## Current productive adapter boundary (explicit)

`SupabasePersonalResolutionMemoryRepository` performs plain, sequential client-side
`.from(...).insert()` calls against `personal_resolution_memories` and
`personal_resolution_memory_events` — there is no RPC/stored-function precedent anywhere in this
codebase (confirmed again for this task; see the RESOLVER-V3-027 invalidation contract for the
same finding), so no cross-table transaction is attempted. Safety instead comes from the
deterministic, actionId-derived IDs above: a duplicate-key error (`23505`) on any insert is treated
as "this exact row already exists," and a retry after a partial failure (e.g. the memory row wrote
but an event row did not) still succeeds, because the memory insert is naturally absorbed as a
duplicate while the missing event row gets a fresh, non-conflicting insert attempt. A
non-duplicate error on any insert is reported as `'failed'`, even if the memory row itself
persisted, so a caller never mistakes a partially-written action for a complete one.

## Non-goals

No resolver read effect (RESOLVER-V3-019), no AI-avoidance behavior, no change to the
RESOLVER-V3-018/027 invalidation port or its own migrations, and no new evidence type or contract
field beyond what RESOLVER-V3-017 already defined.
