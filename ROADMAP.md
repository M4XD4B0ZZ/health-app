# HealthApp 6 Master Roadmap (SSOK)

Architecture: Clean Architecture + Feature-First + Deterministic-First Nutrition Engine

> OpenCode CLI worker integration ("Phase C") is implemented and documented in
> `scripts/agent/README.md` — it predates the Tier system below and is no longer
> tracked here to avoid duplicate/stale planning content.

## DACH Data Strategy – Generic vs Branded Separation

### 1. Problem Statement

- Generische Lebensmittel sind kulturell nicht eindeutig (z.B. quark, schmand, curd)
- Internationale Datenquellen (USDA) führen zu semantisch falschen Matches
- Mittelwertbildung über mehrere Quellen ist nicht zulässig (unterschiedliche Produktklassen)

### 2. Core Principle

- "Locale-first truth before global approximation"
- Deutsche Inputs müssen gegen deutsche Produktrealität aufgelöst werden
- Klassifikation vor Datenwahl (nicht andersrum)

### 3. Data Layer Separation

#### Generic Foods (z.B. quark, ei, toast, schmand)

Priority:

1. DACH Generic Source (BLS – Bundeslebensmittelschlüssel)
2. OFF (nur wenn plausibel und generisch)
3. USDA als Fallback
4. AI nur als Mapping, nicht als Makroquelle

Definition:

- Canonical Food Layer bleibt bestehen
- Wird erweitert um DACH-validierte Referenzwerte

#### Branded / Packaged Foods

Priority:

1. OFF (DE/DACH filtered)
2. User Cache
3. später eigener Supabase DACH Cache

### 4. Ranking Adjustments

Für locale = de:

- - Score Boost für:
  * deutsche Namen / Aliases
  * generische DACH-Produkte
  * plausible Standard-Makros

- − Penalty für:
  - Dessert-/Fruchtvarianten
  - Protein-/Fitnessprodukte
  - internationale Surrogate (curd, cottage cheese)
  - implausible Makros

### 5. Resolver Decision Rule

Wenn:

- input = generic
- locale = de
- hoher Match auf DACH-Generic vorhanden

Dann:

- skip USDA
- akzeptiere DACH Source als truth

Wenn:

- mehrere plausible Treffer
  → status = ambiguous (kein blindes accept)

### 6. No-Average Rule

- Keine Mittelwertbildung über mehrere Quellen
- Jede Quelle wird einzeln bewertet
- Entscheidung basiert auf best match + plausibility, nicht Durchschnitt

### 7. Future Extension (optional, kein Scope jetzt)

- Aufbau eines eigenen DACH Canonical Cache (Supabase)
- Traffic-driven self-improving dataset
- Cross-source validation nur für Ranking, nicht für averaging

---

## SSOK Rules

- **ROADMAP.md is the Single Source of Knowledge (SSOK) for all planned and completed work.**
- Every task must have a stable ID, a status, and a Definition of Done.
- Task IDs are never reused. Completed tasks are marked `done`, never deleted.
- Larger epics must be broken into concrete, verifiable tasks.
- Task descriptions must be specific and checkable 6 not vague goals.
- No task may be marked `done` without passing verification (see VERIFY.md).

### Status values

| Status        | Meaning                           |
| ------------- | --------------------------------- |
| `todo`        | Planned, not started              |
| `in_progress` | Actively being worked on          |
| `blocked`     | Waiting on dependency or decision |
| `done`        | Completed and verified            |

---

## Ralph-Loop Governance / Overnight Worker

### RALPH-034V Docs-Only Verification Hardening

Status: `done`

Harden the supervised docs-only executor after the first real docs-only smoke write so BOM-related input/content ambiguity and validation diagnostics are handled deterministically.

**Scope:**

- Add explicit BOM-safe JSON operation input handling.
- Add explicit Markdown content BOM policy.
- Improve deterministic validation reason codes and operator-facing error messages for BOM/content failures.
- Add focused smoke/regression tests for docs-only executor behavior discovered during RALPH-034U.
- Preserve dry-run default, explicit `--write-docs-only`, exactly-one-file behavior, no overwrite behavior, and direct Markdown-only writes under `docs/`, `plans/`, or `reports/`.

**DoD:**

- BOM-prefixed JSON operation input is handled deterministically.
- Markdown content starting with a BOM is refused with a clear reason code/message.
- Focused regression tests cover the RALPH-034U docs-only smoke scenario.
- Existing docs-only executor safety boundaries remain unchanged.
- Required focused syntax/test checks pass and git readbacks show only approved files changed.

---

### RALPH-035A Runtime State Write Planning

Status: `done`

Plan the next safe step for runtime state writes in the Ralph-Loop / Overnight Worker workflow before any implementation mutates runtime state.

**Scope:**

- Identify which runtime paths may ever be writable by RALPH.
- Distinguish planning authority, runtime execution state, evidence, review state, and sandbox-only state.
- Define allowed files, forbidden files, validation requirements, and stop conditions for future runtime-state mutation.
- Produce a plan only; do not implement runtime state writes in this task.

**DoD:**

- Runtime state write boundaries are explicitly documented.
- Planning authority remains `ROADMAP.md`; runtime state files do not override roadmap task authority.
- Future implementation boundaries, validation requirements, and review gates are defined.
- No runtime state write implementation is performed.

---

### RALPH-035B Sandbox Runtime-State Write Probe

Status: `done`

Implement the smallest possible supervised sandbox runtime-state write proving that Ralph tooling can create exactly one non-authoritative runtime-state probe file without touching canonical runtime, evidence, governance, product, package, or handoff state.

**Scope:**

- Add a sandbox-only runtime write capability under `.agent/runtime/sandbox/`.
- Use exactly one fixed create-only target:
  `.agent/runtime/sandbox/ralph-035b-simulated-state.json`
- Write exactly:
  `{ "simulated": true }`
- Require explicit write authorization; dry-run must remain the default behavior.
- Refuse overwrite, append, truncate, arbitrary output paths, path traversal, absolute paths, drive-qualified paths, and symlink/scope escapes where applicable.
- Keep canonical state and evidence read-only for this task:
  `tasks/**`, `runs/**`, `validation/**`, `review/**`, `handoffs/**`.
- Do not modify planning/governance authority except for task status updates:
  `ROADMAP.md`, `SSOK.md`, `AGENTS.md`, `VERIFY.md`, `.governance/**`.
- Do not modify product, package, dependency, Supabase, env, git, or legacy adapter files.

**DoD:**

- Dry-run mode produces a deterministic plan and writes no files.
- Explicit write mode creates exactly one sandbox JSON file at the fixed allowed path.
- The sandbox JSON parses and matches exactly `{ "simulated": true }`.
- Existing canonical runtime/evidence/governance/product/package/handoff scopes remain unchanged.
- Overwrite/path-escape/arbitrary-output attempts are refused.
- Focused syntax/test checks pass.
- Git readbacks show only approved RALPH-035B files changed.
- No staging, commit, push, dependency install, formatter, fixer, deploy, or external mutation is performed by the implementation task.

---

### RALPH-035C Sandbox Runtime-State Smoke Execution

Status: `done`

Perform the first supervised real sandbox runtime-state write using the RALPH-035B writer, creating exactly one non-authoritative sandbox JSON artifact in the repository for human review.

**Scope:**

- Execute the RALPH-035B sandbox writer in explicit write mode.
- Create exactly one fixed sandbox artifact:
  `.agent/runtime/sandbox/ralph-035b-simulated-state.json`
- The artifact content must parse and match exactly:
  `{ "simulated": true }`
- Confirm no canonical runtime, evidence, governance, product, package, validation, review, handoff, git, or deployment state was mutated.
- Do not modify scripts or tests.
- Do not modify product/package/Supabase/governance files except `ROADMAP.md` task status updates.
- Do not stage, commit, push, deploy, install dependencies, run formatters, or run fix commands.

**DoD:**

- Pre-smoke working tree is clean.
- Dry-run output confirms planned sandbox write and writes no files.
- Explicit write mode creates exactly one sandbox artifact at the fixed allowed path.
- JSON readback confirms exact payload `{ "simulated": true }`.
- Git readbacks show only approved files changed:
  `ROADMAP.md`
  `.agent/runtime/sandbox/ralph-035b-simulated-state.json`
- Canonical runtime/evidence/governance/product/package/handoff scopes remain unchanged.
- No staging, commit, push, deploy, dependency install, formatter, fixer, or external mutation is performed by the smoke task.

---

### RALPH-036A Controlled Command Capability Planning

Status: `done`

Plan the first safe command-execution capability for the Ralph-Loop / Overnight Worker workflow before any command runner is implemented.

**Scope:**

- Define which commands may ever be allowed in an initial read-only command sandbox.
- Separate read-only inspection commands from mutation-capable commands.
- Propose an allowlist for future command execution, such as:
  `git --no-pager status --short`
  `git --no-pager diff --stat`
  `git --no-pager diff --name-only`
  `node --check <allowlisted file>`
  `node --test <allowlisted test file>`
- Define explicitly forbidden commands, including:
  `git push`, `git reset`, `git clean`, `npm install`, formatters, fixers, deploy commands, destructive shell commands, package mutation, env mutation, and arbitrary shell execution.
- Define validation requirements, output capture limits, timeout behavior, and stop conditions for a later implementation task.
- Produce a plan only; do not implement command execution in this task.

**DoD:**

- Allowed command categories are documented.
- Forbidden command categories are documented.
- Output/readback limits and timeout expectations are documented.
- Future implementation boundaries and stop conditions are defined.
- No command runner is implemented.

---

### RALPH-036B Minimal Read-Only Command Sandbox

Status: `done`

Implement the first tightly bounded read-only command sandbox for the Ralph-Loop / Overnight Worker workflow without enabling arbitrary shell execution or mutation-capable commands.

**Scope:**

- Implement a distinct RALPH command sandbox CLI/lib/tests, separate from broader existing overnight command-runner behavior.
- Default behavior must be plan-only/no-spawn.
- Require explicit `--execute-readonly-command` before any command is spawned.
- Commands must be selected by stable command IDs, not arbitrary shell strings.
- Use `spawn` with `shell: false` and ignored stdin.
- Allow only the initial minimal command set:
  - `git --no-pager status --short`
  - `git --no-pager diff --stat`
  - `git --no-pager diff --name-only`
  - `node --check <fixed allowlisted RALPH-036B file>`
  - `node --test <fixed allowlisted RALPH-036B test file>`
- Use fixed allowlisted files for node checks/tests; no arbitrary paths, globs, regexes, package scripts, `npx`, npm, formatters, fixers, deploys, or network commands.
- Enforce timeout limits, stdout/stderr byte limits, structured result schema, exit-code handling, and output-truncation/blocking behavior.
- Reject shell wrappers, shell-control operators, interpolation, redirects, pipes, unknown flags, user-supplied executable paths, env-printing commands, network commands, package managers, and git mutation commands.
- Do not stage, commit, push, deploy, install dependencies, run formatters/fixers, or mutate runtime/evidence/governance/product/package/handoff state.

**DoD:**

- Dry-run/plan-only mode returns a deterministic command execution plan and spawns no process.
- Explicit execute mode runs only allowlisted read-only/deterministic commands.
- Unknown/mutation-capable/shell/network/package/git-write commands are refused before spawn.
- Output capture limits, timeout handling, nonzero-exit handling, and structured result schema are covered by focused tests.
- Tests use harmless temp/fixture commands only where possible and do not mutate repository state.
- Focused `node --check` and `node --test` verification passes.
- Git readbacks show only approved RALPH-036B files changed.
- No staging, commit, push, deploy, dependency install, formatter, fixer, or external mutation is performed by the implementation task.

---

### RALPH-036C Read-Only Command Smoke Execution

Status: `done`

Perform the first supervised real execution of the RALPH-036B read-only command sandbox using only the existing approved allowlist.

**Scope:**

- Execute each currently approved RALPH-036B command ID:
  - git_status_short
  - git_diff_stat
  - git_diff_name_only
  - node_check_self
  - node_check_cli
  - node_test_self
- Verify all commands execute through the sandbox and return structured results.
- Verify no file writes occur.
- Verify no runtime/evidence/governance/product/package/handoff mutation occurs.
- Verify no staging, commit, push, deploy, install, formatter, fixer, or network activity occurs.
- Produce readback evidence only.
- Do not expand the allowlist.
- Do not modify sandbox behavior.

**DoD:**

- Pre-smoke working tree is clean.
- All approved command IDs execute successfully through the sandbox.
- Structured results are captured for each command.
- No repository files are modified except ROADMAP status updates.
- No protected scopes are modified.
- No staging, commit, push, deploy, install, formatter, fixer, or network activity occurs.

### RALPH-037A Review Evidence Bundle Planning

Status: `done`

Plan a standardized review-evidence bundle for future Ralph-Loop / Overnight Worker tasks so human review can rely on consistent evidence instead of agent summaries.

**Scope:**

- Define the minimum evidence required before task completion.
- Define mandatory git readbacks.
- Define required verification evidence.
- Define protected-scope status evidence.
- Define evidence retention and report structure.
- Define what constitutes commit readiness.
- Define bundle size limits and summarization rules.
- Define stop conditions for missing or inconsistent evidence.
- Produce a plan only.
- Do not implement bundle generation.

**DoD:**

- Required evidence categories are documented.
- Required git readbacks are documented.
- Verification evidence requirements are documented.
- Protected-scope evidence requirements are documented.
- Commit-readiness requirements are documented.
- Stop conditions are documented.
- No implementation is performed.

---

### RALPH-037B Minimal Review Evidence Bundle Generator

Status: `done`

Implement the smallest safe review-evidence bundle generator so future Ralph-Loop tasks can produce consistent, bounded evidence for human review without relying on agent summaries.

**Scope:**

- Add a testable library for review evidence bundle generation.
- Add a thin CLI wrapper.
- Dry-run/read-only behavior must be the default.
- Generate structured JSON and human-readable Markdown output to stdout by default.
- Include mandatory git readbacks:
  - `git --no-pager status --short`
  - `git --no-pager log -1 --oneline`
  - `git --no-pager diff --stat`
  - `git --no-pager diff --name-only`
  - `git --no-pager diff --cached --name-only`
  - `git --no-pager diff --cached --stat`
- Include changed-file classification.
- Include protected/approval-required scope classification from `.agent/config/protected-files.json`.
- Include verification evidence placeholders and missing-required-check reporting.
- Include claim-vs-actual changed-file reconciliation.
- Include commit-readiness evaluation.
- Enforce bounded output and explicit truncation metadata.
- Use fixed read-only git command IDs only; no arbitrary shell strings.
- Use `spawn` with `shell: false`, ignored stdin, timeout, stdout/stderr limits.
- Do not run broad verification commands.
- Do not stage, commit, push, deploy, install dependencies, run formatters/fixers, mutate runtime/evidence/governance/product/package/handoff state, or write review JSONL.

**DoD:**

- Dry-run JSON bundle is schema-valid and deterministic.
- Dry-run Markdown bundle is deterministic and human-readable.
- Git readbacks are included with exit codes and bounded output.
- Staged file list is included.
- Changed files are categorized.
- Protected/approval-required matches are reported.
- Claim-vs-actual mismatches are reported.
- Commit-readiness blocks on missing required evidence, failed command evidence, protected changes, staged files when disallowed, or claim/file mismatch.
- Focused `node --check` and `node --test` checks pass.
- Git readbacks show only approved RALPH-037B files changed.
- No staging, commit, push, deploy, dependency install, formatter, fixer, or external mutation is performed by the implementation task.

---

### RALPH-038A Controlled Mutation Planning

Status: `done`

Plan the first controlled mutation capability for the Ralph-Loop / Overnight Worker workflow without implementing mutation behavior.

**Scope:**

- Define the smallest safe mutation Ralph may perform.
- Define eligible and permanently forbidden file scopes.
- Define explicit approval, dry-run, execute, evidence, rollback, protected-file, validation, command-sandbox, and review-bundle interaction requirements.
- Define immediate stop conditions for mutation attempts.
- Define the follow-up implementation task RALPH-038B.
- Planning only; no scripts, tests, runtime state, governance files, staging, commits, or pushes.

**DoD:**

- Required git evidence commands were run and documented:
  - `git --no-pager status --short`
  - `git --no-pager log -5 --oneline`
  - `git --no-pager diff --stat`
  - `git --no-pager diff --name-only`
- Canonical governance and verification files were reviewed:
  - `ROADMAP.md`
  - `VERIFY.md`
  - `AGENTS.md`
  - `SSOK.md`
  - `.governance/SAFETY.md`
  - `.governance/REVIEW_POLICY.md`
  - `.agent/config/protected-files.json`
- Prior mutation-adjacent Ralph work was inspected, including RALPH-035A, RALPH-035B, RALPH-035C, RALPH-036B, and RALPH-037B.
- The recommended first mutation is a single fixed create-only non-authoritative report artifact under `reports/`.
- RALPH-038B implementation boundaries and exclusions are defined.
- No implementation or file modification was performed.

---

### RALPH-038B Minimal Controlled Report Mutation Smoke

Status: `done`

Implement the first controlled Ralph mutation capability as a tightly bounded, human-reviewable, create-only report artifact mutation. This task proves Ralph can perform one explicit, non-authoritative, single-file write under `reports/` without authorizing product, runtime, governance, evidence, package, Git, deployment, or arbitrary file mutation.

**Scope:**

- Add a distinct controlled report mutation CLI/lib/tests.
- Dry-run must be the default and must write no files.
- Require explicit `--execute-controlled-mutation` before any write.
- Allow exactly one fixed mutation target:
  `reports/RALPH-038B_CONTROLLED_MUTATION_SMOKE_REPORT.md`
- Write only deterministic Markdown content defined by the implementation.
- Operation must be create-only; refuse overwrite, append, truncate, delete, rename, move, arbitrary paths, path traversal, absolute paths, drive-qualified paths, and symlink/scope escapes.
- Validate target path against protected-file policy before writing.
- Capture pre-mutation evidence and post-mutation evidence using fixed read-only git readbacks.
- Read back the created file and verify exact content/hash match.
- Reconcile expected changed files against actual changed files; expected actual change is exactly the fixed report path.
- Return structured JSON and human-readable output to stdout.
- Stop for human review after mutation evidence is produced.

**Explicitly excluded:**

- No autonomous commits, staging, pushes, deploys, dependency installs, formatters, fixers, or network operations.
- No product code mutation target.
- No runtime state mutation under `tasks/**` or `runs/**`.
- No validation/review/handoff evidence writes under `validation/**`, `review/**`, or `handoffs/**`.
- No governance mutation under `ROADMAP.md`, `SSOK.md`, `AGENTS.md`, `VERIFY.md`, or `.governance/**` except normal task status updates if explicitly performed by a human/agent task workflow.
- No package/config/Supabase mutation.
- No arbitrary output paths or arbitrary content input.
- No multi-file mutation.
- No overwrite/edit-existing-file capability.
- No rollback automation beyond documenting rollback evidence requirements.
- Do not expand the RALPH-036B read-only command sandbox into a write-capable sandbox.

**DoD:**

- Dry-run mode produces a deterministic mutation plan and writes no files.
- Explicit execute mode creates exactly one report file at:
  `reports/RALPH-038B_CONTROLLED_MUTATION_SMOKE_REPORT.md`
- Created report content matches the exact expected Markdown payload/hash.
- Overwrite/path-escape/arbitrary-path/protected-target attempts are refused before write.
- Pre- and post-mutation git readbacks are captured and bounded.
- Changed-file reconciliation reports exactly the fixed report path and no other mutation target.
- Protected-file classification reports no protected or approval-required changes.
- Focused `node --check` and `node --test` checks pass for the new controlled mutation tool.
- Git readbacks show only approved RALPH-038B files changed.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, runtime/evidence/governance/product/package/handoff mutation, or external side effect is performed.

---

### RALPH-038C Controlled Mutation Evidence Integration

Status: `done`

Validate that controlled mutations and review-evidence generation work together correctly and that mutation evidence can be independently reviewed without relying on agent summaries.

**Scope:**

- Use the existing review-evidence bundle system.
- Generate evidence for the completed RALPH-038B mutation.
- Verify claim-vs-actual changed-file reconciliation.
- Verify protected-scope classification.
- Verify approval-required classification.
- Verify commit-readiness evaluation.
- Verify bundle output remains bounded and deterministic.
- Verify mutation evidence can be reviewed without relying on agent claims.
- Produce evidence only.
- Do not introduce new mutation capabilities.

**DoD:**

- Review-evidence bundle successfully evaluates the RALPH-038B mutation.
- Claim-vs-actual reconciliation behaves correctly.
- Protected-scope classification behaves correctly.
- Commit-readiness output is produced.
- No product/runtime/governance/package mutation occurs.
- No new mutation capabilities are added.

---

### RALPH-039A Task Admission Planning

Status: `done`

Plan the task-admission model that determines which future tasks may enter the Ralph Overnight queue and under which review requirements.

**Scope:**

- Define deterministic task classes:
  - `SAFE_AUTONOMOUS`
  - `REVIEW_REQUIRED`
  - `HUMAN_ONLY`
  - `FORBIDDEN`
- Define allowed actions, forbidden actions, required evidence, verification requirements, commit/push policy, review requirements, and stop conditions for each class.
- Define path-based, task-type, verification-category, diff-size, and protected-file classification signals.
- Define automatic rejection rules.
- Define minimum metadata required before overnight queue admission.
- Define the follow-up implementation task RALPH-039B.
- Planning only; no classifier implementation, queue mutation, runtime state mutation, staging, commits, or pushes.

**DoD:**

- Required read-only evidence commands were run and documented:
  - `git --no-pager status --short`
  - `git --no-pager log -5 --oneline`
- Canonical authority and safety files were reviewed:
  - `ROADMAP.md`
  - `VERIFY.md`
  - `AGENTS.md`
  - `SSOK.md`
  - `.governance/SAFETY.md`
  - `.governance/REVIEW_POLICY.md`
  - `.agent/config/protected-files.json`
- Relevant prior Ralph tasks were inspected:
  - RALPH-034\*
  - RALPH-035\*
  - RALPH-036\*
  - RALPH-037\*
  - RALPH-038\*
- Admission classes, criteria, escalation rules, rejection rules, evidence requirements, and minimum metadata were defined.
- RALPH-039B implementation boundaries are defined.
- No implementation or file modification was performed.

---

### RALPH-039B Minimal Task Admission Classifier

Status: `done`

Implement a read-only deterministic task-admission classifier that evaluates task metadata and decides whether a future task may enter the Ralph Overnight queue.

**Scope:**

- Add a distinct classifier CLI/lib/tests.
- Classify tasks into:
  - `SAFE_AUTONOMOUS`
  - `REVIEW_REQUIRED`
  - `HUMAN_ONLY`
  - `FORBIDDEN`
- Input should be bounded task metadata JSON.
- Output structured JSON and human-readable summary to stdout.
- Default behavior must be read-only and must not mutate queue, runtime, evidence, review, handoff, governance, product, package, or Git state.
- Evaluate:
  - task ID and ROADMAP-backed identity
  - task type
  - allowed files
  - forbidden files
  - expected changed files
  - protected-file matches
  - approval-required matches
  - verification category from `VERIFY.md`
  - required checks
  - forbidden actions
  - review requirement
  - commit policy
  - push policy
  - diff/file-count thresholds
  - missing metadata
- Fail closed: ambiguous or incomplete metadata must not be classified as `SAFE_AUTONOMOUS`.
- Produce reason codes, matched signals, escalation/rejection rationale, required evidence, required verification, stop conditions, and admission allowed/blocked output.

**Explicitly excluded:**

- No task execution.
- No queue mutation.
- No runtime state writes.
- No validation/review/handoff JSONL writes.
- No staging, commits, pushes, deploys, dependency installs, formatters, fixers, or network operations.
- No product code changes.
- No package/config/Supabase changes.
- No mutation capability expansion.
- No automatic ROADMAP edits by the classifier.

**DoD:**

- Docs-only safe task classifies as `SAFE_AUTONOMOUS`.
- Agent tooling task classifies as `REVIEW_REQUIRED`.
- Product-code task classifies as `HUMAN_ONLY`.
- `.env` or secret mutation classifies as `FORBIDDEN`.
- Push/deploy/network/destructive shell action classifies as `FORBIDDEN`.
- Package/dependency changes without explicit approval do not classify as `SAFE_AUTONOMOUS`.
- Protected and approval-required file matching works.
- Missing/ambiguous metadata fails closed.
- Multiple verification categories choose the strictest classification.
- Diff/file-count thresholds escalate classification.
- Focused `node --check` and `node --test` checks pass.
- Git readbacks show only approved RALPH-039B files changed.
- No staging, commit, push, deploy, dependency install, formatter, fixer, queue/runtime/evidence/review/handoff/governance/product/package mutation, or external side effect is performed.

---

### RALPH-039C Task Admission Smoke Evaluation

Status: `done`

Validate the RALPH-039B task-admission classifier against representative task metadata fixtures before integrating admission decisions into any queue or worker flow.

**Scope:**

- Use the existing RALPH-039B task-admission classifier.
- Evaluate representative metadata fixtures for:
  - docs/report-only task expected as `SAFE_AUTONOMOUS`
  - agent tooling task expected as `REVIEW_REQUIRED`
  - product-code task expected as `HUMAN_ONLY`
  - `.env` or secret-touching task expected as `FORBIDDEN`
  - package/dependency task expected as not `SAFE_AUTONOMOUS`
- Capture expected vs actual classification.
- Capture reason codes and admission flags.
- Produce a concise smoke report:
  `reports/RALPH-039C_TASK_ADMISSION_SMOKE_REPORT.md`
- Do not modify classifier behavior.
- Do not add queue integration.
- Do not mutate runtime, evidence, review, handoff, governance, product, package, or Git state except the allowed report artifact and later ROADMAP status update.

**DoD:**

- All representative fixtures are evaluated through the classifier.
- Expected vs actual classifications are documented.
- All expected classifications pass.
- Reason codes are captured where relevant.
- Smoke report is created under `reports/`.
- No classifier logic changes are made.
- No queue, runtime-state, worker, review JSONL, validation JSONL, handoff, product, package, governance, deploy, push, or external mutation is performed.

---

### RALPH-040A Queue Admission Planning

Status: `done`

Plan how classified Ralph tasks may be admitted into a future Overnight queue without yet mutating queue/runtime state.

**Scope:**

- Define how `SAFE_AUTONOMOUS`, `REVIEW_REQUIRED`, `HUMAN_ONLY`, and `FORBIDDEN` classifications map to queue admission decisions.
- Define required task metadata before a task can be considered for queue admission.
- Define queue-entry schema requirements for a future implementation.
- Define which files may eventually hold queue entries.
- Define which files must remain read-only or forbidden.
- Define how queue admission must interact with:
  - task-admission classifier
  - review evidence bundles
  - command sandbox
  - controlled mutation tools
  - protected-file policy
  - `ROADMAP.md` planning authority
- Define evidence required before queue admission.
- Define stop conditions that block queue admission.
- Define the safest follow-up implementation task.
- Planning only; do not implement queue admission or write queue entries.

**DoD:**

- Queue admission rules are documented.
- Classification-to-admission mapping is documented.
- Required queue-entry metadata is documented.
- Queue-entry storage boundaries are documented.
- Runtime/state authority boundaries are documented.
- Evidence requirements are documented.
- Stop conditions are documented.
- Follow-up implementation task is defined.
- No queue/runtime/evidence/review/handoff mutation is performed.
- No implementation is performed.

---

### RALPH-040B Queue Admission Validator

Status: `done`

Implement the first read-only queue-admission validator for classified Ralph tasks. The validator determines whether a candidate task would be admissible to a future Overnight queue, but must not write queue entries or mutate runtime/evidence/review/handoff state.

**Scope:**

- Add a distinct queue-admission validator CLI/lib/tests.
- Default behavior must be read-only and stdout-only.
- Accept bounded task/admission metadata JSON from an explicit input path or argument.
- Consume existing RALPH-039B task-admission classifier output or invoke classifier logic in-process without mutation.
- Map classifications to admission decisions:
  - `SAFE_AUTONOMOUS` → `admissible`
  - `REVIEW_REQUIRED` → `requires_review_before_queue`
  - `HUMAN_ONLY` → `human_only`
  - `FORBIDDEN` → `rejected`
- Validate minimum queue-entry metadata:
  - `queue_entry_id`
  - `task_id`
  - `classification`
  - `admission_decision`
  - `allowed_files`
  - `expected_changed_files`
  - `required_checks`
  - `evidence_requirements`
  - `review_requirement`
  - `commit_policy`
  - `push_policy`
  - `stop_conditions`
  - deterministic `created_at` placeholder or injected timestamp
  - non-authoritative statement
- Produce a deterministic queue-entry preview only; do not write it.
- Validate protected-file and approval-required matches using `.agent/config/protected-files.json`.
- Require clean pre-admission git evidence and no staged files.
- Validate metadata completeness, expected-file completeness, required-check declarations, and stop-condition declarations.
- Return structured JSON and human-readable summary to stdout.
- Include reason codes, blocking findings, evidence requirements, and admission decision.

**Explicitly excluded:**

- No queue entry writes.
- No mutation under `.agent/overnight/**` or `.agent/runtime/sandbox/**` in this task.
- No mutation under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No ROADMAP/governance/product/package/Supabase mutation except a later authorized ROADMAP status update.
- No task execution, worker invocation, adapter invocation, model invocation, prompt execution, validation execution, network access, deploy, dependency install, formatter, fixer, staging, commit, or push.
- No arbitrary shell command execution.

**DoD:**

- `SAFE_AUTONOMOUS` fixture with complete metadata and clean protected scope returns `admissible`.
- `REVIEW_REQUIRED` fixture returns `requires_review_before_queue` and is not executable.
- `HUMAN_ONLY` fixture returns `human_only` and is not queued for autonomous execution.
- `FORBIDDEN` fixture returns `rejected`.
- Missing metadata fails closed as `rejected` or non-admissible with clear reason codes.
- Protected-file match blocks admission.
- Approval-required unresolved match blocks direct `admissible` admission.
- Dirty tree and staged files block admission.
- Existing queue-entry collision blocks create-only future admission.
- Queue-entry preview is deterministic and includes a non-authoritative statement.
- Focused `node --check` and `node --test` checks pass for the new validator.
- Git readbacks show only approved RALPH-040B implementation/test files changed.
- No queue/runtime/evidence/review/handoff mutation, staging, commit, push, deploy, dependency install, formatter, fixer, or external side effect is performed.

---

### RALPH-040C Queue Admission Validator Smoke Evaluation

Status: `done`

Validate the RALPH-040B queue-admission validator against representative admission fixtures before any queue-entry write capability is planned or implemented.

**Scope:**

- Use the existing RALPH-040B queue-admission validator.
- Evaluate representative metadata/admission fixtures for:
  - `SAFE_AUTONOMOUS` expected as `admissible`
  - `REVIEW_REQUIRED` expected as `requires_review_before_queue`
  - `HUMAN_ONLY` expected as `human_only`
  - `FORBIDDEN` expected as `rejected`
  - dirty-tree signal expected as blocked/rejected
  - staged-files signal expected as blocked/rejected
  - protected-file match expected as blocked/rejected
  - queue-entry collision expected as blocked/rejected
- Capture expected vs actual admission decisions.
- Capture admission flags, reason codes, and queue-entry preview IDs.
- Produce a concise smoke report:
  `reports/RALPH-040C_QUEUE_ADMISSION_VALIDATOR_SMOKE_REPORT.md`
- Do not modify validator behavior.
- Do not add queue integration.
- Do not write queue entries.
- Do not mutate runtime, evidence, review, handoff, governance, product, package, or Git state except the allowed report artifact and later ROADMAP status update.

**DoD:**

- All representative fixtures are evaluated through the validator.
- Expected vs actual admission decisions are documented.
- All expected decisions pass.
- Reason codes and preview IDs are captured where relevant.
- Smoke report is created under `reports/`.
- No validator logic changes are made.
- No queue-entry write capability is added.
- No queue, runtime-state, worker, review JSONL, validation JSONL, handoff, product, package, governance, deploy, push, or external mutation is performed.

---

### RALPH-041A Controlled Queue Entry Write Planning

Status: `done`

Plan the first controlled queue-entry write capability for the Ralph-Loop / Overnight Worker workflow without implementing or performing any queue/runtime mutation.

**Scope:**

- Define the smallest safe queue-entry write Ralph may eventually perform.
- Define why canonical runtime paths such as `tasks/**`, `runs/**`, `validation/**`, `review/**`, and `handoffs/**` must remain read-only for the first queue-entry write.
- Define the safest initial queue-entry storage boundary, likely under a sandbox-only non-authoritative path such as:
  `.agent/runtime/sandbox/queue-admission/`
- Define whether the first write should use a fixed path or a task-scoped deterministic path.
- Define minimum queue-entry JSON schema requirements.
- Define required dry-run behavior.
- Define explicit execute/write authorization requirements.
- Define create-only/no-overwrite semantics.
- Define path containment and protected-file checks.
- Define pre-write evidence requirements.
- Define post-write evidence requirements.
- Define rollback/readback evidence requirements.
- Define how queue-entry writes must interact with:
  - task-admission classifier
  - queue-admission validator
  - review evidence bundle
  - command sandbox
  - controlled mutation tool patterns
  - protected-file policy
  - `ROADMAP.md` planning authority
- Define stop conditions that block queue-entry writes.
- Define the safest follow-up implementation task.
- Planning only; do not implement a queue writer and do not write queue entries.

**DoD:**

- Safe queue-entry write boundary is documented.
- Canonical runtime/evidence/handoff paths that must remain read-only are documented.
- Initial storage path recommendation is documented.
- Queue-entry schema requirements are documented.
- Dry-run, explicit write flag, create-only, no-overwrite, path containment, and protected-file requirements are documented.
- Pre-write, post-write, rollback, and review evidence requirements are documented.
- Interactions with classifier, validator, evidence bundle, command sandbox, mutation tool patterns, protected-file policy, and ROADMAP authority are documented.
- Stop conditions are documented.
- Follow-up implementation task is defined.
- No queue/runtime/evidence/review/handoff mutation is performed.
- No implementation is performed.

---

### RALPH-041B Minimal Sandbox Queue Entry Write Probe

Status: `done`

Implement the first controlled sandbox queue-entry write probe for the Ralph-Loop / Overnight Worker workflow. This task proves Ralph can create exactly one non-authoritative queue-entry JSON artifact under a sandbox-only path without mutating canonical runtime, evidence, review, handoff, governance, product, package, or Git state.

**Scope:**

- Add a distinct sandbox queue-entry writer CLI/lib/tests.
- Dry-run must be the default and must write no files.
- Require explicit write authorization before any file is created.
- Allow exactly one fixed sandbox target:
  `.agent/runtime/sandbox/queue-admission/ralph-041b-queue-entry-probe.json`
- Write deterministic JSON content only.
- The queue entry must be explicitly non-authoritative and sandbox-only.
- Minimum payload must include:
  - `schema_version`
  - `queue_entry_id`
  - `task_id`
  - `sandbox`
  - `non_authoritative`
  - `classification`
  - `admission_decision`
  - `created_by`
  - `non_authoritative_statement`
- Operation must be create-only.
- Refuse overwrite, append, truncate, delete, rename, move, arbitrary paths, path traversal, absolute paths, drive-qualified paths, and symlink/scope escapes.
- Validate target path against protected-file policy before writing.
- Validate expected JSON schema before writing.
- Read back the created file and verify exact content/hash match.
- Capture pre-write and post-write git evidence.
- Reconcile expected changed files against actual changed files.
- Stop for human review after write evidence is produced.

**Explicitly excluded:**

- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No writes under `.agent/overnight/**`.
- No canonical runtime/evidence/review/handoff mutation.
- No queue execution.
- No worker execution.
- No task execution.
- No validation JSONL writes.
- No review JSONL writes.
- No ROADMAP/governance/product/package/Supabase mutation except a later authorized ROADMAP status update.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell command execution.
- No approval, review acceptance, validation pass, task done, committed, pushed, deployed, or runtime-authority claims.

**DoD:**

- Dry-run mode produces a deterministic write plan and writes no files.
- Explicit write mode creates exactly one JSON file at:
  `.agent/runtime/sandbox/queue-admission/ralph-041b-queue-entry-probe.json`
- Created JSON parses and matches the expected schema.
- Created JSON declares `sandbox: true` and `non_authoritative: true`.
- Created JSON includes no authority/evidence/approval claims.
- Target path containment is enforced.
- Overwrite/path-escape/arbitrary-path/protected-target attempts are refused before write.
- Readback/hash verification passes.
- Git readbacks show only approved RALPH-041B files changed.
- Focused `node --check` and `node --test` checks pass for the new writer.
- No queue/runtime/evidence/review/handoff/canonical mutation, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, worker execution, task execution, or external side effect is performed.

---

### RALPH-041C Sandbox Queue Entry Write Evidence Integration

Status: `done`

Validate that the RALPH-041B sandbox queue-entry write can be independently reviewed through bounded evidence without relying on agent summaries or introducing new queue/runtime authority.

**Scope:**

- Use the existing RALPH-041B sandbox queue-entry artifact:
  `.agent/runtime/sandbox/queue-admission/ralph-041b-queue-entry-probe.json`
- Use the existing review-evidence bundle system in read-only/stdout mode.
- Read back and validate the sandbox queue-entry artifact.
- Confirm the artifact is sandbox-only and non-authoritative.
- Confirm the artifact does not authorize queue execution, worker execution, runtime authority, evidence mutation, review acceptance, validation pass, task completion, staging, commit, push, deploy, dependency install, network access, or product work.
- Capture git readback evidence.
- Capture artifact readback/hash/JSON validation evidence.
- Capture review-evidence bundle behavior:
  - git readbacks
  - changed-file classification
  - protected/approval-required classification
  - claim-vs-actual reconciliation
  - verification evidence status
  - commit-readiness status
  - bounded output/truncation status
- Produce one report artifact:
  `reports/RALPH-041C_QUEUE_ENTRY_WRITE_EVIDENCE_INTEGRATION_REPORT.md`
- Do not modify queue writer, classifier, validator, or evidence-bundle behavior.
- Do not add queue integration.
- Do not write queue entries.
- Do not mutate canonical runtime, evidence, review, handoff, governance, product, package, or Git state except the allowed report artifact and later ROADMAP status update.

**Explicitly excluded:**

- No queue execution capability.
- No worker execution capability.
- No task execution.
- No runtime authority creation.
- No canonical queue creation under `.agent/overnight/**`.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No staging, commit, push, deploy, network, dependency install, formatter, fixer, or arbitrary shell execution.
- No claim that the sandbox queue entry authorizes execution, review acceptance, validation pass, task completion, commit readiness, push readiness, or runtime state mutation.

**DoD:**

- Required git evidence is collected and documented.
- The RALPH-041B sandbox queue-entry artifact exists and parses as JSON.
- The artifact is confirmed sandbox-only and non-authoritative.
- The artifact contains no queue execution, worker execution, runtime authority, evidence mutation, review acceptance, validation pass, task completion, staging, commit, push, deploy, dependency install, network, or product-work authorization claims.
- The review-evidence bundle system evaluates the current working tree/evidence context in read-only/stdout mode.
- Bundle output includes git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, and commit-readiness status.
- Focused syntax/test checks pass.
- Report artifact is created under `reports/`.
- Post-run git evidence shows only approved RALPH-041C files changed, expected to be:
  `reports/RALPH-041C_QUEUE_ENTRY_WRITE_EVIDENCE_INTEGRATION_REPORT.md`
  plus `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged.
- No commit or push is performed during implementation.
- No canonical runtime/evidence/review/handoff/product/package/Supabase mutation occurs.
- No queue execution, worker execution, runtime authority, or canonical state mutation is introduced or claimed.

---

### RALPH-042A Sandbox Queue Entry Lifecycle Planning

Status: `done`

Plan the first sandbox queue-entry lifecycle model for the Ralph-Loop / Overnight Worker workflow without implementing lifecycle transitions or mutating queue/runtime/evidence/review/handoff state.

**Scope:**

- Define allowed sandbox queue-entry lifecycle states.
- Define explicitly forbidden lifecycle states and claims.
- Define allowed state transitions for sandbox-only entries.
- Define which transitions require human review.
- Define which transitions must remain impossible until later phases.
- Define how lifecycle state must remain non-authoritative and sandbox-only.
- Define where lifecycle state may eventually be represented.
- Define why canonical runtime/evidence/review/handoff paths must remain read-only:
  - `tasks/**`
  - `runs/**`
  - `validation/**`
  - `review/**`
  - `handoffs/**`
  - `.agent/overnight/**`
- Define evidence required before and after any lifecycle transition.
- Define rollback/readback requirements for transition artifacts.
- Define interaction with:
  - task-admission classifier
  - queue-admission validator
  - sandbox queue-entry writer
  - review evidence bundle
  - protected-file policy
  - `ROADMAP.md` planning authority
- Define stop conditions that block lifecycle transitions.
- Define the safest follow-up implementation task.
- Planning only; do not implement lifecycle transitions and do not write lifecycle artifacts.

**DoD:**

- Sandbox lifecycle states are documented.
- Forbidden states and authority claims are documented.
- Allowed transitions are documented.
- Human-review requirements are documented.
- Non-authoritative sandbox boundary is documented.
- Future storage boundary recommendation is documented.
- Canonical runtime/evidence/review/handoff paths that must remain read-only are documented.
- Pre-transition and post-transition evidence requirements are documented.
- Rollback/readback requirements are documented.
- Interactions with classifier, validator, writer, evidence bundle, protected-file policy, and ROADMAP authority are documented.
- Stop conditions are documented.
- Follow-up implementation task is defined.
- No lifecycle transition implementation is performed.
- No queue/runtime/evidence/review/handoff mutation is performed.

---

### RALPH-042B Sandbox Queue Entry Lifecycle Schema Probe

Status: `done`

Implement a minimal sandbox lifecycle schema and validation probe for sandbox queue-entry artifacts without enabling lifecycle execution, canonical queue admission, worker execution, task execution, or canonical runtime/evidence/review/handoff mutation.

**Scope:**

- Add lifecycle state constants for sandbox queue entries.
- Add forbidden lifecycle state constants.
- Add an allowed transition table for sandbox-only lifecycle states.
- Add a lifecycle validation helper.
- Validate that lifecycle metadata remains sandbox-only and non-authoritative.
- Validate that forbidden states and forbidden authority claims are rejected.
- Validate that allowed transitions are monotonic and evidence-gated.
- Integrate lifecycle metadata only into sandbox queue-entry writer dry-run output or deterministic sandbox payload if explicitly required by the implementation.
- Keep dry-run as the default.
- Keep create-only behavior for any explicit sandbox artifact write.
- Require explicit write authorization before any artifact is created.
- Preserve the existing non-authoritative statement requirement.
- Produce bounded structured output and human-readable output.
- Add focused tests for:
  - allowed lifecycle states
  - forbidden lifecycle states
  - allowed transitions
  - invalid transitions
  - forbidden authority claims
  - non-authoritative guarantees
  - dry-run writes=false
  - create-only protection
  - refusal of canonical authority claims
- Produce a report artifact:
  `reports/RALPH-042B_SANDBOX_QUEUE_ENTRY_LIFECYCLE_SCHEMA_PROBE_REPORT.md`

**Allowed sandbox boundary:**

- `.agent/runtime/sandbox/queue-admission/**`

**Explicitly excluded:**

- No canonical `.agent/overnight/**` queue entries.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution engine.
- No automatic lifecycle transitions.
- No validation/review JSONL writes.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No staging, commit, push, deploy, network, dependency install, formatter, fixer, or product-code mutation.
- No canonical runtime/evidence/review/handoff mutation.

**DoD:**

- Sandbox lifecycle states are defined.
- Forbidden lifecycle states are defined.
- Allowed transition table is defined.
- Lifecycle validation helper rejects invalid/forbidden states.
- Lifecycle validation helper rejects forbidden authority claims.
- Lifecycle metadata remains sandbox-only and non-authoritative.
- Dry-run output remains write-free.
- Any explicit artifact write remains create-only and sandbox-only.
- Focused `node --check` and `node --test` checks pass.
- Report artifact documents lifecycle states, transitions, rejected states, evidence, and no-authority guarantees.
- Git readbacks show only approved RALPH-042B files changed.
- No canonical queue/runtime/evidence/review/handoff mutation, queue execution, worker execution, task execution, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or product mutation is performed.

---

### RALPH-042C Sandbox Lifecycle Evidence Integration

Status: `done`

Demonstrate that the sandbox lifecycle schema can be evaluated through the existing review-evidence bundle workflow without introducing execution authority, lifecycle execution, queue execution, worker execution, runtime authority, review acceptance, validation authority, or canonical state mutation.

**Scope:**

- Evaluate lifecycle-schema evidence through the existing review-evidence bundle flow.
- Produce a report artifact:
  `reports/RALPH-042C_SANDBOX_LIFECYCLE_EVIDENCE_INTEGRATION_REPORT.md`
- Capture git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, and commit-readiness status.
- Confirm lifecycle outputs remain sandbox-only, non-authoritative, non-executing, and non-runtime-authoritative.
- Do not modify lifecycle, queue, worker, runtime, validation, review, handoff, product, package, Supabase, or governance behavior.

**Explicitly excluded:**

- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution engine.
- No lifecycle execution.
- No runtime authority.
- No review acceptance.
- No validation authority.
- No canonical state mutation.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, `handoffs/**`, or `.agent/overnight/**`.
- No staging, commit, push, deploy, network operation, dependency install, formatter, fixer, or product-code mutation.

**DoD:**

- Required read-only git evidence is captured.
- Existing lifecycle schema and review-evidence bundle files are inspected.
- Existing review-evidence bundle flow evaluates the lifecycle evidence path as dry-run/read-only/stdout-only evidence.
- Report artifact documents evidence summary, verification results, changed files, ROADMAP diff summary, protected scope status, and no-authority confirmations.
- Required focused `node --check` and `node --test` checks pass.
- Git readbacks show only approved RALPH-042C files changed.
- No files are staged.
- No commit or push is performed.

---

### RALPH-043A Runtime-Adjacent Sandbox Lifecycle Eligibility Planning

Status: `done`

Plan the first runtime-adjacent Ralph capability after sandbox lifecycle evidence integration without implementing runtime behavior, lifecycle execution, queue execution, worker execution, task execution, or canonical runtime/evidence/review/handoff mutation.

**Scope:**

- Define the safest first runtime-adjacent capability as a read-only sandbox lifecycle eligibility evaluation.
- Define what makes an existing sandbox lifecycle or queue-entry artifact eligible for further human consideration.
- Define required evidence gates before any runtime-adjacent action may be considered.
- Define authority boundaries that must remain intact:
  - `ROADMAP.md` as planning authority
  - `VERIFY.md` as verification authority
  - `.governance/SAFETY.md` as safety authority
  - runtime state files as execution state only, never planning authority
  - reports and sandbox artifacts as non-authoritative evidence only
- Define canonical paths that must remain read-only:
  - `tasks/**`
  - `runs/**`
  - `validation/**`
  - `review/**`
  - `handoffs/**`
  - `.agent/overnight/**`
- Define forbidden lifecycle states, authority claims, and actions that must remain impossible.
- Define the safest follow-up implementation task RALPH-043B as a read-only/stdout-only sandbox lifecycle eligibility evaluator.
- Planning only; do not implement an evaluator and do not mutate runtime, evidence, review, handoff, queue, worker, task, product, package, Supabase, or Git state.

**Explicitly excluded:**

- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution engine.
- No automatic lifecycle transitions.
- No runtime authority.
- No canonical queue admission.
- No writes under `.agent/overnight/**`.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance, validation pass, task completion, commit-readiness, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or product-code mutation.
- No package, Supabase, environment, secret, or protected-file mutation.
- No implementation files changed in this planning task.

**DoD:**

- Required read-only git evidence is collected and documented:
  - `git --no-pager status --short`
  - `git --no-pager log -10 --oneline`
- Relevant canonical files are reviewed:
  - `ROADMAP.md`
  - `VERIFY.md`
  - `SSOK.md`
  - `AGENTS.md`
  - `.governance/SYSTEM.md`
  - `.governance/RULES.md`
  - `.governance/SAFETY.md`
  - `.agent/config/protected-files.json`
- Relevant prior evidence reports are reviewed:
  - `reports/RALPH-041C_QUEUE_ENTRY_WRITE_EVIDENCE_INTEGRATION_REPORT.md`
  - `reports/RALPH-042B_SANDBOX_QUEUE_ENTRY_LIFECYCLE_SCHEMA_PROBE_REPORT.md`
  - `reports/RALPH-042C_SANDBOX_LIFECYCLE_EVIDENCE_INTEGRATION_REPORT.md`
- The first safe runtime-adjacent capability is defined without enabling runtime behavior.
- Authority boundaries and read-only canonical paths are documented.
- Required evidence gates are documented.
- Eligibility criteria for sandbox lifecycle artifacts are documented.
- Forbidden states, claims, actions, and impossible behaviors are documented.
- RALPH-043B implementation scope is defined.
- Stop conditions are documented.
- No implementation or file modification is performed during RALPH-043A.

---

### RALPH-043B Sandbox Lifecycle Eligibility Evaluator

Status: `done`

Implement a read-only, stdout-only sandbox lifecycle eligibility evaluator that determines whether an existing sandbox lifecycle or sandbox queue-entry artifact is eligible for further human consideration without authorizing runtime behavior, lifecycle execution, queue execution, worker execution, task execution, review acceptance, validation authority, canonical queue admission, or canonical state mutation.

**Scope:**

- Add a deterministic eligibility evaluator library.
- Add a thin stdout-only CLI wrapper.
- Reuse the existing sandbox lifecycle validation helper from:
  `scripts/agent/lib/sandbox-queue-entry-lifecycle.mjs`
- Evaluate only explicit bounded input artifacts or fixtures.
- Accept only safe relative JSON input paths or explicit JSON metadata input.
- Produce exactly one of these decisions:
  - `eligible_for_human_consideration`
  - `blocked_missing_evidence`
  - `blocked_forbidden_claim`
  - `blocked_invalid_lifecycle`
  - `blocked_canonical_scope`
- Validate sandbox and non-authoritative markers.
- Validate lifecycle metadata through the existing lifecycle helper.
- Reject forbidden lifecycle states.
- Reject forbidden authority claims.
- Reject canonical/protected runtime, evidence, review, handoff, queue, product, package, environment, secret, and deployment scopes.
- Read `.agent/config/protected-files.json` only for protected-path classification.
- Emit deterministic JSON and optional markdown to stdout.
- Keep all authority and execution flags false.
- Add focused tests for all five decisions, protected/canonical scope blocking, file-input path safety, no-authority flags, and read-only/no-write behavior.
- Produce a report artifact:
  `reports/RALPH-043B_SANDBOX_LIFECYCLE_ELIGIBILITY_EVALUATOR_REPORT.md`

**Explicitly excluded:**

- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution engine.
- No automatic lifecycle transitions.
- No runtime authority.
- No review acceptance authority.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No canonical queue admission.
- No canonical queue entries.
- No writes under `.agent/overnight/**`.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No product code mutation.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No staging, commit, push, deploy, network, dependency install, formatter, fixer, or arbitrary shell execution.
- No modification to existing lifecycle, writer, classifier, validator, or evidence-bundle behavior unless a blocking issue is explicitly identified and separately reviewed.

**DoD:**

- Eligibility evaluator library is implemented.
- CLI emits stdout-only JSON by default and optional markdown.
- Evaluator produces exactly the five defined decisions.
- `eligible_for_human_consideration` is returned only for sandbox, non-authoritative, lifecycle-valid, evidence-sufficient, protected-scope-clean inputs.
- Missing evidence returns `blocked_missing_evidence`.
- Forbidden authority claims return `blocked_forbidden_claim`.
- Invalid or forbidden lifecycle states/transitions return `blocked_invalid_lifecycle`.
- Canonical/protected scope references return `blocked_canonical_scope`.
- All result authority/execution flags remain false.
- File input path safety is enforced.
- No file writes are performed by evaluator or CLI.
- Focused `node --check` and `node --test` checks pass.
- Report artifact documents architecture, decisions, tests, safety boundaries, and no-authority guarantees.
- Git readbacks show only approved RALPH-043B files changed.
- No canonical runtime/evidence/review/handoff mutation, queue execution, worker execution, task execution, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or product/package/Supabase mutation is performed.

---

### RALPH-043C Sandbox Lifecycle Eligibility Evidence Integration

Status: `done`

Demonstrate that the RALPH-043B sandbox lifecycle eligibility evaluator can be invoked as a read-only, stdout-only evidence collection tool without introducing runtime behavior, lifecycle execution, queue execution, worker execution, task execution, review authority, validation authority, canonical queue admission, or canonical state mutation.

**Scope:**

- Execute the existing eligibility evaluator CLI with representative fixtures.
- Use `--input-json` with inline JSON fixtures.
- Use `--input-file` with a safe relative JSON fixture if feasible without creating persistent non-report artifacts.
- Capture JSON output format.
- Capture Markdown output format.
- Demonstrate all five decision outcomes:
  - `eligible_for_human_consideration`
  - `blocked_canonical_scope`
  - `blocked_forbidden_claim`
  - `blocked_invalid_lifecycle`
  - `blocked_missing_evidence`
- Verify authority flags remain `false` in all results.
- Verify `writes_performed: false` in all results.
- Verify `stdout_only: true` in all results.
- Document changed-file reconciliation.
- Produce a report artifact:
  `reports/RALPH-043C_SANDBOX_LIFECYCLE_ELIGIBILITY_EVIDENCE_INTEGRATION_REPORT.md`
- Update ROADMAP status only after successful evidence integration.

**Explicitly excluded:**

- No runtime execution.
- No lifecycle execution.
- No queue execution.
- No worker execution.
- No task execution.
- No review authority.
- No validation authority.
- No canonical queue admission.
- No canonical state mutation.
- No evidence bundle wrapper.
- No new scripts or libraries.
- No new tests.
- No automatic execution based on eligibility decisions.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, `handoffs/**`, or `.agent/overnight/**`.
- No product, Supabase, package, environment, secret, governance, or protected-file mutation.
- No staging, commit, push, deploy, network, dependency install, formatter, fixer, or arbitrary shell execution.

**DoD:**

- Git evidence commands are executed and documented.
- Eligibility evaluator is invoked with representative fixtures.
- JSON output format is captured.
- Markdown output format is captured.
- All five decision outcomes are captured.
- Authority flags are verified as `false`.
- `writes_performed: false` is verified.
- `stdout_only: true` is verified.
- Changed files are reconciled.
- Report artifact is created.
- ROADMAP.md status is updated from `todo` to `done` only after successful verification.
- Changed files are limited to:
  - `ROADMAP.md`
  - `reports/RALPH-043C_SANDBOX_LIFECYCLE_ELIGIBILITY_EVIDENCE_INTEGRATION_REPORT.md`
- No canonical path writes occur.
- No authority claims are introduced.
- No runtime, lifecycle, queue, worker, or task execution is added or performed.

---

### RALPH-044A Read-Only Sandbox Promotion Proposal Generator

Status: `done`

Implement the smallest read-only/stdout-only proposal generator that converts an existing RALPH-043B sandbox lifecycle eligibility result, or an explicitly provided eligible sandbox artifact, into a deterministic, non-authoritative promotion proposal for human consideration.

This task creates the missing advisory bridge between `eligible_for_human_consideration` and a future separately authorized canonical promotion task. It must not perform canonical promotion, queue admission, runtime mutation, evidence mutation, handoff mutation, lifecycle execution, worker execution, or task execution.

**Scope:**

- Add a deterministic proposal library.
- Add a thin stdout-only CLI wrapper.
- Add focused tests.
- Accept explicit eligibility JSON or a safe relative eligibility JSON file.
- Optionally accept explicit sandbox artifact JSON or a safe relative sandbox artifact JSON file only if the implementation can reuse the existing RALPH-043B eligibility evaluator safely.
- Reuse or consume the existing RALPH-043B sandbox lifecycle eligibility evaluator.
- Require the source eligibility decision to be exactly `eligible_for_human_consideration`.
- Validate source shape:
  - `sandbox: true`
  - `non_authoritative: true`
  - task or queue identity is present
  - upstream `writes_performed: false`
  - upstream `stdout_only: true`
  - all upstream authority flags are false
- Refuse proposal generation for:
  - missing or malformed eligibility input
  - blocked eligibility decisions
  - canonical or protected source/target references
  - forbidden authority claims
  - missing sandbox/non-authoritative markers
  - upstream write or authority claims
- Emit deterministic JSON by default.
- Optionally emit deterministic Markdown to stdout.
- Proposal output should include:
  - schema version
  - generator name
  - proposal id
  - proposal mode
  - proposal created flag
  - source artifact or eligibility summary
  - source eligibility decision
  - promotion proposal type
  - future task recommendation
  - required human approvals
  - required governance references
  - future allowed-scope recommendation
  - future forbidden-scope recommendation
  - required verification category
  - required review gate
  - stop conditions
  - authority flags, all false
  - `writes_performed: false`
  - `stdout_only: true`
  - non-authorization statement
- Produce an implementation report:
  `reports/RALPH-044A_SANDBOX_PROMOTION_PROPOSAL_GENERATOR_REPORT.md`
- Update ROADMAP status only after successful verification.

**Explicitly excluded:**

- No canonical promotion writer.
- No canonical queue admission.
- No canonical queue entries.
- No writes under `.agent/overnight/**`.
- No writes under `.agent/runtime/sandbox/**`.
- No writes under `tasks/**`.
- No writes under `runs/**`.
- No writes under `validation/**`.
- No writes under `review/**`.
- No writes under `handoffs/**`.
- No mutation of existing sandbox artifacts.
- No governance mutation.
- No `.governance/EXECUTION.md`.
- No `ROADMAP.md` update except the RALPH-044A status update after successful verification.
- No review acceptance.
- No validation authority.
- No task completion authority.
- No worker execution.
- No queue execution.
- No task execution.
- No lifecycle execution.
- No automatic lifecycle transition.
- No product, Supabase, package, environment, secret, or protected-file mutation.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.

**DoD:**

- Proposal library is implemented.
- CLI wrapper is implemented.
- Focused tests are implemented.
- Existing RALPH-043B eligibility evaluator is reused or safely consumed.
- Proposal generation succeeds only for `eligible_for_human_consideration`.
- Blocked or malformed inputs fail closed.
- Canonical/protected scope references fail closed.
- Forbidden authority claims fail closed.
- Upstream write/authority claims fail closed.
- JSON output is deterministic.
- Markdown output is deterministic if implemented.
- All proposal authority flags remain false.
- `writes_performed: false` is present in proposal output.
- `stdout_only: true` is present in proposal output.
- Focused syntax checks pass.
- Focused tests pass.
- Implementation report is created.
- No canonical, runtime, evidence, review, handoff, governance, product, package, Supabase, environment, secret, or protected-file mutation occurs.
- Changed files are limited to:
  - `scripts/agent/lib/sandbox-promotion-proposal-generator.mjs`
  - `scripts/agent/generate-sandbox-promotion-proposal.mjs`
  - `scripts/agent/__tests__/sandbox-promotion-proposal-generator.test.mjs`
  - `reports/RALPH-044A_SANDBOX_PROMOTION_PROPOSAL_GENERATOR_REPORT.md`
  - `ROADMAP.md` status update after successful verification.

---

### RALPH-044B Minimal Canonical Promotion Proposal Writer Probe

Status: `done`

Implement the smallest controlled canonical-boundary promotion proposal writer probe for the Ralph-Loop / Overnight Worker workflow. This task proves Ralph can create exactly one deterministic, non-authoritative promotion-proposal artifact at a fixed `.agent/overnight/**` boundary path after human authorization, without performing canonical promotion, queue admission, runtime mutation, evidence mutation, review mutation, handoff mutation, worker execution, task execution, lifecycle execution, staging, commit, push, deploy, dependency install, formatter/fixer execution, network operation, or product/package/Supabase mutation.

**Scope:**

- Add a distinct promotion proposal writer probe CLI/lib/tests.
- Dry-run must be the default and must write no files.
- Require explicit write authorization before any file is created.
- Allow exactly one fixed target path:
  `.agent/overnight/promotion-proposals/ralph-044b-canonical-promotion-probe.json`
- Write deterministic JSON content only.
- Input may consume an explicit RALPH-044A promotion proposal JSON or deterministic fixture, but must fail closed unless:
  - `proposal_created: true`
  - `writes_performed: false`
  - `stdout_only: true`
  - all source/proposal authority flags are false
  - source summary is sandbox-only and non-authoritative
- The created artifact must explicitly declare:
  - `non_authoritative: true`
  - `canonical_promotion_authorized: false`
  - `canonical_queue_admission: false`
  - `queue_execution: false`
  - `worker_execution: false`
  - `task_execution: false`
  - `lifecycle_execution: false`
  - `runtime_authority: false`
  - `evidence_mutation: false`
  - `review_mutation: false`
  - `validation_mutation: false`
  - `task_completion: false`
  - `commit_readiness: false`
- Operation must be create-only.
- Refuse overwrite, append, truncate, delete, rename, move, arbitrary paths, arbitrary content input, path traversal, absolute paths, drive-qualified paths, and symlink/scope escapes.
- Validate target path against protected-file policy before writing and require this task's explicit authorization for the fixed `.agent/overnight/promotion-proposals/**` probe path.
- Validate expected JSON schema before writing.
- Capture pre-write and post-write git evidence using fixed read-only git commands.
- Read back the created file and verify exact content/hash match.
- Reconcile expected changed files against actual changed files.
- Stop for human review after write evidence is produced.
- Produce an implementation report:
  `reports/RALPH-044B_CANONICAL_PROMOTION_PROPOSAL_WRITER_PROBE_REPORT.md`
- Update ROADMAP status only after successful verification.

**Explicitly excluded:**

- No true canonical promotion writer.
- No canonical queue admission.
- No canonical queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution.
- No automatic lifecycle transition.
- No runtime authority creation.
- No writes under `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No writes under `.agent/runtime/sandbox/**`.
- No mutation of existing sandbox artifacts.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No arbitrary output paths or arbitrary content input.
- No overwrite/edit/delete/rename/move/append/truncate capability.

**DoD:**

- Promotion proposal writer probe library is implemented.
- CLI wrapper is implemented.
- Dry-run mode produces a deterministic write plan and writes no files.
- Explicit write mode creates exactly one JSON file at:
  `.agent/overnight/promotion-proposals/ralph-044b-canonical-promotion-probe.json`
- Created JSON parses and matches the expected schema.
- Created JSON is deterministic and hash/readback verified.
- Created JSON explicitly declares all authority, execution, mutation, review, validation, task-completion, commit, push, deploy, dependency, network, and product-work flags false.
- Writer fails closed for malformed, blocked, non-sandbox, authoritative, write-claiming, or protected-scope input proposals.
- Target path containment is enforced.
- Overwrite/path-escape/arbitrary-path/protected-target attempts are refused before write.
- Pre-write and post-write git evidence is captured and bounded.
- Changed-file reconciliation reports only approved RALPH-044B files changed.
- Focused syntax checks pass.
- Focused tests pass.
- Implementation report is created.
- No files are staged.
- No commit or push is performed.
- No canonical runtime/evidence/review/handoff mutation, queue execution, worker execution, task execution, lifecycle execution, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, product/package/Supabase/environment/secret mutation, or external side effect is performed.

---

### RALPH-045A Minimal Canonical Queue Entry Probe

Status: `done`

Implement the smallest controlled canonical-boundary queue-entry writer probe for the Ralph-Loop / Overnight Worker workflow. This task proves Ralph can create exactly one deterministic, non-authoritative queue-entry probe artifact at a fixed `.agent/overnight/**` boundary path after explicit human authorization, without performing canonical queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime authority creation, runtime writes, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, formatter/fixer execution, network operation, or product/package/Supabase mutation.

**Scope:**

- Add a distinct canonical-boundary queue-entry writer probe CLI/lib/tests.
- Dry-run must be the default and must write no files.
- Require an explicit execute flag before any file is created.
- Allow exactly one fixed target path:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- Write deterministic JSON content only.
- The created artifact must be explicitly non-authoritative and must not be treated as an admitted or executable queue entry.
- The deterministic artifact schema must include at minimum:
  - `schema_version`
  - `task_id`
  - `writer`
  - `artifact_type`
  - `target_path`
  - `queue_entry_id`
  - `queue_entry_created`
  - `non_authoritative: true`
  - `canonical_queue_admission: false`
  - `queue_execution: false`
  - `worker_execution: false`
  - `task_execution: false`
  - `lifecycle_execution: false`
  - `runtime_authority: false`
  - `runtime_write: false`
  - `evidence_mutation: false`
  - `review_mutation: false`
  - `validation_mutation: false`
  - `handoff_mutation: false`
  - `review_acceptance: false`
  - `validation_authority: false`
  - `validation_pass: false`
  - `task_completion: false`
  - `commit_readiness: false`
  - `staging: false`
  - `commit: false`
  - `push: false`
  - `deploy: false`
  - `dependency_install: false`
  - `network: false`
  - `product_work: false`
  - `non_authorization_statement`
- Operation must be create-only.
- Refuse overwrite, append, truncate, delete, rename, move, arbitrary paths, arbitrary content input, path traversal, absolute paths, drive-qualified paths, and symlink/scope escapes.
- Validate target path against protected-file policy before writing and require this task's explicit authorization for the fixed `.agent/overnight/queue-entries/**` probe path.
- Validate expected JSON schema before writing.
- Capture pre-write and post-write git evidence using fixed read-only git commands.
- Read back the created file and verify exact content/hash match.
- Reconcile expected changed files against actual changed files.
- Stop for human review after write evidence is produced.
- Produce an implementation report:
  `reports/RALPH-045A_CANONICAL_QUEUE_ENTRY_PROBE_REPORT.md`
- Update ROADMAP status only after successful verification.

**Explicitly excluded:**

- No true canonical queue admission.
- No executable queue entry creation.
- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution.
- No automatic lifecycle transition.
- No runtime authority creation.
- No runtime writes under `tasks/**` or `runs/**`.
- No writes under `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No arbitrary output paths or arbitrary content input.
- No overwrite/edit/delete/rename/move/append/truncate capability.
- No modification to `.agent/overnight/queue.schema.json` unless a blocking schema conflict is explicitly identified and separately reviewed.

**DoD:**

- Canonical-boundary queue-entry writer probe library is implemented.
- CLI wrapper is implemented.
- Dry-run mode produces a deterministic write plan and writes no files.
- Explicit execute mode creates exactly one JSON file at:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- Created JSON parses and matches the expected deterministic schema.
- Created JSON is deterministic and hash/readback verified.
- Created JSON explicitly declares all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags false.
- Created JSON is explicitly non-authoritative and does not represent queue admission or executable runtime state.
- Target path containment is enforced.
- Overwrite/path-escape/arbitrary-path/protected-target attempts are refused before write.
- Pre-write and post-write git evidence is captured and bounded.
- Changed-file reconciliation reports only approved RALPH-045A files changed.
- Focused syntax checks pass.
- Focused tests pass.
- Implementation report is created.
- No files are staged.
- No commit or push is performed.
- No canonical runtime/evidence/review/handoff mutation, queue execution, worker execution, task execution, lifecycle execution, staging, commit, push, deploy, dependency install, formatter, fixer, network operation, product/package/Supabase/environment/secret mutation, or external side effect is performed.

---

### RALPH-045B Canonical Queue Entry Evidence Integration

Status: `done`

Demonstrate that the RALPH-045A canonical-boundary queue-entry probe artifact can be independently reviewed through bounded evidence without introducing canonical queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime authority, runtime writes, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network operation, or product/package/Supabase mutation.

**Scope:**

- Inspect the existing RALPH-045A canonical-boundary queue-entry probe artifact:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- Validate that the artifact exists, parses as JSON, and matches the deterministic RALPH-045A schema/hash expectations.
- Confirm the artifact is explicitly non-authoritative and does not represent canonical queue admission or executable queue state.
- Confirm all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags remain false.
- Use the existing review-evidence bundle system in read-only/stdout-only mode to evaluate the RALPH-045A evidence context.
- Capture required git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, bounded output/truncation status, and commit-readiness/readiness-blocking behavior.
- Produce one report artifact:
  `reports/RALPH-045B_CANONICAL_QUEUE_ENTRY_EVIDENCE_INTEGRATION_REPORT.md`
- Update ROADMAP status only after successful verification if explicitly authorized by the task workflow.

**Explicitly excluded:**

- No canonical queue admission.
- No executable queue entry creation.
- No queue execution.
- No worker execution.
- No task execution.
- No lifecycle execution.
- No automatic lifecycle transition.
- No queue consumer implementation.
- No non-executing queue consumer probe yet.
- No runtime authority creation.
- No runtime writes under `tasks/**` or `runs/**`.
- No writes under `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No modification to the RALPH-045A queue-entry writer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to `.agent/overnight/queue.schema.json` unless a blocking schema conflict is explicitly identified and separately reviewed.

**DoD:**

- Required read-only git evidence is collected and documented.
- The RALPH-045A canonical-boundary queue-entry probe artifact exists at:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- The artifact parses as JSON and matches the expected deterministic RALPH-045A schema/hash.
- The artifact is confirmed non-authoritative, not canonical queue admission, and not executable queue state.
- All authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags are verified as false.
- The review-evidence bundle system evaluates the current evidence context in read-only/stdout-only mode.
- Bundle output includes git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, commit-readiness/readiness-blocking status, and bounded output/truncation metadata.
- Required focused syntax/test checks pass for the relevant existing evidence and RALPH-045A queue-entry probe tooling.
- Report artifact is created under `reports/`.
- Post-run git evidence shows changed files are limited to:
  - `reports/RALPH-045B_CANONICAL_QUEUE_ENTRY_EVIDENCE_INTEGRATION_REPORT.md`
  - `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged.
- No commit or push is performed.
- No canonical runtime/evidence/review/handoff mutation occurs.
- No queue consumer, queue execution, worker execution, task execution, lifecycle execution, runtime authority, or executable queue state is introduced or claimed.

---

### RALPH-046A Read-Only Canonical Queue Consumer Probe

Status: `done`

Implement the smallest read-only/stdout-only canonical queue consumer probe for the Ralph Overnight Worker workflow. This task proves Ralph tooling can inspect an existing canonical-boundary queue-entry probe artifact under `.agent/overnight/queue-entries/**` and return a deterministic advisory consumer decision without performing canonical queue admission, queue consumption, dequeue/acknowledge behavior, lifecycle transition, execution-plan preview, worker execution, task execution, runtime mutation, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, formatter/fixer execution, network operation, or product/package/Supabase mutation.

**Scope:**

- Add a read-only queue consumer probe library under `scripts/agent/lib/`.
- Add a CLI wrapper under `scripts/agent/` that outputs only to stdout.
- Accept only an explicit safe relative JSON path under `.agent/overnight/queue-entries/` or explicit JSON input if implemented safely.
- Validate the existing RALPH-045A queue-entry probe artifact schema.
- Confirm the artifact is non-authoritative, not canonical queue admission, and not executable queue state.
- Confirm all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags remain false.
- Return deterministic advisory decisions only, for example:
  - `inspectable_non_executable_probe`
  - `blocked_missing_or_invalid_artifact`
  - `blocked_authority_claim`
  - `blocked_not_queue_entry_probe`
  - `blocked_unsafe_path`
- Add focused tests for valid probe inspection, invalid JSON, unsafe paths, authority claims, wrong artifact type, and no-write/stdout-only behavior.
- Produce an implementation report:
  `reports/RALPH-046A_READ_ONLY_CANONICAL_QUEUE_CONSUMER_PROBE_REPORT.md`
- Update ROADMAP status only after successful verification if explicitly authorized by the task workflow.

**Explicit exclusions:**

- No canonical queue admission.
- No executable queue state.
- No queue execution.
- No queue consumption, dequeue, acknowledge, reserve, lock, retry, scheduling, or mark-done behavior.
- No execution-plan preview.
- No worker execution.
- No task execution.
- No lifecycle execution or lifecycle transition.
- No mutation under `.agent/overnight/**`, `.agent/runtime/**`, `tasks/**`, `runs/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No product, package, Supabase, environment, secret, dependency, governance-policy, or Git metadata mutation.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No treating RALPH-045A probe artifacts as admitted, executable, authoritative, or ready for execution.

**DoD:**

- Consumer probe is read-only/stdout-only and performs no writes.
- Valid RALPH-045A probe artifact inspection returns a deterministic advisory non-executable decision.
- Invalid JSON, unsafe paths, wrong artifact type, missing required fields, and authority/execution/mutation claims fail closed.
- Output includes explicit `writes_performed: false`, `stdout_only: true`, `non_authoritative: true`, and all authority flags set to `false`.
- Focused syntax checks pass for the new library and CLI.
- Focused tests pass for all required success and fail-closed paths.
- Implementation report is created under `reports/`.
- Git readbacks show changed files are limited to the approved RALPH-046A files and `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged, committed, pushed, deployed, formatted, fixed, or dependency-installed by the task.

---

### RALPH-046B Queue Consumer Evidence Integration

Status: `done`

Demonstrate that the RALPH-046A read-only canonical queue consumer probe can be independently reviewed through bounded evidence without introducing canonical queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime authority, runtime writes, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network operation, or product/package/Supabase mutation.

**Scope:**

- Inspect the existing RALPH-045A canonical-boundary queue-entry probe artifact:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- Run the existing RALPH-046A read-only queue consumer probe against the existing RALPH-045A probe artifact.
- Confirm the consumer probe returns a deterministic advisory non-executable decision.
- Confirm the consumer probe remains read-only/stdout-only and performs no writes.
- Confirm the artifact remains non-authoritative, not canonical queue admission, and not executable queue state.
- Confirm all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags remain false.
- Use the existing review-evidence bundle system in read-only/stdout-only mode to evaluate the RALPH-046A consumer evidence context.
- Capture required git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, bounded output/truncation status, and commit-readiness/readiness-blocking behavior.
- Produce one report artifact:
  `reports/RALPH-046B_QUEUE_CONSUMER_EVIDENCE_INTEGRATION_REPORT.md`
- Update ROADMAP status only after successful verification if explicitly authorized by the task workflow.

**Explicit exclusions:**

- No canonical queue admission.
- No executable queue state.
- No queue execution.
- No queue consumption, dequeue, acknowledge, reserve, lock, retry, scheduling, mark-done behavior, or lifecycle transition.
- No execution-plan preview.
- No worker execution.
- No task execution.
- No runtime authority creation.
- No runtime writes under `tasks/**` or `runs/**`.
- No writes under `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No modification to the RALPH-045A queue-entry writer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to the RALPH-046A queue consumer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to `.agent/overnight/queue.schema.json` unless a blocking schema conflict is explicitly identified and separately reviewed.

**DoD:**

- Required read-only git evidence is collected and documented.
- The RALPH-045A canonical-boundary queue-entry probe artifact exists at:
  `.agent/overnight/queue-entries/ralph-045a-canonical-queue-entry-probe.json`
- The RALPH-046A queue consumer probe evaluates the RALPH-045A artifact in read-only/stdout-only mode.
- The consumer probe returns a deterministic advisory non-executable decision.
- The consumer probe output confirms `writes_performed: false`, `stdout_only: true`, `non_authoritative: true`, and all authority flags remain `false`.
- The artifact is confirmed non-authoritative, not canonical queue admission, and not executable queue state.
- All authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags are verified as false.
- The review-evidence bundle system evaluates the current RALPH-046A consumer evidence context in read-only/stdout-only mode.
- Bundle output includes git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, commit-readiness/readiness-blocking status, and bounded output/truncation metadata.
- Required focused syntax/test checks pass for the relevant existing evidence, RALPH-045A queue-entry probe tooling, and RALPH-046A queue consumer probe tooling.
- Report artifact is created under `reports/`.
- Post-run git evidence shows changed files are limited to:
  - `reports/RALPH-046B_QUEUE_CONSUMER_EVIDENCE_INTEGRATION_REPORT.md`
  - `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged.
- No commit or push is performed.
- No canonical runtime/evidence/review/handoff mutation occurs.
- No queue execution, worker execution, task execution, lifecycle execution, runtime authority, or executable queue state is introduced or claimed.

---

### RALPH-047A Read-Only Execution Plan Preview

Status: `done`

Define and implement the smallest read-only/stdout-only execution-plan preview for the Ralph Overnight Worker workflow. This task converts an existing non-executable canonical-boundary queue consumer advisory decision into a deterministic preview of what an eventual execution envelope would need, without creating runtime authority, executable queue state, task execution, worker execution, lifecycle execution, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network operation, or product/package/Supabase mutation.

**Scope:**

- Add a read-only execution-plan preview library under `scripts/agent/lib/`.
- Add a CLI wrapper under `scripts/agent/` that outputs only to stdout.
- Accept only explicit safe relative input paths or explicit JSON input, implemented fail-closed.
- Inspect the existing RALPH-045A canonical-boundary queue-entry probe artifact and the existing RALPH-046A read-only queue consumer probe output shape.
- Require the queue consumer decision to be advisory, non-executable, non-authoritative, and read-only/stdout-only before generating any preview.
- Return a deterministic preview object that describes required future execution-envelope inputs, blockers, non-authority status, and next-review requirements.
- Confirm all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags remain false.
- Add focused tests for valid preview generation, invalid JSON, unsafe paths, missing consumer decision, authority claims, execution claims, mutation claims, wrong artifact type, and no-write/stdout-only behavior.
- Produce an implementation report:
  `reports/RALPH-047A_READ_ONLY_EXECUTION_PLAN_PREVIEW_REPORT.md`
- Update ROADMAP status only after successful verification if explicitly authorized by the task workflow.

**Explicit exclusions:**

- No canonical queue admission.
- No executable queue state.
- No queue execution.
- No queue consumption, dequeue, acknowledge, reserve, lock, retry, scheduling, mark-done behavior, or lifecycle transition.
- No worker execution.
- No task execution.
- No runtime authority creation.
- No runtime writes under `tasks/**` or `runs/**`.
- No writes under `.agent/overnight/**`, `.agent/runtime/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No modification to the RALPH-045A queue-entry writer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to the RALPH-046A queue consumer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to `.agent/overnight/queue.schema.json` unless a blocking schema conflict is explicitly identified and separately reviewed.
- No treating the execution-plan preview as executable, authoritative, approved, admitted, or ready for execution.

**DoD:**

- Execution-plan preview is read-only/stdout-only and performs no writes.
- Valid advisory RALPH-046A consumer output produces a deterministic non-executable execution-plan preview.
- Invalid JSON, unsafe paths, missing consumer decision, wrong artifact type, authority claims, execution claims, and mutation claims fail closed.
- Output includes explicit `writes_performed: false`, `stdout_only: true`, `non_authoritative: true`, `executable: false`, and all authority flags set to `false`.
- Preview output lists required future execution-envelope inputs and blockers without executing or mutating anything.
- Focused syntax checks pass for the new library and CLI.
- Focused tests pass for all required success and fail-closed paths.
- Implementation report is created under `reports/`.
- Git readbacks show changed files are limited to the approved RALPH-047A files and `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged, committed, pushed, deployed, formatted, fixed, dependency-installed, or networked by the task.
- No canonical runtime/evidence/review/handoff mutation occurs.
- No queue execution, worker execution, task execution, lifecycle execution, runtime authority, executable queue state, or executable execution plan is introduced or claimed.

---

### RALPH-047B Execution Plan Preview Evidence Integration

Status: `done`

Demonstrate that the RALPH-047A read-only execution-plan preview can be independently reviewed through bounded evidence without introducing canonical queue admission, executable queue state, queue execution, queue consumption, worker execution, task execution, lifecycle execution, runtime authority, runtime writes, evidence mutation, review mutation, validation mutation, handoff mutation, staging, commit, push, deploy, dependency install, network operation, or product/package/Supabase mutation.

**Scope:**

- Run the existing RALPH-047A read-only execution-plan preview against the existing RALPH-045A canonical-boundary queue-entry probe artifact and/or existing RALPH-046A advisory consumer decision path.
- Confirm the preview returns a deterministic, non-executable, non-authoritative, read-only/stdout-only decision.
- Confirm preview output includes `preview_only: true`, `stdout_only: true`, `writes_performed: false`, `non_authoritative: true`, and `executable: false`.
- Confirm all authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags remain false.
- Confirm preview blockers explicitly prevent execution authority, queue admission, queue consumption, lifecycle transition, and runtime/evidence mutation.
- Confirm required future execution-envelope inputs are listed as review/planning inputs only and do not authorize execution.
- Use the existing review-evidence bundle system in read-only/stdout-only mode to evaluate the RALPH-047A preview evidence context.
- Capture required git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, commit-readiness/readiness-blocking status, and bounded output/truncation metadata.
- Produce one report artifact:
  `reports/RALPH-047B_EXECUTION_PLAN_PREVIEW_EVIDENCE_INTEGRATION_REPORT.md`
- Update ROADMAP status only after successful verification if explicitly authorized by the task workflow.

**Explicit exclusions:**

- No canonical queue admission.
- No executable queue state.
- No queue execution.
- No queue consumption, dequeue, acknowledge, reserve, lock, retry, scheduling, mark-done behavior, or lifecycle transition.
- No worker execution.
- No task execution.
- No runtime authority creation.
- No runtime writes under `tasks/**` or `runs/**`.
- No writes under `.agent/overnight/**`, `.agent/runtime/**`, `validation/**`, `review/**`, or `handoffs/**`.
- No validation JSONL writes.
- No review JSONL writes.
- No handoff mutation.
- No review acceptance.
- No validation pass authority.
- No task completion authority.
- No commit-readiness authority.
- No product code mutation under `src/**`.
- No Supabase mutation.
- No package/dependency mutation.
- No environment or secret mutation.
- No governance mutation except the authorized `ROADMAP.md` status update for this task.
- No staging, commit, push, deploy, dependency install, formatter, fixer, network operation, or arbitrary shell execution.
- No modification to the RALPH-045A queue-entry writer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to the RALPH-046A queue consumer probe unless a blocking defect is explicitly identified and separately reviewed.
- No modification to the RALPH-047A execution-plan preview implementation unless a blocking defect is explicitly identified and separately reviewed.
- No modification to `.agent/overnight/queue.schema.json` unless a blocking schema conflict is explicitly identified and separately reviewed.
- No treating the execution-plan preview as executable, authoritative, approved, admitted, validated, complete, commit-ready, or ready for execution.

**DoD:**

- Required read-only git evidence is collected and documented:
  - `git --no-pager status --short`
  - `git --no-pager log -10 --oneline`
  - `git --no-pager diff --stat`
  - `git --no-pager diff --name-only`
  - `git --no-pager diff --cached --name-only`
- The RALPH-047A execution-plan preview evaluates the existing advisory queue-consumer/probe context in read-only/stdout-only mode.
- The preview returns a deterministic non-executable decision.
- Preview output confirms `preview_only: true`, `stdout_only: true`, `writes_performed: false`, `non_authoritative: true`, and `executable: false`.
- All authority, execution, mutation, review, validation, handoff, task-completion, commit, push, deploy, dependency, network, and product-work flags are verified as false.
- Preview blockers and required future execution-envelope inputs are documented as non-authorizing review/planning information only.
- The review-evidence bundle system evaluates the current RALPH-047A preview evidence context in read-only/stdout-only mode.
- Bundle output includes git readbacks, changed-file classification, protected/approval-required classification, claim-vs-actual reconciliation, verification evidence status, commit-readiness/readiness-blocking status, and bounded output/truncation metadata.
- Required focused syntax/test checks pass for the relevant existing RALPH-047A preview tooling and evidence-bundle tooling.
- Report artifact is created under `reports/`.
- Post-run git evidence shows changed files are limited to:
  - `reports/RALPH-047B_EXECUTION_PLAN_PREVIEW_EVIDENCE_INTEGRATION_REPORT.md`
  - `ROADMAP.md` only if the status update is explicitly authorized.
- No files are staged.
- No commit or push is performed by the task.
- No canonical runtime/evidence/review/handoff mutation occurs.
- No queue execution, worker execution, task execution, lifecycle execution, runtime authority, executable queue state, executable execution plan, review acceptance, validation pass, task-completion authority, or commit-readiness authority is introduced or claimed.

---

## Principles

- Deterministic-first: prefer deterministic logic over AI/LLM calls
- AI only when deterministic logic is insufficient
- Clean Architecture: domain / application / infrastructure / presentation layers
- Feature-First: code organized by feature (nutrition, goals, auth, 5)
- Trust/Confidence/Editability: every logged entry must be trustworthy and editable
- Small, incremental, reviewable changes only

---

## Retention Strategy

**Primary KPI:** Week-1 retention rate

**Core Philosophy:**

- Retention is the single most important product metric
- All feature decisions must be evaluated through retention impact lens
- User engagement quality over feature quantity

**Strategic Priorities:**

1. **Magic Moments as UX Goal**
   - Educational insights that surprise and delight users
   - Unexpected nutritional discoveries ("Did you know...")
   - Personalized achievements and progress celebrations
   - Smart suggestions based on eating patterns

2. **Friction Reduction (Top Priority)**
   - Input speed and ease trumps feature complexity
   - Every additional tap/step must justify retention benefit
   - Error recovery must be instant and intuitive
   - Progressive disclosure: advanced features hidden initially

3. **AI Cost Optimization**
   - AI costs evaluated per retained user, not per API call
   - High-retention users justify higher AI investment
   - Cost-per-retained-user as primary AI ROI metric
   - Deterministic solutions preferred for cost efficiency

**Feature Prioritization Framework:**

- P0: Features that directly impact Week-1 retention
- P1: Features that improve long-term engagement
- P2: Features that reduce churn risk
- P3: Nice-to-have features with unclear retention impact

---

## Data Strategy – Multi-Source Resolver v2

**Goal:** Improve food matching accuracy and user trust for DACH market launch

**Source Priority Order:**

1. **User Cache** (Highest Priority)
   - Previously logged foods by same user
   - Instant recognition, zero latency
   - Builds user confidence through consistency

2. **DACH Source** (Live — BLS wired into resolver, Stand 2026-07-09)
   - German/Austrian/Swiss specific food database
   - Local brands, regional specialties, German portion sizes
   - Essential for market penetration and user trust
   - Reduces AI fallback dependency
   - Implemented as `BlsStaticSource` in `resolverSources`
     (`src/infrastructure/di/container.ts`), prioritized ahead of OFF/USDA
     in `SequentialFoodCatalogResolver` — see Decisions Log

3. **Open Food Facts (OFF)** (Brand/EAN Fallback)
   - Downgraded from primary to fallback role
   - Specialized for branded products with EAN codes
   - European brand coverage remains valuable
   - NOT replaced, but repositioned strategically

4. **USDA** (Canonical Generic Foods)
   - Reliable source for generic food categories
   - Standardized nutritional data
   - Fallback for foods not in regional databases

5. **AI Fallback** (Last Resort)
   - Only when all deterministic sources fail
   - Highest cost, lowest confidence
   - Must be clearly marked as estimated

**Strategic Rationale:**

- **DACH Source Critical:** German market requires local food recognition for user trust and adoption
- **OFF Repositioning:** Still valuable but not primary - focuses on its strength (branded products)
- **Trust Building:** Local data sources increase user confidence in accuracy
- **Cost Optimization:** Reduces expensive AI calls through better deterministic matching
- **Match Quality:** Regional specificity improves portion size and nutritional accuracy

**Implementation Notes:**

- Resolver maintains existing architecture, only source priority changes
- Each source maintains its specialized query adapters
- Fallback chain ensures no user input goes unresolved
- Performance monitoring per source to optimize query routing

### Resolver Decision Layer

**Candidate Ranking Criteria:**

- **Match Quality:** Exact text match > partial match > fuzzy match
- **Data Quality:** Complete nutritional profile > partial data > estimated values
- **Kcal Consistency:** Values within expected ranges for food type and portion
- **Source Trust:** User Cache > DACH > USDA > OFF > AI (descending reliability)

**Confidence Thresholds:**

- **High Confidence (≥85%):** Auto-accept, immediate save to journal
  - Exact canonical match from User Cache
  - Strong DACH match with complete nutritional data
  - USDA match with portion consistency
- **Medium Confidence (50-84%):** Accept with edit capability
  - Partial matches requiring portion adjustment
  - Good match but incomplete nutritional profile
  - User can quickly modify before saving
- **Low Confidence (<50%):** Require user clarification or fallback
  - Multiple ambiguous candidates
  - Significant data gaps or inconsistencies
  - Present options to user for selection

**Early Return Rules:**

- Strong canonical match (>90% confidence) from User Cache → skip remaining sources
- Exact brand match from DACH → skip OFF and later sources
- Multiple high-confidence candidates from same source → rank and return best match
- Zero candidates from primary sources → continue to fallback chain

### Fallback & Failure Handling

**Source-Specific Failure Modes:**

- **OFF API Failures (503, timeout):** Skip quickly without retry loops to preserve API budget
- **DACH Source Unavailable:** Log degradation, continue to OFF without user notification
- **USDA Query Errors:** Fallback to AI with explicit "estimated" marking
- **Network Failures:** Cache last successful results, show offline indicator

**No-Match Scenarios:**

- **Complete Resolution Failure:** Show clear UI feedback instead of silent failure
- **Partial Matches Only:** Present best candidates with confidence indicators
- **Zero Nutritional Data:** Block save operation, request user input for basic macros
- **Ambiguous Input:** Guide user to more specific description rather than guessing

**Zero-Macro Protection:**

- **Hard Block:** No food entry with kcal=0 can be saved to journal
- **No Food-Specific Bypass:** Rule applies universally, no exceptions for specific foods
- **User Feedback:** Clear error message explaining why save was blocked
- **Recovery Path:** Suggest portion adjustment or alternative food selection

### Input Quality Integration

**Input Classification System:**

- **High Quality Input:** Specific food name + clear portion (e.g., "200g Quark", "2 Eier")
  - Route to fast deterministic resolution path
  - High confidence threshold (≥85%) for auto-acceptance
  - Minimal user interaction required
- **Medium Quality Input:** Recognizable food, unclear portion (e.g., "Buttertoast", "Schinken")
  - Standard resolution with medium confidence acceptance (50-84%)
  - Present portion options for user selection
  - Allow quick edit before saving
- **Low Quality Input:** Vague or complex descriptions (e.g., "etwas Süßes", "Mittagessen")
  - Request clarification instead of attempting resolution
  - Guide user toward more specific input
  - Avoid expensive AI calls on ambiguous queries

**Quality-Confidence Integration:**

- **High Quality + High Confidence:** Instant save, optimal user experience
- **High Quality + Low Confidence:** Data quality issue, investigate source reliability
- **Low Quality + Any Confidence:** Always request clarification, never auto-accept
- **Medium Quality + Medium Confidence:** Standard edit flow, balanced trust/control

**Retention Impact Connection:**

- **Trust Building:** High-quality inputs with successful resolution build user confidence
- **Control Preservation:** Medium/low quality inputs maintain user agency through edit capability
- **Friction Reduction:** Quality classification enables appropriate UX flow selection
- **Learning Loop:** User corrections on medium-quality inputs improve future classification

---

## EPIC: Zero-Friction Input System (P0 - CORE PRODUCT)

Goal:
Enable users to log food using natural language with minimal friction, prioritizing ease-of-use over perfect accuracy.

Principles:

- Natural language first (no structured input required)
- Approximation over precision (initial input)
- Correction over prevention (user can quickly edit)
- System should feel "instant" and "effortless"

Scope:

- Free-text food input ("What did you eat?")
- Basic parsing (quantities, simple foods)
- Dish recognition (e.g. "Spaghetti Bolognese")
- Mapping to existing food database (Open Food Facts / USDA)
- Confidence scoring system (high / medium / low)
- Fallback handling for unknown inputs
- Quick-edit UX (portion adjustment, corrections)

Deliverables:

- Input component (UI)
- Parsing layer (initial rule-based)
- Dish mapping system (initial static dataset ~50 meals)
- Confidence evaluation
- Edit interaction flow

Constraints:

- Must integrate with existing deterministic pipeline
- Must NOT break current food search functionality
- No heavy AI dependency in initial implementation

---

## Current Focus

Core Logging Pipeline must be stable before any other feature work.

Definition of "working":

- `ei` 6 correct macros
- `zwei eier` 6 correct macros
- `200g quark` 6 correct macros
- `buttertoast` 6 correct macros
- `zwei scheiben schinken` 6 correct macros

---

# PHASE 0 6 LOGGING MUST WORK

## P0-001 Disable Multi-Item Structuring

Status: `done`

Temporarily disable AI multi-item structuring.
No "AI structured multi-item meal" text.
No artificial splitting while deterministic parser is unstable.

**DoD:** Single item passes cleanly through the pipeline without AI structuring.

---

## P0-002 Single Item 6 Resolver 6 Macros Pipeline

Status: `done`

Minimal working chain:

1. Input: raw text (e.g. "ei")
2. Deterministic normalization
3. Resolver call
4. USDA/OFF match
5. Macro calculation
6. Journal persistence
7. SummaryBar update

No Review Modal. No Confirm All. No extra layers.

**DoD:** 5 individual foods produce correct macros without zero-macro results.

---

## P0-003 Remove Review Modal (Temporary)

Status: `done`

Disable Review Entries. Remove Confirm All. Save directly after successful match.
On no match: show error.

**DoD:** Flow shortened. No forced confirm step.

---

## P0-004 Zero-Macro Blocker

Status: `done`

If `kcal == 0`: block save, show error, no success status.

**DoD:** Saving an entry with zero macros is impossible.

---

## P0-005 Hard Default to Protokoll Tab

Status: `done`

`initialRouteName` = Protokoll. App starts on input tab.

**DoD:** App opens on Protokoll tab on cold start.

---

## P0-007 Proof-of-Call Tracing (Gate)

Status: `done`

Verify full resolver call chain via logs:

- PROOF UseCase entered
- PROOF ABOUT_TO_RESOLVE
- PROOF RESOLVER_CALLED with sourceCount > 0
- PROOF OFF_SOURCE_CALLED and USDA_SOURCE_CALLED
- Either candidates > 0 OR explicit HTTP status/error logged

**DoD:** All five proof points visible in logs for a valid input.

---

# PHASE 1 6 DETERMINISTIC MULTI-ITEM PARSING

## P1-001 Deterministic DE9EN Localization Alias Layer

Status: `done`

Deterministic step mapping common DE foods to EN equivalents for USDA source.
OFF targets original text.

**DoD:** Unit test for DE mapping passes (`npm run test`). `ei` returns candidates in manual app test.

---

## P1-002 Canonical Food Entity Dictionary + Source Adapters

Status: `done`

Evolve flat alias map into structured canonical food entities with DE+EN alias lists,
portion hints, and source query adapters.
`detectCanonicalEntity()` for entity matching.
`getSourceQuery()` for per-source query routing.

**DoD:** ~20 canonical entities defined. Unit tests pass for DE+EN alias detection and source-specific query mapping. No macro key or unit inconsistencies.

**Verify:** `npx jest --testPathPattern="deEnAliases|smokeResolverDe"`, manual app test: "ei" produces candidates.

---

## Roadmap Priority Tiers

Strategic priorities:

1. Zero-friction logging
2. Trust-first UX
3. Private-use-first
4. DACH-first deterministic resolver
5. Infrastructure
6. Public launch
7. Monetization

---

# TIER 1 — CORE PRODUCT VALUE

Focus: user-visible logging value, editability, repeat-use friction reduction, and feedback loops.

## EPIC: Resolver & Normalization

### P1-003 Multi-Item Split

Status: `done`

Split input at "und", "mit", ",". Normalize number words. Force resolver per item.

**DoD:** "ei und quark" produces two separate resolved entries.

**Verify:** `npx jest --runInBand src/features/input/application/__tests__/parseInput.test.ts src/features/nutrition/__tests__/splitMultiItemInput.test.ts`.

**Implementation notes:** Both DoD elements were already implemented and live but lacked
explicit combined test coverage. Splitting lives in
`src/features/nutrition/application/utils/splitMultiItemInput.ts` (P1-003B clause-aware).
German number-word normalization ("zwei", "drei", ...) lives in
`src/features/input/infrastructure/simpleParser.ts`'s `parseQuantityAndUnit()`, which runs
per split item, so "zwei eier und drei bananen" already resolved to two entries with correct
quantities (2, 3) before this task — added
`parseInput.test.ts` coverage for the split+number-word interaction to lock this in. Note:
number-word dictionaries are duplicated across `simpleParser.ts`, `DeterministicFoodParser.ts`,
and `src/features/nutrition/domain/portion/UnitNormalization.ts` with slightly different word
sets (e.g. "eins"/umlaut variants) — a future consolidation task could unify these, but no
DoD regression was found and none is required for this task's scope.

---

### P1-004B Domain + Local Portion Knowledge MVP

Status: `done`

Implement local/testable portion knowledge for identity-based count/piece/slice resolution.
Portion hints attach to `foodIdentityKey + unit`, not aliases. User-private confirmed hints are immediately usable for that user and never automatically become global truth.

**DoD:** Seed hints exist for the small MVP set. Carrot aliases share the same canonical identity hint. User-private hints outrank seed/global/source hints for that user. Explicit grams remain authoritative. Unknown count foods still require edit instead of falling back to 100g. Required focused tests and runtime verification pass.

**Verify:** `npx jest --runInBand src/features/nutrition/__tests__/PortionKnowledgeService.test.ts src/features/nutrition/__tests__/resolvePortionGrams.test.ts src/features/nutrition/__tests__/PersistedPortionHintRepository.test.ts src/features/nutrition/__tests__/PortionParser.test.ts src/features/nutrition/__tests__/LogFoodFromRawInputUseCase.unitPortions.test.ts`.

**Implementation notes:** Already fully implemented and wired live prior to this task
(`src/features/nutrition/domain/portion/{PortionHint,PortionKnowledgeService,seedPortionHints,PortionNeedsEdit,resolvePortionGrams}.ts`,
instantiated in `src/infrastructure/di/container.ts` with `PersistedPortionHintRepository` +
`SEED_PORTION_HINTS`, consumed by `LogFoodFromRawInputUseCase`/`LogMealFromRawInputUseCase`).
Ran the full focused test suite (31 tests across 5 files, all passing) confirming every DoD
element: seed hints for the MVP set (egg, banana, apple, carrot, potato, toast), carrot-alias
identity sharing, user-private-outranks-seed/global/trusted-source lookup priority, explicit
grams remaining authoritative over hints, and unknown count foods returning a
`needs-edit`/`COUNT_WITHOUT_PORTION_HINT` result instead of a silent 100g fallback. No code
changes were required — this task closed out verification only.

---

### P1-004C: Wire User-Private Portion Hint Confirmation Test Coverage

Status: `done`

**Description:** `PortionKnowledgeService.confirmUserPrivateHint()` (domain layer, P1-004B)
is fully implemented and already called in production from `JournalScreen.tsx`
(`savePortionHintAndRetry`, `handleUseEstimatedPortion`, `handleConfirmManualPortion`), but
had zero test coverage: the global test-setup container mock never exposed
`portionKnowledgeService`, so this flow was unverified.

**DoD:** An end-to-end test drives the confirm flow through the same
`container.portionKnowledgeService.confirmUserPrivateHint()` call path the running app uses,
confirms the same input resolves immediately afterward for that user, and confirms a
different user gets no hint for the same food/unit (private, not promoted to global truth).

**Verify:** `npx jest --runInBand src/features/input/application/__tests__/portionHintConfirmationFlow.test.ts`, `npm run typecheck`.

**Implementation notes:** `src/test-setup.ts`'s global container mock previously only
exposed `logFoodFromRawInputUseCase`, built without a `portionKnowledgeService` (10th
constructor arg omitted), so `resolvePortionGrams` silently fell back to its own
internal module-level default instance and `container.portionKnowledgeService` was
`undefined` in every test. Fixed by constructing one shared `PortionKnowledgeService` (same
`InMemoryPortionHintRepository` + `SEED_PORTION_HINTS` wiring as production `container.ts`)
and wiring it into both the mocked use case and the exposed `container.portionKnowledgeService`,
so confirming a hint through the container in a test now actually affects the next
resolution — exactly mirroring the real DI graph. New end-to-end test
(`src/features/input/application/__tests__/portionHintConfirmationFlow.test.ts`) drives the
full production call path: "zwei scheiben schinken" blocks with `needs_edit`
(`canonical:ham`/slice), `confirmUserPrivateHint(...)` is called exactly as
`JournalScreen.savePortionHintAndRetry` calls it, the identical input then resolves
immediately (50g, calories > 0), and a different `userId` still gets no hint for the same
food/unit. Full suite (89 suites / 718 tests), `tsc --noEmit`, `eslint`, and `prettier -c`
pass clean.

---

### P1-003B: Clause-Aware Comma Splitting (Nested "mit"-Lists)

Status: `done`

**Description:**
Extend Multi-Item Split (P1-003) to be clause-aware. Currently "und", "mit", and "," are
split at the same flat level, causing composite-dish headers (e.g. "Fruchtsalat mit Bananen,
Kirschen, Erdbeeren, Ananas") to become spurious standalone entries alongside their listed
components. Commas following an active "mit"-clause must be treated as intra-clause
separators (children of that clause), not as new top-level split points. Top-level splitting
on "," remains unchanged when no "mit"-clause is active.

**DoD:**

- "Fruchtsalat mit Bananen, Kirschen" → 1 label + 2 resolved child entries, no separate
  "Fruchtsalat" resolution attempt
- "Apfel, Banane, Joghurt" (no "mit") → 3 flat top-level entries (unchanged)
- "Ei und Quark" → 2 top-level entries (unchanged)
- "Wurstsalat mit Zwiebeln, Essig, Öl" → 1 label + 3 children
- Existing P1-003 tests still pass (no regression to flat "und"/","-splitting outside
  mit-clauses)

**Verify:** New unit tests for clause-scoped comma parsing
(`npx jest --testPathPatterns="splitMultiItemInput|LogMealFromRawInputUseCase"`), manual app
test with the four cases above, `npm run typecheck`.

**Implementation notes:** Implemented in
`src/features/nutrition/application/utils/splitMultiItemInput.ts`. A "mit"/"with" clause only
forms a label+children group when it is followed by a real comma list (>= 2 children) — a
single trailing item after "mit" (e.g. "burger mit cola") keeps the original flat P1-003
behavior, since that phrasing denotes two separate menu items, not an ingredient list. The
label is excluded from `items` (never sent to the resolver); `LogMealFromRawInputUseCase`
requires no change since it already only iterates `splitResult.items`. Group data
(`SplitMultiItemGroup[]`) is exposed on the result for P1-003C to consume for Journal display.

---

### P1-003C: Composite Meal Label Handling in Journal

Status: `done`

**Description:**
When P1-003B detects a `<Kopf> mit <Liste>` pattern, `<Kopf>` must not be resolved as a
standalone food/macro source. Journal UI groups the resolved children under the label for
display, while macros are summed only from children (no double counting).

**DoD:**

- Label entries do not query BLS/OFF/USDA individually
- Journal displays label with nested/grouped children (collapsible or visually grouped)
- Total macros for the group equal sum of child macros exactly
- Editing/deleting a child updates the group total; deleting all children removes the group

**Verify:** Component/UI test for grouped display, unit test confirming label is excluded
from resolver calls, manual app test.

**Implementation notes:** Discovered during implementation that the live app submit path
(`JournalScreen` → `logResolvedNutritionInput` → `prepareNutritionResolverDispatch` →
`parseInput` → `simpleParse`) never used P1-003B's `splitMultiItemInput` — it had its own
flat, non-clause-aware connector splitter, and `LogMealFromRawInputUseCase` (the only P1-003B
consumer) was dead code never called from any UI. Fixed by rewriting
`simpleParse` (`src/features/input/infrastructure/simpleParser.ts`) to delegate to
`splitMultiItemInput`, then threading `groupId`/`groupLabel` through the full live pipeline:
`ParsedItem` → `ResolverFoodRequest` → `FoodSearchQuery` →
`LogFoodFromRawInputUseCase.execute()` → persisted `FoodEntry` (new optional
`groupId`/`groupLabel` fields, also added to `PersistedFoodEntryRepository`'s
serialize/deserialize). `LogMealFromRawInputUseCase` was updated too for consistency. A
shared `buildGroupInfoByItemIndex()` helper in `splitMultiItemInput.ts` avoids duplicating the
groupId-synthesis logic across both pipelines. Journal UI: `groupJournalEntries()` in
`journalEntryDisplay.ts` derives grouped/flat display items from the flat entries array (no
separate persisted "group" record), so group totals and group-disappears-on-last-delete both
fall out for free from the existing per-entry data. Verified end-to-end against the real DI
container (not mocks) via `logResolvedNutritionInput.test.ts`.

---

### P1-005: Curated Composite-Dish Pattern List (Non-Growing Alias Strategy)

Status: `done`

**Description:**
Introduce a small curated list of common composite-dish head-words (e.g. "Fruchtsalat",
"Wurstsalat", "Nudelauflauf") used only for pattern recognition (triggering P1-003B/C
grouping), not as a nutrition-alias/macro source. This list is intentionally small and
static (seed set), analogous to the ~20 Canonical Food Entities from P1-002. Long-term
growth must come from the Resolver V2 knowledge layer (`food_aliases`, `corrections`), not
manual list maintenance — mirrors the user-private-hint pattern from P1-004B (user-confirmed
dish patterns apply privately first, never auto-promoted to global truth).

**DoD:**

- Seed list of ~15-20 composite-dish head-words defined
- Pattern list is structurally separate from nutrition/macro data (no macro values attached)
- Unit tests confirm head-words trigger grouping behavior
- Documented dependency note: full learning/growth mechanism deferred to
  RESOLVER-V2-005/006 (Supabase knowledge layer)

**Verify:** `npx jest --runInBand src/features/nutrition/__tests__/CompositeDishPatterns.test.ts`, `npm run verify`.

**Implementation notes:** Implemented as an additive recognition helper only — explicit
scope decision, not the literal "list gates grouping" reading of the description. Existing
P1-003B/C grouping in `splitMultiItemInput.ts` already triggers generically for any
"`<head>` mit `<list>`" pattern (>= 2 comma-separated children), regardless of head word;
narrowing that to only curated head-words would have been a behavior change (uncurated
composite dishes would stop grouping) with no such non-regression requirement stated in
P1-003B/C's own DoD. Added
`src/features/nutrition/domain/catalog/CompositeDishPatterns.ts` — a 20-entry curated seed
list (`COMPOSITE_DISH_HEAD_WORDS`) plus `isKnownCompositeDishHeadWord()`, normalized via the
existing `normalizeText()` helper (same umlaut-folding used by `CanonicalFood.ts`). Tests in
`src/features/nutrition/__tests__/CompositeDishPatterns.test.ts` confirm the list's size,
structural separation from macro data, case/umlaut-insensitive matching, that curated
head-words trigger grouping, and that non-curated head-words still group unchanged (locking
in the additive-only decision). The list is not yet consumed anywhere as a gate/filter — a
future task may use it for ranking/quality signals once product direction on
narrowing-vs-generic grouping is decided; deferred to RESOLVER-V2-005/006 for the underlying
learning/growth mechanism as originally scoped.

---

## Nutrition Evaluation Foundation → Domain Phases

Supersedes the former "Tier 1 Planning Targets" flat module list (Journal, Saved Meals,
Dashboard, Goals treated as four equivalent placeholders). Journal and Saved Meals are
data domains; Goals and Dashboard are direct expressions of the Evaluation Engine — this
ordering reflects the accepted architecture instead of a flat list.

### Nutrition Evaluation Foundation

Status: `done`

Product/architecture concept accepted as Zera's factual authority for all further product
decisions: strict separation of Food Catalog (objective food properties) → Journal
(objective who/when/how-much history) → Evaluation Engine (interchangeable interpretation
via Evaluation Profiles composed of Rules; Prinzip 0: no Profile ever changes facts). See
[`docs/vision/ZERA_FOUNDING_BRIEF.md`](docs/vision/ZERA_FOUNDING_BRIEF.md) (vision, target
motivations) and [`docs/vision/ZERA_PRODUCT_BIBLE.md`](docs/vision/ZERA_PRODUCT_BIBLE.md)
(architecture, data ownership, profile/rule contract, Origin taxonomy). Both carry Status
`accepted`. Review trail:
[`ZERA_CONCEPT_REVIEW_R1.md`](docs/vision/ZERA_CONCEPT_REVIEW_R1.md),
[`ZERA_CONCEPT_REVIEW_R2.md`](docs/vision/ZERA_CONCEPT_REVIEW_R2.md).

**DoD:** Founding Brief and Product Bible both carry Status `accepted`. All four downstream
domain phases below must respect the Food-Catalog/Journal/Evaluation-Engine split and
Prinzip 0 in their own future decomposition into tasks.

---

### Journal Domain

Status: `done`

All six decomposed tasks (J-001–J-006 below) are `done`, implementing Journal Decision
Record 1's four accepted decisions (Entscheidung 1–4) end-to-end: CanonicalFood identity
cleanup, the `nutritionSnapshot`/`foodCatalogRef` model, correction log + soft delete,
Food Catalog reference population, and the narrowed/visible/undoable auto-merge — plus
cross-cutting regression coverage (J-006) proving they hold together. See
[`docs/domains/ZERA_JOURNAL_DOMAIN_MODEL.md`](docs/domains/ZERA_JOURNAL_DOMAIN_MODEL.md)
("What is a journal entry in Zera?", `accepted`) and
[`docs/domains/ZERA_JOURNAL_DECISION_RECORD_1.md`](docs/domains/ZERA_JOURNAL_DECISION_RECORD_1.md)
(correction model, Food Catalog reference, CanonicalFood cleanup, Future Compatibility
Principle — `accepted`).

**Scope boundary (Product Bible Abschnitt 6/7, unchanged):** stays profile-independent;
references Food Catalog entries rather than owning food properties itself; never contains
evaluations ("gut"/"schlecht"). Food Catalog remains fachlich part of the Journal Domain
per Product Bible Abschnitt 9/11 — **not** a fifth Tier-1 domain. The Product Bible
describes the factual architecture (Food Catalog → Journal → Evaluation Engine); this
section only refines the _implementation sequence_ within the Journal Domain, per Decision
Record 1's implementation order:

1. **Food Catalog Identity Cleanup** (J-001)
2. **Journal Model** (J-002)
3. **Corrections** (J-003)
4. **Food References** (J-004)
5. **Logging** (J-005)

Cross-cutting: **J-006** (regression coverage across J-001–J-005).

No dedicated migration task is planned: every schema change below is additive
(new optional fields), so existing persisted `FoodEntry` rows remain valid without
transformation — directly required by the Future Compatibility Principle
(Decision Record 1, Abschnitt 6).

---

#### J-001: CanonicalFood Identity Cleanup

Status: `done`

**Ziel:** Consolidate the fragmented Food Catalog identity concepts into one stable type,
per Decision Record 1 Entscheidung 4 — narrow, mechanical scope only, no new Food Catalog
functionality (no food groups/NOVA/GI/allergens).

**Scope / betroffene Dateien:**

- `src/features/nutrition/domain/catalog/FoodCatalogSource.ts` — the real, multi-source
  `CanonicalFood { id, name, normalizedName, macrosPer100g, source, sourceId }`; becomes
  the single canonical shape.
- `src/features/nutrition/domain/models/FoodCatalogTypes.ts` — older, simpler
  `CanonicalFood { id, displayName, per100g }` used by the legacy deterministic
  `FoodCatalog.searchByName` path; merge into the shape above or adapt the legacy path to
  produce it.
- `src/features/nutrition/domain/catalog/CanonicalFood.ts` — despite the filename, this is
  a DE/EN alias dictionary (`CanonicalFoodEntity`), not a catalog entity; rename to an
  unambiguous name (e.g. `FoodAliasDictionary.ts`).
- All call sites: resolver services
  (`application/services/SequentialFoodCatalogResolver.ts`,
  `DefaultFoodCatalogResolver.ts`), `detectCanonicalEntity.ts`, and any other importer of
  the renamed/merged types.

**Risiken:** Touches many files (mechanical rename/merge), but low architectural risk —
existing 717 tests are the regression net. Main risk is an incomplete rename leaving a
stale import; typecheck will catch this.

**Tests:** No new test scenarios required (behavior must not change); full existing suite
must stay green.

**Akzeptanzkriterien (DoD):**

- Exactly one `CanonicalFood` interface represents the real macro-bearing catalog entity,
  used by both the modern and legacy resolution paths.
- The alias dictionary no longer shares the name `CanonicalFood`.
- No behavior change: all 717 existing tests, typecheck, and lint pass unmodified in
  outcome.
- No food-group/NOVA/GI/allergen fields or other new Food Catalog functionality added.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** `FoodCatalogTypes.CanonicalFood` now re-exports the real,
macro-bearing `CanonicalFood` from `FoodCatalogSource.ts` instead of defining its own
`{id, displayName, per100g}` shape; `InMemoryFoodCatalog.ts` (legacy deterministic
`FoodCatalog.searchByName` path) was adapted to construct/consume the modern shape
(`name`/`normalizedName`/`macrosPer100g`/`source: 'user'`) rather than merging two
incompatible shapes. `LogFoodFromRawInputUseCase.ts` and `LogMealFromRawInputUseCase.ts`
each already transformed the modern `CanonicalFood` into a local
`{per100g: {calories,...}}` shape at their resolver call site (feeding `computeTotals`);
this is now done via one small `toLegacyPer100g()` helper per use case, applied
consistently at all three `FoodCatalog`-consuming branches (cache-hit, deterministic
search, AI-mapper fallback) instead of only the resolver branch — no change to the
widely-used `NutritionPer100g`/`per100g` convention used throughout the rest of the
codebase. `domain/catalog/CanonicalFood.ts` (the DE/EN alias dictionary, despite its old
name) was renamed to `FoodAliasDictionary.ts`; its two importers
(`SequentialFoodCatalogResolver.ts`, `deEnAliases.test.ts`) updated accordingly.
Deliberately out of scope (per DoD "no new Food Catalog functionality"): the unrelated
`domain/canonicalFoods.ts` + `domain/detectCanonicalEntity.ts` pair (a fourth, separate
portion-hint/alias dictionary actively used by both use cases) was left untouched — it
does not import from any of the renamed/merged files, so consolidating it would be scope
creep beyond this task's narrow, mechanical rename/merge.
Full suite (89 suites / 718 tests), `tsc --noEmit`, and `eslint` pass clean.
**Known pre-existing gap (not introduced by this task, confirmed via `git stash` against
the branch tip before this change):** `npm run format:check` (part of `npm run verify`)
fails repo-wide on 238 files unrelated to this task (governance docs, `scripts/agent/**`,
`reports/**`, etc.), predating this change. All files touched by J-001 are confirmed
individually Prettier-clean.

---

#### J-002: Journal Model — `nutritionSnapshot` + `foodCatalogRef`

Status: `done`
Depends on: none (can proceed in parallel with J-001; J-004 depends on both)

**Ziel:** Apply the accepted `FoodEntry` shape changes from Decision Record 1 Entscheidung 3
— explicit `nutritionSnapshot`, optional `foodCatalogRef` — as additive, backward-compatible
fields.

**Scope / betroffene Dateien:**

- `src/features/nutrition/domain/models/NutritionTypes.ts` — add `nutritionSnapshot: {
kcal, protein, carbs, fat }` (explicit grouping of the existing top-level macro fields)
  and optional `foodCatalogRef?: { source, sourceId, displayName, confidence }`.
- `src/features/nutrition/infrastructure/repositories/PersistedFoodEntryRepository.ts` —
  extend `SerializedFoodEntry` + `serializeEntry`/`deserializeEntry` for both new fields,
  with graceful handling of entries that predate this change (`foodCatalogRef` absent =
  valid, unchanged meaning — Future Compatibility Principle).

**Risiken:** Low — purely additive type/schema change. Care needed that existing top-level
`calories/protein/carbs/fat` fields either stay (for compatibility) or are migrated to read
from `nutritionSnapshot` consistently across all read sites; decide and document which,
to avoid two sources of truth for the same numbers within this task.

**Tests:** Serialization round-trip tests for old entries (no `foodCatalogRef`/
`nutritionSnapshot`) and new entries (both present); typecheck coverage for the new fields.

**Akzeptanzkriterien (DoD):**

- `FoodEntry` carries `nutritionSnapshot` and optional `foodCatalogRef`.
- Old persisted entries deserialize without error and remain semantically unchanged
  (Future Compatibility Principle).
- No existing test regresses.

**Verify:** `npm run typecheck`, `npm run test` (incl. new serialization round-trip tests).

**Implementation notes — "which stays source of truth" decision (per Risiken above):** both
new fields are **optional** on `FoodEntry`, and the existing top-level
`calories/protein/carbs/fat` fields remain the sole source of truth for this task — no read
site is migrated, and no write site is required to populate either field yet. This was the
only option consistent with the task's own narrow 2-file scope and "Risiken: Low — purely
additive": ~12 files across the codebase construct `FoodEntry` object literals (5 use cases,
1 repository, 6 test files); making `nutritionSnapshot` non-optional would have forced edits
to all of them, well beyond this task's stated scope and risk level. Populating
`nutritionSnapshot`/`foodCatalogRef` at actual write time is deferred to J-004 (Food
References) / J-005 (Logging), matching Decision Record 1's own implementation order and its
explicit note that wiring `LogFoodFromRawInputUseCase.resolveCanonicalFood()` to stop
discarding `id`/`source`/`sourceId` is a later, separate step. Since neither field is ever
independently set by this task, there is no risk of divergence between them and the
top-level macro fields — this task adds pure plumbing (type + serialize/deserialize),
verified by two new round-trip tests: one persisting an entry with both fields populated and
reloading it via a fresh repository instance, one deserializing a hand-written pre-J-002
serialized entry (no `nutritionSnapshot`/`foodCatalogRef` keys at all) and confirming it
loads without error with both fields `undefined`.
Full suite (89 suites / 720 tests, +2 new), `tsc --noEmit`, `eslint`, and `prettier -c` on
touched files pass clean. (Same pre-existing, unrelated repo-wide `format:check` gap noted
in J-001 still applies to `npm run verify` as an aggregate command.)

---

#### J-003: Correction Log + Soft Delete

Status: `done`
Depends on: J-002 (extends the same `FoodEntry`/repository surface)

**Ziel:** Implement Decision Record 1 Entscheidung 1 — append-only correction log on every
edit/delete, soft-delete instead of hard-delete. Internal audit/undo foundation only, not a
visible UI history (Decision Record 1, Präzisierung in Abschnitt 2).

**Scope / betroffene Dateien:**

- `src/features/nutrition/application/usecases/EditFoodEntryFromNaturalLanguageUseCase.ts`
- `src/features/nutrition/application/usecases/ApplyNaturalLanguageEditUseCase.ts`
- `src/features/nutrition/application/usecases/DeleteFoodEntryUseCase.ts`
- `PersistedFoodEntryRepository.ts` — add correction-log storage (append-only, keyed by
  entry id) and a `deletedAt`/tombstone field instead of hard removal from the array.

**Risiken:** Behavior change for delete (soft instead of hard) — anything reading the
entries list must filter tombstoned rows; check all read call sites (journal display,
daily summary, calendar month summary) for implicit reliance on hard deletion.

**Tests:** Edit/delete use cases append a correction-log entry with previous values; delete
sets tombstone instead of removing the row; existing summary/display use cases correctly
exclude tombstoned entries.

**Akzeptanzkriterien (DoD):**

- Every edit and delete appends an immutable correction-log entry
  (`{timestamp, previousValues, triggeredBy}`).
- Delete is soft (tombstone), not hard.
- Correction log is not exposed in any existing UI-facing read path by this task (internal
  only, per Decision Record 1 Präzisierung).
- No existing test regresses; new tests cover log-append and soft-delete filtering.

**Verify:** `npm run typecheck`, `npm run test`.

**Implementation notes:** `FoodEntry` gained `deletedAt?: Date` (tombstone) and a new
`CorrectionLogEntry { timestamp, previousValues, triggeredBy: 'user' | 'system' }` type
(`NutritionTypes.ts`). Read-path filtering happens once, at the repository boundary:
`listEntriesForDate`/`listByDateRange`/`getEntryById` on both `PersistedFoodEntryRepository`
and `InMemoryFoodEntryRepository` now exclude tombstoned rows — so `GetDailySummaryUseCase`,
`GetCalendarMonthSummaryUseCase`, journal display, and `findCorrectionCandidate`'s auto-merge
search all inherit the exclusion for free, with zero changes needed to those files (verified
with new regression tests on the daily and calendar-month summary use cases). The
`FoodEntryRepository` port gained `appendCorrectionLogEntry`/`getCorrectionLog` and
`deleteEntry`'s signature grew a `deletedAt: Date` parameter (sourced from each use case's
existing `Clock`, keeping the codebase's no-direct-`new Date()`-in-infra convention) — this
propagated mechanically to all three port implementers (`PersistedFoodEntryRepository`,
`InMemoryFoodEntryRepository`, and the private `StagedFoodEntryRepository` inside
`LogMealFromRawInputUseCase.ts`), none of which were in the task's literal 4-file scope list
but were structurally required by the interface change — same "many files, mechanical"
pattern as J-001. `DeleteFoodEntryUseCase` gained a `Clock` constructor dependency (wired in
`container.ts`); it now loads the entry first, logs the correction entry, then soft-deletes —
an already-tombstoned or nonexistent id is a silent no-op (matches prior hard-delete
behavior for missing ids). `EditFoodEntryFromNaturalLanguageUseCase`/
`ApplyNaturalLanguageEditUseCase` log immediately before their existing persist call, using
the untouched pre-edit entry object as `previousValues`; `ApplyNaturalLanguageEditUseCase`'s
existing early-return-on-no-change path correctly appends no log entry. Correction log is
persisted under its own storage key (`nutrition:correctionLog`), separate from
`nutrition:entries`, and is only reachable via `getCorrectionLog()` — no UI-facing read path
exists yet, satisfying the "internal only" DoD constraint.
Full suite (89 suites / 732 tests, +12 new), `tsc --noEmit`, `eslint`, and `prettier -c` on
touched files pass clean. (Same pre-existing, unrelated repo-wide `format:check` gap noted in
J-001 still applies to `npm run verify` as an aggregate command.)

---

#### J-004: Food Catalog Reference Population

Status: `done`
Depends on: J-001 (stable identity to reference), J-002 (`foodCatalogRef` field must exist)

**Ziel:** Implement Decision Record 1 Entscheidung 3 — stop discarding the resolver's
`CanonicalFood.id`/`source`/`sourceId` and populate `foodCatalogRef` whenever resolution
actually produced a catalog match.

**Scope / betroffene Dateien:**

- `src/features/nutrition/application/usecases/LogFoodFromRawInputUseCase.ts` —
  `resolveCanonicalFood()` (currently reduces the resolver's result to `{ per100g }`,
  discarding identity) must retain and forward `id`/`source`/`sourceId` into
  `foodCatalogRef`.
- `src/features/nutrition/application/usecases/LogMealFromRawInputUseCase.ts` — same
  reduction happens in the multi-item path; apply the same fix.
- Leave `foodCatalogRef` unset for pure AI-fallback/manual-entry paths with no stable
  catalog match (per Decision Record 1: "wenn vorhanden").

**Risiken:** Low-to-moderate — touches the core logging path; must not change any
persisted macro numbers, only add the reference alongside them. Regression risk mitigated
by existing macro-calculation tests (must show unchanged `nutritionSnapshot` output).

**Tests:** Logging a food with a real catalog match populates `foodCatalogRef`; logging via
AI-fallback/manual entry with no catalog match leaves it unset; macro values remain
byte-identical to pre-change behavior.

**Akzeptanzkriterien (DoD):**

- `foodCatalogRef` is populated whenever the resolver returns a real catalog identity.
- No macro/`nutritionSnapshot` value changes as a side effect.
- No existing test regresses.

**Verify:** `npm run typecheck`, `npm run test`.

**Implementation notes:** Both use cases' `toLegacyPer100g()` helper became
`toResolvedCanonicalFood(food, confidence)`, now returning `{ per100g, foodCatalogRef }`
together instead of just `per100g` — `foodCatalogRef.sourceId` falls back to `food.id` when
the source `CanonicalFood.sourceId` is absent (e.g. the static `InMemoryFoodCatalog`), since
the canonical `id` is itself a stable identity per Decision Record 1. All four
`resolveCanonicalFood()` branches that return a real `CanonicalFood` (cache-hit, resolver,
deterministic search, AI-mapper-then-catalog-lookup) now populate `foodCatalogRef` with that
branch's own confidence value; the two `canonicalFood: null` branches (no match at all)
naturally leave it unset by never reaching the helper.
On investigating the "AI-fallback/manual-entry with no catalog match leaves it unset" test
scenario: in this codebase's current architecture that scenario can't produce a _persisted_
entry to assert an unset field on. `LogFoodFromRawInputUseCase`'s resolver dependency is
mandatory (constructor throws without one), so a `canonicalFood: null` result always means
zero macros, which the pre-existing P0-004 Zero-Macro Blocker rejects before save. The
`LogMealFromRawInputUseCase`-internal NutritionLookup fallback (gated on `!this.foodCatalog`)
is reachable only from its own AI-structured-multi-item branch, but every "mit"/"und"/","-
connector input is intercepted first by deterministic `splitMultiItemInput()`, which
delegates each item to `LogFoodFromRawInputUseCase` — same mandatory-resolver constraint —
and `container.ts` always wires a real `foodCatalog` in production regardless. So "leaves it
unset" is verified as its logical consequence instead: a new test confirms a fully-rejected
resolver blocks the save entirely (`RESOLVER_FAILED_OR_NO_MACROS`, zero entries persisted) —
there is no code path that persists real macros without a `foodCatalogRef` alongside them.
New dedicated test file `FoodCatalogRefPopulation.test.ts` (4 tests) covers: resolver-match
population with exact source/sourceId/displayName/confidence assertions (both use cases),
cache-hit population at confidence 0.8, and the no-match-blocks-save proof. `nutritionSnapshot`
is untouched by this task (still unpopulated by any write path, as decided in J-002).
Full suite (90 suites / 736 tests, +4 new), `tsc --noEmit`, `eslint`, and `prettier -c` on
touched files pass clean. (Same pre-existing, unrelated repo-wide `format:check` gap noted in
J-001 still applies to `npm run verify` as an aggregate command.)

---

#### J-005: Auto-Merge Narrowing + Visible/Undoable Correction

Status: `done`
Depends on: J-003 (correction log must exist to record system-triggered merges)

**Ziel:** Implement Decision Record 1 Entscheidung 2 — narrow the auto-merge heuristic to a
2-minute window, make it visible and undoable, and log it as system-triggered
(distinguishable from a user-initiated edit).

**Scope / betroffene Dateien:**

- `src/features/nutrition/application/usecases/LogFoodFromRawInputUseCase.ts` —
  `findCorrectionCandidate`/`isCorrectionCandidate`/`CORRECTION_WINDOW_MS` (currently 30
  minutes; change to 2 minutes) and the merge path (currently silent `updateEntryById`)
  must return enough structured information for the caller to surface an undo-capable
  notification, and must write a correction-log entry (J-003) marked
  `triggeredBy: 'system'`.
- Presentation-layer hook for the undo affordance itself (minimal, scoped to this specific
  notification — not a general UI redesign) — exact component TBD at implementation time,
  out of scope for this domain-level task description beyond "must exist and be wired to
  an undo action that reverts to the correction-log's previous values."

**Risiken:** The UI-visible piece is the main scope-creep risk — keep it to the minimum
notification + undo affordance needed to satisfy Entscheidung 2, not a broader UX pass.

**Tests:** Merge only triggers within 2 minutes (not 30); merge result includes enough data
for an undo action; undo restores the previous values via the correction log; merge is
logged as system-triggered.

**Akzeptanzkriterien (DoD):**

- Auto-merge window is 2 minutes.
- A successful auto-merge is visible (non-blocking notification) and undoable.
- Undo restores the pre-merge values exactly (via J-003's correction log).
- Merge is distinguishable in the correction log from user-initiated edits.

**Verify:** `npm run typecheck`, `npm run test`, manual app verification of the undo
notification per the `/verify` skill.

**Implementation notes:** `CORRECTION_WINDOW_MS` narrowed to 2 minutes. The merge branch now
writes a correction-log entry (`triggeredBy: 'system'`, `previousValues` = the pre-merge
entry) before persisting, and `execute()`'s return type became
`Promise<FoodEntry & { autoMergeInfo?: AutoMergeInfo }>` (new type in `NutritionTypes.ts`,
`autoMergeInfo` never persisted — repositories only serialize fields they explicitly know
about) — a superset of `FoodEntry`, so every existing typed consumer (`Awaited<ReturnType<...>>`
usage in `resolvePreparedNutritionInputs.ts`/`logResolvedNutritionInput.ts`) picked up the new
optional field automatically with zero call-site changes. New `UndoAutoMergeUseCase`
(DI-wired in `container.ts`) restores an entry to `previousValues` and logs the undo itself
as a `triggeredBy: 'user'` correction, so the log accurately reflects both events in order.
Presentation-layer hook, kept minimal per the Risiken note: `JournalScreen.tsx` shows a small
dismissible banner ("Mit vorherigem Eintrag zusammengeführt" + "Rückgängig", reusing the
existing `PrimaryButton`/`AppText` primitives — no new UI components) when
`logResolvedNutritionInput()`'s result contains a persisted entry with `autoMergeInfo`; only
the first concurrent merge is surfaced (documented MVP limitation, not multi-item stacking).
Full suite (91 suites / 740 tests, +4 new: narrowed-window merge assertions incl.
`autoMergeInfo`/correction-log checks, a new just-outside-window boundary test, and 3
`UndoAutoMergeUseCase` tests), `tsc --noEmit`, `eslint`, and `prettier -c` on touched files
pass clean.
**Manual app verification gap (per AGENTS.md's Manual UI Testing Gap Log binding rule):** the
agent execution environment is headless — no Expo/simulator/device available — so the banner's
actual on-screen appearance, layout, and touch behavior could not be visually verified. Logged
as an open entry in
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md#2026-07-10--j-005-auto-merge-undo-notification-in-journalscreen)
per that binding rule; all application-layer logic (merge detection, undo restoration,
correction-log bookkeeping) is fully unit-tested. This is the documented, sanctioned
completion path for UI-relevant changes under this repo's governance — not a substitute for
eventual real-device verification, which remains the human reviewer's follow-up per the gap
log.

---

#### J-006: Journal Domain Regression Coverage

Status: `done`
Depends on: J-001–J-005

**Ziel:** Consolidated regression pass across the full Journal Domain change set, ensuring
Prinzip 0, the Future Compatibility Principle, and all five accepted decisions hold
together, not just individually.

**Scope:** Cross-cutting — no new production code; test-focused.

**Tests:**

- End-to-end: log → auto-merge-corrected → manually re-edited → soft-deleted, verifying the
  correction log accurately reflects all three events in order.
- Old-shape persisted entries (pre-J-002, no `foodCatalogRef`/explicit `nutritionSnapshot`)
  continue to deserialize and function correctly (Future Compatibility Principle).
- Full existing 717-test suite plus all new tests from J-001–J-005 green together, not just
  individually.

**Akzeptanzkriterien (DoD):** Full suite (`npm run verify`) green; no regressions in
existing P1-001–P1-005 resolver behavior, portion knowledge, or composite-dish grouping.

**Verify:** `npm run verify`.

**Implementation notes:** New `JournalDomainRegressionCoverage.test.ts` (3 tests) covers the
two DoD-mandated scenarios directly: (1) a single `PersistedFoodEntryRepository` instance
driven through log → auto-merge (within the J-005 2-minute window) → manual edit (J-003) →
soft-delete (J-003), asserting the correction log holds exactly 3 entries in order with the
correct `triggeredBy`/`previousValues`/`timestamp` at each step, and that the deleted entry
is excluded from `listEntriesForDate` while still physically present with a `deletedAt`
tombstone; (2) a hand-written pre-J-002 serialized entry (no `nutritionSnapshot`/
`foodCatalogRef`/`deletedAt` keys at all) deserializes cleanly and is then driven through the
daily summary use case, an edit, and a soft-delete without error — proving the Future
Compatibility Principle holds across the full read/write surface, not just at
deserialization. P1-001–P1-005/portion-knowledge/composite-dish regression coverage is not
duplicated here — it already lives in `SequentialFoodCatalogResolver.test.ts`,
`deEnAliases.test.ts`, `CompositeDishPatterns.test.ts`, `splitMultiItemInput.test.ts`,
`PortionKnowledgeService.test.ts`, `resolvePortionGrams.test.ts`, etc., all of which ran green
alongside every J-001–J-006 commit in this sequence (continuously verified after each task,
not just at the end).
Full suite (92 suites / 743 tests, +3 new), `tsc --noEmit`, and `eslint` pass clean.
**`npm run verify` is not fully green** — the DoD's literal wording — because its
`format:check` step still surfaces the same pre-existing, unrelated repo-wide Prettier debt
(governance docs, `scripts/agent/**`, `reports/**`, etc.) first identified and confirmed
pre-existing (via `git stash` against the branch tip) in J-001, and re-confirmed unchanged by
every task in this sequence. `tsc --noEmit`, `eslint`, and `prettier -c` all pass clean on
every file touched across J-001–J-006. Fixing that debt is a separate, out-of-scope repo-wide
cleanup task (see J-001's implementation notes for the same finding) — a future task should
either fix it or scope `format:check`/`npm run verify`'s policy in `VERIFY.md` to changed
files only, since as currently defined no task can ever satisfy it without that unrelated
mass-reformat.

### Saved Meals Domain

Status: `done`

All six decomposed tasks (SM-001–SM-006 below) are `done`. Unlike the Journal Domain, this
is **not** greenfield: an application/domain/infrastructure-layer implementation already
exists (`SavedMealTemplate`/`SavedMealItem` in
[`SavedMealTypes.ts`](src/features/nutrition/domain/models/SavedMealTypes.ts),
`CreateSavedMealFromDateUseCase`, `LogSavedMealToDateUseCase`,
`InMemorySavedMealRepository`, covered by
[`SavedMeals.test.ts`](src/features/nutrition/__tests__/SavedMeals.test.ts)) but it predates
the Journal Domain's J-001–J-006 overhaul and was never wired into the app. Concretely:

- `LogSavedMealToDateUseCase` builds each `FoodEntry` by hand (a direct `NutritionLookup`
  call), bypassing `LogFoodFromRawInputUseCase`'s resolver pipeline entirely — entries it
  creates never carry `nutritionSnapshot`/`foodCatalogRef` (J-002/J-004) and re-resolve the
  food by name string every time instead of reusing the identity captured at template
  creation, which is exactly what the Future Compatibility Principle and Decision Record 1
  Entscheidung 3/4 established `foodCatalogRef` to avoid.
- `SavedMealRepository` has `delete()`/`list()` methods that are exercised only by tests —
  no use case ever calls them, and there is no rename/update use case at all.
- Only an `InMemorySavedMealRepository` exists (no persisted counterpart, unlike
  `PersistedFoodEntryRepository`); templates do not survive an app restart.
- Nothing is registered in [`src/infrastructure/di/container.ts`](src/infrastructure/di/container.ts)
  and there is no presentation-layer code anywhere (`src/presentation/features/` has no
  `savedMeals` directory) — the feature is entirely inaccessible from the app today.

**Scope boundary (Product Bible Abschnitt 6, unchanged):** "eine gespeicherte Mahlzeit ist
eine Logging-Beschleunigung, kein Bewertungsobjekt" — must function identically regardless
of the active Evaluation Profile. No task below may add profile/evaluation awareness to
this domain; that stays confined to Goals & Evaluation / Dashboard & Insights.

Implementation order:

1. **Food Catalog Reference on Template Items** (SM-001)
2. **Deterministic, Journal-Model-Aligned Logging** (SM-002)
3. **Template Management Use Cases** (SM-003)
4. **Persisted Repository** (SM-004)
5. **Presentation Layer + DI Wiring** (SM-005)

Cross-cutting: **SM-006** (regression coverage across SM-001–SM-005).

No dedicated migration task is planned: SM-001's new field is additive/optional, so
existing in-memory templates (there is no persisted store yet to migrate) remain valid.

---

#### SM-001: Food Catalog Reference on Saved Meal Items

Status: `done`
Depends on: none

**Implementation notes:** `SavedMealItem.foodCatalogRef` added as an additive optional
field (identical shape to `FoodEntry.foodCatalogRef`). `CreateSavedMealFromDateUseCase`
spreads it in conditionally so items without one keep the field absent (not `undefined`-
valued) rather than present-but-undefined. New test in `SavedMeals.test.ts` covers both the
copy and the absence case. Full suite (92 suites / 745 tests, +1), `tsc --noEmit`, and
`eslint` pass clean.

**Ziel:** `SavedMealItem` captures the `foodCatalogRef` of the source `FoodEntry` (if any)
at template-creation time, so a later log-back can reuse the exact same Food Catalog
identity instead of re-resolving the food by name string — the same guarantee J-002/J-004
established for the Journal Model itself.

**Scope / betroffene Dateien:**

- `src/features/nutrition/domain/models/SavedMealTypes.ts` — add optional
  `foodCatalogRef?: { source, sourceId, displayName, confidence }` to `SavedMealItem`
  (same shape as `FoodEntry.foodCatalogRef`).
- `src/features/nutrition/application/usecases/CreateSavedMealFromDateUseCase.ts` — copy
  `entry.foodCatalogRef` onto the created `SavedMealItem` when present; absent when the
  source entry predates J-004 or has none (e.g. pure AI fallback).

**Risiken:** Low — additive optional field, no existing read site depends on its absence.

**Tests:** Template creation from entries with and without `foodCatalogRef` produces items
with/without the copied field respectively.

**Akzeptanzkriterien (DoD):**

- `SavedMealItem` optionally carries `foodCatalogRef`.
- `CreateSavedMealFromDateUseCase` populates it whenever the source `FoodEntry` has one.
- No behavior change to existing fields; full suite stays green.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

---

#### SM-002: Deterministic, Journal-Model-Aligned Logging

Status: `done`
Depends on: SM-001

**Ziel:** `LogSavedMealToDateUseCase` produces `FoodEntry` rows indistinguishable in shape
from ones logged through `LogFoodFromRawInputUseCase` — carrying `nutritionSnapshot` and,
where available, `foodCatalogRef` — deterministically, without a fresh by-name lookup.

**Scope / betroffene Dateien (revised during implementation — see notes below):**

- `src/features/nutrition/application/usecases/LogSavedMealToDateUseCase.ts` — for each
  item: if `item.per100g` is present, compute macros via
  `engine.calculateFromPer100g(item.per100g, item.quantityGrams)` (deterministic, no
  re-resolution), set `sourceType: 'cache'`, and carry `item.foodCatalogRef` forward onto
  the entry when present; otherwise fall back to the existing `NutritionLookup`-by-name
  path unchanged (legacy/pre-SM-002 templates). Always set `nutritionSnapshot` alongside
  the top-level macro fields, matching J-002's convention, regardless of which branch ran.
- `src/features/nutrition/domain/models/SavedMealTypes.ts` — add optional
  `per100g?: NutritionPer100g` to `SavedMealItem`.
- `src/features/nutrition/application/usecases/CreateSavedMealFromDateUseCase.ts` — derive
  `per100g` from the source entry (`macros * 100 / quantityGrams`) when `calories > 0`.

**Implementation notes (deviation from original plan above):** investigation during
implementation found `FoodCatalog.getById(id)` is keyed by the _legacy, single-source_
`InMemoryFoodCatalog`'s own id space — it has no relationship to `foodCatalogRef.sourceId`
for BLS/OFF/USDA-sourced refs (those come from `SequentialFoodCatalogResolver`'s source
objects, which are not stored in `InMemoryFoodCatalog` and have no "fetch by ref" port at
all). Re-fetching macros by `foodCatalogRef` as originally planned would therefore silently
break for exactly the sources J-004 was built to support. Instead, `SavedMealItem` carries
its own frozen `per100g` snapshot (mirroring the Journal Model's
`FoodEntry.nutritionSnapshot` frozen-snapshot philosophy) captured once at
template-creation time — this is source-agnostic, always available, and needs no catalog
dependency injected into `LogSavedMealToDateUseCase` at all. `foodCatalogRef` (SM-001) is
retained for display/traceability and is carried forward onto the logged entry, but macro
determinism comes from `per100g`, not a live re-fetch.

**Risiken:** Medium — touches the one existing write path for this domain; must not
regress the Zero-Macro Blocker (P0-004) or existing confidence-scoring behavior for the
by-name fallback branch.

**Tests:** New scenarios: (1) item with `per100g` logs an entry whose macros/
`nutritionSnapshot` are computed from that snapshot and whose `foodCatalogRef` is carried
forward, without calling `NutritionLookup`; (2) item without `per100g` falls back to
today's by-name behavior unchanged; (3) Zero-Macro Blocker still fires when neither
`per100g` nor by-name lookup produce macros.

**Akzeptanzkriterien (DoD):**

- Entries logged from a saved meal always carry `nutritionSnapshot`, and `foodCatalogRef`
  when the originating item has one.
- No re-resolution by name occurs when `per100g` is available on the item.
- Existing by-name fallback behavior is unchanged for items without `per100g`.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

Full suite (92 suites / 748 tests, +4 new), `tsc --noEmit`, and `eslint` pass clean.

---

#### SM-003: Template Management Use Cases

Status: `done`
Depends on: none (parallel to SM-001/SM-002)

**Ziel:** Close the gap between what `SavedMealRepository` already supports
(`list`/`getById`/`delete`) and what the application layer actually exposes — today only
`create` (via `CreateSavedMealFromDateUseCase`) has a use case.

**Scope / betroffene Dateien:**

- New `src/features/nutrition/application/usecases/ListSavedMealTemplatesUseCase.ts`.
- New `src/features/nutrition/application/usecases/DeleteSavedMealTemplateUseCase.ts`.
- New `src/features/nutrition/application/usecases/RenameSavedMealTemplateUseCase.ts` —
  `SavedMealRepository` has no `update`; add one (mirrors `create`'s signature) alongside
  the use case.
- `src/features/nutrition/application/ports/SavedMealRepository.ts` — add `update()`.
- `src/features/nutrition/infrastructure/repositories/InMemorySavedMealRepository.ts` —
  implement `update()`.

**Risiken:** Low — new, additive use cases and one new repository method; no existing
behavior changes.

**Tests:** One test per new use case (list returns all templates, delete removes by id and
is a no-op for unknown id, rename updates `name`/`updatedAt` and rejects unknown id).

**Akzeptanzkriterien (DoD):**

- List/Delete/Rename use cases exist, are exported from `application/usecases/index.ts`,
  and are covered by tests.
- `SavedMealRepository.update()` exists and is implemented in-memory.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** `update()` throws for an unknown id (consistent with
`RenameSavedMealTemplateUseCase` surfacing a clear error rather than silently creating a
new record); `delete()` keeps its existing silent no-op behavior for unknown ids, matching
the DoD. Full suite (92 suites / 754 tests, +6 new), `tsc --noEmit`, and `eslint` pass
clean.

---

#### SM-004: Persisted Saved Meal Repository

Status: `done`
Depends on: SM-003 (needs the final `SavedMealRepository` port shape, incl. `update()`)

**Ziel:** Give `SavedMealTemplate`s the same durable-storage treatment `FoodEntry` already
has — templates currently live only in `InMemorySavedMealRepository` and vanish on
restart.

**Scope / betroffene Dateien:**

- New `src/features/nutrition/infrastructure/repositories/PersistedSavedMealRepository.ts`,
  mirroring `PersistedFoodEntryRepository.ts`'s `KeyValueStore`-backed
  serialize/deserialize pattern.
- `src/infrastructure/di/container.ts` — register the persisted repository (this domain has
  no container entry at all today).

**Risiken:** Low — same established pattern as `PersistedFoodEntryRepository`; main risk is
an incomplete serialize/deserialize round-trip for the `foodCatalogRef` field added in
SM-001.

**Tests:** Serialization round-trip tests (with and without `foodCatalogRef` per item),
mirroring `PersistedFoodEntryRepository.test.ts`'s structure.

**Akzeptanzkriterien (DoD):**

- Templates persist across a simulated restart (repository re-instantiated over the same
  `KeyValueStore`).
- Registered in the DI container.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** `container.ts` registers only the repository itself in this task
(`_savedMealRepository`, exposed via a `savedMealRepository` getter) — wiring the SM-002/
SM-003 use cases through the container is SM-005's job, once a presentation layer exists to
consume them. `getById`/`list` return copies (`{ ...template }`), matching
`PersistedFoodEntryRepository`'s external-mutation-safety convention. Full suite (93 suites
/ 764 tests, +10 new), `tsc --noEmit`, and `eslint` pass clean.

---

#### SM-005: Presentation Layer + DI Wiring

Status: `done`
Depends on: SM-002, SM-003, SM-004

**Ziel:** Make Saved Meals reachable from the app at all — today there is zero
presentation-layer code for this domain. Minimal UI: create a template from a date's
entries, list templates, log a template to the current date, rename, delete.

**Scope / betroffene Dateien:**

- New `src/presentation/features/savedMeals/SavedMealsScreen.tsx` (list + log + delete +
  rename), following `JournalScreen.tsx`'s existing presentation conventions.
- `src/presentation/navigation/AppNavigator.tsx` — add a navigation entry.
- Entry point from `JournalScreen`/`NutritionScreen` to create a template from the current
  date's entries (`CreateSavedMealFromDateUseCase`).
- `src/infrastructure/di/container.ts` — wire the use cases from SM-002/SM-003 for
  presentation-layer consumption.

**Risiken:** Medium — first UI surface for this domain; must stay profile-independent per
the scope boundary (no evaluation/goal display in this screen).

**Tests:** Presentation-layer logic tests where feasible (e.g. list ordering, empty state);
full visual/interaction verification is out of reach in this headless agent environment —
must be logged in `docs/MANUAL_TESTING_GAPS.md` per AGENTS.md's binding rule, same as J-005.

**Akzeptanzkriterien (DoD):**

- A user can create, view, log, rename, and delete Saved Meal templates from the app.
- Screen shows no profile/evaluation-derived information.
- Manual testing gap logged for the new UI.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`; manual Expo verification
tracked as an open gap.

**Implementation notes:** Added as a new bottom tab ("Vorlagen", `SavedMeals`) rather than a
stack-modal route like `VoiceScreen` — `VoiceScreen`'s stack route is never actually
triggered anywhere in the app today (`useNavigation` is imported but commented out in
`JournalScreen.tsx`), so a tab keeps the new feature genuinely reachable rather than
repeating that pre-existing orphaned-route gap. Only supports creating/logging against
_today's_ date (no calendar/date-picker component exists in this codebase to reuse, and
`JournalScreen` itself only ever operates on `today` — consistent with existing
conventions, not a regression). The per100g-based total-calorie display
(`templateTotalCalories`, extracted to `savedMealsDisplay.ts` for unit testing, mirroring
`journalEntryDisplay.ts`) is purely factual (sum of frozen per-100g snapshots × grams) — no
evaluation or goal data is read or shown, preserving the Product Bible Abschnitt 6 boundary.
`application/index.ts` was also updated to export the SM-003 use cases (`List`/`Delete`/
`RenameSavedMealTemplateUseCase`) — they existed only on the deeper `usecases/index.ts`
barrel before this task, so `container.ts` could not import them from the feature's public
entry point. Manual testing gap logged in `docs/MANUAL_TESTING_GAPS.md`. Full suite (94
suites / 768 tests, +4 new), `tsc --noEmit`, and `eslint` pass clean.

---

#### SM-006: Saved Meals Domain Regression Coverage

Status: `done`
Depends on: SM-001–SM-005

**Ziel:** Consolidated regression pass across the full Saved Meals change set, mirroring
J-006: prove SM-001–SM-005 hold together end-to-end, not just individually.

**Scope / betroffene Dateien:** New
`src/features/nutrition/__tests__/SavedMealsDomainRegressionCoverage.test.ts` (or extend
`SavedMeals.test.ts`), exercising: create template from a date with a `foodCatalogRef`'d
entry → log template to a new date → resulting entry has matching `foodCatalogRef`/
`nutritionSnapshot` → soft-delete that entry (existing `DeleteFoodEntryUseCase`) → excluded
from `listEntriesForDate` → rename the template → delete the template → confirm it's gone
from `list()`.

**Risiken:** Low — read-only regression proof, no new production code.

**Tests:** As described above; existing P0–P1/Journal Domain regression suites are not
duplicated here (already covered by their own test files, per J-006's precedent).

**Akzeptanzkriterien (DoD):**

- Full suite green including the new cross-cutting scenario.
- `tsc --noEmit` and `eslint` pass clean.

**Verify:** `npm run test`, `npm run typecheck`, `npm run lint`.

**Implementation notes:** Built the scenario against the actual durable repositories
(`PersistedFoodEntryRepository` + `PersistedSavedMealRepository` over a shared
`FakeKeyValueStore`), not in-memory test doubles, and re-instantiates fresh repository
instances mid-test at two points to prove durability across a simulated restart —
strengthening the DoD's "hold together end-to-end" beyond what the plan literally asked
for. Full suite (95 suites / 770 tests, +2 new), `tsc --noEmit`, and `eslint` (both scoped
and full-repo `npm run lint`) pass clean.

**Saved Meals Domain: all six tasks (SM-001–SM-006) done.** The domain is now: aligned with
the Journal Model (frozen `per100g`/`foodCatalogRef` snapshots, `nutritionSnapshot` on every
logged entry), fully round-trippable through template management (list/rename/delete),
durably persisted, reachable from the app via a dedicated tab, and covered end-to-end by a
cross-cutting regression test. As with J-001–J-005, `npm run verify`'s `format:check` step
still surfaces the same pre-existing, unrelated repo-wide Prettier debt first identified in
J-001 — all files touched across SM-001–SM-006 are confirmed individually Prettier-clean.

---

### Goals & Evaluation

Status: `done` (GE-001–GE-007 done; GE-008 explicitly deferred, see its own section)

All five decomposed tasks (GE-001–GE-005 below) are `done`, plus follow-ups GE-006/GE-007
(done) and GE-008 (deferred). Like Saved Meals, this is
**not** greenfield: there is already substantial, partially-overlapping goal-tracking code,
but **no** Evaluation Profile/Rule concept (Product Bible §4/4a: Origin, swappable
Preset/User profiles, stateless Food-Catalog+Journal+Profile→Bewertung formula) exists
anywhere yet — what exists is a single, fixed calorie/macro-target scheme, which is exactly
what Product Bible §9 says must be replaced ("Goals wird zur Zielkonfiguration/-anzeige
innerhalb eines Profiles, statt eines einzelnen festen Zielschemas"). Concretely, code
inspection found **two separate, competing goal-target systems already live in the app**:

1. `src/features/goals/` (`MetabolismProfile` → `EffectiveGoals` — `mode: 'suggested' |
'manual'`, via `MetabolismCalculator`/`GoalsSuggestionCalculator`/`ProgressCalculator`) —
   wired to the actual `GoalsScreen.tsx` tab, and read by
   `src/features/journal/application/usecases/ComputeProgressForDateUseCase.ts`.
2. `src/features/nutrition/domain/goals/` (`UserGoals` — `source: 'manual' | 'calculated'`,
   via `GoalsRepository`/`PersistedGoalsRepository`) — read by
   `GetDailySummaryUseCase`/`GetCalendarMonthSummaryUseCase` (the Journal's daily/monthly
   totals).

Both are live simultaneously. Worse: `JournalScreen.tsx` calls **both** —
`getDailySummaryUseCase` (system 2, whose `DailySummary.progress`/`.remaining` fields are
never read) and `computeProgressForDateUseCase` (system 1) whose result is discarded into
an unused destructured state slot (`const [, setProgress] = useState<DailyProgressSnapshot
| null>(null)`, `journal/JournalScreen.tsx:72`). So today, **no goal-vs-consumed progress is
shown anywhere in the app**, despite two backend systems fully capable of computing it —
and per Product Bible §6/§7 (Journal-Anzeige must stay profile-independent; progress
display is profile-dependent Evaluation Engine output), `JournalScreen` computing progress
at all may itself be a boundary violation once a real Evaluation Profile exists, not just
dead code. Reconciling/removing one of the two systems and deciding where progress display
belongs (Dashboard & Insights, not Journal) are real, separate decisions — **not** solved by
GE-001–GE-005 below; see GE-005's closing notes for explicit follow-up-task stubs instead of
silently ignoring these findings.

Given that risk profile, GE-001–GE-005 stay additive-first (mirroring J-001's "narrow,
mechanical, no behavior change" precedent): introduce the Evaluation Profile/Rule contract,
adapt the _already-screen-wired_ `src/features/goals` system (not the unused-by-UI one)
behind it as the first concrete Preset, prove swappability with a second Preset, and leave
existing `GoalsScreen`/`JournalScreen` behavior otherwise unchanged.

Implementation order:

1. **Evaluation Profile & Rule Domain Contract** (GE-001)
2. **Evidence-based Standard Profile** — first concrete implementation (GE-002)
3. **Active Profile Registry + Persistence** (GE-003)
4. **Second Preset Profile (Weight Loss)** — proves swappability / Variante B (GE-004)

Cross-cutting: **GE-005** (regression coverage across GE-001–GE-004, plus follow-up stubs
for the findings above).

Depends on Journal Domain (reads journal data, done) and the Evaluation Profile contract
this decomposition itself introduces (Product Bible Abschnitt 4).

---

#### GE-001: Evaluation Profile & Rule Domain Contract

Status: `done`
Depends on: none

**Ziel:** Introduce the Evaluation Profile/Rule domain contract from Product Bible §4/4a as
plain TypeScript interfaces — no implementation, no wiring, no behavior change. Establishes
the stateless Ein-/Ausgabe formula (`Food Catalog + Journal + Benutzerprofil +
Profileinstellungen → Bewertung + Insights + Warnungen + Empfehlungen + Zielerreichung`) as
an explicit, checkable type contract instead of only prose.

**Scope / betroffene Dateien:**

- New `src/features/evaluation/domain/models/EvaluationProfile.ts` — `EvaluationProfile {
id, name, origin: 'preset' | 'user' | 'professional' | 'community' | 'ai', ruleIds:
string[], metadata: { motivation?, maturity? } }` (Product Bible §4 "Profil-Metadaten").
- New `src/features/evaluation/domain/models/Rule.ts` — `Rule { id, name, description,
dataRequirements?: string[], evaluate(input: EvaluationInput): RuleResult }` (§4a);
  `evaluate` is a pure function signature only in this task (no real rule bodies yet).
- New `src/features/evaluation/domain/models/EvaluationContract.ts` — `EvaluationInput {
foodCatalogReads, journalReadsForPeriod, userProfileBasics?, profileSettings }` and
  `EvaluationOutput { assessment, insights: string[], warnings: string[], recommendations:
string[], goalProgress }` (§4's exact input/output lists).
- New `src/features/evaluation/index.ts` barrel (new feature directory — this is the first
  code under an explicit "Evaluation Engine" module, distinct from `features/goals`).

**Risiken:** Low — additive-only domain types, zero call sites, zero behavior change.
Main risk is modeling the contract too rigidly before GE-002 proves it against real code;
mitigated by keeping `EvaluationInput`/`Output` fields loosely typed (e.g. `unknown`/generic
placeholders) where GE-002 hasn't yet determined the concrete shape.

**Tests:** Type-level only (compiles); no runtime behavior to unit test yet.

**Akzeptanzkriterien (DoD):**

- `EvaluationProfile`, `Rule`, `EvaluationInput`, `EvaluationOutput` exist and match Product
  Bible §4/§4a's documented fields exactly (Origin taxonomy, Ein-/Ausgabe lists).
- Zero existing files modified; zero behavior change; full suite stays green.
- Both duplicate goal systems and the `JournalScreen` dead-state findings above are
  reproduced in this task's implementation notes (not just the preamble) so they're
  discoverable from the task itself.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** New `src/features/evaluation/` feature (domain layer only —
`EvaluationProfile`, `EvaluationProfileOrigin`, `EvaluationProfileMetadata`, `Rule`,
`RuleResult` (= `EvaluationOutput`), `EvaluationInput`, `EvaluationOutput`,
`EvaluationGoalProgress`). `EvaluationInput.foodCatalogReads`/`journalReadsForPeriod` are
concretely typed against `nutrition`'s existing `CanonicalFood`/`FoodEntry` (not `unknown`)
since those shapes are already stable; `userProfileBasics`/`profileSettings` stay
`Record<string, unknown>` since their shape genuinely varies per Rule (e.g. a
cholesterol-limit parameter vs. a macro-strategy string), per this task's own risk note.
`EvaluationOutput`/`EvaluationGoalProgress` are defined fresh in this feature rather than
importing `features/goals`' `DailyGoals`/`DailyProgress` — deliberate: the Evaluation Engine
is the layer `features/goals` gets adapted _behind_ (GE-002), so the dependency should not
run the other way. `Rule.evaluate` is synchronous by design: all repository reads happen
when assembling `EvaluationInput` (a future orchestrator's job, GE-003), not inside a Rule
itself, keeping Rules trivially pure-function-testable. `EvaluationProfile` intentionally has
no `evaluate` method of its own (§4a: "kein eigener Algorithmus") — merging its Rules'
`RuleResult`s into one `EvaluationOutput` is implementation, deferred to GE-002.

Reproduces the preamble's findings directly in this task, as required by its own DoD: (1)
two competing goal-target systems (`features/goals`'s `EffectiveGoals`, screen-wired, vs.
`nutrition/domain/goals`'s `UserGoals`, read by `GetDailySummaryUseCase`/
`GetCalendarMonthSummaryUseCase`) exist simultaneously; (2) `JournalScreen.tsx` calls both
`getDailySummaryUseCase` and `computeProgressForDateUseCase` and displays neither result
(`const [, setProgress] = useState<DailyProgressSnapshot | null>(null)`,
`journal/JournalScreen.tsx:72`) — no goal-vs-consumed progress is shown anywhere in the app
today. Neither is touched by this task; see GE-005 for explicit follow-up stubs.

Full suite (96 suites / 772 tests, +2 new), `tsc --noEmit`, and `eslint` pass clean. Zero
existing files modified.

---

#### GE-002: Evidence-based Standard Profile

Status: `done`
Depends on: GE-001

**Ziel:** First concrete `EvaluationProfile` implementation — adapts the _already
screen-wired_ `src/features/goals` system (`MetabolismProfile`/`EffectiveGoals`/
`ProgressCalculator`), not the unused-by-UI `nutrition/domain/goals` one, behind the GE-001
contract as the Default-Profile (Origin: `preset`), per Product Bible §5 "Evidence-based
Standard". No behavior change to `GoalsScreen.tsx` or `ComputeProgressForDateUseCase`.

**Scope / betroffene Dateien:**

- New `src/features/evaluation/application/profiles/EvidenceBasedStandardProfile.ts` — an
  adapter implementing GE-001's `EvaluationProfile`/`Rule` shape by delegating to the
  existing `ComputeMetabolismResultUseCase`/`SuggestGoalsUseCase`/`calculateDailyProgress`
  (`src/features/goals/application/*`), read-only, no new persistence.
- New `src/features/evaluation/application/rules/CalorieMacroCorridorRule.ts` — wraps
  `calculateDailyProgress` (`src/features/goals/application/calculators/ProgressCalculator.ts`)
  as a `Rule`, producing an `EvaluationOutput` from the same inputs
  `ComputeProgressForDateUseCase` already computes today.

**Risiken:** Low-medium — first real implementation against the GE-001 contract; may
surface contract gaps (fixed in this task, since GE-001 has no other call sites to break).
No existing use case is modified — this is a parallel adapter, proving the contract fits
without touching the live `GoalsScreen`/`ComputeProgressForDateUseCase` path yet.

**Tests:** `EvidenceBasedStandardProfile`/`CalorieMacroCorridorRule` produce an
`EvaluationOutput` equivalent (same consumed/target/status) to today's
`ComputeProgressForDateUseCase` output for the same fixture inputs.

**Akzeptanzkriterien (DoD):**

- A concrete `EvaluationProfile` exists and is unit-tested against fixture Journal/goals data.
- No behavior change to any existing screen or use case.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** `CalorieMacroCorridorRule.evaluate()` reads its target goals from
`EvaluationInput.profileSettings` (cast to a small local `CalorieMacroCorridorSettings {
goals: DailyGoals }` interface — `profileSettings` stays `Record<string, unknown>` in the
contract per GE-001, since its shape is genuinely rule-specific), aggregates
`journalReadsForPeriod` via the existing (unmodified) `aggregateConsumed`, and calls the
existing (unmodified) `calculateDailyProgress` — this task adds a reshaping layer only, no
new calculation logic. Test proves numeric equivalence (not just structural plausibility)
against `ComputeProgressForDateUseCase` for identical fixture Journal entries/goals, plus a
second case proving the over-calories warning fires correctly. `EvidenceBasedStandardProfile`
is the plain `EvaluationProfile` metadata object (Origin `preset`, one rule id) — no
orchestrator runs it yet; mapping `ruleIds` to actual `Rule` instances and merging their
`RuleResult`s is GE-003's job. Neither `GoalsScreen.tsx` nor `ComputeProgressForDateUseCase`
was modified — confirmed by running the full suite unchanged. Full suite (97 suites / 775
tests, +5 new), `tsc --noEmit`, and `eslint` pass clean.

---

#### GE-003: Active Profile Registry + Persistence

Status: `done`
Depends on: GE-002

**Ziel:** Introduce a persisted "active Evaluation Profile" selection, defaulting to
GE-002's Evidence-based Standard, as a pure read-context (Product Bible §2a Variante B: a
profile switch is never a data migration).

**Scope / betroffene Dateien:**

- New `src/features/evaluation/application/ports/EvaluationProfileRegistry.ts` — `list():
EvaluationProfile[]`, `getActiveProfileId(): Promise<string>`,
  `setActiveProfileId(id): Promise<void>`.
- New `src/features/evaluation/infrastructure/PersistedActiveProfileRepository.ts` —
  `KeyValueStore`-backed (reuses the nutrition feature's `KeyValueStore` port/
  `AsyncStorageKeyValueStore`, mirroring SM-004's pattern), defaulting to GE-002's profile id
  when unset.
- New `src/features/evaluation/application/usecases/GetActiveEvaluationOutputUseCase.ts` —
  resolves the active profile id, looks it up in the (currently single-entry) registry, and
  runs it — the first real "swap the interpretation without touching Journal/Food Catalog"
  code path, but not yet wired into any screen.

**Risiken:** Low — additive; no existing screen calls this yet, so nothing regresses.

**Tests:** Defaults to GE-002's profile when nothing is set; persists and reflects an
explicit selection across a fresh repository instance (durability, mirroring SM-004's test
pattern).

**Akzeptanzkriterien (DoD):**

- Active profile selection persists and defaults correctly.
- No Journal or Food Catalog writes occur on a profile switch (explicit test).
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** `PersistedActiveProfileRepository` takes `knownProfiles:
EvaluationProfile[]` as a constructor argument rather than hardcoding
`EvidenceBasedStandardProfile` — GE-004's second Preset only needs a longer array at the
composition root, not a change to this class. Defaults to `knownProfiles[0]` both when
nothing is stored _and_ when a stored id no longer matches any known profile (defensive —
never throws for "nothing set yet"); rejects `setActiveProfileId` for an unknown id.
`GetActiveEvaluationOutputUseCase` resolves the active profile, maps its `ruleIds` through
an injected `knownRules: Rule[]` array (same "inject, don't hardcode" reasoning), and merges
each `Rule`'s `RuleResult` via a new `mergeRuleResults()` helper (generic over any number of
rules, not just today's one-rule-per-profile case). "No Journal/Food Catalog writes on a
profile switch" is proven by an explicit test spying on `InMemoryFoodEntryRepository`'s
write methods across two `setActiveProfileId` calls, not just by the class's structural
inability to reach those repositories. Nothing wired into any screen yet, per this task's
own scope. Full suite (99 suites / 784 tests, +9 new), `tsc --noEmit`, and `eslint` pass
clean.

---

#### GE-004: Second Preset Profile (Weight Loss) — Proves Swappability

Status: `done`
Depends on: GE-003

**Ziel:** Implement a second concrete `EvaluationProfile` (Product Bible §5 "Weight Loss":
Kaloriendefizit + Proteinerhalt) and prove — with a real regression test, not just
assertion-by-design — that switching the active profile reinterprets the _same_ Journal day
differently, with zero Journal/Food-Catalog mutation (Variante B, §2a).

**Scope / betroffene Dateien:**

- New `src/features/evaluation/application/profiles/WeightLossProfile.ts` + a
  `ProteinPreservingDeficitRule` alongside `CalorieMacroCorridorRule` (reuses
  `MetabolismCalculator`'s TDEE with a deficit adjustment, not a new metabolism model).

**Risiken:** Low — additive second implementation of an already-proven (GE-002) contract.

**Tests:** For one fixed Journal day + goals input, `GetActiveEvaluationOutputUseCase`
returns a different `EvaluationOutput.assessment`/`goalProgress` under
`EvidenceBasedStandardProfile` vs. `WeightLossProfile`, with no calls to any Journal/Food
Catalog write path in either branch (spy/assert no writes).

**Akzeptanzkriterien (DoD):**

- Two swappable profiles exist and produce demonstrably different output for identical
  underlying data.
- Variante B (no data migration on switch) is proven by test, not just by design.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** Extracted the goalProgress-array/warning/assessment reshaping
logic shared by both rules into `dailyProgressToEvaluationOutput.ts` (refactored
`CalorieMacroCorridorRule` to use it too — GE-002's equivalence test still passes
unchanged, confirming no behavior change). `ProteinPreservingDeficitRule` reuses the
existing, unmodified `suggestDailyGoals(..., 'high_protein')` macro split against a
20%-below-TDEE calorie target (`WEIGHT_LOSS_DEFICIT_MULTIPLIER = 0.8`) rather than
introducing new macro math — genuinely "Kaloriendefizit + Proteinerhalt" per Product Bible
§5, not a relabeled copy of the Evidence-based Standard rule. `ProfileSwappability.test.ts`
proves the core claim with concrete fixture numbers (same 2000 kcal/100g protein/250g
carbs/60g fat consumed day: `on-track` under a 2500 kcal Evidence-based Standard target,
`over` under a 1440 kcal Weight Loss deficit target) plus a spy on
`InMemoryFoodEntryRepository`'s write methods across both profile evaluations and the
switch itself. Full suite (101 suites / 788 tests, +10 new), `tsc --noEmit`, and `eslint`
pass clean.

---

#### GE-005: Goals & Evaluation Domain Regression Coverage

Status: `done`
Depends on: GE-001–GE-004

**Ziel:** Consolidated regression pass across GE-001–GE-004, mirroring J-006/SM-006, plus
explicit follow-up-task stubs for the findings documented in this section's preamble that
are deliberately **out of scope** here.

**Scope / betroffene Dateien:** New
`src/features/evaluation/__tests__/EvaluationDomainRegressionCoverage.test.ts`: set active
profile to Evidence-based Standard → get output for a fixture day → switch active profile
to Weight Loss (GE-003/GE-004) → get output for the _same_ fixture day → assert different
assessment, zero Journal/Food-Catalog writes across the whole flow, and that
`EvaluationProfileRegistry.list()` includes both.

**Risiken:** Low — read-only regression proof, no new production code beyond the test file
and (if needed) a `ROADMAP.md` update adding the follow-up task stubs below.

**Tests:** As described above.

**Akzeptanzkriterien (DoD):**

- Full suite green including the new cross-cutting scenario.
- `tsc --noEmit` and `eslint` pass clean.
- `ROADMAP.md` gains explicit `todo` follow-up task stubs (not implemented by GE-005 itself)
  for: (a) reconciling/retiring the duplicate `nutrition/domain/goals`/`GetDailySummaryUseCase`
  goal-target system now that GE-002 establishes the real one; (b) resolving
  `JournalScreen.tsx`'s discarded `computeProgressForDateUseCase` call and whether
  progress display belongs there at all (Product Bible §6/§7 boundary) or only in Dashboard
  & Insights; (c) `GoalsScreen.tsx`'s eventual move to a Product-Bible-§4b-compliant "Ziel
  wählen" (profile-picker) surface once more than one profile should be user-selectable —
  none of these are mechanical enough to fold into GE-001–GE-005's additive scope.

**Verify:** `npm run test`, `npm run typecheck`, `npm run lint`.

**Implementation notes:** `ProfileSwappability.test.ts` (GE-004) already proved the
single-session switch/compare/zero-writes scenario, so this task's own test file focuses on
what wasn't yet covered: durability of the active-profile selection across a _simulated app
restart_ (fresh `PersistedActiveProfileRepository`/`GetActiveEvaluationOutputUseCase`
instances over the same `KeyValueStore`, mirroring SM-006's restart-proof technique) — a
switch made in one "session" is still active, and still reinterprets the same fixture day
correctly, in a brand-new "session". A closing sentinel test documents where GE-001–GE-004's
own coverage lives rather than duplicating it. Full suite (102 suites / 790 tests, +2 new),
`tsc --noEmit`, `eslint` (scoped and full-repo), and `npx prettier -c .` all pass clean —
the pre-existing, unrelated 238-file Prettier debt (first identified in J-001) is unchanged;
three of this session's own new files were initially not Prettier-clean and were reformatted
in place before this task closed, not left as new debt.

**Goals & Evaluation: all five tasks (GE-001–GE-005) done.** A real Evaluation Profile/Rule
contract now exists (Product Bible §4/§4a), with two swappable, demonstrably-different
Presets (Evidence-based Standard, Weight Loss) proving Variante B (§2a) end-to-end,
including across a simulated app restart. As planned, this was deliberately additive-first:
`GoalsScreen.tsx` and `ComputeProgressForDateUseCase` are untouched, and nothing from
`src/features/evaluation` is wired into the app yet. See GE-006–GE-008 below for the
explicit, deliberately-deferred follow-up work this decomposition's own preamble
identified — none of it is mechanical enough to have been folded into GE-001–GE-005.

---

#### GE-006: Reconcile the Duplicate Goal-Target Systems

Status: `done`
Depends on: GE-002 (establishes which system is "the real one")

**Ziel:** Now that GE-002 established `src/features/goals`
(`MetabolismProfile`/`EffectiveGoals`) as the Evaluation Engine's substrate, decide and
execute how to retire or reconcile the still-live `nutrition/domain/goals`
(`UserGoals`/`GoalsRepository`) system — currently read by
`GetDailySummaryUseCase`/`GetCalendarMonthSummaryUseCase`, which are on the Journal's hot
path (`JournalScreen.tsx`'s `getDailySummaryUseCase` call, plus the calendar month view).

**Why not folded into GE-001–GE-005:** touches live, working read paths for two existing
screens/use cases; requires deciding whether `GetDailySummaryUseCase`/
`GetCalendarMonthSummaryUseCase` should read from the new Evaluation Engine instead, keep
`nutrition/domain/goals` as a deliberately-separate concept, or something else — a design
decision, not a mechanical refactor.

**Verify (once scoped):** `npm run typecheck`, `npm run test`, `npm run lint`; no regression
in `GetDailySummaryUseCase`/`GetCalendarMonthSummaryUseCase`'s existing test coverage.

**Decision (via `AskUserQuestion`):** migrate — `GetDailySummaryUseCase`/
`GetCalendarMonthSummaryUseCase` now read from `EffectiveGoalsRepository`
(`src/features/goals`), a single source of truth for goal targets.

**Implementation notes:** Investigation before migrating found the _entire_
`nutrition/domain/goals`/`GoalsRepository`/`PersistedGoalsRepository` system — plus
`nutrition/domain/metabolism` (a **third**, independent metabolism/TDEE calculator, used
only by `CalculateGoalsFromMetabolismInputsUseCase`) and the `GetGoalsUseCase`/
`SetManualGoalsUseCase`/`CalculateGoalsFromMetabolismInputsUseCase` use cases — had **zero**
callers anywhere in presentation code; they were wired into `container.ts` and exercised
only by their own tests. Given that, this task did the complete reconciliation rather than
a partial migration:

- `DailySummaryCalculator.buildDailySummary()` now takes `DailyGoals` (`features/goals`,
  just `{calories, protein, carbs, fat}`) instead of `UserGoals` — it never read
  `UserGoals`'s other fields (`activityLevel`/`updatedAt`/`source`) anyway.
- `GetDailySummaryUseCase`/`GetCalendarMonthSummaryUseCase` now depend on
  `EffectiveGoalsRepository` and unwrap `effectiveGoals?.goals ?? null`.
- Deleted entirely (dead code, zero remaining references, confirmed by a full-repo grep
  after removal): `nutrition/domain/goals/*`, `nutrition/domain/metabolism/*`,
  `nutrition/application/ports/GoalsRepository.ts`,
  `nutrition/infrastructure/repositories/PersistedGoalsRepository.ts`,
  `GetGoalsUseCase.ts`/`SetManualGoalsUseCase.ts`/
  `CalculateGoalsFromMetabolismInputsUseCase.ts` and their test files
  (`GoalsUseCases.test.ts`, `MetabolismCalculator.test.ts`, `PersistedGoalsRepository.test.ts`),
  plus their `container.ts` wiring/getters and all barrel-export lines.
- Four test files that fixture-implemented the old `GoalsRepository` port purely to satisfy
  `GetDailySummaryUseCase`'s constructor (`GetDailySummaryUseCase.test.ts`,
  `GetCalendarMonthSummaryUseCase.test.ts`, `ReminderSystem.test.ts`,
  `JournalDomainRegressionCoverage.test.ts`) were updated to fixture/use
  `EffectiveGoalsRepository`/`InMemoryEffectiveGoalsRepository` instead — none of them
  depended on the deleted type's other fields, so this was a mechanical swap.

Full suite (107 suites / 813 tests — down from 110/819 due to the three deleted dead-code
test files, no coverage lost), `tsc --noEmit`, `eslint` (scoped and full-repo), and `npx
prettier -c .` (238-file pre-existing baseline, unchanged) all pass clean. A full-repo grep
for every deleted symbol confirms zero remaining references.

---

#### GE-007: Resolve JournalScreen's Discarded Progress Computation

Status: `done`
Depends on: none (independent of GE-006, but informed by it)

**Ziel:** `JournalScreen.tsx:72` calls `computeProgressForDateUseCase.execute(today)` and
discards the result (`const [, setProgress] = useState<DailyProgressSnapshot | null>(null)`)
— decide whether goal-vs-consumed progress display belongs in `JournalScreen` at all.
Product Bible §6/§7: Journal-Anzeige must stay profile-independent; progress is
profile-dependent Evaluation Engine output, so this likely belongs in **Dashboard &
Insights** instead, not Journal — but that's a product-surface decision, not this task's to
assume silently.

**Why not folded into GE-001–GE-005:** a product-UX/architecture-boundary decision
(where does progress display belong?), not a mechanical code change — call this out via
`AskUserQuestion` (or an equivalent human review gate) rather than deciding unilaterally.

**Verify (once scoped):** depends entirely on the decision — either delete the dead call
(if progress belongs solely in Dashboard & Insights) or wire it to something real.

**Decision (via `AskUserQuestion`):** delete the dead call — progress now lives solely in
`EvaluationSummaryScreen` (DI-002), per Product Bible §6/§7's Journal-stays-profile-
independent boundary.

**Implementation notes:** Removed the `computeProgressForDateUseCase` call, the discarded
`const [, setProgress] = useState<DailyProgressSnapshot | null>(null)` state, and the now-
unused `DailyProgressSnapshot` import from `JournalScreen.tsx`. `ComputeProgressForDateUseCase`
itself and its `container.ts` wiring are left in place (untouched, still tested) — this task
was scoped to the dead call site, not to retiring the use case itself. Full suite (110
suites / 819 tests, unchanged count — no tests removed or added, since this only deleted
unreachable production code), `tsc --noEmit`, `eslint`, and `npx prettier -c` (scoped) pass
clean.

---

#### GE-008: GoalsScreen "Ziel wählen" Surface

Status: `done`
Depends on: GE-004 (needs at least two selectable profiles to be meaningful)

**Ziel:** Product Bible §4b: "Evaluation Profile", "Preset", "Origin" etc. must never
appear literally in the product surface — users choose a **Ziel** (goal/focus), not a
"Profil". Once more than one Preset should be user-selectable, `GoalsScreen.tsx` (currently
a metabolism-profile + macro-strategy form, 762 lines) needs a profile-picker UI wired to
GE-003's `EvaluationProfileRegistry`, using §4b's internal→product-surface vocabulary
mapping (e.g. "vorgeschlagenes Ziel" for a Preset-origin profile).

**Implementation notes:** Added a new "Ziel wählen" card to `GoalsScreen.tsx`, rendered
right below the header and above the (untouched) Metabolismus-Profil section. It lists
`container.evaluationProfileRegistry.list()`, highlights the active id (from
`getActiveProfileId()`), and calls `setActiveProfileId()` on selection — no Journal/Food
Catalog write path is reachable from this handler, matching GE-003's contract. New
[`goalsDisplay.ts`](src/presentation/features/goals/goalsDisplay.ts) provides `originLabel()`,
a `EvaluationProfileOrigin → string` map straight from §4b's table (`preset` → "Vorgeschlagenes
Ziel", `user` → "Eigenes Ziel", plus placeholder labels for the not-yet-implemented
`professional`/`community`/`ai` origins) — the internal words "Profil"/"Preset"/"Origin"
never render; only `originLabel()`'s output and each profile's own `name` (e.g. "Weight
Loss") do, mirroring the existing `EvaluationSummaryScreen` (DI-002) picker pattern. New
[`goalsDisplay.test.ts`](src/presentation/features/goals/__tests__/goalsDisplay.test.ts)
asserts the §4b mapping and, explicitly, that no origin ever produces a label matching
`/profil/i`, `/preset/i`, or `/\borigin\b/i`. Full suite (113 suites / 854 tests, +4 new),
`tsc --noEmit`, `eslint`, and `npx prettier -c` (scoped) pass clean. Per AGENTS.md's Manual
UI Testing Gap Log rule, a visual-verification gap entry was added to
`docs/MANUAL_TESTING_GAPS.md` (headless environment, no Expo/simulator available) — the
Ziel-picker's layout/touch behavior and its live effect on the Auswertung tab (DI-002) still
need a real-device/simulator check.

**Why not folded into GE-001–GE-005:** the highest-risk, most user-visible change of
everything found in this decomposition — a substantial rewrite of an existing, working
762-line screen, not an additive parallel path like GE-001–GE-005 stayed. Deserves its own
scoped task (and likely UI/UX input) rather than being squeezed into an additive-first epic.

**Verify (once scoped):** manual Expo verification required (this is a UI task); typecheck/
test/lint as a floor, not a substitute.

---

### Dashboard & Insights

Status: `done`

All four decomposed tasks (DI-001–DI-004 below) are `done`, plus follow-ups DI-005/DI-006
(done). Like Saved Meals and Goals & Evaluation, this is **not** greenfield, but the
existing code was worse than either: the
live "Dashboard" tab (`src/presentation/features/dashboard/DashboardScreen.tsx`, via the
legacy `src/application/usecases/GetDashboardSummary.ts`) reads from
`MockNutritionRepository`/`MockRecoveryRepository` — entirely fabricated, hardcoded
7-day preset data ("Frühstück"/"Mittagessen"/"Abendessen" with fixed macro numbers), with
**zero connection** to anything the user actually logs in Journal. The Dashboard tab has
never shown real user data. `GetDashboardSummary` also hardcodes
`DEFAULT_CALORIE_GOAL = 2000` — exactly the "fixed, generic calorie/macro screen" Product
Bible §9 says Dashboard must stop being.

**Scope boundary:** the legacy Dashboard also mixes in Recovery data (sleep/steps/resting
heart rate) — a different, unrelated vertical not part of Product Bible's four Tier-1
domains at all. DI-001–DI-004 address only the **nutrition/evaluation** portion (a new
screen surfacing GE-001–GE-005's Evaluation Engine against real Journal data); the legacy
`DashboardScreen`/`GetDashboardSummary`/Mock repositories are **not modified** — replacing
them (retiring the mock data, deciding whether Recovery gets its own screen) is out of this
decomposition's additive-first scope; see DI-004's closing notes for an explicit follow-up
stub, mirroring GE-006–GE-008.

The other concrete gap this decomposition must close: GE-001–GE-005 built a working
Evaluation Engine, but no code exists yet that assembles a real `EvaluationInput` from
actual repositories (Journal entries, `EffectiveGoals`, `MetabolismProfile`/TDEE) — GE-004's
own tests hand-built `profileSettings` bags in fixtures. Different Profiles need different
`profileSettings` shapes (Evidence-based Standard needs `{ goals }`, Weight Loss needs
`{ tdee }`), so a generic assembler can't hardcode per-profile knowledge — DI-001 solves
this via a per-profile "settings provider" the assembler delegates to, not a big
if/else per profile id.

Implementation order:

1. **EvaluationInput Assembly (Profile Settings Providers)** (DI-001)
2. **Evaluation Summary Screen** — first real consumer of the Evaluation Engine (DI-002)
3. **Rule-Level Insights & Recommendations** — fills in the `insights`/`recommendations`
   arrays both existing Rules currently always leave empty (DI-003)

Cross-cutting: **DI-004** (regression coverage across DI-001–DI-003, plus a follow-up stub
for reconciling/retiring the legacy mock Dashboard).

---

#### DI-001: EvaluationInput Assembly (Profile Settings Providers)

Status: `done`
Depends on: GE-003 (registry), GE-002/GE-004 (the two profiles needing settings)

**Ziel:** Assemble a real `EvaluationInput` for a given date from actual repositories —
`journalReadsForPeriod` from `FoodEntryRepository`, and `profileSettings` from a per-profile
provider (not a generic orchestrator that would need to know every profile's settings
shape).

**Scope / betroffene Dateien:**

- New `src/features/evaluation/application/ports/ProfileSettingsProvider.ts` —
  `ProfileSettingsProvider { profileId: string; build(dateISO: string):
Promise<Record<string, unknown>> }`.
- New `src/features/evaluation/application/settingsProviders/EvidenceBasedStandardSettingsProvider.ts`
  — reads `EffectiveGoalsRepository.get()` (`src/features/goals`), builds `{ goals }`.
- New `src/features/evaluation/application/settingsProviders/WeightLossSettingsProvider.ts`
  — reads `MetabolismProfileRepository` via the existing (unmodified)
  `ComputeMetabolismResultUseCase`, builds `{ tdee }`.
- New `src/features/evaluation/application/usecases/BuildEvaluationInputForDateUseCase.ts`
  — takes `FoodEntryRepository` + the active profile id + a `ProfileSettingsProvider[]`,
  looks up the matching provider, and assembles the full `EvaluationInput`
  (`foodCatalogReads` stays `[]` — no current Rule declares a `dataRequirements` need for
  it).

**Risiken:** Low-medium — new orchestration code, but purely additive (no existing use case
modified) and read-only.

**Tests:** Each settings provider builds the expected shape from fixture repository data;
`BuildEvaluationInputForDateUseCase` produces an `EvaluationInput` that
`GetActiveEvaluationOutputUseCase` (GE-003) can run without error for both profiles;
missing-goals/missing-metabolism-profile cases surface a clear error rather than silently
defaulting.

**Akzeptanzkriterien (DoD):**

- A real `EvaluationInput` can be built for "today" from actual repository state, for
  either registered profile, without any hardcoded per-profile branching in the assembler.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** Each provider's `build()` is declared to return
`Promise<Record<string, unknown>>` (matching the port exactly) rather than its Rule's own
narrower settings interface (`CalorieMacroCorridorSettings`/`ProteinPreservingDeficitSettings`)
— TypeScript's interface-implementation check rejected the narrower return type directly
(a named type without an index signature isn't structurally assignable to
`Record<string, unknown>` in a method-override position), so the narrowing happens on the
Rule's read side (the existing `as unknown as ...Settings` cast), not the provider's write
side. Both providers reuse existing, unmodified error types
(`GoalsNotFoundError`/`ProfileNotFoundError` from `src/features/goals`) rather than
introducing new ones for the same "nothing set yet" condition.
`BuildEvaluationInputForDateUseCase` is tested end-to-end through
`GetActiveEvaluationOutputUseCase` for both profiles using real `InMemory*` repositories
(not hand-built `EvaluationInput` fixtures), closing the gap GE-004's tests left open. Full
suite (105 suites / 797 tests, +10 new), `tsc --noEmit`, `eslint`, and `npx prettier -c
src/features/evaluation/` pass clean.

---

#### DI-002: Evaluation Summary Screen

Status: `done`
Depends on: DI-001

**Ziel:** First real consumer of the Evaluation Engine — a new screen showing the active
profile's `EvaluationOutput` (assessment, goal progress, warnings) for today, sourced from
real Journal data via DI-001 + GE-003. Explicitly nutrition-only (see this section's scope
boundary) — does not touch or replace the legacy `DashboardScreen`.

**Scope / betroffene Dateien:**

- New `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — mirrors
  `SavedMealsScreen.tsx`'s presentation conventions (container DI, `ScreenContainer`,
  `AppText`, etc.); shows assessment + per-macro goal progress + warnings for today.
- `src/presentation/navigation/AppNavigator.tsx` — new tab (mirrors SM-005's precedent of
  adding a new tab rather than mutating an existing screen).
- `src/infrastructure/di/container.ts` — wire DI-001/GE-003's use cases + a fixed
  `knownProfiles`/`knownRules`/`ProfileSettingsProvider[]` composition.

**Risiken:** Medium — first UI surface for this domain, same class of risk as SM-005.

**Tests:** Presentation-layer logic tests where feasible (mirrors SM-005's
`savedMealsDisplay.ts` extraction pattern); manual Expo verification logged as an open gap
in `docs/MANUAL_TESTING_GAPS.md` per AGENTS.md's binding rule.

**Akzeptanzkriterien (DoD):**

- A user can see the active profile's evaluation output for today, computed from their real
  Journal entries.
- Legacy `DashboardScreen`/`GetDashboardSummary` untouched.
- Manual testing gap logged for the new UI.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`; manual Expo verification
tracked as an open gap.

**Implementation notes:** Added as a new bottom tab ("Auswertung", `EvaluationSummary`,
icon `analytics`/`analytics-outline`), mirroring SM-005's precedent rather than mutating
`DashboardScreen`. `container.ts` wires a fixed, code-defined composition — `knownProfiles =
[EvidenceBasedStandardProfile, WeightLossProfile]`, `knownRules =
[CalorieMacroCorridorRule, ProteinPreservingDeficitRule]`, and both DI-001 settings
providers — as three arrays that a future profile only needs to extend, not restructure.
The screen includes a minimal profile picker (one button per registered profile, labeled by
`profile.name` — never the word "Profil" itself, per Product Bible §4b) that calls
`evaluationProfileRegistry.setActiveProfileId()` and reloads, making GE-004's swappability
proof tangible in the real app, not just in tests. `formatGoalProgressLabel`/
`formatAssessment` extracted to `evaluationSummaryDisplay.ts` (mirrors SM-005's
`savedMealsDisplay.ts` pattern) with unit tests, since no React Native component testing
library exists in this project. `GoalsNotFoundError`/`ProfileNotFoundError` (both existing,
unmodified, from `features/goals`) are caught and shown as actionable German messages
pointing at the Ziele tab, rather than a generic error. Manual testing gap logged in
`docs/MANUAL_TESTING_GAPS.md`. Full suite (106 suites / 801 tests, +4 new), `tsc --noEmit`,
`eslint`, and `npx prettier -c` (scoped) pass clean.

---

#### DI-003: Rule-Level Insights & Recommendations

Status: `done`
Depends on: DI-002 (so there's a screen to show them on; can implement in parallel)

**Ziel:** Both existing Rules (`CalorieMacroCorridorRule`, `ProteinPreservingDeficitRule`)
always return empty `insights`/`recommendations` arrays — only `warnings` has real content.
Add at least one genuine insight and one genuine recommendation per rule, so "Dashboard &
**Insights**" has actual insight content to show, not just progress numbers.

**Scope / betroffene Dateien:**

- `src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts` (or a
  small addition alongside it) — e.g. an insight when a macro is significantly under target
  ("Noch X g Protein übrig"), a recommendation when calories are under target with protein
  already met.
- `src/features/evaluation/application/rules/ProteinPreservingDeficitRule.ts` — a
  deficit-specific insight (e.g. pace-of-loss framing), distinct from the generic corridor
  insight, so the two Presets are demonstrably different in _Insights_ output too, not just
  in target numbers.

**Risiken:** Low — additive content within already-tested rules; must not change existing
`assessment`/`goalProgress`/`warnings` behavior (regression-tested).

**Tests:** New scenarios per rule proving specific insight/recommendation text appears
under specific input conditions; existing GE-002/GE-004 tests continue to pass unchanged.

**Akzeptanzkriterien (DoD):**

- Both rules produce non-empty `insights` and `recommendations` under at least one
  documented condition each.
- No change to existing `assessment`/`goalProgress`/`warnings` test expectations.
- Full suite, typecheck, lint pass clean.

**Verify:** `npm run typecheck`, `npm run test`, `npm run lint`.

**Implementation notes:** Kept `dailyProgressToEvaluationOutput()` itself unchanged (still
returns empty `insights`/`recommendations`, still shared by both rules) — each Rule now
appends its own content on top of that base result, rather than the shared helper growing
per-profile branching. `CalorieMacroCorridorRule`: a protein-remaining insight when protein
is under target, a "calorie-richer meal is possible" recommendation when calories are under
but protein is already met. `ProteinPreservingDeficitRule`: a deficit-pace insight (kcal
below TDEE) when not over the deficit target, a protein-priority recommendation when
protein is under target — genuinely distinct wording from the other rule for the same
underlying facts, proven by an explicit `not.toEqual` test. Full suite (107 suites / 808
tests, +7 new), `tsc --noEmit`, `eslint`, and `npx prettier -c` (scoped) pass clean; no
change to any existing `assessment`/`goalProgress`/`warnings` test expectations.

---

#### DI-004: Dashboard & Insights Domain Regression Coverage

Status: `done`
Depends on: DI-001–DI-003

**Ziel:** Consolidated regression pass across DI-001–DI-003, mirroring J-006/SM-006/GE-005,
plus an explicit follow-up-task stub for the legacy mock Dashboard finding documented in
this section's preamble.

**Scope / betroffene Dateien:** New
`src/features/evaluation/__tests__/DashboardInsightsDomainRegressionCoverage.test.ts` (or
similarly named): seed real Journal entries + real `EffectiveGoals`/`MetabolismProfile` via
their actual repositories → `BuildEvaluationInputForDateUseCase` → `
GetActiveEvaluationOutputUseCase` → assert the resulting `EvaluationOutput` reflects the
seeded data end-to-end (not fixture-constructed `EvaluationInput` objects, unlike GE-002–
GE-005's tests) — the first test in this whole Evaluation Engine effort exercising the full
real-repository path, not hand-built fixtures.

**Risiken:** Low — read-only regression proof, no new production code beyond the test file
and a `ROADMAP.md` follow-up stub.

**Tests:** As described above.

**Akzeptanzkriterien (DoD):**

- Full suite green including the new end-to-end scenario.
- `tsc --noEmit` and `eslint` pass clean.
- `ROADMAP.md` gains an explicit `todo` follow-up task stub (DI-005, not implemented here)
  for reconciling/retiring `GetDashboardSummary`/`MockNutritionRepository`/
  `MockRecoveryRepository` and deciding Recovery's fate (own screen? dropped? out of
  Zera's scope entirely?) — a product decision, not mechanical enough for DI-001–DI-004.

**Verify:** `npm run test`, `npm run typecheck`, `npm run lint`.

**Implementation notes:** Seeds one real Journal day via `PersistedFoodEntryRepository`
(`KeyValueStore`-backed, the actual class the app uses) plus real `EffectiveGoals`/
`MetabolismProfile` via their real, unmodified use cases
(`SetEffectiveGoalsUseCase`/`UpsertMetabolismProfileUseCase`), then runs the _exact_ wiring
shape `container.ts` uses (same fixed `knownProfiles`/`knownRules`/settings-provider arrays)
end-to-end for both profiles — closing the gap DI-001's own tests left open (those exercised
one profile at a time against `InMemory*` repositories; this proves both together, plus
DI-003's insight-content divergence, against the real repository classes). Confirms the
seeded Journal day itself is never mutated by any evaluation/profile-switch call (Variante
B). Full suite (108 suites / 810 tests, +2 new), `tsc --noEmit`, `eslint` (scoped and
full-repo), and `npx prettier -c .` (238-file pre-existing baseline, unchanged) all pass
clean.

Writing this test surfaced one more concrete gap, beyond what the preamble already
identified: `container.ts` constructs `EffectiveGoalsRepository`/`MetabolismProfileRepository`
as `InMemoryEffectiveGoalsRepository`/`InMemoryMetabolismProfileRepository` — **not**
`KeyValueStore`-backed like every other repository in this app (`PersistedFoodEntryRepository`,
`PersistedSavedMealRepository`, `PersistedActiveProfileRepository`, ...). A user's
`GoalsScreen` metabolism profile and goals are lost on every app restart today. Added as
DI-006 below, alongside DI-005.

**Dashboard & Insights: all four tasks (DI-001–DI-004) done.** The Evaluation Engine
(GE-001–GE-005) now has a real data path into it (DI-001), a real UI surface consuming it
(DI-002, new "Auswertung" tab, legacy `DashboardScreen` untouched), and genuine per-profile
insight content (DI-003), all proven end-to-end against real repositories (DI-004). See
DI-005/DI-006 below for the explicit, deliberately-deferred follow-up work this
decomposition's preamble and this task's own testing identified.

---

#### DI-005: Reconcile/Retire the Legacy Mock Dashboard

Status: `done`
Depends on: DI-002 (there must be a real replacement surface first)

**Ziel:** Decide and execute what happens to `DashboardScreen.tsx`/`GetDashboardSummary`/
`MockNutritionRepository`/`MockRecoveryRepository` now that `EvaluationSummaryScreen` (DI-002)
provides a real, nutrition-evaluation-driven alternative. Options include: retire the
Dashboard tab entirely in favor of the new one, keep Dashboard for Recovery only (splitting
out the currently-conflated nutrition mock data), or something else.

**Why not folded into DI-001–DI-004:** the highest-risk, most user-visible change
identified in this whole decomposition — removing or rewriting a live, working (if
mock-backed) screen, and deciding Recovery's product fate, which this decomposition's
Product Bible scope says nothing about. A design decision, not a mechanical refactor.

**Verify (once scoped):** manual Expo verification required (UI task); typecheck/test/lint
as a floor, not a substitute.

**Decision (via `AskUserQuestion`):** remove the Dashboard tab entirely — the nutrition
portion is superseded by `EvaluationSummaryScreen`; Recovery's fate is explicitly a separate
question, not decided by this task.

**Implementation notes:** Investigation before removing found `DashboardScreen`/
`GetDashboardSummary` were the _only_ consumers of the combined recovery+nutrition mock
summary — `RecoveryScreen.tsx` (still-active "Erholung" tab) uses `GetRecoverySummary`/
`RecoveryRepository`/`MockRecoveryRepository` directly, and `NutritionScreen.tsx`
(still-active "Ernährung" tab) uses `GetNutritionSummary`/`NutritionRepository`/
`MockNutritionRepository` directly — neither depends on `GetDashboardSummary` itself. So
only `GetDashboardSummary`, `DashboardScreen.tsx`, and its tab registration were removed;
`MockRecoveryRepository`/`MockNutritionRepository`/`RecoveryRepository`/`NutritionRepository`/
`GetRecoverySummary`/`GetNutritionSummary` and the domain models they use (`Sleep`, `Steps`,
`NutritionEntry`, `HeartRate`, `TimeRange`) are **untouched** — their fate (real Recovery
data source? retire Nutrition tab too, since Journal is now the real nutrition surface?) is
explicitly out of this task's scope, per the decision above.

Also removed `Apptest.tsx` (a root-level Supabase edge-function health-check dev utility)
and its `tsconfig.json` include entry — its only caller was `DashboardScreen`'s "USDA Health
Check" debug button, so it became fully orphaned by this change; a full-repo grep confirmed
zero other references before deletion. Updated `EvaluationSummaryScreen.tsx`'s doc comment,
which referenced the now-removed `DashboardScreen`/`GetDashboardSummary`.

Full suite (107 suites / 813 tests — no dedicated Dashboard/GetDashboardSummary tests
existed to lose), `tsc --noEmit`, `eslint` (scoped and full-repo), and `npx prettier -c .`
(238-file pre-existing baseline, unchanged) all pass clean. A full-repo grep for
`DashboardScreen`/`GetDashboardSummary`/`Apptest` confirms zero remaining references.

**Goals & Evaluation / Dashboard & Insights follow-ups: GE-006, GE-007, and DI-005 done;
GE-008 explicitly deferred (see its own section).** All six original follow-up stubs from
the Goals & Evaluation / Dashboard & Insights decompositions have now been either resolved
or explicitly deferred by user decision.

---

#### DI-006: Persist EffectiveGoals/MetabolismProfile

Status: `done`
Depends on: none

**Ziel:** `container.ts` wires `EffectiveGoalsRepository`/`MetabolismProfileRepository`
(`src/features/goals`) as pure in-memory repositories — unlike every other repository in
this app. A user's metabolism profile and goals (`GoalsScreen`) are silently lost on every
app restart today. Add `KeyValueStore`-backed persisted implementations (mirroring
`PersistedSavedMealRepository`'s/`PersistedActiveProfileRepository`'s pattern) and wire them
into `container.ts` in place of the `InMemory*` versions.

**Why not folded into DI-001–DI-004:** discovered while writing DI-004's own regression
test, after DI-001–DI-004's scope was already fixed; a pre-existing bug in `features/goals`
infrastructure, not something DI-001–DI-004 introduced or is responsible for fixing as a
side effect.

**Verify (once scoped):** `npm run typecheck`, `npm run test`, `npm run lint`; a durability
test (repository re-instantiated over the same `KeyValueStore`, mirroring SM-004's/GE-003's
pattern) proving goals/metabolism profile survive a simulated restart.

**Implementation notes:** Both `MetabolismProfile` and `EffectiveGoals` turned out to be
fully JSON-serializable already (`createdAt`/`updatedAt`/`suggestionSnapshot.createdAt` are
already ISO strings, not `Date` objects), so `PersistedMetabolismProfileRepository`/
`PersistedEffectiveGoalsRepository` need no serialize/deserialize transformation beyond
`JSON.stringify`/`JSON.parse` — simpler than `PersistedSavedMealRepository`'s pattern, not
more complex. `container.ts`'s `_metabolismProfileRepository`/`_effectiveGoalsRepository`
fields and their public getters were retyped from the concrete `InMemory*` classes to their
port interfaces (`MetabolismProfileRepository`/`EffectiveGoalsRepository`) — confirmed
nothing outside the container called an `InMemory*`-only method (e.g. the test-only
`.clear()` helper) through the container getters before making this change. Full suite (110
suites / 819 tests, +9 new), `tsc --noEmit`, `eslint` (scoped and full-repo), and `npx
prettier -c` (scoped and full-repo, 238-file pre-existing baseline unchanged) all pass
clean.

---

# TIER 2 — CORE ARCHITECTURE

Focus: private-use stability, deterministic architecture hygiene, and DACH-first resolver correctness.

## EPIC: Supabase Foundation

### P2-001 Verify Environment Wiring

Status: `done`

Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are strictly verified.
App throws fatal error on boot if variables are missing.

**Verify:** `npm run typecheck` + `npm run test` validating environment checks.

**Implementation notes:** [`supabaseClient.ts`](src/infrastructure/supabase/supabaseClient.ts)
already threw on missing `EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY`, but this
was untested and didn't reject blank/whitespace-only values or malformed URLs. Both env vars
are now trimmed before the presence check, and the URL is additionally validated via `new
URL(url)` so a non-empty-but-invalid value (e.g. `not-a-url`) fails fast with a clear error
instead of reaching `createClient`. Since `App.tsx` imports `container.ts`, which imports
`supabaseClient.ts` at module scope, these throws still happen synchronously during app boot
as required. Added
[`supabaseClient.test.ts`](src/infrastructure/supabase/__tests__/supabaseClient.test.ts) (6
new tests) covering: missing URL, blank URL, invalid URL, missing anon key, blank anon key, and
the happy path — using `jest.isolateModulesAsync` + dynamic `import()` to reload the module
under different `process.env` states (same pattern as
`container.security.test.ts`). Full suite (108 suites / 819 tests), `tsc --noEmit`, `eslint`,
and `npx prettier -c .` (238-file pre-existing baseline, unchanged) all pass clean.

---

### P2-002 Enforce Single Supabase Client

Status: `done`

Prevent any creation of new `createClient` instances globally.
`supabaseClient.ts` is the single source of truth.
No manual `fetch` calls to `/functions/v1/` exist.

**Verify:** `npm run lint` + global search for `fetch(` targeting Supabase URLs (must yield 0 results).

**Implementation notes:** A repo-wide search confirmed only one real `createClient(...)` call
in runtime code
([`supabaseClient.ts`](src/infrastructure/supabase/supabaseClient.ts)) and zero `fetch(...)`
calls targeting `/functions/v1/` anywhere in `src/**` (the only `/functions/v1/`-adjacent
`fetch` calls live inside `supabase/functions/**`, which are server-side edge functions calling
external APIs, not the app bypassing the shared client). The one stale reference was a
`src/features/nutrition/infrastructure/catalog/README.md` code example showing a second
`createClient(...)` call with the wrong env var names — updated to import the shared `supabase`
singleton instead. To make single-client usage an enforced invariant rather than a
point-in-time grep result, added two ESLint rules in
[`.eslintrc.cjs`](.eslintrc.cjs): `no-restricted-imports` blocks importing `createClient` from
`@supabase/supabase-js` anywhere except `supabaseClient.ts` (via a file override), and
`no-restricted-syntax` blocks `fetch(...)` calls whose argument contains `functions/v1`. Both
rules were sanity-checked against a throwaway violating file (removed after confirming the
expected two lint errors). Full suite (108 suites / 819 tests), `tsc --noEmit`, `eslint`, and
`npx prettier -c .` (238-file pre-existing baseline, unchanged) all pass clean.

---

## Resolver V2 – Multi-Source Fusion Architecture

**Goal:** Redesign nutrition resolver to eliminate early translation bias and enable true multi-source comparison for better food matching accuracy.

**Current Problems:**

- Early translation biases source selection (DE→EN before querying)
- Better matches in other sources are skipped due to sequential early-return logic
- No true multi-source comparison across all candidates
- Supabase underused (only cache, not knowledge layer)

**Target Architecture:**

### Core Principles

1. **NO EARLY TRANSLATION**
   - Input stays language-native until source-specific adaptation
   - Only normalize (case, umlauts, punctuation, tokens)
   - Each source receives appropriate query variant

2. **SOURCE-NATIVE QUERYING**
   - BLS receives "ei", "eier" (German terms)
   - USDA receives "egg" (English equivalent)
   - OFF receives original input (multilingual database)

3. **MULTI-SOURCE CANDIDATE RETRIEVAL**
   - All relevant sources return candidates before decision
   - No early return before cross-source comparison
   - Negative cache only exception

4. **CANDIDATE FUSION LAYER**
   - Central ranking across ALL sources
   - Unified scoring: lexical match + token overlap + source trust + locale relevance + data completeness + plausibility
   - Traceable decision process

5. **SUPABASE AS KNOWLEDGE LAYER**
   - Store queries, candidates, decisions, corrections, alias evolution
   - Build long-term canonical dataset from user interactions
   - Enable learning from resolution patterns

6. **OPTIONAL AI (STRICTLY LIMITED)**
   - ONLY for re-ranking low-confidence cases and semantic similarity
   - NEVER for macro calculation or silent decisions
   - Must be traceable and rate-limited

### Implementation Tasks

#### RESOLVER-V2-001: Remove Early Translation Layer

Status: `done`

**Description:**
Remove global translation before source querying. Keep normalization only (case, umlauts, punctuation). Input must reach multiple sources unchanged.

**DoD:**

- Tests confirm same normalized input reaches multiple sources
- No DE→EN translation before source routing
- [`getSourceQuery()`](src/features/nutrition/domain/catalog/CanonicalFood.ts:199) only adapts per source, not globally

**Verify:** Unit tests show "ei" sent to BLS, "egg" sent to USDA, "ei" sent to OFF

**Implementation notes:** Audited the current resolver pipeline end-to-end
([`SequentialFoodCatalogResolver.resolve()`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:79))
and confirmed no global/early translation layer exists: the only pre-dispatch step is
[`normalizeText()`](src/features/nutrition/application/utils/normalizeText.ts), which does
lowercase/trim/umlaut-replacement/punctuation-stripping only — no language translation. Per-
source query adaptation happens inside the source loop, once per source, via
[`getSourceQuery()`](src/features/nutrition/domain/catalog/FoodAliasDictionary.ts:204) (note:
this now lives in `FoodAliasDictionary.ts`, not `CanonicalFood.ts` — that file no longer exists;
the DoD link above is stale from when this task was written). `getSourceQuery()` only special-
cases `sourceName === 'usda'` with a known DE canonical match; every other source (`off`, `bls`,
`user`) falls through to the shared `normalizedQuery` untouched. Unit coverage already existed
for `getSourceQuery()` in isolation
([`deEnAliases.test.ts`](src/features/nutrition/__tests__/deEnAliases.test.ts)), but nothing
exercised the resolver's actual per-source dispatch end-to-end. Added two integration-level
tests to
[`SequentialFoodCatalogResolver.test.ts`](src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts)
(new `describe('Source-Native Query Adaptation (RESOLVER-V2-001 / RESOLVER-V2-002)')` block):
one asserting `"ei"` reaches both a mocked BLS and OFF source unchanged while the mocked USDA
source receives the mapped `"egg"` for the same resolve() call, and one asserting an unknown
term reaches OFF/USDA unchanged when no canonical entity matches. Full suite (108 suites / 821
tests, +2 new), `tsc --noEmit`, `eslint`, and `npx prettier -c .` (238-file pre-existing
baseline, unchanged) all pass clean.

---

#### RESOLVER-V2-002: Implement Source-Native Query Adapters

Status: `done`

**Description:**
Each source builds its own query from normalized input. No shared query string across sources.

**DoD:**

- BLS adapter generates German-specific queries
- USDA adapter generates English equivalents
- OFF adapter preserves original multilingual input
- Logging shows different queries per source

**Verify:** Debug logs show source-specific query adaptation

**Implementation notes:**
[`getSourceQuery()`](src/features/nutrition/domain/catalog/FoodAliasDictionary.ts:204) already
implemented per-source query adaptation (RESOLVER-V2-001's audit confirmed the dispatch loop
calls it once per source), but the `QUERY_MAP` debug log line in
[`SequentialFoodCatalogResolver.resolve()`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:112)
only surfaced `offQuery`/`usdaQuery`, silently omitting BLS. Added `blsQuery` to that log line so
all three source-native queries (`bls`, `off`, `usda`) are visible together for the same
resolve() call — since BLS/OFF both receive the untouched DE-native `normalizedQuery` and USDA
receives the source-native EN mapping when a canonical match exists, the log now demonstrates
"same input, source-specific adaptation" directly instead of only for two of three sources.
Added a debug-logging test to
[`SequentialFoodCatalogResolver.test.ts`](src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts)
that sets `APP_ENV=dev` + `EXPO_PUBLIC_RESOLVER_DEBUG=true` (Jest otherwise always resolves
`envName()` to `test`, so debug logging is normally off in the suite), spies on `console.log`,
and asserts the `QUERY_MAP` line contains `blsQuery="ei"`, `offQuery="ei"`, and
`usdaQuery="egg"` for one `resolve()` call with `"ei"`. Full suite (108 suites / 822 tests, +1
new), `tsc --noEmit`, `eslint`, and `npx prettier -c .` (238-file pre-existing baseline,
unchanged) all pass clean.

---

#### RESOLVER-V2-003: Implement Multi-Source Candidate Retrieval

Status: `done`

**Description:**
All sources return candidates before decision. Remove early-return logic except negative cache.

**DoD:**

- [`SequentialFoodCatalogResolver`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:56) collects from all sources
- No early return based on confidence thresholds
- Logs show candidates from multiple sources per query

**Verify:** Resolution logs show multi-source candidate collection

**Implementation notes (human-approved scope, see conversation):** The literal DoD text ("no
early return except negative cache") would also remove the deterministic user-alias fast path
and the documented DACH Data Strategy "Resolver Decision Rule" (BLS high-confidence generic
match → accept as truth without cross-checking OFF/USDA). Both were confirmed with the human
maintainer as deliberate, non-arbitrary behavior distinct from the thing this task actually
targets, so they were kept:

- **Removed:** OFF's confidence-threshold early return
  (`best.score >= offEarlyReturnMinConfidence`), which was an arbitrary "OFF is good enough,
  don't bother checking USDA" shortcut with no strategic backing. OFF's candidates now always
  flow into `allRawCandidates` like every other source, so USDA (and BLS, if not already
  matched) get a fair comparison via the existing scoring/ranking step
  (`scoreCandidates`/`buildResolverDecision`) instead of losing by default. The dead
  `SourceRoutingStrategy.offEarlyReturnDisabled` flag (and its unused `blsEarlyReturnDisabled`/
  `userEarlyReturnDisabled` siblings, which were never actually read by the BLS/user fast
  paths) were removed along with the block that consumed them.
  `FoodCatalogConfig.offEarlyReturnMinConfidence` itself was left in place (marked
  `@deprecated`/unused in a doc comment) rather than deleted, to avoid churning ~20 existing
  test fixtures that still set it.
- **Kept:** the user-alias fast path (deterministic, local, no network call — not a confidence
  heuristic) and the BLS "DACH generic truth" fast path
  (`source.type === 'bls' && locale === 'de' && ... && best.score >= threshold`), which already
  implements the `ROADMAP.md` DACH Data Strategy's "Resolver Decision Rule" (§5): a
  high-confidence BLS match for a generic DE input is accepted without querying OFF/USDA.
- **Locale-based source priority:** `determineSourceRoutingStrategy()` now puts `bls` ahead of
  `off`/`usda` for **any** German-locale, non-branded input (previously only for `inputType ===
'generic'`; ambiguous/unclassified DE input still queried `off` first). This directly
  addresses the human's ask that BLS — as the trusted local source for the DACH launch market —
  should have priority, and keeps the priority decision centralized in one function so future
  non-DACH locales can add their own trusted-source ordering without touching the dispatch
  loop.
- Added a `describe('Multi-Source Candidate Retrieval (RESOLVER-V2-003)')` block to
  [`SequentialFoodCatalogResolver.test.ts`](src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts):
  one test confirming OFF+USDA candidates are both collected into the same decision
  (`result.candidates` contains both `'OFF'` and `'USDA'`) instead of OFF pre-empting USDA, and
  one confirming BLS is queried before OFF for German-locale ambiguous/unclassified input
  (via `mock.invocationCallOrder`).
- Updated two pre-existing tests whose premise was OFF's now-removed early return: "returns OFF
  result with high confidence without checking USDA" → renamed to reflect that USDA is now
  always queried too (identical OFF/USDA match quality now resolves via source-trust tie-break
  to USDA, consistent with the existing "returns USDA when match quality is tied..." test right
  below it); the "Lookup Summary Metrics" debug-log test's `sourcesTried` expectation was
  updated from `['off']` to `['off', 'usda']` since USDA is now always tried (it still
  contributes no candidates in that fixture, so `winnerSource` stays `'OFF'`).
- Full suite (108 suites / 824 tests, +2 new), `tsc --noEmit`, `eslint`, and `npx prettier -c .`
  (238-file pre-existing baseline, unchanged) all pass clean.

---

#### RESOLVER-V2-004: Build Candidate Fusion Layer

Status: `done`

**Description:**
Central scoring across all sources. Introduce unified Candidate type with cross-source ranking.

**DoD:**

- Unified candidate scoring algorithm
- Cross-source comparison logic
- Ranking logs show source comparison rationale

**Verify:** Ranking logs demonstrate cross-source candidate evaluation

**Implementation notes:** The unified scoring algorithm and cross-source comparison logic
already existed — [`ScoreCalculator`](src/features/nutrition/application/services/ScoreCalculator.ts)
computes one shared breakdown (`matchScore`/`dataQualityScore`/`kcalConsistencyScore`/
`sourceTrustScore`/`finalScore`, weighted per `WEIGHTS`, plus a semantic-class multiplier and a
generic-food plausibility penalty) for every candidate regardless of source, and
`SequentialFoodCatalogResolver.scoreCandidates()` applies it uniformly to `allRawCandidates` —
now populated from every queried source after RESOLVER-V2-003 — before sorting by `finalScore`
in `buildResolverDecision()`. What was missing was the third DoD line: a **log that actually
shows the cross-source ranking rationale** for a human/operator, not just the full
`ResolverDebugCollector` JSON dump (which requires `enableDebugLogs` **and** `enableTracing`
**and** `isDebugLoggingEnabled()` all at once, and buries the ranking inside a large JSON
object rather than presenting it as a readable comparison).

Added a dedicated `RANKING` debug log line in
[`SequentialFoodCatalogResolver.resolve()`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:409),
gated the same way as the existing `QUERY_MAP`/`SOURCE` debug lines
(`isDebugLoggingEnabled() && traceId`), emitted whenever a decision is reached via the
multi-source comparison path (as opposed to one of the early-return fast paths above it) —
e.g. `[traceId] RANKING query="..." candidateCount=2 #1 source=OFF score=0.823 name="..." | #2
source=USDA score=0.751 name="..."`. This surfaces, in one line, which sources contributed
candidates, their rank order, and their final scores — the "source comparison rationale" the
DoD asks for — without needing the heavier full JSON debug bundle.

Added a test to
[`SequentialFoodCatalogResolver.test.ts`](src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts)
(`describe('Candidate Fusion Layer Ranking Log (RESOLVER-V2-004)')`) that enables resolver
debug logging, resolves a query where both a mocked OFF and USDA source contribute a candidate
for the same normalized name, and asserts the `RANKING` log line contains both `source=OFF` and
`source=USDA` with numbered, scored entries — i.e. the log demonstrates cross-source candidate
evaluation, not just the winner. Full suite (108 suites / 825 tests, +1 new), `tsc --noEmit`,
`eslint`, and `npx prettier -c .` (238-file pre-existing baseline, unchanged) all pass clean.

---

# TIER 3 — INFRASTRUCTURE

Focus: deployment repeatability, remote guardrail verification, long-term resolver persistence, and retention support after the core loop exists.

## EPIC: Supabase Foundation

### P2-003 Document Edge Functions Deploy Process

Status: `done`

Ensure `supabase/config.toml` is respected in deployment.
`verify_jwt=false` safely applied.
README section in `/supabase` on how to run `supabase functions deploy`.

**Verify:** Local `supabase start` parses `config.toml` and allows anonymous invokes.

**Implementation notes:** [`supabase/config.toml`](supabase/config.toml) already set
`verify_jwt = false` for both deployed functions
([`food-off-search`](supabase/functions/food-off-search),
[`food-usda-search`](supabase/functions/food-usda-search)) — confirmed both config sections
match a real function subdirectory, so the CLI has a valid target for each. The deployment
workflow itself (link → verify schema → `deploy:edge:verify`) was already documented in
[`supabase/functions/README.md`](supabase/functions/README.md)'s "Deployment" section from
earlier work. What was missing was a `/supabase`-root README to orient someone browsing the
directory before they find the functions-specific one — added
[`supabase/README.md`](supabase/README.md) as a short index pointing to `config.toml`,
`functions/README.md`, and `migrations/`.

**Verification gap (environment limitation, not routed around):** The DoD's literal
verification step — running `supabase start` locally and confirming `config.toml` is parsed
with anonymous invokes allowed — could not be executed in this sandboxed session. Docker
itself is available, but the `supabase` npm package's postinstall script (which downloads the
actual `supabase` CLI binary from GitHub Releases) is blocked by this environment's network
policy (`403` on the release download, same root cause as the dependency-hygiene report's
finding #3), so `npx supabase` has no binary to run. `config.toml`'s syntax and structure were
verified by inspection instead (valid TOML, section names match function directories 1:1).

---

## EPIC: Edge Guardrails (Food Search)

### P2-007 Deploy & Verify Guardrails

Status: `done`

Deploy guardrails with correct `verify_jwt=false` properties.
App calls remote endpoints anonymously without 401s.

**Verify:**

1. `npm run verify:supabase:link` must pass.
2. `npm run verify:schema` must pass.
3. `npm run deploy:edge:verify` must pass.

**Implementation notes:** Both guardrail functions were already deployed and live on the
remote project (`kbplfcqluqqowmvchvhc`) — confirmed via the Supabase MCP connector (not the
npm scripts, see verification-gap note below): `food-off-search` (v10) and `food-usda-search`
(v11) both report `status: "ACTIVE"` and `verify_jwt: false`, matching
[`supabase/config.toml`](supabase/config.toml) exactly. Fetched `food-off-search`'s deployed
source via the MCP connector and spot-diffed it against the local repo's
`supabase/functions/food-off-search/index.ts` / `_shared/guardrails.ts` — identical, so the
live guardrail logic (query length 2–64, punctuation-only rejection, repeated-char rejection,
30 req/min rate limit) matches what's in this repo, not a stale build. The two target tables
`verify:schema` checks for (`food_query_cache`, `food_catalog_items`) both exist in the remote
DB (confirmed via `mcp__Supabase__list_tables`).

**Verification gap + false-positive finding (environment limitation, not routed around):**
None of the three DoD npm scripts could be trusted to run in this sandbox. `verify:edge` fails
outright — this environment's network egress policy doesn't allowlist
`kbplfcqluqqowmvchvhc.supabase.co`, so the `fetch()` call never reaches Supabase; the agent
proxy rejects the CONNECT tunnel with `403` before it leaves the sandbox
(`gateway answered 403 to CONNECT`). More notably, **`verify:schema` reported a false PASS**
under the same conditions: the script treats any `200`/`401`/`403` response as "table exists"
(401/403 meaning "RLS correctly blocks anonymous reads"), but the sandbox's own network-block
response is _also_ `403` with no way for the script to distinguish "Supabase said no" from "the
network never let this request through." The genuine schema check above was done via the
Supabase MCP connector instead, which isn't subject to this sandbox's HTTP egress allowlist.
`verify:supabase:link` also can't run (no `.env`, and the `supabase` CLI binary itself isn't
installed — same root cause as the P2-003 note: its postinstall download is blocked by network
policy). Anyone re-running these DoD scripts from a network-restricted environment should be
aware `verify:schema`'s pass/fail is not reliable there.

---

## Resolver V2 – Multi-Source Fusion Architecture

#### RESOLVER-V2-005: Introduce Supabase Knowledge Layer Tables

Status: `todo`

**Description:**
Define schema for persistent knowledge accumulation.

**Tables:**

- `canonical_foods`: Long-term food definitions
- `food_source_items`: Source-specific food mappings
- `food_aliases`: User-validated aliases
- `query_logs`: Resolution history
- `corrections`: User feedback on decisions

**DoD:**

- Schema exists and is documented
- Migration scripts available
- Edge functions can access tables

**Verify:** Schema documentation exists, tables accessible from Edge functions

**Discovery (2026-07-10, human-approved scope — see
[`reports/RESOLVER-V2-005_SCHEMA_DRIFT_2026-07-10_REPORT.md`](../reports/RESOLVER-V2-005_SCHEMA_DRIFT_2026-07-10_REPORT.md)):**
Most of this DoD already exists live on the remote project, under different names, with no
matching migration file — `food_catalog_items` ≈ `canonical_foods`, `user_food_aliases` ≈
`food_aliases`, `food_resolver_runs` ≈ `query_logs` (plus an unused `food_sources` reference
table and `food_query_cache_results` per-candidate ranking table). All four were undocumented
schema drift (created directly against the DB, never committed as a migration). Per explicit
direction, this task backfilled a migration
([`supabase/migrations/20260710_document_existing_knowledge_layer_tables.sql`](../supabase/migrations/20260710_document_existing_knowledge_layer_tables.sql))
documenting exactly what's live (idempotent, not applied to the remote project — it's already
there) rather than designing a new/parallel schema under the DoD's literal table names.
**Remaining before this can be marked `done`:** a `corrections` table (user feedback on
decisions) doesn't exist anywhere yet and needs its own scoped design; and a decision on
whether to keep the existing live names or rename them to match the DoD text. Persisting
resolution decisions into `food_resolver_runs` (no app/edge code writes to it today) is
RESOLVER-V2-006, tracked separately below.

**Migration applied to remote (2026-07-10, via Supabase MCP):** The backfill migration was a
no-op against `HealthDatabase` (`kbplfcqluqqowmvchvhc`) as expected — all four tables and
their policies already existed live. `supabase/migrations/` is now confirmed in sync with the
remote project for this task's scope.

---

#### RESOLVER-V2-006: Persist Resolution Decisions

Status: `todo`

**Description:**
Store query → candidates → final decision chain for learning and debugging.

**DoD:**

- Every resolution creates DB entries
- Decision rationale is traceable
- User corrections update knowledge base

**Verify:** DB entries created per resolution, correction flow works

**Implementation notes (human-approved scope, see conversation):** Implemented the first two
DoD lines. [`SequentialFoodCatalogResolver.resolve()`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts)
is now a thin wrapper around the previous method body (renamed to `resolveInternal()`) that
fire-and-forgets a [`ResolverRunLogger`](src/features/nutrition/application/ports/ResolverRunLogger.ts)
call after every decision — never awaited by the caller and never allowed to affect the
returned decision (errors are swallowed inside the logger). The default is a
[`NoopResolverRunLogger`](src/features/nutrition/application/ports/ResolverRunLogger.ts) (zero
behavior change for the 108 pre-existing resolver test suites, which don't pass a logger); the
DI container (`container.ts`) wires a real
[`SupabaseResolverRunLogger`](src/features/nutrition/infrastructure/repositories/SupabaseResolverRunLogger.ts)
outside test env, which inserts one row per decision into `food_resolver_runs` (mirroring
`SupabaseUserAliasSource`'s pattern: requires an auth session, silently skips otherwise). Added
[`supabase/migrations/20260711_add_resolver_run_insert_policy.sql`](supabase/migrations/20260711_add_resolver_run_insert_policy.sql)
— the table previously only had a SELECT RLS policy, so authenticated inserts were silently
rejected before this. New tests:
[`SupabaseResolverRunLogger.test.ts`](src/features/nutrition/__tests__/SupabaseResolverRunLogger.test.ts)
(session/insert/error-swallowing paths) and a new `describe('Resolver Run Logging
(RESOLVER-V2-006)')` block in
[`SequentialFoodCatalogResolver.test.ts`](src/features/nutrition/__tests__/SequentialFoodCatalogResolver.test.ts).
Full suite (109 suites / 833 tests, +5 new), `tsc --noEmit`, `eslint`, and `npx prettier -c .`
all pass clean.

**Known simplifications, left for follow-up:**

- `winner_item_id` is intentionally left `NULL` on every insert. Not every winning candidate
  (BLS static-source or user-alias fast-path winners, in particular) has a corresponding row
  in `food_catalog_items`, and that column's FK constraint would reject the insert for those
  cases; mapping winners to a real `food_catalog_items.id` needs its own task. The winner is
  still fully captured via `winner_source`/`winner_confidence`/`metadata.winnerName`.
- `cache_hit` is always recorded as `false`. The resolver's internal negative-cache
  short-circuit (`metrics.cacheHit`) isn't threaded through `ResolverDecision` today, and
  changing that return shape felt riskier than deferring it — not distinguished from a fresh
  negative resolution in the persisted row yet.
- **"User corrections update knowledge base" is not implemented** — there is no `corrections`
  table yet (see RESOLVER-V2-005's discovery above), so this DoD line is out of scope until
  that table exists.
- Not applied to the remote project by this task, same as RESOLVER-V2-005's migration —
  applying it (`supabase db push` or the Supabase MCP's `apply_migration`) is a deliberate,
  separate follow-up.

**Migration applied to remote (2026-07-10, via Supabase MCP):** The INSERT policy now exists
on `food_resolver_runs` in `HealthDatabase` (`kbplfcqluqqowmvchvhc`) — authenticated resolver
writes from `SupabaseResolverRunLogger` will no longer be silently rejected by RLS. This task
still stays `todo` overall: the "user corrections update knowledge base" DoD line remains
unimplemented pending the `corrections` table from RESOLVER-V2-005.

---

#### RESOLVER-V2-008: Backfill Missing Migration History (RLS Policy Reconciliation)

Status: `done`

**Description:**
A reconciliation across four sources of truth — local `supabase/migrations/` files, the
remote Supabase migration ledger (`mcp__Supabase__list_migrations`), the actual live schema
(`mcp__Supabase__execute_sql` / `get_advisors`), and the two "already-live, no file" cases
already documented in RESOLVER-V2-005/`20260710_document_existing_knowledge_layer_tables.sql`
— found the ledger records two more applied versions with no matching local file:
`20260201000000` (`create_user_food_aliases`) and `20260613145404`
(`harden_food_catalog_and_resolver_schema`). Both are purely a **local history gap**, not a
live schema problem: the end state either migration would produce is already covered live and
on a fresh rebuild by the later migrations (`20260710`/`20260711`/`20260712`), same as
RESOLVER-V2-005's original discovery.

**Root cause of the _actual_ live defect, isolated by this reconciliation (not fixed by this
task — see RESOLVER-V2-009):** `20260710_document_existing_knowledge_layer_tables.sql` itself
re-creates the `"Authenticated users can read sources"` policy on `food_sources` and the
`"Authenticated users can read cache results"` policy on `food_query_cache_results` using the
unoptimized `auth.role() = 'authenticated'` form — regressing both back from the
initplan-friendly `TO authenticated USING (true)` form that `20260613145404`'s hardening had
originally set. Confirmed live via `mcp__Supabase__get_advisors` (`type: "performance"`):
exactly these two tables/policies carry the `auth_rls_initplan` WARN today; the other tables
this migration touched (`user_food_aliases`, `food_resolver_runs`) kept the optimized form
because `20260710` happened to re-declare those two with `(SELECT auth.uid())` already. This
is the same regression that `20260713_harden_food_catalog_grants_and_constraints.sql`
(currently pending, not yet applied to remote) would fix.

**This task's scope (repo-only, deliberately not mixed with the live fix):**

- The two missing files —
  [`supabase/migrations/20260201000000_create_user_food_aliases.sql`](supabase/migrations/20260201000000_create_user_food_aliases.sql)
  and
  [`supabase/migrations/20260613145404_harden_food_catalog_and_resolver_schema.sql`](supabase/migrations/20260613145404_harden_food_catalog_and_resolver_schema.sql)
  — were backfilled by a separate, already-merged commit
  (`chore(supabase): backfill missing historical migration files`, from an independent
  session's PR) that recovered them **verbatim** from an orphaned `claude/tier-2-continuation-*`
  branch, which is strictly more authoritative than a reconstruction from live introspection.
  This task's own first attempt reconstructed both files independently from live schema
  introspection before discovering that merge (see the "Multi-session note" below); the
  reconstructions were discarded once the verbatim-recovered files were confirmed already on
  the default branch, since keeping both would have produced a same-path add/add conflict.
  Both are `IF NOT EXISTS`/`DROP ... IF EXISTS` guarded — a safe no-op against the
  already-migrated remote project and a correct create-from-scratch script for a fresh/local
  database.
- **Not applied to remote** — the versions are already recorded as applied in the ledger, so
  `supabase db push`/`apply_migration` would not (and should not) re-run them.
- **Does not claim to fix** the two live `auth_rls_initplan` WARNs above — that requires an
  actual new migration application (RESOLVER-V2-009), not a documentation backfill.
- Verified the merged files' end state matches reality by replaying the full local migration
  order mentally against live introspection: `20260613145404` sets the optimized form for
  `food_sources`/`food_query_cache_results`, then `20260710` (unchanged, already committed)
  overwrites both back to the unoptimized form — so a fresh local DB reproduces the exact same
  regression the live project currently has, which is the historically accurate outcome.

**Multi-session note:** while this task was reconciling the migration history, a separate
already-in-flight session merged its own backfill of the same two file paths first (confirmed
via `git fetch origin <default-branch>` showing new commits on the base after this branch was
created, per the repo's git-branch-sync rule). Rather than silently pushing a conflicting
duplicate, this task merged the updated default branch in, resolved the add/add conflict by
keeping the upstream verbatim-recovered files, and kept only the root-cause diagnosis and
RESOLVER-V2-009 follow-up documentation below, which the other session's commit did not
include.

**Verify:** `git --no-pager status --short` / `git --no-pager diff --stat` (migration files +
`ROADMAP.md` only); no runtime/application code touched (Category 1/"documentation-adjacent"
per `VERIFY.md`'s decision table — pure SQL migration text, no `src/**` or `supabase/functions/**`
changes). Cross-checked against the remote project via the Supabase MCP connector
(`list_migrations`, `execute_sql` against `pg_policies`/`pg_constraint`/
`information_schema.role_table_grants`, `get_advisors`) rather than the npm `verify:schema`/
`verify:edge` scripts, consistent with this sandbox's known network-egress limitation (see
P2-007's verification-gap note above).

---

#### RESOLVER-V2-009: Apply the Pending RLS-Policy Fix (`20260713`)

Status: `todo`

**Description:**
Separate, live-effecting follow-up to RESOLVER-V2-008's reconciliation. Not started by this
task on purpose — mixing a repo-only history backfill with an actual remote policy change in
one task would make it harder to review each independently and to attribute the live effect
correctly.

**Scope for whoever picks this up:**

1. Before applying, fix
   [`supabase/migrations/20260713_harden_food_catalog_grants_and_constraints.sql`](supabase/migrations/20260713_harden_food_catalog_grants_and_constraints.sql)'s
   header comment — it currently claims **"This entire migration is already live"**, which
   RESOLVER-V2-008's reconciliation shows is no longer accurate: two policies
   (`food_sources`."Authenticated users can read sources", `food_query_cache_results`.
   "Authenticated users can read cache results") were reset to the unoptimized form by
   `20260710` after this migration was drafted. The comment should say plainly that tables,
   constraints, grants, seeds, and most policies are already live, but these two policies are
   being deliberately re-applied to repair that specific `20260710` regression.
2. Apply the migration to `HealthDatabase` (`kbplfcqluqqowmvchvhc`) in a controlled way (e.g.
   `mcp__Supabase__apply_migration` or `supabase db push`), then re-run
   `mcp__Supabase__get_advisors` (`type: "performance"`) and confirm both `auth_rls_initplan`
   WARNs for `food_sources`/`food_query_cache_results` are gone.
3. Only after that verification should general CI planning for the migration pipeline resume
   — CI must not compare migration file name sets alone (local filenames and ledger versions
   can diverge, as RESOLVER-V2-008 shows), it needs to understand ledger versions and
   documented exceptions like the ones above.

---

## Tier 3 Planning Targets — Require Later Task Decomposition

The following modules remain planned but not yet scoped into concrete implementation tasks.

| Module    | Status | Notes                                |
| --------- | ------ | ------------------------------------ |
| Reminders | `todo` | Notification-based logging reminders |
| Insights  | `todo` | Trend analysis, weekly summaries     |

---

# TIER 4 — PUBLIC LAUNCH

Focus: identity and external platform integrations needed for broader public availability.

## EPIC: Auth & Subscription (Later)

### P2-008 Apple/Google Login via Supabase Auth

Status: `todo`

User can login via OAuth. App retrieves a valid Supabase JWT and stores it securely.

**Implementation notes (human-approved scope — scaffold only, see conversation):** A working
OAuth login needs things this session cannot provide: registered Apple/Google OAuth
applications (Apple Developer Program, Google Cloud Console) with real client credentials
configured in the Supabase Auth dashboard, plus native config
(`app.json` deep-link scheme/associated domains) and new dependencies (e.g.
`expo-web-browser`, `expo-apple-authentication`) — both `app.json` and `package.json` are
protected files requiring explicit approval per `.agent/config/protected-files.json`, and
none of that can be tested without a real device/simulator anyway. Given that, this task
prepared the application-layer scaffold only, with **no** `app.json`/`package.json` changes:

- Extended [`AuthRepository`](src/features/auth/application/ports/AuthRepository.ts) with
  `getCurrentSession()`, `signInWithOAuth(provider)`, and `signOut()` (`OAuthProvider =
'apple' | 'google'`).
- [`SupabaseAuthRepository`](src/features/auth/infrastructure/SupabaseAuthRepository.ts)
  implements these via `@supabase/supabase-js`'s built-in `auth.signInWithOAuth()` (already a
  dependency, no new package needed for this part) with `skipBrowserRedirect: true` — it
  returns the provider's authorization URL rather than opening it.
- Added [`SignInWithOAuthUseCase`](src/features/auth/application/usecases/SignInWithOAuthUseCase.ts)
  and wired both into `container.ts` (`signInWithOAuthUseCase` getter).
- Tests:
  [`SupabaseAuthRepository.test.ts`](src/features/auth/__tests__/SupabaseAuthRepository.test.ts),
  [`SignInWithOAuthUseCase.test.ts`](src/features/auth/__tests__/SignInWithOAuthUseCase.test.ts).
  Full suite (111 suites / 843 tests, +10 new), `tsc --noEmit`, `eslint` all pass clean.

**Still needed before this can be marked `done` (external prerequisites, not code):**

1. Register an OAuth app with Apple (Apple Developer Program) and Google (Google Cloud
   Console); configure both providers' client ID/secret in the Supabase project's Auth
   dashboard.
2. Add a URL scheme (and iOS Associated Domains, if using universal links) to `app.json` so
   the OAuth redirect can return into the app.
3. Add `expo-web-browser` (to actually open the URL `signInWithOAuth()` now returns and
   capture the redirect) and, for a native Apple button/credential flow instead of a plain
   web redirect, `expo-apple-authentication`.
4. Build the presentation-layer login screen/button that calls
   `container.signInWithOAuthUseCase`, opens the returned URL, and handles the redirect back
   (session is then available via `getCurrentSession()`).
5. Secure token storage beyond Supabase's own default (`AsyncStorage`-backed) session
   persistence, if a stricter requirement exists (e.g. `expo-secure-store`).

---

## Tier 4 Planning Targets — Require Later Task Decomposition

The following module remains planned but not yet scoped into concrete implementation tasks.

| Module      | Status | Notes                                 |
| ----------- | ------ | ------------------------------------- |
| Health Sync | `todo` | Apple Health / Google Fit integration |

---

# TIER 5 — MONETIZATION

Focus: deferred monetization and paid AI gating after retention-critical product value is proven.

> See [`plans/TIER5_MONETIZATION_TASK_BREAKDOWN_PLAN.md`](../plans/TIER5_MONETIZATION_TASK_BREAKDOWN_PLAN.md)
> for the sub-task breakdown of P2-009/P2-010/RESOLVER-V2-007 — most of Tier 5 depends on
> external accounts/credentials (RevenueCat, App Store/Play Store subscriptions, an AI
> provider) that only the repo owner can provide; the plan marks which pieces can be
> scaffolded without them.

## EPIC: Auth & Subscription (Later)

### P2-009 RevenueCat Entitlements

Status: `todo`

Integrate RevenueCat to manage subscription states.
`isPro` state synced from RevenueCat to Supabase `public.users` via Webhooks.

**Sub-tasks (see plan linked above):** P2-009-A (entitlement schema — no external blocker),
P2-009-B (webhook receiver — needs a RevenueCat account to finish/test), P2-009-C (client SDK —
needs a RevenueCat API key + App Store/Play Store subscription products + npm dependency
approval).

**P2-009-A implementation notes:** Added
[`supabase/migrations/20260712_add_user_entitlements_table.sql`](supabase/migrations/20260712_add_user_entitlements_table.sql)
— `public.user_entitlements` (`user_id` PK/FK to `auth.users`, `is_pro`, `product_id`,
`expires_at`, `revenuecat_app_user_id`, timestamps), same shape as `food_catalog_items`'s RLS:
users may `SELECT` their own row only, no client write policy — the P2-009-B webhook (once
built) writes via the service role key, bypassing RLS. A partial index on `is_pro = true`
keeps future "list Pro users" queries cheap without indexing the whole table.

**Migration applied to remote (2026-07-10, via Supabase MCP):** `public.user_entitlements`
now exists live in `HealthDatabase` (`kbplfcqluqqowmvchvhc`), RLS-enabled with the read-only
own-row `SELECT` policy above. `get_advisors` (security) reports the same
GraphQL-discoverability WARN already accepted for the other RLS-protected tables in this
project (`food_catalog_items`, `food_resolver_runs`, etc.) — no new class of exposure, rows
stay protected by RLS. P2-009-A is complete; P2-009 overall stays `todo` pending P2-009-B/C.

---

### P2-010 Paid-only Gating for AI Endpoints

Status: `todo`

Map `isPro` tier to Edge Function authorization.
AI structured log functions and premium insights return 403 for non-Pro users.

**Sub-tasks (see plan linked above):** P2-010-A (audit — found no AI/premium edge function
exists yet to gate; documentation-only fix), P2-010-B (authorization helper — scaffoldable once
P2-009-A's schema exists, but has no real endpoint to apply to until RESOLVER-V2-007 or a future
premium feature exists).

**P2-010-A (audit, done 2026-07-12):** Re-verified `supabase/functions/` — still only
`food-off-search` and `food-usda-search` exist, both intentionally free/anonymous per P2-007's
guardrails (they are not "AI structured log functions" or "premium insights" in the DoD's
sense). No `isPro`/authorization check exists anywhere in `supabase/functions/` today. P2-010
has no concrete gating target until RESOLVER-V2-007 (or a future premium-insights feature)
produces one — see P2-010-B, which stays a scaffold-only helper until then.

---

## Resolver V2 – Multi-Source Fusion Architecture

#### RESOLVER-V2-007: AI-Assisted Re-Ranking (Optional)

Status: `todo`

**Description:**
AI only for low-confidence cases. Must be traceable and rate-limited.

**DoD:**

- AI triggered only below confidence threshold
- Usage logged and rate-limited
- Never authoritative, always assistive

**Verify:** AI usage logs exist, rate limiting works, confidence thresholds respected

**Sub-tasks (see plan linked above):** RESOLVER-V2-007-A (port + rate-limit wrapper scaffold —
no external blocker, mirrors the existing `AiFoodMapper` port pattern), RESOLVER-V2-007-B (real
provider wiring — needs a provider decision + API key), RESOLVER-V2-007-C (usage logs + real
rate limiting — depends on -A/-B).

**RESOLVER-V2-007-A implementation notes:** Added
[`AiRerankingProvider`](src/features/nutrition/application/ports/AiRerankingProvider.ts) (port +
`NoopAiRerankingProvider` default, mirroring `FakeAiFoodMapper`'s existing pattern) and
[`RateLimitedAiReranker`](src/features/nutrition/application/services/RateLimitedAiReranker.ts),
which wraps any `AiRerankingProvider` and enforces all three DoD lines itself, independent of
which real provider RESOLVER-V2-007-B eventually wires in:

- **Confidence gate:** only calls the wrapped provider when the best candidate's score is
  below `confidenceThreshold` (default `0.6`); otherwise returns the original order untouched.
- **Rate limit:** a sliding window (`maxCallsPerWindow` per `windowMs`, default 20/min)
  tracked in-memory; once exceeded, falls back to the original order instead of calling out.
- **Never authoritative:** on a rate limit, a thrown/rejected provider call, _or_ the provider
  returning a reordered id list that isn't a valid permutation of the input candidates (a
  defensive check against a misbehaving AI response), it always falls back to the original
  candidate order — it can only ever reorder existing, already-scored candidates, never
  invent one or touch macro data.
- **Usage logging seam:** takes an `AiRerankingUsageLogger` (default `NoopAiRerankingUsageLogger`)
  and calls it for every triggered/skipped/rate-limited decision — RESOLVER-V2-007-C persists
  this for real; -A only defines the interface and calls it.

**Not yet wired into `SequentialFoodCatalogResolver`** — there's no real provider to call yet
(RESOLVER-V2-007-B), so wiring this into the live resolution hot path now would add an unused
code path without benefit. Tests:
[`RateLimitedAiReranker.test.ts`](src/features/nutrition/__tests__/RateLimitedAiReranker.test.ts)
(threshold gating, rate limiting, error/invalid-permutation fallback, usage logging). Full suite
(112 suites / 850 tests, +7 new), `tsc --noEmit`, `eslint` all pass clean.

**RESOLVER-V2-007-B provider selection (still `todo`, benchmark tooling added):** Provider
pricing changes too often to hard-code into this roadmap. Added
[`scripts/benchmark-ai-reranking-providers.mjs`](../scripts/benchmark-ai-reranking-providers.mjs)
(+ `scripts/lib/ai-reranking-benchmark-{scoring,fixtures,providers}.mjs`) — a real-API-call
benchmark harness that scores whichever of Claude Haiku 4.5 / GPT-5 Nano / GPT-5 Mini / Gemini
Flash Lite have a configured API key (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY`)
against a fixed set of realistic DACH ambiguity cases
(`scripts/lib/ai-reranking-benchmark-fixtures.mjs`: quark/schmand/curd, branded-vs-generic
matches, etc.) for JSON/schema reliability, ranking accuracy, and latency; cost is computed
from actual token usage. Provider adapters use raw `fetch()` (no new npm dependency) against
each provider's plain REST API — model IDs are env-var-overridable since they drift. Pure
scoring logic is unit-tested with `node:test`
([`scripts/__tests__/ai-reranking-benchmark-scoring.test.mjs`](../scripts/__tests__/ai-reranking-benchmark-scoring.test.mjs),
14 tests, run via `node --test scripts/__tests__/ai-reranking-benchmark-scoring.test.mjs`); the
end-to-end harness itself needs real API keys to run and isn't part of the Jest suite. See
[`plans/TIER5_MONETIZATION_TASK_BREAKDOWN_PLAN.md`](../plans/TIER5_MONETIZATION_TASK_BREAKDOWN_PLAN.md)
for the evaluation criteria and
[`reports/AI_RERANKING_PROVIDER_PRICING_2026-07-13_REPORT.md`](../reports/AI_RERANKING_PROVIDER_PRICING_2026-07-13_REPORT.md)
for the (explicitly dated, non-authoritative) pricing research that motivated a benchmark
instead of a hard-coded choice. RESOLVER-V2-007-B itself stays `todo` until the harness is
actually run against real keys and a provider is picked.

---

# COMPLETED / GOVERNANCE / LEGACY PHASE GROUPS

# PHASE 2 6 GUARDRAILS, AUTH & SUBSCRIPTION

## EPIC: Edge Guardrails (Food Search)

### P2-004 Query-length Guard and Sanitization

Status: `done`

Hard limit on food search query lengths. Sanitize input at Deno Edge function level.
Queries > 64 chars or containing special exploits blocked with 400.

---

### P2-005 Rate Limiting

Status: `done`

Basic rate limiting (IP/device based for anonymous).
Unauthenticated users cannot exceed 30 requests per minute to `food-search`.

---

### P2-006 Abuse Logging & Observability

Status: `done`

Structured logging for blocked requests (rate limit / guardrails) with `traceId` and user context.
Visible in Supabase Log Explorer as `ABUSE_DETECTED`.

---

### P2-011 Project-Scoped Codex Governance

Status: `done`

Add repo-local Codex guidance and role contracts aligned with `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, and `SSOK.md`.
Keep the setup minimal, deterministic-first, and scoped to this repository.

**DoD:** Repo-local Codex config exists under `.codex/`. Analysis, implementation, and review roles are defined. Setup does not modify user-global Codex config. Verification passes and task status is updated.

---

### Resolver Rules (Global)

- **NEVER translate input before source querying**
- **ALWAYS allow multi-source candidate comparison**
- **BLS, OFF, USDA are candidate providers, not truth sources**
- **Supabase is long-term source of truth**
- **AI is assistive only, never authoritative**

### Verify Checklist

Before marking Resolver V2 as done:

- [ ] Same input sent to multiple sources without early translation
- [ ] No early translation exists in resolver pipeline
- [ ] Multiple candidates logged from different sources
- [ ] Final decision is traceable through logs
- [ ] Supabase stores resolution decisions
- [ ] Confidence system still works
- [ ] Existing tests pass
- [ ] Performance within acceptable bounds

---

## Decisions Log

- **Anon vs. Auth for Food Search:** Food search functions are anon for MVP (`verify_jwt=false`) with strict guardrails.
- **AI Endpoints gating:** AI endpoints will never be anon. Strictly JWT + subscription/entitlement required.
- **Deterministic-first:** No LLM calls in core logging pipeline. AI only for complex multi-item parsing when deterministic logic is insufficient.
- **Resolver V2 Architecture:** Multi-source fusion replaces sequential early-return to eliminate translation bias and improve match quality.
- **BLS Live-Status (Stand 2026-07-09):** BLS ist inzwischen aktiv im Resolver verdrahtet (`BlsStaticSource` in `src/infrastructure/di/container.ts`, `resolverSources = [userAliasSource, blsSource, offSource, usdaSource]`) und wird in `SequentialFoodCatalogResolver` mit Priorität vor OFF/USDA berücksichtigt (siehe `BlsResolverIntegration.test.ts`). Der ältere Stand "nur OFF + USDA live" (P0-007 Proof-Points) ist damit überholt.
