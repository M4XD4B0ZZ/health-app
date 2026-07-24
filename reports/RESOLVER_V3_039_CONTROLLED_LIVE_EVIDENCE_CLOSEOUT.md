# RESOLVER-V3-039 — Controlled Representative Live Hybrid Evidence: Closeout

Task ID: RESOLVER-V3-039
Status: **done** (evidence-collection objective complete and validated). This closeout does **not**
mean the Hybrid production gate passed, and it does **not** perform the RESOLVER-V3-041
gate re-decision — see §17.

## 1. Task objective

Collect real, live-provider (Anthropic) evidence for the representative-hybrid Variant B/Variant C
benchmark under a controlled, budget-bounded, two-phase (Development → inspect → Holdout) protocol,
with durable, tamper-evident accounting of every paid call — so that a later, separate task
(RESOLVER-V3-041) can make an evidence-backed production-wiring decision. This task's own scope ends
at collecting and validating that evidence, not at deciding whether Hybrid C ships.

## 2. Why protocols v1 and v2 were invalidated before execution

- **Protocol v1**: a pre-execution review of the documented Development → inspect → Holdout workflow
  found it could not safely execute as written — the documented Holdout command was refused once
  Development's fixed-path output existed, and the only two workarounds were both unsafe (one
  silently discarded Development's evidence; the other either skipped the required inspection
  boundary or risked repeating billed Development calls). Budget enforcement was also process-local
  (a fresh full ceiling per CLI process invocation), and paid-call evidence was not durable during
  execution. Found and fixed at zero cost, before any paid request — protocol v1 was never executed
  (`actualUsage.calls: 0`, `rawTelemetry: []` in its preserved artifact).
- **Protocol v2**: replaced v1's architecture with a durable checkpoint, a tamper-evident append-only
  call ledger, and cumulative-budget reconstruction across process invocations. Before any paid
  request under v2, a zero-network local preflight independently re-derived every hash in the frozen
  protocol-v2 document and found its `executionTreeHash` reproduced from **neither** a canonical LF
  Git-content computation over the freeze commit's tree **nor** this Windows environment's CRLF
  working-tree computation. Root cause: the v2 hash implementation read working-tree files with no
  line-ending normalization, making it a function of the checkout platform rather than logical
  content; no test ever compared a fresh computation against the frozen literal. Protocol v2 was
  never executed either — zero paid calls occurred under it.
- **Protocol v3** (used for all live execution below) fixed the hash defect: canonicalizes CRLF→LF,
  fails closed on any lone CR, tags the hashed payload with an explicit algorithm version, and tracks
  4 additional execution-relevant files v2 omitted. A regression test
  (`RepresentativeHybridV1LiveProtocolV3.test.ts`) now asserts the frozen literal equals a fresh
  computation over the real repository tree — the exact check neither v1 nor v2 ever had. Full
  analysis in `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md` (v1→v2) and
  `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md` (v2→v3).

## 3. Protocol-v3 identity

- Protocol version: `resolver-representative-hybrid-live-protocol-v3`
- Provider: `anthropic`; model alias `claude-haiku-4-5`; model snapshot `claude-haiku-4-5-20251001`
- `executionTreeHash`: `9697e45b149ba2a90115e388a5caeca173aab76c8f5f88f31c5bfc1e136e235f`
- `corpusHash`: `f90eda47d2577de4e41bce1cd77558d0422cd122e66797f91b9b27e8eec17d3a`
- `sourceManifestHash`: `11eebb0e585d5046303a70ec84441049373e0d1656e666787132e5067331fc52`
- `planHash`: `214fa7f706e62fba479f004b9a04f60d364006e9830447f5f79a21a622f7095e`

## 4. Exact execution commit

`a67a4d051fd1616cad3a59428b117a717d84f002` — recorded in both checkpoints and the final report as
`executionCommit`/`evidenceCommit`, and independently re-verified as this closeout's own worktree
`HEAD` and the live remote default-branch tip before any staging occurred.

## 5. Development execution

- Ran **exactly once** (a completed checkpoint already existing is refused by the harness; only one
  `logs/resolver-v3-039-development-checkpoint.json` exists, confirmed by file-inventory check).
- Exit code: `0`.
- Finish time: `2026-07-24T15:04:00.4650109Z` (launcher); checkpoint `generatedAtUtc`
  `2026-07-24T15:04:00.152Z` — consistent (checkpoint written just before process exit).
- 205 planned calls; 194 completed; 11 terminal failures; 0 indeterminate.

## 6. Development inspection gate

Development's own diagnostic report (`logs/resolver-v3-039-development-diagnostic.json`/`.md`) was
generated and written to disk before Holdout was permitted to run — the harness independently
requires and validates the Development checkpoint (protocol/plan/corpus/execution-tree/provider/
pricing identity, plus every planned call accounted for) before constructing any Holdout budget gate
or provider. This inspection boundary is what protocol v1 could not safely provide (§2).

## 7. Holdout execution

- Ran **exactly once** (a completed Holdout checkpoint or an existing final report both refuse a
  second Holdout run; only one `logs/resolver-v3-039-holdout-checkpoint.json` and one final report
  pair exist).
- Exit code: `0`.
- Finish time: `2026-07-24T17:32:10.7873322Z` (launcher); Holdout checkpoint `generatedAtUtc`
  `2026-07-24T17:32:10.443Z`; final report `generatedAt` `2026-07-24T17:32:10.514Z` — all three
  consistent with a single execution.
- 58 planned calls; 53 completed; 5 terminal failures; 0 indeterminate.

## 8. Final official Node-v20 validation

Repeated independently for this closeout, under the portable Node `v20.20.2` / npm `10.8.2`
install, using only official repository validators (no manual reimplementation):
`buildRepresentativeHybridV1LiveExecutionPlan`, `computeCurrentRepresentativeHybridV1LiveExecutionTreeHash`,
`verifyRepresentativeHybridV1LiveProtocolV3`, `readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint`,
`readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent`, `RepresentativeHybridV1LiveCallLedger.open`,
`computeRepresentativeHybridV1LivePlannedCallIds`, `reconstructRepresentativeHybridV1LiveCumulativeBudgetGate`,
`assertValidRepresentativeHybridV1LiveReport`. Because `CallLedger.open()` can append recovery entries
on load (write-capable), the ledger was copied to an external temp directory outside the repository
first, and only the copy was opened — never the original. A temporary, untracked Jest test performed
the run and was deleted immediately afterward; SHA-256 of all seven evidence files was recorded
before and after and found byte-identical.

**Result: `FINAL_EVIDENCE_VALID_READY_FOR_RESOLVER_V3_039_CLOSEOUT`.** Every figure in this report was
independently recomputed from the actual evidence files in this task, not assumed from a prior
session's output.

## 9. Evidence-artifact inventory

Exactly seven original generated evidence files, all under `logs/` (gitignored by default;
force-added for this closeout only):

| Path                                                                | Role                                              |
| ------------------------------------------------------------------- | ------------------------------------------------- |
| `logs/resolver-v3-039-call-ledger.jsonl`                            | append-only tamper-evident call ledger (789 rows) |
| `logs/resolver-v3-039-development-checkpoint.json`                  | durable Development checkpoint                    |
| `logs/resolver-v3-039-development-diagnostic.json`                  | Development-only diagnostic report (JSON)         |
| `logs/resolver-v3-039-development-diagnostic.md`                    | Development-only diagnostic report (Markdown)     |
| `logs/resolver-v3-039-holdout-checkpoint.json`                      | durable Holdout checkpoint                        |
| `logs/resolver-v3-039-controlled-representative-live-evidence.json` | final combined report (JSON, authoritative)       |
| `logs/resolver-v3-039-controlled-representative-live-evidence.md`   | final combined report (Markdown summary)          |

`logs/resolver-v3-039-preflight.json` (a pre-execution, zero-network, zero-cost artifact from an
earlier protocol-v3 preflight tick) is deliberately **not** included — it is not part of the frozen
evidence contract's seven-file set.

## 10. File-level SHA-256 manifest reference

See [`reports/resolver-v3-039-controlled-live-evidence-manifest.json`](resolver-v3-039-controlled-live-evidence-manifest.json)
for the deterministic, machine-checkable path/role/byte-size/SHA-256 record of all seven files, plus
call-accounting, cost-classification, and reservation-budget totals.

## 11. Full call accounting

- Frozen task ceiling, recomputed fresh from the execution plan: **263 paid calls**.
- Development planned: 205. Holdout planned: 58. 205 + 58 = 263.
- Variant B: 108 Development / 28 Holdout (136 total).
- Variant C AI-routed (billed): 97 Development / 30 Holdout (127 total).
- Variant C fast-path (deterministically local, never billed): 12 total.
- 136 + 127 = 263 — matches the ceiling exactly.
- Ledger: 789 total rows = exactly 263 × 3 (one `reserved`, one `dispatched`, one terminal row per
  call — verified structurally, zero malformed transition sequences). 263 unique call IDs; zero
  unknown/out-of-plan call IDs; zero duplicates.
- Retry count: 0 (protocol makes zero automatic retries by design).

## 12. Ledger integrity and zero-indeterminate result

`RepresentativeHybridV1LiveCallLedger.open()` (run only against an external copy, per §8) validated
ledger schema version, sequence continuity, `prevEntryHash` chain, and every `entryHash` on all 789
rows without throwing. Zero calls are `indeterminate_after_interruption` — no evidence of an
interrupted process, and (since `.open()` would have appended recovery rows had any call been left
`reserved`/`dispatched` at load time, which would have changed the row count away from the exact
263×3 structural total) no evidence of a second Development or Holdout execution.

## 13. Terminal-failure accounting (16 total, none relabeled)

- **8 records with `httpStatus=null`, unknown usage, `network_error`**: 5 in Development
  (`RH-RES-BRANDED-DEV-001` ×2 variants, `RH-RES-COMPOSED-DEV-006`, `RH-RES-OVERLAY-DEV-006`,
  `RH-RES-PREPARATION-DEV-005`), each at **~15,000–15,016 ms** end-to-end latency — consistent with
  the 15-second per-request timeout ceiling. 3 in Holdout (`RH-RES-HOUSEHOLD-HOLD-001` at ~15,006 ms;
  `RH-RES-HOUSEHOLD-HOLD-002` and `RH-RES-PREPARATION-HOLD-002` at ~10,281 ms each — a genuinely
  different latency shape from the timeout-bound Development records, reported as observed rather
  than folded into the same bucket).
- **8 records with `httpStatus=200`, reported usage/cost, still terminal `network_error`**: 6 in
  Development (`RH-RES-HOMEMADE-DEV-004`, `RH-RES-UNRELIABLE-DEV-003`, `RH-RES-VAGUE-DEV-003/004/005/006`)
  and 2 in Holdout (`RH-RES-VAGUE-HOLD-001/002`) — all **Variant C**, consistent with Variant C's
  classifier mapping any `outcome === 'error'` to `network_error` regardless of HTTP status (an
  HTTP-200 response with billed usage that failed at parse/interpretation time, not at the transport
  level).
- Exact failure subtype (e.g., which parse/schema step failed) is **not stored** in preserved
  evidence beyond `providerStatus`/`httpStatus`/usage fields — reported as **exact subtype unknown
  from preserved evidence**, not inferred or relabeled.
- `technicalFailureCount: 16` in the final report matches the ledger's terminal-failure count
  exactly; all 16 are protocol-compliant (ledgered, honestly represented, reflected in gate
  evaluability decisions) and do not, by themselves, invalidate the evidence.

## 14. Usage and cost evidence classification

| Scope       | records | reported usage | unknown usage | input tok | output tok | known-cost subtotal | unknown cost |
| ----------- | ------- | -------------- | ------------- | --------- | ---------- | ------------------- | ------------ |
| Development | 205     | 200            | 5             | 362,427   | 75,831     | $0.741582           | 5            |
| Holdout     | 58      | 55             | 3             | 98,594    | 19,398     | $0.195584           | 3            |
| Combined    | 263     | 255            | 8             | 461,021   | 95,229     | **$0.937166**       | 8            |

**USD 0.937166 is a provider-reported _known-cost subtotal_, not the complete actual cost.** 8
records (the `httpStatus=null` terminal failures, §13) have unknown usage and unknown cost, which is
never converted to zero. The complete provider API cost for this task **remains unknown** absent
separately supplied Anthropic Console billing evidence covering the exact workspace, key, and
execution window — **no such external billing evidence has been supplied for this closeout.** This
benchmark cost figure does not include, and must not be confused with, any unrelated Claude
Code/API spending from earlier development sessions on this repository.

## 15. Reservation-budget result

Cumulative budget gate, reconstructed by replaying the ledger through the real
`LiveProviderBudgetGate`: 263/263 calls, 2,154,496/2,154,496 input tokens,
403,968/403,968 output tokens, reserved cost **USD 4.174336** (the task-authorized ceiling —
consumed exactly, 0 remaining), `inFlight` 0. The maintainer's **USD 5.00** ceiling was respected
(4.174336 < 5.00) throughout.

## 16. Final stored quality/latency/cost gate dimensions

| Gate                               | Verdict       |
| ---------------------------------- | ------------- |
| G2-A Representative quality        | passed        |
| G2-B False confidence              | **failed**    |
| G2-C User friction                 | passed        |
| G2-D Latency                       | **failed**    |
| G2-E Cost                          | not_evaluable |
| G2-F Provenance/nutrient authority | passed        |
| G2-G Consistency                   | passed        |

These are the frozen evidence's own stored verdicts, reported exactly as stored — not recomputed,
not re-decided.

## 17. Explicit scope boundary

- RESOLVER-V3-039 **collected and validated** live-provider evidence end to end (Development →
  inspection → Holdout → final combined report), under a corrected, reproducible protocol.
- It did **not** pass the production-wiring gate: two of seven gate dimensions above are `failed`
  (G2-B, G2-D), and one is `not_evaluable` (G2-E). This evidence, by itself, does not authorize
  wiring Hybrid C (Variant C) into production.
- It did **not** perform the RESOLVER-V3-041 gate re-decision. That is a separate, not-yet-started
  task whose job is to weigh this evidence (including its failed/not_evaluable dimensions) and make
  an explicit production-wiring decision. Marking RESOLVER-V3-039 `done` here reflects only that its
  own evidence-collection objective is complete and validated.

## 18. No-fixture-fallback proof

Live B/C providers were constructed exclusively via `createLiveVariantBProvider`/
`createLiveVariantCInterpreter`, which throw a config error before any network call when
`ANTHROPIC_API_KEY` or the shared budget gate is missing. Neither `FixtureVariantBProvider`/
`NoopVariantBProvider` nor `FixtureCostAiInterpreter`/`NoopAiInterpretationProvider` was ever passed
into the live runner — verified both by the final report's own `noFixtureFallbackProof` field and by
independent code inspection of `runRepresentativeHybridV1Live.harness.ts`.

## 19. No-production-effect statement

This closeout added exactly four repository artifacts: this report, the evidence manifest, and
updates to `ROADMAP.md`/`handoffs/latest-handoff.md`, plus force-adding the seven pre-existing,
gitignored evidence files. No production DI registration, feature flag, migration, RPC, Supabase
adapter, UI/journal file, resolver source file, protocol/harness source file, or dependency file was
created, modified, or deleted. No production resolver behavior changed.

## 20. Credential-handling statement

`ANTHROPIC_API_KEY` presence was checked as a **boolean only**, at the start of this closeout and
previously at the start of the validation this closeout re-confirms; it was **absent** both times.
Its value was never printed, inspected, hashed, copied, requested, or persisted at any point in this
task. No Anthropic API/provider request occurred during this closeout — zero additional benchmark
cost was incurred by this task itself.

## 21. Known limitations

- Complete provider API cost remains unknown (§14) — 8 of 263 records have unknown usage/cost, and
  no external Console billing export has been supplied for this closeout.
- Exact terminal-failure subtypes beyond `providerStatus`/`httpStatus`/usage fields are not
  preserved in evidence (§13).
- G2-B (false confidence) and G2-D (latency) are stored as `failed`; G2-E (cost) is `not_evaluable`.
  These are evidence facts to be weighed by RESOLVER-V3-041, not defects in this closeout.
- The local LF execution worktree/branch are retained as a secondary copy (see repository-level
  handoff) pending independent post-merge verification and later maintainer-authorized cleanup.

## 22. Closeout reason

All required validation passed independently and reproducibly under Node v20.20.2, with zero
provider calls and zero additional cost; all seven evidence artifacts are byte-identical
before/after every validation pass; the evidence is durably versioned on the execution branch and
committed, ready to be pulled into the default branch. There is nothing further for
RESOLVER-V3-039's own evidence-collection/validation/documentation work to do — only the mechanical
PR/merge step below remains, and it is blocked on GitHub access, not on anything about the evidence.

## 23. Successor

**RESOLVER-V3-041 remains `todo`, not started.** It is responsible for weighing this evidence
(including its failed/not_evaluable gate dimensions) and making the production-wiring re-decision.
`RESOLVER-V3-010` remains `blocked` on that re-decision.

## Addendum (2026-07-24): PR/merge outstanding — GitHub currently unreachable for PR creation

All work above (validation, evidence commit, push) is complete and durably recorded. **The PR from
`resolver-v3-039-v3-live-evidence-lf` into `chore/clean-arch-structure` has not been opened or
merged yet** — GitHub is currently unable to accept a PR creation from this environment (observed:
the registered GitHub MCP server returned `Authentication Failed: Bad credentials`, its backing
`GITHUB_PERSONAL_ACCESS_TOKEN` environment variable is unset, and no `gh` CLI is installed here as
a fallback). This is an access/tooling problem on the GitHub side of this environment, not a defect
in the evidence or in this closeout's own work — every commit named in this report already exists,
pushed, on the remote.

**State at the time of this addendum:**

- Local worktree: `D:\Workspaces_VSCode\HealthApp-resolver-v3-039-v3-lf` (retained — do not delete).
- Branch: `resolver-v3-039-v3-live-evidence-lf`, pushed to `origin`.
- Evidence commit: `9fff93a7d31aa8a37983a891b2bbd5e6f72b02ce` (the 11-file closeout commit described
  throughout this report), plus this addendum commit on top of it.
- No PR exists yet on `github.com/M4XD4B0ZZ/health-app`.

**Instructions for whichever agent picks this up next:**

1. Do **not** re-run Development or Holdout, do **not** modify any of the seven evidence files, and
   do **not** rebase this branch before the evidence commit (`9fff93a7d3…`) — the evidence's
   validity is tied to that exact commit's tree.
2. Confirm a working authenticated GitHub path exists first (e.g. a successful
   `mcp__github__get_pull_request`-style read call, or `gh auth status`) — do not assume the prior
   failure has resolved itself without checking.
3. Open the PR: `resolver-v3-039-v3-live-evidence-lf` → `chore/clean-arch-structure`. Title/body can
   reuse the draft already prepared in this task's own conversation history, or be regenerated from
   this report's §§9–19.
4. Let required CI complete; resolve only genuine defects; never alter the seven original evidence
   files to satisfy cosmetic feedback.
5. If the default branch has advanced in the meantime: do not rerun or rewrite evidence, do not
   auto-rebase/merge changes touching the protocol-v3 execution-tree boundary; inspect the
   intervening diff and proceed only once GitHub reports the merge as clean and the evidence remains
   explicitly tied to execution commit `a67a4d051fd1616cad3a59428b117a717d84f002`.
6. Merge when checks are green and no actionable comments remain — no pre-merge maintainer review is
   required per this task's own instructions.
7. After merge, perform the independent post-merge review already specified for this task (fetch the
   merged tip; re-verify all seven blobs byte-for-byte against
   `reports/resolver-v3-039-controlled-live-evidence-manifest.json`; confirm no product/protocol
   source changed; confirm `RESOLVER-V3-039` reads `done`, `RESOLVER-V3-041` reads `todo`,
   `RESOLVER-V3-010` reads `blocked`; confirm no evidence path is duplicated; confirm no secret was
   committed).
8. Update this report, `ROADMAP.md`, and `handoffs/latest-handoff.md` with the final PR number and
   merge commit once merged.
9. Do **not** start RESOLVER-V3-041 as part of finishing this mechanical step.
