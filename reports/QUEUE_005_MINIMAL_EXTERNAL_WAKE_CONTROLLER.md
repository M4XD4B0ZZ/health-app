# QUEUE-005 — Minimal External Queue Wake Controller

Phase-A implementation report. Verdict for this PR: **implementation complete, zero Claude
invocation during authoring, Phase B (authenticated smoke) not started.** See
`ROADMAP.md`'s `QUEUE-005` entry for the authoritative status; this report is evidence for it.

## 1. Motivation (from `QUEUE-004` evidence)

`reports/QUEUE_004_UNATTENDED_SMOKE_CLOSEOUT.md` proved, with real smoke evidence (not assumed
in advance), that the Claude Queue — GitHub Issues driven by the `queue-run` skill, with
PR-activity subscriptions and native scheduled wake-ups, and no custom controller — is only
**semi-attended**:

- The observed session environment's recurring Routines rejected a 15-minute cadence outright
  (minimum supported interval: one hour), which does not meet the ~15-minute
  progress-check/recovery target.
- Quiet, successful CI was not reliably surfaced by PR-activity subscriptions in either the
  `QUEUE-003` or `QUEUE-004` smoke — only a human prompt or a scheduled check-in ever noticed it.
- `QUEUE-004`'s Stage A (issue #148) passed the full supervised lifecycle, but Stage B (issue
  #149) was correctly never claimed — it was fail-closed pending a wake mechanism that never
  existed, and is **not** cited here as completed queue work.
- Verdict: `GITHUB_ACTIONS_CONTROLLER_JUSTIFIED` — a minimal external wake layer only, not a
  RALPH-style orchestrator, runtime-state files, or workflow engine.

This task builds exactly that minimal layer, nothing more.

## 2. Intentionally minimal architecture

```
schedule (*/15 * * * *) or workflow_dispatch
        │
        ▼
┌───────────────────┐   should_invoke=false   ┌─────────────────────────────┐
│ preflight job      │ ───────────────────────▶│ (claude job skipped; no     │
│ (read-only,        │                          │  secret read, no mutation) │
│  no Claude secret)  │                          └─────────────────────────────┘
└─────────┬──────────┘
          │ should_invoke=true
          ▼
┌───────────────────────────┐
│ claude job (write perms)  │
│  auth precheck (fail      │
│  closed) → Claude Code    │
│  Action → ONE bounded     │
│  durable transition       │
└───────────────────────────┘
```

- One workflow: `.github/workflows/claude-queue-wake.yml`.
- One dependency-free preflight script: `scripts/automation/claude-queue-preflight.mjs` (Node
  built-ins only — `node:fs` and the global `fetch`; no npm dependency added).
- One dependency-free auth-precheck script: `scripts/automation/claude-queue-auth-precheck.mjs`.
- No committed per-run state. GitHub Issues/branches/PRs/check-runs remain the only durable
  state, read fresh on every tick.
- No ROADMAP.md task selection — the preflight only implements the existing queue contract's
  "Task selection order" and "Active-task reconciliation" deterministically, for a context with
  no chat memory between ticks.

## 3. Preflight state table

Implemented by `decidePreflight()` in `scripts/automation/claude-queue-preflight.mjs`, unit
tested by `scripts/automation/__tests__/claude-queue-preflight.test.mjs` (50 passing cases).

| Situation                                                                                                                        | `reason_code`                   | `should_invoke` |
| -------------------------------------------------------------------------------------------------------------------------------- | ------------------------------- | --------------- |
| No `queue:approved` candidate (after excluding blocked/needs-human/human-only/done)                                              | `IDLE_NO_APPROVED_TASK`         | false           |
| Eligible candidates exist but all have an unsatisfied `queue:done` dependency                                                    | `IDLE_DEPENDENCY_BLOCKED`       | false           |
| Lowest eligible candidate, dependencies satisfied, no active task                                                                | `ACTION_NEW_TASK`               | true            |
| Exactly one active issue (`queue:running`/`queue:waiting-ci`), no PR yet                                                         | `ACTION_RESUME_IMPLEMENTATION`  | true            |
| Active issue's PR checks queued or in-progress                                                                                   | `IDLE_WAITING_CI`               | false           |
| Active issue's PR checks terminal-failed (failure/timed_out/cancelled/action_required)                                           | `ACTION_CI_FAILED`              | true            |
| Active issue's PR checks all green, issue authorizes auto-merge                                                                  | `ACTION_CI_GREEN`               | true            |
| Active issue's PR checks all green, issue requires human merge                                                                   | `IDLE_WAITING_HUMAN_MERGE`      | false           |
| Active issue's PR merged, issue not yet `queue:done`                                                                             | `ACTION_POST_MERGE`             | true            |
| More than one issue carries `queue:running`/`queue:waiting-ci`                                                                   | `BLOCKED_MULTIPLE_ACTIVE_TASKS` | false           |
| No checks reported, contradictory conclusions, closed-unmerged PR while active, duplicate PR, or no reconcilable evidence at all | `BLOCKED_AMBIGUOUS_STATE`       | false           |
| Issue body has no parseable Task ID, or an unparseable Dependencies list                                                         | `BLOCKED_INVALID_QUEUE_ISSUE`   | false           |

Notes on the implementation, verified by dedicated tests:

- **Check-runs, not the legacy combined-status API, are authoritative** — `classifyChecks()`
  only ever reads `GET /repos/{owner}/{repo}/commits/{sha}/check-runs`; a fixture where a legacy
  combined status disagrees still resolves from check-runs alone (test 20).
- **Actual GitHub state overrides a stale state comment** — the decision function never reads
  comment _content_, only whether a pinned comment exists at all (used solely for the
  no-evidence-at-all ambiguous case); real branch/PR/check-run data always wins (test 19).
- **Malformed issue bodies fail closed, never guessed** — both the bold-label paragraph style
  used by existing queue issues (`**Task ID:** ...`) and the GitHub issue-form header style
  (`### Task ID`) are parsed; anything else is `BLOCKED_INVALID_QUEUE_ISSUE`.

## 4. Permissions (split by job)

| Job         | `contents` | `issues` | `pull-requests` | `checks` | `actions` | Claude secret access                    |
| ----------- | ---------- | -------- | --------------- | -------- | --------- | --------------------------------------- |
| `preflight` | read       | read     | read            | read     | read      | none                                    |
| `claude`    | write      | write    | write           | read     | read      | yes (exactly one of the two configured) |

Neither job requests `id-token: write` — QUEUE-005 supports only the `oauth` and `api`
authentication modes (see §6), neither of which is an OIDC/workload-identity-federation flow
(that path, used for Amazon Bedrock/Google Cloud, is the only one the official Action documents
as needing `id-token: write`). Neither job requests administration, secrets, workflows,
deployments, or packages permissions. `permissions: {}` at the workflow root means every job must
explicitly opt into what it needs.

## 5. Concurrency

One repository-wide group at the workflow level: `claude-queue-wake-controller`, with
`cancel-in-progress: false`. This is GitHub's documented safe behavior for "never cancel a
currently active run, only let the next tick wait or be superseded while queued" — an
in-progress run is never cancelled by a new tick; if multiple ticks queue up behind it, only the
most recent queued run proceeds once the active one finishes (GitHub Actions' own concurrency
group semantics), so duplicate scheduled ticks cannot create duplicate branches/PRs/transitions.

## 6. Authentication modes

Exactly two, selected by the `CLAUDE_QUEUE_AUTH_MODE` repository variable, enforced by
`scripts/automation/claude-queue-auth-precheck.mjs`'s `resolveAuthDecision()` before the Claude
Code Action step:

| `CLAUDE_QUEUE_AUTH_MODE` | Required secret           | Notes                                                                                                                                                                                                                                                                                                                               |
| ------------------------ | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `oauth`                  | `CLAUDE_CODE_OAUTH_TOKEN` | Generated via `claude setup-token`; official docs describe this as available to Pro/Max subscribers. This report does **not** claim the resulting usage is free or is definitely billed against a particular interactive subscription quota — that must be observed from the real Phase-B smoke and reported honestly, not assumed. |
| `api`                    | `ANTHROPIC_API_KEY`       | Direct Anthropic API; creates token-based charges separate from interactive subscription use (see §8 for current pricing).                                                                                                                                                                                                          |

No fallback between modes: an invalid/missing `CLAUDE_QUEUE_AUTH_MODE`, or the mode's
corresponding secret missing, or `CLAUDE_QUEUE_MODEL` missing, makes `resolveAuthDecision()`
return `ok: false` and the workflow step exits non-zero **before** the Claude Code Action step
runs — no Claude request is made, and no queue state is mutated (the failing step is the very
first one in the `claude` job after checkout/setup-node/install, before any GitHub write action).
`resolveAuthDecision()`'s signature only accepts _booleans_ for secret presence (`hasOauthToken`,
`hasApiKey`) — it structurally cannot print a secret value, length, prefix, or hash, because it
never receives one (test 30 in the test file asserts this directly, by construction).

## 7. Model configuration

`CLAUDE_QUEUE_MODEL` is a required repository variable, passed as `--model` in `claude_args`. No
model ID is hardcoded in the workflow. Per current official documentation (retrieved
2026-07-23), `claude-sonnet-5` is a currently valid model identifier for the Claude Code Action's
`--model` CLI argument; the human setup step (§10) is expected to set
`CLAUDE_QUEUE_MODEL=claude-sonnet-5` unless the maintainer prefers a different currently-valid
model at setup time.

## 8. Cost limitations

- GitHub Actions currently offers no task-specific hard USD budget gate inside this Action —
  stated honestly, not worked around.
- Cost exposure is bounded only through the mechanisms this task specifies: deterministic idle
  filtering (no Claude invocation on idle ticks — the primary control), one bounded durable
  transition per invocation (§ "One durable transition per invocation" in the contract), 24 max
  turns, a 45-minute job timeout, the issue's own fix-attempt limit, "exactly one active task"
  (enforced by the preflight's `BLOCKED_MULTIPLE_ACTIVE_TASKS` fail-closed behavior), and the
  single controller concurrency group (no overlapping controller runs).
- No automatic infinite retry exists anywhere in this design.
- Current introductory API pricing for `claude-sonnet-5` (retrieved 2026-07-23, via web search of
  third-party pricing aggregators, not yet cross-checked against `platform.claude.com/docs`
  directly in this session): approximately $2 / MTok input, $10 / MTok output through
  2026-08-31, reverting to approximately $3 / MTok input, $15 / MTok output afterward. **This
  must be re-verified directly against `https://platform.claude.com/docs/en/about-claude/pricing`
  immediately before authorizing the first paid (`api`-mode) smoke** — it is recorded here as a
  planning input, not a guarantee.
- OAuth-mode billing/quota behavior against a Pro/Max subscription is explicitly not claimed
  either way in advance (see §6) — Phase B must observe and report it honestly.

## 9. Action pins and verified versions

All retrieved 2026-07-23 directly from each project's GitHub releases pages (cross-checked with
two independent fetches for `actions/checkout` and `anthropics/claude-code-action`; the SHA
length of every pin below was additionally verified locally to be exactly 40 hex characters
before use, after one candidate `actions/setup-node` fetch returned a malformed 41-character
string that was discarded in favor of a second, clean single-source verification):

| Action                          | Pinned SHA                                 | Release tag (inline comment) |
| ------------------------------- | ------------------------------------------ | ---------------------------- |
| `actions/checkout`              | `fbc6f3992d24b796d5a048ff273f7fcc4a7b6c09` | `v5.1.0`                     |
| `actions/setup-node`            | `49933ea5288caeca8642d1e84afbd3f7d6820020` | `v4.4.0`                     |
| `anthropics/claude-code-action` | `44423bdec74b97d67543eb16c110546762c110b2` | `v1.0.181`                   |

No `@main`, floating branch, or unqualified mutable tag (e.g. bare `@v1`) is used as an
executable ref anywhere in `.github/workflows/claude-queue-wake.yml` — confirmed by a dedicated
test that every `uses:` line matches `owner/repo@<40-hex-sha> # v<tag>`. Note: the moving major
tag `@v1` on `anthropics/claude-code-action` currently points at the same commit as `v1.0.181`
(standard "major tag follows latest patch" practice for TypeScript GitHub Actions) — it is
**not** used here specifically because it is mutable by design and would silently move to a
future, unreviewed release.

## 10. Idle behavior (primary acceptance criterion)

On an idle tick (`should_invoke=false`), the `claude` job's `if: needs.preflight.outputs.should_invoke
== 'true'` condition prevents the job from running at all — GitHub Actions skips the entire job,
including its `permissions:` grant, so:

- no Claude secret is ever read (the `claude` job's steps, including the ones with `env:` blocks
  referencing `secrets.CLAUDE_CODE_OAUTH_TOKEN`/`secrets.ANTHROPIC_API_KEY`, never execute);
- no comment, label, branch, PR, or commit is created;
- the `preflight` job completes successfully and writes only a job-summary readback.

This is verified structurally in this PR (test: "claude job is conditional on preflight
should_invoke -> idle path cannot reach it") and is scheduled to be verified live, on the real
repository, via a manual `workflow_dispatch` after this PR merges (§13) — required before any
Phase-B authenticated smoke may begin.

## 11. One-transition behavior

See `docs/automation/CLAUDE_QUEUE_CONTRACT.md`'s new "External-Controller Mode (`QUEUE-005`)"
section and `.claude/skills/queue-run/SKILL.md`'s new "External-controller mode (`QUEUE-005`)"
subsection, both added by this PR. Summary: a controller-invoked worker performs exactly one
bounded, durable transition (claim/resume, one CI-fix, CI-green resolve, or post-merge
completion) and stops — it never polls CI in-process and never loops to a second issue within
one invocation, unlike a manual `/queue-run` session which may legitimately process multiple
tasks in one sitting.

## 12. Test results (Phase A)

```
$ node --test scripts/automation/__tests__/claude-queue-preflight.test.mjs
# tests 50
# suites 7
# pass 50
# fail 0
# cancelled 0
# skipped 0
```

Coverage includes all 30 required cases from the task's "Required tests" list (idle/actionable
decision paths 1–24, workflow-structure checks including idle-path unreachability 25, and
auth-precheck fail-closed/secret-free behavior 26–30), plus extra coverage for
`parseQueueIssueBody()`'s two supported issue-body formats, `classifyChecks()`'s conclusion
priority, decision purity (no input mutation), and additional workflow-YAML structural checks
(pinned SHAs, bounded turns/timeout, no unrestricted `Bash`, permission scoping per job).

`npm run verify` (typecheck + lint + format:check + test) was also run for the full repository
and is green — see §13.

## 13. Phase-A result

- **Files changed:** `.github/workflows/claude-queue-wake.yml` (new),
  `scripts/automation/claude-queue-preflight.mjs` (new),
  `scripts/automation/claude-queue-auth-precheck.mjs` (new),
  `scripts/automation/__tests__/claude-queue-preflight.test.mjs` (new),
  `docs/automation/CLAUDE_QUEUE_CONTRACT.md`, `.claude/skills/queue-run/SKILL.md`, `ROADMAP.md`,
  `handoffs/latest-handoff.md`, this report (new).
- **No product/runtime source (`src/**`), Supabase/migration, or dependency file changed.\*\*
- **No Claude secret was read and no Claude API/OAuth request was made while producing this PR.**
  Every command run during implementation was either a local git/npm/test command or a read-only
  GitHub MCP call (`issue_read`, `pull_request_read`, `list_issues`) used to verify canonical
  state — never a call to the Claude Code Action or the Anthropic API.
- **No queue issue was claimed, no task branch/PR was created by the controller** — this PR is
  authored directly, the same way prior `QUEUE-00x` documentation/infrastructure PRs in this
  repository were.
- A local live read-only dry-run of `claude-queue-preflight.mjs` against the real repository
  (`M4XD4B0ZZ/health-app`) could not be completed from inside this interactive session: this
  session's sandboxed `GITHUB_TOKEN` authenticates correctly via `curl` (confirmed against
  `GET /repos/M4XD4B0ZZ/health-app`) but is rejected with `401 Bad credentials` when the
  identical `Authorization` header is sent via Node's built-in `fetch` from this sandbox — an
  environment-specific quirk of this session, not of the script or of a real GitHub Actions
  runner (where the job's own Actions-provisioned `GITHUB_TOKEN` is used directly by `fetch()`
  with no such discrepancy). This does not block Phase A: the task's own required live-verification
  step is the **post-merge zero-Claude `workflow_dispatch` dispatch** (§13.1 below), performed
  against the real GitHub Actions runner after this PR merges, which is authoritative and is not
  affected by this session-local issue. At the time of writing, `mcp__github__list_issues` (a
  read-only MCP call, independent of the sandbox's raw-fetch issue) confirms zero open issues
  carry `queue:approved` in this repository, so the live dispatch is expected to return
  `IDLE_NO_APPROVED_TASK`.

### 13.1 Post-merge zero-Claude dispatch — PASSED

Performed immediately after PR #152 merged (merge commit `f0037eb1d3d2a282e9286580d9bcb828b218f1ec`),
via `workflow_dispatch` on `chore/clean-arch-structure`, with zero issues carrying
`queue:approved` at dispatch time (confirmed via a fresh `list_issues` call immediately before
dispatching).

- **Run:** `https://github.com/M4XD4B0ZZ/health-app/actions/runs/30020861364` (run #1, event
  `workflow_dispatch`, head SHA `f0037eb1d3d2a282e9286580d9bcb828b218f1ec`). Overall run
  `status: completed`, `conclusion: success`.
- **Preflight job** (`Preflight (deterministic, read-only)`, job id `89252909006`): `completed` /
  `success`. Its own job log shows the runner-issued `GITHUB_TOKEN` permissions were exactly
  `Actions: read, Checks: read, Contents: read, Issues: read, Metadata: read, PullRequests: read`
  — no write scope of any kind, confirming the job-level `permissions:` block took effect exactly
  as declared. The `Run deterministic queue preflight` step's own output, read directly from the
  job log:
  ```
  should_invoke=false
  reason_code=IDLE_NO_APPROVED_TASK
  issue_number=
  task_id=
  phase=
  pr_number=
  head_sha=
  ```
- **Claude job** (`Claude queue transition`, job id `89252990518`): `completed` / **`skipped`**
  (GitHub Actions' own "condition not met" outcome for the `if:
needs.preflight.outputs.should_invoke == 'true'` gate) — with **zero steps executed** (the job
  record carries no `steps` array at all, unlike the preflight job's 8 recorded steps). This
  means: no checkout, no `npm ci`, no auth-precheck step, and no Claude Code Action step ran —
  neither `CLAUDE_CODE_OAUTH_TOKEN` nor `ANTHROPIC_API_KEY` was ever referenced by a running step,
  because the job that references them never started.
- **No repository mutation:** a follow-up `list_issues`/`list_pull_requests` check found no new
  or changed issue, label, comment, branch, or PR attributable to this run — consistent with the
  preflight's own read-only design (no write permission was even available to it) and the
  Claude job never running.

**This satisfies the task's primary acceptance criterion for idle behavior**: an idle scheduled
(or, here, manually dispatched) tick completed successfully, invoked no Claude action step,
accessed no Claude secret, and created no comment/label/branch/PR/commit.

If the Claude job had started on this idle repository, that would have been treated as a
blocking defect requiring a fix before Phase B — it did not.

## 14. Human setup instructions (stop here until confirmed)

This PR does not request, read, or need either Claude secret. Before Phase B (the authenticated
smoke) can begin, a repository admin must, in the GitHub UI:

**Both modes:**

1. Install the official Claude GitHub App on this repository:
   `https://github.com/apps/claude` (or run `/install-github-app` from a local Claude Code
   session). This grants the Contents/Issues/Pull-requests read-write permissions needed for
   Claude's commits/PRs to trigger this repository's normal `Verify` CI — the Action's own docs
   note that CI does not reliably trigger on commits made without this App installed, only with
   the plain workflow `GITHUB_TOKEN`.
2. Settings → Secrets and variables → Actions → **Variables** → New repository variable:
   `CLAUDE_QUEUE_MODEL` = a currently-valid model ID (e.g. `claude-sonnet-5` — re-verify against
   official docs immediately before setting this, per §7).

**Choose exactly one authentication mode:**

- **OAuth (Pro/Max subscription token):**
  1. Locally, run `claude setup-token` (official current process) to generate a token. Do not
     paste the token value into this chat or into any issue/PR/report text.
  2. Settings → Secrets and variables → Actions → **Secrets** → New repository secret:
     `CLAUDE_CODE_OAUTH_TOKEN` = the generated token.
  3. Settings → Secrets and variables → Actions → **Variables** → New repository variable:
     `CLAUDE_QUEUE_AUTH_MODE` = `oauth`.
- **API key:**
  1. Settings → Secrets and variables → Actions → **Secrets** → New repository secret:
     `ANTHROPIC_API_KEY` = your Claude API key. Do not paste the value into this chat.
  2. Settings → Secrets and variables → Actions → **Variables** → New repository variable:
     `CLAUDE_QUEUE_AUTH_MODE` = `api`.
  3. Report the current official per-token price for the selected model (re-verify against
     `https://platform.claude.com/docs/en/about-claude/pricing`, not the third-party figures in
     §8) before authorizing the first paid smoke.

Do not set both `CLAUDE_CODE_OAUTH_TOKEN` and `ANTHROPIC_API_KEY`-driven mode at once — only the
mode named by `CLAUDE_QUEUE_AUTH_MODE` is ever read.

## 15. Phase-B smoke protocol (not started)

To be run only after: this PR is merged, the zero-Claude dispatch (§13.1) has passed, the human
setup above (§14) is confirmed complete by the maintainer, and the maintainer explicitly
authorizes the smoke. At that point:

1. Verify `QUEUE-005A`/`QUEUE-005B` are unused issue-number-adjacent Task IDs in this repository.
2. Create two fresh synthetic issues, `QUEUE-005A` (docs-only marker) and `QUEUE-005B` (depends
   on `QUEUE-005A`, docs-only marker), both `risk:safe-autonomous`, auto-merge authorized, with a
   pre-declared test-start timestamp and deadline (≤ 12 hours), per the task's Phase-B
   requirements. Apply `queue:approved` to `QUEUE-005A` only; `QUEUE-005B` stays unapproved until
   its dependency reaches `queue:done`, exactly as `QUEUE-004A`/`QUEUE-004B` did.
3. Do not manually claim, dispatch, check CI for, label, or merge either issue after arming — the
   scheduled workflow must do all of it. Record every relevant scheduled run (timestamp,
   `reason_code`, whether the Claude job ran, outcome) here or in a dedicated closeout report.
4. On timeout or ambiguity, let the normal worker set/preserve `queue:needs-human`, make no
   duplicate attempt, retain all evidence, and report failure honestly — adverse results do not
   justify claiming success.

QUEUE-005 may be marked `done` in `ROADMAP.md` only after all of the task's Phase-B acceptance
criteria pass, per the acceptance checklist in the task instructions.

## 16. No-product-effect statement

This PR touches no `src/**`, Supabase, migration, or dependency file. `package.json` and
`package-lock.json` are unmodified. The new files are two `scripts/automation/*.mjs` scripts,
one test file, one workflow file, and documentation/report updates. `npm run verify` (typecheck +
lint + format:check + test) passes unchanged for the existing product test suite, and the new
`node --test` suite (50 cases) passes independently. No product/runtime behavior changed.
