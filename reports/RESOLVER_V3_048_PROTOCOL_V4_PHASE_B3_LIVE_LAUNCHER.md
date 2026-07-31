# RESOLVER-V3-048 — Phase B3: Canonical Live Development Launcher

## 1. Basis, authority, and scope

- **Basis commit:** `d7a2cd3efff1ce08519675fcb48b4c4c5c6769b2` (PR #204 merge — Phase B1 post-merge
  remediation, "durable live evidence finalization"). Verified before branching: working tree clean,
  local `chore/clean-arch-structure` identical to `origin/chore/clean-arch-structure`, and the PR
  #204 merge commit is `HEAD` itself.
- **Branch:** `claude/resolver-v3-048-phase-b3-live-launcher`.
- **Scope (per task):** `scripts/**`, dedicated build configuration under `scripts/**`, focused
  launcher tests, this report, `ROADMAP.md`, handoff rotation. No `package.json`/lockfile change, no
  new dependency, no `.env` read/write, no real provider call, no live-root/lease/evidence creation
  in the real repository, no Holdout import/authorization/execution, no production resolver wiring,
  no G2/corpus/candidate/prompt/schema/pricing change, no RESOLVER-V3-039 evidence change.
- **Nature of this task:** launcher architecture and zero-call verification only. It does not run
  live Development, does not read a real credential, and does not produce live evidence — it makes
  the already-merged `runProtocolV4LiveDevelopmentEntryPoint` reachable through one canonical,
  reproducible, fail-closed command instead of ad-hoc `tsx -e`/inline TypeScript.

## 2. CodeGraph MCP preflight (AGENTS.md "CodeGraph Availability")

**Tool:** `mcp__codegraph__codegraph_explore` (the only tool the `codegraph` MCP server exposes in
this session; re-verified, not assumed).

**Query 1 (session preflight, before any task-specific reading):**
`"runProtocolV4LiveDevelopmentEntryPoint buildProtocolV4MasterPlan buildProtocolV4DevelopmentAuthorization"`
— found `runProtocolV4LiveDevelopmentEntryPoint`
(`ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts:56`) and its flow:
`buildProtocolV4DevelopmentAuthorization` → `validateProtocolV4MasterPlan` → `buildProtocolV4MasterPlan`
(`ResolverV3048ProtocolV4DevelopmentAuthorization.ts:66` /
`ResolverV3048ProtocolV4.ts:768,655`). Result: **success**.

**Query 2 (targeted, before writing the launcher):**
`"buildProtocolV4DevelopmentAuthorization ProtocolV4DevelopmentAuthorizationRecord buildProtocolV4HumanLiveExecutionContext runProtocolV4LiveDevelopmentEntryPoint"`
— confirmed `buildProtocolV4DevelopmentAuthorization` (`ResolverV3048ProtocolV4DevelopmentAuthorization.ts:66`)
takes `{ plan, kind, authorizationId, humanApprovalReference }`, calls
`validateProtocolV4MasterPlan(input.plan)` first, and derives every limit
(`maxCalls`/`maxInputTokens`/`maxOutputTokens`/`maxTotalTokens`/`maxCostUsd`/`maxConcurrency`)
directly from `input.plan.budget` — never an independently re-typed number. Confirmed the intended
new launcher call path: launcher → `buildProtocolV4MasterPlan()` → `validateProtocolV4MasterPlan()`
→ (authorization-file validation against the plan) → `buildProtocolV4DevelopmentAuthorization({ plan,
kind: 'human_live', ... })` → `runProtocolV4LiveDevelopmentEntryPoint({ authorization, env })`.
Result: **success**.

**Query 3 (supporting types before writing the reporting/consumption-status code):**
`"ProtocolV4DevelopmentEvidence PROTOCOL_V4_LIVE_ROOT ExecutionLease claimProtocolV4ExecutionLeaseForDevelopmentAuthorization ArtifactStore isProtocolV4LiveAuthorizationConsumedAtomically ProtocolV4Budget PROTOCOL_V4_G2_GATES"`
— confirmed `ProtocolV4DevelopmentEvidence` (`ResolverV3048ProtocolV4.ts:1029`, `developmentEvidenceRootHash`
only set for `human_live`), `ProtocolV4ExecutionLease.status` (`ResolverV3048ProtocolV4ExecutionLease.ts:96`),
`isProtocolV4LiveAuthorizationConsumedAtomically`/`readProtocolV4ExecutionLease` as the exact,
already-existing functions to call post-hoc for the launcher's closing summary (never re-deriving
consumption/lease state independently). Result: **success**.

No CodeGraph failure occurred at any point in this task; the fail-closed "stop and do not modify
files" path was never triggered.

## 3. Defect addressed

The live Development entry point (`runProtocolV4LiveDevelopmentEntryPoint`) existed only as a
TypeScript library function. There was no canonical CLI launcher, no reproducible TypeScript build
path, no external human-authorization hand-off mechanism, and no isolated start command that
supplies the runner process with the API key exclusively via `.env`. Ad-hoc execution via `tsx -e`,
Jest, or inline TypeScript was the only way to invoke it — exactly the gap this task closes.

## 4. Design implemented

### 4.1 Build contract — local `tsc` only, no `tsx`/`ts-node`/`npx`/global tool/auto-install

- `scripts/resolver-v3-048-live-launcher/launcherBridge.ts` (new): a minimal, explicit re-export
  surface — `buildProtocolV4MasterPlan`, `validateProtocolV4MasterPlan`, `PROTOCOL_V4_LIVE_ROOT`,
  `PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS`/`OUTPUT_TOKENS`, `PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS`,
  `buildProtocolV4DevelopmentAuthorization`, `runProtocolV4LiveDevelopmentEntryPoint`,
  `readProtocolV4ExecutionLease`, `isProtocolV4LiveAuthorizationConsumedAtomically` — never a
  wildcard `export *`, so the compiled surface is exactly what the launcher calls.
- `scripts/resolver-v3-048-live-launcher/globals.d.ts` (new): a one-line ambient `declare const
__DEV__: boolean | undefined;`. The shared domain code the Protocol-v4 graph reuses
  (`FoodCatalogConfig.ts`) already guards this identifier at runtime with
  `typeof __DEV__ !== 'undefined' ? __DEV__ : process.env.NODE_ENV === 'development'` — genuinely
  safe under plain Node — but the app's main build gets the ambient _type_ for `__DEV__` from
  Expo/React Native's own generated typings, which this narrower, RN-free launcher build
  intentionally does not pull in. This file supplies only the missing compile-time name; it changes
  no runtime behavior.
- `scripts/resolver-v3-048-live-launcher.tsconfig.json` (new): standalone (does not extend
  `expo/tsconfig.base`), `module: CommonJS`, `moduleResolution: Node`, `lib: [ES2020, DOM]` (`DOM`
  is required for the `RequestInfo`/`RequestInit` fetch types `AnthropicBenchmarkTransport.ts`
  references — the main app tsconfig gets this from Expo's base, which this standalone config
  intentionally does not extend), `strict: true`, `skipLibCheck: true`, `noEmitOnError: true`,
  `rootDir: ".."` (repo root, so both `scripts/resolver-v3-048-live-launcher/**` and `src/**` compile
  into one mirrored tree), `outDir: "../build/resolver-v3-048-live-launcher"`.
- Verified transitively: the entire Protocol-v4 dependency graph reachable from the bridge (the
  benchmark/domain/application/infrastructure code under `src/features/nutrition/**` this graph
  actually uses — `BlsStaticSource`, `SequentialFoodCatalogResolver`, `DeterministicFoodParser`,
  etc.) uses only relative imports plus `node:*` builtins; it contains **no** `@/*` path-alias import
  anywhere (`grep -r "from ['\"]@/" src/features/nutrition` — no matches), so no path-alias rewriting
  machinery was needed for a plain `tsc` CommonJS emit.
- `scripts/run-resolver-v3-048-live-development.mjs`'s `runLauncherBuild()`: always removes
  `build/resolver-v3-048-live-launcher/` first, then runs
  `node node_modules/typescript/bin/tsc --project scripts/resolver-v3-048-live-launcher.tsconfig.json`
  via `spawnSync(process.execPath, [tscBinPath, ...])` — the local compiler invoked directly by the
  current Node executable, never a shell, never `npx`, never a globally installed `tsc`. Always a
  full recompile (no incremental cache): the safest, simplest reproducibility guarantee — a stale
  compiled artifact can never be silently reused.
- `assertLocalToolchainAvailable()`: checks `node_modules/` and `node_modules/typescript/bin/tsc`
  exist; on either missing, throws a clear, secret-free `LauncherError`
  (`LAUNCHER_NODE_MODULES_MISSING` / `LAUNCHER_LOCAL_TYPESCRIPT_MISSING`) and **never** spawns `npm
install`/`npm ci` itself.
- Build output lives under `build/resolver-v3-048-live-launcher/`, already covered by this
  repository's pre-existing `.gitignore` entry `build/` — no `.gitignore` edit was needed or made.

### 4.2 The launcher itself (`scripts/run-resolver-v3-048-live-development.mjs`, new)

Exactly two modes, enforced by `parseArgs()` (rejects zero or multiple of `--preflight`/`--execute`):

- **`--preflight`**: requires a clean working tree; builds; calls the real
  `buildProtocolV4MasterPlan()`/`validateProtocolV4MasterPlan()` (no `repoRoot` override in
  production); prints commit SHA, plan hash, execution-tree hash, model ID, full candidate/prompt/
  schema/routing identities, pricing version, Development calls, per-call and total max input/
  output/total tokens, max cost, concurrency, retry count, and cache policy; can emit a
  non-authorizing authorization template (`authorizationTemplateOnly: true`, `authorizedPhase:
"development"`, `holdoutAuthorized: false`, `automaticContinuation: false`, empty
  `humanApprovalReference`, a freshly generated `authorizationId`) to an explicit external path
  (validated absolute + outside the repository, same helper `--execute` uses) or to stdout. Never
  checks `ANTHROPIC_API_KEY`; never touches the live root, a lease, or an artifact.
- **`--execute`**: requires `--authorization-file <ABSOLUTE_PATH>`, `--confirm-development-only`,
  `--confirm-max-cost-usd <value>`. In strict order, all before any credential check or side effect:
  1. Authorization-file path is absolute and outside the repository, exists, is a regular file.
  2. JSON parses; structural checks (`authorizationTemplateOnly === false`, non-empty
     `humanApprovalReference`/`authorizationId`).
  3. Working tree clean (real repository).
  4. `authorizedCommit` equals current `HEAD` exactly, **and** the PR #204 merge commit
     (`d7a2cd3efff1ce08519675fcb48b4c4c5c6769b2`) is an ancestor of `HEAD`. A stale authorization
     (e.g. one issued for the historical PR #202 basis `e44cd5c...`) is rejected by the exact-match
     check alone — no special-casing per commit is needed, since a stale `authorizedCommit` can
     never equal a later, current `HEAD`.
  5. Local build; the real, freshly (re-)derived Master Plan.
  6. Every plan-derived field in the authorization file compared against the fresh plan: plan hash,
     execution-tree hash, model ID, pricing version, all three candidates' prompt/schema/routing
     identities, Development calls, max input/output/total tokens, max cost, concurrency (`=== 1`),
     retry count (`=== 0`), `authorizedPhase === 'development'`, `holdoutAuthorized === false`,
     `automaticContinuation === false`. No budget number is independently re-typed anywhere in the
     launcher as an alternative truth — every comparison reads the freshly validated plan.
  7. `--confirm-development-only` present; `--confirm-max-cost-usd` parses to a number exactly equal
     (`===`) to the plan's own `budget.developmentMaxCostUsd`.
  8. **Only now**: `ANTHROPIC_API_KEY` presence (never its value, length, or any environment listing).
  9. Builds the canonical `human_live` Authorization Record via the real
     `buildProtocolV4DevelopmentAuthorization({ plan, kind: 'human_live', authorizationId,
humanApprovalReference })`, then calls the single allowed live call:
     `runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: process.env })` — **no `repoRoot`
     is passed on this production path**. No Holdout function is imported or referenced anywhere in
     the launcher or its bridge (verified both structurally and by asserting the compiled bridge
     exports nothing whose name contains "Holdout").
  10. Closing summary (secret-free): success/failure, actual provider calls/input/output/total
      tokens/cost (aggregated only from the returned evidence's own ledger entries, never
      independently re-computed), Development Evidence Root, canonical Artifact Root, lease end
      status (via the real `readProtocolV4ExecutionLease`), authorization-consumption status (via
      the real `isProtocolV4LiveAuthorizationConsumedAtomically`), and an explicit `"Holdout was not
executed"` note, always.

An additional, non-spec-mandated safety net: both modes assert `process.cwd()` equals the
launcher's own computed repository root before any production plan-building call (skipped only
under the test-only `repoRootForTests` override) — `buildProtocolV4MasterPlan`/
`runProtocolV4LiveDevelopmentEntryPoint` default `repoRoot` to `process.cwd()`, so this guards
against a user invoking the script from the wrong directory and silently reading/writing the wrong
evaluator files or live root.

### 4.3 Authorization file format (external, human-authored)

A JSON object (schema version `resolver-v3-048-live-launcher-authorization-file-v1`) produced by
`--preflight`'s template and completed by a human before `--execute`:

```
authorizationTemplateOnly: false        (must be exactly false; the template itself has true)
authorizedCommit: "<full 40-char SHA>"  (must equal HEAD exactly at execute time)
masterPlanHash / developmentExecutionTreeHash / modelId / pricingVersion
candidateIdentities: [{ id, version, promptVersion, promptHash, schemaVersion, schemaHash, routingVersion }, …]
developmentCalls / developmentMaxInputTokens / developmentMaxOutputTokens / developmentMaxTotalTokens
developmentMaxCostUsd / currency / maxConcurrentRequests / retryCount
authorizedPhase: "development"
holdoutAuthorized: false
automaticContinuation: false
authorizationId: "<non-empty>"
humanApprovalReference: "<non-empty — empty in the template>"
```

## 5. Files changed

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
(covered by the pre-existing `build/` entry) and is not part of this commit.

## 6. Tests and verification

### 6.1 Focused launcher tests (zero-network, USD 0.00)

Node's own built-in test runner (`node --test`), matching this repository's existing convention for
testing `.mjs` scripts (`scripts/automation/__tests__/claude-queue-preflight.test.mjs`) — **not**
picked up by `npm test` (Jest's `testMatch` is scoped to `src/**/__tests__/**/*.test.ts` only, so
`jest.config.js` was not touched):

```
node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
```

49 assertions across 13 describe blocks — pure validation-logic tests (argument parsing, path
safety, authorization-file structure, authorization-vs-plan field comparisons, confirmation flags,
usage aggregation) use hand-built fixture plan objects and require no TypeScript build; a small
"real build" group shares one real `tsc` compile via a single `before()` hook and exercises: the
compiled bridge exposes no Holdout-named export; the real plan builds and validates; the build
output directory is deterministic and confirmed gitignored (`git status --porcelain -- build/` empty,
`git check-ignore` succeeds); a full `--preflight` run (real plan hashes, no live-root/lease/artifact
created, template written to an explicit external path); `--execute` guard rails (relative/inside-repo
authorization path rejected, a template file rejected, missing `ANTHROPIC_API_KEY` stopping before
any lease/live-root side effect under an isolated `repoRootForTests`); and the full success path with
`global.fetch` fully replaced by a mock, a fake test credential, and an isolated temporary
`repoRootForTests` (seeded with the two real evaluator source files, the same technique
`ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts` already uses) — confirming
the launcher reaches the real, unmodified `runProtocolV4LiveDevelopmentEntryPoint`, the lease reaches
`terminal_success`, the authorization is marked consumed, a `developmentEvidenceRootHash` is
produced, **no file is ever created under the real repository's live root**, and the summary
explicitly reports `"Holdout was not executed"`.

Result: **49/49 pass**, 0 real network calls (`global.fetch` fully replaced for the duration of the
one test that dispatches), USD 0.00.

Note on sequencing: several of the "real build" tests call this launcher's own
`isWorkingTreeClean(REAL_REPO_ROOT)` gate against the actual repository — which is, by construction,
dirty while this very task's files are still uncommitted. Those specific tests were confirmed passing
only after this task's own commit (an honest exercise of the launcher's own fail-closed contract,
not a test-harness artifact); all working-tree-independent tests passed throughout development. Full
post-commit re-run result recorded in section 6.4 below.

### 6.2 Full Protocol-v4 / nutrition-benchmark / repo-wide Jest suites

```
npx jest --runInBand src/features/nutrition/benchmark/protocolV4
npx jest --runInBand src/features/nutrition/benchmark
npx jest --runInBand
```

No production/domain/application/infrastructure code under `src/**` was modified by this task, so
these suites are a regression check confirming this launcher's build-time-only re-export bridge
introduced no behavior change anywhere.

### 6.3 Static checks

```
npx tsc --noEmit -p tsconfig.json      # repo-wide app typecheck (unaffected by the launcher's own,
                                        # separate tsconfig)
npx eslint .
npx prettier -c <every changed/added file>
git --no-pager diff --check
```

### 6.4 Results — confirmed after commit `3e9fafd`

- `node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs`: **PASS**, 49/49
  (13 suites), 0 real network calls, USD 0.00. All four working-tree-clean-gated tests (the two
  `--preflight` end-to-end tests and two of the `--execute` guard-rail tests, including the full
  mocked-`global.fetch` success path reaching the real `runProtocolV4LiveDevelopmentEntryPoint`) now
  pass, confirmed post-commit against the now-clean working tree.
- `npx jest --runInBand src/features/nutrition/benchmark/protocolV4`: **PASS**, 206/206 (10 suites) —
  unchanged from before this task (no `src/**` production code was modified).
- `npx jest --runInBand src/features/nutrition/benchmark`: **PASS**, 951/951 (80 suites).
- Full repo `npx jest --runInBand`: **PASS**, 2760/2760 tests, 256/256 suites, 776.8s. Zero failures,
  zero new failures anywhere.
- `npx tsc --noEmit -p tsconfig.json`: **PASS**, 0 errors (main app tsconfig; unaffected by the
  launcher's own separate `scripts/resolver-v3-048-live-launcher.tsconfig.json`).
- `npx eslint .`: **PASS**, 0 errors/warnings — run with `build/resolver-v3-048-live-launcher/`
  removed first. Note: this repository's `.eslintrc.cjs` has no `ignorePatterns` for `build/`/`dist/`
  (only `node_modules/` is auto-ignored by ESLint's own default), so linting while the launcher's own
  transient build output exists on disk surfaces expected React-Native/Expo-authoring-convention
  lint errors (`no-var`, `no-undef` for `fetch`/`performance`/`Buffer`/`setTimeout` in the compiled
  CommonJS output) in files that were never meant to be linted as source. This is a pre-existing gap
  in `.eslintrc.cjs` that simply never mattered before nothing wrote into `build/`; fixing it is out
  of this task's scope (`.eslintrc.cjs` is not in the allowed scope), so the correct, in-scope
  handling is to always remove `build/resolver-v3-048-live-launcher/` before a repo-wide static-
  analysis pass — exactly what this task's own build step does before every fresh compile, and what
  the verification commands above do explicitly.
- `npx prettier -c` over every changed/added file: **PASS** ("All matched files use Prettier code
  style!") — after one `prettier -w` fix on four files (`handoffs/latest-handoff.md`, the report, the
  launcher, and its test file) during development.
- `git diff --check`: **PASS**, no whitespace/conflict-marker issues.
- `git status --short` / `git diff --stat`: clean tree after commit `3e9fafd`; file list matches
  section 5 exactly.
- Final CodeGraph MCP recheck (`mcp__codegraph__codegraph_explore`, query
  `"runProtocolV4LiveDevelopmentEntryPoint buildProtocolV4DevelopmentAuthorization buildProtocolV4MasterPlan"`):
  **success** — same call flow as query 1 (§2), and the index had already picked up
  `scripts/resolver-v3-048-live-launcher/launcherBridge.ts` as a new caller of both
  `buildProtocolV4MasterPlan` and `runProtocolV4LiveDevelopmentEntryPoint`, confirming no unintended
  change to either function's own relationships.

## 7. Evidence integrity confirmed unchanged

`logs/resolver-v3-048-protocol-v4/` does not exist under the real repository root at any point in
this task (confirmed both by direct `fs.existsSync` checks in the test suite and by the closing
`git status --short` readback). `logs/resolver-v3-039-*` files were not touched. No `.env` was read,
written, or created; `ANTHROPIC_API_KEY`'s value was never read, logged, or referenced by this
task's own code (only its _presence_ is checked, and only inside `runExecute`, strictly after every
other guard passes).

## 8. Actual consumption

**0 provider calls. 0 tokens. USD 0.00.** The launcher itself has never been run with a real
`ANTHROPIC_API_KEY` value anywhere in this task, in source or in tests — only the fail-closed
missing-credential path and a fully `global.fetch`-mocked zero-network success path were exercised.

## 9. Status

`RESOLVER-V3-048` remains `in_progress`. Phase B3 (this task) adds a canonical, reproducible,
fail-closed CLI launcher for the already-merged Phase B1 (+ post-merge remediation) live Development
entry point. **No live Development call has been made by this launcher.** G2 remains **not passed**;
`RESOLVER-V3-010` remains `blocked`; the 352-call / USD 5.586944 Holdout-inclusive budget remains
unauthorized; Holdout remains unexecuted and unauthorized. A maintainer must still: (1) add
`ANTHROPIC_API_KEY` to the existing `.env` (an agent may not), and (2) issue a **new** live
Development authorization — via `--preflight`'s template, completed and reviewed by a human —
checked against the commit this launcher is actually run at. Only then can a real live Development
run happen, and only via this launcher's `--execute` command.

## 10. Pre-PR Remediation (2026-07-31): Authoritative Failure Accounting and Authorization Binding

An independent review of the pushed Phase B3 launcher (commit `774dec7`), before any PR was opened,
found five reproducible security/evidence defects. All five are fixed on the same branch, still with
zero provider calls, zero tokens, USD 0.00 throughout. **CodeGraph MCP preflight** (tool
`mcp__codegraph__codegraph_explore`, the only tool the server exposes) confirmed, before any change:
Launcher → `runProtocolV4LiveDevelopmentEntryPoint` (via the bridge's re-export, unchanged); Entry
Point → `runProtocolV4DevelopmentForAllCandidates` → `runProtocolV4DevelopmentForCandidate`; the
per-candidate write/readback ordering (`writeAndReadBackLiveArtifact` after the observation loop);
and the shared `evidenceGate`/`LiveProviderBudgetGate` instantiated once in
`runProtocolV4DevelopmentForAllCandidates` and threaded unchanged into every candidate — confirming a
real, already-existing, exact-floor call counter (`reserveProtocolV4Call` calls `gate.reserve()`
exactly once per real attempted dispatch; the gate's own `calls` counter is never decremented, only
the in-flight slot is released) was available to read rather than needing a second implementation.

**Defect 1 (false zero-usage on failure).** The launcher previously reported
`actualProviderCalls: 0`/`actualCostUsd: 0` for ANY failed run, including one where real dispatches
had already happened. Fixed with a small, explicitly-scoped Protocol-v4 extension in
`ResolverV3048ProtocolV4DevelopmentRunner.ts`: a new `attachProtocolV4FailureUsageSnapshot(error,
gate, completedCandidates)` is called from the existing `human_live` catch block (which already
marks the lease `terminal_failure`) before re-throwing — mutating the caught error with a
`protocolV4FailureUsageSnapshot` property, never replacing/wrapping it (every existing
`instanceof`/`.message` assertion on Protocol-v4 errors is unaffected). The snapshot's
`providerCallsAtLeast` comes from the shared gate's own `snapshot().calls` (an exact floor, not an
estimate); `confirmed*`/`confirmedCostUsd` are summed only from `completedCandidates` — the
`ProtocolV4DevelopmentForAllCandidates`'s own accumulator, i.e. candidates whose full Development
evidence was already durably written and read back — never re-deriving pricing or usage-parsing.
`accounting` is `'exact_zero'` only when the gate recorded zero reservations (provably zero real
dispatch attempts) and `'partial'` otherwise. The launcher's `summarizeFailureUsage` reads only this
snapshot (`summarizeSuccessUsage` is unchanged/exact for a successful run); no snapshot present
(every pre-dispatch guard failure — plan/authorization/credential/storage-preflight/lease-claim, all
inside `runProtocolV4LiveDevelopmentEntryPoint`, strictly before `runProtocolV4DevelopmentForAll-
Candidates` is ever called) is provably exact-zero by construction, not a guess. New tests: 8 in
`src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`
(unit-level exact-zero/partial/several-dispatches/confirmed-vs-reserved cases, plus real end-to-end
artifact-write-failure-after-dispatch, readback-failure-after-dispatch, and successful-run cases,
using the same isolated-temp-`repoRoot`-with-real-evaluator-files + mocked-`global.fetch` technique
`ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts` already established), plus
launcher-level tests for `summarizeFailureUsage`/`summarizeSuccessUsage` in the `.mjs` test file.

**Defect 2 (incomplete schema/policy binding).** `validateAuthorizationFileStructure` now requires
`authFile.launcherAuthorizationFileSchemaVersion === LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION`
exactly (missing, older, or unknown values all rejected structurally, before any repository/plan
check). `validateAuthorizationAgainstPlan` now also checks `currency` and `noCachePolicy`
(`promptCachingConfigured` + `positiveCacheTokensFailure`) exactly against the freshly rebuilt plan.
`buildAuthorizationTemplate` now includes `noCachePolicy` (previously missing from the template).

**Defect 3 (candidate duplicates).** `candidateIdentitiesMatch` is now an exact set-and-identity
comparison: same count, every ID appearing exactly once (`Set` size check), no unknown ID, no
missing ID (both directions checked against the expected ID set), and all six identity fields
matched by ID (never by array position, so a reordered-but-correct list still passes). New tests
cover `H0,H0,H0`, a missing `H1`, a duplicated `H2`, an unknown ID, a tampered field, and correct
candidates in a different order.

**Defect 4 (non-canonical path safety).** Authorization-file and template-output paths are now
resolved through `fs.realpathSync` (following any symlink/junction to its real target) before the
outside-repo check, with the comparison case-folded on `win32` only (POSIX stays case-sensitive) —
`assertExistingPathCanonicallyOutsideRepoRoot` for the (must-exist) authorization file,
`assertNewFileParentCanonicallyOutsideRepoRoot` for the (not-yet-existing) template output, which
resolves the PARENT directory's real path and rejects a symlinked/junctioned parent whose real
target lands inside the repository. Template writes now use an atomic exclusive (`wx`) open flag via
a new `writeFileExclusive` helper, refusing to silently overwrite an existing file. New tests cover:
same Windows path with different case (skipped on non-Windows), an external symlink to an in-repo
file, an external junction/symlink parent pointing into the repository (both symlink-creation tests
skip, not fail, on an environment that refuses unprivileged link creation — an environment
limitation, not a logic defect), an existing template file not being overwritten, and a genuine
external path working normally.

**Defect 5 (non-canonical cost confirmation).** `validateConfirmationFlags` now requires
`--confirm-max-cost-usd` to equal `String(plan.budget.developmentMaxCostUsd)` — the plan's own
canonical shortest round-trip decimal string — **byte for byte**, replacing the previous
`Number(...) === ...` comparison. Scientific notation, surrounding whitespace, a leading `+`, and an
extra trailing zero are all now refused even though numerically equal; no alternative/hardcoded
budget number was introduced (`canonicalDevelopmentMaxCostUsdString(plan)` derives the string only
from the plan). New tests cover each rejected representation plus the accepted canonical form.

**Secret-free error reporting.** A new `classifyLauncherError(error)` replaces raw
`error.message`/`error.stack` propagation to the closing summary and CLI stderr. An explicit
allowlist of this codebase's own domain error classes (`LauncherError` and every Protocol-v4 error
class reachable from this launcher's Development-only path — verified by source inspection to throw
only fixed, self-authored constant-code strings, never a provider payload/header/proxy/request/
response value) has its `.message` surfaced verbatim; any error outside the allowlist is reported by
stable `class`/`code` only (the error's `.name`), never its `.message`. New tests confirm an
allowlisted class's message is surfaced, and that an unrecognized class's message (a deliberately
"arbitrary internal detail") is never echoed anywhere in the result.

**Files changed in this remediation:**

```
M  scripts/run-resolver-v3-048-live-development.mjs
M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
M  ROADMAP.md
M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md (this section)
A  handoffs/archive/<archived prior handoff>
M  handoffs/latest-handoff.md
```

**Verification (this remediation) — confirmed after commit `a4c0d6d`:**

- Focused launcher tests (`node --test`): **83/83 pass** post-commit (79/83 pre-commit — the 4
  failures were this launcher's own working-tree-clean gate, which by construction cannot pass
  until this remediation's own files are committed; confirmed 83/83 once the tree was clean,
  including the full mocked-`global.fetch` success path and both new real end-to-end
  artifact-write-failure/readback-failure usage-accounting tests).
- New `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 8/8.
- Full `protocolV4` Jest suite: **PASS**, 214/214 (11 suites; 206 prior + 8 new).
- Full `nutrition-benchmark` Jest suite: **PASS**, 959/959 (81 suites).
- Full repo-wide `npx jest --runInBand`: **PASS**, 2768/2768 tests, 257/257 suites, 782.1s (2760
  prior + 8 new). Zero failures, zero new failures anywhere.
- `tsc --noEmit`: **PASS**, 0 errors.
- `eslint .`: **PASS**, 0 errors (run with the launcher's transient
  `build/resolver-v3-048-live-launcher/` output removed first, per the existing §6.4 note).
- `prettier -c` over every changed/added file: **PASS** after one `-w` pass on 4 files.
- `git diff --check`: **PASS**.
- Final CodeGraph MCP recheck (`mcp__codegraph__codegraph_explore`, query
  `"attachProtocolV4FailureUsageSnapshot runProtocolV4DevelopmentForAllCandidates markProtocolV4ExecutionLeaseTerminalFailure"`):
  **success** — confirmed `attachProtocolV4FailureUsageSnapshot` is correctly indexed inside
  `ResolverV3048ProtocolV4DevelopmentRunner.ts`, instantiates no unintended relationship, and the
  `human_live` catch block's call order (mark lease `terminal_failure`, then attach the snapshot,
  then re-throw) matches what was implemented.

Zero provider calls, zero tokens, USD 0.00 throughout — this remediation, like Phase B3 itself,
never runs the launcher with a real credential.

## 11. Pre-PR Remediation 2 (2026-07-31): Transport-Authoritative Accounting and Failure Finalization

A second independent pre-PR review found five further defects in usage accounting, lease
finalization, and error redaction. All five are fixed on the same branch, still zero provider
calls. **CodeGraph MCP preflight** (`mcp__codegraph__codegraph_explore`) confirmed, before any
change: the Human-Live Execution Context's private counting-transport boundary (incrementing
immediately before every real `fetch`, in `ResolverV3048ProtocolV4ExecutionContext.ts`);
`reserveProtocolV4Call` → `LiveProviderBudgetGate.reserve` (exactly once per real attempted
dispatch, never decremented); the Development Runner's catch block calling
`markProtocolV4ExecutionLeaseTerminalFailure` (the exact point Defect 3 reorders); and the
launcher's `summarizeSuccessUsage`/`summarizeFailureUsage`/`classifyLauncherError` call sites.

**Defect 1 (success accounting counted usage records, not HTTP requests).** `summarizeSuccessUsage`
now sums the real, measured `counts.providerHttpRequests.value` from every ledger entry (exact,
regardless of usage outcome) as a dimension fully separate from confirmed tokens/cost (summed only
from entries with `usageStatus === 'reported'` and a computed `actualCostUsd`). A structurally
successful run is no longer automatically billing-exact: if any HTTP request lacks full usage/cost
information, overall accounting is `'partial'` and that entry's own `reservedWorstCaseCostUsd`
(already computed by the real reservation, never re-derived) contributes to a safe upper bound
instead of being silently reported as USD 0.00.

**Defect 2 (reservation count mislabeled as a provider-request count).** The shared budget gate's
`snapshot().calls` is now named and documented purely as `aiDispatchReservations` — never
`providerCallsAtLeast`/`actualProviderCalls`/a "safe provider-request floor". A new, read-only,
transport-authoritative cumulative counter was added to `ProtocolV4HumanLiveExecutionContext`
(`getCumulativeProviderHttpRequestCount()`), incremented exactly at the private counting-transport
boundary immediately before every real `fetch`, spanning every candidate/observation of one
Development run. No transport injection, no caller-settable value, no URL/header/credential/proxy
data. `attachProtocolV4FailureUsageSnapshot` now derives `providerHttpRequests` from this counter,
not from the gate.

**Defect 3 (failure snapshot lost to lease-finalization errors).** The Development Runner's catch
block now: (1) normalizes the caught throwable to a real `Error`; (2) attaches the usage snapshot
to that ORIGINAL error first; (3) attempts `markProtocolV4ExecutionLeaseTerminalFailure` in its own
nested `try`/`catch`; (4) never lets a lease-finalization failure replace the original error or its
snapshot; (5) attaches a separate, secret-free `protocolV4LeaseFinalizationStatus`
(`'terminal_failure_confirmed'` | `'failed_to_persist'`) either way. Baseline computation and
budget-gate construction were moved INSIDE the `try` (previously outside it, so a baseline failure
after the lease reached `executing` left it stuck there uncaught) — `evidenceGate` is now declared
`let ... | undefined` outside the `try` so the `catch` can still build a snapshot (reporting
`aiDispatchReservations: 0`) even when the gate was never constructed.

**Defect 4 (absent snapshot silently meant exact zero).** `summarizeFailureUsage` no longer treats
"no snapshot" as automatically zero. A new `KNOWN_PRE_DISPATCH_ERROR_CLASSES` allowlist (every
Protocol-v4 error class verified by source inspection to be reachable only strictly before the
Development Runner's dispatch loop starts, plus the launcher's own `LauncherError`) is the only
thing that still justifies reporting exact zero without a snapshot; any other error reports
`accounting: 'unknown'` with `null` numeric fields — never a fabricated `0`.

**Defect 5 (error allowlist trusted classes, not codes).** Every `LauncherError` now takes
`(code, internalDetail)`: `code` MUST be one of a fixed, enumerated `KNOWN_LAUNCHER_ERROR_CODES` set
(the ONLY thing `classifyLauncherError` ever surfaces — an exact-match check, not a class-based
trust decision); `internalDetail` (a resolved path, a foreign error's message, `tsc` stdout/stderr,
a submitted argument value) is a plain, non-message property never read by `classifyLauncherError`
and never reaching stdout/stderr/the summary. Every direct `new LauncherError(...)` call site across
the launcher (git helpers, build, path safety, JSON parsing, `assertCheck`) was updated to this
split. Protocol-v4 domain-error messages are additionally truncated at the first non-code character
as extra safety margin. New tests include a malformed authorization JSON file embedding a
secret-like marker, verified absent from `runExecute`'s thrown error, `classifyLauncherError`'s
output, AND a real CLI subprocess's actual stdout/stderr.

**Production-call contract.** `runExecute`'s dispatch object is now built as
`const dispatchArgs = { authorization, env }; if (repoRootForTests) { dispatchArgs.repoRoot = ... }`
— the production path never includes a `repoRoot` key at all (not even `repoRoot: undefined`).
Proven at the source level (a live production call cannot itself be exercised in a test without
targeting the real repository's live root, which no test may ever do).

**Files changed in this remediation:**

```
M  scripts/run-resolver-v3-048-live-development.mjs
M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionContext.ts
M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
M  ROADMAP.md
M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md (this section)
A  handoffs/archive/<archived prior handoff>
M  handoffs/latest-handoff.md
```

**Verification (this remediation) — confirmed after commit `27f1086`:**

- Focused launcher tests (`node --test`): **95/95 pass** post-commit (90/95 pre-commit — the 5
  failures were this launcher's own working-tree-clean gate, which by construction cannot pass
  until this remediation's own files are committed; confirmed 95/95 once the tree was clean).
- `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 14/14 (8 prior + 6 new real
  end-to-end cases: reservation-before-fetch, error-after-one-fetch, lease-finalization-failure,
  baseline-failure-after-executing, plus updated write/readback/success cases).
- Full `protocolV4` Jest suite: **PASS**, 220/220 (11 suites).
- Full `nutrition-benchmark` Jest suite: **PASS**, 965/965 (81 suites).
- Full repo-wide `npx jest --runInBand`: **PASS**, 2774/2774 tests, 257/257 suites, 729.8s (2768
  prior + 6 new). Zero failures, zero new failures anywhere.
- `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors. `prettier -c`: **PASS** after
  one `-w` pass on 4 files. `git diff --check`: **PASS**.
- Final CodeGraph MCP recheck (`mcp__codegraph__codegraph_explore`, query
  `"summarizeSuccessUsage summarizeFailureUsage classifyLauncherError getCumulativeProviderHttpRequestCount attachProtocolV4LeaseFinalizationStatus"`):
  **success** — confirmed the on-disk `runExecute`'s production dispatch object
  (`{ authorization, env }` with `repoRoot` added only conditionally), `classifyLauncherError`'s
  exact-match/prefix-extraction logic, and `attachProtocolV4LeaseFinalizationStatus`'s placement all
  match what was implemented.

Zero provider calls, zero tokens, USD 0.00 throughout.

## 12. Pre-PR Remediation 3 (2026-07-31): Closed Output Surface and Transition-Atomic Accounting

A third independent pre-PR review found five further defects in CLI-argument redaction,
Protocol-v4 error-code trust, lease-transition atomicity, success-path accounting, and output
content. All five are fixed on the same branch, still zero provider calls. **CodeGraph MCP
preflight** (`mcp__codegraph__codegraph_explore`, five queries) confirmed, before any change: the
CLI `main` → `parseArgs` → stdout/stderr path; `classifyLauncherError`'s reachable Protocol-v4 error
classes and every constant base code actually thrown by them (verified call-site by call-site, not
invented); the Development Runner's `markProtocolV4ExecutionLeaseExecuting` call site relative to
the shared catch block; `LiveProviderBudgetGate`'s success-/failure-usage-snapshot call graph; and
the Live Entry Point → Runner → launcher-summary chain.

**Defect 1 (raw CLI arguments could reach stdout/stderr).** `parseArgs` no longer embeds the
original argv token or value in `result.errors` — every parser error is now one of four constant
codes (`LAUNCHER_ARGUMENT_UNKNOWN`, `LAUNCHER_ARGUMENT_VALUE_MISSING`, `LAUNCHER_MODE_MISSING`,
`LAUNCHER_MODE_MULTIPLE`), enumerated in an exported `KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES` set.
`main()` re-checks each code against that set before printing (the same defense-in-depth pattern
`classifyLauncherError` already used), falling back to a generic code for anything unrecognized.
Tests cover a secret-like marker as an unknown argument, at an unexpected position (before the mode
flag), and as a value following an unknown flag — verified absent from `result.errors` at the unit
level and from stdout/stderr via a real CLI subprocess invocation.

**Defect 2 (Protocol-v4 error codes trusted by class + regex shape alone).** Combining a known-safe
error CLASS with any regex-shaped prefix was not a real allowlist: a corrupted or foreign message
that merely looked like a constant code would still have been surfaced verbatim. A new, real
`KNOWN_SAFE_PROTOCOL_ERROR_CODES` set enumerates every constant base code actually thrown by a
`KNOWN_SAFE_PROTOCOL_ERROR_CLASSES` member across `src/features/nutrition/benchmark/protocolV4/`,
derived directly from source (every `throw new ProtocolV4...Error(...)` call site for those 15
classes). `classifyLauncherError` now extracts the fixed base-code prefix (before any dynamic `:`
suffix, exactly as before) and checks it by EXACT match against this set; an unrecognized or
dynamic base code (including one that is itself templated, e.g.
`PROTOCOL_V4_EVALUATION_NO_${x}_REPORT`, which can never exactly match a single fixed string) falls
back to a generic `PROTOCOL_V4_UNRECOGNIZED_CODE` rather than being trusted.

**Defect 3 (the `claimed -> executing` transition lived outside the protected failure handler).**
`transitionLease` (reached via `markProtocolV4ExecutionLeaseExecuting`) writes the lease file and
only afterwards reads it back to validate a hash/filename — a failure at that readback step means
the file is already persisted as `executing` on disk even though the call still throws. Before this
remediation, that transition ran BEFORE the Development Runner's `try`, so such a failure (or any
failure in the transition itself) escaped the shared catch entirely: no usage snapshot, no
`terminal_failure` attempt, the lease left stuck `executing`. The transition now runs as the FIRST
statement inside the same `try` that already covers baseline computation, gate construction,
dispatch, and persistence — every failure path reachable after the initial active-lease check now
reaches the one shared catch. A new zero-network test (`Test 8`) spies on
`markProtocolV4ExecutionLeaseExecuting` to call through to the REAL implementation (genuinely
persisting `executing` to disk) and then throw, simulating a post-write validation failure;
confirms the original error and its usage snapshot (`accounting: 'exact_zero'`, zero HTTP requests,
zero reservations) survive unchanged, `terminal_failure` is still attempted and confirmed
(`leaseFinalization: 'terminal_failure_confirmed'`), and the real on-disk lease ends in
`terminal_failure` rather than stuck `executing`.

**Defect 4 (the success path never reported a budget-gate-authoritative reservation count).** The
success path previously hardcoded `aiDispatchReservations: null`. The Development Runner now builds
a `ProtocolV4SuccessUsageSnapshot` (`buildProtocolV4SuccessUsageSnapshot` in
`ResolverV3048ProtocolV4DevelopmentRunner.ts`; the type itself is defined in
`ResolverV3048ProtocolV4.ts` next to `ProtocolV4DevelopmentEvidence`, to avoid a circular import)
from the exact same authoritative sources as the failure snapshot: `providerHttpRequests` from the
`human_live` execution context's transport-authoritative counter, `aiDispatchReservations` and the
reserved-token/cost upper bounds from the shared budget gate's own `snapshot()`, and confirmed
tokens/cost summed only from durably written ledgers. It is attached to
`evidence.successUsageSnapshot` strictly AFTER `developmentEvidenceRootHash` is computed — a
read-only return channel `computeDevelopmentEvidenceRootHash` never reads (verified: that function
only ever reads `planManifest`/`candidates`/`candidateEvaluationTable` content hashes), so attaching
it can never change the Development Evidence Root or any stored artifact hash. `reserved*UpperBound`
now consistently denotes the gate's ENTIRE reserved-worst-case totals on both success and failure
paths (previously the success path summed only the incomplete-usage entries' own
`reservedWorstCaseCostUsd` — a partial, unclearly-named amount). The launcher's own
`summarizeSuccessUsage` now simply reads this snapshot rather than re-deriving anything from
`evidence.candidates` ledger content itself.

**Defect 5 (absolute paths and a hardcoded cost value in output).** The closing CLI summary's
`canonicalArtifactRoot` (the real, absolute `artifactStoreRoot` filesystem path) is replaced with a
stable, secret-free semantic identity: `artifactRootKind: 'protocol_v4_live'`. The printed
`--preflight` output no longer includes the absolute `authorizationTemplateWrittenTo` path — only a
boolean `authorizationTemplateWritten` (`runPreflight()`'s own return value is unchanged, so
programmatic callers/tests can still read back the real path to verify the written file). The
launcher's own module doc comment no longer hardcodes the plan's `developmentMaxCostUsd` value
(`5.142528`) in its `--confirm-max-cost-usd` usage example — replaced with the placeholder
`<EXACT_VALUE_FROM_PREFLIGHT>`; budget values remain exclusively plan-derived everywhere else in the
file (`canonicalDevelopmentMaxCostUsdString`, unchanged).

**Files changed in this remediation:**

```
M  scripts/run-resolver-v3-048-live-development.mjs
M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
M  ROADMAP.md
M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md (this section)
A  handoffs/archive/<archived prior handoff>
M  handoffs/latest-handoff.md
```

**Verification (this remediation):**

- Focused launcher tests (`node --test`): 99/105 pass pre-commit (6 failures are this launcher's own
  working-tree-clean gate, which by construction cannot pass until this remediation's own files are
  committed — the same honest, expected pattern as remediations 1 and 2); confirmed **105/105** once
  the tree was clean post-commit.
- `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 17/17 (14 prior + 1 new real
  end-to-end transition-atomic case (`Test 8`) + 2 new `buildProtocolV4SuccessUsageSnapshot` unit
  cases).
- Full `protocolV4` Jest suite: **PASS**, 223/223 (11 suites).
- Full `nutrition-benchmark` Jest suite: **PASS**, 968/968 (81 suites; 965 prior + 3 new).
- Full repo-wide `npx jest --runInBand`: **PASS**, 2777/2777 tests, 257/257 suites, 776.6s (2774
  prior + 3 new). Zero failures, zero new failures anywhere.
- `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (after removing the transient
  `build/resolver-v3-048-live-launcher/` directory, the same known pre-existing gap documented in
  remediations 1/2). `prettier -c`: **PASS** after one `-w` pass on 3 files, plus one more on the
  handoff. `git diff --check`: **PASS**.
- Final CodeGraph MCP recheck (`mcp__codegraph__codegraph_explore`) confirmed the on-disk
  `parseArgs`/`KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES`, `classifyLauncherError`/
  `KNOWN_SAFE_PROTOCOL_ERROR_CODES`, `markProtocolV4ExecutionLeaseExecuting`'s placement inside the
  Runner's `try`, and `buildProtocolV4SuccessUsageSnapshot`/`artifactRootKind` all match what was
  implemented.

Zero provider calls, zero tokens, USD 0.00 throughout.

## 13. Post-Merge Remediation 4 (2026-07-31): Non-Spoofable Identity, Attachment Safety, Tri-State Consumption, and Closed CLI Parsing

PR #205 (this Phase B3 launcher, three times pre-PR-remediated) merged as
`93caac4b9128ac7211e7a8c19c4ebd61c87e7af3` into `chore/clean-arch-structure`. An independent
post-merge review found five further reproducible defects (F1–F5), all fixed on this branch with
zero provider calls, zero tokens, USD 0.00 throughout. Holdout remains unauthorized, unexecuted, and
unreferenced. **CodeGraph MCP preflight** (`mcp__codegraph__codegraph_explore`, three queries, one
initial index bootstrap via the pinned `@colbymchenry/codegraph@1.5.0` `init` since no `.codegraph/`
index existed yet in this fresh session — verified afterwards that only the gitignored
`.codegraph/` directory was created and no tracked file changed) confirmed, before any change:
`summarizeFailureUsage`/`classifyLauncherError`/`parseArgs` and their callers/blast radius in
`scripts/run-resolver-v3-048-live-development.mjs`; `attachProtocolV4FailureUsageSnapshot`/
`attachProtocolV4LeaseFinalizationStatus`/`markProtocolV4ExecutionLeaseTerminalFailure` and their
call graph in `ResolverV3048ProtocolV4DevelopmentRunner.ts`/`ResolverV3048ProtocolV4ExecutionLease.ts`;
and `isProtocolV4LiveAuthorizationConsumedAtomically` in `ResolverV3048ProtocolV4ArtifactStore.ts`.

**F1 (exact-zero classification trusted a spoofable `error.name`).** `summarizeFailureUsage`
previously matched a pre-dispatch error solely by comparing `error.name` (a freely settable string
on any plain object) against `KNOWN_PRE_DISPATCH_ERROR_CLASSES`. Replaced with a real
`isKnownPreDispatchError(error, bridge)` helper: `error instanceof LauncherError` (this module's own
real, statically available class) plus `instanceof` against the real Protocol-v4 domain classes
now re-exported from the compiled bridge (`ProtocolV4LiveDevelopmentEntryPointError`,
`ProtocolV4LiveExecutionContextError`, `ProtocolV4DevelopmentAuthorizationError`,
`ProtocolV4ExecutionLeaseError`, `ProtocolV4ArtifactStoreError`, `ProtocolV4ArtifactCrashError` —
added to `scripts/resolver-v3-048-live-launcher/launcherBridge.ts`'s re-export surface). `bridge` is
optional (`undefined` in pure unit tests); an unrecognized error, spoofed or genuinely foreign,
always falls through to `'unknown'` usage, never a fabricated exact zero.

**F2 (metadata attachment could prevent lease finalization).** `attachProtocolV4FailureUsageSnapshot`
and `attachProtocolV4LeaseFinalizationStatus` wrote directly onto the caller's error object; a frozen
error, a non-extensible error, a non-writable existing property, or a throwing setter/Proxy trap
could make the FIRST attachment itself throw, before the Runner's lease `terminal_failure` `try` even
ran — replacing the original error, losing the usage snapshot, and leaving the lease stuck
`executing`. Both functions now wrap their property write in their own `try`/`catch` (best-effort,
silently swallowed) — the smallest change that fixes every caller, not only this one call site. The
Runner's shared failure handler is otherwise unchanged: normalize the original throwable → attempt
the (now always-safe) usage-snapshot attachment → always attempt lease `terminal_failure` → attempt
the (now always-safe) lease-finalization-status attachment → always rethrow the original normalized
error, never an attachment error.

**F3 (authorization-consumption readback collapsed to a boolean).** The launcher's
`authorizationConsumed` boolean reported `false` identically for "confirmed not consumed" and "the
on-disk marker could not be read" — a genuinely consumed-but-unreadable authorization could look
safe to retry. Replaced with an explicit tri-state `authorizationConsumption`
(`{ status: 'consumed' }` | `{ status: 'not_consumed' }` | `{ status: 'unreadable', errorCode }`),
built by a new exported pure function `summarizeAuthorizationConsumption`. `errorCode` is always the
result of `classifyLauncherError` — never the foreign readback error's own `.message`/`.name`/a path.
`success` in the summary is documented (inline comment at its construction site) as denoting ONLY
whether the Development dispatch itself completed without throwing — never a claim about
authorization-consumption readback; a maintainer must not read `success: true` alongside a
non-`'consumed'` status as license to retry.

**F4 (unknown `error.name` echoed verbatim as the output code).** `classifyLauncherError`'s final
fallback for a completely unrecognized error class returned `{ class: 'unknown', code: name }` —
`name` is a freely settable string that could carry a secret marker, an absolute path, embedded
newlines, or text crafted to look like a launcher success line. Replaced with a fixed, constant
fallback code, `LAUNCHER_UNCLASSIFIED_ERROR`, consistent with the same-shaped fallback already used
for `LauncherError`/Protocol-v4-class codes (`LAUNCHER_UNRECOGNIZED_CODE`/
`PROTOCOL_V4_UNRECOGNIZED_CODE`). `error.message` was already excluded before this remediation and
remains excluded.

**F5 (CLI arguments were not unambiguous or mode-bound).** `parseArgs` accepted duplicate value/
boolean flags (last-write-wins), execute-only flags under `--preflight`, preflight-only flags under
`--execute`, and would silently consume a known flag token as if it were a value-flag's value.
Rewritten to fail closed: every flag may appear at most once (`LAUNCHER_ARGUMENT_DUPLICATE`,
first-write-wins, the duplicate's own value is discarded and never read); a value flag's next token
must be a real, non-flag-shaped value, or it is reported as missing (`LAUNCHER_ARGUMENT_VALUE_MISSING`)
and the wrongly-assumed "value" token is re-parsed on the next iteration as its own flag; and
execute-only (`--authorization-file`, `--confirm-development-only`, `--confirm-max-cost-usd`) /
preflight-only (`--authorization-template-out`) flags are rejected under the other mode
(`LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_PREFLIGHT`/`LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_EXECUTE`). All four
new codes were added to `KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES`. As before, no raw argv token or value
is ever pushed into `result.errors`.

**Files changed in this remediation:**

```
M  scripts/run-resolver-v3-048-live-development.mjs
M  scripts/resolver-v3-048-live-launcher/launcherBridge.ts
M  scripts/__tests__/run-resolver-v3-048-live-development.test.mjs
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts
M  ROADMAP.md
M  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md (this section)
A  handoffs/archive/2026-07-31_RESOLVER-V3-048_phase-b3-pre-pr-remediation-3.md
M  handoffs/latest-handoff.md
```

**New regression tests:** F1 (5 tests: spoofed `error.name`, plain object shaped like a known class,
real `LauncherError` without a bridge, real `LauncherError` with an overwritten `.name`, an existing
snapshot remains authoritative); F2 (4 unit tests on the attach functions — frozen/non-extensible/
non-writable-property/throwing-setter — plus 4 real end-to-end Runner tests confirming
`terminal_failure` is still confirmed and the ORIGINAL error is rethrown unchanged in all four
cases); F3 (5 unit tests for `summarizeAuthorizationConsumption` plus 1 real integration test
proving a genuine dispatch failure reports `not_consumed`, and the existing full-success-path test
updated to assert `{ status: 'consumed' }`); F4 (2 existing tests corrected to the new fixed fallback
code plus 5 new tests for secret-marker/absolute-path/embedded-newline/fake-success-line/message
marker variants); F5 (9 new tests: three duplicate-value-flag cases, one duplicate-boolean-flag
case, one execute-only-flag-under-preflight case, one preflight-only-flag-under-execute case, one
flag-token-as-value case, one secret-marker-in-a-duplicate-value case, two valid-arguments-still-pass
sanity cases).

**Verification (this remediation):**

- `node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs`: pre-commit, expected
  working-tree-clean-gate failures only (the launcher's own fail-closed gate, which by construction
  cannot pass until this remediation's own files are committed — the same pattern documented in every
  prior remediation); confirmed fully green post-commit (see final numbers below).
- `ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`: **PASS**, 26/26 (18 prior + 8 new: 4 unit +
  4 real end-to-end F2 cases).
- Full `protocolV4` Jest suite: **PASS**, 232/232 (11 suites).
- Full `nutrition-benchmark` Jest suite: **PASS**, 977/977 (81 suites; 965 prior + 12 new).
- `tsc --noEmit`: **PASS**, 0 errors. `eslint .`: **PASS**, 0 errors (after removing the transient
  gitignored `build/resolver-v3-048-live-launcher/` directory, the same known pre-existing gap
  documented in every prior remediation). `prettier -c` on every file this remediation touched:
  **PASS** after one `-w` pass on the 3 files with issues. `git diff --check`: **PASS**.
- Full repo-wide `npm run test` (Jest): see final numbers below.
- `npm run verify`'s `format:check` step additionally reports one pre-existing, out-of-scope warning
  unrelated to this remediation: `.claude/settings.local.json`, a harness-generated, globally
  gitignored, untracked local Claude Code permissions file (confirmed via
  `git ls-files --others --ignored --exclude-standard` and `git check-ignore -v`, resolving to
  `/root/.config/git/ignore`, not this repository's own `.gitignore`), auto-created at this session's
  start and never part of this repository's tracked content or this task's allowed scope. It is not
  touched by, and predates, this remediation.
- Final CodeGraph MCP recheck (`mcp__codegraph__codegraph_explore`, three queries covering
  `summarizeFailureUsage`/`classifyLauncherError`/`parseArgs` and
  `attachProtocolV4FailureUsageSnapshot`/`attachProtocolV4LeaseFinalizationStatus`/
  `markProtocolV4ExecutionLeaseTerminalFailure`) confirmed the on-disk implementation matches what
  was implemented, with no unintended call-graph changes.

Zero provider calls, zero tokens, USD 0.00 throughout.
