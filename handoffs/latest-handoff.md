# Handoff — RESOLVER-V3-048: Phase B1 Post-Merge Remediation (Durable Live Evidence Finalization, 2026-07-30)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. Phase B1's post-merge remediation is
   complete; **no live run happened**. Branch: `claude/resolver-v3-048-phase-b1-post-merge-remediation`.
   Basis: `2dc5e3e` (PR #203 merge, tip of `chore/clean-arch-structure` at task start). PR #203 remains
   merged and was not reverted. **Actual consumption: 0 provider calls, 0 tokens, USD 0.00.** G2 remains
   `not passed`; `RESOLVER-V3-010` remains `blocked`; Holdout remains unexecuted and unauthorized.

2. **What changed:** an independent post-merge review of PR #203 found five reproducible defects in the
   Phase B1 live-dispatch wiring; all five are fixed:
   - **Defect 1 (in-memory-only evidence):** `runProtocolV4DevelopmentForCandidate`/
     `runProtocolV4DevelopmentForAllCandidates` gained a `human_live`-only branch that durably writes
     and reads back (root-bound, content-hash-revalidated) every Development artifact — per candidate:
     raw results, category table, telemetry, ledger, then evaluation, then the checkpoint commit marker
     LAST; shared: plan manifest and candidate evaluation table. `fake_dry_run` is untouched.
   - **Defect 2 (premature terminal_success):** for `human_live`, the lease now reaches
     `terminal_success` only after every artifact above is durable, the Development Evidence Root is
     derived from the stored hashes, and the authorization is atomically consumed — matching the
     mandated 13-step order. `fake_dry_run`'s ordering is unchanged.
   - **Defect 3 (incomplete storage preflight):** new `protocolV4DevelopmentArtifactContractRelativePaths(plan)`
     derives every Development-phase target generically from `plan.artifactContract`; the live entry
     point's preflight now checks all of them (previously only 3 checkpoint paths).
   - **Defect 4 (cross-root readback):** `readWithReadback` now validates the absolute path against its
     own bound canonical root before reading; both public readback functions gained an optional
     `repoRoot`.
   - **Defect 5 (Windows-unsafe authorization IDs):** new `ResolverV3048ProtocolV4StorageKey.ts` derives
     a single deterministic, collision-resistant, platform-neutral storage key (base64url of the UTF-8
     id) used uniformly for lease directories/versions, crash detection, the authorization-consumption
     marker, and recovery. `authorizationId` itself is unchanged everywhere else; separators/traversal
     remain rejected on the original id.
   - Two existing test files' lease-directory assertions were updated to derive the same path via the
     new storage-key function (their internal-layout assumption changed; no other assertion changed).
   - Docs: `ROADMAP.md` (`Current Focus`, RESOLVER-V3-048 status, new dated remediation entry), new
     Phase B1 post-merge remediation report, this handoff, prior handoff archived.

3. **Why it changed:** PR #203's Phase B1 wiring made a real live dispatch path reachable but never
   made its evidence durable, never enforced the correct terminal-state ordering, preflighted only a
   subset of canonical targets, allowed cross-root readback, and would break on Windows for any
   authorization ID containing `:` — all five found by an independent post-merge review before any
   maintainer issues a new live authorization against this code.

4. **Files changed:**

   ```
   M  ROADMAP.md
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ArtifactStore.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.test.ts
   A  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4StorageKey.ts
   A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts
   A  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B1_POST_MERGE_REMEDIATION.md
   A  handoffs/archive/2026-07-30_RESOLVER-V3-048_phase-b1-live-development-wiring.md
   M  handoffs/latest-handoff.md
   ```

5. **Verification executed** (VERIFY.md Category 4, product/runtime code):

   ```
   npx tsc --noEmit -p tsconfig.json                                  # repo-wide typecheck
   npx eslint .                                                       # repo-wide lint
   npx prettier -c <every changed/added file>                        # targeted format check
   npx jest --runInBand .../ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4  # full protocolV4 area
   npx jest --runInBand src/features/nutrition/benchmark            # full nutrition-benchmark area
   npx jest --runInBand                                              # full repo suite
   git --no-pager diff --check
   git --no-pager status --short / diff --stat
   ```

6. **Verification result:**
   - `tsc --noEmit`: **PASS**, 0 errors.
   - `eslint .`: **PASS**, 0 errors/warnings.
   - `prettier -c` over every changed/added file: **PASS** ("All matched files use Prettier code
     style!") — after one `prettier -w` fix on two files during development.
   - New test file: **PASS**, 16/16.
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 206/206 (10 suites; was 190/190
     before this task's 16 new tests).
   - `jest src/features/nutrition/benchmark`: **PASS**, 951/951 (80 suites).
   - Full repo `jest --runInBand`: **[PENDING — background run in progress at handoff-write time; see
     final status update below before treating this task as done]**.
   - `git diff --check`: **PASS**, no whitespace/conflict-marker issues.
   - Evidence integrity re-checked directly: `logs/resolver-v3-048-protocol-v4` does not exist under the
     real repo root; `git status --porcelain logs/` is empty (no `logs/resolver-v3-039-*` file touched).

7. **Known issues, blockers, residual risks:**

   a. The 8 pre-existing Windows-local test failures the Phase B1 report documented (colon-containing
      authorization IDs, e.g. `` `mini-run-development:${planHash}` ``, becoming invalid Windows
      directory names) are addressed by this task's storage-key fix, which applies uniformly to every
      authorization ID the lease/artifact-store modules see — not special-cased. On this Linux
      environment these 8 tests were already passing before and after this task (they never reproduced
      here); a new structural test now proves the derived storage key for these exact ID shapes matches
      the Windows/Linux/macOS-safe alphabet `^[A-Za-z0-9_-]+$`, rather than relying solely on "expected
      not to reproduce on Windows CI". Green GitHub Verify remains the authoritative real-CI
      confirmation, per this repository's established convention.

   b. **The PR #202 authorization (324 calls / USD 5.142528) must NOT be reused** — unchanged from the
      Phase B1 report's own conclusion; this task changes the dispatch/persistence code again, so any
      future authorization must be re-verified against this new commit.

   c. Residual risk: the `human_live` path has never executed against a real provider. It is proven
      reachable, correct, and now genuinely DURABLE only zero-network (`global.fetch` mocked, placeholder
      key, isolated temp storage). Real-provider behavior — actual token/cost records, real latencies,
      real error shapes, real filesystem behavior on a real Windows machine — is unproven by
      construction.

   d. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized. Holdout stays a
      separate, later human decision, and no Holdout code was touched by this task.

8. **Human-review status / next steps:**
   - **Not yet reviewed.** Needs review of this branch's diff and a green GitHub Verify before merge.
   - Next step is **not** another remediation pass unless CI surfaces something new. It is a maintainer
     decision: (1) add `ANTHROPIC_API_KEY` to the existing `.env` (an agent may not), and (2) issue a
     **new** live Development authorization checked against this commit. Only then can a live
     Development run happen.
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
