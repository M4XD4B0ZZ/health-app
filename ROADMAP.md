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

### P1-006: Scrambled-Egg („Rührei") Phrasing & Egg-Count Support

Status: `todo`
Severity: Medium
Depends on: existing composite-dish / „mit"-splitting handling (P1-003B/C, P1-005).
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 5.

**Ziel:** Common scrambled-egg phrasings resolve to the right number of eggs. All of
`Rührei aus 2 Eiern`, `Rührei aus zwei Eiern`, `Rührei von zwei Eiern`, `2 Rühreier` must be
understood as two eggs with correct piece/gram quantities, without inventing butter/oil/milk.

**Current evidence (code-verified — the gap is phrasing, not a missing food):**

- A Rührei alias already exists:
  `src/features/nutrition/infrastructure/catalog/sources/bls/BlsCompactRuntimeAdapter.ts:14`
  maps `Y720143: ['ruehrei', 'rührei', 'ruehei']`, and `detectInputType.ts` lists
  `'ruehrei'`/`'rührei'`.
- The four phrasings still fail natively, so the „aus/von N Eiern" and „N Rühreier" **count
  extraction / phrasing normalization** is what breaks — not the catalog entry.

**Exact scope / affected files (confirm the precise entry point at implementation time):**

- Input parsing/normalization: `src/features/nutrition/application/utils/detectInputType.ts`,
  `splitMultiItemInput.ts`, and the number-word / quantity extraction used for eggs (locate
  the exact function that maps „aus 2 Eiern" / „zwei" / „2 Rühreier" → count = 2).
- Composite-dish label handling
  (`src/features/nutrition/domain/catalog/CompositeDishPatterns.ts` and the P1-003C label
  path) — keep the preparation form („Rührei") as a user-friendly title where architecture
  permits.
- `Rührei aus 2 Eiern mit 10 g Butter` must still split into eggs + butter via the existing
  „mit" handling.

**Risks:** regressing existing „mit" splitting / composite-dish rules; inventing fats
(butter/oil/milk) not mentioned; double-counting eggs (both the „Rührei" head and „Eiern").

**Tests:** parser + resolution + end-to-end (real container path) for all four phrasings →
two eggs, correct piece/gram quantity, no invented fats; `Rührei aus 2 Eiern mit 10 g Butter`
→ eggs + butter separately; no regression to `Toast mit Butter` or existing composite-dish
tests.

**Akzeptanzkriterien (DoD):** all four phrasings processed; two eggs stay two eggs with
correct piece + gram amounts; no invented butter/oil/milk; preparation form preserved as a
friendly title where architecture permits; „… mit 10 g Butter" accounts for both; no „mit"/
composite regression; `npm run verify` green.

**Out of scope:** resolver trust/ranking changes (RESOLVER-V2-008), new alias data beyond the
egg-count phrasing, evaluation/journal changes.

**Verify:** `npm run verify` (Category 4); UI-relevant only if presentation touched → gap-log
entry unless live-verified.

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

Status: `in_progress` (J-001–J-011 done; J-012 `todo` — see each task's own section)

J-008–J-011 are the presentation-layer follow-ups accepted from the 2026-07-16 native
dogfooding session, see
[`plans/JOURNAL_TRANSIENT_CONFIRMATION_AND_GROUPING_PLAN.md`](plans/JOURNAL_TRANSIENT_CONFIRMATION_AND_GROUPING_PLAN.md).
J-011 was a product-review correction of one of J-010's priority decisions (merged before
J-009 started, so J-009's grouped overview inherits the corrected quantity-display semantics
from the start). J-012 is a small, deferred UX refinement identified during post-merge native
dogfooding review of J-009 (group title should prefer a user-friendly name over the raw
catalog string; a visible expand/collapse chevron) — J-009's grouping logic itself was
reviewed and accepted as correct, this is presentation polish only, to be prioritized
alongside further dogfooding findings.

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

---

#### J-007: Truthful Feedback for Mixed-Success Submits

Status: `done`
Depends on: none

**Ziel:** [`reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md`](../reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md)
(Befund 4.3) found that submitting e.g. "1 Banane und zorbfrucht" persists the Banane entry
(visible in "Erkannte Einträge"/"Heutige Einträge") while the status line simultaneously shows
the hard-error framing "Eintrag konnte nicht verarbeitet werden" — contradicting what the rest
of the screen already shows as saved. Root cause: `JournalScreen.submitRawInput` checked
`blockedCount > 0` before checking `persistedCount > 0`, so any blocked item (e.g. a
canonically-unmatched food like "zorbfrucht", not just a genuinely empty submission) forced the
hard-error branch regardless of what had actually persisted — and, as a side effect, skipped the
`loadJournalData()` call at the end of the function, so "Heutige Einträge" would not even reflect
the new entry until a later, unrelated reload.

**Scope / betroffene Dateien:**

- New [`src/presentation/features/journal/journalSubmitFeedback.ts`](../src/presentation/features/journal/journalSubmitFeedback.ts):
  pure `deriveSubmitOutcome()` (status message, trust message, processing state), extracted out
  of `JournalScreen.submitRawInput` so the truthfulness rules are unit-testable without a
  rendering harness (mirrors the existing `journalEntryDisplay.ts`/`goalsDisplay.ts` pattern in
  this codebase). Absorbs the previously-inline, untested `buildTrustMessage`.
- `src/presentation/features/journal/JournalScreen.tsx`: `submitRawInput` now calls
  `deriveSubmitOutcome()` once instead of the previous four-way if/else chain; `loadJournalData()`
  now runs whenever the outcome is `'done'` (i.e. `persistedCount > 0`), not only in the subset
  of success branches the old code happened to reach before returning early.
- New [`src/presentation/features/journal/__tests__/journalSubmitFeedback.test.ts`](../src/presentation/features/journal/__tests__/journalSubmitFeedback.test.ts).

**Governing rule (unchanged intent, now enforced in one place):** if anything was actually
persisted, the outcome is always reported as a (possibly partial) success — never as a hard
error. The pre-existing "nothing persisted" error framings (`Portionsgewicht fehlt` /
`Eintrag konnte nicht verarbeitet werden` / `Nicht erkannt — bitte genauer eingeben`) are
unchanged for the `persistedCount === 0` case.

**Akzeptanzkriterien (DoD):**

- Reproducing the report's exact case ("1 Banane und zorbfrucht") no longer shows the hard-error
  framing once the Banane is persisted — covered by a dedicated regression test.
- `persistedCount === 0` branches (blocked without portion prompt, blocked with portion prompt,
  fully unresolved) keep their existing messages/`error` state.
- `npm run verify` passes clean.

**Verify:** `npm run verify` (typecheck, lint, format, full suite).

**Implementation notes:** See file list above; no test needed updating in existing suites — the
new pure function is a straight extraction with a corrected condition order, not a behavior
change to any other already-covered path. One small incidental fix while extracting: the
multi-entry status message used `` `Eintrag${count > 1 ? 'e' : ''}` ``, which produces the
ungrammatical "2 Eintrage" instead of "2 Einträge" (appending "e" doesn't add the required
umlaut) — corrected to a direct singular/plural noun choice in the same statement. This task's
own new test file (7 tests) is the primary verification; it directly encodes the report's
befund 4.3 scenario as a named regression case.
Full suite green after this change (see this branch's `npm run verify` run).

---

#### J-008: Transient Last-Submit Confirmation (replaces „Erkannte Einträge")

Status: `done`
Depends on: none

**Ziel:** Accepted product decision 3/4 from the 2026-07-16 native dogfooding session. Today
[`JournalScreen.tsx`](../src/presentation/features/journal/JournalScreen.tsx) shows „Erkannte
Einträge" as a **permanent** list built from the last submit's `recognizedItems` — it lingers
and shows only the most recent submit (e.g. 246,6 kcal), which reads like a day-total next to
„Heutige Einträge". Replace it with a **transient last-submit confirmation** that states
explicitly it is only the latest submission and lets the just-saved entries be corrected.

**Scope / betroffene Dateien:**

- New `src/presentation/features/journal/journalLastSubmitConfirmation.ts` — pure
  `buildLastSubmitConfirmation()` deriving the message („3 Eier gespeichert · 246,6 kcal" /
  „2 Einträge gespeichert: Eier und Magerquark · 296 kcal") + the just-saved entry ids.
- New `src/presentation/features/journal/__tests__/journalLastSubmitConfirmation.test.ts`.
- `JournalScreen.tsx` — remove the „Erkannte Einträge" section + `recognizedItems`
  state/population; add the transient panel, its ~8 s timer/visibility controller (state
  machine in the plan), and correction access (open the saved entry/entries for edit).
  Optional small `useLastSubmitConfirmation.ts` hook if the timer logic is cleaner extracted.

**Risiken:** timer leaks/races across overlapping submits and on tab-blur/unmount (mitigate:
single named timer, cleared on replace/hidden/blur/unmount); removing `recognizedItems` must
not break another reader (it is that section's only consumer — verify before deleting).

**Tests:** pure message derivation (single/multiple/none, German comma kcal); fake-timer
state machine (auto-dismiss ~8 s, replace-resets-timer, interaction-holds, blur/unmount
clears); integration render check if an RN test harness is available, else manual-native.

**Akzeptanzkriterien (DoD):** see
[`plans/JOURNAL_TRANSIENT_CONFIRMATION_AND_GROUPING_PLAN.md`](../plans/JOURNAL_TRANSIENT_CONFIRMATION_AND_GROUPING_PLAN.md)
§10 (J-008). In short: permanent „Erkannte Einträge" gone; transient panel reflects only the
latest submit and says so; ~8 s auto-dismiss; replaced by next submit; disappears on tab
change; does not auto-dismiss while interacted with; opens saved entries for correction;
`persistedCount === 0` shows no confirmation (J-007 error framing unchanged).

**Verify:** `npm run verify`; UI-relevant in a headless env → new `docs/MANUAL_TESTING_GAPS.md`
entry (VERIFY.md Category 4).

**Implementation notes:** Exactly the planned 3-file boundary
(`journalLastSubmitConfirmation.ts` + its test + `JournalScreen.tsx`), plus a smaller-boundary
adjustment discovered during implementation: `formatNumber`/`parseDisplayQuantity` in
`journalEntryDisplay.ts` were exported (no logic change) instead of re-implementing the same
German-comma rounding and NUMBER_WORDS-based raw-text count parsing a second time — avoids a
duplicate `NUMBER_WORDS` dictionary for the exact same "did the raw input carry a count word"
question `buildFoodEntryDisplay` already answers.
`buildLastSubmitConfirmation(persistedEntries)` treats "single food" as `persistedCount === 1`
and "multiple" as `persistedCount >= 2` (not a cross-entry canonical-identity merge — that's
J-009's job and explicitly out of scope here); the single-entry message reuses
`parseDisplayQuantity` to prefix a count only when the raw input actually carried one (`"Drei
Eier"` → `"3 Eier gespeichert · 246,6 kcal"`; bare `"Ei"` → `"Ei gespeichert · 82,2 kcal"`, no
invented count; `"Ein Ei"` → `"1 Ei gespeichert · 82,2 kcal"`, shown as typed). The timer/hold
state machine (`createLastSubmitConfirmationController`) is a framework-agnostic factory
function with zero React dependency — driven from `JournalScreen` via a `useRef`-held
singleton instance — specifically so it's unit-testable with Jest fake timers without a
rendering harness (this repo's Jest config has no React Native Testing Library / jsdom;
`testEnvironment: 'node'`, confirmed during implementation). `hold()`/`release()` use a
counter (not a boolean) so an interaction-hold (`onTouchStart`/`onTouchEnd` on the panel) and
a correction-modal hold (`handleOpenEditFromConfirmation`/`handleCloseEdit`, gated by a
`confirmationEditHeldRef` so only a hold the confirmation path actually placed gets released)
can overlap safely; `release()` without a matching `hold()` is a no-op by construction, so it
can never accidentally restart/extend the timer for an unrelated edit opened from the daily
list. Partial-success submits are untouched: `buildLastSubmitConfirmation` only ever receives
`result.persistedEntries`, so a mixed "1 Banane und zorbfrucht" submit still shows the panel
for the persisted Banane while J-007's status/trust message and the unchanged "Nicht erkannte
Einträge"/"Portionsgewicht fehlt" sections keep explaining the blocked item — never suppressed,
never implied as saved.
New tests (16, `journalLastSubmitConfirmation.test.ts`): message derivation for 0/1/2/3+
persisted entries (incl. the exact dogfooding case and the no-invented-count/grams-only cases)
and the timer controller with Jest fake timers (auto-dismiss ~8 s, replace-resets-timer with
no stale-timer dismissal of the newer confirmation, hold/release incl. nested holds,
release-without-hold is a no-op, immediate `hide()`, `hide()`-when-already-hidden is a no-op,
`dispose()` leaves no dangling timer). Full suite (116 suites / 884 tests, +16 new), `tsc
--noEmit`, `eslint`, and `prettier -c` all pass clean; `npm run verify` green.
**Real (non-simulated) verification beyond the unit tests:** ran the app for real via
`expo start --web` + headless Playwright/Chromium against a real (but journal-entries-are-
local-only, per `PersistedFoodEntryRepository`'s `AsyncStorage` backing — confirmed by code
inspection before connecting) Supabase project, and replayed the exact dogfooding sequence
("Ei" → "Ein Ei" → "Drei Eier"): the panel showed, in order, `"Ei gespeichert · 82,2 kcal"`,
`"1 Ei gespeichert · 82,2 kcal"`, `"3 Eier gespeichert · 246,6 kcal"` — never the misleading
day-total framing from the original report — while "Heutige Einträge" correctly kept all three
entries separately (82.2 + 82.2 + 246.6 = 411 kcal, matching the report exactly), each with its
own "Löschen". "Erkannte Einträge" never appeared. Auto-dismiss confirmed (panel gone by a 15 s
checkpoint, well past the ~8 s window) with the rest of the screen unaffected. Zero console/page
errors across all runs. The tap-a-panel-row-to-correct interaction could not be reliably
captured live — this sandbox's real OFF/USDA resolver network calls were intermittently
slow/hanging (unrelated to this change; confirmed via console trace showing BLS already
matched while the app kept awaiting OFF/USDA), repeatedly outlasting the panel's own 8 s
window before a click could land. Logged as an open entry in
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md#2026-07-17--j-008-transiente-last-submit-bestätigung-ersetzt-erkannte-einträge)
per the binding Manual UI Testing Gap Log rule — the handler reuses the exact same `EntryRow`/
`onPress` mechanism already verified working elsewhere on the same screen, but was not itself
clicked and confirmed live.

---

#### J-009: Canonical-Identity Grouped Daily Overview + Detail Access

Status: `done`
Depends on: J-010/J-011 (grouped rows inherit the corrected quantity-display semantics)

**Ziel:** Accepted product decisions 5–10/12. „Heutige Einträge" must group identical foods
visually by **canonical food identity** (not raw text/display name), so „Ei"/„Ein Ei"/
„Drei Eier" show as one „Eier" group. Grouping is **presentation-only** — every underlying
journal entry, its timestamp/order, correction-log behavior, and J-005 auto-merge semantics
stay unchanged; nothing is merged in persistence.

**Scope / betroffene Dateien:**

- `src/presentation/features/journal/journalEntryDisplay.ts` — extend the existing pure
  `groupJournalEntries` with a second, canonical-identity pass over the non-`groupId` leaves;
  key = `` `${foodCatalogRef.source}:${foodCatalogRef.sourceId}` ``; label = `displayName`;
  group total = Σ children; aggregate count+grams for the header (count only if every child
  has a known count). Composite-dish `groupId` grouping is untouched.
- `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts` — grouping cases.
- `JournalScreen.tsx` — collapsed-by-default group header with tap-to-expand (local expand
  state), reusing the **existing** per-child `handleOpenEdit`/`handleDeleteEntry`. No
  group-level edit/delete action.

**Risiken:** false grouping of different foods by name (mitigate: `foodCatalogRef` identity
key only, no name fallback; entries without a catalog match stay leaves); confusion with
persistence-level auto-merge (mitigate: pure transform, purity test asserting no mutation/no
persistence call); edit/delete ambiguity (mitigate: only children carry edit/delete); totals
divergence (mitigate: group total = Σ children; daily total from `GetDailySummaryUseCase` is
independent and unchanged).

**Tests:** same-identity singular/plural group together; different `sourceId` not grouped;
no-`foodCatalogRef` stays leaf; single-identity stays leaf; group total === Σ children ===
411 for the egg case; composite-dish groups unaffected; purity (no mutation/no persist).
Detail-interaction render check if a harness is available, else manual-native.

**Akzeptanzkriterien (DoD):** plan §10 (J-009). In short: same-canonical-food entries render
as one labeled group with an aggregated header and are tap-expandable to their individual
entries; each entry independently editable/deletable; different foods not grouped; grouped
total === Σ children; daily total === ungrouped sum; no persistence mutation; J-005 unchanged.

**Verify:** `npm run verify`; UI-relevant in a headless env → new `docs/MANUAL_TESTING_GAPS.md`
entry (VERIFY.md Category 4).

**Implementation notes:** Matches the planned file boundary exactly
(`journalEntryDisplay.ts` + its tests + `JournalScreen.tsx`), with one addition the plan
flagged as conditional and code inspection confirmed necessary: a new exported
`buildGroupQuantitySubtitle()` (the group-header analogue of `buildFoodEntryDisplay`'s
per-entry subtitle, sharing the same underlying `resolveEntryQuantity` classification so both
apply identical J-010/J-011 rules — count only when semantically present, an explicit-grams
child always forces the whole group to grams-only).
`groupJournalEntries` now runs the existing composite-dish (`groupId`) pass unchanged, then a
second `applyCanonicalGrouping` pass over the leaves it produced: groups by
`` `${foodCatalogRef.source}:${foodCatalogRef.sourceId}` `` (decision 6 — identity only, no
name fallback), only when ≥2 entries share it, positioned at the **newest** member's original
index (not the first — an explicit deviation from the plan's own default, per this Act task's
instruction, so a newly logged item is visible where it was just added rather than seeming to
vanish into an older slot), with `children` preserved in original chronological order.
`JournalEntryGroup` gained a `groupKind: 'composite' | 'canonical'` discriminator so the screen
can render the two differently: composite groups stay exactly as before (always expanded, no
toggle); canonical groups are collapsed-by-default with a `TouchableOpacity` header
(`accessibilityRole="button"`, `accessibilityState={{expanded}}`, a descriptive
`accessibilityLabel` including the German state word) that toggles a `Set<groupId>` expand
state — carrying no edit/delete action itself; every child, expanded or not, reuses the
pre-existing `handleOpenEdit`/`handleDeleteEntry`. The J-008 transient confirmation panel was
not touched at all, per instruction. Grouping is a pure re-derivation on every render from
`entries`, so edit/delete/reload already "recomputing the presentation" (requirement 15) needed
no special-case code — a delete down to one match dissolves the group back to a leaf, and an
edit that changes canonical identity regroups on the next pass, for free.
**Real bug found and fixed during live verification, not present in the plan/task description:**
summing children's `calories`/macros with plain `+=` (matching the composite-dish path's own
long-standing pattern) surfaced raw JS binary-floating-point summation noise once real values
were combined in the browser (`82.2 + 164.4` → `246.60000000000002`, passed unrounded straight
into `EntryRow`'s `kcal` prop, which renders numbers as-is). `sumEntries()` now rounds each
total to one decimal — mathematically identical to the exact sum for these already-≤1-decimal
macro values (requirement 12's "exact child totals" is about not re-deriving or drifting the
total, not about preserving binary-float noise), just without the display artifact. New
regression test asserts the exact `246.6` output for this pair. This is a **narrower** display
path than the pre-existing composite-dish `+=` pattern (untouched, out of scope, and less
likely to surface the issue since composite dishes are rarely summed from repeat instances of
the same decimal calorie value the way canonical groups routinely are) — not a fix applied
retroactively to composite groups.
New tests (14 total: 13 grouping/aggregation cases + this float-precision regression),
`journalEntryDisplay.test.ts`: same-identity singular/plural grouping (incl. the exact
82.2+82.2+246.6=411 dogfooding case), same-label-different-identity not grouped, missing
identity stays leaf, single match stays leaf, group positioned at the newest member (with
intervening unrelated entries proving it is not simply "last overall"), children stay
chronologically ordered, exact calorie/macro aggregation, composite groups unaffected,
dissolve-to-leaf on delete-down-to-one, identity-changing edit regroups, homogeneous known
counts aggregate, mixed count+explicit-grams forces grams-only, incompatible units force
grams-only, and the float-precision fix. Full suite (116 suites / 910 tests, +14 new), `tsc
--noEmit`, `eslint`, and `prettier -c` all pass clean; `npm run verify` green.
**Real (non-simulated) verification — very thorough, per the Act task's explicit request:** ran
`expo start --web` + headless Playwright/Chromium and replayed every named scenario. "Ei" →
"Ein Ei" → "Drei Eier" produced exactly one collapsed group — labeled with the real catalog
`displayName` ("Huehnerei ganz roh", not the plan's illustrative "Eier" placeholder, which is
correct per the design: prefer the actual catalog label) — showing "5 STÜCK (300 G) · 411 kcal".
Tapping the header expanded it to all three original entries in order, each independently
"Löschen"-able; tapping again re-collapsed it. Deleting one child (2 remain) kept the group and
recalculated correctly to "4 STÜCK (240 G) · 328,8 kcal"; deleting a second (1 remains)
correctly dissolved it back into a normal leaf row. "1 Ei" + "120g Ei", submitted **outside**
J-005's 2-minute auto-merge window (a genuine 130s wait, to deliberately avoid the unrelated,
unchanged auto-merge path and exercise pure grouping/aggregation instead), grouped by identity
but showed "180 G" — no invented count — exactly the named example. Submitted **inside** the
auto-merge window in a separate run, J-005's existing "Mit vorherigem Eintrag zusammengeführt"
banner still fired unchanged, confirming J-009 does not interfere with it. `role="button"` and a
state-describing `aria-label` were confirmed present in the rendered DOM; a separate
`aria-expanded` attribute is not emitted by this react-native-web version for a plain
`TouchableOpacity` + `accessibilityState` (a library-level limitation of the web target, not a
code defect — `accessibilityState={{expanded}}` maps to native accessibility APIs on iOS/Android
per RN's own documented behavior). Zero console/page errors across every run. Logged as an open
entry in
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md#2026-07-17--j-009-kanonisch-gruppierte-tagesübersicht-mit-einzel-detailzugriff)
— native touch-target sizing and an actual native screen-reader (VoiceOver/TalkBack) expand/
collapse announcement remain to be confirmed on a real device; the identity-changing-edit
scenario is unit-test-covered but wasn't separately replayed live (a natural-language edit
instruction reliably changing catalog identity isn't easy to trigger deterministically through
a short text command).

---

#### J-010: Consistent Quantity Display (Known Count Portions)

Status: `done`
Depends on: none (split from J-009 because its data source is portion knowledge, not the
`foodCatalogRef` grouping key, and it also applies to ungrouped leaf rows)

**Ziel:** Accepted product decision 11. The same egg is shown inconsistently as „60 G",
„1 STÜCK (60 G)", „3 STÜCK (180 G)" because
[`journalEntryDisplay.ts`](../src/presentation/features/journal/journalEntryDisplay.ts)'s
`parseDisplayQuantity` derives count/unit purely from `rawInput` text. When a **known count
portion** exists for the food, prefer „1 Stück (60 g)" even if the raw text lacked a count
word; keep the grams calculation basis visible; never invent a count when only grams are known.

**Scope / betroffene Dateien:**

- `journalEntryDisplay.ts` — make `buildFoodEntryDisplay`/`buildSubtitle` count-portion-aware,
  reading known-count-portion info via the existing portion-knowledge query
  (`PortionKnowledgeService`/`resolvePortionGrams`, read-only); derive N from
  `grams / gramsPerUnit` when a clean integer; otherwise keep current text-parsed / grams-only
  behavior. Keep the display helper **pure** — thread a small
  `knownCountPortion?: { unit; gramsPerUnit }` in from the screen rather than making it async.
- `__tests__/journalEntryDisplay.test.ts` — known-count-portion cases + the negative
  „grams-only, no invented count" case.
- `JournalScreen.tsx` — only if the known-count-portion data must be threaded in (read-only
  use of the existing `container.portionKnowledgeService`); no domain/infra change.

**Risiken:** inventing a count when only grams are known (mitigate: count shown only when a
known count portion exists and grams/gramsPerUnit is a clean integer; explicit negative test);
must not change any stored macro (mitigate: display-only, reads existing grams).

**Tests:** „Ei" (60 g, known 60 g/Stück) → „1 Stück (60 g)"; „Eier" (300 g) → „5 Stück
(300 g)"; grams-only when no known count → „X g"; grams basis always visible in count cases;
existing gram-only/text-count cases stay green.

**Akzeptanzkriterien (DoD):** plan §10 (J-010). In short: known-count foods show
„N Stück (X g)" consistently on leaf and grouped rows; grams basis stays visible; grams-only
foods show „X g" with no invented count.

**Verify:** `npm run verify`; if display output changed in a headless env → new
`docs/MANUAL_TESTING_GAPS.md` entry (VERIFY.md Category 4).

**Implementation notes:** Exactly the planned file boundary
(`journalEntryDisplay.ts`/`__tests__/journalEntryDisplay.test.ts`/`JournalScreen.tsx`, no
domain/infra change). `buildSubtitle`/`buildFoodEntryDisplay` gained an optional
`knownCountPortion?: { unit: PortionHintUnit; gramsPerUnit: number }` parameter (new exported
`KnownCountPortion` type) — kept the helper pure/sync per the plan, with the async
portion-knowledge lookup resolved ahead of time by the caller. A new `deriveKnownCount(grams,
gramsPerUnit)` helper only ever returns a count when `grams / gramsPerUnit` is a whole number
within floating-point tolerance (0.01); otherwise `buildSubtitle` falls through to the
pre-existing text-parsed/grams-only behavior unchanged — no fractional „Stück" is ever shown,
and nothing is invented when the ratio doesn't land cleanly.
**Priority decision (beyond the literal task text, resolved from decision 11's own wording):**
a known count portion wins **even over explicit-grams raw input** (e.g. `"300g Karotten"` with
a known 60 g/Stück carrot portion renders `"5 Stück (300 g)"`, not `"300 g"`) — decision 11
frames this as a general consistency rule for "known Stückportionen", not one scoped only to
inputs that lacked a count word; the alternative (only override bare/count-worded inputs) would
have left the exact `"60 G"` vs. `"1 STÜCK (60 G)"` inconsistency alive whenever a user later
weighed the same food explicitly. Grams basis stays visible in parentheses in every count case
either way, so no information is lost by re-framing.
`JournalScreen.tsx` — new `knownCountPortions: Record<foodIdentityKey, KnownCountPortion>`
state, resolved by a `useEffect` keyed on `entries` that runs `resolveFoodIdentityKey()` per
distinct today's food and queries the existing `container.portionKnowledgeService.lookup()`
(piece and slice, in parallel, read-only — the same service `savePortionHintAndRetry` already
uses) whenever the day's entries change; a `getKnownCountPortion(entry)` helper feeds the
result into all three existing `buildFoodEntryDisplay` call sites (the J-008 confirmation
panel, the flat "Heutige Einträge" row, and each group's child row) so leaf and (future J-009)
grouped rows share one formatting source of truth, per the plan's stated goal.
New tests (8, `journalEntryDisplay.test.ts`): bare "Ei" with no count word + a known portion →
"1 Stück (60 g)"; multi-count "5 Stück (300 g)"; known portion overriding explicit-grams
phrasing; slice-unit rendering; no invented fractional count on an unclean ratio (65 g / 60
g/Stück); a known portion of a different unit overriding a conflicting text-parsed unit;
unchanged behavior with no known portion; defensive zero/negative `gramsPerUnit`. Full suite
(116 suites / 892 tests, +8 new), `tsc --noEmit`, `eslint`, and `prettier -c` all pass clean;
`npm run verify` green.
**Real (non-simulated) verification:** ran `expo start --web` + headless Playwright/Chromium
(same journal-entries-are-`AsyncStorage`-local setup as J-008) and logged a bare `"Ei"` — it
now renders `"1 STÜCK (60 G)"` (previously `"60 g"`) identically in both the J-008 confirmation
panel and "Heutige Einträge". Then logged `"300g Karotten"` — it renders `"5 STÜCK (300 G)"`,
confirming the known-portion-overrides-explicit-grams priority decision above holds in the real
app, not just in unit tests. Daily total correct (82 + 96 = 178 kcal), zero console/page errors.
Logged as a `✅ geprüft` entry in
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md#2026-07-17--j-010-konsistente-mengenanzeige-für-bekannte-stückportionen)
per the binding gap-log rule (native layout and the slice-unit case in the live web runtime
remain unverified there, non-blocking — same formatting function as the live-verified piece
case).
**Post-merge correction (2026-07-17, product review):** the "known portion overrides
explicit-grams phrasing" priority decision documented above (`"300g Karotten"` →
`"5 Stück (300 g)"`) was reviewed and rejected as an incorrect reading of decision 11 —
deriving a count backwards from grams via division is inventing a count, not reading one,
because a known portion is a calculation aid (count → grams) and real per-item weights vary
(carrots, bananas, bread rolls, slices are not uniform). This entry is left as originally
written per this repo's "never silently rewrite a `done` task" convention; the corrected
behavior is implemented as a dedicated follow-up, **J-011**, immediately below.

---

#### J-011: Preserve Explicit Gram Intent in Quantity Display

Status: `done`
Depends on: J-010 (corrects one of its priority decisions)

**Ziel:** Product-review correction of J-010. J-010's `buildSubtitle` let a known count
portion override raw-text-parsed **explicit grams** whenever `grams / gramsPerUnit` divided
cleanly (e.g. `"300g Karotten"` → `"5 Stück (300 g)"`), reasoned as consistent with decision
11 ("prefer a known count portion"). Product review rejected this: a known count portion is a
**calculation aid** (derives grams from an already-known count), not license to **reverse**
that arithmetic and assert a count the user never stated and the app never observed — the
binding rule is "keinen Count erfinden, wenn ausschließlich Gramm bekannt sind" (never invent
a count when only grams are known), and it applies to explicit grams input regardless of
whether the division happens to land on a whole number. Real per-item weights vary too much
(carrots, bananas, bread rolls, ham slices) for a coincidental clean division to prove that a
specific count was actually eaten.

**Scope / betroffene Dateien:**

- `src/presentation/features/journal/journalEntryDisplay.ts` — `buildSubtitle`: when the raw
  input's own parsed unit is explicit grams (`parseDisplayQuantity(rawInput).unit === 'g'`),
  always render grams-only and **never** consult `knownCountPortion` in that branch, even if
  the ratio is a clean integer. The known-count-portion path remains for the case it was
  actually introduced for: raw input with **no** explicit grams (bare `"Ei"`, or a stored
  quantity whose grams were themselves computed _from_ a count via
  `resolvePortionGrams`'s `PORTION_KNOWLEDGE_HINT`/`KNOWN_DEFAULT_PORTION` branches) — there, a
  count genuinely was used to compute the persisted grams, so recovering it via division is
  reconstructing a real count, not inventing one.
- `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts` — invert the now-
  incorrect "known portion wins over explicit grams" test into the corrected "explicit grams
  wins" assertion; keep the still-correct bare-word/no-count and count-worded cases green.
- `JournalScreen.tsx`: no change (the display-helper fix alone corrects all three render
  sites — confirmation panel, daily list, group children — since they all funnel through
  `buildFoodEntryDisplay`/`buildSubtitle`).

**Risiken:** low — a narrower, more conservative condition than J-010's (fewer cases show a
derived count, not more), so no new invented-count risk is introduced; the existing "never
invent when the ratio isn't clean" guard (`deriveKnownCount`'s tolerance check) is unchanged
and still applies within the narrowed condition. No calculation/macro change — display-only.

**Tests:** `"Ei"` (no unit in raw text, known 60 g/Stück) → `"1 Stück (60 g)"` (unchanged);
`"Drei Eier"` (count-worded text) → `"3 Stück (180 g)"` (unchanged); `"300g Karotten"`
(explicit grams, known 60 g/Stück, clean division) → `"300 g"` (**corrected**, was
`"5 Stück (300 g)"`); `"120g Ei"` (explicit grams) → `"120 g"`; existing slice/no-known-
portion/unclean-ratio/defensive cases stay green.

**Akzeptanzkriterien (DoD):**

- Explicit gram input always renders as grams-only, regardless of any known count portion.
- A known count portion adds a count **only** when a count is semantically present (bare
  count-less input resolved via a known default/hint, or text that itself parsed a count) —
  never reverse-derived from a user-stated gram figure.
- `"Ei"` → `"1 Stück (60 g)"`; `"3 Eier"` → `"3 Stück (180 g)"`; `"300g Karotten"` →
  `"300 g"` (not `"5 Stück"`).
- The same rule applies identically in the transient confirmation panel, the daily list, and
  (future) group children — one shared formatting function, already the case since J-010.
- No change to existing calorie/quantity calculation — display-only.
- `npm run verify` green.
- Native/web cross-check of the three named examples.

**Verify:** `npm run verify`; UI-relevant in a headless env → new
`docs/MANUAL_TESTING_GAPS.md` entry unless genuinely live-verified (VERIFY.md Category 4).

**Implementation notes:** Exactly the planned single-file fix (`journalEntryDisplay.ts`), no
`JournalScreen.tsx` change needed. `buildSubtitle` now checks
`parseDisplayQuantity(rawInput).unit === 'g'` **first**: if true, returns the grams-only
string immediately and never reaches the `knownCountPortion` branch at all, regardless of
whether `grams / gramsPerUnit` is a clean integer. The known-count-portion branch moved below
that guard, unchanged otherwise (`deriveKnownCount`'s tolerance check is untouched) — it still
fires for count-less raw text (bare `"Ei"`) and count-worded text (`"Drei Eier"`, `"2
Scheiben Schinken"`), which is exactly the case J-010 was originally motivated by and where a
count is genuinely, not speculatively, present. The one existing J-010 test asserting the
rejected behavior (`"300g Karotten"` → `"5 Stück (300 g)"`) was removed; a new test block adds
5 cases covering both corrected explicit-grams examples from the product review (`"300g
Karotten"` → `"300 g"`, `"120g Ei"` → `"120 g"`) and reconfirming the two still-correct
count-present examples (`"Ei"` → `"1 Stück (60 g)"`, `"Drei Eier"` → `"3 Stück (180 g)"`)
continue to pass unchanged. Full suite (116 suites / 896 tests, net +4 vs. J-010's 892 — one
incorrect test removed, five added), `tsc --noEmit`, `eslint`, and `prettier -c` all pass
clean; `npm run verify` green.
**Real (non-simulated) verification of all three named examples:** ran `expo start --web` +
headless Playwright/Chromium and logged, in sequence, `"Ei"`, `"Drei Eier"`, `"300g
Karotten"` into the same day. Result, visible simultaneously in "Heutige Einträge"
(screenshot): `"Ei"` → `"1 STÜCK (60 G)"`, `"Eier"` → `"3 STÜCK (180 G)"`, `"Karotten"` →
`"300 G"` — the explicit-grams carrot entry no longer shows a derived Stück count. Daily total
correct (82.2 + 246.6 + 96 ≈ 425 kcal), zero console/page errors. Logged as a `✅ geprüft`
entry in
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md#2026-07-17--j-011-explizite-gramm-angabe-wird-nicht-mehr-rückwärts-in-eine-stückzahl-umgerechnet).

---

#### J-012: User-Friendly Canonical Group Title + Expand/Collapse Chevron

Status: `todo`
Depends on: J-009 (refines its group-header presentation only; grouping logic itself is
already correct and unchanged by this task)

**Ziel:** Post-merge product review of J-009 (native dogfooding). Grouping data/behavior was
accepted as correct in full — canonical-identity grouping, aggregation math, expand/collapse,
per-child edit/delete, J-005 separation all confirmed working as specified. Two presentation
refinements were identified, both explicitly deferred (not a J-009 rejection/reopen):

1. **Group title is too catalog-technical.** J-009 uses `foodCatalogRef.displayName` directly
   as the group label, which for the dogfooding case renders the raw BLS catalog string
   `"Huehnerei ganz roh"` (ASCII `Huehnerei` instead of `Hühnerei`, an unrequested `"ganz roh"`
   qualifier, and a different register than the child rows' own `"Ei"`/`"Eier"` titles). The
   **grouping key** should stay the canonical catalog identity (unchanged — decision 6 is not
   in question here); only the **visible title** should prefer a stable, user-friendly German
   display name over the raw catalog string when one is available, e.g. `"Eier"` for this case.
2. **No visible affordance that a group row is expandable.** The collapsed group header
   currently looks like a plain summary row; nothing hints it is tappable. A small chevron
   (e.g. `›` collapsed / `⌄` expanded) next to the title would fix this.

**Scope / betroffene Dateien (expected, to confirm at implementation time via code
inspection):**

- `src/presentation/features/journal/journalEntryDisplay.ts` — where the canonical group's
  `label` is currently set to `foodCatalogRef.displayName` (see `applyCanonicalGrouping`),
  prefer a user-friendly name source if one exists in this codebase already (e.g. an existing
  DE/EN alias dictionary or canonical-food display-name table — check
  `src/features/nutrition/domain/canonicalFoods.ts` / `FoodAliasDictionary.ts` /
  `detectCanonicalEntity.ts` for a reusable, already-populated German label per canonical
  identity before introducing any new lookup or data source); fall back to the existing raw
  `displayName` only when no friendlier name is available. Do not change the grouping key.
- `src/presentation/features/journal/JournalScreen.tsx` — add a small chevron glyph/icon next
  to the canonical group header title, reflecting `isExpanded`; composite-dish group headers
  are out of scope (no chevron requested/needed there — they have no toggle).

**Risiken:** picking an inconsistent or untranslated fallback name if no existing
DE display-name source actually covers a given canonical identity (mitigate: fall back to the
current raw `displayName` behavior, never fail/blank); scope creep into a new
name-mapping table/data source not already in this codebase (mitigate: reuse existing
alias/canonical-food data only — if none covers a given case, that is an acceptable, narrow,
pre-existing gap, not something this task should newly build out).

**Tests:** known canonical identities with an existing friendly-name source render that name,
not the raw catalog string (e.g. egg case → `"Eier"`, not `"Huehnerei ganz roh"`); identities
without a friendly-name source still fall back to the raw `displayName` unchanged (no
regression to J-009's existing tests); chevron reflects collapsed/expanded state (render-level,
manual/native check per this repo's headless-env limitation, same as J-009's own toggle).

**Akzeptanzkriterien (DoD):**

- Canonical group titles prefer a stable, user-friendly German name over a raw catalog string
  when one already exists in this codebase's data; grouping key/identity logic is unchanged.
- A visible chevron indicates collapsed vs. expanded state on canonical group headers only.
- No regression to J-009's grouping, aggregation, edit/delete, or J-005-separation behavior.
- `npm run verify` green.

**Verify:** `npm run verify`; UI-relevant in a headless env → new `docs/MANUAL_TESTING_GAPS.md`
entry unless genuinely live-verified (VERIFY.md Category 4).

---

#### J-013: Absolute, Idempotent Journal Quantity Editing

Status: `done`
Severity: **BLOCKER**
Depends on: none (blocks resumption of native dogfooding)
Origin: native Android dogfooding 2026-07-17 —
[`reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md`](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md)
Finding 1.

**Implementation notes (proven root cause + fix):** the cumulative bug was in
`EditFoodEntryFromNaturalLanguageUseCase` + `PortionParser`, not the UI. A bare `"2"` matched
`PortionParser`'s `exactToken` branch and returned a **multiplier**, which the use case applied
to `nextEntry.grams` (the already-edited value) → 60→120→360→720. Fix (5 product files):

- `PortionParser.ts` / `PortionParseResult.ts` — added an **absolute count** intent (`count` +
  `countUnit` for `"2 Stück"`, `"3 Scheiben"`, `"zwei stück"`, `stk`), and changed a **bare
  number/number-word** to `ambiguous` with note `BARE_NUMBER_NEEDS_UNIT` (no more silent
  multiplier guess). Explicit `"2x"` and the keyword multipliers (`doppelt`/`halb`) are
  unchanged (they are deliberately relative).
- `EditFoodEntryFromNaturalLanguageUseCase.ts` — resolves a count intent to an **absolute**
  grams target via `resolvePortionGrams` (portion knowledge / canonical default portion, e.g.
  egg 60 g/piece), recalculates macros from that absolute quantity, and writes a count-phrased
  `rawInput` (`"2 Stück ei"`, no grams) so the display shows `2 Stück (120 g)`. A bare number
  and a count for a food with no known piece weight are **rejected without mutation** (no
  quantity change, no correction-log entry, no repository write). Canonical identity, frozen
  `calcBreakdown.per100g`, correction log, entry id/order and J-005 are preserved.
- `container.ts` — injects `portionKnowledgeService` into the edit use case.
- `JournalScreen.tsx` — modal now shows the current quantity, uses the label
  „Was möchtest du ändern?" (replacing „Bearbeitungsanweisung"), shows examples
  („2 Stück", „150 g", „Magerquark statt Quark"), and shows a clarification (keeping the modal
  open, no reload) when the instruction is rejected.

**Verification:** `npm run verify` green (116 suites / 926 tests, typecheck + lint + format).
New tests reproduce the exact native sequence `1 → 2 Stück → 3 Stück → 2 Stück` staying
absolute (120→180→120, never 720), repeated-identical idempotency, explicit `120 g` gram-only,
bare `2` rejected without mutation/correction-log, and a count for an unknown-portion food
rejected without mutation. `PortionParser` count/bare-number cases added. Regression suites
(logging, `journalEntryDisplay` J-009/J-010/J-011, `resolvePortionGrams`) stay green. Live web
verification not run this session (headless env; the initial-egg log path depends on the
OFF/USDA resolver network, flaky per prior J-008 notes) → `docs/MANUAL_TESTING_GAPS.md` entry
added for native retest.

**Ziel:** A journal edit sets an **absolute target quantity**, never a multiplier of the
already-edited value. Repeating the same instruction is idempotent. Count edits are
first-class (`2 Stück` = exactly 2 Stück / 120 g), and a bare number is never guessed.

**Current evidence (code-verified):**

- The edit modal calls `container.editFoodEntryFromNaturalLanguageUseCase`
  ([`JournalScreen.tsx:446`](../src/presentation/features/journal/JournalScreen.tsx)) →
  [`EditFoodEntryFromNaturalLanguageUseCase`](../src/features/nutrition/application/usecases/EditFoodEntryFromNaturalLanguageUseCase.ts).
- A bare `"2"` is parsed by
  [`PortionParser`](../src/features/nutrition/domain/portion/PortionParser.ts) `exactToken`
  branch (`:86-92`) → `parseNumberToken` → `multiplierResult` → `{ multiplier: 2 }`. The use
  case's multiplier branch (`EditFoodEntryFromNaturalLanguageUseCase.ts:61-70`) multiplies
  `baseGrams = nextEntry.grams ?? nextEntry.quantityGrams` (the current value):
  60 → ×2 = 120 → ×3 = 360 → ×2 = 720 (exact native reproduction).
- `"2 Stück"` is two tokens, matches no `PortionParser` branch → `NO_PORTION_SIGNAL`; the
  edit path has **no count/piece model** at all (pieces exist only in the display layer via
  J-010/J-011 + portion knowledge).
- The modal `TextInput` placeholder is literally `"Bearbeitungsanweisung"`
  (`JournalScreen.tsx:676`).

**Exact scope / affected files (confirm at implementation time):**

- `src/features/nutrition/domain/portion/PortionParser.ts` and/or a new small helper —
  distinguish **absolute** intents (`"150 g"`, `"2 Stück"`) from the existing relative
  keyword multipliers, and stop mapping a bare number to a multiplier. A bare `"2"` must be
  rejected/clarified, not guessed.
- `src/features/nutrition/application/usecases/EditFoodEntryFromNaturalLanguageUseCase.ts` —
  set an absolute target quantity (grams, or count → grams via the existing portion
  knowledge / `resolvePortionGrams`); recalculate calories/macros from the absolute new
  quantity; preserve canonical identity + frozen nutrition provenance
  (`nutritionSnapshot`/`foodCatalogRef`); preserve `appendCorrectionLogEntry` behavior.
- `src/features/nutrition/domain/portion/` (`PortionKnowledgeService`/`resolvePortionGrams`)
  — read-only reuse to turn a count edit into grams and keep the count for display.
- `src/presentation/features/journal/JournalScreen.tsx` — modal shows the current quantity,
  concrete examples (`2 Stück`, `150 g`, `Magerquark statt Quark`), a clarification message
  when the input lacks an explicit unit, and replaces the „Bearbeitungsanweisung" wording.
  Count-based edits remain displayed as count + grams.

**Risks:**

- Silent behavior change to relative keyword edits („doppelte Portion") — keep those working,
  scope the change to absolute-number/count intents only.
- Turning a count into grams incorrectly when no known portion exists — reuse the exact
  existing portion-knowledge path; if no piece portion is known, require grams (do not invent
  a piece size).
- Regression to J-005 auto-merge, J-008 confirmation, J-009 grouping, J-010/J-011 display —
  all must stay unaffected.

**Tests (required regression coverage):**

- Exact reproduction: `1 Ei` → `2 Stück` (2/120 g) → `3 Stück` (3/180 g) → `2 Stück`
  (2/120 g).
- Repeated identical instruction is idempotent (`2 Stück` twice → unchanged).
- Explicit grams (`120 g` stays gram-only).
- Ambiguous bare number (`2`) is rejected/clarified **without mutating** the entry.
- Grouped-child edit; calories/macros + daily totals recomputed from the absolute state.
- Correction log records the correct previous values.
- J-005, J-008, J-009, J-010, J-011 unaffected.

**Akzeptanzkriterien (DoD):**

- Edits set an absolute target; never multiply the already-edited value; identical
  instructions are idempotent.
- `2 Stück`→2/120 g, then `3 Stück`→3/180 g, then `2 Stück`→2/120 g.
- `120 g` stays gram-only; count edits display as `2 Stück (120 g)`.
- A bare number is not guessed; the UI requires an explicit unit or shows an understandable
  clarification.
- Correction log, grouping and daily assessment stay correct; canonical identity + frozen
  provenance preserved.
- Modal shows current value + concrete examples; „Bearbeitungsanweisung" replaced.
- `npm run verify` green.

**Out of scope:** resolver/ranking, evaluation, Saved Meals, whole-Journal redesign,
migrations, dependency changes.

**Verify:** `npm run verify` (Category 4); UI-relevant in a headless env → new
`docs/MANUAL_TESTING_GAPS.md` entry unless genuinely live-verified.

---

#### J-014: Compact Last-Submit Confirmation (refines J-008)

Status: `todo`
Severity: Medium
Depends on: J-008 (`done`) — refines its transient panel; does **not** reopen J-008.
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 7.

**Ziel:** Replace the stacked confirmation (count header + summary sentence + full duplicated
entry row) with a single compact banner, e.g. „**Haferflocken gespeichert · 102 kcal**
**Bearbeiten**".

**Current evidence:** the J-008 transient panel
([`journalLastSubmitConfirmation.ts`](../src/presentation/features/journal/journalLastSubmitConfirmation.ts)

- the panel section in
  [`JournalScreen.tsx`](../src/presentation/features/journal/JournalScreen.tsx)) currently
  renders a count header, a summary sentence, and a full entry row simultaneously (native
  screenshot). J-008's controller/timer guarantees are already `done` and unit-tested.

**Exact scope / affected files:**

- `src/presentation/features/journal/JournalScreen.tsx` — collapse the panel to one compact
  banner (latest submission only) with a „Bearbeiten" action; remove the duplicated full
  entry row.
- `src/presentation/features/journal/journalLastSubmitConfirmation.ts` — adjust the derived
  message shape if needed; keep the existing timer/hold controller.

**Risks:** breaking J-008's timer/hold/blur/unmount safety; losing the partial-success
message; reducing target auto-dismiss from ~8 s to ~5 s must not race the hold logic.

**Tests:** compact message derivation (single/partial-success); auto-dismiss ~5 s; hold while
interacting/editing; tab blur removes the banner; multiple saved entries still reachable;
partial-success message still visible; J-008 controller tests stay green.

**Akzeptanzkriterien (DoD):** no duplicated full entry card; one compact banner under the
input; ~5 s visibility; „Bearbeiten" holds it open and reuses the existing edit flow;
partial-success text stays; tab change removes it; J-008 timer safety intact; `npm run verify`
green.

**Out of scope:** J-009 grouping, resolver/evaluation, redesign beyond this banner.

**Verify:** `npm run verify` (Category 4) + `docs/MANUAL_TESTING_GAPS.md` entry unless
live-verified.

---

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

#### SM-007: Include Piece/Unit-Based Entries When Creating a Template

Status: `done`
Depends on: none

**Ziel:** [`reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md`](../reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md)
(Befund 4.2) found that "Vorlage aus heutigen Einträgen erstellen" on a day with "Eier 2 Stück
(120 g)" + "Magerquark 100 g" silently produced a template with **only 1 Zutat** — the
piece-based Eier entry was dropped with no indication anything was skipped. Root cause:
`CreateSavedMealFromDateUseCase` filtered on `entry.quantityGrams > 0`, but `quantityGrams`
only reflects an _explicit_ gram amount the user typed (e.g. "200g Magerquark"). Count/unit-
based entries (e.g. "2 Eier") resolve their actual weight via portion knowledge into
`entry.grams` instead (see `LogFoodFromRawInputUseCase`'s resolver branch) — `quantityGrams`
stays `0` for them, even though `entry.grams` holds exactly the same weight already shown to
the user (e.g. "2 Stück (120 g)").

**Scope / betroffene Dateien:**

- `src/features/nutrition/application/usecases/CreateSavedMealFromDateUseCase.ts`: new
  `resolvedGrams()` helper — uses `entry.quantityGrams` when explicitly set (> 0), falling back
  to `entry.grams` otherwise. Used both for the "has a real weight" filter and for the per100g
  snapshot's factor and the template item's `quantityGrams`.
- `src/features/nutrition/__tests__/SavedMeals.test.ts`: new regression test for a count-based
  entry (`quantityGrams: 0`, `grams: 120`), asserting it is now included with the correct
  `quantityGrams`/`per100g`.

**Akzeptanzkriterien (DoD):**

- A template created from a day containing both an explicit-gram entry and a piece/unit-based
  entry includes both.
- The existing "entries genuinely without any weight" skip behavior (`quantityGrams: 0` and no
  `grams`) is unchanged — covered by the pre-existing "should skip entries without grams" test.
- `npm run verify` passes clean.

**Verify:** `npm run verify` (typecheck, lint, format, full suite); targeted
`npm run test -- --testPathPattern=SavedMeals`.

**Implementation notes:** See file list above. No other consumer of `SavedMealItem.quantityGrams`
needed changes — `LogSavedMealToDateUseCase` already treats it as a plain gram weight
(`` `${item.quantityGrams}g ${item.parsedName}` ``), which is exactly what `entry.grams` already
represents for both explicit-gram and resolved-portion entries. Full suite green after this
change (see this branch's `npm run verify` run).

---

#### SM-008: Saved Meal Composition Transparency

Status: `todo`
Severity: Medium
Depends on: SM-001 (`foodCatalogRef` on template items, `done`) for canonical display
grouping.
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 6.

**Ziel:** A saved meal shows how many **unique foods** it contains and an aggregated,
user-facing quantity — not a raw count of journal events — and lets its contents be inspected
before logging. Egg example target: „1 Lebensmittel · 7 Eier · ~575 kcal".

**Current evidence (code-verified):**
`src/presentation/features/savedMeals/SavedMealsScreen.tsx:166` renders
`{template.items.length} Zutat{…en}` — the count of template items (journal events), so three
egg-log events read as „3 Zutaten" although the template is one food / seven eggs. No content
inspection is offered before logging.

**Exact scope / affected files (confirm at implementation time):**

- `src/presentation/features/savedMeals/SavedMealsScreen.tsx` — count **unique foods** (group
  by canonical identity: `foodCatalogRef.source:sourceId`, mirroring J-009's key) for the
  summary line; show an aggregated user-facing quantity; add an openable content view listing
  each food, quantity and unit.
- Possibly a new pure display helper
  `src/presentation/features/savedMeals/savedMealsDisplay.ts` (+ test) for the
  unique-food/quantity aggregation, keeping the screen thin.

**Risks:** collapsing different foods that share a similar label (mitigate: group by canonical
identity only, never by name); mutating persisted template data (presentation-only — read
existing `SavedMealTemplate`/`SavedMealItem`, write nothing); breaking log-back totals.

**Tests:** repeated same food → „1 Lebensmittel · N …"; mixed meal → correct unique-food
count; count + gram entries aggregated sensibly; explicit gram-only entries; reload
persistence unchanged; logging still reproduces exact totals.

**Akzeptanzkriterien (DoD):** „Zutaten" counts unique foods, not journal events; egg example
reads equivalently to „1 Lebensmittel · 7 Eier · ~575 kcal"; contents openable before logging
with food/quantity/unit visible; different foods not merged; persisted data unchanged; logging
reproduces exact journal values; `npm run verify` green.

**Out of scope:** new persistence model (unless proven necessary), resolver/evaluation
changes, template rename/edit features.

**Verify:** `npm run verify` (Category 4) + `docs/MANUAL_TESTING_GAPS.md` entry unless
live-verified.

---

### Goals & Evaluation

Status: `done` (GE-001–GE-008 all done — see each task's own section)

All five decomposed tasks (GE-001–GE-005 below) are `done`, plus follow-ups GE-006/GE-007/GE-008
(all done). Like Saved Meals, this is
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

#### GE-009: Remove Placeholder Result from Berechnungs-Details

Status: `done`
Depends on: none

**Ziel:** [`reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md`](../reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md)
(Befund 4.1) found that the first line of the BMR breakdown in `GoalsScreen`'s
"Berechnungs-Details" ("BMR Formula (Mifflin-St Jeor)") renders **"= 0"** — a placeholder
result (`result: 0, // Placeholder`) that `calculateBmr` pushed for the formula-statement step,
before any real value is substituted in (that happens in the very next step, "BMR Calculation").
This is exactly the kind of displayed-but-wrong number the transparency feature exists to avoid,
and undermines trust most for the persona (6.4, "Blutwerte verbessern") that most needs the
breakdown to be nachvollziehbar.

**Scope / betroffene Dateien:**

- `src/features/goals/domain/models/MetabolismTypes.ts`: `MetabolismBreakdownStep.result` is
  now optional (`result?: number`) — a step may state a formula without yet having a result.
- `src/features/goals/application/calculators/MetabolismCalculator.ts`: removed the
  `result: 0` placeholder from the `bmr_formula` step; the field is simply omitted there now.
- `src/presentation/features/goals/GoalsScreen.tsx`: the breakdown renderer only shows the
  "= N" line when `step.result` is an actual number, instead of coercing `undefined`/every step
  into always rendering an "=" row.

**Akzeptanzkriterien (DoD):**

- The "BMR Formula (Mifflin-St Jeor)" step no longer renders any "=" result line.
- The "BMR Calculation", "Activity Multiplier", and "Total Daily Energy Expenditure" steps keep
  rendering their real results unchanged.
- `npm run verify` passes clean.

**Verify:** `npm run verify` (typecheck, lint, format, full suite); existing
`MetabolismCalculator.test.ts`/`ComputeMetabolismResultUseCase.test.ts` re-run unchanged (no
test asserted on the placeholder value, confirmed before making this change).

**Implementation notes:** See file list above. No new test added — this is a pure display-layer
correctness fix with no new branching logic to cover; the existing calculator tests (which never
asserted `steps[0].result === 0`) continue to pass unchanged and already cover `bmr`/`tdee`
correctness. Full suite green after this change (see this branch's `npm run verify` run).

---

#### GE-010: Nutrient-Specific Mixed-State Daily Assessment

Status: `todo` (planning complete — Act pending)
Severity: High
Depends on: the evaluation engine (GE-001–GE-005). Recommended: **plan the output model
first** (the brief flags mixed-state rules as needing review before coding).
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 4.

**Planning complete (2026-07-17):**
[`plans/GE-010_NUTRIENT_SPECIFIC_ASSESSMENT_PLAN.md`](../plans/GE-010_NUTRIENT_SPECIFIC_ASSESSMENT_PLAN.md).
Proven root cause: `dailyProgressToEvaluationOutput.ts` collapses four per-dimension corridor
statuses with `goalProgress.some((g) => g.status === 'over') ? 'over' : 'on-track'`, so one
over-corridor macro (fat) classifies the whole day as „Über dem Ziel" while calories/protein/
carbs are under — and, in the opposite direction, an all-under/empty day wrongly reads as
„Im Zielkorridor". Recommended target model (smallest safe): an additive, domain-computed
`AssessmentDetail` (`orientation: in-corridor|below|over|mixed|no-data` + a `deviations` list of
out-of-corridor dimensions + a `primary` dimension), derived deterministically from the existing
`goalProgress` (no new thresholds — only the current ±5 % corridor); presentation formats it into
a nutrient-specific summary (e.g. „Fettziel überschritten" + „Kalorien liegen noch unter deinem
Tagesziel."). Magnitude words („leicht/deutlich") are deferred (would need a new, approval-pending
threshold). No target/formula/schema change; the assessment-value tests that lock the current
collapse are intentional updates for the Act task (see plan §8). This task stays **not done** —
the plan does not complete the functional GE-010; no separate Act task ID was created (plan and
fix are one coherent evaluation change, unlike RESOLVER-V2-008→009). Act sequence + wording
matrix + native retest steps are in the plan.

Remaining implementation notes below describe the Act task; the plan supersedes/details them.

**Ziel:** The daily assessment names the actually-exceeded dimension instead of a blanket
„Über dem Ziel" when only one nutrient is over. Example evidence: calories 1363/2449, protein
97/153, carbs 47/276, fat 87/82 → currently „Über dem Ziel", should be e.g. „Fettziel leicht
überschritten" (optionally „Kalorien liegen noch unter deinem Tagesziel.").

**Current evidence (code-verified):**

- `src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts:66` —
  `assessment: goalProgress.some((g) => g.status === 'over') ? 'over' : 'on-track'`.
- `src/features/evaluation/application/mergeRuleResults.ts:19-22` — merged `assessment` is
  `'over'` if **any** rule result is `'over'`.
- `src/presentation/features/evaluationSummary/evaluationSummaryDisplay.ts:19` maps
  `'over' → 'Über dem Ziel'` (display only).

So a single over-target macro forces the whole-day label to „over"; the fix is in the
evaluation **output model**, not the display string.

**Exact scope / affected files (confirm during the plan step):**

- `src/features/evaluation/application/rules/dailyProgressToEvaluationOutput.ts` and
  `mergeRuleResults.ts` — model mixed under/in-range/over states and carry which dimension(s)
  are outside the corridor, instead of collapsing to a single global label when only one is
  over.
- `src/features/evaluation/domain/models/EvaluationContract.ts` — extend the assessment/
  output shape if a richer mixed-state representation is needed (additive).
- `src/presentation/features/evaluationSummary/evaluationSummaryDisplay.ts` +
  `EvaluationSummaryScreen.tsx` — render the nutrient-specific summary; keep truthful calorie
  context; ensure summary and recommendations do not contradict.
- Rules must stay dependent on the active evaluation goal (Evidence-based / Weight-Loss).

**Risks:** turning macro targets into medical limits (avoid — keep numbers unchanged);
contradictory summary vs. recommendation text; adding nutritional doctrine without an accepted
Product-Bible source (forbidden). Numerical facts must not change.

**Tests:** calories below + fat above → names fat; calories above + macros within; protein
below; all within corridor; several dimensions above; empty day; both evaluation goals;
summary/recommendation non-contradiction.

**Akzeptanzkriterien (DoD):** mixed states named concretely; no blanket global label when only
one dimension is outside the corridor; assessment stays goal-dependent; recommendations
consistent with the summary; unit tests cover over/under/mixed; `npm run verify` green.

**Out of scope:** changing target/formula math, new nutrition doctrine, resolver/journal
changes.

**Verify:** planning step → Category 1 readback; implementation → `npm run verify`
(Category 4) + gap-log entry unless live-verified.

---

#### GE-011: Energy-Need Explanation & Progressive Disclosure

Status: `todo`
Severity: Medium
Depends on: none (presentation-only; no formula change).
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 8.

**Ziel:** Make the energy-need section understandable and progressively disclosed. Prominent:
„**Geschätzter Erhaltungsbedarf** · N kcal pro Tag" with a plain-German explanation. Secondary:
„**Grundumsatz** · N kcal pro Tag" explained as rest-energy that is **not** a recommended
target. Collapsed by default: „**So wurden die Werte berechnet**".

**Current evidence (code-verified):**
`src/presentation/features/goals/GoalsScreen.tsx:223` renders the „Metabolismus-Profil" card;
`:368` „Grundumsatz (BMR)", `:374` „Gesamtumsatz (TDEE)", `:384` „Berechnungs-Details" — full
transparency but formula-dominated and unexplained in user terms.

**Exact scope / affected files:**

- `src/presentation/features/goals/GoalsScreen.tsx` — rename „Metabolismus-Profil" to a
  clearer term such as „Körperdaten & Energiebedarf"; lead with the TDEE/maintenance
  explanation, then BMR (explicitly not the recommended target); move formulas/„Berechnungs-
  Details" under a collapsed „So wurden die Werte berechnet" disclosure that preserves full
  transparency.
- (If the card is componentized, the corresponding presentation component/styles.)

**Risks:** changing BMR/TDEE math (forbidden — wording/layout only); losing the existing
transparency (must stay reachable via the disclosure); mixing this with account/evaluation
profiles (keep separate).

**Tests:** the repo has no RN render harness — document rationale; add a pure display helper +
test only if new formatting/mapping logic is introduced (otherwise gap-log per headless-env
rule).

**Akzeptanzkriterien (DoD):** formulas collapsed by default; BMR/TDEE explained in German; the
user understands which value drives the daily target; „Metabolismus-Profil" renamed; no
formula changes; no mixing with account/evaluation profiles; transparency preserved under the
disclosure; `npm run verify` green.

**Out of scope:** formula/calculation changes, account/sync, evaluation-goal wording.

**Verify:** `npm run verify` (Category 4) + `docs/MANUAL_TESTING_GAPS.md` entry unless
live-verified.

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

#### DI-007: Render Rule-Level Insights & Recommendations in EvaluationSummaryScreen

Status: `done`
Depends on: DI-002 (screen to render into), DI-003 (content already exists on `EvaluationOutput`)

**Ziel:** `DI-003` already populates `EvaluationOutput.insights`/`.recommendations` with real,
profile-dependent content (`CalorieMacroCorridorRule`, `ProteinPreservingDeficitRule`), proven
distinct per profile by `DI-004`'s regression test — but `EvaluationSummaryScreen` (`DI-002`)
only ever renders `assessment`, `goalProgress`, and `warnings`. A repo-wide grep for
`.insights`/`.recommendations` under `src/presentation/` returns zero hits: this content is
fully computed and tested, but never shown to a user. Show it. This is immediate today's-status
interpretation ("what does my current day mean under my active evaluation model"), explicitly
**not** the separate, still-`todo`, not-yet-decomposed Tier 3 "Insights" module (trend
analysis/weekly summaries over multiple days, see Tier 3 planning table below) — DI-007 must
not be folded into or block on that later, larger effort.

**Scope / betroffene Dateien:**

- `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — add an
  insights section and a recommendations section, rendered from the same `output` already held
  in state; mirror the existing `warnings` block's rendering pattern.
- `src/presentation/features/evaluationSummary/evaluationSummaryDisplay.ts` — only if needed
  for display formatting (no new domain logic).
- `src/presentation/features/evaluationSummary/__tests__/*` — new/extended tests per below.

**Required behavior:**

- Render `output.insights` and `output.recommendations` verbatim — no re-computation, no
  rewording, no new fixed copy that's independent of the active profile.
- Each section renders only when it has at least one entry; an empty array renders nothing (no
  empty section, no placeholder, no implication that something is missing or broken).
- Assessment, Goal Progress, and Warnings stay unchanged; Warnings must not become visually
  buried by the new sections. Recommended order: Assessment → Goal Progress → Insights →
  Recommendations → Warnings, unless implementation finds a clearly better-justified order (may
  be documented in the implementation notes) — but Warnings' visibility must not regress.
- No internal architecture vocabulary (rule names, "Evaluation Profile", registry terms) may
  leak into the rendered text.
- No new evaluation logic in the screen; the screen stays a pure renderer of an already-built
  `EvaluationOutput`.
- Switching the active profile must remain visible as different rendered insight/recommendation
  text (already covered structurally by existing DI-004 coverage; screen-level test should
  assert this too, see Tests).

**Explicitly out of scope:** explicit loading-state UI (separate, pre-existing gap, own
follow-up rather than folded in here); historical date selection or wiring `dateISO` through
the settings providers; the GoalsScreen/EvaluationSummaryScreen dual profile-switch-entry-point
UX question; removing the dead `ComputeProgressForDateUseCase` container wiring; the
`MockNutritionRepository`/`MockRecoveryRepository`-backed tabs; the separate Tier 3
trends/weekly-summaries module; any new Rule or new insight/recommendation content.

**Tests:**

- Insights render when `output.insights` has entries.
- Recommendations render when `output.recommendations` has entries.
- Empty arrays produce no visible section for that content (not just an empty container).
- Existing assessment/goal-progress/warnings rendering is unchanged (regression).
- Two different `EvaluationOutput`s (e.g. built from the two existing profiles, as in DI-004's
  fixtures) produce visibly different rendered insight/recommendation text.
- No hardcoded profile-dependent string and no new computation appear in the screen/component
  under test. Existing `DI-003` domain-level tests must stay green unmodified.

**Akzeptanzkriterien (DoD):**

- Insights and Recommendations are visible in the production `EvaluationSummaryScreen` when
  present, absent when empty, without disturbing Assessment/Goal Progress/Warnings.
- No new use case, repository, domain abstraction, or Rule introduced.
- Full suite, typecheck, lint pass clean.
- No work performed on the Tier 3 trends/weekly-summaries module.

**Verify:** `npm run verify`; additionally targeted:
`npm run test -- --runTestsByPath src/presentation/features/evaluationSummary/__tests__/<test-file>`.

**Implementation notes:** Added two new sections to `EvaluationSummaryScreen.tsx` — "Einordnung"
(`output.insights`) and "Empfehlungen" (`output.recommendations`) — positioned between the
existing "Fortschritt" and "Hinweise" sections, exactly the recommended order. Both mirror the
existing `warnings` block's conditional-render pattern (`length > 0 &&`) verbatim: no new
mapping, no new formatting, no new domain logic — the strings from `EvaluationOutput` render
unchanged. `evaluationSummaryDisplay.ts` was not touched: unlike `goalProgress.label`/
`assessment`, insight/recommendation strings need no label lookup. No use case, repository,
Rule, or registry file touched.

No new automated tests were added: this repo has no React Native rendering test library
(`@testing-library/react-native`/`react-test-renderer` are not dependencies, and no file under
`src/presentation/` calls `render(...)`) — adding one was explicitly out of scope. The mirrored
`warnings` block (DI-002) has the same pre-existing gap for the same reason. A
`docs/MANUAL_TESTING_GAPS.md` entry was added per `AGENTS.md`'s binding Manual UI Testing Gap Log
rule. Full suite (113 suites / 854 tests, unchanged — no new test files), `tsc --noEmit`,
`eslint`, and `npx prettier -c` (scoped) all pass clean.

---

#### DI-008: Explicit Loading State for Evaluation Summary

Status: `done`
Depends on: DI-002 (screen this applies to)

**Ziel:** `EvaluationSummaryScreen` (`DI-002`) has no explicit loading state. Between mount and
the moment `load()` resolves — including every reload triggered by a profile switch — the
screen shows only the title and the (briefly empty) profile picker; the entire evaluation
content area is blank, indistinguishable from a stuck screen or an undecided state. This gap
was explicitly flagged and deferred by `DI-007`'s "Explicitly out of scope" section
("explicit loading-state UI ... separate, pre-existing gap, own follow-up rather than folded in
here"). **This entry is planning only** — a fresh review-only task; no product code was
changed to add it.

**Current load flow (as inspected):**

`load()` in `EvaluationSummaryScreen.tsx` synchronously calls
`evaluationProfileRegistry.list()` (→ `setProfiles`), then `await getActiveProfileId()` (→
`setActiveProfileId`), then, inside a `try`, `await
buildEvaluationInputForDateUseCase.execute(...)` and `await
getActiveEvaluationOutputUseCase.execute(...)`. Success sets `output` and clears
`errorMessage`; failure sets `errorMessage` (mapped from `GoalsNotFoundError`/
`ProfileNotFoundError`, or a generic fallback) and clears `output`. There is no state that is
true only "while loading" — the interim state is inferred by omission (`output === null &&
errorMessage === ''`), indistinguishable from any future bug that leaves both unset. `load()`
runs both on mount (`useEffect`) and again on every `handleSelectProfile` call, so this blank
gap recurs on every profile switch, not only once at mount — and the _previous_ profile's
`output` stays rendered, untouched, until the new `load()` resolves, which can read as
belonging to the newly selected profile.

**Defined state transitions:**

| State                  | Trigger                                                                                                                                                                                           | Current visual result                                                                                                    | Distinguishable today?                                                                                                                           |
| ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Initial mount          | Component mounts, before `load()`'s first `await`                                                                                                                                                 | Title + empty profile picker, no content, no error                                                                       | Only for one render tick; collapses into "Loading" below                                                                                         |
| Loading                | `load()` in flight (initial call **or** profile-switch reload)                                                                                                                                    | Title + profile picker (previous or empty); no content, no error, no indicator                                           | **No — this is the gap.** Blank/ambiguous; on a profile-switch reload the _stale_ previous profile's content stays on screen instead of clearing |
| Success (with data)    | `load()` resolves, `output.goalProgress.length > 0`                                                                                                                                               | Assessment, Fortschritt, (optionally) Einordnung/Empfehlungen, (optionally) Hinweise                                     | Yes                                                                                                                                              |
| Success (empty result) | `load()` resolves, `mergeRuleResults` returns `{ assessment: 'no-data', goalProgress: [], insights: [], recommendations: [], warnings: [] }` (e.g. active profile has no rules producing results) | Assessment renders "Keine Daten"; Fortschritt section header renders with zero rows; no Einordnung/Empfehlungen/Hinweise | Yes — already renders distinct content; no new UI required for this case                                                                         |
| Error                  | `load()` throws (`GoalsNotFoundError`, `ProfileNotFoundError`, or other)                                                                                                                          | `errorMessage` text shown, no content                                                                                    | Yes                                                                                                                                              |

**Smallest UI change (for the Act task — not implemented here):**

1. Add one explicit state value, e.g. `const [loadState, setLoadState] = useState<'loading' |
'success' | 'error'>('loading')`.
2. Set `loadState` to `'loading'` at the very start of `load()` — covers both the mount call
   and every profile-switch reload, and incidentally fixes the stale-previous-profile-data
   issue above once the content block's render condition includes `loadState === 'success'`
   instead of relying on `output` truthiness alone.
3. Set `loadState` to `'success'` alongside the existing `setOutput(result)` /
   `setErrorMessage('')` on the happy path.
4. Set `loadState` to `'error'` alongside the existing `setErrorMessage(...)` in the `catch`
   block (all three branches: `GoalsNotFoundError`, `ProfileNotFoundError`, generic fallback).
5. Render one explicit loading branch (`loadState === 'loading'`) where the screen currently
   falls through to nothing — an `ActivityIndicator` plus a short German status line (e.g.
   "Auswertung wird geladen…"), replacing the blank gap. Gate the existing error block on
   `loadState === 'error'` and the existing content block on `loadState === 'success' &&
output` (both conditions already exist in some form; this only makes the third,
   currently-implicit branch explicit).
6. No change to the empty-result branch's rendering — it already renders truthy, distinct
   content under `loadState === 'success'`.
7. No change to `switchingProfileId` — it continues to govern only button
   disabled/active-styling during a switch; it is a separate, narrower mechanism from the new
   content-area `loadState`, and the two do not conflict.

**Explicitly out of scope** (per task instructions):

- Skeleton loading system.
- Pull-to-refresh.
- Historical date selection.
- Provider/date semantics.
- Error-state redesign (existing `errorMessage` copy/behavior stays as-is).
- Insight text changes.
- Navigation changes.
- Broader loading-state standardization across the app (this task touches only
  `EvaluationSummaryScreen`).

**Test cases (for the Act task):**

- No React Native rendering test library exists in this repo
  (`@testing-library/react-native`/`react-test-renderer` are not dependencies — confirmed
  during `DI-007`); the same constraint applies here. Automated coverage is therefore limited
  to any pure logic extracted alongside the change; there is no obvious extraction candidate
  beyond a possible display-string constant (unlike `DI-002`'s `formatGoalProgressLabel`/
  `formatAssessment`) — if the Act task extracts one, it must be unit-tested the same way,
  mirroring `evaluationSummaryDisplay.test.ts`.
- Manual verification (Expo, or `expo start --web` — now available per `WEB-001` and already
  used to visually verify `DI-007`), to be logged in `docs/MANUAL_TESTING_GAPS.md` per
  `AGENTS.md`'s binding rule:
  1. Fresh mount, profile with real Journal data → loading indicator visible, then content, no
     blank gap in between.
  2. Fresh mount, `GoalsNotFoundError`/`ProfileNotFoundError` condition → loading indicator,
     then the existing error message (not blank, not stuck loading).
  3. Fresh mount, empty-result case (`no-data`/empty `goalProgress`) → loading indicator, then
     the existing "Keine Daten" content.
  4. Profile switch (tap the other profile button) → loading indicator reappears; the
     previously active profile's content is not shown once loading starts; the new profile's
     content replaces it once resolved.
  5. Regression: Assessment → Fortschritt → Einordnung → Empfehlungen → Hinweise order and
     content unchanged once loaded (no visual regression vs. `DI-007`); Hinweise stays visible,
     not buried.

**Akzeptanzkriterien (DoD) for the Act task:**

- Every state in the transition table above is explicitly represented in code (no
  inferred/implicit states).
- No blank interim screen between mount/profile-switch and the next terminal state (success,
  empty-result-success, or error).
- No stale previous-profile content visible once a profile-switch reload starts.
- No new use case, repository, domain abstraction, or Rule introduced; screen stays a pure
  renderer.
- Full suite, typecheck, lint pass clean; manual testing gap logged if not visually verified via
  Expo/web.

**Verify (Act task):** `npm run verify`; manual/web verification per
`docs/MANUAL_TESTING_GAPS.md`.

**Verify (this planning-only entry):** `git --no-pager status --short`, `git --no-pager diff
--stat`, `git --no-pager diff --name-only` (Category 1, Documentation-only, per `VERIFY.md`) —
no product code touched.

**Implementation notes:** Implemented as planned in `EvaluationSummaryScreen.tsx`: an explicit
`loadState: 'loading' | 'success' | 'error'` state, set to `'loading'` synchronously at the top
of `load()` (covers mount and every profile-switch reload), `'success'`/`'error'` alongside the
existing `setOutput`/`setErrorMessage` branches. Stale output from the previously active profile
is now hidden immediately once a reload starts, since the content block gates on
`loadState === 'success'` instead of `output` truthiness alone. Planning in PR #34, Act
implementation in PR #35 — both merged. `npm run verify` passes clean (typecheck, lint, format,
full suite). The literal `ActivityIndicator` visual frame remains a separate, still-open manual
check in `docs/MANUAL_TESTING_GAPS.md` (`⏳ offen`) — not required for this task's own DoD, which
only requires the gap to be logged, not closed.

---

#### DI-009: Cross-Tab Data Freshness

Status: `done`
Depends on: SM-005 (`SavedMealsScreen`), GE-008/DI-002 (`GoalsScreen`'s "Ziel wählen" card,
`EvaluationSummaryScreen`) — the two screens whose manual-testing sweep surfaced this

**Ziel:** A manual-testing sweep across the seven open `docs/MANUAL_TESTING_GAPS.md` entries found
two reproducible defects sharing one root cause, confirmed live against `expo start --web` +
headless Playwright:

- **Vorlagen → Protokoll:** logging a Saved Meal template from `SavedMealsScreen` persists
  correctly (a full page reload shows the new entry and the correct summed total), but
  `JournalScreen`, if already mounted from an earlier visit, keeps showing its stale pre-log
  state when the user switches back to the "Protokoll" tab — no reload happens on tab
  return.
- **Ziele → Auswertung:** switching the active Evaluation Profile via `GoalsScreen`'s "Ziel
  wählen" card persists correctly (confirmed via reload: `Ziele` tab shows the new profile
  as selected, `Auswertung` tab shows profile-correct numbers/insights) — but if
  `EvaluationSummaryScreen` was already mounted from an earlier visit, switching back to
  "Auswertung" shows the _previous_ profile's assessment, progress numbers, and insight text
  completely unchanged, with no indication anything is stale. More product-critical than the
  Journal case: this isn't merely outdated data, it's a materially wrong assessment presented
  as current.

**Root cause (confirmed by inspection):** `JournalScreen.tsx`'s `loadJournalData()` and
`EvaluationSummaryScreen.tsx`'s `load()` are both invoked exactly once, from a plain
`useEffect(() => { load…(); }, [])` (or `[load]`, itself a `useCallback` with a stable-ish
dependency), which fires once on the screen's first mount only. React Navigation's
bottom-tabs navigator keeps visited tab screens mounted rather than unmounting them on
tab-away (confirmed empirically during the sweep — inactive tabs' DOM content remained
present, at one point even intercepting a Playwright click meant for the active tab), so
`useEffect(..., [])` never fires again for the lifetime of the app session once a tab has
been visited once. Neither screen has a `useFocusEffect`/`addListener('focus', ...)`/
`useIsFocused()`-based refresh — a full-repo grep confirms **zero** existing usage of any of
these three APIs anywhere in `src/`, so this is a genuinely new pattern for this codebase,
not an existing convention to imitate.

**Scope / betroffene Dateien:**

- `src/presentation/features/journal/JournalScreen.tsx` — `loadJournalData()`'s trigger.
- `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — `load()`'s
  trigger; DI-008's `loadState` state machine already provides the "hide stale content the
  instant a reload starts" behavior this task needs — likely reusable as-is, not a new
  mechanism, once `load()` is actually invoked on focus.
- No changes anticipated to `SavedMealsScreen.tsx` or `GoalsScreen.tsx` themselves (their own
  writes already persist correctly); this is purely about the _reader_ side re-fetching.

**Pre-confirmed architecture facts (from inspection, not to be re-derived during Act):**

- `@react-navigation/native` `^7.1.28` / `@react-navigation/bottom-tabs` `^7.13.0` — both
  current enough that `useFocusEffect` (stable, long-standing React Navigation API) is
  available with no version blocker.
- **Double-load risk is real and must be designed around, not discovered mid-implementation:**
  React Navigation fires a screen's focus event on its very first mount too, not only on
  subsequent returns. Adding `useFocusEffect` _alongside_ the existing `useEffect(..., [])`
  would double-fire the load on first visit to each tab. The clean fix is very likely to
  **replace** the mount-only `useEffect` with `useFocusEffect` (not run both), but this must
  be verified against actual behavior during Act, not assumed.
- **Race-condition guard is an open question, not yet answered:** neither `load()` currently
  guards against overlapping in-flight calls (no ref/AbortController/generation-counter
  pattern). Rapid tab switching (away and back before a load resolves) could let an
  out-of-order response win. `JournalScreen` has a similar, already-solved precedent nearby
  (`claimJournalSubmitSlot`/`submitInFlightRef` guards concurrent _submits_, not loads) that
  the Act task should look at before inventing a new pattern.

**Explicit UX decision (already made by the user, not open for re-litigation in Act):**

- **Auswertung:** the previous profile's evaluation must never remain visible as if current
  during a profile-triggered refresh — DI-008's existing `loadState === 'loading'` branch
  already satisfies this by construction once `load()` fires on focus; no new loading UI
  expected here.
- **Journal:** the existing entry list may keep displaying its current (slightly stale)
  content for the brief duration of a focus-triggered background refresh — no flicker/spinner
  is required, only that the refresh actually happens and completes correctly. No new loading
  state expected here either.

**Explicitly out of scope:**

- Any UI/UX redesign beyond wiring the refetch (no skeletons, no pull-to-refresh, no broader
  loading-state standardization — same boundary DI-008 already drew).
- `GoalsScreen.tsx`/`SavedMealsScreen.tsx` write-side changes — their persistence is already
  confirmed correct.
- Any other screen not implicated by this sweep (`NutritionScreen`, `RecoveryScreen`) — out of
  scope unless the Act task's own architecture review finds the identical pattern there too,
  in which case that finding should be reported, not silently fixed as a scope expansion.

**Akzeptanzkriterien (DoD):**

1. A meal logged via "Vorlagen" appears under "Protokoll" on tab return, no full reload
   required.
2. A goal/profile change made under "Ziele" is immediately reflected under "Auswertung" on tab
   return, no full reload required.
3. No stale evaluation is ever presented as current during a profile-triggered Auswertung
   refresh.
4. The existing in-screen profile switch on the Auswertung tab itself (already working, proven
   in the DI-008 sweep) keeps working unchanged.
5. No duplicate Journal entries and no duplicate/doubled evaluation loads from the
   mount-plus-focus interaction.
6. Existing error states (`GoalsNotFoundError`/`ProfileNotFoundError`/generic Journal load
   failure) remain correctly handled on a focus-triggered reload, not just on initial mount.
7. `npm run verify` passes clean.
8. Both cross-tab paths (Vorlagen→Protokoll, Ziele→Auswertung) are re-verified live (Expo or
   `expo start --web` + Playwright, mirroring this sweep's method) after the fix, not just
   asserted from code reading.

**Verify:** `npm run verify`; live re-verification of both cross-tab paths per DoD item 8,
logged in `docs/MANUAL_TESTING_GAPS.md`.

**Implementation notes:** Both open architecture questions from planning resolved as
predicted, confirmed rather than assumed:

- **Chosen mechanism:** `useFocusEffect` (from `@react-navigation/native`), wrapping the
  existing load function in `useCallback` per React Navigation's documented pattern
  (`useFocusEffect(useCallback(() => { load…(); }, [deps]))`) — the callback must be
  synchronous (`() => void`), so the async load function is invoked fire-and-forget inside
  it rather than passed directly (an async function's `Promise<void>` return type doesn't
  satisfy `useFocusEffect`'s `void | (() => void)` signature and would fail `tsc --noEmit`).
- **Double-load avoided by replacement, not addition:** the mount-only `useEffect(..., [])`
  in both screens was removed entirely (not kept alongside `useFocusEffect`), exactly as
  flagged as the likely-but-unverified fix during planning. Confirmed empirically: no
  duplicate entries or doubled evaluation content on first tab visit or after repeated
  focus/blur cycles (see verification below).
- **Race-condition guard implemented:** a `loadRequestIdRef` (`useRef(0)`) generation counter
  in both `JournalScreen.loadJournalData()` and `EvaluationSummaryScreen.load()`, incremented
  at the start of each call; every `setState` call after an `await` boundary checks the ref
  still matches its captured `requestId` before applying, and bails out silently otherwise.
  This is a new, small, local pattern — not the pre-existing `claimJournalSubmitSlot`/
  `submitInFlightRef` (that guards concurrent _submits_, a different operation; reusing it
  directly for _loads_ would have conflated two independent concerns).
- **DI-008's `loadState` machine reused as-is, unmodified:** `EvaluationSummaryScreen`'s
  `load()` already set `loadState` to `'loading'` synchronously as its first line (before this
  task); once `useFocusEffect` actually invokes `load()` on every focus, that existing
  first-line reset is sufficient by itself to hide stale content immediately — no new loading
  UI, no changes to the `loadState` type or the render gating (`loadState === 'success' &&
output`) were needed.
- **`JournalScreen`:** per the explicit, already-made UX decision, no new loading state was
  added — the existing entry list may keep displaying its current content for the brief
  duration of a focus-triggered background refresh.
- No changes to `SavedMealsScreen.tsx`, `GoalsScreen.tsx`, `NutritionScreen.tsx`, or
  `RecoveryScreen.tsx` — the architecture review confirmed the identical
  mount-only-`useEffect` pattern is not present in those files' data-loading paths (out of
  scope per planning; not silently fixed).

**Verification results:** `npm run verify` passes clean (typecheck, lint, format, full suite —
113 suites / 854 tests, including `JournalScreen.submitGuard.test.ts`, unchanged). Both
cross-tab paths re-verified live against `expo start --web` + headless Playwright/Chromium
(mirroring the original sweep's method):

- **Vorlagen → Protokoll:** logging "200g quark" in Journal, creating+logging a Saved Meal
  template from it in Vorlagen, then switching back to Protokoll without a reload now
  correctly shows both entries (264 kcal total, 2× "Quark 200 G") — previously showed only
  the original single entry until a full reload.
- **Ziele → Auswertung:** switching the active profile to "Weight Loss" via `GoalsScreen`'s
  "Ziel wählen" card, then switching back to the already-mounted Auswertung tab without a
  reload, now immediately shows the correct Weight Loss assessment (Kalorien 264/1661,
  deficit-insight, protein recommendation) — previously showed the stale Evidence-based
  Standard assessment (264/2076, corridor-insight) unchanged.
- **Existing in-screen picker regression check:** switching profile via Auswertung's own
  picker button (not the Ziele-tab card) still works correctly and instantly, confirming DoD
  item 4.
- **Rapid multi-tab-switching stress test:** five rapid switches (Ziele→Protokoll→
  Auswertung→Ziele→Auswertung, ~400ms apart) followed by settling produced no corrupted,
  duplicated, or out-of-order state in either screen — Auswertung showed the last-selected
  profile's correct data, Protokoll showed exactly the expected two entries (no duplicates
  from repeated focus-triggered reloads).
- Zero browser console/runtime errors across the entire verification session.

---

#### DI-010: Single Ownership of the Active Evaluation Goal

Status: `done`
Severity: High
Depends on: DI-002 (Auswertung goal toggle), GE-008 (Ziele „Ziel wählen" card), DI-009
(cross-tab freshness) — all `done`.
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 3.

**Implementation notes (done):**

- `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — removed the
  interactive per-profile goal selector (and with it the inverted active/selectable optic: the
  active profile had been rendered as a muted/`surface` disabled button while the _alternative_
  used the accent `PrimaryButton`, so the active goal looked inactive). Replaced with a
  read-only „Aktives Bewertungsziel" section showing the active profile's name plus a „Ziel
  ändern" action (`TouchableOpacity`, `accessibilityRole="button"`, descriptive
  `accessibilityLabel`, ≥44 px touch target) that navigates to the Ziele tab via
  `navigation.navigate('Goals')` (typed `BottomTabNavigationProp<RootTabParamList>`, existing
  tab navigation — no new library, no imperative workaround). Deleted the now-dead
  `handleSelectProfile`/`switchingProfileId` state and the `PrimaryButton` import; kept the
  existing DI-009 `useFocusEffect` reload so a goal changed in Ziele is reflected on focus. The
  screen now holds **no independently mutable goal state** — the single persisted source of
  truth remains `container.evaluationProfileRegistry`.
- `src/presentation/features/goals/GoalsScreen.tsx` — user-facing wording (Product decision 5 /
  requirement 13): the GE-008 card title is now „Bewertungsziel" (was „Ziel wählen") with a
  helper clarifying it is separate from the Makroverteilung; added a „Makroverteilung" label
  above the Balanced/High Protein/Manuell macro-mode buttons. No behavior/logic change — the
  Ziele tab remains the single editing surface; its existing non-inverted active styling
  (`zielOptionActive`) is unchanged.

No change to evaluation formulas, calorie/macro targets, weight-loss/metabolism logic, journal
data, persistence schema, or navigation architecture.

**Verification (done):** `npm run verify` green (117 suites / 937 tests; typecheck + lint +
format). The evaluation/goals suites (24 suites / 107 tests) stay green. This repo has no
React-Native render-test harness (no `@testing-library/react-native`/`react-test-renderer`, no
`render()` under `src/presentation`), so — as with DI-002/DI-007/DI-008 — the read-only
rendering, the removed selector, „Ziel ändern" navigation, and accessibility/touch target are
covered by a `docs/MANUAL_TESTING_GAPS.md` entry with a native retest checklist rather than an
automated render test. The active-goal state itself (single source of truth + persistence) is
already covered by the existing `evaluationProfileRegistry` tests, unchanged by this task.

**Ziel:** The active evaluation goal is changed in **one** place — the Ziele tab. Auswertung
shows the active goal read-only (with an optional „Ziel ändern" link that navigates to Ziele)
and no longer carries a second, inverted-looking toggle. `Balanced` / `High Protein` /
`Manuell` stay a distinct **Makroverteilung** concept, not evaluation goals.

**Current evidence (code-verified):**

- `EvaluationSummaryScreen.tsx` carries the DI-002 interactive per-profile goal toggle whose
  orange button represents the _selectable alternative_ (inverted active optic).
- `GoalsScreen.tsx` carries the GE-008 „Ziel wählen" card that sets the same active profile
  via `container.setActiveProfileId`. Two mutable surfaces own one state (see
  `docs/MANUAL_TESTING_GAPS.md` DI-002/GE-008/DI-009).

**Exact scope / affected files:**

- `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — remove the
  interactive goal toggle and the inverted active/selectable optic; show a clear German
  active-goal label read-only; add a small „Ziel ändern" action that navigates to the Ziele
  tab (targeted navigation only). Preserve the existing DI-009 focus-reload so the goal set in
  Ziele reflects immediately.
- `src/presentation/features/goals/GoalsScreen.tsx` — remains the single editing surface
  (GE-008 card unchanged); ensure „Bewertungsziel" vs. „Makroverteilung" wording is clearly
  distinguished.
- Navigation: reuse existing tab navigation for „Ziel ändern"; no navigation redesign.

**Risks:** removing the only writer that some users relied on (mitigate: GE-008 card is the
retained writer); breaking DI-009 refresh; conflating macro modes with the evaluation goal in
wording; accessibility/touch-target of the new read-only label + link.

**Tests:** switch goal in Ziele → Auswertung refreshes on focus; restart preserves the goal;
no second mutable state; both evaluation profiles; all macro modes remain independently
selectable; accessibility labels + touch target of „Ziel ändern".

**Akzeptanzkriterien (DoD):** no second goal toggle in Auswertung; no inverted active optic;
exactly one persisted source for the active goal; Ziele/Auswertung/restart show the same
state; macro modes remain a separate Makroverteilung concept; existing same-day re-evaluation
preserved; `npm run verify` green.

**Out of scope:** evaluation-rule changes, macro-mode logic, navigation redesign beyond the
targeted link.

**Verify:** `npm run verify` (Category 4) + `docs/MANUAL_TESTING_GAPS.md` entry unless
live-verified.

---

## EPIC: Account, Backup & Sync (Architecture) — Deferred

Review-only architecture planning, **lowest priority**, to be planned separately after the
blocker and high/medium findings. Zera stays local-first: no login is required for initial
use, and login alone does not synchronize existing local data.

#### ACC-001: Local-First Account / Backup / Sync Boundary (review-only architecture)

Status: `todo`
Severity: Deferred (architecture planning)
Mode: **review-only planning — no product code, no migration, no dependency change.**
Depends on: none (explicitly sequenced last).
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 10.

**Ziel:** Produce an ADR/plan (under `plans/`) that defines the local-first account/backup/
sync boundary. Accepted product stance: Zera works local-first without an account;
Google/Apple login via Supabase Auth comes later and is optional, for backup and cross-device
use — it is not required for the local core and does not by itself sync existing local data.

**Current state (context):** body data, goals, templates and journal are all local
(AsyncStorage/local persistence). There is a Supabase client for resolver/edge use only; no
user-account or sync layer for app data exists.

**The plan must decide:** which data is synchronized; migration of local data on first login;
logout behavior; two-device conflict resolution; soft-delete + correction-log sync semantics;
privacy, deletion and export; anonymous local ID vs. Supabase user ID; Google-on-Android /
Apple-on-iOS provider boundaries; offline behavior/queueing; restore after reinstall; staging
and migration sequence.

**Do NOT:** implement auth/sync; add dependencies; change persistence; create Supabase tables;
touch product code.

**Deliverable:** an ADR/plan document under `plans/` (e.g.
`plans/ACCOUNT_BACKUP_SYNC_ARCHITECTURE_PLAN.md`) with explicit decision points, a recommended
staging sequence, and follow-up Act task stubs — none implemented here.

**Akzeptanzkriterien (DoD):** every decision point above is addressed or has an explicit open
question with a recommendation; local-first-without-account remains the stated default;
documentation-only; no code/migration/dependency change.

**Verify:** VERIFY.md **Category 1** (documentation-only) readback checks.

---

## EPIC: Product Readiness

### PR-001: Remove Disconnected Mock Tabs Before External Testing

Status: `done`
Depends on: none

**Ziel:** A review-only Product Readiness Audit (2026-07-15, live against `expo start --web` +
Playwright, screenshots) found that the "Ernährung" and "Erholung" tabs are the one thing in the
current MVP capable of actively damaging a first external user test. Both are backed entirely by
`MockNutritionRepository`/`MockRecoveryRepository` — fixed, hardcoded data with **zero**
connection to anything the user actually logs. Confirmed live: at the exact moment "Protokoll"
correctly showed 296 kcal (2 eggs + 200g quark, just logged) and "Auswertung" correctly showed
the same 296 kcal against the real goal, "Ernährung" simultaneously showed a fixed 1310 kcal
across three invented meals ("Frühstück 08:00 – 460 kcal", "Mittagessen 12:30 – 640 kcal",
"Abendessen 19:00 – 210 kcal") that never change regardless of what's logged — even on a brand
-new, zero-entries account. "Erholung" is the same pattern (fixed sleep/steps/heart-rate numbers).
Both screens also use an entirely different visual design system (raw hex colors, white
drop-shadow cards) from the rest of the app (`tokens`/`AppText`/`ScreenContainer`), making the
inconsistency visible even before a user reads the numbers. A tester seeing two contradictory
calorie totals for the same day, in the same app, will reasonably distrust the whole product, not
just these two tabs — this is a sharper risk than an merely "unfinished-looking" screen.

**Product decision (already made by the user, not open for re-litigation in Act):** remove the
two tabs from navigation entirely — not label them "Demo-Daten"/"Bald verfügbar", and not build
out Health Sync now to make them real. The four remaining tabs (Protokoll → Ziele → Vorlagen →
Auswertung) already form a complete, coherent product loop; "Erholung" isn't part of that loop
today, and "Ernährung" semantically duplicates Protokoll/Auswertung without sharing their data.
Health Sync (platform/permissions/privacy/device dependencies) is explicitly deferred until the
already-working core is validated with real users — it remains tracked, unscoped, under "Tier 4
Planning Targets".

**Inventory (from this planning task, confirmed by repo-wide grep — not to be re-derived during
Act):**

- **Exactly one file needs to change:** `src/presentation/navigation/AppNavigator.tsx`. It is the
  _only_ place in `src/` that imports `NutritionScreen`/`RecoveryScreen` or references the
  `Nutrition`/`Recovery` route names — specifically: the two component imports; the two
  `Nutrition: undefined` / `Recovery: undefined` entries in the exported `RootTabParamList` type;
  the two `else if (route.name === 'Nutrition'/'Recovery')` branches in the tab-bar icon
  resolver; and the two `<Tab.Screen name="Nutrition"/"Recovery" .../>` registrations.
  `initialRouteName="Journal"` is already correct (maps to the "Protokoll" tab) and needs no
  change.
- `src/presentation/App.tsx` imports `AppNavigator` as a whole and needs no change — it never
  references individual tabs.
- **Zero test files** reference `AppNavigator`, `RootTabParamList`, `NutritionScreen`,
  `RecoveryScreen`, or the German tab labels "Ernährung"/"Erholung" anywhere in `src/` (grep
  confirmed) — same class of finding as `DI-005`'s prior Dashboard-tab removal ("keine
  dedizierten Dashboard-Tests vorhanden"). No test updates anticipated, but the Act task should
  re-confirm this before finishing, not just trust this planning-time grep.
- `container.ts` wires `getNutritionSummary`/`getRecoverySummary` (consumed only by the two
  screens being unlinked) and stays untouched — the screens, use cases
  (`GetNutritionSummary.ts`/`GetRecoverySummary.ts`), and mock repositories
  (`MockNutritionRepository.ts`/`MockRecoveryRepository.ts`) all remain in the repo, fully
  intact, just unreachable from the tab bar. Nothing here is deleted.

**Explicitly out of scope:**

- Deleting `NutritionScreen.tsx`, `RecoveryScreen.tsx`, their use cases, mock repositories, or
  their `container.ts` wiring — all stay, unreferenced-but-intact, so this is reversible later
  without reconstructing anything.
- Any Health Sync planning or scoping.
- Any change to tab order, icons, or navigation structure beyond removing these two entries.
- Any redesign of the four remaining screens.
- Labeling the tabs as "Demo-Daten"/"Bald verfügbar" instead of removing them — an explicitly
  rejected alternative, not a fallback if removal turns out harder than expected.

**Akzeptanzkriterien (DoD):**

1. The tab bar shows exactly `Protokoll`, `Ziele`, `Vorlagen`, `Auswertung`.
2. `Ernährung` and `Erholung` are unreachable via normal navigation.
3. The app still starts on `Protokoll`.
4. The four remaining tabs keep their existing data and behavior unchanged.
5. No mock value is ever presented to a user as real day data anymore.
6. Navigation types (`RootTabParamList`) and any affected tests are cleanly updated.
7. `npm run verify` passes clean.
8. A real cold start and all four remaining tabs are visually re-verified afterward (Expo or
   `expo start --web` + Playwright, mirroring this audit's method).

**Verify:** `npm run verify`; live re-verification per DoD item 8, logged in
`docs/MANUAL_TESTING_GAPS.md`.

**Implementation notes:** Exactly the file the planning inventory identified —
`src/presentation/navigation/AppNavigator.tsx` — was changed, and it was the only file changed:
the `NutritionScreen`/`RecoveryScreen` imports, the `Nutrition: undefined`/`Recovery: undefined`
entries in `RootTabParamList`, the two tab-bar-icon `else if` branches, and the two `<Tab.Screen>`
registrations were removed. `initialRouteName="Journal"` was left untouched (already correct).
No other file needed a change — `App.tsx` only imports `AppNavigator` as a whole, and (as the
planning-time grep predicted) no test anywhere references `AppNavigator`, `RootTabParamList`,
`NutritionScreen`, or `RecoveryScreen`; the full suite stayed at 113 suites / 854 tests,
unchanged, confirming no coverage was lost. `NutritionScreen.tsx`, `RecoveryScreen.tsx`, their
use cases, `container.ts`'s wiring for them, and both mock repositories are untouched and still
present — orphaned from the tab bar, not deleted, exactly as scoped.

**Verification results:** `npm run verify` passes clean (typecheck, lint, format, full suite).
Live re-verification against `expo start --web` + headless Playwright/Chromium (mirroring the
original audit's method): cold start lands on "Protokoll"; the tab bar shows exactly four tabs
(Protokoll, Ziele, Vorlagen, Auswertung); a full-page text scan confirms **zero** occurrences of
"Ernährung" or "Erholung" anywhere in the DOM (not merely hidden — the routes no longer exist);
all four remaining tabs were visited and function correctly (Ziele's "Ziel wählen" card and
Metabolismus-Profil form, Vorlagen's empty-state, Auswertung's "Ziele festlegen" prompt, back to
Protokoll's empty Journal state — all rendering as before this change). Zero browser
console/runtime errors throughout.

---

### NATIVE-001: Android Standalone Build Crashes on Cold Start

Status: `in_progress` (code fix landed + web-verified; new build with configured env vars and
a real-device cold-start check by the maintainer are still pending — this task is not done
until that cold start succeeds)
Severity: **Blocker** — blocks UT-001 Phase B (dogfooding) and every further native test
Depends on: none
Full diagnosis: [`reports/NATIVE-001_ANDROID_COLDSTART_CRASH_DIAGNOSIS.md`](reports/NATIVE-001_ANDROID_COLDSTART_CRASH_DIAGNOSIS.md)

**Observed:** The installed Android standalone build (predating PR #45) closes immediately on
every launch; Samsung shows "Zera geschlossen, da diese App einen Fehler enthält." Clearing the
app cache does not help. The app never reaches its first frame.

**Root cause (mechanism proven by code inspection + live reproduction):**
`src/infrastructure/supabase/supabaseClient.ts` threw at **module scope** when
`EXPO_PUBLIC_SUPABASE_URL`/`EXPO_PUBLIC_SUPABASE_ANON_KEY` were absent. That module sits on the
unconditional boot path (`container.ts` imports it; the container singleton is constructed at
module scope; `presentation/App.tsx` imports the container) — so the throw happens during JS
bundle evaluation, before React renders anything. In a release build there is no dev overlay:
the unhandled exception aborts the process, which is exactly the observed instant close.
Reproduced live in this repo (Expo Web started **without** `.env`): zero rendered frames, empty
DOM, single page error `Missing EXPO_PUBLIC_SUPABASE_URL`. Cache-clearing can never fix it
because `EXPO_PUBLIC_*` values are inlined into the bundle at **build time**.

**Trigger (very likely; final confirmation via device evidence):** the build was produced
without these env vars in its build environment. `.env` is gitignored (never part of a remote
EAS build's upload), the repo contains no `eas.json` and no `env`/`extra` block in `app.json`,
and no EAS environment variables are documented anywhere. The one alternative hypothesis
(a native-side init failure, e.g. New-Architecture/library issue) is ranked far lower — every
dependency is a standard Expo SDK 54 library — and is distinguishable in one step: `adb logcat`
containing `Missing EXPO_PUBLIC_SUPABASE_URL` (or the next successful cold start after building
with vars set) confirms H1; a native stack without that message would reopen H2.

**Fix (smallest safe change, landed on `claude/app-testing-evaluation-yogpjt`):**

- `supabaseClient.ts`: module-scope `throw` replaced by an exported
  `supabaseConfigError: string | null` (validation extracted into pure, unit-tested
  `validateSupabaseConfig()`). When config is missing, the client is created with a syntactically
  valid placeholder so module evaluation and DI-container construction stay crash-free — the
  client is unreachable in that state because:
- `presentation/App.tsx` checks `supabaseConfigError` before rendering the navigator and shows a
  blocking "Konfigurationsfehler" screen naming the offending variable instead.
- New `src/infrastructure/supabase/__tests__/validateSupabaseConfig.test.ts` (6 tests).
- Rewritten `src/infrastructure/supabase/__tests__/supabaseClient.test.ts`: the pre-existing
  P2-001 suite asserted that _importing the module throws_ on missing config — i.e. it
  codified exactly the crash mechanism this task removes. It now asserts the new invariant:
  importing never throws; `supabaseConfigError` names the offending variable; valid config
  yields `null`.
- **P2-001 note:** P2-001 ("App throws fatal error on boot if variables are missing") is
  deliberately preserved in intent and changed in mechanism: the app still strictly verifies at
  boot and is completely unusable on bad config — but it now fails **visibly and diagnosably**
  instead of dying before the first frame. This is an explicit, documented adjustment, not a
  silent reversal.

**Verified (this environment):** without `.env`, Expo Web previously rendered nothing and threw
(`Missing EXPO_PUBLIC_SUPABASE_URL`); after the fix the blocking Konfigurationsfehler screen
renders with the variable named and zero uncaught errors. With `.env` present, normal boot is
unchanged (four tabs, zero page errors). `npm run verify` green. Native rendering of the new
screen is logged as open in `docs/MANUAL_TESTING_GAPS.md`.

**Follow-up (same task, 2026-07-16):** the maintainer's first attempt to produce the new build
via expo.dev's "Start a build from GitHub" failed with `Failed to read "/eas.json"` — the repo
contained no `eas.json`, and the maintainer has no computer available to run
`eas build:configure` locally. A minimal root `eas.json` was therefore added (explicitly
authorized): single `preview` build profile with `distribution: internal`,
`environment: preview` (so the `EXPO_PUBLIC_SUPABASE_*` variables stored in the EAS _preview_
environment are injected at build time), `android.buildType: apk` (directly installable),
`android.image: latest` (per Expo's GitHub-builds guidance), plus
`cli.appVersionSource: remote`. No env values/credentials committed; validated with the
official `@expo/eas-json` parser (profile resolves with `credentialsSource: "remote"`, so the
Android signing credentials stored from the previous EAS build are reused).

**Follow-up 2 (same task, 2026-07-17):** as anticipated, the GitHub build then failed at
"Resolve build configuration" with `EAS project not configured. Must configure EAS project by
running 'eas init' before this command can be run in non-interactive mode.` /
`The "extra.eas.projectId" field is missing from your app config` — confirmed non-blocking to
diagnose: `git log --all -- app.json` found an existing, unmerged commit
(`4acb3cb`, branch `claude/apk-file-request-5nbry4`, a parallel prior session that ran `eas init`
for real, then never opened a PR) that had already linked this exact project — real
`owner: "m4xxx"` and `extra.eas.projectId: "3e6cd267-1b2c-4bb6-97e9-68fa150952ea"` for the
`health-dashboard` slug seen throughout this task's expo.dev screenshots. Added both fields to
`app.json` from that authoritative source instead of asking the maintainer to hunt for the ID a
second time (the mobile dashboard's Project Settings page didn't surface it for them). That
same abandoned commit's `eas.json` was deliberately **not** adopted wholesale — it predates and
lacks the `environment: "preview"` field this task's own `eas.json` added, which is exactly what
makes the `EXPO_PUBLIC_SUPABASE_*` variables available at build time (the original NATIVE-001
root cause); reverting to the older shape would silently reintroduce it. Per the
Git-Branch-Sync-After-Push incident precedent in `AGENTS.md`, the orphaned branch itself was left
untouched (no open PR exists for it, so no reconciliation conflict; nothing here justifies
deleting someone else's unmerged work). Verified: `app.json` parses; `npx expo config --json`
resolves `owner: "m4xxx"`, `extra.eas.projectId: "3e6cd267-1b2c-4bb6-97e9-68fa150952ea"`,
`slug: "health-dashboard"` — matching the account/project seen in the maintainer's screenshots.

**Remaining DoD (maintainer, on device):**

1. Configure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` for the EAS
   environment/build profile actually used (EAS dashboard → project → Environment variables, or
   `eas env:create`; alternatively the `env` block of the build profile in a local `eas.json`).
   Values must be present **at build time** — a code fix alone cannot substitute for this.
   _(Done per maintainer 2026-07-16: publishable key + URL stored on expo.dev.)_
2. Produce a **new build** (mandatory — the installed binary has the missing values baked in),
   uninstall the old app completely, install the new build.
3. Cold-start check only, per the UT-001 plan's staging: app must reach the Protokoll tab.
   Only then continue the native test list.
4. Optional but decisive if anything still fails: capture `adb logcat` and search for
   `FATAL EXCEPTION|AndroidRuntime|Missing EXPO_PUBLIC` — the diagnosis report contains the
   exact commands.

**Follow-up 3 (same task, 2026-07-17):** the first GitHub build reached the "Run expo doctor"
step (an advisory, non-fatal step — yellow warning, not the red failures of earlier follow-ups)
and flagged one patch-version mismatch: `expo` installed at `54.0.35`, SDK 54 expects `~54.0.36`.
Non-blocking (the build continued), but worth fixing since it's exactly the kind of drift
`expo-doctor` exists to catch before it becomes a real incompatibility. Fixed with
`npm install expo@~54.0.36` (`--ignore-scripts` locally, same `supabase` package postinstall
block documented in `WEB-001`); diff is purely `expo` + its own transitive dependency tree, all
patch-level — nothing unrelated touched. `npx expo-doctor`: 18/18 checks now pass (was 17/18).
`npm run verify` green.

**Also confirmed working (maintainer, on device, 2026-07-17):** the GitHub-triggered build
succeeded and the app **booted** — no native crash. It landed on this task's own
"Konfigurationsfehler" screen instead, naming `EXPO_PUBLIC_SUPABASE_ANON_KEY` as missing (the
maintainer's EAS environment variable was still named `SUPABASE_PUBLISHABLE...`, not the exact
`EXPO_PUBLIC_SUPABASE_ANON_KEY` the app reads). This is the strongest possible confirmation of
this task's core fix: a build with genuinely incomplete configuration now fails **visibly and
diagnosably** instead of crashing before the first frame.

**Verify:** `npm run verify` (done, green); real-device cold start per DoD above — **first EAS
build confirmed the crash is gone** (config screen renders correctly instead); the actual
"reaches Protokoll tab" cold start is pending the maintainer's next build with a correctly named
`EXPO_PUBLIC_SUPABASE_ANON_KEY`.

---

### UT-001: Practical MVP Validation

Status: `todo`
Depends on: PR-001 (a coherent four-tab surface must exist first)

**Ziel:** Now that `PR-001` reduced the MVP to four coherent tabs (Protokoll → Ziele → Vorlagen
→ Auswertung), validate whether the core loop is technically stable and understandable in real
daily use and to at least one person unfamiliar with the product — before any further product
development. This entry is planning only; no test has been run yet, no code changes.

**Revision note:** the original version of this task assumed five recruited external testers
with a fixed study protocol — that didn't match the actual situation (a single developer, one
Android device, one willing partner on iPhone, and Claude with no real device/emulator access).
Revised into a staged, practical validation instead; see the plan doc for the full reasoning.

**Full test protocol:** see
[`plans/UT-001_PRACTICAL_MVP_VALIDATION_PLAN.md`](../plans/UT-001_PRACTICAL_MVP_VALIDATION_PLAN.md)
— four phases: **A0** (Claude's one-time full technical baseline, via `expo start --web` +
Playwright — no real native emulator is available, honestly noted as such), **B** (the developer's
real multi-day dogfooding on Android, the main information source), **A1** (targeted, repeatable
but narrowly-scoped technical reproduction of specific findings from `B` — never a full re-audit),
and **C** (a single, informal session with an independent tester on iPhone, only after `A0` and
known blockers from `B` are resolved). Also covers the reset procedure (still needed before `A0`
and `C`, not between every dogfooding moment), the change-during-B policy (Blocker findings may
be fixed immediately; smaller findings are batched), the four-tier severity scale, and how
findings get documented and turned into new `ROADMAP.md` task IDs before fix work starts —
mirroring the `DI-009` pattern.

**Akzeptanzkriterien (DoD) for running the validation (a later, separate step):**

- `A0` run once, completely, before `B` begins; findings logged per
  `docs/MANUAL_TESTING_GAPS.md` convention.
- `B` observations captured as they occur (input/expected/actual/result/problem
  type/frequency), not reconstructed afterward.
- Any `A1` reproduction stays scoped to the single reported finding, never a full re-audit.
- `C` only happens after `A0` is done and known `B` blockers are fixed.
- Findings synthesized in a new `docs/USABILITY_TEST_RESULTS_UT-001.md` after `B` and `C`.
- Every Blocker/Hoch finding gets its own `ROADMAP.md` task ID before being worked on (acute
  blockers found during `B`/`A1` may be fixed immediately per the plan's change policy).

**Verify:** n/a for this planning entry (Category 1, Documentation-only, per `VERIFY.md`).

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

## EPIC: Developer Tooling & Verification

#### WEB-001: Restore Reproducible Expo Web Runtime

Status: `done`
Depends on: none (infra/tooling fix, independent of DI-xxx product work)

**Ziel:** `npm run web` (`expo start --web`) must boot successfully on a clean `npm ci`, so
UI changes (starting with the DI-007 manual-testing gap, see
[`docs/MANUAL_TESTING_GAPS.md`](../docs/MANUAL_TESTING_GAPS.md)) can be visually verified in a
browser, and Web becomes usable as an internal Playwright/headless-agent verification path.

**Problem (empirically confirmed 2026-07-15):**

- `npm run web` fails on a clean checkout with `CommandError: ... don't have the required
dependencies installed. Install react-dom@19.1.0, react-native-web@~0.21.0`.
- Confirmed via repo-wide search: none of `react-dom`, `react-native-web`,
  `@expo/metro-runtime` exist anywhere under `node_modules/`; `package.json` has no
  `workspaces` field to explain hoisting from elsewhere.
- `npx expo config --json` resolves `"platforms": ["ios","android"]` — Expo silently drops
  `web` from the effective platform list because the runtime deps are missing, even though
  `app.json` configures `expo.web.favicon` and `package.json` defines the `web` script
  (`expo start --web`), and `README.md` documents pressing `w` to launch it.
- No code-level blocker found: no `NativeModules`/`requireNativeComponent`/`expo-dev-client`
  usage under `src/`, no custom `metro.config.js` in the project root, `App.tsx`/`index.ts`
  are minimal and platform-agnostic.
- Expo SDK resolved as `54.0.0` (`expo@~54.0.35`).
- This is a genuine, reproducible repository defect — a clean `npm ci` fails identically on
  any machine — not a sandbox-specific artifact. (A separate, unrelated failure mode was also
  hit during investigation: `expo start`'s online version-check fails against this sandbox's
  network proxy; that part is environment-specific and bypassable with `--offline`, and is not
  part of this task's problem statement.)

**Scope / betroffene Dateien:**

- `package.json` / `package-lock.json`: add `react-dom@19.1.0`, `react-native-web@~0.21.0` via
  `npx expo install react-dom react-native-web` (the Expo-aware installer, so versions stay
  SDK-compatible rather than manually chosen).
- Re-check afterward whether `expo start --web` still requests `@expo/metro-runtime` — Expo's
  own dependency check did not flag it as missing for SDK 54 (unlike some other SDK web
  guides), so whether it's actually needed must be verified empirically after the first two
  packages land, not assumed either way.
- No other file changes anticipated. If `expo start --web` surfaces further missing
  dependencies or config issues after this install, that is new information to be handled
  within this same task, not a silent scope expansion into unrelated work.

**Risiken:**

- Dependency-change tasks carry more blast radius than doc/UI-only tasks: a lockfile diff
  touching unrelated transitive versions would be a red flag and must be caught in review
  before merge, not after.
- `react-native-web` shims some RN primitives; this task only proves the app _boots_ on web,
  it does not audit every screen for web-specific rendering bugs (native modules, gestures,
  platform-specific styling) — that risk is explicitly deferred to whatever UI work is
  actually verified through this runtime afterward (e.g. DI-007), not solved here.
- Whether Web becomes an officially supported Zera platform or stays an internal
  verification-only tool is a separate, still-open product/tooling decision this task does not
  resolve — this task only restores the ability to boot the app on web, it does not commit to
  a support policy.

**Explicitly out of scope:**

- Any decision to make Web an officially supported Zera platform vs. an internal
  verification-only tool.
- Any UI/UX changes, any DI-xxx work, any CI workflow changes.
- Deploying or hosting a web build anywhere.
- Auditing individual screens for web-specific rendering correctness beyond "the app boots".

**Tests:** none new (pure dependency-restoration task); `npm run verify` must stay green.

**Akzeptanzkriterien (DoD):**

- `npm run web` starts without a dependency-related `CommandError` on a clean install.
- `npx expo config --json` includes `"web"` in the resolved `platforms` array.
- `npm run verify` passes.
- No unrelated dependency drift — lockfile diff limited to the newly added packages and their
  own transitive dependencies.

**Verify:** per `VERIFY.md`'s Dependency-change category: full `npm run verify` plus a manual
boot check (`npm run web`, confirm it serves without the `CommandError` seen above).

**Implementation notes:** Installed via `npx expo install react-dom react-native-web`, which
resolved the exact versions Expo itself requested — `react-dom@19.1.0`,
`react-native-web@~0.21.0`. Two invocation flags were needed beyond the plain command, neither
touching app code or expanding scope: `EXPO_OFFLINE=1` (the sandbox blocks Expo's online
version-check API, same class of issue as previously documented `expo start` network blocks)
and `-- --ignore-scripts` (the sandbox blocks the pre-existing `supabase` package's postinstall
CLI-binary download, same root cause as CI-A's `--ignore-scripts` choice and the P2-003/P2-007
verification-gap notes — unrelated to the two new packages). `@expo/metro-runtime` turned out
not to be needed for SDK 54. `package-lock.json`'s diff is purely additive (196 insertions):
only the two new packages and their own transitive deps (`cross-fetch`, `fbjs`, `styleq`,
`inline-style-prefixer`, `whatwg-url`, etc.) — no pre-existing package version changed.

**Verification results:**

- `npm run verify` passed clean: typecheck, lint, format:check, and the full suite (113 suites /
  854 tests — unchanged count, no regression).
- `npm run web` starts successfully with no dependency-related `CommandError`.
- `npx expo config --json` now resolves `"platforms": ["ios","android","web"]` (previously
  silently dropped `web`).
- DI-007's manual-testing gap was visually verified in this same session using a headless
  Playwright/Chromium session against the running `expo start --web` server: insights/
  recommendations sections render only when non-empty, correct section order (Bewertung →
  Fortschritt → Einordnung → Empfehlungen → Hinweise), a real over-calorie warning was triggered
  (via the Journal's offline BLS-backed resolver) and confirmed `Hinweise` stays visible and not
  buried, switching between Evidence-based Standard and Weight Loss produced visibly different
  insight/recommendation text, long text wraps cleanly with no truncation after scrolling the
  screen to its actual bottom, no internal architecture vocabulary leaked into the UI, and zero
  browser console errors throughout. See `docs/MANUAL_TESTING_GAPS.md`'s DI-007 entry for the
  human sign-off step on flipping that status.

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

#### RESOLVER-V2-008: Generic-Food Resolver Trust Diagnosis (review-only)

Status: `done`
Severity: High
Mode: **review-only diagnosis — no resolver code change.** Any fix is a separate task created
only after the root cause is proven.
Depends on: none. Keeps RESOLVER-V2-005/006 deferred; does not implement them.
Origin: native dogfooding 2026-07-17,
[report](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md) Finding 2.

**Diagnosis result (done):** full BLS trace in
[`reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md`](../reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md).
BLS is the winning source for all four inputs (each native kcal maps exactly to a committed BLS
record). Verdicts:

- **Himbeeren → 275 kcal** = `D3A4000` „Nussbiskuitrolle … mit Himbeeren und Sahne" (dessert).
  **Wrong variant**; the plain „Himbeere roh" (`F302100`, 43) was never in the candidate set.
- **Haferflocken → 102 kcal** = `X475243` „Milchsuppe … mit Haferflocken" (milk soup).
  **Wrong variant**; the plain „Hafer Flocken" (`C133000`, 348) was never in the candidate set.
- **Speck → 746 kcal** = `W412000` raw back fat. **Ambiguity** (legitimate BLS „Speck", but not
  the commonly-intended bacon); needs a product decision, not a data fix.
- **Magerquark → 66 kcal** = `M713100` exact match. **Correct** despite a surprising value; no
  change.

**Proven root cause (Himbeeren + Haferflocken, one shared mechanism):** the plain generic food
is **unreachable**, so no ranking could pick it — (a) the plain record's only aliases are the
singular/space displayName forms (`himbeere roh`, `hafer flocken`) which the compact
plural/one-word query is not a substring of, and (b) `BlsLookupEngine.search` early-returns a
weaker `includes` match (0.7, on processed/compound records that literally contain the query
substring) at Stage 2/3, short-circuiting before Stage 4 token matching that would surface the
plain food (score 0.8). Follow-ups registered below: **RESOLVER-V2-009** (proven fix) and
**RESOLVER-V2-010** (Speck ambiguity, planning first). Magerquark: no task.

**Ziel:** Prove why generic-food inputs resolve to implausible records before any fix.
Reproduced native cases: `100 g Himbeeren → 275 kcal`, `100 g Haferflocken → 102 kcal`,
`100 g Speck → 746 kcal`, `100 g Magerquark → 66 kcal` (at least raspberries and oat flakes
look wrong).

**For each of the four inputs, trace and document:** parser output; normalized query +
tokens; source adapters queried; every relevant candidate; source ID / BLS code; canonical DE

- EN names; per-100 g macros; match score + reason; fusion/ranking outcome; final selected
  record; persisted `foodCatalogRef` + `nutritionSnapshot`.

**Determine:** whether the values come from the source artifact correctly; whether the wrong
variant is selected; whether aliases are too broad; whether token matching / fusion ranking
loses important qualifiers; whether a generic term should resolve directly or require
disambiguation; whether source precedence causes the mismatch.

**Files to read (review-only):**
`src/features/nutrition/application/services/` (`FoodCatalogResolver.ts`,
`DefaultFoodCatalogResolver.ts`, `FusionCandidateResolver.ts`, `ResolverDecisionPolicy.ts`,
`ResolverDebugTypes.ts`), the source adapters under
`src/features/nutrition/infrastructure/catalog/sources/` (BLS compact runtime adapter, OFF,
USDA), the committed BLS artifact/manifest, and the resolver-v2 tests/docs.

**Do NOT:** hardcode replacement calorie values; add speculative aliases; create a corrections
table; implement RESOLVER-V2-005/006; change source priority without evidence; modify product
code.

**Deliverable:** a focused diagnosis report under `reports/` with a proven root cause (or
ranked, evidence-backed hypotheses), the smallest safe fix proposal, exact affected files +
tests, and a clear decision per input (deterministic match / disambiguation / honest
unresolved state). A separate implementation task is opened only when the root cause is
sufficiently proven.

**Akzeptanzkriterien (DoD):** all four inputs fully traced with the fields above; root cause
proven or hypotheses ranked with evidence; per-input decision stated; no product-code change;
documentation-only verification.

**Verify:** VERIFY.md **Category 1** (documentation-only) readback checks. Optional resolver
test runs are read-only (`npm run test -- --testPathPattern="resolver|Resolver"`).

---

#### RESOLVER-V2-009: Plain-Generic BLS Food Reachability (Himbeeren / Haferflocken)

Status: `done`
Severity: High
Depends on: RESOLVER-V2-008 (diagnosis, `done`). Independently scoped; does not touch
RESOLVER-V2-005/006.
Origin: RESOLVER-V2-008 diagnosis —

**Implementation notes (done):** the fix is entirely in
`src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts` — three general
normalization/ranking rules, no per-food overrides, no artifact/value/source-order change:

1. **Whitespace-insensitive exact match** — the exact stage now also compares space-collapsed
   forms, so a one-word query (`haferflocken`) exact-matches a multi-word BLS name
   (`Hafer Flocken`). Fixes Haferflocken → `C133000` (348) as an exact match.
2. **Exact-match ordering** — when several records match exactly (e.g. `Hafer Flocken` vs. the
   comma-split `Hafer Flocken, gekocht`), the plain whole-name record without a processed
   qualifier wins deterministically, so `C133000` (348, raw) beats `C133032` (66, cooked).
3. **Stage-2 token-over-includes override** — for a single long token, a weak `includes` match
   (0.7, on a processed/compound record that merely contains the query word) no longer
   short-circuits before token matching; a stronger ranked token match wins. The ranking is
   fold-aware recall (light German plural fold) + a head-noun-match bonus − a
   processed-qualifier penalty, ties broken by fewer content tokens. This surfaces
   `F302100` „Himbeere roh" (43) over the dessert `D3A4000` (275). **Scoped to the
   single-long-token branch only, so Stage 4 — e.g. „Speck" — is byte-for-byte unchanged.**

**Verification (done):** `npm run verify` green (117 suites / 937 tests, +11). New
`BlsPlainGenericReachability.test.ts` asserts, both at the BLS-candidate level and **end-to-end
through `SequentialFoodCatalogResolver` + `DefaultConfidenceEngine`**: `himbeeren →
F302100 (43)` and `haferflocken → C133000 (348)`; singular `himbeere` unchanged; spaced
`hafer flocken` also resolves; the dessert `D3A4000` is no longer top; deterministic, no
duplicate candidates; **Magerquark unchanged** (`M713100`, 66, exactly one match); **Speck
unchanged** (same candidate list `[U605700, W412000, W411000]` and same end-to-end selection
`W412000`, 746); the `quarktoast → []` compound guard preserved. Full resolver regression suite
(22 suites / 177 tests) green. Change is infra-only (no presentation/UI file) — see
`docs/MANUAL_TESTING_GAPS.md` for the recommended native trust spot-check of the three foods.

Origin: RESOLVER-V2-008 diagnosis —
[`reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md`](../reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md)
§3.1/§4.1.

**Ziel:** A plain generic query resolves to the plain BLS food, not a processed/compound
variant that merely contains the word. Proven cases: `himbeeren → "Himbeere roh" (F302100,
43 kcal)` not `D3A4000` (275, dessert); `haferflocken → "Hafer Flocken" (C133000, 348 kcal)`
not `X475243` (102, milk soup).

**Proven root cause (see diagnosis):** the plain record is unreachable because (a) its only
aliases are singular/space displayName forms (`himbeere roh`, `hafer flocken`) that the compact
plural/one-word query is not a substring of, and (b) `BlsLookupEngine.search` early-returns a
weaker `includes` match (0.7 on processed records literally containing the query substring)
before Stage 4 token matching that would surface the plain food (0.8).

**Exact scope / affected files:**

- `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts` — the fix is
  in matching/stage logic. Smallest safe options (evidence-gated; the first is preferred):
  whitespace-insensitive comparison (space-collapsed query vs. alias, so `hafer flocken` ↔
  `haferflocken`); do not let a weaker `includes` match pre-empt a stronger `token` match
  (compute/merge token matches instead of early-returning `includes`); a deterministic
  qualifier penalty for processed/compound displayNames (`gezuckert`, `getrocknet`,
  `-plätzchen`, `suppe`, `kompott`, `eis`, `mit … Sahne`, …) so a plain entry outranks a
  dessert/soup; optional German singular/plural fold. **All normalization rules — no per-food
  aliases, no artifact edit.**
- Possibly `BlsCompactRuntimeAdapter.ts` — only to keep alias/token normalization symmetric
  with the query normalization. **No** artifact edit, **no** source-precedence change.

**Risks:** over-broadening matches (mitigate: evidence-gated, assert candidate-set + score
before/after); regressing the correct exact/shortcut cases (`magerquark → M713100 (66)`,
`buttertoast`, `ei`); accidentally making a genuinely ambiguous term resolve too confidently
(keep Speck out of scope — RESOLVER-V2-010).

**Tests:** new `BlsLookupEngine` cases — `himbeeren → F302100 (43)` and `haferflocken →
C133000 (348)` outrank the processed variants; `magerquark → M713100 (66)` unchanged; existing
exact/shortcut/token behavior unchanged; existing resolver suites
(`--testPathPattern="resolver|Resolver|Bls"`) green.

**Akzeptanzkriterien (DoD):** the two proven cases resolve to the plain food with correct
macros; no hardcoded calories, no speculative per-food aliases, no artifact edit, no
source-precedence change; Magerquark and existing exact/shortcut cases unchanged; `npm run
verify` green.

**Out of scope:** Speck ambiguity (RESOLVER-V2-010), OFF/USDA changes, corrections table,
RESOLVER-V2-005/006, nutrition-value edits.

**Verify:** `npm run verify` (Category 4). Not UI-facing (resolver/infra) — gap-log only if a
presentation file is touched.

---

#### RESOLVER-V2-010: Ambiguous Generic Term „Speck" — Disambiguation Decision (planning first)

Status: `todo`
Severity: Medium
Mode: **planning/decision first — no resolver code change until the product decision is made.**
Depends on: RESOLVER-V2-008 (diagnosis, `done`).
Origin: RESOLVER-V2-008 diagnosis §3.2/§4.2.

**Ziel:** Decide how a bare, genuinely ambiguous generic term resolves. Evidence: `speck` →
`W412000` raw back fat (746 kcal) wins by token score 1.0 over bacon variants
(`Frühstücksspeck`/`Bauchspeck`, ~304 kcal, partial score 0.8). All candidates are legitimate
BLS „Speck" records with correct macros — this is **ambiguity, not a data or code defect**.

**The plan must decide** whether a bare „Speck" should (a) resolve deterministically to a chosen
canonical variant (e.g. bacon), (b) trigger honest disambiguation („Welchen Speck?"), or (c)
remain an honest low-confidence result — and whether this generalizes to other ambiguous German
generics.

**Do NOT:** hardcode a calorie value; add a speculative alias; change source precedence;
implement before the decision.

**Akzeptanzkriterien (DoD):** a documented product decision with the chosen behavior, its
generalization boundary, affected files/tests for a later Act task, and an explicit statement
that no source-data defect exists. Documentation-only until an Act task is split out.

**Verify:** VERIFY.md **Category 1** (documentation-only) for the planning step.

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
