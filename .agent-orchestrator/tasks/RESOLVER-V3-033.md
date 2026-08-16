---
id: RESOLVER-V3-033
title: Server-Side Atomic Aggregation Persistence Adapter
status: OPEN
kind: NORMAL
priority: NORMAL
currentFocus: false
dependsOn: []
---

# RESOLVER-V3-033 — Server-Side Atomic Aggregation Persistence Adapter

## Why this frontmatter says what it says

`currentFocus: false` — `ROADMAP.md`'s own Current Focus is RESOLVER-V3-048, not this task.
This task is the highest-priority _eligible_ work, which is not the same claim.

`priority: NORMAL` — `ROADMAP.md` assigns no priority to this entry. NORMAL is the absence of
a declared priority, not a judgement that the task is unimportant.

`dependsOn: []` — the roadmap dependencies RESOLVER-V3-030, -031 and -032 are all `done`
(`ROADMAP.md:10662`, `:10761`, `:10929`) and merged. They are not members of this block, and a
`dependsOn` entry naming a task with no projection file here would fail dependency resolution.
Empty means "nothing in this task source blocks it", not "it had no prerequisites".

## Goal

Build this codebase's first Postgres RPC / stored-function precedent, wiring RESOLVER-V3-032's
already-merged ledger / summary / rejection / duplicate logic into a **single atomic transaction
boundary**, plus the private-zone migration that logic needs.

Today `ResolverKnowledgeContributionLedgerRepository` has only an in-memory implementation
(`src/features/nutrition/infrastructure/knowledge/InMemoryResolverKnowledgeContributionLedgerRepository.ts`).
There is no `resolver_knowledge_contribution_ledger` table anywhere in `supabase/migrations/`,
and no `.rpc(` call anywhere in `src/`. This task closes that gap.

The authoritative design is section **16, "Atomicity and idempotency model"**, of
`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_AGGREGATION_OPERATIONAL_BOUNDARY_1.md`
(line 485). Read that section before writing anything. The row-level contract lives in
`docs/domains/ZERA_RESOLVER_KNOWLEDGE_CONTRIBUTION_LEDGER_CONTRACT_1.md`.

## Allowed scope

Write access is already narrowed by `.agent-orchestrator/repo-profile.yaml`. Within it, touch only:

- `supabase/migrations/` — **one new** migration file creating
  `resolver_knowledge_contribution_ledger` in the private zone, with RLS enabled and **no**
  `anon` / `authenticated` grant, plus any quarantine / run-lease table the design requires, plus
  the `SECURITY DEFINER` function implementing the atomic
  insert-ledger-row → upsert-summary → append-event → advance-checkpoint sequence.
- `src/features/nutrition/application/ports/` — extend the existing
  `ResolverKnowledgeCandidateRepository` port only if the ledger-based summary model genuinely
  requires new methods. Prefer implementing the port as it stands.
- `src/features/nutrition/infrastructure/knowledge/` — the production adapter, which must reach
  the database through **one** `supabase.rpc(...)` call. Never through separate client-side
  statements that merely look atomic.
- `src/features/nutrition/__tests__/` — the tests listed under Acceptance.
- `ROADMAP.md` — set this task to `in_progress` at start and `done` at the end
  (`AGENTS.md:365`, `:410`). Edit this task's own entry. Do not restructure the file.
- `handoffs/` — the handoff, with the rotation described under Closure.

## Explicitly excluded

- **Any batch scheduling or worker process.** That is RESOLVER-V3-034, which additionally carries
  an undecided numeric cost/privacy policy gate. Not this task.
- **Any app-facing grant.** No `anon` or `authenticated` role may reach the table or the function.
- **Any resolver-effect wiring.** Nothing this task adds may change resolver behaviour at runtime.
- **Applying the migration to any live Supabase project.** The migration file is the deliverable.
  Do not run `supabase db push`, `supabase migration up`, `apply_migration`, or any MCP Supabase
  write tool against a live project. That requires separate explicit human authorization which
  this task does not carry.
- **`src/features/nutrition/benchmark/`** — machine-protected. It is the RESOLVER-V3-048
  Protocol-v4 live-evidence area, under an open incident whose resolution is human-only.
- **The sixteen existing migration files** — machine-protected. An applied migration is history.
  Add a new file; never edit an old one.
- **Archived handoffs** under `handoffs/archive/` are immutable (`AGENTS.md:398`). You may add the
  one new archive file the rotation requires. You may not alter any existing one.
- Any AI/provider call, any live credential use, any spend.

## Acceptance criteria

1. A single atomic RPC call performs the full contribution-write sequence, with **no partial-state
   outcome under injected failure at each internal stage**. Prove real single-transaction
   behaviour — not a simulated snapshot/restore, which is what RESOLVER-V3-028's `applyDecision`
   test does. Mirror its structure, not its mechanism.
2. Migration RLS/grant tests exist, mirroring the established pattern in
   `src/features/nutrition/__tests__/ResolverKnowledgeCandidateMigration.test.ts`.
3. Idempotent-retry-via-RPC tests: replaying the same contribution does not double-count.
4. No app client can invoke the function. A test asserts the absent grant.
5. No live migration was applied.
6. `npm run verify` passes.

## Risks and known conflicts

- **`SECURITY DEFINER` privilege scope.** This is the first such function in the repository, so it
  sets the precedent every later one will copy. Pin `search_path` explicitly. State in the handoff
  exactly which privileges the function runs with and why that set is minimal.
- **A partial-failure gap between the RPC boundary and the caller.** The adapter must not paper
  over a failed RPC with a locally-reconstructed success result.
- **`npm run lint` and untracked build output.** ESLint's `ignorePatterns` in `.eslintrc.cjs`
  covers only `supabase/functions/**`. A `build/` directory is gitignored but **not** lint-ignored,
  so if one exists in your worktree, `npm run verify` fails on files you never wrote. A fresh
  worktree will not have one. If you hit this, the cause is stray build output, not your change.
- **No open PRs conflict** as of 2026-08-16: `gh pr list --state open` is empty.
- Do not reopen the naming decision in RESOLVER-V2-005, and do not touch anything RESOLVER-V3-048
  owns.

## CodeGraph contract (binding)

`.agent-orchestrator/repo-profile.yaml` declares `capabilities.codegraph: REQUIRED`, and
`AGENTS.md` ("CodeGraph Availability") makes this fail-closed. Therefore:

1. **Before any repository change**, check CodeGraph status and run at least one real query.
   Re-discover the exposed tool set rather than trusting a documented name; at the time of writing
   the `codegraph` MCP server exposes exactly one tool, `codegraph_explore`.
2. Run at least one **task-relevant symbol lookup** and at least one **caller/callee or impact
   lookup** for a symbol you are about to change — for example
   `ResolverKnowledgeContributionLedgerRepository`,
   `InMemoryResolverKnowledgeContributionLedgerRepository`, `recordContribution`.
3. Scope the set of files you touch from what CodeGraph returns, not from assumption.
4. **On failure: STOP.** One resync attempt with the pinned CLI version from `.mcp.json` is
   permitted, re-verified through the MCP tool itself. If it still fails, stop — do not modify
   files, do not commit, and do not substitute grep. Report the exact tool name, query and failure.
5. Record in the handoff: the tool name(s) called, the queries used, and the symbol/relationship
   findings with file and line.

## Subagents

**Useful here, read-only, at most two.** Sensible splits: one to survey the existing migration and
RLS test conventions across `supabase/migrations/` and
`src/features/nutrition/__tests__/*Migration.test.ts`; one to extract the exact obligations of
design section 16 and the ledger contract document.

Subagents may read, query CodeGraph, and analyse. They may **not** edit files, mutate git, create
commits or branches, or start processes. You remain the only writer.

## Context

Read selectively per the Task-Start Read Contract in `AGENTS.md`. Do **not** read `ROADMAP.md` or
`VERIFY.md` end to end — `ROADMAP.md` alone is over 11,000 lines. What you need:

- `ROADMAP.md:11106-11131` — this task's own entry.
- `AGENTS.md` and `SSOK.md` — in full, once, if this is a fresh session.
- `VERIFY.md:44-55` — the Canonical Verification Decision Table.
- `handoffs/latest-handoff.md` — the single current handoff.
- The two design records named under Goal.

Ignore historical status paragraphs elsewhere in the V3 epic; several are chronological appends
that are superseded but not deleted.

## Closure

- **Verify category:** 4 (product/runtime code) per `VERIFY.md:53`. Required and blocking:
  `npm run verify`.
- Category 5 (Edge/Supabase) does **not** apply: no Supabase Edge Function changes. `verify:edge`,
  `verify:supabase:link` and `verify:schema` all need a linked live project and are out of scope
  here. `verify:schema` applies only if this is ever run against a linked project, which this task
  forbids.
- No UI or presentation files are touched, so no `docs/MANUAL_TESTING_GAPS.md` entry is due.
- **Handoff:** archive the current `handoffs/latest-handoff.md` unchanged into
  `handoffs/archive/YYYY-MM-DD_TASK-ID_short-description.md` using the date and task ID _of the
  handoff being archived_, then replace `latest-handoff.md` with this task's handoff only — do not
  prepend. It must carry all eight fields from `AGENTS.md:373-383`.
- **Git:** branch from the block base commit, one PR against `chore/clean-arch-structure`.
- **Merge:** the `Verify / verify` CI check must be green first. Do not merge on a red or pending
  gate, and do not bypass a permission refusal — leave the PR open and report it instead.
- Mark `done` in `ROADMAP.md` only once verification has actually passed (`AGENTS.md:401-411`).
  Report the real result. A failing check is a finding to report, never something to work around.
