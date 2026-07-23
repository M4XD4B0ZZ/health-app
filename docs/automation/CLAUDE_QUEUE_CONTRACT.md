# Claude Queue Contract

This document defines the queue that the `queue-run` skill (`.claude/skills/queue-run/SKILL.md`)
drives. It replaces the retired Ralph-Loop / Overnight Worker runtime (see the "Ralph-Loop
Governance / Overnight Worker (Retired)" section in `ROADMAP.md`) with a much smaller model built
entirely on GitHub-native primitives — no custom orchestrator, no runtime-state files in this
repository, no scheduler code.

## Principles

- **GitHub Issues are the queue.** There is no other task list. `ROADMAP.md` remains the
  planning authority for product work; queue issues are the execution surface for whichever
  tasks a human has decided to hand to an unattended/semi-attended worker.
- **Nothing runs without the `queue:approved` label.** Creating an issue never starts work.
  Removing the label (or adding `queue:blocked`) stops work on that issue at the next
  label-check, even mid-task.
- **Exactly one active task, repository-wide.** The worker never runs two queue tasks in
  parallel. This is enforced by convention (the skill checks for any other issue in
  `queue:running` before claiming a new one), not by a lock file.
- **Git branches, commits, and PRs are the only durable execution state.** No JSON/JSONL state
  file is added to this repository. A fresh worker session must be able to resume any in-flight
  task purely by reading: the issue (title, body, labels, state comment), its branch, and its PR
  (CI status, review comments).
- **The issue's pinned state comment is the single source of truth for progress**, written and
  updated by the worker itself. It records: task ID, branch name, PR number (once opened),
  attempt count, last action taken, and current phase. A worker resuming the task reads this
  comment first, before deciding what to do next.

## Labels

| Label               | Meaning                                                                                                                                                                                                                                     |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `queue:approved`    | Human has authorized this task to run. Required before any worker touches it.                                                                                                                                                               |
| `queue:running`     | A worker is actively on this task (branch created and/or PR open).                                                                                                                                                                          |
| `queue:waiting-ci`  | PR open, waiting on CI or review; the worker is not actively running (it will be woken by a CI-failure/review event, but treat the fallback heartbeat as the primary way CI **success** is ever noticed — see "Operational Lessons" below). |
| `queue:blocked`     | Human paused this task. Worker must not act on it until this label is removed and `queue:approved` re-confirmed present.                                                                                                                    |
| `queue:needs-human` | Worker stopped: ambiguity, exhausted fix attempts, or a stop condition fired. Requires human action before it can resume.                                                                                                                   |
| `queue:done`        | Task merged (or otherwise completed) and the worker's handoff is written.                                                                                                                                                                   |

Risk classes (exactly one per issue, set via the issue template dropdown):

- `risk:safe-autonomous`
- `risk:review-required`
- `risk:human-only` — never claimed by the worker under any circumstance, regardless of other labels.

**One-time setup note:** these labels are not created automatically by this contract. If
`queue:approved` (or any other label above) does not yet exist in this repository's label list,
create it once via GitHub → Settings → Labels (any color) before using the queue. The worker does
not have label-management access.

## Task selection order

1. Ignore any issue without `queue:approved`.
2. Ignore any issue carrying `queue:blocked` or `queue:needs-human`.
3. Never touch `risk:human-only` issues.
4. Among the remainder, check the `Dependencies` field (from the issue template) — an issue whose
   declared dependency Task ID is not yet `queue:done` is skipped.
5. Otherwise, take the lowest issue number first.
6. If no eligible issue exists, the worker session ends cleanly — this is a normal outcome, not a
   failure.

## Risk-class exclusions

`risk:safe-autonomous` explicitly excludes (these always require `risk:review-required` or a
separate human decision, never autonomous execution regardless of what the issue body says):

- Database/Supabase migrations
- Dependency changes (`package.json`, `package-lock.json`) unless the task is specifically and
  only a dependency-hygiene task
- Secrets, environment variables, `.env*`
- Deployments (`npm run deploy:edge*`)
- Auth/billing changes
- Anything touching `.governance/**`, `.roo/`, `.roomodes`, or this contract/skill itself
- Ambiguous or architecturally significant product decisions
- Destructive Git operations (force-push, history rewrite, branch deletion beyond the task's own
  branch)

## Lifecycle

```
queue:approved (picked up)
  → queue:running        (branch created, implementation started)
  → queue:waiting-ci      (PR open, waiting on CI/review)
  → queue:running          (worker woken by CI/review event, pushes a fix or proceeds)
  → merged
  → queue:done            (post-merge review + handoff written)
```

Side exits, at any point: `queue:blocked` (human-paused) or `queue:needs-human` (worker-stopped).
Both halt the queue for that issue only — other approved issues are unaffected, but per "exactly
one active task" the worker will not start a new one while any issue sits in `queue:running` or
`queue:waiting-ci`; a stuck task must be resolved (or explicitly moved to `queue:blocked` /
`queue:needs-human`) before the queue proceeds.

## Merge authorization

- `risk:safe-autonomous` **and** the issue's "Merge authorization" field set to auto-merge: the
  worker may merge once CI is green and there are no outstanding, unresolved review comments.
- Anything else: the worker stops at an open, green PR and sets `queue:waiting-ci` (or leaves a
  comment requesting merge) — a human merges.
- `risk:human-only` issues are never claimed in the first place.

## Fix-attempt and stop-condition limits

- The issue's "Max fix attempts" field bounds how many times the worker may push a new commit in
  response to a CI failure on the same PR. On exceeding it, the worker sets `queue:needs-human`
  and stops — it does not retry indefinitely.
- Standard stop conditions (in addition to any task-specific ones in the issue): ambiguous
  requirements, a required forbidden-path change, a risk-class exclusion triggered mid-task, a
  protected/governance file needing modification, or genuine architectural ambiguity. All of
  these produce `queue:needs-human`, never a silent skip or a guess.

## Operational Lessons (from `QUEUE-003`)

Learned from the first real end-to-end run of the queue (`RALPH-RETIRE-002` / `QUEUE-003B`, see
`ROADMAP.md`'s `QUEUE-003` entry and `reports/QUEUE-003_SMOKE_TEST_MARKER.md`). These are binding
operational guidance, not just historical notes:

- **CI-success webhooks are not reliable — treat the fallback heartbeat as primary, not backup.**
  In the smoke test, no CI-success notification ever arrived on its own; every check happened
  either because a human asked or because a scheduled fallback check-in fired. CI-failure and
  review-comment events are more likely to arrive via subscription, but a green run finishing
  quietly is the common case and must not be assumed to self-report. Always arm a fallback
  check-in when opening a PR, and do not treat its absence as evidence nothing has happened.
- **Always branch from an explicit `origin/<default-branch>` ref, never a bare local branch
  name.** A stale local branch that happened to share the canonical branch's name (left over from
  an unrelated, much earlier session) was checked out by name during routine cleanup and briefly
  reverted the working tree to old content. No push occurred, but the fix was only re-syncing to
  `origin/<default-branch>` — this must be the default habit, not a recovery step.
- **Environment-level safety classifiers are a real, independent gate the queue does not
  control.** A `queue:approved` label does not bypass this environment's own auto-mode action
  classifier — a bulk destructive command (e.g. `git rm -r` across multiple directories) can
  still be blocked outright, requiring either an alternative approach (e.g. deleting files one at
  a time) or explicit human confirmation. Do not treat `queue:approved` as authorization that
  overrides environment-level safety mechanisms.
- **Cross-check an issue's Definition of Done against its Allowed/Forbidden paths before
  approving.** One smoke-test issue's DoD required resolving contradictory authority in a file
  that its own Allowed-paths list omitted. When this happens, the worker should make a narrow,
  explicitly-flagged exception in service of the DoD rather than blocking the whole task on a
  self-inconsistent issue — but this should be caught at issue-authoring time, not discovered
  mid-task.
- **Genuine unattended/overnight survival was subsequently tested in `QUEUE-004` — and did not
  pass on native capabilities alone.** See "Operational Lessons (from `QUEUE-004`)" below.

## Operational Lessons (from `QUEUE-004`)

The `QUEUE-004` unattended smoke (issues #148/#149, PR #150,
`reports/QUEUE_004_UNATTENDED_SMOKE_CLOSEOUT.md`) attempted a genuine multi-hour unattended
two-stage run. Stage A passed the full supervised lifecycle; the unattended continuation failed
**before** Stage B, and the following are binding corrections to what this contract may claim:

- **Native session capabilities have not proven a reliable unattended overnight worker.** Nothing
  in this contract or the `queue-run` skill may be described as "unattended" merely because it
  uses `queue-run`. Without an external trigger, the queue is **semi-attended**: it processes
  whatever is actionable when a session is invoked, but future reactivation is not guaranteed.
- **PR-activity subscriptions are useful for CI failures and review activity, but did not
  reliably surface quiet CI success** in either observed run (`QUEUE-003`, `QUEUE-004`). Green CI
  was only ever noticed by an in-session check or a human prompt.
- **The observed environment provides no usable native 15-minute recurring wake.** A recurring
  Routine at `*/15 * * * *` was rejected outright — the minimum supported recurring interval is
  one hour. A one-hour Routine does not satisfy the maintainer's requested ~15-minute
  progress-check/recovery target.
- **The external-controller decision (`GITHUB_ACTIONS_CONTROLLER_JUSTIFIED`) was justified by
  this real smoke evidence, not assumed in advance.** The successor scope is deliberately
  minimal — see `QUEUE-005` in `ROADMAP.md`; this contract does not define the controller's
  design.
- **Fail closed on missing wake mechanisms.** A worker must not approve or claim a
  delayed/dependent future task when no supported wake mechanism exists to reach it — stopping
  before the dependent stage (as `QUEUE-004` did with Stage B, issue #149, closed unexecuted) is
  the correct outcome, and an unexecuted stage must never be cited as completed queue work.

## Relationship to `ROADMAP.md`

`ROADMAP.md` is unaffected by this contract. Product feature planning, task IDs, and status still
live there. Queue issues are a separate, parallel execution surface for tasks a human has decided
to route through the unattended worker — typically (but not necessarily) tasks that also have a
`ROADMAP.md` entry. The queue does not select tasks from `ROADMAP.md` automatically.
