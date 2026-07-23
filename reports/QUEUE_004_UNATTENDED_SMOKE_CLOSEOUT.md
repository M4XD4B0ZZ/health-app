# QUEUE-004 Unattended Smoke — Closeout Report

Final report for the unattended portion of `QUEUE-004 — Smoke Evaluation and Hardening`.
Verdict: **`GITHUB_ACTIONS_CONTROLLER_JUSTIFIED`**.

## 1. Test purpose

Prove or disprove that the Claude Queue — GitHub Issues driven by the `queue-run` skill, with
PR-activity subscriptions and native scheduled wake-ups, and no custom controller — can survive a
genuine multi-hour unattended gap: resume through scheduled wake-ups without chat memory, notice
quiet green CI without user prompting, complete one task fully before its dependent task, and
finish with no human interaction during the test window.

## 2. Exact start state and timestamps

- Canonical branch: `chore/clean-arch-structure`; start commit `21fba2e` (merge of PR #147,
  the QUEUE-004 documentation-hardening PR).
- `testStartedAtUtc`: `2026-07-23T13:29:13Z`
- `stageBReleaseAtUtc`: `2026-07-23T17:29:13Z` (test start + 4 h; never reached before the run
  stopped)
- `testDeadlineUtc`: `2026-07-24T01:29:13Z` (test start + 12 h)
- Smoke issues created: #148 (`QUEUE-004A`, `queue:approved` immediately) at `13:29:33Z`;
  #149 (`QUEUE-004B`, deliberately unapproved, release-gated) at `13:29:46Z`.

## 3. Stage A result — lifecycle passed

`QUEUE-004A` (#148) completed the full queue lifecycle correctly:

| Step              | Evidence                                                                                                                                                             |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Claim             | State comment posted, `queue:running` → `queue:waiting-ci` labels                                                                                                    |
| Branch            | `queue/queue-004a-overnight-smoke-stage-a`, created from explicit `origin/chore/clean-arch-structure` (exactly one branch)                                           |
| Implementation    | `reports/QUEUE_004_OVERNIGHT_STAGE_A.md` + handoff entry only (allowed paths only)                                                                                   |
| Local verify      | `npm run verify` green (235 suites / 2279 tests)                                                                                                                     |
| PR                | #150 (exactly one PR), opened `13:37:14Z`                                                                                                                            |
| CI                | `verify` check run: started `13:37:20Z`, success `13:40:56Z`                                                                                                         |
| Merge             | Squash merge `c652b053e948fcb9d162472628d1cf37338b8314` at `13:41:24Z`, after green CI and zero review comments, under the issue's explicit auto-merge authorization |
| Post-merge review | Merged diff re-fetched and compared: exactly 2 files, +43/-0, matching the reviewed PR scope — no scope creep                                                        |
| Completion        | #148 closed `queue:done` at `13:41:26Z`                                                                                                                              |

No fix attempts were needed (0 of max 1). No product behavior was changed.

**However, Stage A does not count as a successful unattended multi-hour test.** It completed
entirely within the initiating interactive turn, ~12 minutes after test start. It proved the
supervised task lifecycle, not session survival or autonomous wake-up.

## 4. Stage B non-execution

`QUEUE-004B` (#149) was **never approved, never claimed, never branched, never implemented, and
never run**. Verified directly against GitHub at closeout time: the issue never carried
`queue:approved`; no branch matching the task exists on the remote; no PR references it; no
Stage B artifact exists in any tree. Stage B must not be presented as attempted, as a failed
implementation, or as completed. Issue #149 is closed `not planned` with `queue:needs-human`
recorded, superseded by a future fresh smoke after `QUEUE-005`.

## 5. Wake mechanisms attempted

1. **One-shot `send_later` chain (contract's documented fallback):** the first 15-minute arm was
   rejected before it was ever scheduled; per maintainer instruction it was not retried, because
   a manually re-armed chain inside a user-attended session would not have demonstrated
   user-independent continuation.
2. **Native recurring Routine (preferred mechanism):** tested directly with a 15-minute cadence
   (`*/15 * * * *`).
3. No overlapping timers were ever created; no timer of any kind was left armed.

## 6. Exact rejected/unsupported behavior

The recurring-Routine mechanism rejected the 15-minute cadence outright with:

```text
failed to create trigger: cron expression "*/15 * * * *" fires more frequently than once per
hour; minimum interval is 1 hour (cron interval too short)
```

The minimum supported recurring interval in this environment is **one hour**. A one-hour cadence
does not satisfy the maintainer's required ~15-minute progress-check/recovery target, so no
compliant wake mechanism could be armed.

## 7. User-intervention timeline (after test start)

| #   | Approx. time (UTC) | Intervention                                                                                                         |
| --- | ------------------ | -------------------------------------------------------------------------------------------------------------------- |
| 1   | 2026-07-23 ~13:52  | Maintainer rejected the first `send_later` arm and instructed stop                                                   |
| 2   | 2026-07-23 ~13:55  | Maintainer authorized exactly one wake-mechanism setup check (Routine test); block comment posted on #149 at `13:56` |
| 3   | 2026-07-23 (later) | Maintainer directed this closeout                                                                                    |

Longest interval without a user message during the active run: roughly the Stage A processing
window (~23 minutes, `13:29` → `13:52`). Two automatic PR-activity webhook events also arrived
(subscription confirmation; merge notice for #150) — neither was a user progress prompt, but the
merge notice arrived only after the session itself performed the merge.

## 8. Why this does not qualify as genuinely unattended

- Stage A ran inside the initiating interactive turn — no scheduled wake-up was ever exercised.
- The 4-hour Stage B release gap was never bridged by any autonomous mechanism.
- The session required maintainer messages (interventions 1–3 above) to reach a terminal state.
- Zero scheduled heartbeats fired during the entire run (`scheduled heartbeat count: 0`).

## 9. What was successfully validated

- Issue intake via the queue-task format, including a predeclared release-time gate recorded in
  the issue body.
- The approval gate (`queue:approved` required; #149 correctly stayed inert without it).
- The dependency gate (Stage B declared `QUEUE-004A` as dependency; it was never claimed).
- Branch creation from an explicit `origin/<default-branch>` ref.
- Scoped implementation (allowed paths only), local verification before PR.
- PR creation, CI observation, authorized auto-merge on green CI with no review comments.
- Independent post-merge review (merged tree diffed against reviewed scope; exact match).
- Queue completion bookkeeping (`queue:done`, state comments, handoff entry).
- Fail-closed behavior: when no compliant wake mechanism existed, the run stopped **before**
  approving or claiming Stage B, rather than degrading to manual continuation.

## 10. What remains unvalidated

- Genuine multi-hour unattended survival and resumption without chat memory.
- Autonomous detection of quiet green CI via a scheduled wake (Stage A's CI was checked directly
  in the same turn; no spontaneous CI-success event was observed, consistent with `QUEUE-003`).
- The delayed-release gate firing autonomously at its release time.
- Sequential multi-task processing across an unattended gap.
- Duplicate-work avoidance across repeated scheduled wake-ups (never exercised — no wake fired).

## 11. Final verdict

**`GITHUB_ACTIONS_CONTROLLER_JUSTIFIED`** — justified by real smoke evidence (the environment's
recurring-wake floor of one hour vs. the required 15-minute cadence), not assumed in advance.

## 12. Narrow successor architecture

The evidence justifies only a **minimal external wake layer** (`QUEUE-005` in `ROADMAP.md`): one
GitHub Actions workflow on a 15-minute schedule plus `workflow_dispatch`, a small deterministic
preflight that checks whether actionable queue work exists, and an invocation of the official
Claude Code GitHub Action only when it does. It does **not** justify rebuilding RALPH, a large
custom orchestrator, committed runtime-state files, a general workflow engine, or a proprietary
task database — GitHub Issues/branches/PRs remain the only durable state.

## 13. Cost/authentication implication

- The official Claude Code GitHub Action supports scheduled prompts.
- Direct Anthropic API use from Actions requires an `ANTHROPIC_API_KEY` repository secret — a
  human prerequisite; this creates token-based API charges separate from ordinary interactive
  Claude subscription use. Do not assume an interactive Claude subscription funds GitHub-hosted
  action calls unless current official documentation explicitly establishes that.
- Repository secrets must never be printed or passed into issue text, PR text, reports, or
  prompts.
- Current model availability and pricing must be verified before the first paid smoke.
- **No API key was required or accessed during this closeout task, and no Claude API call was
  made from the repository.**

## 14. No-product-effect statement

Neither the smoke run nor this closeout changed product behavior: no `src/**`, Supabase,
migration, dependency, or CI-workflow file was touched. All artifacts are documentation
(`reports/`, `handoffs/`, governance/contract text).

## 15. GitHub evidence

- Issue #148 — `QUEUE-004A`, closed `queue:done`.
- PR #150 — merged; merge commit `c652b053e948fcb9d162472628d1cf37338b8314` (verified equal to
  the canonical tip at closeout start).
- `reports/QUEUE_004_OVERNIGHT_STAGE_A.md` — present in the canonical tree.
- Issue #149 — `QUEUE-004B`, closed `not planned`, labels `risk:safe-autonomous` +
  `queue:needs-human`, with the block comment (posted `2026-07-23T13:56Z`) and final closeout
  comment.
- PR #147 — the prior QUEUE-004 documentation-hardening PR (merged before this run).

## 16. Evidence-class distinctions

- **GitHub-verifiable facts:** issue states/labels/timestamps, PR #150 merge and merge commit,
  CI check-run success, absence of any Stage B branch/PR, the #149 comments recording the block
  and verdict.
- **Repository evidence:** the Stage A marker file in the canonical tree; this report; the
  handoff entries.
- **Session-local tool observations (not independently provable from GitHub):** the exact
  `send_later` rejection, the Routine error text quoted in §6, the observation that no
  spontaneous CI-success webhook arrived, the environment's `npm install` postinstall failure
  (Supabase CLI download blocked by the proxy; worked around with `--ignore-scripts`, no
  dependency file changed), and the git proxy's HTTP 403 on remote deletion of the merged
  Stage A branch (left for an authorized channel per `AGENTS.md`).

No cost data is reported: no cost-reporting mechanism was available from within this session.
