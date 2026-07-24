# RESOLVER-V3-039 — Zero-Provider-Call Execution-Tree-Hash Remediation

Task ID: RESOLVER-V3-039 (remediation of the merged protocol-v2 implementation, PR #137, branch-tip
commit `f688878f7b467975762f25b6bfd27bee64ea214f`, merge commit
`fd3142fa1596586ea36ca098ed66babed9d7092e`)
Status: remediation complete; **RESOLVER-V3-039 remains `in_progress`** — no live evidence has been
collected by this task (zero provider calls occurred, before, during, or after this remediation).
`RESOLVER-V3-041` remains `todo`, not started. `RESOLVER-V3-010` remains `blocked`.

## 1. Credential and cost boundary

Before any repository change, a **boolean presence-only** check for `ANTHROPIC_API_KEY` was
performed (`if ($env:ANTHROPIC_API_KEY) { 'PRESENT' } else { 'ABSENT' }`). Result: **`ABSENT`**. Per
this task's binding instruction, work proceeded because the key was absent; had it been present, the
task would have stopped immediately with no repository change. The credential's value was never
printed, inspected, hashed, persisted, or requested at any point. No `Development` or `Holdout`
partition was run. No Anthropic API/provider request of any kind was made at any point in this
remediation.

## 2. How the defect was found (zero-call local preflight)

The previous Development preflight (`resolver-v3-039-live-evidence` branch) left a gitignored,
zero-network artifact at `logs/resolver-v3-039-preflight.json` recording, among other fields:

```json
"protocolVersion": "resolver-representative-hybrid-live-protocol-v2",
"executionTreeHash": "c3d08d49e62b224b61c7ca93013acda2ac2499242a47d1a9bbef24359ead786d",
"apiKeyPresent": false,
"readyForLiveExecution": false
```

This file was **preserved unedited** (never treated as live evidence — `readyForLiveExecution:
false`, `apiKeyPresent: false`, no checkpoint/ledger/report fields present). Before touching the
repository, this remediation independently re-derived every hash value implicated, from first
principles, rather than trusting the preflight artifact or the task summary.

## 3. Independent reproduction of all three hash classes

### 3.1 The frozen protocol-v2 literal

```
9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e
```

(from `reports/resolver-v3-039-controlled-live-protocol-v2.json`'s `executionTreeHash` field —
read directly, not assumed.)

### 3.2 The Windows CRLF working-tree computation (reproduced)

Running the _unmodified_ v2 `computeCurrentRepresentativeHybridV1LiveExecutionTreeHash` logic
(`fs.readFileSync(path, 'utf-8')`, zero normalization) against this checkout's real working-tree
files for all 20 v2-tracked paths reproduced:

```
c3d08d49e62b224b61c7ca93013acda2ac2499242a47d1a9bbef24359ead786d
```

— exactly matching the gitignored preflight artifact. All 20 tracked files were confirmed to contain
`\r\n` line endings in this checkout (`git config --get core.autocrlf` → `true`; no `.gitattributes`
entry forces `eol=lf` for any of these paths).

### 3.3 The canonical LF Git-content computation (reproduced)

Reading each of the 20 v2-tracked paths via `git show <commit>:<path>` (confirmed byte-identical to
`git cat-file -p <blob>` — Git does **not** apply `core.autocrlf` smudging to `show`/`cat-file`
output, only to working-tree checkout) and hashing with the exact, unmodified v2 algorithm produced
the **same value** at all three commits:

| Commit                                                                        | Execution-tree hash (v2 algorithm, canonical LF content)           |
| ----------------------------------------------------------------------------- | ------------------------------------------------------------------ |
| Branch tip `f688878f7b467975762f25b6bfd27bee64ea214f`                         | `761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646` |
| Merge commit `fd3142fa1596586ea36ca098ed66babed9d7092e`                       | `761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646` |
| Later canonical base-branch tree (`87d675fa5bb526f8935eeebd08123fe0bbd52a1f`) | `761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646` |

Confirming: **all 20 v2-tracked execution-tree Git blobs are byte-identical across all three
commits** — `git diff f688878..fd3142f -- src/.../live/` returns no output for that path. No file
in the v2 tracked set changed between the branch-tip commit, the merge commit, and the later
canonical tree.

### 3.4 Conclusion

None of the three values match each other:

```
protocol-v2 literal:        9c3da0fed1ae33d66bf6a9499f679ce67829c80e054d0fd180e2e4a65fcd5b9e
Windows CRLF working tree:  c3d08d49e62b224b61c7ca93013acda2ac2499242a47d1a9bbef24359ead786d
Canonical LF Git content:   761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646
```

Zero of the 263 planned calls occurred under protocol v2 (or v1 before it); zero cost was incurred;
no quality evidence exists to be invalidated, because none was ever collected.

## 4. Required diagnosis

### 4.1 The complete reproducible LF Git-content hash

`761d3511d60aded667f4f4714558f14fec1e9376acda01cccab5574ac16a6646`, computed with the unmodified v2
algorithm over the v2-tracked 20-file set's canonical (LF) Git blob content — stable across the
branch-tip commit, the merge commit, and the later canonical tree, because none of those 20 blobs
changed across them (§3.3).

### 4.2 Why the committed v2 hash is different

The v2 literal (`9c3da0fed1ae...`) reproduces from **neither** the canonical LF Git-content
computation over the actual committed tree at any of the three examined commits, **nor** a real
Windows CRLF working-tree computation. Since PR #137 was a single squashed commit introducing every
v2 file simultaneously, and the committed tree's content is stable and confirmed unchanged from
branch-tip through the later canonical tree, the only remaining explanation is that the literal was
computed from a **different content state entirely** — most plausibly an intermediate snapshot
during development of the v2 files, before one or more of the 20 tracked files reached the content
that was actually committed, hand-transcribed or copy-pasted into the JSON/MD, and never
re-verified against the final committed tree before the commit was made. This is a "freeze theater"
value: it was written into the frozen protocol document as though it had been computed from the
final state, but no evidence supports that it ever was.

### 4.3 Was the v2 value generated before final execution-tree content was committed?

Yes — this is the most likely explanation supported by the evidence in §4.2, and it is the only
explanation consistent with every other fact established here (blobs unchanged since commit,
neither real-world computation reproduces the literal, single squashed commit with no intermediate
history to inspect).

### 4.4 Why the tests did not catch this

`RepresentativeHybridV1LiveExecutionTreeHash.test.ts` as merged in PR #137 contained 7 tests. None
of them compared a fresh computation to the frozen protocol literal:

- "is deterministic and independent of input ordering" — self-consistency only.
- "changes when any single file content changes" / "changes when a file is added or removed" —
  synthetic in-memory fixtures, not the real tree.
- "the real repository computation is stable across repeated calls" — asserted `a === b` (two calls
  to the _same_ function against the _same_ tree) and `length === 64`. **It never read
  `reports/resolver-v3-039-controlled-live-protocol-v2.json`'s `executionTreeHash` field and never
  compared it to this value.**
- "throws if an execution-relevant file is missing" — synthetic nonexistent path.
- "the tracked path list covers..." / "never includes generated logs/reports" — string-membership
  checks on the path list, not a hash-value check.

A completely wrong, stale, or platform-specific literal could be committed into the protocol JSON
and every one of these 7 tests would still pass. This remediation's
`RepresentativeHybridV1LiveProtocolV3.test.ts` adds the missing check directly (§8, "THE REGRESSION
TEST").

### 4.5 How working-tree CRLF conversion makes the implementation platform-dependent

The v2 `computeCurrentRepresentativeHybridV1LiveExecutionTreeHash` read every tracked file with
`fs.readFileSync(absolute, 'utf-8')` and hashed the result **verbatim** — no line-ending
normalization at any point. Node's `'utf-8'` encoding only decodes bytes to a JS string; it does not
touch `\r`/`\n` bytes. Combined with this repository's `core.autocrlf=true` Git config (confirmed via
`git config --get core.autocrlf`) and no `.gitattributes` entry forcing `eol=lf` for any of the 20
tracked paths, a Windows checkout materializes `\r\n` for every tracked file, while the same commit
checked out on Linux/macOS (where `core.autocrlf` commonly defaults to `false` or `input`) or the
raw Git blob content itself contains `\n` only. The hash function is therefore a direct function of
`core.autocrlf`/OS, not of logical file content alone — exactly reproduced in §3.2 vs §3.3 (two
different, both "correct for their platform," irreconcilable values from the identical commit).

### 4.6 Missing execution-relevant files

Comparing `REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS` (v2, 20 entries) against the full
`src/features/nutrition/benchmark/representativeHybridV1/live/*.ts` directory listing and its
outbound imports found **4 execution-relevant files v2 did not track**:

- `RepresentativeHybridV1LiveLedgerProviders.ts` — wraps Variant B/C providers to write ledger
  entries before/after every dispatched call; directly controls call-ordering/ledger semantics.
- `RepresentativeHybridV1LiveReportValidator.ts` — gates every persisted diagnostic/final report
  (`assertValidRepresentativeHybridV1LiveReport`, called from the harness before every write).
- `LiveProviderUsage.ts` — cost/token usage aggregation (`aggregateLiveProviderUsage`), imported by
  the report builder, telemetry providers, ledger providers, and checkpoint types; feeds directly
  into gate-verdict-relevant `actualUsage` figures.
- `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs` — the CLI entry point itself, which
  selects partition/mode and refuses `--partition=all`/`--allow-rerun`; a change here changes
  execution behavior without moving the v2 hash at all.

All four are added to the v3 tracked path list (§6, now 26 files total).

### 4.7 Self-referential boundary

The v2 boundary was **not** self-referential in the harmful, fixed-point sense: no tracked file
embedded the `executionTreeHash` value itself (the protocol JSON/MD, which does hold that literal,
was never tracked — confirmed by the existing "never includes generated logs/reports" test, which
also implicitly excludes `reports/**`). However, v2 had a _different_, unaddressed gap: the
hash-computation source file (`RepresentativeHybridV1LiveExecutionTreeHash.ts` itself) was **not**
tracked by its own boundary, so a change to the canonicalization algorithm (or its removal) would
not move the hash it is supposed to gate. v3 closes this gap by tracking both
`RepresentativeHybridV1LiveExecutionTreeHash.ts` and the new, extracted
`RepresentativeHybridV1LiveProtocolVerification.ts` (the protocol-version/hash comparison gate)
within the boundary — safe, because neither file embeds its own hash literal, so there is no
circularity: hashing a file's _code_ does not require already knowing that file's hash.

## 5. Corrected design (protocol v3)

`RepresentativeHybridV1LiveExecutionTreeHash.ts` (v3):

1. **Canonical UTF-8 text**, read via `fs.readFileSync(path, 'utf-8')` (unchanged read step) but now
   **normalized before hashing**: every `\r\n` becomes `\n`.
2. **Fails closed on lone CR or malformed text**: after normalization, if any bare `\r` remains (not
   part of a `\r\n` pair — old Mac-style line endings or corrupted/binary content masquerading as
   text), `computeRepresentativeHybridV1LiveExecutionTreeHash` throws
   `RepresentativeHybridV1LiveExecutionTreeHashError` rather than hashing non-canonical content.
3. **Deterministic path+content inclusion, sorted by repository-relative path** — unchanged from v2,
   now operating on canonicalized content.
4. **Fails closed when a listed file is absent** — unchanged from v2.
5. **Independent of `core.autocrlf`**: normalization happens inside the hashing function itself
   (not only at the fs-read boundary), so the same canonical text is hashed regardless of how the
   caller obtained it (working-tree read on any OS, or an explicit CRLF/LF variant constructed in a
   test).
6. **Reproducible from committed Git content and from Windows/Linux/macOS checkouts**: proven
   directly by `RepresentativeHybridV1LiveExecutionTreeHash.test.ts`'s "simulated Windows CRLF
   checkout and canonical LF content reproduce the same hash from the real repository tree" test —
   the real working-tree content (whatever this checkout's line endings happen to be) is read once,
   an explicit canonical-LF baseline and an explicit CRLF variant are derived from it in memory, and
   both are proven to reproduce the exact value the real `computeCurrentRepresentativeHybridV1LiveExecutionTreeHash`
   produces.
7. **Never requires Git at benchmark runtime**: reads are plain `fs` calls against
   repository-relative paths — no `git show`/`git cat-file` shell-out, so the hash is computable from
   a plain checkout with no `.git` directory present (an extracted archive, certain CI artifact
   layouts).
8. **Non-self-referential, closed**: the hash-computation file and the new protocol-verification
   module are now themselves tracked (§4.7); neither embeds a hash literal.
9. **Versioned**: `REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_HASH_ALGORITHM_VERSION =
'representative-hybrid-v1-live-execution-tree-hash-algorithm-v3'` is included directly in the
   hashed payload (`{ algorithmVersion, files }`), so even byte-identical file content hashes
   differently under a future algorithm change (v4+) — the value can never be silently reproduced by
   an older or different implementation, and a future algorithm change is itself visible in the
   hash rather than a silent redefinition of what "the same hash" means.
10. **Verified before every paid Development and Holdout call**: unchanged from v2 —
    `runRepresentativeHybridV1Live.harness.ts` computes
    `computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot)` fresh on every invocation
    (preflight and execute) and, in execute mode,
    `RepresentativeHybridV1LiveProtocolVerification.ts`'s
    `verifyRepresentativeHybridV1LiveProtocolV3` compares it against the frozen protocol literal
    before any provider or budget-gate construction.

### 5.1 New, versioned tracked path list (26 files, v3)

The 20 v2 paths, plus the 4 files identified in §4.6, plus the hash-computation file and the new
protocol-verification module (§4.7) — see
`src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionTreeHash.ts`'s
`REPRESENTATIVE_HYBRID_V1_LIVE_EXECUTION_TREE_PATHS` for the exact, current list.

### 5.2 Extracted, testable protocol-verification gate

`RepresentativeHybridV1LiveProtocolVerification.ts` (new) extracts the protocol-version/plan/corpus/
source-manifest/execution-tree/provider/pricing comparison logic out of the harness (previously an
unexported, untestable inline function reachable only by spawning the whole live-shaped Jest
harness process) into a pure, directly unit-tested function,
`verifyRepresentativeHybridV1LiveProtocolV3`. This is what makes "protocol v1/v2 rejected, v3
accepted" and "an execution-tree mismatch is refused" directly testable (§8) rather than only
reachable through an end-to-end harness invocation.

## 6. Protocol disposition

Protocols v1 and v2 are **not** rewritten as though they had always been correct. Both remain in the
repository, byte-identical, unedited:

- `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL.md` / `resolver-v3-039-controlled-live-protocol.json`
  (v1 — invalidated for the Phase-B continuation defect, `RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`)
- `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V2.md` / `resolver-v3-039-controlled-live-protocol-v2.json`
  (v2 — invalidated for the execution-tree-hash defect documented here)

Zero provider calls occurred under either v1 or v2, so both are preserved as invalidated
**pre-execution** history, not executed-and-discarded evidence. A new executable protocol version is
introduced:

```
resolver-representative-hybrid-live-protocol-v3
```

with corresponding Markdown and JSON artifacts:

- `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V3.md`
- `reports/resolver-v3-039-controlled-live-protocol-v3.json`

The live CLI (via the harness's `verifyRepresentativeHybridV1LiveProtocolV3`) refuses any
`protocolVersion` other than the exact v3 literal, rejecting v1 and v2 documents by construction —
proven directly by `RepresentativeHybridV1LiveProtocolV3.test.ts`'s "rejects protocol v1"/"rejects
protocol v2"/"accepts a valid protocol v3 document" tests. Current execution instructions
(`RepresentativeHybridV1LiveVersions.ts`'s comments, the CLI's header docstring and `--help` output,
this remediation report) reference protocol v3 only for any future live execution.

### 6.1 Preserved unchanged

Corpus and registry, corpus hash, source-manifest and hash, plan and plan hash, call population and
partitions, provider/model, prompt/schema, pricing, retries/timeouts, budget ceilings, the
cumulative ledger/checkpoint design and partitions, and production resolver behavior are all
**byte-identical** to protocol v2 — verified directly by
`RepresentativeHybridV1LiveProtocolV3.test.ts`'s "corpus, source-manifest, and plan hashes are
byte-identical between protocol v2 and protocol v3" test, and by the full unchanged
`representativeHybridV1/**` regression suite (§9) passing without modification to any corpus,
checkpoint, ledger, or cumulative-budget file.

### 6.2 v3 hash, frozen after final content

The v3 `executionTreeHash` was computed **only after** every execution-relevant implementation file
listed in §5.1 reached its final content in this diff (all source edits completed, then the hash was
computed, then written into the v3 JSON/MD — never the reverse):

```
executionTreeHash:          9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f
algorithmVersion:           representative-hybrid-v1-live-execution-tree-hash-algorithm-v3
```

## 7. Windows discipline

No Prettier run was performed across the CRLF-converted working tree; `npm run format:check` (part
of `npm run verify`, §9) was run against exactly the files changed in this diff, not the whole
checkout. No mass line-ending change was made or committed — `git diff --check` (§9) confirms no
whitespace/line-ending errors were introduced, and `git status --short` (§10) shows only the files
explicitly listed in this document, no repository-wide re-normalization. No isolated LF worktree was
required: all new/changed files were authored directly by this session's edit tools (which write
`\n`-only content), and Windows CRLF working-tree conversion is now handled correctly (canonicalized
away) by the v3 hash algorithm itself rather than needing to be avoided at the filesystem level.

Local verification (typecheck, focused tests, full test suite, `npm run verify`) ran on this
environment's Node **v22.15.0**. The repository's `.nvmrc` pins `20` and `package.json`'s `engines`
field requires `"node": ">=20"`; no Node 20 binary or version manager (`nvm`/`fnm`/`volta`) was
present on this machine, and installing a new Node version was judged out of scope for a zero-call,
minimal-footprint remediation task. Node 22 satisfies the `>=20` `engines` constraint, so this is
recorded as a disclosed environment deviation, not a silent substitution — no test, lint, or
typecheck behavior in this diff is Node-20-specific.

## 8. Required tests (all added, all passing)

All 14 required proofs, added across
`RepresentativeHybridV1LiveExecutionTreeHash.test.ts` (extended, 15 tests, was 7) and
`RepresentativeHybridV1LiveProtocolV3.test.ts` (new, 13 tests):

| #   | Requirement                                                                                    | Test                                                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | LF and CRLF representations produce the same hash                                              | "CRLF and LF representations of the same logical text produce the same hash"                                                                                                                                                      |
| 2   | Lone CR fails closed                                                                           | "a lone CR (not part of a CRLF pair) fails closed" + `canonicalizeRepresentativeHybridV1LiveExecutionTreeText` unit test                                                                                                          |
| 3   | Input file order does not affect the hash                                                      | "is deterministic and independent of input ordering"                                                                                                                                                                              |
| 4   | Path changes affect the hash                                                                   | "changes when only the path changes, content held constant"                                                                                                                                                                       |
| 5   | Content changes affect the hash                                                                | "changes when any single file content changes by one byte"                                                                                                                                                                        |
| 6   | Missing files fail closed                                                                      | "throws if an execution-relevant file is missing"                                                                                                                                                                                 |
| 7   | Committed v3 protocol hash equals a fresh computation over the real repository tree            | **"THE REGRESSION TEST"** in `RepresentativeHybridV1LiveProtocolV3.test.ts` — the exact check PR #137 was missing                                                                                                                 |
| 8   | Simulated Windows CRLF checkout and canonical LF content reproduce the same committed v3 value | "simulated Windows CRLF checkout and canonical LF content reproduce the same hash from the real repository tree"                                                                                                                  |
| 9   | Protocols v1 and v2 are rejected                                                               | "rejects protocol v1" / "rejects protocol v2" (+ "rejects any protocolVersion other than the exact v3 literal")                                                                                                                   |
| 10  | Protocol v3 is accepted                                                                        | "accepts a valid protocol v3 document matching current state"                                                                                                                                                                     |
| 11  | Changing any execution-tree file invalidates v3                                                | "changing any real tracked execution-tree file (simulated) invalidates the hash"                                                                                                                                                  |
| 12  | Existing cumulative-budget/ledger/checkpoint/indeterminate-call protections remain intact      | full pre-existing `representativeHybridV1/**` suite (208 tests) passes unmodified, §9                                                                                                                                             |
| 13  | No provider transport is called during any remediation test                                    | every new/changed test uses fixtures/JSON/pure functions only — no `VariantBProvider`/`VariantCAiInterpreter`/transport construction; `RepresentativeHybridV1LiveIsolation.test.ts`'s repo-wide scans continue to pass unmodified |
| 14  | Corpus, source-manifest, and plan hashes remain unchanged                                      | "corpus, source-manifest, and plan hashes are byte-identical between protocol v2 and protocol v3"                                                                                                                                 |

## 9. Verification results

Run on this branch (`fix/resolver-v3-039-execution-tree-hash`), Node v22.15.0:

1. `npm run typecheck` — **0 errors**.
2. `npm run lint` — **0 errors**.
3. Focused: `npx jest --testPathPattern="representativeHybridV1" --runInBand` —
   **229/229 tests, 27/27 suites, green** (208 pre-existing tests, unchanged, + 21 new: 8 added to
   `RepresentativeHybridV1LiveExecutionTreeHash.test.ts`, 13 in the new
   `RepresentativeHybridV1LiveProtocolV3.test.ts`).
4. Full suite: `npx jest --runInBand` — **2300/2300 tests, 236/236 suites, green**
   (2279/2279-suite baseline recorded by the immediately prior queue handoff, + 21 new, 0 broken).
5. `npm run format:check` (`prettier -c .`) — every file this diff creates or modifies passes
   individually (`prettier -c <the 10 new/fully-authored files>` → "All matched files use Prettier
   code style!"). The repository-wide `npm run verify` run still reports pre-existing formatting
   warnings across ~605 files unrelated to this diff (confirmed: every one of those paths already
   fails `prettier -c` on a clean checkout of this branch's base commit, before any change in this
   diff) — a pre-existing Windows `core.autocrlf=true` checkout condition, not something this task's
   scope authorizes fixing via a repository-wide `prettier --write` (see §7). `ROADMAP.md` and
   `handoffs/latest-handoff.md` were edited in place and still show as CRLF-affected locally (they
   were already in that pre-existing state before this diff); `git --no-pager diff` on both shows
   pure content insertions with zero `\r` bytes in the diff output, confirming Git's `clean` filter
   normalizes the actual committed blob to LF exactly like every other tracked file, independent of
   the local working-tree display.
6. `git --no-pager diff --check` — **exit 0, clean** (only informational
   "LF will be replaced by CRLF" `autocrlf` notices on next checkout, not errors).
7. `git --no-pager status --short` / `--diff --stat` / `--diff --name-only` — see §10.

## 10. Exact changed files

New:

- `reports/RESOLVER_V3_039_CONTROLLED_LIVE_PROTOCOL_V3.md`
- `reports/resolver-v3-039-controlled-live-protocol-v3.json`
- `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md` (this document)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveProtocolVerification.ts`
- `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/RepresentativeHybridV1LiveProtocolV3.test.ts`

Modified (in place, git history preserved):

- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveExecutionTreeHash.ts`
  (v2 → v3 canonicalization algorithm; 20 → 26 tracked paths)
- `src/features/nutrition/benchmark/representativeHybridV1/live/RepresentativeHybridV1LiveVersions.ts`
  (additive: new `REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3` constant alongside the
  unmodified v1/v2 ones)
- `src/features/nutrition/benchmark/representativeHybridV1/live/runRepresentativeHybridV1Live.harness.ts`
  (uses the extracted `verifyRepresentativeHybridV1LiveProtocolV3` and the v3 protocol-version
  constant; two-phase Development/Holdout/checkpoint/ledger orchestration logic itself unchanged)
- `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs` (comments/help text/error messages
  updated to reference protocol v3; flag-parsing behavior unchanged)
- `src/features/nutrition/benchmark/representativeHybridV1/live/__tests__/RepresentativeHybridV1LiveExecutionTreeHash.test.ts`
  (extended: 7 → 15 tests)

Explicitly unchanged: every RESOLVER-V3-038 corpus/registry/manifest/hash file, `learningV2/**`,
protocol v1's and v2's own four/two documents, all checkpoint/ledger/cumulative-budget/report-
builder/metrics source files, `VariantBLiveProvider.ts`, `VariantCLiveInterpretationProvider.ts`,
`LiveProviderBudgetGate.ts`, `package.json`, `package-lock.json`, any migration, any Supabase
adapter, any DI/container file, any feature flag, any production resolver code.

## 11. No-production-effect statement

No production DI/container registration, feature flag, database migration, RPC, Supabase adapter, or
UI/journal change was made. Every changed/new source file lives under
`src/features/nutrition/benchmark/representativeHybridV1/live/**`, `scripts/**`, or `reports/**`.
`package.json`/`package-lock.json` are untouched (`git status --short` confirms). This is
additionally proven by `RepresentativeHybridV1LiveIsolation.test.ts`'s existing "no production
DI file imports the live module tree" scan, which covers every file in this diff since it walks the
real `src/` tree.

## 12. Final status

- **RESOLVER-V3-039 remains `in_progress`** — this remediation corrects the execution-tree-hash
  defect and freezes a corrected, cross-platform-reproducible protocol v3; it collects no live
  evidence itself and does not, by itself, complete the task.
- **RESOLVER-V3-041 remains `todo`, not started.**
- **RESOLVER-V3-010 remains `blocked`.**
- **RESOLVER-V3-038 and RESOLVER-V3-040 remain `done`, unmodified.**
- Zero Anthropic API/provider requests occurred at any point in this remediation. Zero benchmark
  cost was incurred. `Development` and `Holdout` were not run.
