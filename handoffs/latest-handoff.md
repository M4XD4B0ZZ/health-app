# Handoff — CODEGRAPH-001: Phase B Real MCP Functional Proof and Completion (2026-07-29)

1. **Task ID/status:** `CODEGRAPH-001` — `done` (Phase A + Phase B complete). Branch:
   `claude/codegraph-mcp-phase-b-xfmhd7`. Basis: `2c286e0` (tip of
   `origin/chore/clean-arch-structure`, PR #199 merge — confirmed via `git fetch` at task start; no
   divergence between this branch and the base).
2. **What changed:**
   - `AGENTS.md`: replaced the "CodeGraph Availability (Binding)" sub-section's placeholder text with
     the concrete, fail-closed operative CodeGraph rule, based on the tool surface actually observed
     in this session (see MCP evidence below) — real MCP preflight required for codebase-related
     tasks, healthy/current index as precondition, at least one task-relevant symbol search and one
     caller/callee/dependency/call-path/impact lookup before edits, results used to scope changes,
     documentation of tool names/queries/findings in the handoff, fail-closed on unavailable
     server/durably invalid index/no relationship proof, no silent grep/text-search fallback,
     exception for pure documentation/governance-only tasks, and `CODEGRAPH-001` named as the closed
     historical bootstrap exception.
   - `ROADMAP.md`: `CODEGRAPH-001` set to `done`; added the Phase B section documenting the real MCP
     evidence (approval behavior, actual exposed tool surface, index-resync, symbol search,
     relationship proof, source confirmation); `Current Focus` updated to state CodeGraph is now
     available, without reinterpreting `RESOLVER-V3-048`'s status.
   - `handoffs/latest-handoff.md`: rotated per the binding Handoff Rotation rule — the prior Phase-A
     entry archived unchanged (byte-identical, verified via `diff`) to
     `handoffs/archive/2026-07-29_CODEGRAPH-001-PhaseA_project-scoped-codegraph-bootstrap.md`, then
     replaced with this entry.
   - Local, non-committed `.codegraph/` index: rebuilt in this fresh session via the pinned CLI
     (git-ignored, not committed; identical stats to Phase A).
3. **Why it changed:** Phase A (PR #199) registered CodeGraph in `.mcp.json` but explicitly could not
   establish MCP-level functional proof — everything there ran through the CLI in-process. This task
   is the required Phase B: in a genuinely fresh Claude Code session, prove CodeGraph is real,
   callable, and useful through the actual MCP tool surface (not the CLI, not grep), then — and only
   then — concretize `AGENTS.md`'s CodeGraph rule and close out `CODEGRAPH-001`.
4. **Files changed:**
   - `AGENTS.md` (CodeGraph Availability section concretized)
   - `ROADMAP.md` (`CODEGRAPH-001` → `done`, Phase B section added, `Current Focus` updated)
   - `handoffs/latest-handoff.md` (replaced; now holds only this entry)
   - `handoffs/archive/2026-07-29_CODEGRAPH-001-PhaseA_project-scoped-codegraph-bootstrap.md` (new;
     byte-identical copy of the prior `handoffs/latest-handoff.md`)
   - Not committed: `.codegraph/` (local index, git-ignored)
5. **MCP-Gate evidence (the core of this task):**
   - **Approval behavior:** no explicit project-scoped MCP approval prompt appeared for `codegraph`
     in this session; its tool became callable automatically once the server finished connecting
     (same as the pre-existing `supabase`/`github` servers). No repository file was required or
     changed: `.claude/settings.json` does not exist; `.claude/settings.local.json` also did not
     exist at task start (`ls -la .claude/` showed only `skills/`) but was auto-written locally by
     the harness after the first `codegraph_explore` call, recording
     `{"permissions":{"allow":["mcp__codegraph__codegraph_explore"]}}`. That file is untracked and
     globally git-ignored (`git check-ignore -v` resolves it via `/root/.config/git/ignore`, not this
     repo's `.gitignore`) — it is not a repository file, was not authored by this task, and is not
     part of this diff.
   - **Actual exposed tool surface:** the `codegraph` MCP server exposes exactly one tool this
     session, `mcp__codegraph__codegraph_explore` (confirmed via repeated `ToolSearch` queries —
     `"codegraph"`, `"+codegraph"`, `"status index health sync"` — all returning only this one
     tool). There is **no** separate `codegraph_status`/callers/callees/call-path tool, correcting
     the `codegraph_status` name assumed in Phase A's "next step" text.
   - **Status/index-health check (via the only exposed tool):** first call —
     `mcp__codegraph__codegraph_explore({query: "runOneObservation", projectPath:
"/home/user/health-app"})` — returned: _"The project at /home/user/health-app isn't indexed
     with codegraph (no .codegraph/ directory found walking up from it)..."_ (the fresh container has
     no persisted `.codegraph/`, since it is git-ignored and never committed). Treated as the
     fail-closed "missing/outdated index" trigger; remedied with the one permitted resync using the
     pinned CLI version from `.mcp.json`: `npx -y @colbymchenry/codegraph@1.5.0 init` →
     `Indexed 796 files`; `7,518 nodes, 29,284 edges in 1.8s` (identical to Phase A). Re-ran the
     identical MCP call afterward — it succeeded, returning live current data (below), which is the
     required re-check of MCP status after resync.
   - **Symbol search:** query `"runOneObservation"` via `mcp__codegraph__codegraph_explore` → found
     `runOneObservation`, exported async function, defined at
     `src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4DevelopmentRunner.ts:167`.
   - **Relationship proof:** the same call's blast-radius/`calls` data shows `runOneObservation` has
     4 callers; the returned verbatim source shows `runProtocolV4DevelopmentForCandidate` (same file,
     defined at line 372) calling `runOneObservation` at line 446 inside its loop over
     `input.plan.developmentObservations` — a direct caller relationship inside the Protocol-v4
     Development execution flow.
   - **Source confirmation:** confirmed directly against the verbatim, line-numbered, current
     on-disk source `codegraph_explore` returned for
     `ResolverV3048ProtocolV4DevelopmentRunner.ts` (tool-documented as re-read from disk, byte-for-byte
     identical to `Read`) — definition at line 167, call site at line 446. No separate `Read` of the
     file was performed, per the tool's own instruction not to re-read a file it already returned.
6. **Verification executed (`VERIFY.md` Category 1/2 — documentation/governance-only):**
   - `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff --name-only`
   - `git diff --check`
   - `npm run format:check`
   - JSON-check: no JSON file was modified in this task (`.mcp.json` untouched — no configuration
     defect was found, so no change was made to it), so no JSON-parse check applies.
   - MCP status/symbol/relationship re-proof as documented in section 5 above.
   - Handoff rotation check: `diff` confirmed the archived copy is byte-identical to the pre-rotation
     `handoffs/latest-handoff.md`; `handoffs/latest-handoff.md` now holds exactly this one entry.
7. **Verification result:** all readback checks ran clean; `git diff --check` reported no whitespace
   errors; `npm run format:check` passed; the MCP gate passed on the second attempt (after the one
   permitted index resync); the handoff rotation is byte-identical and singular, as required.
8. **Known issues, blockers, or residual risks:**
   - The `codegraph` MCP server currently exposes only one tool (`codegraph_explore`). If a future
     CodeGraph version splits status/search/relationship lookups into separate named tools, the
     concrete tool names in `AGENTS.md`'s operative rule and in this handoff will need to be
     re-verified against what is actually exposed at that time — the rule is written to require
     re-discovery rather than trusting a hardcoded tool name.
   - The local `.codegraph/` index is git-ignored and ephemeral per container; every fresh session/
     container will need the same one-time CLI resync the first time CodeGraph is queried, per the
     now-documented `AGENTS.md` rule.
   - No product/runtime/resolver/test/CI/dependency/Supabase file was touched; `RESOLVER-V3-048`'s
     status text was not reinterpreted.
9. **Human review/next steps:** review and merge the PR against `chore/clean-arch-structure`. No
   further CodeGraph bootstrap work is expected; subsequent codebase-related tasks should follow the
   new `AGENTS.md` operative rule (real MCP preflight, symbol + relationship proof, fail-closed).
