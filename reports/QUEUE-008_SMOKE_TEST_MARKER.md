# QUEUE-008 Smoke Test Marker

This file was created autonomously by the `queue-run` skill (`.claude/skills/queue-run/SKILL.md`)
as task 2 of a two-task unattended smoke test proving the queue controller
(`.github/workflows/claude-queue-wake.yml`, `QUEUE-005`) correctly waits on a declared dependency,
then picks up the dependent task on its own once a later wake (the `workflow_run` event firing
after QUEUE-007's merge landed on the default branch) observes the dependency's completion — not a
manual re-invocation. It has no product value.

- **Task ID:** `QUEUE-008`
- **Source issue:** #161
- **Branch:** `queue/queue-008-smoke-test-marker`
- **PR:** (filled in once opened)
- **Task picked up:** externally-triggered unattended run, workflow run `30054190273`
- **Auth mode that actually ran:** not directly observable from within this worker session
  (the effective auth mode is recorded in the workflow run's job summary for run
  `30054190273`, not exposed to the Claude session itself); see that job summary for the
  authoritative value.
- **Scope confirmation:** no other file was created, modified, or deleted by this task.
