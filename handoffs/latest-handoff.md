# Handoff — RESOLVER-V3-048: Phase B3 Pre-PR Remediation (Authoritative Failure Accounting and Authorization Binding, 2026-07-31)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates five
   security/evidence defects an independent review found in the just-pushed Phase B3 canonical live
   Development launcher, before any PR was opened. **No live run happened.** Branch (unchanged, same
   as Phase B3): `claude/resolver-v3-048-phase-b3-live-launcher`. Basis: still `d7a2cd3` (PR #204
   merge). **Actual consumption: 0 provider calls, 0 tokens, USD 0.00.** G2 remains `not passed`;
   `RESOLVER-V3-010` remains `blocked`; Holdout remains unexecuted and unauthorized.

2. **What changed:**
   - **Defect 1 (false zero-usage on failure):** the launcher previously reported
     `actualProviderCalls: 0`/`actualCostUsd: 0` for any failed `--execute` run, even one where real
     dispatches had already happened. Fixed with a small, explicitly-scoped Protocol-v4 extension:
     `attachProtocolV4FailureUsageSnapshot` (new, in `ResolverV3048ProtocolV4DevelopmentRunner.ts`)
     is called from the existing `human_live` catch block before it re-throws, mutating the caught
     error with a `protocolV4FailureUsageSnapshot` property (never replacing/wrapping it — every
     existing `instanceof`/`.message` assertion elsewhere is unaffected). The snapshot's
     `providerCallsAtLeast` reads the shared `LiveProviderBudgetGate`'s own `snapshot().calls` — an
     exact floor, never an estimate, since `reserveProtocolV4Call` calls `gate.reserve()` exactly
     once per real attempted dispatch and the gate never decrements that counter. Confirmed
     tokens/cost are summed only from already-durable, readback-verified completed candidates —
     never a second pricing/usage-parsing implementation. The launcher's new
     `summarizeFailureUsage`/`summarizeSuccessUsage` consume this; no snapshot present means the
     failure happened strictly before any dispatch was possible (provably exact zero, not a guess).
   - **Defect 2 (incomplete schema/policy binding):** `validateAuthorizationFileStructure` now
     requires the authorization file's `launcherAuthorizationFileSchemaVersion` to equal the current
     constant exactly (missing/old/unknown all rejected). `validateAuthorizationAgainstPlan` now also
     checks `currency` and `noCachePolicy` exactly against the freshly rebuilt plan.
     `buildAuthorizationTemplate` now includes `noCachePolicy` (previously missing).
   - **Defect 3 (candidate duplicates):** `candidateIdentitiesMatch` is now an exact
     set-and-identity comparison (same count, every ID exactly once, no unknown/missing ID, all
     fields matched by ID) — rejects `H0,H0,H0`, a missing `H1`, a duplicated `H2`, and an unknown
     ID, while still accepting the correct candidates in a different order.
   - **Defect 4 (non-canonical path safety):** authorization-file and template-output paths are now
     resolved through `fs.realpathSync` (following any symlink/junction) before the outside-repo
     check, case-folded only on `win32`. New `assertExistingPathCanonicallyOutsideRepoRoot`/
     `assertNewFileParentCanonicallyOutsideRepoRoot` replace the previous lexical-only check for
     these two call sites. Template writes now use an atomic exclusive (`wx`) flag via a new
     `writeFileExclusive`, never silently overwriting an existing file.
   - **Defect 5 (non-canonical cost confirmation):** `--confirm-max-cost-usd` must now equal
     `String(plan.budget.developmentMaxCostUsd)` byte-for-byte (via new
     `canonicalDevelopmentMaxCostUsdString`), replacing the previous `Number(...) === ...` numeric
     comparison — scientific notation, whitespace, a leading `+`, and an extra trailing zero are all
     now refused.
   - **Secret-free error reporting:** new `classifyLauncherError` replaces raw `error.message`
     propagation in the closing summary/CLI stderr with an explicit allowlist of this codebase's own
     domain error classes (verified by source inspection to throw only fixed constant-code strings);
     anything outside the allowlist is reported by stable class/code only.
   - Tests: 8 new Protocol-v4-level tests in new
     `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts` (unit + real end-to-end write-failure/
     readback-failure/success cases); many new launcher-level tests across all five defects plus the
     error allowlist, added to the existing `.mjs` test file.
   - Docs: `ROADMAP.md` (status line + new dated remediation paragraph), the existing Phase B3
     report's new §10, this handoff, prior handoff archived.

3. **Why it changed:** an independent pre-PR review found these five defects before any PR was
   opened for the Phase B3 launcher; the task explicitly required fixing them before a PR, not after.

4. **Files changed:**

   ```
   M  scripts/run-resolver-v3-048-live-development.mjs
   M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
   M  ROADMAP.md
   M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-30_RESOLVER-V3-048_phase-b3-canonical-live-launcher.md
   M  handoffs/latest-handoff.md
   ```

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the
   `codegraph` server exposes). One query run before any change:
   `"runProtocolV4LiveDevelopmentEntryPoint runProtocolV4DevelopmentForAllCandidates runProtocolV4DevelopmentForCandidate LiveProviderBudgetGate recordProtocolV4Terminal markProtocolV4ExecutionLeaseTerminalFailure"`
   — confirmed the exact call flow (Entry Point → `runProtocolV4DevelopmentForAllCandidates` →
   `runProtocolV4DevelopmentForCandidate`), the existing `human_live` catch block's
   `markProtocolV4ExecutionLeaseTerminalFailure` call (the exact point Defect 1's fix hooks into),
   and confirmed `evidenceGate`/`candidates` are both in scope at that catch block. Result:
   **success**. Full detail in the report's new §10.

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

7. **Verification result:**
   - `node --test` (launcher): **79/83 pass pre-commit** (the 4 failures are this launcher's own
     working-tree-clean gate, which by construction cannot pass until this remediation's own files
     are committed — this is the launcher's fail-closed contract being exercised honestly, the same
     pattern as the original Phase B3 handoff).
   - New `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 8/8.
   - `jest src/features/nutrition/benchmark/protocolV4`: **PASS**, 214/214 (11 suites; 206 prior +
     8 new).
   - `jest src/features/nutrition/benchmark`: **PASS**, 959/959 (81 suites).
   - Full repo `jest --runInBand`: result to be confirmed and recorded in a follow-up docs commit
     once the background run completes (same sequencing as the original Phase B3 handoff: this
     launcher's own tests require a clean tree, so the full post-commit confirmation follows the
     commit).
   - `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (run with the launcher's
     transient `build/resolver-v3-048-live-launcher/` output removed first). `prettier -c`: **PASS**
     after one `-w` pass on 4 files. `git diff --check`: **PASS**.

8. **Known issues, blockers, residual risks:**

   a. Same as before this remediation: the launcher has never been run with a real
   `ANTHROPIC_API_KEY`; only the fail-closed missing-credential path and fully `global.fetch`-mocked
   zero-network paths were exercised (now including failure paths with real, controlled dispatch
   counts).

   b. The PR #202 authorization (324 calls / USD 5.142528) must still not be reused — unchanged.

   c. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized; no Holdout code is
   imported or referenced anywhere in this launcher, its bridge, or this remediation.

   d. Symlink/junction path-safety tests skip (not fail) on an environment that refuses unprivileged
   link creation — verify these actually ran (not skipped) on the CI/review environment before
   treating Defect 4's coverage as fully exercised there.

9. **Human-review status / next steps:**
   - **Not yet reviewed / no PR opened**, per this task's explicit instruction.
   - Next step: open a PR for `claude/resolver-v3-048-phase-b3-live-launcher` for human review, then
     the same maintainer actions as before (add `ANTHROPIC_API_KEY` to `.env`, issue a new
     authorization via `--preflight`'s template, run `--execute`).
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
