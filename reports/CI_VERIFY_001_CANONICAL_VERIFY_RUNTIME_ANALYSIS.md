# CI-VERIFY-001 — Canonical Verify Runtime Analysis

Date: 2026-07-26

Base: `b2b7e196ab992b8b7f46f626cbf991fbff8ae304` (PR #181 merge)

Status: **INCONCLUSIVE / workflow retained**

## Executive decision

No workflow optimization is accepted in this change. `.github/workflows/verify.yml` remains the
single `verify` job and still runs `npm ci --ignore-scripts` followed by `npm run verify`;
`package.json` still runs Jest with `--runInBand`. This is the fail-safe result required when a
material improvement cannot be proved. It preserves the existing required-check identity and all
four checks without increasing runner use or introducing a classification/aggregation failure mode.

## Baseline availability

The task supplied these authoritative facts: PR #181 is merged at the base above, Verify run #323
was green before it, and Verify run #325 was green for the merge. Exact run/job/step durations and
logs could not be retrieved: this checkout has no `origin`, `gh` is absent, no credentials were
read, and the unauthenticated GitHub Actions API returns 404 for this private repository. Therefore
the requested GitHub wall-clock, checkout/setup, install, typecheck, lint, format, Jest, runner-minute,
and log-byte baseline is **not measurable here** and is not fabricated.

The durable workflow baseline is:

1. checkout (`actions/checkout@v4`);
2. Node setup with npm cache (`actions/setup-node@v4`, `.nvmrc`);
3. `npm ci --ignore-scripts`;
4. sequential `npm run verify`: typecheck, lint, repository-wide Prettier, Jest `--runInBand`.

## Controlled local variants

Commands were bounded with `timeout`; a timeout is reported as a failed experiment, never a pass.

| Variant                                                       | Result                               |         Wall clock | Coverage evidence                                     | Finding                                                                                                    |
| ------------------------------------------------------------- | ------------------------------------ | -----------------: | ----------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Existing `npm test` / `--runInBand` with JSON instrumentation | interrupted after late suites passed | >4 min observation | no final summary                                      | reproduced noncompletion; JSON itself increases retained log data and is unsuitable timing instrumentation |
| `--maxWorkers=2 --silent --json`                              | interrupted                          |             >4 min | late OFF/USDA suites visibly passed, no final summary | no safe win; JSON retention confounds memory                                                               |
| `--maxWorkers=2 --silent`                                     | interrupted                          |             >4 min | incomplete                                            | both workers remained CPU-active with ~0.68/0.70 GiB RSS; local resource contention is material            |
| `--runInBand --shard=1/2 --silent --json`                     | pass                                 |           83.248 s | 123 suites / 1,215 tests                              | fast half, deterministic suite assignment                                                                  |
| `--runInBand --shard=2/2 --silent --json`                     | timeout (124)                        |          600.023 s | no final summary                                      | unacceptable imbalance/noncompletion; two-job wall clock would be governed by this shard                   |
| isolated OFF + USDA with `--detectOpenHandles`                | pass                                 |           12.632 s | 2 suites / 14 tests                                   | no open handle reported and no real provider call; repeated output comes from mocked retries               |

The shard-1/shard-2 union is Jest's deterministic 2-shard partition, but shard 2 did not complete,
so this is not a full-suite pass and cannot serve as an exactly-once acceptance proof. The prior
canonical merged evidence remains run #325, as supplied by the task.

## Candidate assessment

### A — Jest parallelism

`--runInBand` was not removed blindly. Two workers did not yield a completed local comparison and
substantially increased concurrent memory. Percentage workers would be sensitive to runner CPU
topology and offers less deterministic capacity than an explicit worker count. Native two-shard
allocation was extremely imbalanced. None is accepted without repeated green PR runs and suite-set
comparison.

### B — separate static/shard jobs plus `verify` aggregator

The proposed shape can preserve branch protection only if the final job remains named `verify`,
runs with `if: always()`, and explicitly accepts only `success` for every required dependency;
failure, cancellation, or skip must fail it, with no `continue-on-error`. It would require three
dependency installations (static plus two shards), so summed runner-minutes could rise even if
wall clock falls. Because neither GitHub timing nor a balanced complete shard result is available,
the design is rejected for now. Aggregator success/failure tests are consequently not applicable to
the unchanged workflow rather than falsely reported as passed.

### C — documentation-only path

A safe classifier must diff the event's exact base/head SHAs, fail closed on an empty/ambiguous
range, and allow only an explicit documentation allowlist. At minimum `src/**`, `scripts/**`,
`supabase/**`, `.github/**`, package/lock files, Jest/TypeScript/ESLint configs, generated artifacts,
and benchmark corpora must force the full path. The fast path would still need checkout, changed-file
classification, Prettier/Markdown checks for affected files, `git diff --check`, and workflow/
structure validation. No classifier is introduced because its positive/negative tests cannot prove
GitHub event/merge-base behavior without a real PR run. Thus no product change can currently be
misclassified: the existing full workflow always runs.

### D — duplicate PR/push execution

The current push trigger is retained. Branch-protection, required-check, merge-queue, and default-
branch update semantics could not be inspected reliably. Removing the post-merge/default-branch run
without that evidence would weaken confidence.

### E — OFF/USDA lifecycle

The isolated provider suites use mocked `functions.invoke` calls and passed under
`--detectOpenHandles` without an open-handle report. Their 14 tests intentionally exercise retry
paths, which explains repeated `ABOUT_TO_INVOKE`/failure console messages and roughly 12.6 seconds
of runtime. This rules out those two files as a demonstrated standalone open-timer or accidental
network defect; it does not explain the accumulated full-process noncompletion. No global
`--forceExit`, timeout reduction, provider call, or product change was used. Residual defect:
full-suite process/resource behavior requires profiling in an environment that can finish and
capture per-suite heap/open-handle data without JSON log retention.

## Wall clock and runner minutes

| Metric                              | Before                               | After                                 |
| ----------------------------------- | ------------------------------------ | ------------------------------------- |
| GitHub PR required-check wall clock | unavailable (runs #323/#325 private) | unchanged; pending a real PR run      |
| summed GitHub runner-minutes        | unavailable                          | unchanged architecture; no multiplier |

There is deliberately no invented percentage. The accepted code path has zero architectural
runner-minute increase and zero proved wall-clock decrease; CI-VERIFY-001 therefore remains
`in_progress`.

## Required-check compatibility and risks

Workflow name `Verify`, job/check name `verify`, triggers, permissions, concurrency, dependency
installation, and canonical `npm run verify` entrypoint are unchanged. Remaining risks are the
missing authenticated baseline, absent real PR candidate timing, and unresolved local full-Jest
noncompletion. The next safe experiment should first add non-retentive per-command timing on a PR,
then compare repeated candidates against the same base while recording both critical-path seconds
and summed job seconds.
