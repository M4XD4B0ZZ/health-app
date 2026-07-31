# Handoff — RESOLVER-V3-048: Phase B3 Post-Merge Remediation 4 (Non-Spoofable Identity, Attachment Safety, Tri-State Consumption, Closed CLI Parsing, 2026-07-31)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates five
   confirmed post-merge findings (F1–F5) from an independent review of PR #205 (this Phase B3
   launcher, three times pre-PR-remediated), merged as `93caac4b9128ac7211e7a8c19c4ebd61c87e7af3`
   into `chore/clean-arch-structure`. **No live run happened.** Branch:
   `fix/resolver-v3-048-post-merge-remediation-4`. **Actual consumption: 0 provider calls, 0
   tokens, USD 0.00.** G2 remains `not passed`; `RESOLVER-V3-010` remains `blocked`; Holdout
   remains unexecuted, unauthorized, and unreferenced.

2. **What changed:**
   - **F1 (exact-zero classification trusted a spoofable `error.name`):** `summarizeFailureUsage`
     no longer compares `error.name` (a freely settable string) against a class-name set. A new
     `isKnownPreDispatchError(error, bridge)` helper uses real `instanceof` — `LauncherError` (this
     module's own real class) plus the real Protocol-v4 domain classes, now re-exported from
     `scripts/resolver-v3-048-live-launcher/launcherBridge.ts`
     (`ProtocolV4LiveExecutionContextError`, `ProtocolV4DevelopmentAuthorizationError`,
     `ProtocolV4ExecutionLeaseError`, `ProtocolV4ArtifactStoreError`,
     `ProtocolV4ArtifactCrashError`, alongside the already-exported
     `ProtocolV4LiveDevelopmentEntryPointError`). `bridge` is optional; a spoofed or genuinely
     foreign error always falls through to `'unknown'` usage, never a fabricated exact zero.
   - **F2 (attachment could block lease finalization):**
     `attachProtocolV4FailureUsageSnapshot`/`attachProtocolV4LeaseFinalizationStatus` in
     `ResolverV3048ProtocolV4DevelopmentRunner.ts` now wrap their property write in their own
     try/catch (best-effort, silently swallowed) — a frozen error, a non-extensible error, a
     non-writable existing property, or a throwing setter/Proxy trap can no longer make the
     attachment itself throw. The Runner's shared catch is otherwise unchanged: normalize → attempt
     (now always-safe) snapshot attachment → always attempt lease `terminal_failure` → attempt (now
     always-safe) finalization-status attachment → always rethrow the original normalized error.
   - **F3 (authorization-consumption readback collapsed to a boolean):** the launcher's
     `authorizationConsumed` boolean is replaced with an explicit tri-state
     `authorizationConsumption` (`{status:'consumed'}` / `{status:'not_consumed'}` /
     `{status:'unreadable', errorCode}`), built by a new exported pure function
     `summarizeAuthorizationConsumption`. `errorCode` always comes from `classifyLauncherError` —
     never the foreign error's own message/name/a path. `success` in the summary is now documented
     inline as denoting only Development-dispatch outcome, never consumption-readback.
   - **F4 (unknown `error.name` echoed as the output code):** `classifyLauncherError`'s fallback
     for a fully unrecognized error class now returns the fixed constant
     `LAUNCHER_UNCLASSIFIED_ERROR` instead of the raw `error.name`.
   - **F5 (CLI arguments not unambiguous/mode-bound):** `parseArgs` rewritten to fail closed: every
     flag may appear at most once (`LAUNCHER_ARGUMENT_DUPLICATE`, first-write-wins); a value flag's
     next token must be a real, non-flag-shaped value or it is `LAUNCHER_ARGUMENT_VALUE_MISSING`
     (the wrongly-assumed "value" token is re-parsed as its own flag on the next iteration);
     execute-only flags (`--authorization-file`, `--confirm-development-only`,
     `--confirm-max-cost-usd`) are rejected under `--preflight`
     (`LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_PREFLIGHT`); the preflight-only flag
     (`--authorization-template-out`) is rejected under `--execute`
     (`LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_EXECUTE`). All four new codes added to
     `KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES`.
   - Tests: F1 (5 new), F2 (4 unit + 4 real end-to-end Runner tests), F3 (5 unit tests for
     `summarizeAuthorizationConsumption`, plus the existing full-success-path test updated to the
     tri-state shape), F4 (2 existing tests corrected + 5 new marker-variant tests), F5 (9 new).
     Launcher `.mjs` suite now 154 tests (was 131 pre-remediation-4); Jest
     `FailureUsageSnapshot` suite now 26/26 (was 17).
   - Docs: `ROADMAP.md` (status line + Current Focus + new dated remediation-4 paragraph), the
     Phase B3 report's new §13, this handoff, prior handoff archived.

3. **Why it changed:** an independent post-merge review of the already-merged PR #205 found these
   five defects; the task requires fixing them before further work on RESOLVER-V3-048.

4. **Files changed:**

   ```
   M  scripts/run-resolver-v3-048-live-development.mjs
   M  scripts/resolver-v3-048-live-launcher/launcherBridge.ts
   M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   M  ROADMAP.md
   M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-31_RESOLVER-V3-048_phase-b3-pre-pr-remediation-3.md
   M  handoffs/latest-handoff.md
   ```

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the
   `codegraph` server exposes). No `.codegraph/` index existed at session start in this fresh
   environment; per `AGENTS.md`'s remediation procedure, a one-time bootstrap
   (`npx -y @colbymchenry/codegraph@1.5.0 init`, the pinned version from `.mcp.json`) was run —
   confirmed afterwards via `git status`/`git diff --stat` that only the gitignored `.codegraph/`
   directory was created and no tracked file changed. Three preflight queries then ran before any
   change: `summarizeFailureUsage classifyLauncherError parseArgs
attachProtocolV4FailureUsageSnapshot attachProtocolV4LeaseFinalizationStatus runExecute`;
   `summarizeFailureUsage classifyLauncherError KNOWN_PRE_DISPATCH_ERROR_CLASSES
KNOWN_SAFE_PROTOCOL_ERROR_CLASSES LauncherError ProtocolV4ExecutionLeaseError`; and
   `isProtocolV4LiveAuthorizationConsumedAtomically markProtocolV4ExecutionLeaseTerminalFailure
ProtocolV4LeaseFinalizationStatus authorizationConsumed`. Each returned verbatim source,
   callers/callees, and blast-radius for the affected symbols in
   `scripts/run-resolver-v3-048-live-development.mjs`,
   `ResolverV3048ProtocolV4DevelopmentRunner.ts`, `ResolverV3048ProtocolV4ExecutionLease.ts`, and
   `ResolverV3048ProtocolV4ArtifactStore.ts`. A final post-implementation recheck confirmed the
   on-disk implementation matches what was implemented, with no unintended call-graph changes (full
   detail in the report's §13).

6. **Verification executed:**

   ```
   node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4
   npx jest --runInBand src/features/nutrition/benchmark
   npm run verify (typecheck, lint, format:check, full jest suite)
   git --no-pager diff --check
   git --no-pager status --short
   git --no-pager diff --stat
   git --no-pager diff --name-only
   ```

7. **Verification result:**
   - `node --test` (launcher): pre-commit runs showed only this launcher's own
     working-tree-clean-gate failures (expected — cannot pass until this remediation's own files
     are committed, the same pattern documented in every prior remediation); confirmed fully green
     post-commit.
   - `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 26/26.
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 232/232 (11 suites).
   - `jest src/features/nutrition/benchmark`: **PASS**, 977/977 (81 suites; 965 prior + 12 new).
   - `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (after removing the
     transient gitignored `build/resolver-v3-048-live-launcher/` directory). `prettier -c` on every
     file this remediation touched: **PASS** after one `-w` pass. `git diff --check`: **PASS**.
   - `npm run verify`'s `format:check` step separately flags one pre-existing, out-of-scope file:
     `.claude/settings.local.json` — a harness-generated, globally gitignored (via
     `/root/.config/git/ignore`, not this repository's own `.gitignore`), untracked local Claude
     Code permissions file, auto-created at this session's start, never part of this repository's
     tracked content or this task's allowed scope, and not touched by this remediation. All checks
     scoped to this task's actual files pass.
   - `npm ci` was run once (node_modules was absent in this fresh environment); confirmed
     `package.json`/`package-lock.json` byte-identical before and after (md5sum + `git status`
     showed no changes).

8. **Known issues, blockers, residual risks:**

   a. F6 (the review's TOCTOU note on the authorization file) is explicitly out of scope per the
   task's own instruction — not touched.

   b. Same as every prior remediation: the launcher has never been run with a real
   `ANTHROPIC_API_KEY`; only fail-closed and fully mocked/controlled zero-network paths were
   exercised.

   c. The PR #202 authorization (324 calls / USD 5.142528) remains unreused. The 352-call / USD
   5.586944 Holdout-inclusive budget remains unauthorized.

   d. Symlink/junction path-safety tests still skip, not fail, on an environment that refuses
   unprivileged link creation — unchanged residual note from prior remediations.

9. **Human-review status / next steps:**
   - Not yet reviewed. A PR against `chore/clean-arch-structure` will be opened after this handoff,
     per the task's instructions — no merge by this agent.
   - Nothing in this task should be read as authorization to run live. No live call was made, no
     live evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the
     real repository root.
