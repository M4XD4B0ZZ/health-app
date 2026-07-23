# RALPH-RETIRE-002 — Governance Consolidation Report

**Date:** 2026-07-23
**Scope:** Consolidate `.governance/**` into `AGENTS.md`, retire Roo-specific `.roo/`/`.roomodes`,
and define one unambiguous repository workflow, closing out the residual inconsistency
intentionally left open by `RALPH-RETIRE-001`.

## 1) Executive outcome

`.governance/**` (4 files) and `.roo/`/`.roomodes` (13 files) are deleted entirely.
Still-valuable content was merged into `AGENTS.md`; everything else was either fully
Ralph/Roo-specific, already duplicated elsewhere, or superseded by the Claude Queue Contract
(`docs/automation/CLAUDE_QUEUE_CONTRACT.md`, added in `QUEUE-001`). `SSOK.md`'s ~540-line
Roo-specific historical section was compressed to a short note, mirroring how `RALPH-RETIRE-001`
compressed `ROADMAP.md`'s RALPH section.

## 2) `.governance/` — file-by-file disposition

| File               | Disposition                                              | Reason                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |
| ------------------ | -------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SYSTEM.md`        | **Deleted**                                              | Entirely describes the RALPH 8-step task-lifecycle loop (Read Governance → Read Task State → Select One Task → Execute → Handoff → Validate → Update State → Stop for Review), tied to RALPH's own `ROADMAP.md`-task-state transition model. Its generic stop-conditions/escalation content already overlaps `AGENTS.md`'s existing rules and the Queue Contract's stop conditions.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| `RULES.md`         | **Deleted, one section merged**                          | Its "Core Execution Rules" (one-task-per-run, no unrelated cleanup, no broad refactors) and "Architecture Preservation Rules" (no model names in domain/app layers) duplicate `AGENTS.md`'s existing "Editing" and "Prohibited" sections verbatim. Its "Tool-Specific Files Are Adapters" duplicates `AGENTS.md`'s existing "Tool Adapter Principle". The one genuinely reusable, not-yet-elsewhere-codified piece — the normative 8-field handoff schema — was merged into `AGENTS.md` as a new "Handoff Requirements" section, making `AGENTS.md` (not `RULES.md`) the schema owner referenced by `VERIFY.md` and elsewhere.                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| `SAFETY.md`        | **Deleted, protected-files list merged (and corrected)** | The Protected Files list (absolute/conditional protection) is genuinely valuable and not duplicated elsewhere — merged into `AGENTS.md` as a new "Protected Files" section. Its "Forbidden Actions" included "Push to remote repositories — No `git push` operations" as a blanket **never-allowed** rule, which directly **contradicted** `AGENTS.md`'s own established "Git Branch Sync After Push/Pull" workflow (routine push/PR/merge under human oversight, practiced continuously across this session's own PRs #138–#141). This is exactly the "duplicate/contradictory authority" this task's DoD calls out. The corrected `AGENTS.md` "Protected Files" section explicitly states pushing/PR/merge is governed by the Git Branch Sync rules, not a blanket prohibition. The remaining aspirational "Safety Gates" content (file-modification tracking, network-request monitoring, process monitoring) describes automated tooling that was never implemented and has no corresponding real system in this repository — dropped as aspirational/non-actionable. |
| `REVIEW_POLICY.md` | **Deleted**                                              | Its "what's auto-acceptable vs. needs manual review" boundary is now the Claude Queue Contract's job (`risk:safe-autonomous` exclusions) for queue-driven work, and the established merge-then-independent-review pattern already documented in `AGENTS.md`'s Git Branch Sync section for regular session work. Its "Morning Review Expectations" section explicitly referenced `scripts/agent/generate-morning-review.mjs` and `reports/morning-review.md`, both deleted by `RALPH-RETIRE-001` — that ritual has no remaining tooling behind it. The rest (rollback principles, review thoroughness) is general professional judgment not requiring separate codification.                                                                                                                                                                                                                                                                                                                                                                                               |

Net: `.governance/` directory removed entirely (4 files, 799 lines).

## 3) `.roo/` / `.roomodes` — disposition

**Deleted** (13 files: `.roomodes`, `.roo/rules/01-global.md`, `.roo/rules-code/01-code.md`,
`.roo/rules-code/02-plans.md`, `.roo/context-map.md`, `.roo/mcp.json`, and 7 files under
`.roo/commands/`).

Rationale:

- `.roomodes` defines Roo VS Code extension-specific mode configuration (tool-permission groups
  per mode) — a format that only functions inside that specific extension, not translatable to
  any other tool.
- `.roo/rules/01-global.md`, `.roo/rules-code/01-code.md`, and `.roo/context-map.md` are ~95%
  duplicate content of `AGENTS.md`'s existing "Core Rules" (small focused changes, respect
  architecture boundaries, no secrets, minimal-context edits) — differently organized but not
  substantively different guidance.
- `.roo/commands/*.md` define Roo-specific slash-command workflows (`/feature`, `/bugfix`,
  `/review`, `/explain`, `/commit`, `/commit-push`) superseded by Claude Code's native
  skill/command mechanism (see `.claude/skills/`).
- No evidence of active Roo usage was found in this repository's recent Git history — all
  observed recent work is Claude Code- or Codex-driven.
- The repository's own existing governance already treated Roo as non-authoritative ("historical
  transition context," "legacy adapter") since before this task; this task completes that
  decision explicitly rather than leaving it ambiguous, per the task's own DoD requirement.

Git history retains the exact prior Roo mode/rule/command definitions if ever needed for
reference.

## 4) `AGENTS.md` changes

- **Canonical Authority Hierarchy:** removed `.governance/*` from Level 2 (deleted); removed the
  "Legacy Roo artifacts... historical/transition context" footnote (files deleted, not merely
  demoted).
- **Conflict Resolution / Runtime Contract:** "Safety Authority" now points to this document's own
  new "Protected Files" section instead of the deleted `.governance/SAFETY.md`.
- **"Ralph-Loop Governance (Retired)" section:** updated to state the consolidation is complete
  (previously said `.governance/**` "still exists... until `RALPH-RETIRE-002` consolidates it").
- **New "Protected Files" section:** merged and corrected `SAFETY.md` content (see §2).
- **New "Handoff Requirements" section:** merged `RULES.md`'s normative 8-field schema, placed
  immediately before "Definition of Done".

## 5) `SSOK.md` changes

- Title changed from "SSOK v2 – Roo-first Multi-Agent Governance" to "SSOK v2 – Repository
  Governance (HealthApp)" — no longer Roo-first.
- Quick Guide at the top no longer points to `.roo/commands`/`.roo/rules` (deleted); points to
  `AGENTS.md` and `.claude/skills/` instead.
- "Active Governance Authority Hierarchy": removed `.governance/*` from Level 2; removed the
  "`.roo/` and `.roomodes` are retained as historical/legacy context... final disposition decided
  in `RALPH-RETIRE-002`" placeholder, replaced with a statement that the consolidation is done.
- "Conflict Resolution Order": "Safety wins first" now points to `AGENTS.md`'s "Protected Files"
  section instead of the deleted `.governance/SAFETY.md`.
- The ~540-line "Historical Context / Legacy Workflow (Non-Authoritative)" section (Roo SSOK
  hierarchy, Roo Agent Registry with 7 defined agents, model/role logic, verbindliche
  Arbeitsregeln, Verify/Handoff contracts, anti-duplication rules, SSOK change rules) — all
  describing the now-deleted Roo tooling in detail — replaced with a ~15-line "Legacy Roo Workflow
  (Retired)" historical note.
- "Product Principles" section (unrelated to RALPH/Roo) left completely unchanged.
- Net: `SSOK.md` reduced from 591 to 69 lines.

## 6) `VERIFY.md` changes (narrow, justified scope addition)

This task's originating issue (#142) listed allowed paths as `.governance/**`, `AGENTS.md`,
`SSOK.md`, `.roo/**`, `.roomodes`, `ROADMAP.md` (status only), `handoffs/latest-handoff.md`, and
one new report — `VERIFY.md` was not listed. However, the issue's own Definition of Done required
"No duplicate/contradictory authority remains between `.governance/**`, `AGENTS.md`, `SSOK.md`,
**`VERIFY.md`**" — and `VERIFY.md` contained two now-dangling references to the deleted
`.governance/RULES.md` (handoff-schema-owner pointer) and `.governance/*.md` (an example in the
verification-category table). Leaving these unedited would have created exactly the
duplicate/contradictory-authority condition the DoD forbids. Both were corrected as a narrow,
explicitly-flagged exception to the issue's literal allowed-paths list:

- Handoff-schema-owner pointer now reads "`AGENTS.md` (see its 'Handoff Requirements' section)".
- The Category 2 table row's example list no longer includes the deleted `.governance/*.md`.

No other `VERIFY.md` content was touched.

## 7) Known residual references (not edited, out of scope)

- **`README.md`** (lines ~45–57): documents the `.mcp.json` Supabase MCP server's `--read-only`
  flag as existing "to keep the MCP server from performing writes/migrations outside the
  governance gates in `.governance/SAFETY.md`". This is a live, functionally-relevant reference
  that is now factually stale (the file it points to is deleted; the content lives in `AGENTS.md`
  now). **Not edited** — `README.md` was not in this task's allowed paths and editing it was not
  required to complete the core consolidation. Flagged here for a trivial one-line follow-up.
- **`plans/ACC-001_LOCAL_FIRST_ACCOUNT_BACKUP_SYNC_PLAN.md`** (lines ~125–129): references
  `.governance/SAFETY.md`'s protected-file rules as rationale for a past planning decision. Left
  unedited as historical/planning content describing reasoning at the time it was written,
  consistent with `AGENTS.md`'s "do not rewrite unrelated product task history" principle.
- Several historical `reports/*` entries (`APP_TESTING_EVALUATION_2026-07-16`,
  `RESOLVER_V3_024_...`) and one `docs/domains/...` decision record reference the old
  `.governance/*` authority hierarchy or the now-superseded "Dual Governance During Transition"
  framing while describing what was true at the time those documents were written. Left unedited
  for the same historical-record reason applied throughout `RALPH-RETIRE-001`.

## 8) Verification

- Documentation/governance-only change (no `src/`, no runtime/test code) — per `VERIFY.md`'s
  Category 2 decision table: `git --no-pager status --short`, `git --no-pager diff --stat`,
  `git --no-pager diff --name-only`.
- `npm run verify` also run for additional confidence per this task's own issue-specified verify
  command — see final PR report for the actual result.

## 9) No-product-effect statement

- No `src/**`, Supabase, migration, or dependency change.
- No `.github/workflows/**` change.
- `.roo/**`, `.roomodes`, `.governance/**` deleted per the disposition above; nothing else touched
  outside `AGENTS.md`, `SSOK.md`, `VERIFY.md` (narrow, justified), `ROADMAP.md` (status update),
  `handoffs/latest-handoff.md`, and this report.
