# RESOLVER-V3-048 — Phase B1 Post-Merge Remediation: Durable Live Evidence Finalization

## 1. Basis, authority, and scope

Basis: `2dc5e3e` (PR #203 merge, "Phase B1 — Protocol-v4 live Development dispatch wiring"), the
verified tip of `origin/chore/clean-arch-structure` at task start. PR #203 remains merged and is not
reverted. Branch: `claude/resolver-v3-048-phase-b1-post-merge-remediation`.

This task fixes five reproducible defects an independent post-merge review of PR #203 found in the
Protocol-v4 live Development path. It made **0 provider calls**, incurred **USD 0**, read no real
credential, produced no live evidence, and did not touch any file under
`logs/resolver-v3-048-protocol-v4` or any of the seven frozen `logs/resolver-v3-039-*` evidence files.

## 2. CodeGraph MCP preflight (AGENTS.md "CodeGraph Availability")

- Tool: `mcp__codegraph__codegraph_explore` (the only tool this server exposes).
- No `.codegraph/` index existed at task start in this fresh session/container (the index is local,
  not committed). Remediation performed exactly once, per the binding rule: `npx -y
@colbymchenry/codegraph@1.5.0 init` (indexed 800 files, 7,621 nodes, 29,737 edges), then re-verified
  successfully through the real MCP tool itself (not the CLI) on the next call.
- **Preflight query 1** (`runProtocolV4LiveDevelopmentEntryPoint runProtocolV4DevelopmentForAllCandidates
ArtifactStore DevelopmentAuthorization ExecutionLease`): confirmed the call path
  `runProtocolV4LiveDevelopmentEntryPoint` → `runProtocolV4DevelopmentForAllCandidates` →
  `assertProtocolV4ExecutionLeaseActiveForDispatch` → `readProtocolV4ExecutionLease`; returned verbatim
  source for `ResolverV3048ProtocolV4ExecutionLease.ts` (`leaseDirFor`/`readProtocolV4ExecutionLease`/
  `claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`), `ResolverV3048ProtocolV4DevelopmentAuthorization.ts`
  (`ProtocolV4DevelopmentAuthorizationRecord`, `buildProtocolV4DevelopmentAuthorization`),
  `ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts` (the full entry point, confirming its 6-step
  order and the hard-coded 3-item checkpoint-only preflight — defect 3), and
  `ResolverV3048ProtocolV4DevelopmentRunner.ts` (`runProtocolV4DevelopmentForAllCandidates`, confirming
  `markProtocolV4ExecutionLeaseTerminalSuccess` was called immediately after the per-candidate loop,
  BEFORE `planManifest`/`candidateEvaluationTable` were even sealed — defect 2).
- **Preflight query 2** (`runProtocolV4DevelopmentForCandidate sealProtocolV4Artifact
writeProtocolV4LiveArtifactExclusive readProtocolV4LiveArtifact ARTIFACT_PATHS artifactContract`):
  confirmed `runProtocolV4DevelopmentForCandidate` built `checkpoint`/`rawResultsArtifact`/
  `categoryTable`/`telemetryArtifact`/`ledgerArtifact`/`evaluationArtifact` purely via
  `sealProtocolV4Artifact` (in-memory hash only, no disk write at all) and returned them directly —
  defect 1, confirmed by direct source read (`sealProtocolV4Artifact` itself only computes a
  `contentHash`, never touches `fs`). Also returned `ARTIFACT_PATHS` (confirming the full canonical
  per-candidate + shared target list) and `plan.artifactContract: typeof ARTIFACT_PATHS` (confirming a
  generic, contract-driven target list was derivable without hand-picking).
- **Recheck query** (`readWithReadback resolveArtifactPath assertRootMatchesStore
consumeAuthorizationAtomically isAuthorizationConsumedAtomically`): confirmed `readWithReadback`
  (`ResolverV3048ProtocolV4ArtifactStore.ts`) took only `(absolutePath, expectedContentHash)` with no
  root check at all — defect 4 — while `writeExclusive`/`consumeAuthorizationAtomically` both routed
  through `resolveArtifactPath`/`assertRootMatchesStore` first; and confirmed
  `consumeAuthorizationAtomically`/`isAuthorizationConsumedAtomically` built their marker filename from
  the raw `authorizationId` directly (`` `authorization-${authorizationId}.consumed.json` ``), and
  `ResolverV3048ProtocolV4ExecutionLease.ts`'s `leaseDirFor` joined the raw `authorizationId` directly
  as a directory segment — defect 5, matching the Phase B1 report's own documented 8 pre-existing
  Windows-local failures (`` `mini-run-development:${planHash}` `` etc.).
- Post-implementation: re-ran the full Protocol-v4/nutrition-benchmark/repo-wide Jest suites (§6) as
  the structural confirmation that the blast radius identified above was fully addressed with zero
  regressions.

## 3. Defects fixed

1. **In-memory-only Development evidence.** `runProtocolV4DevelopmentForCandidate`/
   `runProtocolV4DevelopmentForAllCandidates` sealed every artifact (checkpoint, raw results, category
   table, telemetry, ledger, evaluation, plan manifest, candidate evaluation table) purely in memory via
   `sealProtocolV4Artifact` and returned them — nothing was ever written to the live-bound Artifact
   Store.
2. **Lease could reach `terminal_success` before durable persistence and hash readback.**
   `markProtocolV4ExecutionLeaseTerminalSuccess` was called immediately after the per-candidate dispatch
   loop, before `planManifest`/`candidateEvaluationTable` were even sealed, let alone written or read
   back.
3. **Storage preflight checked only 3 of the canonical Development targets.** The live entry point's
   pre-lease-claim preflight looped over `ARTIFACT_PATHS.developmentCheckpointH0/H1/H2` only — never the
   per-candidate raw-results/category-table/telemetry/ledger/evaluation targets, nor the shared
   plan-manifest/candidate-evaluation-table targets.
4. **Cross-root readback was not rejected.** `readWithReadback(absolutePath, expectedContentHash)`
   accepted any absolute path, validating only the content hash — a live-bound readback could read a
   file under the dry-run root (or any other directory) without error, as long as its content happened
   to hash-match.
5. **Authorization IDs used directly as filesystem path components.** The Execution Lease's
   `leaseDirFor` joined the raw `authorizationId` as a directory segment, and the Artifact Store's
   `consumeAuthorizationAtomically`/`isAuthorizationConsumedAtomically` embedded it directly in the
   marker filename. Windows forbids `:` in both file and directory names; pre-existing authorization IDs
   in this codebase already contain one (e.g. `` `mini-run-development:${planHash}` ``,
   `` `dry-run-development:${planHash}` ``), which is exactly what caused the 8 pre-existing
   Windows-local test failures the Phase B1 report documented and left unfixed as out of scope for that
   task.

## 4. Design implemented

### 4.1 Platform-neutral authorization storage keys (`ResolverV3048ProtocolV4StorageKey.ts`, new)

A single exported function, `deriveProtocolV4AuthorizationStorageKey(authorizationId)`, returns a full
base64url (RFC 4648 §5) re-encoding of the UTF-8 bytes of `authorizationId`. This is deliberately **not**
a character-substitution scheme (e.g. replacing `:` with `_`), which is not collision-resistant
(`"a:b"` and `"a_b"` would otherwise collide) — base64url is a lossless, injective encoding: distinct
inputs always produce distinct outputs, and its alphabet (`A-Z`, `a-z`, `0-9`, `-`, `_`) is a valid
path-component character set on Windows, Linux, and macOS alike.

`authorizationId` itself is completely unchanged everywhere else — records, hashes, and every
lease/authorization equality check keep using the real ID. Only the four places an authorization ID
becomes a filesystem path component now derive this key first, all from the one function:

- **Lease directories/versions** — `ResolverV3048ProtocolV4ExecutionLease.ts`'s `leaseDirFor` (used by
  every read/write/claim/transition function in that module).
- **Crash detection** — `detectProtocolV4ExecutionLeaseCrash`/`listLeaseVersions`/`listLeaseTmpVersions`
  all route through `leaseDirFor`, so they inherit the fix automatically.
- **Authorization consumption marker** — `ResolverV3048ProtocolV4ArtifactStore.ts`'s
  `consumeAuthorizationAtomically`/`isAuthorizationConsumedAtomically` (both the dry-run and live
  instantiations, via the shared `createProtocolV4RootBoundStore` factory).
- **Recovery** — `recoverProtocolV4ExecutionLeaseCrash` also routes through `leaseDirFor`.

`assertSafeIdComponent`/`assertAuthorizationIdIsSafeFilenameComponent` (both pre-existing) still reject
path separators and `..` on the **original** id first, independently of the new key — separators and
traversal remain forbidden even though `:`, spaces, and Unicode text are now safe to use end to end.

### 4.2 Durable `human_live` Development evidence (`ResolverV3048ProtocolV4DevelopmentRunner.ts`)

`runProtocolV4DevelopmentForCandidate` gained a `human_live`-only branch, added strictly after the
existing (unchanged) in-memory sealing logic: raw results, category table, telemetry, and ledger are
each written exclusively and read back (via a small `writeAndReadBackLiveArtifact` helper) to the
live-bound store, then evaluation, and finally the checkpoint — written and read back **last**, as the
commit marker for that candidate, exactly matching the mandated success ordering (step 8 before step 9).
Target paths come from a new `DEVELOPMENT_ARTIFACT_PATHS_BY_CANDIDATE` map (mirroring the pre-existing
`DEVELOPMENT_CHECKPOINT_PATH_BY_CANDIDATE`).

`runProtocolV4DevelopmentForAllCandidates` gained a parallel `human_live`-only branch, executed inside
the existing `try` block (so any failure in it is caught by the existing `catch` → `terminal_failure`
path, never leaving the lease stuck): plan manifest and candidate evaluation table are sealed, written,
and read back (steps 10); the Development Evidence Root is derived by calling the pre-existing,
already-shared `computeDevelopmentEvidenceRootHash(evidence)` — reused unmodified, since its own
contract ("hash of every artifact's own `contentHash`") is already exactly correct, and it now runs
**after** every one of those `contentHash` values has been confirmed by a real write-then-read-back
round trip, never before (step 11); the authorization is atomically consumed via
`consumeProtocolV4LiveAuthorizationAtomically` (step 12, previously never called from production code at
all); and only then does the lease reach `terminal_success` (step 13).

The `fake_dry_run` branch — reached whenever `executionContext.mode !== 'human_live'` — is textually
**identical** to the pre-existing code, still outside the `if`, so the Dry-Run/Mini-Run's own behavior
is byte-for-byte unchanged (confirmed by the unmodified passing test suite, §6). `ProtocolV4DevelopmentEvidence`
gained one new optional field, `developmentEvidenceRootHash?: string`, populated only on the
`human_live` path.

### 4.3 Full canonical artifact-contract storage preflight (`ResolverV3048ProtocolV4.ts` +

`ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts`)

A new exported function, `protocolV4DevelopmentArtifactContractRelativePaths(plan)`, derives every
Development-phase artifact target **generically** from `plan.artifactContract` (never a hand-picked
subset): every key starting with `development` (all three candidates' checkpoint/raw-results/
category-table/telemetry/ledger/evaluation paths) plus the two shared targets, `planManifest` and
`candidateEvaluationTable`. `deliberately excludes `holdout\*`/`finalG2DecisionReport`(a different
phase) and`plan`/`sourceManifest`/`candidateManifest`/`pricingManifest` (Master Plan **input**
identities, not Development **output** artifacts).

The live entry point's storage preflight (step 4) now loops over this full list instead of the 3-item
checkpoint-only constant, checking `isProtocolV4LiveArtifactTargetUnused` for every one of them —
`isProtocolV4LiveArtifactTargetUnused` itself already throws on crash evidence (a leftover `*.tmp-*`
sibling), so this loop checks both "already used" and "crash evidence" for every canonical target
before a lease is ever claimed.

### 4.4 Root-bound readback (`ResolverV3048ProtocolV4ArtifactStore.ts`)

`readWithReadback` now calls `assertRootMatchesStore(absolutePath, repoRoot)` — the exact same validator
`writeExclusive` already uses — before ever reading the file. `readProtocolV4ArtifactWithReadback`/
`readProtocolV4LiveArtifactWithReadback` both gained an optional trailing `repoRoot` parameter to
support this under an isolated test root; omitting it defaults to `process.cwd()`, identical to every
pre-existing call site's implicit behavior, so no existing caller needed to change.

## 5. Files changed

```
M  ROADMAP.md
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ArtifactStore.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4ExecutionLease.ts
M  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts
M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts
M  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.test.ts
A  src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4StorageKey.ts
A  src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts
A  reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B1_POST_MERGE_REMEDIATION.md
A  handoffs/archive/2026-07-30_RESOLVER-V3-048_phase-b1-live-development-wiring.md
M  handoffs/latest-handoff.md
```

The two existing test files changed only their lease-directory assertions (they previously constructed
`path.join(root, 'leases', authorization.authorizationId)` directly against the module's internal
layout; they now derive the same path via `deriveProtocolV4AuthorizationStorageKey`, matching the fixed
internal layout) — no other assertion or expected behavior changed in either file.

## 6. Tests and verification (VERIFY.md Category 4, product/runtime code)

```
npx tsc --noEmit -p tsconfig.json                                              # PASS, 0 errors (repo-wide)
npx eslint .                                                                    # PASS, 0 errors/warnings (repo-wide)
npx prettier -c <all changed/added files>                                      # PASS
npx jest --runInBand src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts
                                                                                 # PASS, 16/16 (new)
npx jest --runInBand src/features/nutrition/benchmark/protocolV4               # PASS, 206/206 (10 suites)
npx jest --runInBand src/features/nutrition/benchmark                          # PASS, 951/951 (80 suites)
npx jest --runInBand                                                           # PASS, 2760/2760 (256 suites), 996.5s
git --no-pager diff --check                                                    # PASS, no whitespace conflicts
git --no-pager status --short / diff --stat                                    # readback
```

New coverage (16 tests in `ResolverV3048ProtocolV4LiveDevelopmentDurableEvidenceRemediation.test.ts`)
proves, all zero-network (`global.fetch` mocked) and USD 0.00:

- A full end-to-end `runProtocolV4LiveDevelopmentEntryPoint` call with a real `human_live`
  authorization, a fake test credential, real plan/evaluator identity (the two real evaluator files
  copied into an isolated temp `repoRoot` so `buildProtocolV4MasterPlan`/`validateProtocolV4MasterPlan`/
  `deriveProtocolV4CandidateEvaluation` derive the genuine, real evaluator hash rather than a stand-in),
  isolated temporary live storage, and all three candidates dispatched (no Holdout call): every
  canonical Development artifact target exists on disk; a representative artifact of every kind (plus
  both shared artifacts) is independently root-bound-readback-verified; `developmentEvidenceRootHash`
  is present and equals `computeDevelopmentEvidenceRootHash(evidence)`; the authorization consumption
  marker exists; the lease reached `terminal_success`; no file exists under the **real** repository's
  `logs/resolver-v3-048-protocol-v4`; and the mocked fetch was actually invoked (proving the AI path was
  genuinely exercised, not merely the fast path).
- A write failure (a pre-occupied target) during dispatch leaves the lease `terminal_failure`, never
  stuck `claimed`/`executing` nor `terminal_success`, and the authorization is never marked consumed.
- A readback failure (on-disk content tampered after a successful write) is rejected with
  `PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH`.
- Five distinct canonical targets that are **not** checkpoints (two per-candidate telemetry/ledger/
  evaluation targets and both shared targets) are each independently confirmed detected as
  already-used, before any lease file is written — proving the preflight is not limited to the 3
  checkpoint paths.
- Cross-root readback is rejected in both directions (a live-bound artifact read through the dry-run
  function, and vice versa) and for a third, wholly unrelated absolute path.
- Authorization IDs containing `:`, spaces, and Unicode text work end to end (lease claim, transitions,
  readback, and the atomic consumption marker); the derived storage key is proven to match the
  Windows/Linux/macOS-safe alphabet `^[A-Za-z0-9_-]+$`.
- Two known collision-risk ID pairs (`"a:b"`/`"a_b"`, and the equivalent for a real
  `mini-run-development:` prefix) are proven to derive **different** storage keys, demonstrating
  injectivity.
- The exact three pre-existing colon-containing authorization ID shapes that caused the 8 Windows-local
  failures (`mini-run-development:`, `dry-run-development:`, `mini-run-holdout:`) are proven to derive a
  storage key containing no `:` and matching the safe alphabet.
- Path separators (`/`, `\`) and `..` in an authorization ID are still rejected
  (`PROTOCOL_V4_EXECUTION_LEASE_UNSAFE_ID`), proving the new key never silently encodes away a
  structurally dangerous id instead of rejecting it.
- A direct `runProtocolV4DevelopmentForCandidate` call for a single candidate under `human_live`
  confirms all six of that candidate's artifacts are durably written.

## 7. Pre-existing Windows-local test failures — addressed, not merely worked around

The Phase B1 report documented 8 pre-existing, Windows-local test failures across
`ResolverV3048ProtocolV4DryRun.test.ts` and the three `Final*RedBaseline` suites, caused by a
colon-containing authorization ID (e.g. `` `mini-run-development:${planHash}` ``, committed and
unmodified by this task) becoming an invalid Windows directory name when the Execution Lease module
derived a lease directory from it directly. This task's storage-key fix (§4.1) applies uniformly to
every authorization ID the lease/artifact-store modules ever see, including these pre-existing ones —
they were not special-cased. On this Linux development environment these 8 tests were passing already
(as the Phase B1 report itself noted); after this remediation they still pass (§6: 951/951 in the full
nutrition-benchmark suite, same suites), and the new "Windows-safe storage key" test in §6 gives a
structural, environment-independent proof (regex-matching the derived key against the safe alphabet)
rather than relying solely on "expected not to reproduce on Windows CI". Green GitHub Verify on this
branch remains the authoritative real-Windows-adjacent-CI confirmation, per this repository's
established convention.

## 8. Evidence integrity confirmed unchanged

The seven `logs/resolver-v3-039-*` evidence files, the V3-039 closeout report, and the V3-039 evidence
manifest were not referenced by any file this task touched. `logs/resolver-v3-048-protocol-v4/` was not
created under the real repository root (every test that exercises live storage/lease code uses an
isolated temporary `repoRoot`, and the new end-to-end test explicitly asserts non-existence under the
real path after a successful run). No `.env` was read or modified. No real `ANTHROPIC_API_KEY` was used
anywhere — every test pairs a literal placeholder string with a mocked `global.fetch`. No Holdout
function or module was touched, referenced, or exercised. **Real provider calls: 0. Real provider cost:
USD 0.00.**

## 9. Status

- Defects 1–5 from the post-merge review are fixed, with regression coverage proving each one.
- The mandated 13-step `human_live` success ordering is now structurally enforced inside
  `runProtocolV4DevelopmentForAllCandidates`/`runProtocolV4DevelopmentForCandidate`.
- `fake_dry_run` (the existing Dry-Run/Mini-Run path) is untouched and byte-for-byte unchanged —
  confirmed by the full, unmodified pre-existing Protocol-v4/nutrition-benchmark suites passing.
- No live provider call was made. Actual cost of this task: **USD 0.00**.
- No live evidence was produced. Holdout remains unexecuted and unauthorized.
- **G2 remains `not passed`.**
- **`RESOLVER-V3-010` remains `blocked`.**
- A **new, explicit human authorization**, re-verified against this commit, is still required before any
  live Development call — unchanged by this remediation. The PR #202 authorization remains not reused
  (per its own preflight report), and this task issues no new one either.
