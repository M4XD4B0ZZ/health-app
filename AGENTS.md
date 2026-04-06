# AGENTS.md — OpenCode Governance (HealthApp)

## Governance

- Dieses Repository folgt der Definition in `SSOK.md`.
- `SSOK.md` beschreibt die übergeordnete Governance-Struktur des Repositories.
- Alle Agenten-Workflows und Projektregeln müssen mit dieser Definition konsistent bleiben.

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

### Verification

- Run verification before marking any task done (see VERIFY.md).
- Canonical verification entrypoint:

```bash
npm run verify
```

- Full verification order:

```bash
npm run lint
npm run typecheck
npm run verify
npm run verify:edge
```

- Do not bypass or skip verification steps.
- Do not claim a task is done if verification has not passed.

### Task Governance

- Every task must reference a task ID from ROADMAP.md.
- Task IDs are never reused.
- Completed tasks are marked `done` in ROADMAP.md — never deleted.
- Update ROADMAP.md task status when work starts (`in_progress`) and when done (`done`).
- Update relevant documentation when behavior changes.

### Definition of Done

A task is done only when:

- `npm run verify` passes
- no type errors exist
- no lint errors exist
- edge verification passes if edge functions were changed
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
