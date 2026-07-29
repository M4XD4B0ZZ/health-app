# Handoff — CODEGRAPH-001 Phase A: Project-Scoped CodeGraph Bootstrap (2026-07-29)

**Status note:** this is a Phase-A interim handoff, not a task-completion handoff. `CODEGRAPH-001`
is `in_progress`, not `done` — Phase B (real MCP-tool-level functional proof in a fresh session)
has not started. No final PR has been opened. See `ROADMAP.md`'s `CODEGRAPH-001` entry (EPIC:
Developer Tooling & Verification) for the full, authoritative Phase A/B breakdown.

1. **Task ID/status:** `CODEGRAPH-001` — `in_progress` (Phase A complete, Phase B pending). Branch:
   `claude/codegraph-001-bootstrap-ur5ylt`. Basis: `eae6969` (tip of
   `origin/chore/clean-arch-structure`, PR #198 merge, confirmed current — no divergence between
   this branch and the base at task start; the local `chore/clean-arch-structure` ref itself was
   stale/unfetched, but `origin/chore/clean-arch-structure` matched this branch's tip exactly).
2. **What changed (Phase A only):**
   - `.mcp.json`: added a `codegraph` entry to the existing `mcpServers` map
     (`{"type":"stdio","command":"npx","args":["-y","@colbymchenry/codegraph@1.5.0","serve","--mcp"]}`).
     The existing `supabase` and `github` entries are untouched/semantically unchanged.
   - `ROADMAP.md`: added the `CODEGRAPH-001` task entry under "EPIC: Developer Tooling &
     Verification" (directly after `PROMPT-GOV-001`, its second dependency), with an explicit
     Phase A / Phase B split and no success claim before Phase B; updated the `Current Focus`
     paragraph to reflect Phase A completion without claiming CodeGraph is functionally available.
   - `handoffs/latest-handoff.md`: rotated per the binding Handoff Rotation rule — the previous
     `PROMPT-GOV-001` entry archived unchanged (byte-identical, verified via `diff`) to
     `handoffs/archive/2026-07-29_PROMPT-GOV-001_compact-task-initiating-prompt-contract.md`, then
     replaced with this entry.
   - Local, non-committed `.codegraph/` index: created via `codegraph init` (git-ignored, already
     covered by `.gitignore` line 25 from prior commit `1f5963c`; no `.gitignore` change was needed
     or made).
   - `AGENTS.md` was **not** changed in Phase A (its CodeGraph Availability sub-section still says
     CodeGraph is not registered/available — the "not registered in `.mcp.json`" clause is now
     stale after this Phase A registration and will be corrected together with the concrete
     fail-closed rule once Phase B's real MCP proof exists, per the dispatching task's explicit
     instruction not to touch that section before then).
3. **Why it changed:** `AGENTS.md`'s "CodeGraph Availability (Binding)" sub-section names
   `CODEGRAPH-001` as the explicit bootstrap exception that first makes CodeGraph actually available
   for this repository via the project-scoped `.mcp.json`, without being required to use CodeGraph
   itself as a precondition. This task executes that bootstrap: register a reproducible, exactly
   pinned CodeGraph MCP server, build and verify the local index via the CLI, and stop at the
   technically necessary MCP-restart boundary — a fresh session is required before CodeGraph can be
   exercised through the actual MCP tool surface, which is what Phase B verifies.
4. **Files changed:**
   - `.mcp.json` (new `codegraph` entry; `supabase`/`github` unchanged)
   - `ROADMAP.md` (`CODEGRAPH-001` task entry added; `Current Focus` updated)
   - `handoffs/latest-handoff.md` (replaced; now holds only this entry)
   - `handoffs/archive/2026-07-29_PROMPT-GOV-001_compact-task-initiating-prompt-contract.md` (new;
     byte-identical copy of the prior `handoffs/latest-handoff.md`)
   - Not committed: `.codegraph/` (local index, git-ignored)
5. **Verification executed (Phase A, `VERIFY.md` Category 1/2 — documentation/governance-only plus
   a local non-committed index):**
   - `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff
--name-only`
   - JSON-parse check of `.mcp.json` (`python3 -c "import json; json.load(open('.mcp.json'))"`)
   - `git diff --check`
   - `npm run format:check`
   - CodeGraph CLI, all with the pinned version `npx -y @colbymchenry/codegraph@1.5.0` (identical to
     `.mcp.json`): `version`, `init`, `sync`, `status`
   - Confirmed `.codegraph/` is git-ignored (`git check-ignore -v .codegraph/`) and absent from
     `git status --short`
   - Version resolution: `npm view @colbymchenry/codegraph version` against the official npm
     registry only → `1.5.0`
6. **Verification result:**
   - `git status --short` showed only `.mcp.json` modified before the `ROADMAP.md`/handoff edits
     (post-`init`/`sync` scope check); no product/runtime/dependency/Supabase/CI file changed.
   - `.mcp.json` parsed as valid JSON.
   - `git diff --check` reported no whitespace errors.
   - `npm run format:check` passed clean (`All matched files use Prettier code style!`).
   - CodeGraph `version` → `1.5.0`. `init` → `Indexed 796 files`; `7,518 nodes, 29,284 edges in
1.8s`. `sync` (run immediately after `init`) → `Already up to date`. `status` → `[OK] Index is
up to date`; 796 files, 7,518 nodes, 29,284 edges, 42.33 MB, backend `node:sqlite` (full WAL);
     languages: typescript (735), javascript (38), tsx (19), yaml (4).
   - `.codegraph/` confirmed git-ignored and not present in `git status --short`.
   - No `npm run verify` (product/runtime suite) was run — not applicable per Category 1/2, and no
     product/runtime file was touched.
7. **Known issues, blockers, or residual risks:**
   - CodeGraph is registered but **not yet proven MCP-functional** — everything verified above ran
     through the CLI in-process, not through the MCP tool surface a Claude Code session actually
     uses. Do not treat Phase A as sufficient to claim CodeGraph is available for task use.
   - It is undetermined whether Claude Code will require an explicit project-scoped MCP approval
     prompt before the new `codegraph` server's tools become callable in a fresh session, and
     therefore undetermined whether `.claude/settings.json` needs a narrowly-scoped permission
     entry — this must be observed directly at the start of the fresh Phase B session, not assumed.
   - `AGENTS.md`'s CodeGraph Availability sub-section still states CodeGraph is "not currently
     registered in `.mcp.json`", which is now stale after this Phase A registration; left
     intentionally unedited per the dispatching task's explicit instruction not to touch that
     section before Phase B's real MCP proof exists — do not read that stale sentence as current
     status; `ROADMAP.md`'s `CODEGRAPH-001` entry and this handoff are authoritative for current
     Phase A/B status until Phase B closes it out.
   - No PR opened yet; task not marked `done` in `ROADMAP.md` (`in_progress`, as required until
     Phase B completes).
8. **Human review/next steps:** push this branch (`claude/codegraph-001-bootstrap-ur5ylt`). Do not
   open a PR yet. Start a **fresh** Claude Code session on this same branch (MCP server registration
   requires a session restart to take effect) and, in that session: (a) observe and report whether a
   project-scoped MCP approval prompt is required before `codegraph` tools become callable; (b) call
   `codegraph_status` and a real task-relevant `codegraph_explore`/relationship-lookup MCP tool
   successfully; (c) only after that evidence exists, add the concrete fail-closed CodeGraph
   operating rule to `AGENTS.md`, replace this handoff with the Phase B/final one (archiving this
   entry unchanged first), and open the PR against `chore/clean-arch-structure`.
