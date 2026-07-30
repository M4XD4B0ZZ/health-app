# Handoff — RESOLVER-V3-048: Phase B3 Canonical Live Development Launcher (2026-07-30)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. Phase B3 (the canonical CLI
   launcher for the already-merged Phase B1 + post-merge-remediated live Development entry point) is
   complete; **no live run happened**. Branch: `claude/resolver-v3-048-phase-b3-live-launcher`.
   Basis: `d7a2cd3` (PR #204 merge, tip of `chore/clean-arch-structure` at task start; verified
   working tree clean and local branch identical to `origin/chore/clean-arch-structure` before
   branching). PR #204 remains merged and was not reverted. **Actual consumption: 0 provider calls,
   0 tokens, USD 0.00.** G2 remains `not passed`; `RESOLVER-V3-010` remains `blocked`; Holdout
   remains unexecuted and unauthorized.

2. **What changed:** the live Development entry point (`runProtocolV4LiveDevelopmentEntryPoint`)
   existed only as a TypeScript library function — no canonical CLI launcher, no reproducible build
   path, no external human-authorization hand-off mechanism, and ad-hoc `tsx -e`/Jest/inline
   TypeScript execution was the only way to invoke it. This task adds
   `scripts/run-resolver-v3-048-live-development.mjs`, a plain-Node CLI with exactly two modes:
   - `--preflight`: zero-call, never checks `ANTHROPIC_API_KEY`; requires a clean working tree;
     compiles a small explicit TypeScript re-export bridge
     (`scripts/resolver-v3-048-live-launcher/launcherBridge.ts`) via the LOCAL
     `node_modules/typescript/bin/tsc` only (never `tsx`/`ts-node`/a global tool/`npx`/an automatic
     `npm install`) into the deterministic, already-gitignored `build/resolver-v3-048-live-launcher/`
     directory; calls the real `buildProtocolV4MasterPlan`/`validateProtocolV4MasterPlan`; prints
     the exact commit/plan-hash/execution-tree-hash/model/pricing/candidate/prompt/schema/routing/
     budget/concurrency/retry/cache identities; can emit a non-authorizing authorization template
     (`authorizationTemplateOnly: true`, empty `humanApprovalReference`, `holdoutAuthorized: false`,
     `automaticContinuation: false`) to an explicit external path or stdout.
   - `--execute`: requires `--authorization-file <ABSOLUTE_PATH>` (outside the repository,
     `authorizationTemplateOnly: false`, non-empty `humanApprovalReference`),
     `--confirm-development-only`, `--confirm-max-cost-usd <value>`. Validates, strictly before any
     credential check or side effect: file path/shape, working tree clean, exact `HEAD`-commit match
     plus PR #204-merge ancestry, every plan-derived identity/budget field against a freshly rebuilt
     Master Plan (no budget number independently re-typed anywhere), concurrency `=== 1`, retry
     count `=== 0`, Holdout-not-authorized, automatic-continuation-disabled, and the confirmation
     flags. Only then checks `ANTHROPIC_API_KEY` presence, builds the canonical `human_live`
     Authorization Record via the real `buildProtocolV4DevelopmentAuthorization`, and calls the real
     `runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: process.env })` — no `repoRoot` on
     this production path, no Holdout import/reference anywhere.
   - New dedicated build config: `scripts/resolver-v3-048-live-launcher.tsconfig.json` +
     `scripts/resolver-v3-048-live-launcher/globals.d.ts` (a one-line ambient `__DEV__` type only —
     changes no runtime behavior; the shared domain code's own `typeof __DEV__ !== 'undefined'`
     guard is already runtime-safe under plain Node).
   - New focused tests: `scripts/__tests__/run-resolver-v3-048-live-development.test.mjs` (Node's
     built-in `node --test`, matching this repo's existing convention for `.mjs` script tests — not
     part of `npm test`/Jest, whose `testMatch` stays scoped to `src/**/__tests__/**/*.test.ts`; not
     touched).
   - Docs: `ROADMAP.md` (`Current Focus`, RESOLVER-V3-048 status line + new dated Phase B3 entry),
     new Phase B3 report, this handoff, prior handoff archived.

3. **Why it changed:** the task's own explicit requirement — a single canonical, reproducible,
   fail-closed launcher for the already-reviewed live Development entry point, replacing forbidden
   ad-hoc execution paths, with a strictly local (`tsx`/`ts-node`/`npx`/global-tool/auto-install-free)
   TypeScript build and an external, human-authored authorization hand-off file validated
   field-by-field against a freshly rebuilt plan before any credential check.

4. **Files changed:**

   ```
   A  scripts/run-resolver-v3-048-live-development.mjs
   A  scripts/resolver-v3-048-live-launcher.tsconfig.json
   A  scripts/resolver-v3-048-live-launcher/launcherBridge.ts
   A  scripts/resolver-v3-048-live-launcher/globals.d.ts
   A  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   M  ROADMAP.md
   A  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md
   A  handoffs/archive/2026-07-30_RESOLVER-V3-048_phase-b1-post-merge-remediation.md
   M  handoffs/latest-handoff.md
   ```

   `build/resolver-v3-048-live-launcher/` is produced locally by the build step but is gitignored
   (covered by the pre-existing `build/` entry) and is not part of any commit.

5. **CodeGraph MCP evidence:** tool `mcp__codegraph__codegraph_explore` (the only tool the
   `codegraph` server exposes). Three queries run this session: (1) session preflight —
   `"runProtocolV4LiveDevelopmentEntryPoint buildProtocolV4MasterPlan buildProtocolV4DevelopmentAuthorization"`,
   confirming the entry point and its flow through `validateProtocolV4MasterPlan`/
   `buildProtocolV4MasterPlan`; (2) targeted, before writing the launcher —
   `"buildProtocolV4DevelopmentAuthorization ProtocolV4DevelopmentAuthorizationRecord buildProtocolV4HumanLiveExecutionContext runProtocolV4LiveDevelopmentEntryPoint"`,
   confirming `buildProtocolV4DevelopmentAuthorization`'s exact signature and that every one of its
   limits derives from `input.plan.budget`; (3) supporting types —
   `"ProtocolV4DevelopmentEvidence PROTOCOL_V4_LIVE_ROOT ExecutionLease claimProtocolV4ExecutionLeaseForDevelopmentAuthorization ArtifactStore isProtocolV4LiveAuthorizationConsumedAtomically ProtocolV4Budget PROTOCOL_V4_G2_GATES"`,
   confirming the exact lease/artifact-store functions the launcher's closing summary calls. All
   three succeeded; no CodeGraph failure occurred. Full detail in the report's §2.

6. **Verification executed** (VERIFY.md Category 4, product/runtime code — the launcher itself is
   plain Node/TypeScript tooling, not app runtime code, but is verified at the same level):

   ```
   node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
   npx jest --runInBand src/features/nutrition/benchmark/protocolV4
   npx jest --runInBand src/features/nutrition/benchmark
   npx jest --runInBand
   npx tsc --noEmit -p tsconfig.json
   npx eslint .
   npx prettier -c <every changed/added file>
   git --no-pager diff --check
   git --no-pager status --short / diff --stat
   ```

7. **Verification result:** see report §6.4 for the full, post-commit-confirmed numbers (a handful
   of this task's own launcher tests assert its own working-tree-clean gate against the real
   repository, so they only pass once this task's files are committed — an honest exercise of the
   launcher's own fail-closed contract, not a test-harness artifact; recorded in the report rather
   than duplicated here).

8. **Known issues, blockers, residual risks:**

   a. This launcher has never been run with a real `ANTHROPIC_API_KEY` anywhere in this task, in
   source or in tests — only the fail-closed missing-credential path and a fully
   `global.fetch`-mocked zero-network success path (isolated temp `repoRoot`, never the real
   repository) were exercised. Real-provider behavior — actual token/cost records, real latencies,
   real error shapes, real filesystem behavior on a real Windows machine when actually run from
   `.env` — remains unproven by construction, exactly as before this task.

   b. The PR #202 authorization (324 calls / USD 5.142528) must NOT be reused — unchanged from
   prior reports' conclusion. Any future authorization must be issued via this launcher's
   `--preflight` template against the commit it will actually be executed at; the launcher's own
   exact-HEAD-match check rejects a stale one generically.

   c. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized. Holdout stays a
   separate, later human decision; no Holdout code is imported or referenced anywhere in this
   launcher or its bridge (verified structurally in the test suite).

9. **Human-review status / next steps:**
   - **Not yet reviewed.** Needs review of this branch's diff and a green GitHub Verify before merge.
   - Next step is a maintainer decision, in order: (1) run
     `node scripts/run-resolver-v3-048-live-development.mjs --preflight` to get the current plan
     identities and a fresh authorization template; (2) add `ANTHROPIC_API_KEY` to the existing
     `.env` (an agent may not); (3) complete and human-approve the authorization template
     (`authorizationTemplateOnly: false`, a real `humanApprovalReference`) at an external path; (4)
     run `node --env-file=.env scripts/run-resolver-v3-048-live-development.mjs --execute
--authorization-file "<path>" --confirm-development-only --confirm-max-cost-usd "<value>"`.
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created under the real
     repository root.
