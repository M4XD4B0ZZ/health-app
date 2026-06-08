# HealthApp 6 Master Roadmap (SSOK)

# Phase C: OpenCode CLI Worker Integration

# Ziel

- OpenCode als optionaler CLI-Worker, ohne VS Code + Roo zu ersetzen
- Übergabe vorbereiteten Prompts aus .agent/out/next-prompt.md an OpenCode
- Ausgabe protokollieren und an Verify/Review-Gates stoppen

# Umsetzung

- Neue Datei: scripts/agent/run-opencode-worker.mjs
- Neues Script in package.json: "agent:worker"
- Robust Repo-Root Ermittlung
- Prüfen auf .agent/out/next-prompt.md, Fehlermeldung falls nicht vorhanden
- Safety-Header vor Prompt
- OpenCode non-interactive starten (spawn, PowerShell-kompatibel)
- Ausgabe in .agent/out/opencode-report.md
- State in .agent/state.json aktualisieren
- Fehlerbehandlung bei fehlendem OpenCode oder non-zero Exit
- .gitignore anpassen für opencode-report.md
- README scripts/agent/README.md um Phase C ergänzen

# Nutzungsschritte

1. npm run agent:run
2. npm run agent:worker
3. npm run agent:verify
4. npm run agent:run

# Hinweise

- VS Code + Roo bleiben Cockpit
- OpenCode ist optionaler Worker
- Kein Multi-Task-Loop oder Commit/Push in Phase C

Status: Active

- [x] P0-002: Kerninputs Proof
      Architecture: Clean Architecture + Feature-First + Deterministic-First Nutrition Engine

---

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
  - RALPH-034*
  - RALPH-035*
  - RALPH-036*
  - RALPH-037*
  - RALPH-038*
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

2. **DACH Source** (Planned - Critical for Launch)
   - German/Austrian/Swiss specific food database
   - Local brands, regional specialties, German portion sizes
   - Essential for market penetration and user trust
   - Reduces AI fallback dependency

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

Status: `in_progress`

Split input at "und", "mit", ",". Normalize number words. Force resolver per item.

**DoD:** "ei und quark" produces two separate resolved entries.

---

## Tier 1 Planning Targets — Require Later Task Decomposition

The following product modules are Tier 1 planning targets. They are intentionally listed as planning placeholders only and must be decomposed into concrete, verifiable tasks before implementation.

| Module      | Status | Notes                             |
| ----------- | ------ | --------------------------------- |
| Journal     | `todo` | Editable food log, daily view     |
| Saved Meals | `todo` | Reusable meal templates           |
| Dashboard   | `todo` | Summary view, progress indicators |
| Goals       | `todo` | Macro targets, metabolism profile |

---

# TIER 2 — CORE ARCHITECTURE

Focus: private-use stability, deterministic architecture hygiene, and DACH-first resolver correctness.

## EPIC: Supabase Foundation

### P2-001 Verify Environment Wiring

Status: `todo`

Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are strictly verified.
App throws fatal error on boot if variables are missing.

**Verify:** `npm run typecheck` + `npm run test` validating environment checks.

---

### P2-002 Enforce Single Supabase Client

Status: `todo`

Prevent any creation of new `createClient` instances globally.
`supabaseClient.ts` is the single source of truth.
No manual `fetch` calls to `/functions/v1/` exist.

**Verify:** `npm run lint` + global search for `fetch(` targeting Supabase URLs (must yield 0 results).

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

Status: `todo`

**Description:**
Remove global translation before source querying. Keep normalization only (case, umlauts, punctuation). Input must reach multiple sources unchanged.

**DoD:**

- Tests confirm same normalized input reaches multiple sources
- No DE→EN translation before source routing
- [`getSourceQuery()`](src/features/nutrition/domain/catalog/CanonicalFood.ts:199) only adapts per source, not globally

**Verify:** Unit tests show "ei" sent to BLS, "egg" sent to USDA, "ei" sent to OFF

---

#### RESOLVER-V2-002: Implement Source-Native Query Adapters

Status: `todo`

**Description:**
Each source builds its own query from normalized input. No shared query string across sources.

**DoD:**

- BLS adapter generates German-specific queries
- USDA adapter generates English equivalents
- OFF adapter preserves original multilingual input
- Logging shows different queries per source

**Verify:** Debug logs show source-specific query adaptation

---

#### RESOLVER-V2-003: Implement Multi-Source Candidate Retrieval

Status: `todo`

**Description:**
All sources return candidates before decision. Remove early-return logic except negative cache.

**DoD:**

- [`SequentialFoodCatalogResolver`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:56) collects from all sources
- No early return based on confidence thresholds
- Logs show candidates from multiple sources per query

**Verify:** Resolution logs show multi-source candidate collection

---

#### RESOLVER-V2-004: Build Candidate Fusion Layer

Status: `todo`

**Description:**
Central scoring across all sources. Introduce unified Candidate type with cross-source ranking.

**DoD:**

- Unified candidate scoring algorithm
- Cross-source comparison logic
- Ranking logs show source comparison rationale

**Verify:** Ranking logs demonstrate cross-source candidate evaluation

---

# TIER 3 — INFRASTRUCTURE

Focus: deployment repeatability, remote guardrail verification, long-term resolver persistence, and retention support after the core loop exists.

## EPIC: Supabase Foundation

### P2-003 Document Edge Functions Deploy Process

Status: `todo`

Ensure `supabase/config.toml` is respected in deployment.
`verify_jwt=false` safely applied.
README section in `/supabase` on how to run `supabase functions deploy`.

**Verify:** Local `supabase start` parses `config.toml` and allows anonymous invokes.

---

## EPIC: Edge Guardrails (Food Search)

### P2-007 Deploy & Verify Guardrails

Status: `todo`

Deploy guardrails with correct `verify_jwt=false` properties.
App calls remote endpoints anonymously without 401s.

**Verify:**

1. `npm run verify:supabase:link` must pass.
2. `npm run verify:schema` must pass.
3. `npm run deploy:edge:verify` must pass.

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

---

## Tier 4 Planning Targets — Require Later Task Decomposition

The following module remains planned but not yet scoped into concrete implementation tasks.

| Module      | Status | Notes                                 |
| ----------- | ------ | ------------------------------------- |
| Health Sync | `todo` | Apple Health / Google Fit integration |

---

# TIER 5 — MONETIZATION

Focus: deferred monetization and paid AI gating after retention-critical product value is proven.

## EPIC: Auth & Subscription (Later)

### P2-009 RevenueCat Entitlements

Status: `todo`

Integrate RevenueCat to manage subscription states.
`isPro` state synced from RevenueCat to Supabase `public.users` via Webhooks.

---

### P2-010 Paid-only Gating for AI Endpoints

Status: `todo`

Map `isPro` tier to Edge Function authorization.
AI structured log functions and premium insights return 403 for non-Pro users.

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
