# Handoff — CODEGRAPH-001: Post-Merge Evidence Correction (2026-07-29)

1. **Task ID/status:** `CODEGRAPH-001` — remains `done`. This is a pure documentation correction to
   already-merged Phase B evidence, not a re-opening or re-evaluation of the task. Branch:
   `claude/codegraph-001-post-merge-evidence-fix`. Basis: `3800a11` (tip of
   `origin/chore/clean-arch-structure`, PR #200 merge — confirmed via `git fetch` at task start).
2. **What changed:** `ROADMAP.md`'s `CODEGRAPH-001` Phase B "MCP approval behavior observed" bullet
   incorrectly stated that `.claude/settings.local.json` "do[es] not exist in this repository." The
   Phase B handoff (now archived) already documented the more precise, actually-observed sequence:
   the file did not exist at task start, but was auto-written locally by the harness after the first
   `mcp__codegraph__codegraph_explore` call, recording that tool-call permission; it is untracked and
   globally git-ignored, and was never a repository file, never required, and never part of PR #200's
   diff. `ROADMAP.md` now states this same sequence instead of the flatter "does not exist" claim.
3. **Why it changed:** the ROADMAP text and the handoff diverged on a factual detail (file
   non-existence vs. later-auto-created-but-irrelevant) after PR #200 merged. This task brings the
   ROADMAP evidence into line with the more accurate handoff account — nothing else about Phase B's
   functional proof is affected or re-verified.
4. **Files changed:**
   - `ROADMAP.md` (one bullet in the `CODEGRAPH-001` Phase B section corrected; no other text in that
     entry, `Current Focus`, or elsewhere touched)
   - `handoffs/latest-handoff.md` (replaced; now holds only this entry)
   - `handoffs/archive/2026-07-29_CODEGRAPH-001_phase-b-real-mcp-functional-proof-and-completion.md`
     (new; byte-identical copy of the prior `handoffs/latest-handoff.md`, the final Phase B/completion
     handoff)
5. **Verification executed (`VERIFY.md` Category 1/2 — documentation/governance-only):**
   - `git --no-pager status --short`, `git --no-pager diff --stat`, `git --no-pager diff --name-only`
   - `git diff --check`
   - `npm run format:check`
   - Handoff rotation check: `diff` confirmed the archived copy is byte-identical to the
     pre-rotation `handoffs/latest-handoff.md`; `handoffs/latest-handoff.md` now holds exactly this
     one entry.
6. **Verification result:** all readback checks ran clean; `git diff --check` reported no whitespace
   errors; `npm run format:check` passed for the changed files; handoff rotation is byte-identical
   and singular.
7. **Known issues, blockers, or residual risks:** none. `AGENTS.md`, `.mcp.json`, `.claude/**`, and
   `Current Focus` were intentionally left untouched, per this task's scope. No new functional claim
   about `CODEGRAPH-001` was made; the Phase B MCP evidence itself (symbol search, relationship
   proof) is unchanged.
8. **Human review/next steps:** review and merge the PR against `chore/clean-arch-structure`. No
   further action expected on `CODEGRAPH-001`.
