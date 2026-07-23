---
name: queue-run
description: Drive the Claude queue — GitHub Issues labeled queue:approved — sequentially to completion (implement, verify, PR, watch CI, merge if authorized, post-merge review, then the next task). Use when the user says "run the queue", "start the worker", "/queue-run", or asks to process approved queue issues unattended or semi-unattended. Governed by docs/automation/CLAUDE_QUEUE_CONTRACT.md, which is the normative source if this file and that document ever disagree.
---

# Queue Run

Work through the repository's Claude task queue (GitHub Issues) one task at a time, using this
session as the worker. The full rules — labels, risk classes, merge authorization, stop
conditions — live in [`docs/automation/CLAUDE_QUEUE_CONTRACT.md`](../../../docs/automation/CLAUDE_QUEUE_CONTRACT.md).
Read it before the first run in any session that hasn't already read it this conversation; if
this file and that document disagree, the contract document wins.

This skill is deliberately not a background daemon. Each invocation drives the queue forward
until either nothing is left to do, or a task needs a human. Long unattended operation comes from
two orthogonal mechanisms, not from this skill looping forever in one turn:

- **PR activity subscription** (`subscribe_pr_activity`) reliably delivers CI-**failure** and
  review-comment events while a PR is open. It does **not** reliably deliver CI-**success**
  events — in the `QUEUE-003` smoke test, no unprompted "CI passed" notification ever arrived.
  Treat it as the mechanism for catching problems early, not for detecting a green run.
- **A scheduled Routine or `send_later`** re-invokes `/queue-run` (or just re-checks the open
  PR's status) later. Given the above, this is the **primary** way a green, quiet CI run is ever
  noticed — always arm one when opening a PR, sized to roughly how long this repo's CI takes, not
  as an afterthought "just in case" backup.

## One run of this skill

### 1. Establish queue state

- Fetch the current canonical branch (`git fetch origin <default-branch>`).
- List open issues; identify any already in `queue:running` or `queue:waiting-ci`.
  - If exactly one such issue exists, that is the active task — resume it at step 3 rather than
    claiming a new one (see "Resuming an in-flight task" below).
  - If more than one exists, stop and report this to the user — it violates "exactly one active
    task" and indicates a prior run didn't clean up state correctly. Do not silently pick one.
- If none is active, select the next eligible issue per the contract's "Task selection order"
  (approved, not blocked/needs-human, never human-only, dependencies satisfied, lowest number
  first). If nothing is eligible, stop here — this is a normal, successful end of the run. Say so
  plainly and do not fabricate work.

### 2. Claim the task

- Set the issue's labels to `queue:running` (remove `queue:approved` is not necessary — leaving
  it is fine; the running/waiting labels are what gate re-claiming).
- Post (or update) the pinned state comment with: task ID, start time, planned branch name,
  attempt count `0`.
- Create the task branch directly from an explicit `origin/<default-branch>` ref (e.g.
  `git checkout -B <branch> origin/<default-branch>`), never from a bare local branch name —
  even one that looks like the canonical branch. A `QUEUE-003` smoke-test incident found a
  long-stale local branch sharing the canonical branch's exact name (left over from an unrelated,
  much earlier checkout); checking it out by name silently reverted the working tree to old
  content. Always fetch and re-derive from `origin/<default-branch>` explicitly, every time, not
  just when something looks wrong. Branch name convention:
  `queue/<task-id-lowercase>-<short-slug>`.

### 3. Implement

- Treat the issue body as the complete work order: objective, DoD, allowed/forbidden paths,
  verify commands, risk class.
- Enforce the risk-class exclusions from the contract regardless of what the issue body says —
  if the task turns out to require something the risk class excludes (a migration, a dependency
  bump, a governance-file edit), stop, set `queue:needs-human`, and explain why in a comment. Do
  not reclassify the issue yourself.
- Respect allowed/forbidden paths literally. If the work genuinely requires touching a forbidden
  path, that is a stop condition, not a judgment call to override — with one narrow exception: if
  the issue's own Definition of Done explicitly requires something its Allowed-paths list
  omitted (an authoring inconsistency, not a scope decision), make the smallest possible addition
  needed to satisfy the DoD and say so explicitly in the PR/report — do not silently expand scope
  beyond what the DoD itself demands, and do not use this as a general escape hatch.
- `queue:approved` does not override this environment's own action-safety classifier. A bulk or
  otherwise flagged command can still be blocked even on an approved, in-scope task — this is an
  independent layer the queue does not control. If blocked, do not attempt a workaround; either
  find an equivalent unblocked approach (e.g. one file at a time instead of a bulk operation) or
  ask the human how to proceed, per the same "no workarounds around a hard restriction" principle
  used elsewhere in this repository.
- Run the issue's verify command(s) (default: `npm run verify`) before opening a PR. Do not open
  a PR on a red local verify.

### 4. Open the PR and watch it

- Push the branch, open the PR referencing the issue (`Closes #<n>` in the body).
- Update the state comment: PR number, phase `waiting-ci`. Set label `queue:waiting-ci`.
- Call `subscribe_pr_activity` for this PR immediately.
- If a scheduling tool is available in this environment, arm one fallback check-in (heartbeat)
  timed to when CI typically finishes for this repo, not a fixed short interval — the heartbeat's
  job is only to catch a missed webhook, not to poll. On firing, it must only check state; it must
  never re-implement or open a second branch/PR for the same task.
- On a CI failure event: diagnose, push a fix, increment the attempt counter in the state
  comment. If the attempt counter would exceed the issue's "Max fix attempts", stop instead: set
  `queue:needs-human`, remove `queue:waiting-ci`, and leave a comment stating exactly what is
  still failing.
- On a review-comment event: address it or reply explaining why not, per the same posture as any
  other PR this session owns.

### 5. Resolve

- CI green, no outstanding unresolved review comments, risk class `safe-autonomous`, and the
  issue's merge-authorization field says auto-merge: merge the PR.
- Otherwise: leave the PR open and green, post a comment that it's ready for human merge, set
  `queue:waiting-ci` → leave as is (a human will merge; do not self-merge without authorization).
- After a merge performed by this skill: run the independent post-merge review (fetch canonical,
  diff the merge against the pre-merge branch tip, confirm no accidental scope creep), write the
  task's handoff entry in `handoffs/latest-handoff.md` per the repo's existing handoff
  convention, set label `queue:done`, remove `queue:running`/`queue:waiting-ci`, and unsubscribe
  from the PR.
- Branch cleanup follows the repository's normal `cleanup-branches` skill convention (local scope
  automatically; remote deletion has standing authorization only for a branch whose PR this
  session just confirmed merged, and is skipped with a clear note if the environment's git proxy
  rejects it — do not build a workaround for that, per `AGENTS.md`).

### 6. Loop or stop

- If a task reached `queue:done`, go back to step 1 and look for the next eligible issue in the
  same run.
- If a task reached `queue:needs-human` or `queue:blocked`, stop the run entirely — per "exactly
  one active task", do not start a different issue while one sits unresolved. Report clearly
  which issue needs attention and why.
- If no eligible issue was found at step 1, stop — nothing to do this run.

## Resuming an in-flight task

A fresh session (new Routine firing, or a heartbeat) must be able to pick up exactly where a
prior run left off, using only: the issue's state comment, its labels, its branch, and its PR
(CI status, comments). Do not rely on this conversation's own memory of a previous run — read the
issue fresh every time this skill starts. If the state comment and the actual branch/PR state
disagree (e.g. comment says `implementing` but a PR already exists), trust the actual GitHub
state (branch/PR/CI) over the comment, correct the comment, and proceed from there.

## What this skill does not do

- It does not select tasks from `ROADMAP.md` — only from `queue:approved` issues.
- It does not create GitHub labels — see the one-time setup note in the contract document.
- It does not run two tasks concurrently, ever.
- It does not retry a failing fix indefinitely — the issue's max-attempts field is a hard limit.
- It does not merge anything outside the exact authorization rule in step 5.
