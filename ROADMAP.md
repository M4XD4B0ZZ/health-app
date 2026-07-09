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
- **BLS Live-Status (Stand 2026-07-09):** BLS ist inzwischen aktiv im Resolver verdrahtet (`BlsStaticSource` in `src/infrastructure/di/container.ts`, `resolverSources = [userAliasSource, blsSource, offSource, usdaSource]`) und wird in `SequentialFoodCatalogResolver` mit Priorität vor OFF/USDA berücksichtigt (siehe `BlsResolverIntegration.test.ts`). Der ältere Stand "nur OFF + USDA live" (P0-007 Proof-Points) ist damit überholt.
