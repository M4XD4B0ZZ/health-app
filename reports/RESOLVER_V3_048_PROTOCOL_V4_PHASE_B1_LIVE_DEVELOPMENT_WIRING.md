# RESOLVER-V3-048 — Phase B1: Protocol-v4 Live Development Wiring

## 1. Basis, authority, and scope

Basis: `e44cd5ce2f99bc7605519c97095a8e2f636c7e92` (PR #202 merge, "Live Development Authorization
Preflight"), the verified tip of `origin/chore/clean-arch-structure` at task start (`git fetch` +
`git log -1`). `git diff 3800a11 e44cd5c -- src/` confirmed PR #202 touched no source file, so every
source-level finding this task's plan was built on still held against this basis.

This task wires — and only wires — the missing live-dispatch architecture the preflight report
(`reports/RESOLVER_V3_048_LIVE_DEVELOPMENT_AUTHORIZATION_PREFLIGHT.md`) found. It made **0 provider
calls**, incurred **USD 0**, read no real credential, produced no live evidence, and did not touch
any file under `logs/resolver-v3-048-protocol-v4` or any of the seven frozen `logs/resolver-v3-039-*`
evidence files.

## 2. CodeGraph MCP preflight and recheck (AGENTS.md "CodeGraph Availability")

- Tool: `mcp__codegraph__codegraph_explore` (the only tool this server exposes), confirmed already
  indexed (796 files) from a prior session in this repository.
- **Preflight query** (before any implementation change): `runOneObservation
runProtocolV4DevelopmentForCandidate createLiveVariantCInterpreter AnthropicBenchmarkTransport`.
  Findings used to scope the change: call path `runProtocolV4DevelopmentForCandidate`
  (`…DevelopmentRunner.ts:372`) → `runOneObservation` (`…DevelopmentRunner.ts:167`) → the hard-coded
  fixture transport/credential/sources block (lines 274-288) → `runProtocolV4Attempt`; the fixture
  `extractCounts` block (lines 303-329); `createLiveVariantCInterpreter`
  (`VariantCLiveInterpretationProvider.ts:60-89`, already supports an optional `transport` param and
  already throws `VariantCLiveProviderConfigError` on a missing credential); `AnthropicBenchmarkTransport`/
  `createAnthropicBenchmarkTransport` (the real, unused-by-Protocol-v4 proxy-aware transport);
  `assertDevelopmentAuthorized`'s existing (asymmetric) `liveExecution` gate.
- **Second preflight query** (before the fast-path extraction): `ResolverV3VariantCAdapter
runVariantCCase buildFastPathMealResult RepresentativeHybridV1LiveRunner`. Found
  `buildFastPathMealResult` already existed as a private, self-contained real-fast-path primitive
  (`ResolverV3VariantCAdapter.ts:151-232`), and confirmed `RepresentativeHybridV1LiveRunner.ts` (the
  RESOLVER-V3-039 live orchestration layer) already reuses `buildVariantAResolver().resolver` as
  Variant C's fast-path resolver and never passes `singleComponentFastPathProof` — the precedent this
  task's live context follows.
- **Post-implementation recheck query**: `runOneObservation buildProtocolV4HumanLiveExecutionContext
buildProtocolV4FakeDryRunExecutionContext runProtocolV4LiveDevelopmentEntryPoint
assertDevelopmentAuthorized`. Confirmed the final wiring: `runProtocolV4LiveDevelopmentEntryPoint`
  → `buildProtocolV4MasterPlan`/`validateProtocolV4MasterPlan`/`buildProtocolV4HumanLiveExecutionContext`/
  `isProtocolV4LiveArtifactTargetUnused`/`isProtocolV4LiveAuthorizationConsumedAtomically`/
  `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`/`runProtocolV4DevelopmentForAllCandidates`
  (exactly the six-step order documented in the module); `runOneObservation` now has 5 callers
  (Development Runner, Holdout Runner, and 3 test files); `assertDevelopmentAuthorized` now has 8
  callers. Verbatim source for `buildProtocolV4HumanLiveExecutionContext` and
  `runProtocolV4LiveDevelopmentEntryPoint` returned and matched what is committed (no drift between
  what CodeGraph indexed and the working tree).

## 3. Defect recap (from the preflight report's §5 and §8, items 2–5)

`runOneObservation`'s AI-dispatch path unconditionally built `{ usesProxy: false, fetch: jsonFetch(200,
…) }`, the placeholder credential literal `'protocol-v4-development-not-a-credential'`,
`buildFakeSources(...)`, and `buildFakeZeroCounts(...)` — with no transport/credential/environment
parameter to inject a real one. `runProtocolV4DevelopmentForCandidate` passed a constant
`liveExecution: false` to `assertDevelopmentAuthorized`, so the runner structurally could never reach
the gate's already-complete `human_live` branch. No live Development entry point existed, separate
from the zero-network Mini-Run.

## 4. Design implemented

### 4.1 Dependency injection at the dispatch edge

New `ResolverV3048ProtocolV4ExecutionContext.ts` — a discriminated `ProtocolV4DispatchExecutionContext`
(`fake_dry_run` | `human_live`) that owns the **entire** per-observation dispatch (fast-path decision
included, not only transport/sources), because the two modes have genuinely different control flow:

- `buildProtocolV4FakeDryRunExecutionContext()` — the exact prior `runOneObservation` AI-dispatch/
  fast-path body, moved verbatim. Byte-for-byte behavior-preserving: the full pre-existing Protocol-v4
  and nutrition-benchmark Jest suites pass unmodified (§6).
- `buildProtocolV4HumanLiveExecutionContext(env)` — no transport parameter of any kind:
  1. Fails closed immediately if `env.ANTHROPIC_API_KEY` is absent/empty
     (`ProtocolV4LiveExecutionContextError`, secret-free).
  2. Real fast-path check first, **before any reservation**: `runVariantCFastPathAttempt` (see §4.2)
     with the real `buildVariantAResolver().resolver`, no `singleComponentFastPathProof` (honest
     omission, matching `RepresentativeHybridV1LiveRunner.ts`'s own precedent). A genuine acceptance
     returns `fast_path_no_call` directly — zero reservation, zero call-state-registry transition,
     zero `fetch` call, zero telemetry/ledger entry.
  3. Only on genuine rejection: reserves budget, builds the attempt context, and dispatches through
     `runProtocolV4Attempt` → `runVariantCCaseFromFastPathAttempt` (see §4.2) with the real
     `AnthropicVariantCLiveInterpreter`, via a **private, per-observation counting transport**
     wrapping the real `createAnthropicBenchmarkTransport(env)` (never exposed publicly) that counts
     every attempted `fetch` call — including one that throws before any response — so
     `providerHttpRequests` is measured at the real transport boundary, never inferred from
     `httpStatus != null`.
  4. Real counts (`buildRealProtocolV4CallCounts`): `aiDispatches` from
     `mealResult.aiInterpretation.called`; `providerHttpRequests` from the counting transport;
     `blsCalls`/`offCalls`/`usdaCalls` from real `component.sourceTraces`; `totalExternalRequests`
     computed _after_ as their sum (never `mealResult.externalRequestCount`, which is source-calls-
     only per its own doc comment); `automaticRetries` real `0` (pinned zero-retry policy, no retry
     loop in the transport or interpreter); `avoidedSourceCalls` honestly `not_applicable` for R0
     candidates, a real exact sum from `retrievalExecution` where present for R1-min, else `unknown`
     — never a fabricated `0`.
  5. `sourcesByType` intentionally omitted — the real, zero-network `defaultSourcesByType()`
     (committed `BlsStaticSource`) is reused unmodified, exactly like RESOLVER-V3-039's own live
     runner.

### 4.2 Real fast-path extraction (`ResolverV3VariantCAdapter.ts`, narrowly scoped reuse)

`runVariantCFastPathAttempt(benchmarkCase, deps)` and `runVariantCCaseFromFastPathAttempt(benchmarkCase,
deps, fastPathAttempt)` were extracted from `runVariantCCase`'s own body — zero new confidence-policy
logic, a pure move. `runVariantCCase` itself is now a two-line composition of the two, behaviorally
identical to before (proven by the full, unmodified `ResolverV3VariantCAdapter.test.ts` suite passing).
The live execution context calls the fast-path check **standalone, first**, and — only when it reports
`usedFastPath: false` — continues into the second function with the already-computed attempt, so the
real Variant A resolver runs exactly once per observation, never twice, and no case is executed by "a
precheck plus a second full pipeline".

### 4.3 Single execution-mode identity, enforced at the shared runner boundary

`assertDevelopmentAuthorized`'s `liveExecution: boolean` parameter is now `executionMode:
ProtocolV4ExecutionMode` (`= ProtocolV4DevelopmentAuthorizationRecord['kind']`), and the prior
asymmetric pair of checks (`fake_dry_run` + live → blocked; `human_live` + fake → **not** blocked) is
replaced by one bidirectional check: `authorization.kind !== executionMode` always throws. Independent
of that gate, `runProtocolV4DevelopmentForCandidate` (`ResolverV3048ProtocolV4DevelopmentRunner.ts`)
asserts `authorization.kind === executionContext.mode` as its **very first statement** — before the
lease-expected-identity is even built — so the identity holds for every call path, including a direct
test call that bypasses the new entry point, not only when the entry point happens to be used
correctly.

### 4.4 Mode-aware storage boundary

`ResolverV3048ProtocolV4ArtifactStore.ts`'s internals became a private
`createProtocolV4RootBoundStore(canonicalRelativeRoot: () => string, rootViolationErrorCode)` factory
(a **thunk**, not a plain value — `ResolverV3048ProtocolV4.ts` and this module have a circular import,
and a plain captured value observed `PROTOCOL_V4_DRY_RUN_ROOT`/`PROTOCOL_V4_LIVE_ROOT` as `undefined`
depending on which module's top-level code ran first; a thunk defers the read to first actual use,
matching the original code's own lazy evaluation), instantiated twice:

- Dry-run instantiation, re-exported under the **exact pre-existing names and error codes**
  (`writeProtocolV4ArtifactExclusive`, `PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN`,
  etc.) — zero call-site change anywhere in existing fake-mode code or tests.
- New live instantiation, parallel names (`writeProtocolV4LiveArtifactExclusive`,
  `isProtocolV4LiveArtifactTargetUnused`, `isProtocolV4LiveAuthorizationConsumedAtomically`, …), bound
  to `PROTOCOL_V4_LIVE_ROOT`. Every operation accepts an optional trailing `repoRoot` (default
  `process.cwd()`) so tests can point either store at a temporary directory while still exercising the
  real, unmodified relative root constants underneath it.

`assertDevelopmentAuthorized` picks the bound function set from `authorization.kind` (the same field
already driving §4.3's check). `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`
(`ResolverV3048ProtocolV4ExecutionLease.ts`) gained a claim-time check —
`assertProtocolV4DevelopmentLeaseRootMatchesAuthorizationKind` — validating `artifactStoreRoot` against
the bound-store path validator matching `authorization.kind`, closing a real gap: the Execution Lease
module previously had **no root restriction at all** (confirmed by direct read — it wrote via plain
`fs`/`path.resolve(root)` to any root), with root binding only checked _after the fact_ at dispatch
time via `artifactStoreRootIdentity`. A `human_live` authorization can now only ever claim a lease under
a subpath of `PROTOCOL_V4_LIVE_ROOT`, and vice versa for `fake_dry_run`/`PROTOCOL_V4_DRY_RUN_ROOT` —
structurally, by which function/root is reachable, not a runtime branch that could be gotten wrong.

### 4.5 Live Development entry point

New `ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts`, `runProtocolV4LiveDevelopmentEntryPoint`:
re-derives and validates the Master Plan fresh; requires a real `kind: 'human_live'` authorization with
a `humanApprovalReference` matching the plan's own hashes; builds the live execution context (the
fail-closed credential check, before any side effect); runs a full storage/authorization preflight
(target-unused + not-already-consumed) over every candidate's checkpoint path under the live-bound
store, explicitly **before** claiming a lease, so a predictable storage error cannot orphan one; claims
the lease under `PROTOCOL_V4_LIVE_ROOT` (hard-coded internally, never a caller parameter — `repoRoot`
only changes where that canonical root is anchored, test-only); dispatches Development only via
`runProtocolV4DevelopmentForAllCandidates`; never references any Holdout function or symbol anywhere in
the file (grep-verified in tests). **Never called with a real credential anywhere in this task.**

### 4.6 Holdout — untouched beyond minimal required plumbing

`ResolverV3048ProtocolV4HoldoutRunner.ts` gained no public signature change. It now internally builds
`buildProtocolV4FakeDryRunExecutionContext()` once and passes it to its (now execution-context-
requiring) `runOneObservation` call — the only change needed. Holdout stays fake-only, per scope.

## 5. Files changed

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
A  handoffs/archive/2026-07-30_RESOLVER-V3-048_live-development-authorization-preflight.md
M  handoffs/latest-handoff.md
```

The three existing red-baseline test files changed only their `runOneObservation`/
`runProtocolV4DevelopmentForAllCandidates`/`assertDevelopmentAuthorized` call sites (adding
`executionContext: buildProtocolV4FakeDryRunExecutionContext()` / renaming
`liveExecution: false` → `executionMode: 'fake_dry_run'`) — no assertion or expected behavior changed.

## 6. Tests and verification

```
npx tsc --noEmit -p tsconfig.json                                    # PASS, 0 errors (repo-wide)
npx eslint .                                                          # PASS, 0 errors/warnings (repo-wide)
npx prettier -c <all changed files>                                  # PASS after a fix (see note below)
npx jest --runInBand src/features/nutrition/benchmark/ResolverV3VariantCAdapter.test.ts
                                                                       # PASS, 22/22 (extraction regression proof)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4ExecutionContext.test.ts
                                                                       # PASS, 14/14 (new)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.test.ts
                                                                       # PASS, 12/12 (new)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4      # 5 suites/8 files pass fully; 4 pre-existing
                                                                       # suites show 8 pre-existing failures (§7)
                                                                       # 182/190 tests pass; 0 new failures
npx jest --runInBand src/features/nutrition/benchmark                 # 75/79 suites pass; 927/935 tests pass;
                                                                       # the same 8 pre-existing failures, 0 new
npx jest --runInBand                                                  # repo-wide: 251/255 suites pass;
                                                                       # 2736/2744 tests pass; the same 8
                                                                       # pre-existing failures in the same 4
                                                                       # suites; 0 new failures, and none
                                                                       # outside nutrition/benchmark
```

**Formatting correction (recorded rather than silently fixed).** An earlier pass of this report
claimed `prettier -c` passed on all changed files. That claim was wrong. A re-check found genuine
Prettier violations in three source files — `ResolverV3048ProtocolV4ArtifactStore.ts` (an over-100-col
interface member), `ResolverV3048ProtocolV4DevelopmentAuthorization.ts` (an over-100-col ternary), and
`ResolverV3048ProtocolV4ExecutionContext.ts` (an unnecessarily wrapped `throw`) — plus this report
itself (two multi-line inline code spans and one `*after*` → `_after_`). All were fixed with
`prettier -w` on exactly those files; `prettier -c` over every changed/added file now reports "All
matched files use Prettier code style!". The violations were pure formatting — no logic, control flow,
or assertion changed, and `tsc`/`eslint`/the full nutrition-benchmark suite were re-run clean
afterwards.

Note on the repo-wide gate: `npm run format:check` (`prettier -c .`) cannot be used as a local
CI-equivalent signal on this Windows machine — it reports style issues in **1506** files, the
overwhelming majority untouched by this task (e.g. `SSOK.md`, `VERIFY.md`, `tsconfig.json`,
`src/presentation/**`), because of line-ending normalization differences. Because `npm run verify`
chains `typecheck && lint && format:check && test`, a local `npm run verify` therefore halts at
`format:check` before reaching the tests; the individual commands above were run directly instead, and
green GitHub Verify on this branch is the authoritative repo-wide signal.

New focused coverage (26 tests across the two new files) proves: the live context never calls
`usesFastPath`/`buildFakeSources`/`acceptingFastPathResolver`/`jsonFetch` (structural, source-sliced);
a genuine real fast-path acceptance makes zero reservations/gate-state changes/fetch calls/telemetry
entries; a genuine rejection reserves exactly once and dispatches exactly one real attempt;
`providerHttpRequests` is counted correctly for HTTP 200, HTTP 500, and a transport exception before
any response (`httpStatus: null`); `blsCalls` is independently derived, not coupled to
`providerHttpRequests`; `avoidedSourceCalls` is `not_applicable` for the R0 candidate exercised;
candidate/model binding stays on `claude-haiku-4-5-20251001`; no public transport-override parameter
exists (a forced extra argument is proven ignored at runtime, not merely rejected by the type system);
`human_live` + `fake_dry_run` execution context and `fake_dry_run` + `human_live` execution context are
both rejected at the shared runner boundary; `assertDevelopmentAuthorized` genuinely accepts a real
`human_live` authorization under the live-bound store; `runOneObservation` genuinely dispatches one real
corpus observation end to end through a real claimed `human_live` lease and the real live execution
context, zero-network (`global.fetch` mocked only); the entry point's credential-missing path creates no
lease under the real repository's canonical live path (checked directly); the canonical live root is
hard-coded (source-level proof — no `artifactStoreRoot` field in its input type); the entry point never
imports anything from a Holdout module; a live-bound lease claim under a dry-run-shaped root is rejected
and writes nothing, and vice versa.

## 7. Pre-existing, unrelated local-environment limitation (confirmed via A/B test, not fixed)

8 tests across 4 files (`ResolverV3048ProtocolV4DryRun.test.ts`,
`ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts`,
`ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts`,
`ResolverV3048ProtocolV4FinalPhaseAClosureRedBaseline.test.ts`) fail identically before and after this
task's changes, on this Windows development machine only: `ENOENT ... mkdir '...\leases\mini-run-
development:<hash>'` / `'...\leases\dry-run-development:<hash>...'`. Windows rejects `:` as a path-
component character; these pre-existing authorization IDs (e.g. `` `mini-run-development:${planHash}` ``
in `ResolverV3048ProtocolV4DryRun.ts`, unmodified by this task) become invalid directory names when the
Execution Lease module derives a lease directory from them.

**Confirmed pre-existing, not introduced by this task:** `git stash` (reverting to the unmodified
`e44cd5c` basis) and re-running `ResolverV3048ProtocolV4DryRun.test.ts -t "runs Masterplan"` reproduces
the identical `ENOENT`/colon error at the identical call site, before any of this task's edits existed.
`git stash pop` restored this task's work immediately after confirming this. This is a Windows-local-
filesystem limitation of pre-existing code, out of this task's scope (a colon-containing authorization-
ID-as-directory-name choice, unrelated to live-dispatch wiring) — not fixed here, to keep this change
minimal and scoped.

**Second, independent confirmation (static, no stash required).** The colon-containing authorization ID
is present in the _committed_ `HEAD` version of the file this task barely touched —
`git show HEAD:…/ResolverV3048ProtocolV4DryRun.ts` line 1474,
`` authorizationId: `mini-run-development:${plan.planHash.slice(0, 16)}` `` — and
`git diff HEAD -- …/ResolverV3048ProtocolV4ExecutionLease.ts` shows **no** change to
`leaseVersionPath` or the failing `fs.mkdirSync` call. This task's only pre-write addition to that path
is the new root-match assertion, which throws a different, clearly-named error. The `mkdir` therefore
failed identically at `HEAD`, by construction, independent of the stash-based A/B above.

The failure is expected not to reproduce in the canonical Linux CI environment, where `:` is a valid
filename character. That expectation is not self-certified here: green GitHub Verify on this branch is
the authoritative confirmation, and this report should be read together with that CI result. Zero of this
task's own new code or new tests are affected — all 26 new tests, the full `ResolverV3VariantCAdapter.test.ts`
suite, and every other existing Protocol-v4/nutrition-benchmark test pass cleanly.

## 8. Evidence integrity confirmed unchanged

The seven `logs/resolver-v3-039-*` evidence files, the V3-039 closeout report, and the V3-039 evidence
manifest were not referenced by any file this task touched. `logs/resolver-v3-048-protocol-v4/` was not
created (confirmed directly by a test asserting its non-existence after a credential-missing entry-point
call, and by construction — every test that exercises live storage/lease code uses an isolated temporary
`repoRoot`). `tmp/resolver-v3-048-protocol-v4-dry-run/` behavior is unchanged (existing tests still clean
it up via their own `afterAll`). No BLS artifact, `.github/workflows/**`, `package.json`/lockfile,
Supabase migration, UI, DI, or feature-flag file was touched. No credential was read (`ANTHROPIC_API_KEY`
is a literal test-only placeholder string in every new test, only ever paired with a mocked
`global.fetch`; the entry point is never called with a real key anywhere in source or tests). No
`human_live` authorization with a real `humanApprovalReference` tied to an actual human decision was
constructed — only test-scoped placeholder strings. No Execution Lease was ever claimed under the real
repository's `logs/resolver-v3-048-protocol-v4` path. **Real provider calls: 0. Real provider cost: USD
0.00.**

Post-implementation re-verification of the above (run directly, not inferred): `logs/resolver-v3-048-protocol-v4`
does not exist; `git status --porcelain logs/` is empty, so no `logs/resolver-v3-039-*` evidence file
changed; `tmp/resolver-v3-048-protocol-v4-dry-run` does not exist (the suites' own `afterAll` cleaned it
up).

**Credential-availability correction.** The PR #202 preflight recorded "no `.env` exists". That detail
was wrong: a gitignored `.env` **does** exist in this working copy, unmodified since 2026-07-24. It
contains **no** `ANTHROPIC_API_KEY` — verified by listing variable NAMES only
(`grep -oE '^[A-Z_][A-Z0-9_]*=' .env`); no value was read, printed, or logged, and the file was not
modified. The blocker's operative conclusion is therefore unchanged and still correct (no Anthropic
credential is available, and `.env` is under `AGENTS.md`'s absolute protection so an agent may not add
one), but the concrete maintainer action is to **add `ANTHROPIC_API_KEY` to the existing `.env`**, not to
create the file. `ROADMAP.md`'s living status text was corrected accordingly; the frozen PR #202
preflight report is historical evidence and was deliberately **not** rewritten.

## 9. Status

- A real Protocol-v4 live Development dispatch path exists and is typed/structurally separate from the
  fake dry-run path (`ProtocolV4DispatchExecutionContext`).
- The previously hard-wired fixture block is removed from the shared dispatch core
  (`runOneObservation`); it now delegates entirely to the injected execution context.
- `liveExecution: false` is no longer a runner constant; `executionMode` is derived from, and checked
  bidirectionally against, the real authorization's own `kind`.
- A real `human_live` path is demonstrated reachable through tests (§6), zero-network.
- Missing credential stops before any lease claim, budget reservation, or artifact write (§6, §8).
- No real provider call was made. Actual cost of this task: **USD 0.00**.
- No live evidence was produced.
- Holdout remains unexecuted and unauthorized; no Holdout code was touched beyond the minimal internal
  wiring `runOneObservation`'s new required parameter forced (§4.6).
- **G2 remains `not passed`.**
- **`RESOLVER-V3-010` remains `blocked`.**
- The PR #202 authorization (324 calls / USD 5.142528) is **not** reused or carried forward by this
  task — per that authorization's own preflight report §6/§9, it was checked against a code state that
  could not dispatch a single live call, and this task changed that dispatch code. A **new, explicit
  human authorization** — re-verified against this commit, with plan/execution-tree/candidate/pricing/
  budget identities re-derived here — is required before any live Development call. Holdout stays a
  separate, later decision in every case.
