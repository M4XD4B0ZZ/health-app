# AGENTS.md — OpenCode Governance (HealthApp)

## Governance

- Dieses Repository folgt der Definition in `SSOK.md`.
- `SSOK.md` beschreibt die übergeordnete Governance-Struktur des Repositories.
- Alle Agenten-Workflows und Projektregeln müssen mit dieser Definition konsistent bleiben.

### Canonical Authority Hierarchy (Binding)

For deterministic governance decisions, apply this authority hierarchy:

1. **Level 1 — Repository Governance Constitution:** `SSOK.md`, `AGENTS.md`
2. **Level 2 — Canonical Domain Authorities:** `ROADMAP.md`, `VERIFY.md`
3. **Level 3 — Operational Guides/Checklists:** non-canonical implementation guidance

Roo-specific artifacts (`.roo/`, `.roomodes`) were retired as part of `RALPH-RETIRE-002` — see
"Ralph-Loop Governance (Retired)" below.

### Conflict Resolution (Binding)

When sources conflict, resolve in this order:

1. **Safety wins first** (this document's "Protected Files" section below)
2. **Canonical domain authority wins second** (`ROADMAP.md` for planning, `VERIFY.md` for verification)
3. **Historical evidence never overrides current authority**

### Runtime Contract (Formalized)

- **Planning Authority:** `ROADMAP.md`
- **Verification Authority:** `VERIFY.md`
- **Safety Authority:** this document's "Protected Files" section below

This formalization clarifies authority ownership only and does not change runtime behavior or workflow mechanics.

---

## Ralph-Loop Governance (Retired)

The Ralph-Loop / Overnight Worker initiative (`RALPH-001` … `RALPH-047B`) is **retired**; see the
"Ralph-Loop Governance / Overnight Worker (Retired)" section in `ROADMAP.md` and
`reports/RALPH_RETIRE_001_DEAD_RUNTIME_CLEANUP.md` for what it was and why it was retired. The
runtime scaffolding it referenced (`tasks/task-state.json`, `runs/current-run.json`,
`validation/validation-rules.json`, `.agent/adapters/*`, `.agent/config/protected-files.json`)
no longer exists in this repository. Do not resume Ralph-Loop-style task execution or recreate
that scaffolding.

`RALPH-RETIRE-002` (see `ROADMAP.md`) consolidated `.governance/**` into this document — its
still-valuable content (protected files, handoff schema) now lives in the "Protected Files" and
"Handoff Requirements" sections below; the rest was Ralph-specific or already duplicated
elsewhere in this document and was removed. `.governance/**` no longer exists. The same task
retired the Roo-specific `.roo/` and `.roomodes` files (see `SSOK.md`'s "Legacy Roo Workflow
(Retired)" section) — this repository's active workflow is Claude Code / cloud coding agents
operating uniformly under `AGENTS.md`, `SSOK.md`, `ROADMAP.md`, and `VERIFY.md`; there is no
separate Roo-specific or Ralph-Loop-specific governance layer anymore. Full disposition
rationale: `reports/RALPH_RETIRE_002_GOVERNANCE_CONSOLIDATION_REPORT.md`.

---

## Protected Files (Binding)

**Gate ownership (safety):** this section owns safety-gate policy and safety-triggered
immediate-stop conditions for this repository. Other governance documents may reference it but
do not redefine it.

### Absolute protection — never modify

- `.env`, `.env.*` — environment variables
- `secrets/**`, `credentials/**` — secrets and credentials
- `node_modules/**` — package dependencies
- `.git/**` — Git metadata and history
- `package.json`, `package-lock.json` — unless the task explicitly allows dependency changes (see "Dependency Command Safety" below)
- `supabase/migrations/**` — unless the task explicitly allows database migrations

### Conditional protection — explicit task authorization required

- `package.json`, `package-lock.json`, `npm-shrinkwrap.json` — only with an explicit dependency-management task
- `supabase/migrations/**` and other database schema files — only with an explicit schema/migration task
- `.github/workflows/**` — only with an explicit CI/CD task
- `Dockerfile` / container or deployment configuration — only with an explicit containerization/deployment task
- `babel.config.js`, `metro.config.js`, `webpack.config.js` — only with an explicit build-configuration task

### Forbidden actions

- Never expose or log secrets, API keys, credentials, or environment variables.
- Never perform destructive Git history rewrites (`git rebase`, `git reset --hard`, force-push to a shared branch) without an explicit human request.
- Never install new dependencies without explicit task authorization — see "Dependency Command Safety" below for the narrower exception (restoring already-declared dependencies).
- Never perform direct production deployments, database drops/truncates, or other destructive external side effects without explicit task authorization.

Pushing to remote, opening/merging pull requests, and normal branch lifecycle operations are
governed by this document's "Git Branch Sync After Push/Pull" rules above, not by a blanket
prohibition — routine push/PR/merge under human oversight is expected practice here, not an
exception.

---

## DACH Data Strategy Reference

- Neue DACH-spezifische Datenstrategie für generische vs. Marken-Lebensmittel in Resolver und Ranking.
- Fokus auf locale-aware Matching und Plausibility statt Mittelwertbildung.
- Food-Resolution-Architekturrichtung (AI-first Interpretation für unbekannte Eingaben,
  source-grounded Daten, deterministische Berechnung, persistentes Lernen aus validierten
  Ergebnissen): siehe
  [`docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md`](docs/domains/ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md)
  und die "Resolver V3" Epic in `ROADMAP.md`. Deterministische Berechnung und
  Quellen-basierte Nährwertwahrheit bleiben bindend; siehe dort für die genaue Auflösung
  gegenüber dem älteren "Deterministic-first"-Eintrag im `ROADMAP.md`-Decisions-Log.

This repository uses OpenCode-style deterministic edits and agent governance.

---

## Sources of Truth

- **ROADMAP.md** is the Single Source of Knowledge (SSOK) for all tasks, epics, and decisions.
- **VERIFY.md** is the canonical source for all verification commands and the Definition of Done.

### Task-Start Read Contract (Binding)

A full linear reading of `ROADMAP.md` and `VERIFY.md` is not required before every task. At the
scale this repository has reached (`ROADMAP.md` alone is well over 10,000 lines), that blanket
requirement produces unnecessary context cost without a corresponding safety benefit. Before
starting a task, an agent must instead read:

1. `AGENTS.md` and `SSOK.md` — in full if this is a fresh session with no prior reading of the
   current version; otherwise only the parts that changed since the agent last read them.
2. In `ROADMAP.md`: the `Current Focus` section, the concrete task's own entry, the epic it
   belongs to, and any tasks it explicitly depends on.
3. In `VERIFY.md`: the applicable change category from the Canonical Verification Decision Table,
   the required checks for that category, and any domain-specific verification section relevant
   to the task (e.g. "Resolver V2 Verification").
4. `handoffs/latest-handoff.md` (see "Handoff Rotation" below — it holds exactly one entry, so
   this is a small, bounded read).
5. Only the specs, reports, and decision records the task itself references (e.g. via a "MUST
   read" pointer elsewhere in this document or in the relevant `ROADMAP.md` epic).

A full linear reading of `ROADMAP.md` and/or `VERIFY.md` remains required for governance audits
and for tasks explicitly scoped as repository-wide (e.g. a cross-cutting governance or
verification-policy change). When in doubt whether a task is repository-wide, treat it as scoped
and say so explicitly in the handoff rather than defaulting to a full read.

### Prompt Contract for Task-Initiating Prompts (Binding)

**Gate ownership (prompt content):** this section owns what a task-initiating prompt to any coding
agent (Claude Code included, per the Tool Adapter Principle) must and must not contain for this
repository. This is the counterpart to the Task-Start Read Contract above: that contract governs
what the agent reads from the repository itself; this contract governs what the human/dispatching
side puts in the prompt. Together they replace repeatedly pasting project context into prompts
with the agent reading it selectively.

A task-initiating prompt must contain only:

1. the concrete task ID (from `ROADMAP.md`; a new ID if the task doesn't exist yet),
2. the precise goal, or the concretely observed defect,
3. the allowed scope and the explicitly excluded scope for this task,
4. concrete, checkable acceptance criteria,
5. any task-specific risks or known conflicts (e.g. overlapping open PRs, a specific decision this
   task must not reopen),
6. references to the relevant canonical `ROADMAP.md`/`VERIFY.md`/`AGENTS.md` sections or epics (by
   name/anchor, not by content),
7. the required Git/Verify/PR/review closure expected (branch, verification category, PR target,
   whether the agent may merge).

The following must **not** be pasted into a prompt on a routine basis — they are repository
content, not prompt content, and the agent reads them itself per the Task-Start Read Contract:

- full project overviews,
- long historical summaries,
- copied sections from `ROADMAP.md`, `VERIFY.md`, or `AGENTS.md`,
- old handoffs,
- general repository rules that are already canonically documented (this document, `SSOK.md`,
  `ROADMAP.md`, `VERIFY.md`),
- large status blocks the agent can read itself.

Rules already documented canonically are referenced in a prompt, not restated. Only task-specific
deviations, tightenings, or particularly relevant risks are worth repeating. Prompts stay compact,
unambiguous, and directly executable; project history belongs in the repository, not in every
individual message.

This contract governs prompt _content_, not delivery mechanism — it applies equally regardless of
which tool, adapter, or session type dispatches the task.

#### CodeGraph Availability (Binding)

`CODEGRAPH-001` (see `ROADMAP.md`, EPIC: Developer Tooling & Verification) completed successfully,
including real MCP-tool-level functional proof in a fresh Claude Code session — CodeGraph is now
available for this repository via the project-scoped `.mcp.json` (`codegraph`, pinned version
`1.5.0`). `CODEGRAPH-001` itself remains the bootstrap exception: it was not required to use
CodeGraph as a precondition of its own completion.

**Actual exposed tool surface (as observed in Phase B, binding until re-verified otherwise):** the
`codegraph` MCP server currently exposes exactly one tool, `codegraph_explore`. There is no separate
`codegraph_status`/callers/callees/call-path tool. `codegraph_explore` itself serves all of: index
availability/health signaling (it errors explicitly if no `.codegraph/` index is found for the
queried `projectPath`), symbol lookup (verbatim, line-numbered on-disk source of matching symbols),
and relationship/impact lookup (a blast-radius summary plus `calls`/`implements`/`instantiates`/
`references` edges among the returned symbols). Do not assume a differently named tool exists;
re-discover the actual exposed tool set at the start of a task rather than trusting this list to
stay current if the CodeGraph server version changes.

**Operative rule for codebase-related tasks (binding):**

- At the start of a coding, architecture, resolver, data-flow, impact-analysis, or
  post-merge-review task, perform a real CodeGraph MCP preflight: call the actually exposed
  CodeGraph MCP tool(s) for this session (currently `codegraph_explore`) — never assume the tool
  name from this document without checking what is actually exposed.
- The index must be healthy and current. If the tool reports no index / an unindexed project for
  the repository path, this is a fail-closed condition unless remedied as follows: sync the index
  exactly once with the pinned CLI version from `.mcp.json` (currently `npx -y
@colbymchenry/codegraph@1.5.0 init`/`sync`), then re-verify successfully through the MCP tool
  itself (not the CLI). If it still fails after that one remediation attempt, fail closed.
- Perform at least one task-relevant symbol search through the real CodeGraph MCP tool before
  editing.
- Perform at least one caller/callee, dependency, call-path, or impact lookup through a real
  CodeGraph MCP tool for a symbol relevant to the change, before making repository changes.
- Use the returned symbols, files, callers/callees, and blast-radius results to scope the change and
  the set of files touched — do not scope from memory or assumption where CodeGraph evidence is
  available.
- Document in the task's handoff: the exact tool name(s) called, the query/queries used, and the
  relevant symbol/relationship findings (file, line, relationship kind).
- Fail-closed: if the `codegraph` MCP server is unavailable, the index is durably invalid/unhealthy
  after the one permitted resync attempt, or no task-relevant relationship proof can be obtained,
  stop — do not modify repository files, do not commit, do not silently fall back to `grep`/text
  search/CLI output as a substitute for the MCP tool surface. Report the exact server/tool name, the
  query, and the full failure.
- Exception: pure documentation/governance-only tasks (no product/runtime/resolver/test/CI/
  dependency/Supabase code touched) do not require CodeGraph unless the task explicitly demands it.
- `CODEGRAPH-001` itself is a closed historical bootstrap exception: it made CodeGraph available and
  is not to be re-litigated or treated as precedent for skipping this rule on later tasks.

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

### Handoff Requirements (Binding)

**Gate ownership (handoff schema):** this section owns the normative handoff schema for this
repository.

Every completed task must produce a clear handoff (in `handoffs/latest-handoff.md`, which per the
"Handoff Rotation" rule below holds only the current entry) containing:

1. Task ID and status
2. What changed
3. Why it changed
4. Files changed
5. Verification executed
6. Verification result
7. Known issues, blockers, or residual risks
8. Human-review status / next steps

A task must never be marked done without a handoff meeting these fields, and never marked done
without passing verification (see `VERIFY.md`).

### Handoff Rotation (Binding)

`handoffs/latest-handoff.md` holds exactly the single most recent handoff — nothing else. This
keeps item 4 of the Task-Start Read Contract above a small, bounded read instead of an
ever-growing file.

- Before writing a new handoff, archive the current contents of `handoffs/latest-handoff.md`
  unchanged into its own file under `handoffs/archive/`, named
  `YYYY-MM-DD_TASK-ID_short-description.md` (date and task ID of the handoff being archived).
- Then replace `handoffs/latest-handoff.md` with the new handoff only — do not prepend.
- Never rewrite an already-archived handoff; archived files are immutable history.
- Full handoff history remains available via Git and via `handoffs/archive/`.

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

---

## Resolution Knowledge-Growth Invariants (Binding)

Agents changing Resolver, AI interpretation, search planning, Food Catalog, personal cache/memory,
corrections, knowledge candidates, promotion, review, or food-resolution benchmarks MUST read
[`docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`](docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md).
AI outputs are observations, not canonical facts, and AI MUST NOT provide authoritative nutrients.
Personal and global knowledge MUST remain separate; unreviewed global candidates MUST have no
resolver effect, and global activation requires explicit human review. User corrections override
unconfirmed AI/resolver results. Negative Knowledge is permitted. Personal raw text MUST NOT be
silently globalized.
