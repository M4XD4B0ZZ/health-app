# Handoff — RESOLVER-V3-048: Phase B3 Pre-PR Remediation 2 (Transport-Authoritative Accounting and Failure Finalization, 2026-07-31)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates five
   further security/evidence defects a second independent review found in the Phase B3 launcher
   (after the first pre-PR remediation), before any PR was opened. **No live run happened.**
   Branch (unchanged): `claude/resolver-v3-048-phase-b3-live-launcher`. Basis: still `d7a2cd3` (PR
   #204 merge). **Actual consumption: 0 provider calls, 0 tokens, USD 0.00.** G2 remains
   `not passed`; `RESOLVER-V3-010` remains `blocked`; Holdout remains unexecuted and unauthorized.

2. **What changed:**
   - **Defect 1 (success accounting counted usage records, not HTTP requests):**
     `summarizeSuccessUsage` now sums the real, measured `counts.providerHttpRequests.value` from
     every ledger entry (exact, regardless of usage outcome) as its own dimension, fully separate
     from confirmed tokens/cost (summed only from entries with `usageStatus === 'reported'` and a
     computed `actualCostUsd`). A structurally successful run is no longer automatically
     billing-exact: any HTTP request lacking full usage/cost information makes overall accounting
     `'partial'`, with that entry's own `reservedWorstCaseCostUsd` contributing to a safe upper
     bound instead of an implicit USD 0.00.
   - **Defect 2 (reservation count mislabeled as a provider-request count):** a new, read-only,
     transport-authoritative cumulative counter
     (`ProtocolV4HumanLiveExecutionContext.getCumulativeProviderHttpRequestCount()`) was added,
     incremented exactly at the private counting-transport boundary immediately before every real
     `fetch`, spanning every candidate/observation of one Development run — no transport injection,
     no caller-settable value, no URL/header/credential/proxy data. `providerHttpRequests` is now
     derived from this counter everywhere; the shared budget gate's own count is named and
     documented only as `aiDispatchReservations`, never `providerCallsAtLeast`/`actualProviderCalls`.
   - **Defect 3 (failure snapshot lost to lease-finalization errors):** the Development Runner's
     catch block now normalizes the throwable, attaches the usage snapshot to the ORIGINAL error
     FIRST, then attempts `markProtocolV4ExecutionLeaseTerminalFailure` in its own nested
     `try`/`catch` — a lease-finalization failure never replaces the original error or its
     snapshot; a new secret-free `protocolV4LeaseFinalizationStatus`
     (`'terminal_failure_confirmed'` | `'failed_to_persist'`) is always attached. Baseline
     computation and gate construction moved INSIDE the `try` (previously outside it, leaving the
     lease stuck `executing` on a baseline failure).
   - **Defect 4 (absent snapshot silently meant exact zero):** `summarizeFailureUsage` now uses a
     `KNOWN_PRE_DISPATCH_ERROR_CLASSES` allowlist (verified by source inspection to be reachable
     only strictly before the Runner's dispatch loop starts) to justify reporting exact zero
     without a snapshot; any other error reports `accounting: 'unknown'` with `null` fields, never
     a fabricated `0`.
   - **Defect 5 (error allowlist trusted classes, not codes):** `LauncherError` now takes
     `(code, internalDetail)` — `code` must be one of a fixed `KNOWN_LAUNCHER_ERROR_CODES` set (the
     only thing `classifyLauncherError` ever surfaces, via exact match); `internalDetail` (a
     resolved path, a foreign error's message, `tsc` stdout/stderr, a submitted value) is a plain
     property never read by `classifyLauncherError`. Every direct `LauncherError` construction site
     was updated. Protocol-v4 domain-error messages are additionally truncated at the first
     non-code character.
   - **Production-call contract:** `runExecute`'s dispatch object is now built as
     `{ authorization, env }` with `repoRoot` added only conditionally — the production path never
     includes the key at all (not even `undefined`).
   - Tests: 6 new real end-to-end Protocol-v4-level tests (reservation-before-fetch,
     error-after-one-fetch, lease-finalization-failure, baseline-failure-after-executing, plus
     updated write/readback/success cases) in
     `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts` (now 14/14); many new/updated
     launcher-level tests (transport-vs-reservation dimensions, unknown-accounting, code-based
     redaction, malformed-JSON-with-secret-marker via both `runExecute` and a real CLI subprocess,
     source-level production-call-contract proof) in the `.mjs` test file.
   - Docs: `ROADMAP.md` (status line + new dated remediation-2 paragraph), the Phase B3 report's
     new §11, this handoff, prior handoff archived.

3. **Why it changed:** a second independent pre-PR review found these five defects before any PR
   was opened; the task explicitly required fixing them before a PR, not after.

4. **Files changed:**

   ```
   M  scripts/run-resolver-v3-048-live-development.mjs
   M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionContext.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   M  ROADMAP.md
   M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-31_RESOLVER-V3-048_phase-b3-pre-pr-remediation-1.md
   M  handoffs/latest-handoff.md
   ```

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the
   `codegraph` server exposes). Two queries run before any change: (1)
   `"buildProtocolV4HumanLiveExecutionContext countingTransport providerHttpRequestCount reserveProtocolV4Call LiveProviderBudgetGate.reserve"`
   — confirmed the private counting-transport's exact increment point (immediately before the real
   `fetch`) and `reserveProtocolV4Call`'s exactly-once call to `gate.reserve()`; (2)
   `"runProtocolV4DevelopmentForAllCandidates markProtocolV4ExecutionLeaseTerminalFailure attachProtocolV4FailureUsageSnapshot summarizeFailureUsage summarizeSuccessUsage classifyLauncherError runExecute"`
   — confirmed the exact prior catch-block ordering (Defect 3's target) and every launcher
   call-site relationship. Both succeeded; no CodeGraph failure occurred. A final post-implementation
   recheck is recorded in the report's §11 verification section.

6. **Verification executed:**

   ```
   node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4
   npx jest --runInBand src/features/nutrition/benchmark
   npx jest --runInBand
   npx tsc --noEmit -p tsconfig.json
   npx eslint .
   npx prettier -c <every changed/added file>
   git --no-pager diff --check
   ```

7. **Verification result (confirmed post-commit, `27f1086`):**
   - `node --test` (launcher): **95/95 pass** (90/95 pre-commit — the 5 failures were this
     launcher's own working-tree-clean gate, which by construction cannot pass until this
     remediation's own files are committed; confirmed 95/95 once clean).
   - `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 14/14 (8 prior + 6 new).
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 220/220 (11 suites).
   - `jest src/features/nutrition/benchmark`: **PASS**, 965/965 (81 suites).
   - Full repo `jest --runInBand`: **PASS**, 2774/2774 tests, 257/257 suites, 729.8s (2768 prior +
     6 new). Zero failures, zero new failures anywhere.
   - `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors. `prettier -c`: **PASS**
     after one `-w` pass on 4 files. `git diff --check`: **PASS**.
   - Final CodeGraph MCP recheck: **success** — full detail in the report's §11.

8. **Known issues, blockers, residual risks:**

   a. Same as before: the launcher has never been run with a real `ANTHROPIC_API_KEY`; only the
   fail-closed missing-credential path and fully mocked/controlled zero-network paths were
   exercised (now including precisely controlled reservation-vs-fetch and lease-finalization-failure
   scenarios).

   b. The PR #202 authorization (324 calls / USD 5.142528) must still not be reused — unchanged.

   c. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized; no Holdout code is
   imported or referenced anywhere in this launcher, its bridge, or either remediation.

   d. Symlink/junction path-safety tests (from remediation 1) still skip, not fail, on an
   environment that refuses unprivileged link creation — unchanged residual note.

9. **Human-review status / next steps:**
   - **Not yet reviewed / no PR opened**, per this task's explicit instruction.
   - Next step: open a PR for `claude/resolver-v3-048-phase-b3-live-launcher` for human review, then
     the same maintainer actions as before (add `ANTHROPIC_API_KEY` to `.env`, issue a new
     authorization via `--preflight`'s template, run `--execute`).
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
