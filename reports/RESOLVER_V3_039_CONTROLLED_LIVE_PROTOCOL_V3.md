# RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence — Frozen Protocol v3

Status: `frozen` (zero-provider-call execution-tree-hash remediation)
Task ID: RESOLVER-V3-039
Protocol version: `resolver-representative-hybrid-live-protocol-v3`
Supersedes: `resolver-representative-hybrid-live-protocol-v2` (preserved, unexecuted, invalidated —
see §0 and `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md` for the full defect
analysis)

This document, together with `reports/resolver-v3-039-controlled-live-protocol-v3.json`, is the
corrected, canonical frozen protocol for RESOLVER-V3-039 live execution. No paid provider request
may occur before the commit that introduces both files exists (the "protocol-v3-freeze commit"),
and no live execution may deviate from the exact call plan recorded here. **Protocols v1 and v2's
own documents (`RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md` /
`resolver-v3-039-controlled-live-protocol.json`, `RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V2.md` /
`resolver-v3-039-controlled-live-protocol-v2.json`) remain in the repository as invalidated
pre-execution history and must never be passed to `--protocol=` — the harness refuses any
`protocolVersion` other than this document's.**

## 0. Why protocol v2 is superseded (zero calls, zero cost, no evidence discarded)

Protocol v1 was superseded by protocol v2 for an unrelated defect (the documented two-phase
Development → Holdout workflow could not safely execute — see
`reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`). Protocol v2's own two-phase
checkpoint/ledger design is sound and is **unchanged** in v3. Before any live provider request was
made under protocol v2, a separate, zero-network local preflight independently re-derived every
frozen hash in `resolver-v3-039-controlled-live-protocol-v2.json` and found that its frozen
`executionTreeHash` (`9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e`) matched
**none** of:

- a canonical LF Git-content computation over the protocol-v2-freeze commit's tree
  (`f688878f7b467975762f25b6bfd27bee64ea214f`), the PR #137 merge commit
  (`fd3142fa1596586ea36ca098ed66babed9d7092e`), or the later canonical base-branch tree (all three
  identical: `761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646` — the v2 tracked
  file set's 20 Git blobs are byte-identical across all three commits, confirmed directly);
- this Windows environment's CRLF working-tree computation using the unmodified v2 implementation
  (`c3d08d49e62b224b61c7ca93013acda2ac2499242a47d1a9bbef24359ead786d`, also recorded in the
  gitignored `logs/resolver-v3-039-preflight.json` from the prior Development preflight run).

**Root cause** (full analysis in `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md`): the
v2 execution-tree hash implementation read working-tree file content verbatim
(`fs.readFileSync(absolute, 'utf-8')`) with **no line-ending normalization whatsoever**, so its
result is a direct function of `core.autocrlf` and the checkout platform, not of the file content
alone — a Windows checkout (`core.autocrlf=true`, this repository's configured value, confirmed via
`git config --get core.autocrlf`) materializes `\r\n` in the working tree for every one of the 20
tracked files, while the committed Git blobs (and a Linux/macOS checkout with `autocrlf=false` or
`input`) contain `\n` only. Neither of these two real, reproducible values equals the frozen v2
literal, which means the v2 literal was not actually computed from either the final committed tree
or a real working-tree checkout at freeze time — most likely a stale value from an intermediate
development state, hand-transcribed or computed before the tracked files reached their final
content, and never re-verified. **`RepresentativeHybridV1LiveExecutionTreeHash.test.ts` as merged in
PR #137 never asserted that a fresh computation equaled the frozen protocol literal** — it only
checked self-consistency across two calls and `length === 64` — so this discrepancy could not have
been caught by the existing test suite at merge time.

**Zero of the 263 planned calls occurred under protocol v2; zero cost was incurred; no quality
evidence exists to be invalidated, because none was ever collected.** This remediation itself made
zero provider calls (verified: no test or script in this diff reads or sets `ANTHROPIC_API_KEY`; the
`ANTHROPIC_API_KEY` presence check performed at the start of this task's work found the credential
**absent**, and no repository change was made in response to that finding beyond the boolean
presence result itself). Protocol v2 is invalidated for live execution, not because it was ever run
and produced a bad result, but because its own frozen drift-detection literal could never have
matched a real computation. Its Git history and documents are preserved unedited.

## 1. Scope and authorization

Unchanged from protocol v2: authorized to spend **no more than USD 5.00** in real, billed Anthropic
API requests, using one shared, taskwide `LiveProviderBudgetGate` instance (`maxInFlight: 1`) for
every live Variant B and Variant C request, reconstructed cumulatively from a durable call ledger. It
collects controlled representative live evidence for a later gate re-decision (RESOLVER-V3-041,
`todo`, not started by this task). It does not wire Hybrid C into production, does not choose a
permanent provider, and does not enable RESOLVER-V3-010.

## 2. Corpus / registry / harness / source-manifest versions and hashes

| Field                         | Value                                                              |
| ----------------------------- | ------------------------------------------------------------------ |
| Corpus version                | `resolver-representative-hybrid-benchmark-corpus-1.0.0`            |
| Corpus hash                   | `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a` |
| Registry version              | `resolver-representative-hybrid-benchmark-registry-v1`             |
| Harness version               | `2.0.0`                                                            |
| Source-manifest version       | `resolver-representative-hybrid-benchmark-source-manifest-v1`      |
| Source-manifest hash          | `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52` |
| Plan hash                     | `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e` |
| **Execution-tree hash (v3)**  | `9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f` |
| Execution-tree hash algorithm | `representative-hybrid-v1-live-execution-tree-hash-algorithm-v3`   |

Corpus/registry/source-manifest/plan hashes are **unchanged from protocol v1/v2** — this remediation
made no corpus, route-classification, or execution-plan change; only the execution-tree hash
algorithm and value changed.

## 3. Corrected execution-tree hash algorithm (v3)

`RepresentativeHybridV1LiveExecutionTreeHash.ts`:

1. Reads each of the 26 tracked paths (`REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS`) from
   the working tree as UTF-8 text — **never shells out to Git**, so the value is computable from a
   plain checkout with no `.git` directory (an extracted archive, a CI artifact).
2. **Canonicalizes** every file's content before hashing: all `\r\n` sequences become `\n`; if any
   lone `\r` remains afterward (not part of a `\r\n` pair — old Mac-style line endings, or
   binary/malformed text), the computation **fails closed** with
   `RepresentativeHybridV1LiveExecutionTreeHashError`, never silently hashing corrupted content.
   This normalization is what makes the hash **independent of `core.autocrlf`** and reproducible
   identically from a Windows CRLF checkout, a Linux/macOS LF checkout, or the canonical LF Git blob
   content — proven directly by this remediation's regression tests (§10 below).
3. Sorts the canonicalized `(path, content)` pairs by path, so file read/input order never affects
   the result.
4. Hashes `sha256({ algorithmVersion, files: sorted [path, content] pairs })` — the
   `algorithmVersion` tag (`representative-hybrid-v1-live-execution-tree-hash-algorithm-v3`) is part
   of the hashed payload, so even byte-identical file content would hash differently under a future
   algorithm change; the hash can never be silently reproduced by an older or different
   implementation.
5. **Fails closed if any tracked file is missing** — an execution-relevant file disappearing is
   itself drift, never silently skipped (unchanged from v1/v2).
6. Tracks 6 files v2 omitted: `RepresentativeHybridV1LiveLedgerProviders.ts` (writes ledger entries
   before/after every dispatched call), `RepresentativeHybridV1LiveReportValidator.ts` (gates every
   persisted report), `LiveProviderUsage.ts` (cost/usage aggregation feeding gate verdicts), the CLI
   entry point itself (`scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`, which selects
   partition/mode and refuses `--partition=all`/`--allow-rerun`), and — closing the v2 gap where a
   change to the hashing algorithm or the protocol-version gate itself would not move the hash it is
   supposed to be gated by — the hash-computation file
   (`RepresentativeHybridV1LiveExecutionTreeHash.ts`) and the new, extracted protocol-verification
   module (`RepresentativeHybridV1LiveProtocolVerification.ts`). Neither of the last two embeds its
   own hash literal, so including them is safe (no fixed-point/self-reference).
7. Deliberately still a **content hash, not a literal git-SHA-equality check** against the freeze
   commit, so generated evidence files (logs/reports) can be added after freeze without falsely
   triggering drift — no `logs/` or `reports/` path is ever tracked.

## 4. Provider, model, pricing

Unchanged from protocol v1/v2 — see `resolver-v3-039-controlled-live-protocol-v3.json`'s `pricing`
object. **This remediation performed no new pricing lookup** (it made no paid request and no
provider/model/pricing change). Per the binding workflow below (§9), pricing and model availability
MUST be re-verified against an official Anthropic source immediately before Development actually
runs, and any drift recorded before that run.

## 5. Prompt / schema / interpreter / estimator versions (pinned, unchanged)

Identical to protocol v1/v2 — see `resolver-v3-039-controlled-live-protocol-v3.json`'s
`pinnedVersions`.

## 6. Per-request reservation / population / call plan / budget arithmetic

All unchanged from protocol v1/v2 §5–§10 — see that document or
`resolver-v3-039-controlled-live-protocol-v3.json` for the full tables (114 total scenarios, 263
total planned paid calls, cumulative budget enforcement, timeout/retry policy, credential-presence-
only check). No corpus, route-classification, execution-plan, or budget change was made.

## 7. Two-phase workflow, checkpoint, ledger, cumulative budget (unchanged from protocol v2)

The durable Development checkpoint, tamper-evident append-only call ledger, cumulative-budget
reconstruction, and disabled `--partition=all`/`--allow-rerun` shortcuts introduced in protocol v2
(`reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`) are **entirely unchanged** in v3 —
this remediation is scoped exclusively to the execution-tree hash. Only the `--protocol=` path
(pointing at this v3 document) and the protocol-version literal accepted by the harness changed.

**Development:**

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=development \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v3.json
```

**Holdout (exactly once, after inspecting Development, with no code/protocol/corpus change in
between):**

```bash
node scripts/benchmark-resolver-v3-representative-hybrid-live.mjs \
  --partition=holdout \
  --final-evaluation \
  --protocol=reports/resolver-v3-039-controlled-live-protocol-v3.json \
  --development-checkpoint=logs/resolver-v3-039-development-checkpoint.json
```

## 8. Protocol version rejection

`RepresentativeHybridV1LiveProtocolVerification.ts`'s
`verifyRepresentativeHybridV1LiveProtocolV3` — extracted out of the harness so it is directly
unit-testable without spawning a live-shaped process — refuses (before any provider/budget-gate
construction) any protocol document whose `protocolVersion` is not
`resolver-representative-hybrid-live-protocol-v3`. This rejects protocol v1 and v2 documents by
construction.

## 9. Corrected local verification workflow (this remediation)

Run in this order, on this branch, before any paid request (none was made in this remediation):

1. `npm run typecheck` — 0 errors.
2. `npm run lint` — 0 errors.
3. `npm run format:check` — clean.
4. Focused: `npx jest --testPathPattern="representativeHybridV1"` — full
   `representativeHybridV1/**` regression, including the new execution-tree-hash and
   protocol-verification tests.
5. `npm run verify` (typecheck + lint + format:check + full test suite).
6. `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` / `diff --check`.
7. Confirmed zero network/provider calls: no test or script in this diff reads or sets
   `ANTHROPIC_API_KEY`; every changed/added live-path test uses a fake `VariantBProvider`/
   `VariantCAiInterpreter`/transport, or no transport at all.

See `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md` for full verification results and
the exact changed-file list.
