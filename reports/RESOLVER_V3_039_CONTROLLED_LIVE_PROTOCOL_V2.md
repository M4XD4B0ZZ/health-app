# RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence — Frozen Protocol v2

Status: `frozen` (Phase-B continuation remediation)
Task ID: RESOLVER-V3-039
Protocol version: `resolver-representative-hybrid-live-protocol-v2`
Supersedes: `resolver-representative-hybrid-live-protocol-v1` (preserved, unexecuted, invalidated —
see §0 and `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` for the full defect
analysis)

This document, together with `reports/resolver-v3-039-controlled-live-protocol-v2.json`, is the
corrected, canonical frozen protocol for RESOLVER-V3-039 live execution. No paid provider request
may occur before the commit that introduces both files exists (the "protocol-v2-freeze commit"),
and no live execution may deviate from the exact call plan recorded here. **Protocol v1's own
documents (`RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md` /
`resolver-v3-039-controlled-live-protocol.json`) remain in the repository as invalidated
pre-execution history and must never be passed to `--protocol=` — the harness refuses any
`protocolVersion` other than this document's.**

## 0. Why protocol v1 is superseded (zero calls, zero cost, no evidence discarded)

Protocol v1 was frozen (commit `da3bae6939bd5514e7a7521597ae670940e45ea6`) and its harness/CLI
implementation and tests were verified, but **before any live execution was attempted**, a
pre-execution continuation defect was found: the documented two-phase workflow ("run Development;
inspect it; run Holdout without changing code or protocol") could not actually execute, because
Development's report write left an artifact that made the harness refuse the documented Holdout
command, and its only two escape hatches were both unsafe (`--allow-rerun` discarded Development's
results; `--partition=all` skipped the required inspection boundary or repeated paid Development
calls). See `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` for the exact failure
mechanics. **Zero of the 263 planned calls occurred under protocol v1; zero cost was incurred; no
quality evidence exists to be invalidated, because none was ever collected.** Protocol v1 is
invalidated for live execution, not because it was ever run and produced a bad result, but because
it could never have safely completed its own documented procedure. Its Git history and documents
are preserved unedited.

## 1. Scope and authorization

Unchanged from protocol v1: authorized to spend **no more than USD 5.00** in real, billed Anthropic
API requests, using one shared, taskwide `LiveProviderBudgetGate` instance (`maxInFlight: 1`) for
every live Variant B and Variant C request, now reconstructed cumulatively from a durable call
ledger rather than reset per process (§10). It collects controlled representative live evidence for
a later gate re-decision (RESOLVER-V3-041, `todo`, not started by this task). It does not wire
Hybrid C into production, does not choose a permanent provider, and does not enable RESOLVER-V3-010.

## 2. Corpus / registry / harness / source-manifest versions and hashes

| Field                   | Value                                                              |
| ----------------------- | ------------------------------------------------------------------ |
| Corpus version          | `resolver-representative-hybrid-benchmark-corpus-1.0.0`            |
| Corpus hash             | `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a` |
| Registry version        | `resolver-representative-hybrid-benchmark-registry-v1`             |
| Harness version         | `2.0.0`                                                            |
| Source-manifest version | `resolver-representative-hybrid-benchmark-source-manifest-v1`      |
| Source-manifest hash    | `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52` |
| Plan hash               | `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e` |
| **Execution-tree hash** | `9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e` |

Corpus/registry/source-manifest/plan hashes are unchanged from protocol v1 (this remediation made
no corpus, route-classification, or execution-plan change). **Execution-tree hash is new in v2**:
a deterministic content hash over every execution-relevant file the other three hashes do not cover
— prompts, schemas, the live provider/pricing/transport code, and the live harness/report-builder/
metrics logic itself (`RepresentativeHybridV1LiveExecutionTreeHash.ts`'s
`REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS`). Any change to that surface changes this hash
and refuses continuation before any Holdout call — deliberately a content hash, not a literal
git-SHA-equality check against the freeze commit, so generated evidence files (logs/reports) can be
added after freeze without falsely triggering drift.

## 3. Provider, model, pricing

Unchanged from protocol v1:

- Provider: `anthropic`
- Model: `claude-haiku-4-5` (Claude API alias), pinned snapshot `claude-haiku-4-5-20251001`
- Pricing verified from an official Anthropic source only (2026-07-22, Claude Haiku 4.5 — $1/MTok
  input, $5/MTok output) — see `resolver-v3-039-controlled-live-protocol-v2.json`'s `pricing` object
  for the source URLs. **This remediation performed no new pricing lookup** (it made no paid
  request). Per the binding workflow below (§14), pricing and model availability MUST be
  re-verified against an official Anthropic source immediately before Development actually runs,
  and any drift recorded before that run — never silently reused from this frozen snapshot without
  that check.

## 4. Prompt / schema / interpreter / estimator versions (pinned, unchanged)

Identical to protocol v1 — see `resolver-v3-039-controlled-live-protocol-v2.json`'s
`pinnedVersions`.

## 5. Per-request reservation

Unchanged from protocol v1 — 8,192 max input tokens / 1,536 max output tokens per attempt for both
Variant B and Variant C; worst-case cost per request `$0.015872`.

## 6. Canonical execution population / 7. Route classification / 8. Exact call plan / 9. Minimum-

## sample supplementation / 11. Timeout and retry policy / 12. Credential handling

All unchanged from protocol v1 §6–§9, §11–§12 — see that document or
`resolver-v3-039-controlled-live-protocol-v2.json` for the full tables (114 total scenarios, 263
total planned paid calls, timeout/retry policy, credential-presence-only check).

## 10. Budget arithmetic (hard reservation ceiling — now enforced cumulatively)

```text
maxCalls        = variantBCalls (136) + variantCMaxAiRoutedCalls (127) = 263
maxInputTokens  = 263 * 8,192  = 2,154,496
maxOutputTokens = 263 * 1,536  =   403,968
perRequestWorstCaseCostUsd = (8192/1e6)*1 + (1536/1e6)*5 = 0.015872
maxCost         = 263 * 0.015872 = 4.174336
```

Unchanged arithmetic from protocol v1. **What changes in v2**: this ceiling is enforced **once,
cumulatively, across both the Development and Holdout process invocations combined** —
`RepresentativeHybridV1LiveCumulativeBudget.ts` reconstructs a `LiveProviderBudgetGate` from the
durable, append-only call ledger (`RepresentativeHybridV1LiveCallLedger.ts`) before either phase
makes a single live call, replaying every already-reserved call ID through the exact same
`reserve()`/`release()` sequence a real request uses. Holdout therefore starts with its allowance
already reduced by whatever Development consumed — never a fresh full 263-call/$4.174336 ceiling
per process. `maxInFlight` remains `1`.

## 13. Frozen artifacts (must not change after this commit)

See `resolver-v3-039-controlled-live-protocol-v2.json`'s `isolation.frozenArtifacts` list — the
same RESOLVER-V3-038/023/024/040 artifacts protocol v1 froze, **plus protocol v1's own four
documents**, now preserved as invalidated history rather than an executable protocol. This task's
own code lives in additive files (`src/features/nutrition/benchmark/representativeHybridV1/live/**`,
`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`), plus the same two minimal,
backward-compatible optional-parameter additions to `VariantBLiveProvider.ts`/
`VariantCLiveInterpretationProvider.ts` protocol v1 already made.

## 14. Corrected two-phase workflow

**Development:**

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=development \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v2.json
```

Verifies protocol/plan/corpus/source-manifest/execution-tree/provider/model/pricing; requires the
credential; refuses if a Development checkpoint already exists or the call ledger already has any
entry for a Development-partition call; refuses if any ledger entry anywhere is
`indeterminate_after_interruption` (requires explicit human resolution first — see the remediation
report's "Indeterminate call resolution" procedure). Executes only Development call IDs; durably
records each call to the ledger before/after dispatch; writes a validated, atomic Development
checkpoint (`logs/resolver-v3-039-development-checkpoint.json`) containing the exact planned/
completed/terminal-failure call IDs, raw telemetry, evaluated case records, and cumulative budget
state; writes a Development-only diagnostic report; does **not** write the final combined report.

**Inspect the Development checkpoint and diagnostic report. Make no code/protocol/corpus change.**

**Holdout (exactly once):**

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=holdout \
  --final-evaluation \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v2.json \
  --development-checkpoint=logs/resolver-v3-039-development-checkpoint.json
```

Requires `--final-evaluation` and the exact, valid Development checkpoint (protocol/hash/execution-
tree/provider/pricing match; every planned Development call accounted for); refuses if a completed
Holdout checkpoint or the final report already exists, or if the ledger already has any entry for a
Holdout-partition call. Reconstructs the cumulative budget from the ledger (Development's
consumption already deducted). Executes only Holdout call IDs; never reruns a Development call;
appends Holdout telemetry to the same durable ledger; combines the validated checkpoint's
Development case records with this run's fresh Holdout case records into **one final report
containing both partitions** (`logs/resolver-v3-039-controlled-representative-live-evidence.json`/
`.md`); the Development diagnostic artifact is preserved separately, never overwritten.

**Disabled shortcuts:** `--partition=all` is refused by the CLI before the harness is even spawned.
`--allow-rerun` does not exist. Neither may be used in the canonical workflow.

**Indeterminate call resolution:** if a process is interrupted after a call is reserved/dispatched
but before it reaches a terminal state, the ledger marks it `indeterminate_after_interruption` on
the next open and **both phases refuse to proceed** while any such entry exists. Resolving it is an
explicit, separate human action (never automatic, never part of the main CLI path) — see the
remediation report for the exact procedure.
