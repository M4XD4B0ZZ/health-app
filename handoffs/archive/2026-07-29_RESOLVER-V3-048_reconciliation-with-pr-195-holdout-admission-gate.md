# Handoff — RESOLVER-V3-048 reconciliation with concurrently merged PR #195 (Holdout Admission Gate) (2026-07-29)

1. **Task ID/status:** RESOLVER-V3-048 — status unchanged from the entry below
   (`in_progress — ... live Development not authorized`). This entry documents reconciling PR #196
   (the dispatch-lease/authorization-binding closure below) with PR #195 (Holdout Admission Gate),
   which was merged into `chore/clean-arch-structure` by the user while PR #196 was open. Basis for
   this reconciliation: `origin/chore/clean-arch-structure` at `79a86b2` (PR #195's merge commit).
2. **What changed:** PR #195 added a real, artifact-validated third Holdout authorization path
   (`ResolverV3048ProtocolV4HoldoutAdmission.ts`) whose only proof of compatibility with the Holdout
   Runner was a compile-time type-assignability check against the MINIMAL structural authorization
   interface (`ProtocolV4HoldoutRunnerAuthorizationInput`) that PR #196's own remediation (item below,
   §35.6 of the preflight report) had already removed in favor of a self-validating discriminated
   union. Merging both independently would have broken PR #195's module. Resolved by merging
   `origin/chore/clean-arch-structure` into this branch and reconciling: extended
   `ProtocolV4HoldoutAuthorizationInput` with a third `kind: 'holdout_admission'` branch carrying the
   real Admission Record/Plan/Authorization chain; wired it through the same self-validating
   `assertProtocolV4HoldoutAdmissionAuthorized` gate pattern as the other two branches; added
   `claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization` (symmetric to the existing
   Development/Dry-Run-Holdout claim wrappers); replaced the Admission module's own test file's
   compile-time-only compatibility check with two real runtime tests (a genuine end-to-end dispatch
   through the hardened Runner, and proof that a fabricated minimal authorization still cannot reach
   it). Full detail: `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md` §35.13.
3. **Why it changed:** this repository's own governance (`AGENTS.md`'s "Git Branch Sync After
   Push/Pull") requires comparing diffs of overlapping open PRs before merging either; the user was
   asked and chose to have this branch's PR opened without merging so both could be reviewed together,
   then asked for the logical merge decision once PR #195 had already been merged independently.
4. **Files changed (this reconciliation, on top of the entry below):**
   `ResolverV3048ProtocolV4HoldoutRunner.ts` (third discriminated-union branch + resolution logic),
   `ResolverV3048ProtocolV4ExecutionLease.ts` (new `claimProtocolV4ExecutionLeaseForHoldoutAdmissionAuthorization`),
   `__tests__/ResolverV3048ProtocolV4HoldoutAdmission.test.ts` (compile-time check replaced with two
   real runtime dispatch tests); `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md` (additive
   §35.13); this handoff entry. `ResolverV3048ProtocolV4HoldoutAdmission.ts` itself (PR #195's own new
   module) was not modified.
5. **Verification executed/result:** `npm run typecheck` (clean, first pass after merge), `npm run
lint` (clean), `npm run format`/`format:check` (clean), `npx jest --runInBand
src/features/nutrition/benchmark/protocolV4` (7 suites / 164 tests, all passing — including the two
   new Admission↔Runner integration tests), `npx jest --runInBand src/features/nutrition/benchmark`
   (77 suites / 909 tests, all passing), `npm run verify` (full repo, run to completion) — **253 suites
   / 2718 tests passed**, 961.921 s, exit code 0.
6. **Known issues/blockers/residual risks:** unchanged from the entry below — G2 not passed, V3-010
   blocked, V3-048 in_progress, no live execution, no `human_live` authorization ever constructed by
   this task (the new `kind: 'holdout_admission'` branch remains structurally present and unexercised
   by the Mini-Run, exactly like the pre-existing `selection_record` branch).
7. **Human review/next steps:** review the reconciliation diff in
   `ResolverV3048ProtocolV4HoldoutRunner.ts`/`ResolverV3048ProtocolV4ExecutionLease.ts` and the two new
   Admission integration tests; then merge PR #196 (this branch), now current with
   `chore/clean-arch-structure` including PR #195.

---
