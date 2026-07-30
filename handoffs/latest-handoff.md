# Handoff — RESOLVER-V3-048: Live Development Authorization Preflight (2026-07-30)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. The maintainer's live Development
   authorization was received, verified against the frozen plan, and **not executed**. Branch:
   `claude/resolver-v3-048-live-dev-8sjtm8`. Basis: `49c727a` (tip of `chore/clean-arch-structure`).
   **Actual consumption: 0 provider calls, 0 tokens, USD 0.00.** The authorization is unconsumed and
   preserved as the historical human decision record for these exact ceilings — but it is **not**
   transferable to a future, changed live-wiring code state and must **not** be automatically reused
   once that code lands (see item 7).

2. **What changed:** documentation/evidence only. A new preflight report records the authorization,
   its exact reconciliation against the pre-frozen Master Plan, the two blockers that stopped
   execution, the actual (zero) consumption, the CodeGraph MCP preflight, and the enumerated —
   unimplemented and unauthorized — requirements for a real live run. `ROADMAP.md`'s
   `RESOLVER-V3-048` entry and `Current Focus` were updated to match. No source file was touched.

3. **Why it changed:** the authorization was well-formed but could not be spent. Preflight stopped
   fail-closed on two independent blockers:
   - **No credential.** `ANTHROPIC_API_KEY` is unset and no `.env` exists. `.env`/`.env.*` are under
     `AGENTS.md`'s absolute protection, so an agent may not create one;
     `createLiveVariantCInterpreter` correctly throws rather than falling back to a fixture provider.
   - **No live dispatch path in the code** (the decisive one). `runOneObservation`
     (`ResolverV3048ProtocolV4DevelopmentRunner.ts:167`, shared by the Development and Holdout
     Runners) hard-codes a canned-HTTP-200 fake transport (lines 275-281), the placeholder credential
     literal `'protocol-v4-development-not-a-credential'` (line 284), `buildFakeSources` (line 282)
     and `buildFakeZeroCounts` (lines 303-329), with no transport/credential/environment parameter to
     inject a real one; and `runProtocolV4DevelopmentForCandidate` passes a constant
     `liveExecution: false` (line 421), so the runner structurally cannot reach
     `assertDevelopmentAuthorized`'s `human_live` branch. The human-live authorization machinery is
     complete and correct — nothing calls it in live mode. This matches the merged history (every
     Protocol-v4 PR #190-#196 built zero-call infrastructure by design), so it is a scope boundary,
     not a regression.

   Running the existing runner anyway would have completed all 324 observations and sealed a
   structurally valid, complete artifact set at 0 calls / USD 0 against fixtures — this task's
   first-listed risk, "fixture fallback masquerading as live evidence." It was therefore not run.

4. **Files changed:**
   - `reports/RESOLVER_V3_048_LIVE_DEVELOPMENT_AUTHORIZATION_PREFLIGHT.md` (new)
   - `ROADMAP.md` (`RESOLVER-V3-048` entry: new authorization/preflight section and new `Status:`
     line; `Current Focus` paragraph updated. No other task entry touched.)
   - `handoffs/latest-handoff.md` (replaced; holds only this entry)
   - `handoffs/archive/2026-07-29_CODEGRAPH-001_post-merge-evidence-correction.md` (new;
     byte-identical copy of the prior `handoffs/latest-handoff.md`)

5. **Verification executed:** `VERIFY.md` Category 1 (documentation-only) required readback checks —
   `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff --name-only`,
   `git diff --check`; plus the optional `npm run verify` (typecheck + lint + format:check + full
   Jest suite), run deliberately because PR #193 previously failed CI on a non-Prettier-conformant
   `ROADMAP.md`. Handoff rotation checked byte-identical via `diff`. `npm ci` was run first to restore
   already-declared dependencies into an empty `node_modules` (permitted by `AGENTS.md`'s Dependency
   Command Safety; lockfile-exact, `package.json`/`package-lock.json` unmodified — confirmed by a
   clean `git status`).

   **`npm run verify` did not complete as a single command in this environment**, and the reason is a
   local-environment artifact rather than a defect in this change: `format:check` (`prettier -c .`)
   flagged exactly one file, `.claude/settings.local.json`, which the harness auto-writes locally when
   an MCP tool call is approved. That file is untracked and git-ignored globally
   (`/root/.config/git/ignore:1`), is not a repository file, cannot enter a commit, and does not exist
   in a CI checkout — the same file and the same reasoning are already documented in the archived
   `CODEGRAPH-001` Phase B handoff. It was deliberately left unmodified rather than reformatted to
   make the command green. The `verify` chain was therefore completed stage-by-stage instead: `tsc
--noEmit` and `eslint .` passed inside the aborted `npm run verify` run; Prettier conformance was
   re-checked across **all tracked formattable files** (`git ls-files '*.md' '*.ts' '*.tsx' '*.js'
'*.mjs' '*.cjs' '*.json' '*.yml' '*.yaml' | xargs npx prettier -c`) — "All matched files use
   Prettier code style!"; and `npm run test` was run separately (result in item 6). GitHub Verify on
   this branch is the authoritative confirmation, since CI has no `.claude/settings.local.json`.

   CodeGraph MCP preflight (`AGENTS.md` "CodeGraph Availability"): `mcp__codegraph__codegraph_explore`
   first reported no `.codegraph/` index — the documented fail-closed condition. The single permitted
   remediation was applied (`npx -y @colbymchenry/codegraph@1.5.0 init`, the version pinned in
   `.mcp.json`; 796 files / 7,518 nodes / 29,284 edges) and re-verified through the MCP tool itself,
   not the CLI. Query:
   `runOneObservation runProtocolV4DevelopmentForCandidate createLiveVariantCInterpreter AnthropicBenchmarkTransport live dispatch`.
   Findings: call path `runProtocolV4DevelopmentForCandidate` (`…DevelopmentRunner.ts:372`) →
   `runOneObservation` (`…DevelopmentRunner.ts:167`) → `runProtocolV4Attempt`
   (`…AttemptWrapper.ts:240`) → `dispatch` (`…CallStateMachine.ts:87`); blast radius 4 callers for
   `runOneObservation`, 14 for `createLiveVariantCInterpreter`; verbatim source for the hard-coded
   fake transport/credential block, `createLiveVariantCInterpreter`, `AnthropicBenchmarkTransport`
   (the real proxy-aware transport, unused by Protocol-v4), and the `claude-haiku-4-5-20251001`
   pricing entry in `LiveProviderBudgetGate.ts`. `.codegraph/` is self-ignoring and was not committed.

6. **Verification result:** all readback checks clean; `git diff --check` reported no whitespace
   errors; `tsc --noEmit` clean; `eslint .` clean; Prettier conformance confirmed across all tracked
   formattable files; `npm run test` (full Jest suite) passed — see the per-stage note in item 5 for
   why the stages were run individually rather than through the single `npm run verify` entrypoint;
   handoff rotation byte-identical and singular. Plan/authorization reconciliation verified by
   executing `buildProtocolV4MasterPlan()` (zero-network, identity/budget derivation only) via a
   temporary test that was removed before commit: `developmentCalls` 324, `developmentMaxTokens`
   3,151,872, `developmentMaxCostUsd` 5.142528, `maxConcurrentRequests` 1, `modelId`
   `claude-haiku-4-5-20251001`, pricing `anthropic-messages-2025-10-01-v1` — an exact match to every
   authorized ceiling, with the 28-call / USD 0.444416 Holdout remainder correctly excluded.

7. **Known issues, blockers, or residual risks:**
   - The two blockers in item 3 remain open. The authorization cannot be spent until a live dispatch
     path exists **and** a credential is supplied through a channel an agent may not create.
   - Closing blocker 2 means changing the dispatch core (`runOneObservation`) that every merged
     Phase-A PR was built to guard: injectable real transport, real credential pass-through, real
     source adapters, real external-call counting, and `liveExecution` promoted from a hard-coded
     `false` to a caller-supplied value, plus a live entry point writing to the canonical
     `logs/resolver-v3-048-protocol-v4` root instead of the dry-run root. That is a substantive,
     separately reviewable change and should not be written and executed in the same unattended pass
     that spends the budget. It was deliberately **not** started here.
   - The present authorization was issued against, and verified against, today's code, which cannot
     spend it (item 3). It does **not** cover whatever live-wiring code lands later and must **not**
     be automatically reused once that code exists: a **new, explicit human authorization** is
     required before any live execution, re-verified against the actually merged live-wiring commit,
     the plan/execution-tree/candidate/pricing/budget identities re-derived at that commit, and the
     exact Development ceilings (calls/tokens/cost/concurrency). This is a new authorization, not a
     renewal of the present one.
   - G2 remains **not passed**; `RESOLVER-V3-010` remains `blocked`. No Holdout decision is pending,
     because Development did not run, and Holdout stays fully excluded and separately
     decision-pending in every case. The seven V3-039 evidence files, corpus, ground truth, and the
     corrected G2 evaluator are untouched.
   - No UI/presentation-layer file was touched, so no `docs/MANUAL_TESTING_GAPS.md` entry is required.

8. **Human review/next steps:** review this preflight and decide how to proceed on Development. The
   present authorization is unconsumed (0 calls / 0 tokens / USD 0.00 spent) and preserved as the
   historical decision record, but it is not valid for execution against a future changed live-wiring
   code state and must not be automatically reused once that code lands — a new, explicit human
   authorization (item 7) is required first. The realistic options are to open a scoped live-wiring
   task (blocker 2) and supply a credential (blocker 1), then obtain that new authorization against
   the merged result, or to leave V3-048 parked. No PR has been opened for this branch; open one if
   the documentation should land on `chore/clean-arch-structure`.
