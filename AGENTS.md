# AGENTS.md — OpenCode Governance (HealthApp)

## Governance

- Dieses Repository folgt der Definition in `SSOK.md`.
- `SSOK.md` beschreibt die übergeordnete Governance-Struktur des Repositories.
- Alle Agenten-Workflows und Projektregeln müssen mit dieser Definition konsistent bleiben.

### Canonical Authority Hierarchy (Binding)

For deterministic governance decisions, apply this authority hierarchy:

1. **Level 1 — Repository Governance Constitution:** `SSOK.md`, `AGENTS.md`
2. **Level 2 — Canonical Domain Authorities:** `ROADMAP.md`, `VERIFY.md`, `.governance/*`
3. **Level 3 — Runtime Execution State:** `tasks/task-state.json`, `runs/current-run.json`
4. **Level 4 — Adapter Execution Rules:** `.agent/adapters/*`
5. **Level 5 — Operational Guides/Checklists:** non-canonical implementation guidance

Legacy Roo artifacts (`.roo/`, `.roomodes`) are historical/transition context and not active top-level authority.

### Conflict Resolution (Binding)

When sources conflict, resolve in this order:

1. **Safety wins first** (`.governance/SAFETY.md` + protected-file constraints)
2. **Canonical domain authority wins second** (`ROADMAP.md` for planning, `VERIFY.md` for verification)
3. **Runtime state never overrides planning authority**
4. **Historical evidence never overrides current authority**
5. **Adapter docs never override governance**

### Runtime Contract (Formalized)

- **Planning Authority:** `ROADMAP.md`
- **Runtime Execution Authority:** `tasks/task-state.json`, `runs/current-run.json`
- **Evidence Authority:** `tasks/task-history.jsonl`, `runs/run-history.jsonl`
- **Verification Authority:** `VERIFY.md`
- **Safety Authority:** `.governance/SAFETY.md`

This formalization clarifies authority ownership only and does not change runtime behavior or workflow mechanics.

---

## Ralph-Loop Governance

**⚠️ TRANSITION IN PROGRESS:** This repository is implementing Ralph-Loop governance alongside existing Roo-first governance.

### Agent Neutrality Principle
- **Agents must read [`.governance/`](.governance/) before Ralph-Loop migration/autonomous-loop work**
- **Agents must work on exactly one assigned task** per run
- **Agents must respect [`tasks/task-state.json`](tasks/task-state.json)** when operating in Ralph-Loop mode
- **Agents must provide required handoff documentation** in [`handoffs/latest-handoff.md`](handoffs/latest-handoff.md); canonical handoff schema owner: [`.governance/RULES.md`](.governance/RULES.md)
- **Agents must stop for required human review gates**; canonical review acceptance-gate owner: [`.governance/REVIEW_POLICY.md`](.governance/REVIEW_POLICY.md)
- **Agents must not claim done without required verification evidence/check outcomes**; canonical completion-gate owner: [`VERIFY.md`](VERIFY.md)
- **Agents must respect [`.agent/config/protected-files.json`](.agent/config/protected-files.json)** and [`.governance/SAFETY.md`](.governance/SAFETY.md)
- **Agents must stop on human-review, protected-file, ambiguity, or validation-failure conditions**

### Tool Adapter Principle
- **Roo, Cline, OpenCode, and Codex are adapters/workers**, not source of truth
- **Repository governance in [`.governance/`](.governance/) is authoritative**, not tool-specific logic
- **Task definitions in [`tasks/task-state.json`](tasks/task-state.json)** override agent assumptions
- **Safety policies in [`.governance/SAFETY.md`](.governance/SAFETY.md)** supersede tool defaults
- **Validation rules in [`validation/validation-rules.json`](validation/validation-rules.json)** are binding

### Ralph-Loop Task Execution
When working on Ralph-Loop migration tasks (RALPH-XXX), agents must:
1. **Read governance files first:** [`.governance/SYSTEM.md`](.governance/SYSTEM.md), [`.governance/RULES.md`](.governance/RULES.md), [`.governance/SAFETY.md`](.governance/SAFETY.md)
2. **Check task assignment:** [`runs/current-run.json`](runs/current-run.json) for current task details
3. **Respect scope boundaries:** Only modify files listed in task's `allowed_files`
4. **Follow safety policies:** Never modify files in task's `forbidden_files`
5. **Execute validation:** Run required validation checks per task definition
6. **Write handoff:** Document work in [`handoffs/latest-handoff.md`](handoffs/latest-handoff.md) following canonical handoff schema ownership in [`.governance/RULES.md`](.governance/RULES.md)
7. **Stop for review:** Never continue to next task automatically

### Dual Governance During Transition
- **For Ralph-Loop tasks (RALPH-XXX):** Follow [`.governance/`](.governance/) policies
- **For existing product tasks:** Continue using [`.roo/`](.roo/) operational logic
- **For conflicts:** [`.governance/`](.governance/) takes precedence on Ralph-Loop tasks
- **Roo preservation:** Never delete or rewrite [`.roo/`](.roo/) or [`.roomodes`](.roomodes) unless explicitly tasked

### Stop Conditions for Ralph-Loop Work
Agents must stop immediately when:
- **Task requirements are ambiguous** or conflicting
- **Validation failures cannot be resolved** within scope
- **Safety policy violations are detected**
- **Task requires forbidden file modifications**
- **Implementation exceeds allowed scope**
- **Human review is required** per task definition

---

## DACH Data Strategy Reference

- Neue DACH-spezifische Datenstrategie für generische vs. Marken-Lebensmittel in Resolver und Ranking.
- Fokus auf locale-aware Matching und Plausibility statt Mittelwertbildung.

This repository uses OpenCode-style deterministic edits and agent governance.

---

## Sources of Truth

- **ROADMAP.md** is the Single Source of Knowledge (SSOK) for all tasks, epics, and decisions.
- **VERIFY.md** is the canonical source for all verification commands and the Definition of Done.

Agents must read both files before starting any task.

---

## Core Rules

### Planning

- Plan before coding. State the plan explicitly before making changes.
- Identify which files will be touched and why.
- Do not start broad refactors without a clear, scoped reason.
- **All planning documents must be created in the `plans/` directory, never in the project root.**

#### Plans Directory Rules

- Plan files are identified by having `PLAN` in the filename
- Use naming convention: `[FEATURE]_[TYPE]_PLAN.md`
- Examples:
  - ✅ `plans/USER_AUTH_IMPLEMENTATION_PLAN.md`
  - ✅ `plans/DATABASE_MIGRATION_PLAN.md`
  - ❌ `USER_AUTH_IMPLEMENTATION_PLAN.md` (in root)
- When referencing plans, always use full path: `plans/PLAN_NAME.md`

### Editing

- Touch only files relevant to the current task.
- Preserve architecture boundaries: domain / application / infrastructure / presentation.
- Do not move, rename, or restructure files unless explicitly required.
- Keep changes minimal and deterministic.
- Do not introduce new libraries without explicit approval.

### Git Branch Sync After Push/Pull (Multi-Session Conflict Prevention)

- After every `git push`, immediately `git fetch origin <default-branch>` to check
  whether the branch's base has advanced since the branch was created or last synced.
- If the base branch has new commits not yet in the current branch's history, report
  this explicitly (do not silently continue as if the branch is still current).
- Before opening or merging a pull request, check for other open pull requests on the
  same repository, not just this branch's own diff against its original base.
- If multiple open pull requests touch the same file paths, compare their diffs before
  merging either — check for both textual conflicts and semantic/design-decision
  conflicts (e.g. one PR reversing a choice already made in an accepted document).
- This rule applies to every adapter/tool per the Tool Adapter Principle — it is not
  Claude-specific.
- After a pull request is confirmed merged, delete its source branch
  (`git push origin --delete <branch>`, or the GitHub UI/API) to keep the branch list
  current. Merge commits preserve all history in the default branch, so this is safe
  once merge is confirmed.
- Never delete a branch whose pull request was closed without merging without explicit
  human confirmation for that specific branch — its commits exist nowhere else once
  deleted, unlike a merged branch's commits, which live on via the merge commit.
- If the current environment cannot perform branch deletion (e.g. git proxy or MCP
  tooling blocks it), do not build ad-hoc workarounds (raw API calls, new tools) to
  route around that restriction — report it and leave the branch for deletion via a
  channel with proper access.
- After every `git push` and every `git pull`/`git fetch --prune`, run the
  `cleanup-branches` skill (see `.claude/skills/cleanup-branches/SKILL.md` for the
  Claude Code implementation) to keep the local and remote branch lists free of
  branches already merged into the default branch. This is a preview-and-report step,
  not a bypass of the skill's own safety gates:
  - Run it in local scope first (no `--remote`). Local deletions of branches merged
    into `origin/<default-branch>` may proceed under the skill's normal single
    confirmation, since they are recoverable via reflog for ~30 days.
  - Only pass `--remote` when the branch being cleaned up is one whose pull request is
    already confirmed merged in this session (per the standing authorization above) or
    when the user explicitly asks for a remote sweep — remote deletion still requires
    the skill's second, separate confirmation in every other case.
  - Do not let this automatic run silently drop the confirmation step from the skill;
    it exists to make cleanup a routine habit after sync points, not to make deletion
    unattended.
- This rule applies to every adapter/tool per the Tool Adapter Principle — it is not
  Claude-specific.

#### Incident rationale

- Two parallel sessions branched from the same base commit and diverged without
  visibility into each other's work; their pull requests (#4, #5 in this repo) later
  turned out to implement conflicting versions of the same task (P1-005) and to create
  the same new file path with different content. The conflict was only caught by
  reviewing both PRs together at merge time, after both had already accumulated
  significant independent work.
- In one Claude Code Remote session, `git push origin --delete <branch>` was rejected
  with HTTP 403 by the environment's git proxy for every merged branch tried (none were
  GitHub-protected), and no GitHub MCP tool exists for branch deletion either. The
  agent then attempted to build a local MCP server calling the GitHub REST API directly
  to fill the gap; the environment's own permission system blocked the dependency
  install, treating it as circumventing the "GitHub MCP tools only" rule. Branches from
  that session were left undeleted for a human (or a channel with proper access) to
  remove — see the rule above.

### Verification

- Run verification before marking any task done (see VERIFY.md).
- `VERIFY.md` is the sole authority for verification decisions by change category (required / optional / blocking checks).
- Use `npm run verify` as canonical runtime entrypoint when the `VERIFY.md` decision table requires full runtime verification.
- Do not bypass or skip verification steps required by `VERIFY.md`.
- Do not claim a task is done if required blocking checks from `VERIFY.md` have not passed.

### Manual UI Testing Gap Log (Binding)

- The agent execution environment is headless (no Expo runtime, no Android Emulator, no iOS Simulator, no working React-Native-Web interactive rendering for visual checks).
- Whenever a task touches UI/presentation-layer files (e.g. `App.tsx`, anything under `src/**/presentation/**`, screens, components, navigation) and the agent could not visually verify the result in Expo/a simulator/a device, the agent **must** append a new entry to [`docs/MANUAL_TESTING_GAPS.md`](docs/MANUAL_TESTING_GAPS.md) before claiming the task done.
- Use the template already present in that file (newest entry first). Fill in branch/PR, affected files, what was verified by the agent (typecheck/lint/test), what was **not** visually verified, and which checklist section in that file applies.
- This rule applies to every adapter/tool (Roo, Cline, OpenCode, Codex, Claude Code) per the Tool Adapter Principle — it is not Claude-specific.
- This log entry is required in addition to, not instead of, the checks in `VERIFY.md`. See `VERIFY.md` for the binding rule that ties this to the completion gate for UI-relevant changes.
- Skip this only if the change contains no UI/presentation-layer files, or if the agent genuinely ran the app in a real Expo/simulator/device session and confirmed the change visually (state this explicitly in the handoff/summary).

### Dependency Command Safety (CLINE-OPS-003)

- `npm install` is allowed only when explicitly required to restore missing local dependencies.
- `npm audit` is read-only and allowed for inspection only.
- `npm audit fix` requires explicit approval.
- `npm audit fix --force` is forbidden during scoped tasks unless a dedicated dependency-migration task is approved.
- Any `package.json` / `package-lock.json` change is out of scope unless the task explicitly allows dependency changes.

#### Incident rationale

- `npm audit fix --force` can perform SemVer-major upgrades and large lockfile rewrites.
- It must not be mixed into feature/test/governance tasks.

#### Recovery rule for accidental dependency drift

If package files drift accidentally:

1. stop,
2. restore `package.json`,
3. restore `package-lock.json`,
4. rerun `npm install`,
5. rerun the narrow relevant test,
6. document the incident.

### Task Governance

- Every task must reference a task ID from ROADMAP.md.
- Task IDs are never reused.
- Completed tasks are marked `done` in ROADMAP.md — never deleted.
- Update ROADMAP.md task status when work starts (`in_progress`) and when done (`done`).
- Update relevant documentation when behavior changes.

### Definition of Done

A task is done only when:

- required blocking checks from `VERIFY.md` pass
- no type errors exist
- no lint errors exist
- edge verification passes if edge functions were changed
- for UI-relevant changes without a real visual test: `docs/MANUAL_TESTING_GAPS.md` has a new entry (see "Manual UI Testing Gap Log" above)
- ROADMAP.md task status is updated to `done`

### Secrets & Security

- Never write secrets, API keys, or credentials into source files.
- Use `os.environ/...` references for all sensitive values in config files.
- Never commit `.env` files.

### Documentation

- Update ROADMAP.md, VERIFY.md, or AGENTS.md when governance or behavior changes.
- Do not leave stale documentation that contradicts current behavior.

### Prohibited

- No fake completion claims ("done" without passing verification).
- No automatic pushes to remote without human approval.
- No broad refactors outside the scope of the current task.
- No model names or provider names in domain or application layer code.

---

## Canonical Root

All verification commands are executed from the workspace root:

```bash
npm run verify
```
