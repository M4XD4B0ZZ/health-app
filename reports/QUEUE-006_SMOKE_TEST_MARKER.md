# QUEUE-006 Smoke Test Marker

This file was created autonomously by the `queue-run` skill (`.claude/skills/queue-run/SKILL.md`)
as the Phase-B unattended smoke test task for `QUEUE-005`
(`docs/automation/CLAUDE_QUEUE_CONTRACT.md`). It has no product value — its sole purpose is
proving the externally triggered unattended path (`.github/workflows/claude-queue-wake.yml`) works
end-to-end with real, GitHub-configured authentication, picked up automatically by a scheduled
15-minute tick rather than a manual `/queue-run` invocation.

- **Task ID:** `QUEUE-006`
- **Source issue:** #155
- **Branch:** `queue/queue-006-smoke-test-marker`
- **PR:** (filled in once opened)
- **Task picked up:** 2026-07-23T20:37Z
- **Auth mode that actually ran:** `api` (fallback) — the primary `oauth`-mode attempt for this
  invocation (workflow run 30042462443) failed before this fallback ran; the workflow's runtime
  fallback (fixed in PR #156, which granted `id-token: write` and corrected the fallback step
  conditions to use `always()`) switched over to the `api` mode using `ANTHROPIC_API_KEY`, and this
  worker session is the one that executed under that fallback.
- **Scope confirmation:** no other file was created, modified, or deleted by this task.
