# Handoff — RESOLVER-V3-048: Phase B3 Pre-PR Remediation 3 (Closed Output Surface and Transition-Atomic Accounting, 2026-07-31)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates five further
   defects a THIRD independent review found in the Phase B3 launcher (after two prior pre-PR
   remediations), before any PR was opened. **No live run happened.** Branch (unchanged):
   `claude/resolver-v3-048-phase-b3-live-launcher`. Basis: still `d7a2cd3` (PR #204 merge). **Actual
   consumption: 0 provider calls, 0 tokens, USD 0.00.** G2 remains `not passed`; `RESOLVER-V3-010`
   remains `blocked`; Holdout remains unexecuted and unauthorized.

2. **What changed:**
   - **Defect 1 (raw CLI arguments could reach stdout/stderr):** `parseArgs` no longer embeds the
     original argv token/value in `result.errors` — every parser error is now one of four constant
     codes (`LAUNCHER_ARGUMENT_UNKNOWN`, `LAUNCHER_ARGUMENT_VALUE_MISSING`, `LAUNCHER_MODE_MISSING`,
     `LAUNCHER_MODE_MULTIPLE`), enumerated in an exported `KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES` set;
     `main()` re-checks each code against that set before printing.
   - **Defect 2 (Protocol-v4 error codes trusted by class + regex shape alone):** a real, enumerated
     `KNOWN_SAFE_PROTOCOL_ERROR_CODES` set (every constant base code actually thrown by a
     `KNOWN_SAFE_PROTOCOL_ERROR_CLASSES` member, derived from source inspection of every
     `throw new ProtocolV4...Error(...)` call site) replaces "known class + any regex-shaped
     prefix"; `classifyLauncherError` now checks the extracted base code by EXACT match, falling
     back to a generic `PROTOCOL_V4_UNRECOGNIZED_CODE` for anything unrecognized/dynamic/tampered.
   - **Defect 3 (the `claimed -> executing` transition lived outside the protected failure
     handler):** `markProtocolV4ExecutionLeaseExecuting` now runs as the FIRST statement inside the
     Development Runner's `try` (previously outside it) — a failure at `transitionLease`'s own
     post-write readback validation (which can fire after `executing` is already persisted on disk)
     now reaches the same catch as baseline/gate/dispatch/persistence failures, so `terminal_failure`
     is still attempted from a genuinely-`executing` on-disk state rather than leaving the lease
     stuck.
   - **Defect 4 (success path never reported a budget-gate-authoritative reservation count):** the
     Development Runner now builds a `ProtocolV4SuccessUsageSnapshot`
     (`buildProtocolV4SuccessUsageSnapshot` in `ResolverV3048ProtocolV4DevelopmentRunner.ts`; type
     defined in `ResolverV3048ProtocolV4.ts` alongside `ProtocolV4DevelopmentEvidence` to avoid a
     circular import) from the SAME authoritative sources as the failure snapshot — the shared
     budget gate's reservation count/reserved-worst-case totals and the execution context's
     transport-authoritative HTTP-request counter. Attached to `evidence.successUsageSnapshot`
     strictly AFTER `developmentEvidenceRootHash` is computed (never read by
     `computeDevelopmentEvidenceRootHash`, so it can never change the Development Evidence Root or
     any stored artifact hash). `reserved*UpperBound` now consistently denotes the gate's ENTIRE
     reserved-worst-case totals on both success and failure (previously success summed only the
     incomplete-usage entries' own amount). The launcher's `summarizeSuccessUsage` now just reads
     this snapshot instead of re-deriving from `evidence.candidates` ledger content.
   - **Defect 5 (absolute paths and a hardcoded cost value in output):** the closing summary's
     `canonicalArtifactRoot` (a real absolute path) is replaced with `artifactRootKind:
'protocol_v4_live'`; the printed `--preflight` output now shows only a boolean
     `authorizationTemplateWritten`, never the absolute template-output path (`runPreflight()`'s own
     return value is unchanged, so tests/programmatic callers can still read back the real path);
     the launcher's own doc comment no longer hardcodes `developmentMaxCostUsd` (`5.142528`) in its
     usage example, using `<EXACT_VALUE_FROM_PREFLIGHT>` instead.
   - Tests: 1 new real end-to-end transition-atomic test (`Test 8`, spies on
     `markProtocolV4ExecutionLeaseExecuting` to call through to the real implementation — genuinely
     persisting `executing` to disk — then throw, confirming original error/snapshot survive and
     `terminal_failure` is still confirmed) plus 2 new `buildProtocolV4SuccessUsageSnapshot` unit
     tests in `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts` (now 17/17); rewritten
     `summarizeSuccessUsage` tests, new `classifyLauncherError`/`parseArgs` secret-marker and
     code-allowlist tests, new `artifactRootKind`/preflight-boolean/doc-comment-placeholder tests in
     the `.mjs` test file (now 105 tests).
   - Docs: `ROADMAP.md` (status line + new dated remediation-3 paragraph), the Phase B3 report's new
     §12, this handoff, prior handoff archived.

3. **Why it changed:** a third independent pre-PR review found these five defects before any PR was
   opened; the task explicitly required fixing them before a PR, not after.

4. **Files changed:**

   ```
   M  scripts/run-resolver-v3-048-live-development.mjs
   M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   M  ROADMAP.md
   M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-31_RESOLVER-V3-048_phase-b3-pre-pr-remediation-2.md
   M  handoffs/latest-handoff.md
   ```

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the
   `codegraph` server exposes). Five queries run before any change, covering: CLI `main` →
   `parseArgs` → stdout/stderr; `classifyLauncherError`'s reachable Protocol-v4 error classes and
   base codes (used to derive `KNOWN_SAFE_PROTOCOL_ERROR_CODES` from real call sites, not invented);
   the Development Runner's `markProtocolV4ExecutionLeaseExecuting`/shared-catch relationship;
   `LiveProviderBudgetGate` → success-/failure-usage-snapshot call graph; and the Live Entry Point →
   Runner → launcher-summary chain. All succeeded; no CodeGraph failure occurred. A final
   post-implementation recheck is recorded in the report's §12 verification section.

6. **Verification executed:**

   ```
   node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4
   npx jest --runInBand src/features/nutrition/benchmark
   npx jest --runInBand
   npx tsc --noEmit -p tsconfig.json
   npx eslint .
   npx prettier -c <every changed file>
   git --no-pager diff --check
   ```

7. **Verification result (confirmed post-commit, `d71c281`):**
   - `node --test` (launcher): **105/105 pass** post-commit (99/105 pre-commit — the 6 failures were
     this launcher's own working-tree-clean gate, which by construction cannot pass until this
     remediation's own files are committed; confirmed 105/105 once clean).
   - `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 17/17 (14 prior + 3 new).
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 223/223 (11 suites).
   - `jest src/features/nutrition/benchmark`: **PASS**, 968/968 (81 suites; 965 prior + 3 new).
   - Full repo `jest --runInBand`: **PASS**, 2777/2777 tests, 257/257 suites, 776.6s (2774 prior + 3
     new). Zero failures, zero new failures anywhere.
   - `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (after removing the transient
     `build/resolver-v3-048-live-launcher/` dir). `prettier -c`: **PASS** after one `-w` pass on 3
     files, plus one more on this handoff. `git diff --check`: **PASS**.
   - Final CodeGraph MCP recheck: **success** — full detail in the report's §12.

8. **Known issues, blockers, residual risks:**

   a. Same as before: the launcher has never been run with a real `ANTHROPIC_API_KEY`; only the
   fail-closed missing-credential path and fully mocked/controlled zero-network paths were
   exercised.

   b. The PR #202 authorization (324 calls / USD 5.142528) must still not be reused — unchanged.

   c. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized; no Holdout code is
   imported or referenced anywhere in this launcher, its bridge, or any remediation.

   d. Symlink/junction path-safety tests (from remediation 1) still skip, not fail, on an
   environment that refuses unprivileged link creation — unchanged residual note.

9. **Human-review status / next steps:**
   - **Not yet reviewed / no PR opened**, per this task's explicit instruction — however, the user
     explicitly authorized (mid-session, 2026-07-31) opening a PR and merging it to the base branch
     once CI is green, once this remediation's verification is complete. That step is being executed
     as the very next action after this handoff.
   - Next step after merge: the same maintainer actions as before (add `ANTHROPIC_API_KEY` to
     `.env`, issue a new authorization via `--preflight`'s template, run `--execute`).
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
