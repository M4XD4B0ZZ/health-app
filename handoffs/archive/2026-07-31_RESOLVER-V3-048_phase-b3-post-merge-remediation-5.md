# Handoff — RESOLVER-V3-048: Phase B3 Post-Merge Remediation 5 (Trusted Failure Metadata, Non-Fabricated Usage, 2026-07-31)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates two combined
   critical findings from an independent post-merge review of PR #206 (Phase B3 launcher, four times
   remediated), merged as `207c55a33d5753472744cea5de7290d17a50e005` into `chore/clean-arch-structure`
   (PR head tree `62c8e3dfcb2427335cf8d0fd7db77df6ebd5cf25`). The review verdict was
   `REMEDIATION_REQUIRED`. **No live run happened.** Branch:
   `fix/resolver-v3-048-post-merge-remediation-5`. **Actual consumption: 0 provider calls, 0 tokens,
   USD 0.00.** G2 remains `not passed`; `RESOLVER-V3-010` remains `blocked`; Holdout remains
   unexecuted, unauthorized, and unreferenced.

2. **The combined critical defect:**
   - Several domain error classes classified as "guaranteed pre-dispatch" by
     `isKnownPreDispatchError` in `scripts/run-resolver-v3-048-live-development.mjs` are actually
     reachable AFTER real provider dispatch already happened for the run in question (see CodeGraph
     evidence in section 5 below): `ProtocolV4ExecutionLeaseError`, `ProtocolV4ArtifactStoreError`,
     `ProtocolV4ArtifactCrashError` (all explicitly named in the task), plus two more found during
     this remediation's own throw-site inspection: `ProtocolV4DevelopmentAuthorizationError`
     (`assertDevelopmentAuthorized`'s own budget/identity checks re-run for the 2nd/3rd candidate,
     after the 1st candidate already dispatched) and `ProtocolV4LiveExecutionContextError`
     (`runProtocolV4Attempt` calls `buildFastPathTerminal` AFTER the real dispatch `attempt()` already
     ran, so this can fire after a real `fetch`).
   - `protocolV4FailureUsageSnapshot`/`protocolV4LeaseFinalizationStatus` were plain, freely-settable
     properties on the thrown error, read directly by `summarizeFailureUsage`. A foreign error could
     pre-populate either property; if the real attachment then failed (frozen/non-extensible error,
     non-writable property, throwing setter/Proxy trap), the foreign value survived untouched and was
     trusted as authoritative.
   - Combined: after real provider usage, the launcher could report a fabricated
     `usageAccounting: 'exact'` / `providerHttpRequests: 0` / `confirmedCostUsd: 0`.

3. **What changed:**
   - **Remediation A (non-spoofable side channel):** new file
     `src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4FailureMetadataSideChannel.ts`
     — two module-private `WeakMap`s (`failureUsageSnapshots`, `leaseFinalizationStatuses`), never
     exported, keyed strictly on the error object's own identity. Trusted
     `setProtocolV4FailureUsageSnapshot`/`setProtocolV4LeaseFinalizationStatus` (used only by
     `ResolverV3048ProtocolV4DevelopmentRunner.ts`) and read-only
     `readProtocolV4FailureUsageSnapshot`/`readProtocolV4LeaseFinalizationStatus` (re-exported,
     read-only, via `launcherBridge.ts`). `attachProtocolV4FailureUsageSnapshot`/
     `attachProtocolV4LeaseFinalizationStatus` no longer write a property (and no longer need the
     `try`/`catch` that used to guard that write — `WeakMap.set` on an object key never touches any
     property of that key or invokes a getter/setter/Proxy trap, so it cannot throw for a
     frozen/sealed/non-extensible/Proxy-wrapped error). `summarizeFailureUsage` now reads exclusively
     via `bridge.readProtocolV4FailureUsageSnapshot(error)`/`bridge.readProtocolV4LeaseFinalizationStatus(error)`
     — the old property names are never read anywhere in production code anymore (confirmed via
     CodeGraph, section 5).
   - **Remediation B (conservative exact-zero rule):** `isKnownPreDispatchError` now allowlists only
     `LauncherError` (every throw site runs before the `try` around the real entry-point dispatch call
     in `runExecute`, so it can never actually appear as `dispatchError` in production — kept for pure
     unit-test coverage of the pre-dispatch contract) and
     `bridge.ProtocolV4LiveDevelopmentEntryPointError` (every throw site in
     `runProtocolV4LiveDevelopmentEntryPoint` runs in steps 1-4, strictly before the lease claim/step 5
     and dispatch/step 6). The five classes named in section 2 were removed. Without a trusted
     snapshot, any of those five (or any other unrecognized error) now reports `'unknown'`, never a
     fabricated `'exact'`/zero.
   - **Remediation C (runtime snapshot validation):** new `isValidProtocolV4FailureUsageSnapshot`/
     `isValidProtocolV4LeaseFinalizationStatus` in the `.mjs` launcher — object shape, closed
     `accounting`/candidate-ID/status enums, finite non-negative integer/number fields (never
     `undefined`/string/`NaN`/`Infinity`), and an `exact_zero`-vs-`providerHttpRequests` consistency
     check (deliberately NOT also requiring zero reservations — a reservation released before any real
     `fetch` is still legitimately `exact_zero` for provider usage; this mirrors
     `attachProtocolV4FailureUsageSnapshot`'s own construction rule and the pre-existing, still-passing
     "Test 4" contract). An invalid snapshot/status is treated exactly like absent, never partially
     trusted; no snapshot data is ever included in a thrown error/log line.
   - Docs: `ROADMAP.md` (status paragraph), the Phase B3 report's new §14, this handoff, prior handoff
     archived.

4. **Files changed:**

   ```
   A  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4FailureMetadataSideChannel.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  scripts/resolver-v3-048-live-launcher/launcherBridge.ts
   M  scripts/run-resolver-v3-048-live-development.mjs
   M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   M  ROADMAP.md
   M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-31_RESOLVER-V3-048_phase-b3-post-merge-remediation-4.md
   M  handoffs/latest-handoff.md
   ```

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the `codegraph`
   server exposes). No `.codegraph/` index existed at session start in this fresh environment; per
   `AGENTS.md`'s remediation procedure, a one-time bootstrap (`npx -y @colbymchenry/codegraph@1.5.0
init`, the pinned version from `.mcp.json`) was run — confirmed afterwards via `git status`/`git
diff --stat` that only the gitignored `.codegraph/` directory was created and no tracked file
   changed. Preflight queries (before any change):
   `summarizeFailureUsage isKnownPreDispatchError attachProtocolV4FailureUsageSnapshot
attachProtocolV4LeaseFinalizationStatus runProtocolV4DevelopmentForAllCandidates
writeAndReadBackLiveArtifact` and `runExecute runProtocolV4LiveDevelopmentEntryPoint
runProtocolV4DevelopmentForAllCandidates runProtocolV4DevelopmentForCandidate
assertProtocolV4ExecutionLeaseActiveForDispatch writeAndReadBackLiveArtifact` established the exact
   defect shape. Additional targeted throw-site queries (`ProtocolV4ArtifactStoreError
ProtocolV4ExecutionLeaseError ProtocolV4ArtifactCrashError`; `transitionLease
readProtocolV4ExecutionLease ProtocolV4ExecutionLeaseError throw sites`;
   `runProtocolV4DevelopmentForCandidate`) proved, by real call-path relationships (not assumption):
   `markProtocolV4ExecutionLeaseTerminalFailure` (called inside `runProtocolV4DevelopmentForAllCandidates`'s
   `catch`, i.e. after the candidate dispatch loop) reaches `transitionLease`, which throws
   `ProtocolV4ExecutionLeaseError`; `writeAndReadBackLiveArtifact` (called once per candidate, right
   after that candidate's own dispatch loop) throws `ProtocolV4ArtifactStoreError`; `assertDevelopmentAuthorized`
   (called at the start of EACH candidate's `runProtocolV4DevelopmentForCandidate`, i.e. after any
   earlier candidate already dispatched) reaches `isTargetUnused` (`ProtocolV4ArtifactCrashError`) and
   its own budget/identity checks (`ProtocolV4DevelopmentAuthorizationError`); `runProtocolV4Attempt`
   calls `buildFastPathTerminal` (`ProtocolV4LiveExecutionContextError`'s
   `PROTOCOL_V4_LIVE_EXECUTION_UNEXPECTED_FAST_PATH`) AFTER the real dispatch `attempt()` already ran.
   Reads of `ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts` and
   `ResolverV3048ProtocolV4ExecutionContext.ts`/`ResolverV3048ProtocolV4DevelopmentAuthorization.ts`
   confirmed `ProtocolV4LiveDevelopmentEntryPointError` and `LauncherError` are genuinely pre-dispatch
   only (every throw site verified). Post-implementation recheck queries
   (`summarizeFailureUsage readProtocolV4FailureUsageSnapshot readProtocolV4LeaseFinalizationStatus`;
   `runProtocolV4DevelopmentForAllCandidates attachProtocolV4FailureUsageSnapshot
attachProtocolV4LeaseFinalizationStatus`; `ProtocolV4ArtifactStoreError ProtocolV4ExecutionLeaseError
isKnownPreDispatchError`) confirmed the on-disk implementation matches what was implemented, the
   real launcher path (`launcherBridge.ts`) and the real Runner (`ResolverV3048ProtocolV4DevelopmentRunner.ts`)
   both import the same `ResolverV3048ProtocolV4FailureMetadataSideChannel.ts` module (compiled once
   into one `outDir` tree, so both `require()` the identical on-disk file and share the same `WeakMap`
   instances — proven at the real compiled-module level by a dedicated test, see §6), and a repo-wide
   grep confirmed no production reader anywhere still accesses `error.protocolV4FailureUsageSnapshot`/
   `error.protocolV4LeaseFinalizationStatus` as a plain property. No unintended call-graph expansion.

6. **Verification executed:**

   ```
   node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4
   npx jest --runInBand src/features/nutrition/benchmark
   npm run test (full repo-wide Jest suite)
   npm run typecheck / npm run lint / npm run format:check
   git --no-pager diff --check
   git --no-pager status --short
   git --no-pager diff --stat
   git --no-pager diff --name-only
   ```

7. **Verification result:**
   - `node --test` (launcher): 152 tests, 145 pass; the 6 failures (in 3 suites) are exclusively this
     launcher's own working-tree-clean-gate (`LAUNCHER_PREFLIGHT_WORKING_TREE_DIRTY`/
     `LAUNCHER_EXECUTE_WORKING_TREE_DIRTY`), which by construction cannot pass until this
     remediation's own files are committed — the same documented pattern as every prior remediation;
     confirmed fully green post-commit.
   - `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 30/30 (26 prior, rewritten to
     read through the new side channel instead of the removed property, + 4 net-new: a dedicated
     "Combined Critical Regression" test — real provider dispatch via mocked fetch, then a real,
     frozen `ProtocolV4ArtifactStoreError` carrying a spoofed non-writable legacy
     `protocolV4FailureUsageSnapshot` property claiming `exact_zero`, proving the REAL side-channel
     snapshot (`partial`, real nonzero `providerHttpRequests`) is what is actually read, never the
     spoofed property; a Proxy get/set-trap regression; a throwing-property-getter regression; an
     identity-preserved-on-rethrow regression).
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 236/236 (11 suites; 232 prior + 4
     net-new).
   - `jest src/features/nutrition/benchmark`: **PASS**, 981/981 (81 suites; 977 prior + 4 net-new).
   - `npm run test` (full repo-wide Jest): **PASS**, 2790/2790 (257 suites).
   - `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (after removing the transient
     gitignored `build/resolver-v3-048-live-launcher/` directory before the repo-wide lint pass, per
     every prior remediation's documented pattern). `prettier -c` on every file this remediation
     touched: **PASS** after one `-w` pass on the 3 files with issues.
     `npm run verify`'s `format:check` step separately flags one pre-existing, out-of-scope file:
     `.claude/settings.local.json` — a harness-generated, globally gitignored (via
     `/root/.config/git/ignore`, not this repository's own `.gitignore`), untracked local Claude Code
     permissions file, auto-created at this session's start, never part of this repository's tracked
     content or this task's allowed scope, and not touched by this remediation (confirmed via `git
status --short`, `git check-ignore -v`, and `git ls-files --others --ignored
--exclude-standard`). All checks scoped to this task's actual files pass.
   - `git diff --check`: **PASS** (exit 0, no trailing-whitespace/conflict-marker issues).
   - `npm ci` was run once (node_modules was absent in this fresh environment); confirmed
     `package.json`/`package-lock.json` byte-identical before and after (md5sum + `git status` showed
     no changes).

8. **Known issues, blockers, residual risks:**

   a. Low-severity recommendations from the review are explicitly out of scope for this remediation
   (per the task's own instructions) — not touched.

   b. Same as every prior remediation: the launcher has never been run with a real
   `ANTHROPIC_API_KEY`; only fail-closed and fully mocked/controlled zero-network paths were
   exercised.

   c. The PR #202 authorization (324 calls / USD 5.142528) remains unreused. The 352-call / USD
   5.586944 Holdout-inclusive budget remains unauthorized.

   d. Symlink/junction path-safety tests still skip, not fail, on an environment that refuses
   unprivileged link creation — unchanged residual note from prior remediations.

   e. `ProtocolV4LiveExecutionContextError`'s `buildFastPathTerminal` throw site
   (`PROTOCOL_V4_LIVE_EXECUTION_UNEXPECTED_FAST_PATH`) is documented in
   `ResolverV3048ProtocolV4ExecutionContext.ts` as "structurally unreachable" by its own surrounding
   comment; this remediation did not disprove that specific claim (unlike the ArtifactCrashError case,
   which the task's review already proved false), but conservatively removed the whole CLASS from the
   exact-zero allowlist anyway, since a second, dispatch-loop-internal throw site for that class
   exists and the class-level `instanceof` check cannot distinguish between the two call sites. If a
   future task proves that specific throw site is truly unreachable, re-adding the class to the
   allowlist would need a snapshot-independent proof, not a re-statement of the existing comment.

9. **Human-review status / next steps:**
   - Not yet reviewed. A PR against `chore/clean-arch-structure` will be opened after this handoff,
     per the task's instructions — no merge by this agent.
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
