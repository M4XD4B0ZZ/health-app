# Handoff — PROMPT-GOV-001 Compact Task-Initiating Prompt Contract (2026-07-29)

1. **Task ID/status:** `PROMPT-GOV-001` — `done`. Branch: `claude/prompt-gov-001-d4mfuj`. Basis:
   `c0420e7` (tip of `origin/chore/clean-arch-structure`, PR #197 merge, confirmed current — no
   divergence between this branch and the base at task start).
2. **What changed:**
   - `AGENTS.md`: added "Prompt Contract for Task-Initiating Prompts (Binding)" directly after the
     existing Task-Start Read Contract section — the 7 elements a task-initiating prompt must
     contain, and the list of content that must not be routinely pasted into prompts (full project
     overviews, historical summaries, copied `ROADMAP.md`/`VERIFY.md`/`AGENTS.md` sections, old
     handoffs, already-canonical general rules, large status blocks). Added a nested "CodeGraph
     Availability (Binding)" sub-section: CodeGraph must not be claimed available before
     `CODEGRAPH-001` completes; `CODEGRAPH-001` is the explicit bootstrap exception; the concrete
     fail-closed rule is left for `CODEGRAPH-001` to define, not invented here.
   - `ROADMAP.md`: added the `PROMPT-GOV-001` task entry under "EPIC: Developer Tooling &
     Verification" (directly after `CONTEXT-GOV-001`, since it depends on it), and a one-line
     addition to `Current Focus` noting `PROMPT-GOV-001` is done — no other wording in `Current
Focus` touched, and no RESOLVER-V3-048/V3-010 content touched.
   - `handoffs/latest-handoff.md`: rotated per the binding Handoff Rotation rule — the previous
     `CONTEXT-GOV-001` entry archived unchanged (byte-identical, verified via `diff`) to
     `handoffs/archive/2026-07-29_CONTEXT-GOV-001_task-start-context-governance-rebased-reconciled.md`,
     then replaced with this single new entry.
3. **Why it changed:** task-initiating prompts had been repeating full project overviews,
   historical summaries, and copied canonical-document sections on top of the repository context
   `CONTEXT-GOV-001` already made selectively readable by the agent. That repetition is unnecessary
   token cost with no safety benefit, since the agent reads the current canonical state itself per
   the Task-Start Read Contract. This task adds the missing counterpart rule: what the
   dispatching/prompt side should (and should not) put in the prompt itself.
4. **Files changed:**
   - `AGENTS.md` (new "Prompt Contract for Task-Initiating Prompts (Binding)" section + nested
     "CodeGraph Availability (Binding)" sub-section)
   - `ROADMAP.md` (`PROMPT-GOV-001` task entry added; one-line `Current Focus` addition)
   - `handoffs/latest-handoff.md` (replaced; now holds only this entry)
   - `handoffs/archive/2026-07-29_CONTEXT-GOV-001_task-start-context-governance-rebased-reconciled.md`
     (new; byte-identical copy of the prior `handoffs/latest-handoff.md`)
5. **Verification executed:** documentation/governance-only change per `VERIFY.md` Category 1/2:
   `git --no-pager status --short`, `git --no-pager diff --stat` (against
   `origin/chore/clean-arch-structure`), `git --no-pager diff --name-only`, `git diff --check`,
   `npm run format:check`; a `diff` confirming the archived handoff is byte-identical to the
   pre-rotation `handoffs/latest-handoff.md`; a manual scope check that only `AGENTS.md`,
   `ROADMAP.md`, and `handoffs/**` changed.
6. **Verification result:** all readback checks ran cleanly (`git status --short` showed only the
   expected 3 modified + 1 new file; `git diff --stat`/`--name-only` against
   `origin/chore/clean-arch-structure` confirmed only `AGENTS.md`, `ROADMAP.md`, and
   `handoffs/latest-handoff.md` changed); `git diff --check` reported no whitespace errors;
   `npm run format:check` failed once (`AGENTS.md`, `handoffs/latest-handoff.md` needed
   reformatting), was fixed with `prettier --write` on those two files (no content change, verified
   by inspection of the diff), then passed clean (`All matched files use Prettier code style!`); the
   archived handoff was confirmed byte-identical to the pre-rotation file via `diff` (no output). No
   `npm run verify` (product/runtime suite) was run — not applicable per Category 1/2, and no
   product/runtime file was touched.
7. **Known issues, blockers, or residual risks:** none specific to this task. CodeGraph remains
   unregistered in `.mcp.json` and out of scope (tracked by `CODEGRAPH-001`, still not started).
   `ROADMAP.md` remains large by design (the Task-Start Read Contract, not a file split, is the
   accepted mitigation — see `CONTEXT-GOV-001`'s "Explicitly out of scope" note, unchanged by this
   task).
8. **Human review/next steps:** push this branch; open a PR against `chore/clean-arch-structure`;
   wait for GitHub Verify to actually complete green (not merely start) before merging; the user
   merges via GitHub; an independent post-merge review of the merged diff is required afterward per
   the task's Git/PR closure requirements.
