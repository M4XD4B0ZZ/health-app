# Handoff — RESOLVER-V3-048: Phase B1 Protocol-v4 Live Development Wiring (2026-07-30)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. Phase B1 (live-dispatch code wiring)
   is complete; **no live run happened**. Branch: `claude/resolver-v3-048-phase-b1-live-dev-wiring`.
   Basis: `e44cd5c` (PR #202 merge, tip of `chore/clean-arch-structure` at task start).
   **Actual consumption: 0 provider calls, 0 tokens, USD 0.00.** G2 remains `not passed`;
   `RESOLVER-V3-010` remains `blocked`; Holdout remains unexecuted and unauthorized.

2. **What changed:** the missing live-dispatch architecture the PR #202 preflight found was
   implemented — and only that.
   - New `ResolverV3048ProtocolV4ExecutionContext.ts`: a discriminated
     `ProtocolV4DispatchExecutionContext` (`fake_dry_run` | `human_live`) that owns the entire
     per-observation dispatch. `fake_dry_run` is a verbatim move of the prior `runOneObservation`
     fixture body (behavior-preserving). `human_live` fails closed on a missing `ANTHROPIC_API_KEY`,
     runs the real fast-path check **before any budget reservation or call-state transition**, and only
     on genuine rejection dispatches through the real `AnthropicVariantCLiveInterpreter` via a private
     per-observation counting transport (so `providerHttpRequests` is measured at the real `fetch`
     boundary, never inferred from `httpStatus != null`).
   - `ResolverV3VariantCAdapter.ts`: `runVariantCFastPathAttempt` / `runVariantCCaseFromFastPathAttempt`
     extracted from `runVariantCCase`'s own body (pure move, zero new confidence-policy logic);
     `runVariantCCase` is now a two-line composition of them.
   - `assertDevelopmentAuthorized`: `liveExecution: boolean` → `executionMode: ProtocolV4ExecutionMode`,
     with one **bidirectional** check (`authorization.kind !== executionMode` always throws), replacing
     the prior asymmetric pair that never blocked `human_live` + fake execution.
     `runProtocolV4DevelopmentForCandidate` independently re-asserts the same identity as its first
     statement, for every call path.
   - `ResolverV3048ProtocolV4ArtifactStore.ts`: internals became a private root-bound factory
     instantiated twice — dry-run (re-exported under the exact pre-existing names/error codes, zero
     call-site change) and new live (parallel names bound to `PROTOCOL_V4_LIVE_ROOT`).
   - `ResolverV3048ProtocolV4ExecutionLease.ts`: gained a claim-time root check, closing a real gap —
     the module previously had **no** root restriction at all (root binding was only checked after the
     fact at dispatch time).
   - New `ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts`: re-derives/validates the plan, requires
     a real `human_live` authorization matching it, builds the live context (fail-closed credential
     check), runs the full storage/authorization preflight **before** claiming a lease, claims under the
     hard-coded canonical live root, dispatches Development only, never references Holdout.
   - Holdout Runner: no public signature change; only the minimal internal plumbing the new required
     `executionContext` parameter forced. Stays fake-only.
   - Docs: `ROADMAP.md` status/Current Focus, new Phase B1 report, PR #202 handoff archived.

3. **Why it changed:** the maintainer's live Development authorization (324 calls / USD 5.142528) could
   not be spent because the repository had no live dispatch path at all — `runOneObservation` hard-wired
   a fixture transport, a placeholder credential, `buildFakeSources`/`buildFakeZeroCounts`, and
   `runProtocolV4DevelopmentForCandidate` passed a constant `liveExecution: false`. This task closes that
   code gap so a future authorized run is structurally possible, without making one.

4. **Files changed:**

   ```
   M  ROADMAP.md
   M  src/features/nutrition/benchmark/ResolverV3VariantCAdapter.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ArtifactStore.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentAuthorization.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DryRun.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease.ts
   M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4HoldoutRunner.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts
   M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalPhaseAClosureRedBaseline.test.ts
   A  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionContext.ts
   A  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts
   A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4ExecutionContext.test.ts
   A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.test.ts
   A  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B1_LIVE_DEVELOPMENT_WIRING.md
   A  handoffs/archive/2026-07-30_RESOLVER-V3-048_live-development-authorization-preflight.md
   M  handoffs/latest-handoff.md
   ```

   The three existing red-baseline test files changed only their call sites (adding
   `executionContext: buildProtocolV4FakeDryRunExecutionContext()`, renaming `liveExecution: false` →
   `executionMode: 'fake_dry_run'`). No assertion or expected behavior changed.

5. **Verification executed** (VERIFY.md Category 4, product/runtime code — plus Category 1 readback for
   the doc files):

   ```
   npx tsc --noEmit -p tsconfig.json                      # repo-wide typecheck
   npx eslint .                                           # repo-wide lint
   npx prettier -c <every changed/added file>             # targeted format check
   npx jest --runInBand src/features/nutrition/benchmark  # the affected area, full
   npx jest --runInBand                                   # full repo suite
   git --no-pager status --short / diff --stat            # readback
   ```

   **Why not `npm run verify` as the single gate:** `npm run verify` chains
   `typecheck && lint && format:check && test`, and `format:check` (`prettier -c .`) reports style
   issues in **1506** files on this Windows machine — overwhelmingly files this task never touched
   (`SSOK.md`, `VERIFY.md`, `tsconfig.json`, `src/presentation/**`), from line-ending normalization. It
   therefore halts before the tests run and is not a usable local CI-equivalent signal. The four
   commands it chains were run directly instead, with the format check scoped to this task's own files.
   Green GitHub Verify on this branch is the authoritative repo-wide signal.

6. **Verification result:**
   - `tsc --noEmit`: **PASS**, 0 errors.
   - `eslint .`: **PASS**, 0 errors/warnings.
   - `prettier -c` over every changed/added file: **PASS** — "All matched files use Prettier code
     style!" — but only after a real fix (see item 7a).
   - `jest src/features/nutrition/benchmark`: 75/79 suites, **927/935 tests pass**. The 8 failures are
     pre-existing and Windows-local (item 7b); 0 new failures.
   - Full `jest --runInBand` (repo-wide): 251/255 suites, **2736/2744 tests pass**, 699 s. The failures
     are exactly the same 8 in the same 4 suites — no failure anywhere outside
     `src/features/nutrition/benchmark`, and 0 new failures.
   - Evidence integrity re-checked directly: `logs/resolver-v3-048-protocol-v4` does not exist;
     `git status --porcelain logs/` is empty (no `logs/resolver-v3-039-*` evidence file touched);
     `tmp/resolver-v3-048-protocol-v4-dry-run` does not exist.

7. **Known issues, blockers, residual risks:**

   a. **Two documentation inaccuracies found and corrected, not silently fixed.** (i) An earlier draft of
   the Phase B1 report claimed `prettier -c` passed on all changed files. It did not — three source
   files (`…ArtifactStore.ts`, `…DevelopmentAuthorization.ts`, `…ExecutionContext.ts`) and the report
   itself had genuine violations (over-100-col lines, an unnecessarily wrapped `throw`, two multi-line
   inline code spans). Fixed with `prettier -w` on exactly those files; formatting-only, no logic
   changed; `tsc`/`eslint`/the benchmark suite were re-run clean afterwards. (ii) The PR #202 preflight
   recorded "no `.env` exists". A gitignored `.env` **does** exist (unmodified since 2026-07-24) and
   contains **no** `ANTHROPIC_API_KEY` — verified by listing variable NAMES only; no value was read,
   printed, or logged. The blocker's conclusion is unchanged, but the real maintainer action is to **add
   `ANTHROPIC_API_KEY` to the existing `.env`**, not to create the file. `ROADMAP.md`'s living status
   text was corrected; the frozen PR #202 report was deliberately **not** rewritten.

   b. **8 pre-existing, Windows-local test failures across 4 files** (`…DryRun.test.ts` and the three
   Final\* red-baseline suites): `ENOENT ... mkdir '...\leases\mini-run-development:<hash>'`. Windows
   rejects `:` in a path component; the pre-existing authorization ID
   `` `mini-run-development:${planHash}` `` becomes an invalid directory name when the lease module
   derives a lease directory from it. Confirmed pre-existing two independent ways: the earlier
   `git stash` A/B against the unmodified basis, and statically — the colon-containing ID is present in
   the **committed** `HEAD` file (`git show HEAD:…/ResolverV3048ProtocolV4DryRun.ts`, line 1474) and
   `git diff HEAD` shows **no** change to `leaseVersionPath` or the failing `fs.mkdirSync`. Not fixed
   here (out of scope: a colon-in-directory-name choice unrelated to live-dispatch wiring). Expected not
   to reproduce on Linux CI, where `:` is legal — that expectation is **not self-certified**; green
   GitHub Verify is the confirmation.

   c. **The PR #202 authorization (324 calls / USD 5.142528) must NOT be reused.** Per its own preflight
   report §6/§9, it was checked against a code state that could not dispatch a single live call — and
   this task changed exactly that code. A **new, explicit human authorization**, re-verified against this
   commit with plan/execution-tree/candidate/pricing/budget identities re-derived, is required before any
   live Development call.

   d. Residual risk: the `human_live` path has never executed against a real provider. It is proven
   reachable and correct only zero-network (`global.fetch` mocked, placeholder key). Real-provider
   behavior — actual token/cost records, real latencies, real error shapes — is unproven by construction.

   e. The 352-call / USD 5.586944 Holdout-inclusive budget remains unauthorized. Holdout stays a
   separate, later human decision.

8. **Human-review status / next steps:**
   - **Not yet reviewed.** Needs review of this branch's diff and a green GitHub Verify before merge.
   - Next step is **not** another Phase-A/B hardening pass. It is a maintainer decision:
     (1) add `ANTHROPIC_API_KEY` to the existing `.env` (an agent may not), and (2) issue a **new** live
     Development authorization checked against this commit. Only then can a live Development run happen.
   - Nothing in this task should be read as authorization to run live. No live call was made, no live
     evidence was produced, and `logs/resolver-v3-048-protocol-v4/` was never created.
