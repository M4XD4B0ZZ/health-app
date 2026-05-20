# CLINE-REAL-002 — Governance Consistency Audit Report

Date: 2026-05-20  
Scope: Governance/workflow consistency only (no product code)

## Reviewed targets

- `README.md`
- `AGENTS.md`
- `VERIFY.md`
- `SSOK.md`
- `ROADMAP.md`
- `.roomodes`
- `.roo/rules/01-global.md`
- `.roo/rules-code/01-code.md`
- `.roo/rules-code/02-plans.md`
- `.roo/commands/*.md`
- `.agent/adapters/cline.md`
- `.agent/config/loop-config.json`
- `.agent/config/protected-files.json`
- `plans/README.md`
- Runtime context checked: `runs/current-run.json`, `tasks/task-state.json`

---

## Findings

### Critical

1. **Push workflow conflict (`.roo/commands/commit-push.md` vs Ralph safety constraints)**
   - `.roo/commands/commit-push.md` explicitly instructs pushing to remote.
   - `.agent/config/protected-files.json` marks `push` as `never_allowed`.
   - Ralph-loop governance and current task constraints repeatedly prohibit push.
   - **Risk:** tool/operator may follow conflicting “official” workflows and violate safety policy.

2. **Governance authority contradiction (`SSOK.md`)**
   - `SSOK.md` transition section states repository-first/tool-neutral governance is becoming authoritative.
   - Later sections still state “Roo ist die operative SSOK” as binding rule.
   - **Risk:** dual source-of-truth ambiguity for operators and adapters during execution.

### Medium

1. **Verification rule inconsistency across root governance docs**
   - `AGENTS.md` “Do not bypass or skip verification steps” + full sequence implies always running `lint`, `typecheck`, `verify`, `verify:edge`.
   - `VERIFY.md` defines conditional `verify:edge` (only when edge functions changed).
   - `SSOK.md` verify contract says only relevant checks are required.
   - **Impact:** inconsistent completion criteria and uneven enforcement.

2. **Task source-of-truth drift (`ROADMAP.md` vs `tasks/task-state.json`)**
   - `AGENTS.md` says every task must reference a ROADMAP task ID.
   - Ralph runtime actively uses `RALPH-*` tasks in `tasks/task-state.json` and `runs/current-run.json`.
   - **Impact:** governance ambiguity on what task registry is canonical for operational work.

3. **Mode/scope mismatch in `.roomodes` for governance-heavy work**
   - `agentic` mode edit scope is limited to productive code paths (`src/|app/|apps/|packages/|components/`).
   - Current governance/runtimes tasks require edits in docs/runtime paths (`reports/`, `handoffs/`, `.agent/`, etc.).
   - **Impact:** mode-level policy can block intended governance tasks or force bypass behavior.

4. **Roo structure reference drift in `SSOK.md`**
   - SSOK repeatedly references `.roo/rules/*.md` as canonical behavior rules.
   - Repository also uses `.roo/rules-code/*.md` with active policy content.
   - **Impact:** incomplete mapping of active rule locations.

5. **PowerShell command policy duplicated in multiple places**
   - Same operational rule exists in `.roo/rules/01-global.md` and `.agent/adapters/cline.md`.
   - **Impact:** higher drift risk over time if one copy changes and the other does not.

### Low

1. **`README.md` verification summary is simplified vs `VERIFY.md`**
   - README describes `verify` as lint+types+tests, while actual script includes `format:check`.
   - **Impact:** minor onboarding mismatch.

2. **`plans/README.md` terminology lag**
   - Section title “Für Roo und Codex” does not reflect current adapter-neutral framing (Cline/OpenCode also active).
   - **Impact:** terminology drift only.

3. **`.roo/commands/review.md` duplicate steps**
   - Repeated lines for reading context and checking aspects.
   - **Impact:** quality/clarity issue, low operational risk.

---

## Suggested follow-ups

1. **Define explicit precedence rule in one place**
   - Add a short “conflict resolution matrix” (Ralph task mode vs legacy Roo mode) in one canonical governance file.

2. **Resolve push-policy conflict immediately**
   - Either deprecate `/commit-push` for Ralph-governed runs or add a hard guard note that it is forbidden in Ralph mode.

3. **Unify verification contract language**
   - Normalize wording across `AGENTS.md`, `VERIFY.md`, `SSOK.md`:
     - always run `npm run verify`
     - run `verify:edge` conditionally
     - avoid contradictory “never skip any step” wording.

4. **Clarify task registry model**
   - Explicitly document relationship:
     - `ROADMAP.md` = product planning SSOK
     - `tasks/task-state.json` = runtime execution state for Ralph loop

5. **Reduce duplicated policy text**
   - Keep PowerShell policy in one canonical file and cross-link from adapter docs.

6. **Update stale Roo path references**
   - Include `.roo/rules-code/` where applicable in SSOK governance mapping.

---

## Verification performed for this audit

- `git status --short`
- `git --no-pager diff --stat`

Both commands confirm only governance/runtime documentation files are currently modified.

## Explicit confirmation

✅ **No product code was modified** (`src/` untouched).  
✅ **No Supabase code was modified** (`supabase/` untouched).  
✅ **No runtime application logic/scripts were modified by this audit task.**
