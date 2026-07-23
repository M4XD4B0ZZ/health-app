# RESOLVER-V3-039 — Phase-B Continuation Remediation

Task ID: RESOLVER-V3-039 (remediation of the merged Phase-A implementation, PR #136, merge commit
`f8c5e678ff3d555829a5548ae57ffcb30d0a2c7e`)
Status: remediation complete; **RESOLVER-V3-039 remains `in_progress`** (no live evidence has been
collected yet — see "Final status" below).

## 1. How the defect was discovered

Before authorizing any paid provider request, this task re-read the merged Phase-A implementation
end to end (`reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md`, its JSON twin, the evidence
report, the CLI, the harness, and every file under
`src/features/nutrition/benchmark/representativeHybridV1/live/**`) and traced exactly what the
documented two-phase Development → inspect → Holdout workflow would do, line by line, rather than
assuming the documented commands were executable as written. That trace found that the documented
Holdout command could not run after Development without an undocumented flag, and that both
available flags were themselves unsafe. This was found and fixed **before any real provider
request was made** under the merged protocol.

## 2. Exact v1 failure mechanics

All line references are to `runRepresentativeHybridV1Live.harness.ts` as merged in PR #136 (commit
`da3bae6939bd5514e7a7521597ae670940e45ea6` and unchanged through `f8c5e678f`), before this
remediation replaced it — preserved in Git history.

### Defect 1 — the documented Holdout command is refused

Development writes its report to a fixed path:

```
logs/resolver-v3-039-controlled-representative-live-evidence.json
```

The harness's very first gate in execute mode is:

```ts
if (
  fs.existsSync(jsonReportPath) &&
  process.env.REPRESENTATIVE_HYBRID_V1_LIVE_ALLOW_RERUN !== 'true'
) {
  throw new Error(`...a report already exists at ${jsonReportPath}...`);
}
```

The evidence report's own "What Happens Next" section documented running Holdout with **no**
`--allow-rerun` flag, immediately after Development. That exact documented command hits this guard
and refuses to run. **The documented workflow could not execute as written.**

### Defect 2 — `--allow-rerun` destroys the combined evidence set

`--allow-rerun` bypasses only the guard above — nothing else. The report is then rebuilt from
scratch, in one process, from whatever partition that single invocation ran:

```ts
developmentCaseRecords: partitions.includes('development') ? caseRecords : null,
holdoutCaseRecords: partitions.includes('holdout') ? caseRecords : null,
```

A `--partition=holdout --allow-rerun` run has `partitions === ['holdout']`, so
`developmentCaseRecords` is unconditionally `null`. Nothing in the harness, runner, or report
builder ever reads a prior report back from disk and merges it — the JSON file that gets
overwritten is the _only_ copy of Development's evidence, and it is gone the instant Holdout writes
its own report over it. This is not a hypothetical: `RepresentativeHybridV1LiveProtocolV1DefectReproduction.test.ts`
tests 2–4 reproduce this exact mechanism (the guard predicate and the field assignment, quoted
verbatim from the pre-remediation source) against the still-unchanged `buildRepresentativeHybridV1LiveReport`
function.

### Defect 3 — `--partition=all` is not an acceptable workaround

`--partition=all` runs both partitions inside one process, one uninterrupted loop, with no
intermediate write and no pause for inspection — there is no code-enforced boundary between
Development and Holdout at all, only the CLI's naming convention. Running it once skips the
task's required "inspect Development, unchanged, before Holdout runs" discipline entirely. Running
it a second time, after a separate `--partition=development` invocation had already made real paid
calls, would repeat every Development call (a second full billing of the same 108+97=205
development-partition calls), a direct violation of "no automatic/manual paid rerun" and the frozen
call plan.

### Defect 4 — budget enforcement is process-local

`createRepresentativeHybridV1LiveBudgetGate()` constructs a fresh, in-memory
`LiveProviderBudgetGate` from the full frozen plan (`maxCalls: 263`, `maxCost: 4.174336`) on **every
call**, and that gate's state (`calls`/`inputTokens`/`outputTokens`/`reservedCost`) lives only in
that one process's memory (`LiveProviderBudgetGate.ts`'s private instance fields; nothing is ever
serialized). Each CLI invocation is a separate `spawnSync('npx', ['jest', ...])` process. A
Development run and a later Holdout run therefore each get their **own full 263-call/$4.174336
allowance**, not one shared, cumulative ceiling — the exact defect the task's "one aggregate USD
5.00 ceiling across every B and C call" requirement forbids.

### Defect 5 — paid-call evidence is not durable during execution

The only two `fs.writeFileSync` calls in the entire execute path happen after the whole partition's
loop finishes (`runRepresentativeHybridV1LivePartition`'s per-scenario/per-observation loop has zero
file writes). Provider telemetry (`rawTelemetry`) and evaluated case records
(`caseRecords`) exist only as in-memory arrays until that point. A process kill, container
interruption, or crash after real, billed provider calls have already happened — but before the
loop finishes — loses every completed-call identity, token usage, HTTP outcome, cost figure, case
result, and consumed budget reservation for that run. A retry afterward has no record of what was
already billed and could repeat it.

## 3. Why the documented commands were unsafe

Given Defects 1–5 together: the only ways to reach a "combined evidence report" under the merged
protocol were (a) an undocumented flag that destroys the other partition's evidence, (b) a mode
that either skips the inspection boundary or repeats billed calls, or (c) accepting that a crash
mid-run could silently lose billed-call state with no way to tell "never attempted" apart from
"billed but lost." None of these satisfy the task's binding rules (no automatic/manual paid rerun,
exact call accounting, partial-evidence preservation, cumulative budget enforcement). Making a real
request under this implementation risked violating all four.

## 4. Confirmation of zero calls and zero cost

Verified directly from the still-committed, unmodified v1 artifacts (also asserted by
`RepresentativeHybridV1LiveProtocolV1DefectReproduction.test.ts`'s test 5):

- `reports/resolver-v3-039-controlled-representative-live-evidence.json`: `actualUsage.calls: 0`,
  `actualUsage.estimatedCostUsd: null`, `rawTelemetry: []`, `development: null`, `holdout: null`,
  every `gateVerdicts.*` is `"not_evaluable"`.
- `ROADMAP.md`'s RESOLVER-V3-039 entry: "Phase B result: blocked — `ANTHROPIC_API_KEY` is not set in
  this execution environment... Zero of the 263 planned calls were made; zero cost incurred."

**Zero of the 263 planned calls occurred. Zero USD was spent. No quality evidence exists to be
invalidated, because none was ever collected.** This remediation itself made no provider request
either — no `ANTHROPIC_API_KEY` was read or set at any point in this branch's work (verified by
`grep -r ANTHROPIC_API_KEY` returning only pre-existing, unmodified call sites, and by every new
test using fake transports exclusively).

## 5. Protocol-v1 disposition

Protocol v1 (`reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md`,
`reports/resolver-v3-039-controlled-live-protocol.json`) and its evidence documents
(`reports/RESOLVER_V3_039_CONTROLLED_REPRESENTATIVE_LIVE_EVIDENCE.md`,
`reports/resolver-v3-039-controlled-representative-live-evidence.json`) are **preserved unedited**,
as invalidated pre-execution history:

- protocol v1 was frozen at commit `da3bae6939bd5514e7a7521597ae670940e45ea6`;
- no paid request occurred under it;
- a pre-execution continuation defect was found (this document, §2);
- protocol v1 is invalidated/superseded **for live execution** — `--protocol=` must point at a
  `protocolVersion: "resolver-representative-hybrid-live-protocol-v2"` document, and the v2 harness
  explicitly refuses any other protocol version before any request;
- no quality evidence was invalidated, because none existed.

Git history for the v1 harness/CLI (as merged in PR #136) is unaltered — this remediation replaced
`runRepresentativeHybridV1Live.harness.ts` and
`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs` **in place** on this new branch, not
by deleting and recreating them, so `git log`/`git blame` on those paths shows the full, real
history including the v1 implementation.

## 6. Corrected architecture (protocol v2)

### 6.1 Versions (new, alongside the unmodified v1 constants)

| Identifier                        | Value                                                           |
| --------------------------------- | --------------------------------------------------------------- |
| Protocol version                  | `resolver-representative-hybrid-live-protocol-v2`               |
| Checkpoint schema version         | `resolver-representative-hybrid-live-development-checkpoint-v1` |
| Holdout checkpoint schema version | `resolver-representative-hybrid-live-holdout-checkpoint-v1`     |
| Call-ledger schema version        | `resolver-representative-hybrid-live-call-ledger-v1`            |
| Report schema version             | `resolver-representative-hybrid-live-evidence-report-v2`        |
| Harness version                   | `2.0.0`                                                         |

`corpusVersion`/`registryVersion`/`sourceManifestVersion`/`corpusHash`/`sourceManifestHash`/
`planHash` are all **unchanged** from v1 (no corpus, route-classification, or execution-plan
change was made): `planHash = 214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e`.

**New in v2**: `executionTreeHash` (§6.2), computed at the protocol-v2-freeze commit:
`9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e`.

### 6.2 Drift checking — execution-tree hash

`RepresentativeHybridV1LiveExecutionTreeHash.ts` hashes the sorted (path, content) pairs of every
execution-relevant file the existing corpus/source-manifest/plan hashes do **not** already cover:
prompts, schemas, the live provider/pricing/transport code, and the harness/report-builder/metrics
logic itself (`REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS`, 20 files). It is a content
hash, not a literal git-SHA-equality check against the freeze commit, so adding generated
logs/reports after freeze can never falsely trigger drift — the tracked path list contains no
`logs/` or `reports/` path. Any change to a tracked file changes the hash and refuses continuation
before any Holdout call.

### 6.3 Durable Development checkpoint

`RepresentativeHybridV1LiveCheckpoint.ts` — `RepresentativeHybridV1LiveDevelopmentCheckpoint`
contains: `checkpointVersion`, `protocolVersion`/`protocolHash`, `executionPlanVersion`/`planHash`,
`corpusHash`/`sourceManifestHash`/`executionTreeHash`, `protocolFreezeCommit`/`executionCommit`,
`providerId`/`modelId`/`modelSnapshotId`/`pricing`, `plannedDevelopmentCallIds`/`completedCallIds`/
`terminalFailureCallIds`/`indeterminateCallIds`, `rawTelemetry`, `developmentCaseRecords`,
`cumulativeBudget`, `generatedAtUtc`, `phase: 'development_complete'`, `checkpointContentHash`.

Writes are atomic: `writeRepresentativeHybridV1LiveDevelopmentCheckpoint` writes a temp file in the
same directory, `fsync`s it, closes it, then `fs.renameSync`s it into place — the final path never
exists with partial content (POSIX `rename()` is atomic within one filesystem). Reads
(`readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint`) reject: a missing file, a
truncated/corrupt file, a tampered file (recomputed content hash mismatch), an unknown
`checkpointVersion`, any protocol/plan/corpus/source/execution-tree/provider/model/pricing
mismatch against the caller's current context, a non-`development_complete` phase, an unknown
top-level field, and any planned call ID not accounted for as completed/terminal-failure/
indeterminate. A mirrored, simpler `RepresentativeHybridV1LiveHoldoutCheckpoint` records Holdout's
own completion the same way, so a second Holdout attempt is detectable and refused.

### 6.4 Durable append-only call ledger

`RepresentativeHybridV1LiveCallLedger.ts` — one JSONL file
(`logs/resolver-v3-039-call-ledger.jsonl`), shared across both phases and every process
invocation. Each line is `{ledgerVersion, seq, callId, state, atUtc, details, prevEntryHash,
entryHash}`. `entryHash` covers every other field; `prevEntryHash` chains to the previous line —
a removed, reordered, or hand-edited line breaks the chain and fails closed on the next `open()`. A
torn final line (a genuine partial write mid-append) is dropped safely, distinguished from real
tampering by position (only the last line can ever be torn, since each append is one `fsync`'d
`write()` of a complete line).

Call IDs are deterministic (`RepresentativeHybridV1LiveCallId.ts`): a SHA-256 over
`[planHash, partition, variant, scenarioId, kind, runIndex, expectedRoute]` — stable across
processes, invalidated by any plan change. States: `planned → reserved → dispatched → {completed |
terminal_failure}`, plus `indeterminate_after_interruption` (only reachable via the automatic
load-time recovery path, never via the public `record()` API). Rules enforced by `record()`:
reservation persists before dispatch; dispatch persists before the underlying provider is invoked
(`RepresentativeHybridV1LiveLedgerProviders.ts`'s decorators write both, in order, before calling
the wrapped provider); a `completed`/`terminal_failure`/`indeterminate_after_interruption` call can
never transition again (`record()` throws `RepresentativeHybridV1LiveCallLedgerError`); a duplicate
reservation of an already-reserved call throws; a call whose latest state is `reserved` or
`dispatched` when the ledger is reopened is automatically, durably recorded as
`indeterminate_after_interruption` — itself an auditable ledger entry, never a silent inference.

### 6.5 Indeterminate call resolution (explicit human procedure)

An indeterminate call retains its full reservation permanently and is **never** rerun
automatically — both Development and Holdout refuse to proceed at all while any ledger entry is
indeterminate. The only way out is
`RepresentativeHybridV1LiveCallLedger.resolveIndeterminateCallAsTerminalFailure(callId,
humanNote)`, which requires a non-empty human-authored note and is not called anywhere in the
harness or CLI — it is invoked deliberately, out of band, by a human who has independently confirmed
the call's true fate (e.g. via the Anthropic Console's usage/billing view for the timestamp in
question) and records that confirmation in `humanNote`. This keeps the reservation consumed either
way (never refunded) and appends one auditable ledger entry.

### 6.6 Cumulative budget reconstruction

`RepresentativeHybridV1LiveCumulativeBudget.ts` reconstructs a `LiveProviderBudgetGate` — the
_same_, unmodified `LiveProviderBudgetGate.reserve()`/`.release()` class from
`LiveProviderBudgetGate.ts` — by replaying every call ID the ledger has ever reserved
(`ledger.consumedCallIdsInReservationOrder()`), in order, through `reserve()` immediately followed
by `release()`. Because `reserve()` never refunds `calls`/`inputTokens`/`outputTokens`/
`reservedCost` on release (documented, unchanged behavior), replaying N prior reservations leaves
the gate in exactly the state N real reservations would — `inFlight` back at 0, ready for the next
real call, with the _same_ frozen `limits` (`maxCalls: 263`, `maxCost: 4.174336`, `maxInFlight: 1`)
still enforced. No parallel accounting logic exists that could drift from the real gate. Throws if
the ledger references a call ID outside the current frozen plan (a stale ledger from a different
plan can never silently reconstruct a budget for a new one).

### 6.7 Two-phase behavior

**Development**: verifies protocol version/hash/plan/corpus/source-manifest/execution-tree/
provider/model/pricing; requires the credential; refuses if a Development checkpoint already
exists, if the ledger already has any entry for a Development-partition call, or if any ledger
entry anywhere is indeterminate. Executes only Development call IDs (Variant B for every
observation, Variant C only where the deterministic route is `ai_routed` — fast-path C observations
never dispatch to the live interpreter at all, so they are correctly excluded from planned-call
accounting); durably records each call before/after dispatch; writes the atomic Development
checkpoint; writes a Development-only diagnostic report (`development` populated, `holdout: null`);
never writes the final combined report.

**Holdout**: requires `--final-evaluation` and `--development-checkpoint=<path>`; validates that
checkpoint fully (§6.3) before constructing any provider or budget gate; refuses if a completed
Holdout checkpoint or the final combined report already exists, or if the ledger already has any
entry for a Holdout-partition call. Reconstructs the cumulative budget gate from the shared ledger
(Development's consumption already deducted). Executes only Holdout call IDs; never reruns a
Development call (proven directly: `RepresentativeHybridV1LiveTwoPhaseWorkflow.test.ts`'s "never
reruns Development" test spies on the Holdout-phase Variant B provider and asserts it is never
invoked with the Development scenario's case ID). Combines the validated checkpoint's
`developmentCaseRecords`/`rawTelemetry` with this run's own fresh Holdout records into **one final
report containing both partitions**, via the same (structurally unchanged)
`buildRepresentativeHybridV1LiveReport` function v1 already had — that function always accepted
`developmentCaseRecords`/`holdoutCaseRecords` independently; the defect was entirely in the
harness's orchestration never supplying both, never in the report builder itself. The Development
diagnostic artifact is preserved separately, never overwritten.

**Disabled shortcuts**: `--partition=all` is refused by the CLI (`benchmark-resolver-v3-representative-hybrid-live.mjs`)
before the harness is ever spawned. `--allow-rerun` does not exist — passing it is refused with an
explicit error, before any other argument parsing. Both refusals are unconditional, not gated by
any other flag.

## 7. Crash/interruption semantics

| Moment of interruption                                                    | Ledger state on next open                                                                                                                                                                     | Consequence                                                                                                                                                  |
| ------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Before `reserve()` is ever called for a call ID                           | no entry                                                                                                                                                                                      | never attempted — safe to include normally on the next authorized run                                                                                        |
| After `reserved` is persisted, before `dispatched`                        | `indeterminate_after_interruption`                                                                                                                                                            | reservation retained forever; both phases refuse to proceed until a human resolves it                                                                        |
| After `dispatched` is persisted, before a terminal state                  | `indeterminate_after_interruption`                                                                                                                                                            | same as above — the request may have reached the provider; never assumed either way                                                                          |
| After `completed`/`terminal_failure` is persisted                         | unchanged, terminal                                                                                                                                                                           | never rerun, ever                                                                                                                                            |
| After the whole partition finishes, before the checkpoint write completes | ledger already fully accounts for every call (fsync'd per entry); checkpoint write is atomic, so a crash here leaves either no checkpoint file or a complete, valid one — never a partial one | the next attempt sees "no complete checkpoint" and, per §6.7, refuses a fresh run over a non-empty ledger, requiring explicit human review before continuing |

A process restart can always distinguish: never attempted (no ledger entry) · reserved-only ·
dispatched-only (both collapse to `indeterminate_after_interruption`, since the ledger alone cannot
prove whether the provider ever received the request) · completed · terminal_failure. It cannot
further split "reserved but network never sent" from "dispatched and response lost" — both are
reported identically as indeterminate, which is the conservative, safe answer (never assumed free,
never assumed billed).

## 8. Cumulative-budget semantics

- One ledger, one frozen `limits` object (`maxCalls: 263`, `maxInputTokens: 2,154,496`,
  `maxOutputTokens: 403,968`, `maxCost: 4.174336`, `maxInFlight: 1`), shared across Development and
  Holdout and across every process invocation of either.
- A new process's budget gate is never constructed with the full frozen allowance and zero prior
  memory — it is always reconstructed via §6.6 from the durable ledger first.
- Proven directly by `RepresentativeHybridV1LiveCumulativeBudget.test.ts` (9 tests) and
  `RepresentativeHybridV1LiveTwoPhaseWorkflow.test.ts`: total calls/cost across both phases combined
  can never exceed the frozen ceiling; `maxInFlight` remains 1 after reconstruction; a
  failed/indeterminate call retains its reservation in the reconstructed state; two independent
  ledgers never share state (no hidden second gate).

## 9. Corrected commands

**Preflight** (zero-network):

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --preflight \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v2.json
```

**Development**:

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=development \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v2.json
```

**Holdout** (exactly once, after inspecting Development, with no code/protocol/corpus change in
between):

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=holdout \
  --final-evaluation \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v2.json \
  --development-checkpoint=logs/resolver-v3-039-development-checkpoint.json
```

## 10. Tests

69 new focused tests added, all passing, across 8 new test files:

| File                                                             | Tests | Covers                                                                                                                                                                                                                                                                                                                                                                                 |
| ---------------------------------------------------------------- | ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `RepresentativeHybridV1LiveProtocolV1DefectReproduction.test.ts` | 6     | Original-defect reproduction (Development artifact, v1 Holdout refusal, `--allow-rerun` data loss, holdout-only report has no Development evidence, zero-calls confirmation from the real committed v1 artifact, v1 documents preserved)                                                                                                                                               |
| `RepresentativeHybridV1LiveCheckpoint.test.ts`                   | 16    | Atomic write, truncation, tampering, unknown version, protocol/plan/corpus/tree/provider/pricing mismatches, incomplete-phase refusal, missing-checkpoint-before-provider-construction, unaccounted-call refusal, closed schema, Holdout checkpoint read/tamper                                                                                                                        |
| `RepresentativeHybridV1LiveCallLedger.test.ts`                   | 16    | Reserve-before-dispatch-before-terminal ordering, no-rerun-of-completed/terminal-failure, duplicate/conflicting-state refusal, crash-after-reserve/dispatch → indeterminate, indeterminate never auto-rerun, explicit human resolution, partial-evidence survival across process recreation, tamper/reorder/truncation handling, unknown ledger version, reservation-order replay list |
| `RepresentativeHybridV1LiveLedgerProviders.test.ts`              | 4     | Ledger writes precede the underlying provider call; `terminal_failure` on a non-success result; unplanned-call refusal; Variant C cursor only advances over AI-routed observations                                                                                                                                                                                                     |
| `RepresentativeHybridV1LiveCumulativeBudget.test.ts`             | 9     | Development consumption reduces Holdout's allowance; no fresh full budget; cumulative call/cost ceilings never exceeded; `maxInFlight` stays 1; failed/indeterminate calls retain reservation; no hidden second gate; plan/ledger drift refusal                                                                                                                                        |
| `RepresentativeHybridV1LiveExecutionTreeHash.test.ts`            | 7     | Deterministic/order-independent hashing; single-byte and file-add/remove sensitivity; real-repo stability; missing-file refusal; tracked-path coverage; generated-artifact exclusion                                                                                                                                                                                                   |
| `RepresentativeHybridV1LiveCallId.test.ts`                       | 6     | Determinism; plan-hash sensitivity; per-field uniqueness; execution ordering; planned-call-ID scoping (excludes fast-path, scopes by partition)                                                                                                                                                                                                                                        |
| `RepresentativeHybridV1LiveTwoPhaseWorkflow.test.ts`             | 5     | End-to-end Development → checkpoint → Holdout composition: Development executes only its own call IDs; Holdout never reruns Development and combines both partitions into one validated report; partition metrics stay separate; checkpoint/protocol mismatch refusal; full frozen-plan call accounting satisfied across both phases                                                   |

All use fake transports/providers exclusively — no test reads or sets `ANTHROPIC_API_KEY`, and no
test performs a network call (`RepresentativeHybridV1LiveIsolation.test.ts`'s existing "no live
provider request may occur without an explicit execution flag" and DI-import-scan tests cover the
new files too, since they walk the whole `src/` tree / `process.env` unchanged).

Full regression: **208 tests / 26 suites** across the entire `representativeHybridV1/**` tree pass
(the 139 tests that existed before this remediation, unchanged, plus the 69 new ones) — see §12.

## 11. Remediation verification and merge (pre-live)

Run in this order, on this branch, before any paid request:

1. `npm install --ignore-scripts` (this environment has no `node_modules`; Supabase CLI's
   postinstall network fetch is blocked here — documented precedent, unrelated to this task).
2. `npm run typecheck` — 0 errors.
3. `npm run lint` — 0 errors.
4. `npm run format:check` — clean (after one `prettier -w` pass over the newly authored files,
   applied and reverified).
5. `npx jest --testPathPattern="representativeHybridV1"` — **208/208 tests, 26/26 suites, green**.
6. `npm run verify` (typecheck + lint + format:check + full test suite) — see §12 for the full
   result.
7. `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` / `diff --check` — see
   §13 "Exact changed files."
8. Confirmed zero network/provider calls: no test or script in this diff reads or sets
   `ANTHROPIC_API_KEY`; every new/changed live-path test uses a fake `VariantBProvider`/
   `VariantCAiInterpreter`/transport.

## 12. Full verification result

`npm run verify` (typecheck + lint + format:check + full `jest --runInBand` test suite) — **green**.
Exact totals recorded at commit time in the PR description and this document's companion commit
message. No test was skipped or marked pending.

## 13. Exact changed files

New:

- `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V2.md`
- `reports/resolver-v3-039-controlled-live-protocol-v2.json`
- `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` (this document)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallId.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCallLedger.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCheckpoint.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveCumulativeBudget.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionTreeHash.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveLedgerProviders.ts`
- 8 new test files under `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/` (§10)

Modified (in place, git history preserved):

- `src/features/nutrition/benchmark/representativeHybridV1/live/runRepresentativeHybridV1Live.harness.ts`
  (v1 → v2 orchestration logic)
- `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs` (v1 → v2 CLI: `--partition=all` and
  `--allow-rerun` refused; `--development-checkpoint=` added)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportBuilder.ts`
  (additive: `reportVersion`/`protocolVersion` became optional parameters, defaulting to the
  original v1 literals — every existing caller/test is byte-identical in output)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveReportValidator.ts`
  (additive: accepts either the v1 or v2 report version, not just v1)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveVersions.ts`
  (additive: new v2 constants alongside the unmodified v1 ones)

Explicitly unchanged: every RESOLVER-V3-038 corpus/registry/manifest/hash file, `learningV2/**`,
`VariantBLiveProvider.ts`, `VariantCLiveInterpretationProvider.ts`, `LiveProviderBudgetGate.ts`,
protocol v1's own four documents, `package.json`, `package-lock.json`, any migration, any Supabase
adapter, any DI/container file, any feature flag.

## 14. No-production-effect statement

No production DI/container registration, feature flag, database migration, RPC, Supabase adapter,
or UI/journal change was made. Every new file lives under
`src/features/nutrition/benchmark/representativeHybridV1/live/**` or `reports/**`; the two modified
non-test, non-harness source files (`RepresentativeHybridV1LiveReportBuilder.ts`,
`RepresentativeHybridV1LiveReportValidator.ts`) each received only additive, backward-compatible
changes, verified by the full pre-existing test suite passing unchanged. `package.json`/
`package-lock.json` are untouched (`git status --short` confirms). This is additionally proven by
`RepresentativeHybridV1LiveIsolation.test.ts`'s existing "no production DI file imports the live
module tree" scan, which covers every new file in this diff since it walks the real `src/` tree.

## 15. Indeterminate call resolution procedure (reference)

If a live run is interrupted and the next `--preflight`/`--partition=` invocation refuses to
proceed citing indeterminate call IDs:

1. Do not delete or edit the ledger file. Do not pass any flag to force past this check — none
   exists.
2. Using the call ID(s) named in the refusal message, independently confirm via an out-of-band,
   authoritative source (the Anthropic Console's usage/billing view for the approximate timestamp)
   whether the request was actually billed.
3. In a one-off Node/ts-jest session (never inside the main CLI path), call
   `RepresentativeHybridV1LiveCallLedger.open(ledgerPath).resolveIndeterminateCallAsTerminalFailure(callId,
humanNote)` with a `humanNote` that records what was confirmed and how.
4. Re-run the same `--partition=` command. The resolved call ID is now `terminal_failure` (its
   reservation stays consumed either way) and no longer blocks progress; the ledger's other
   already-attempted call IDs are still refused from being rerun automatically — RESOLVER-V3-039's
   conservative design (§6.7) requires reviewing the whole partition's state before restarting.

## 16. Final status of this remediation

- **RESOLVER-V3-039 remains `in_progress`** — this remediation corrects the Phase-B continuation
  defect and re-freezes a corrected protocol; it collects no live evidence itself and does not, by
  itself, complete the task.
- **RESOLVER-V3-041 remains `todo`, not started.**
- **RESOLVER-V3-010 remains `blocked`.**
- **RESOLVER-V3-038 and RESOLVER-V3-040 remain `done`, unmodified.**
