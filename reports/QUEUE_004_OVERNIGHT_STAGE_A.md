# QUEUE-004 Overnight Smoke — Stage A

- **Task ID:** `QUEUE-004A`
- **Issue:** #148

## Purpose

Verify the first half of a genuinely unattended sequential queue run: that the Claude Queue can
claim an approved issue, implement it, verify it, open a PR, watch CI, and merge without a human
progress prompt, and that the run can survive scheduled wake-ups across a real multi-hour gap
before Stage B is allowed to begin.

## Test clock

- `testStartedAtUtc`: `2026-07-23T13:29:13Z`
- `stageBReleaseAtUtc`: `2026-07-23T17:29:13Z`

## Scope statement

This file contains no product behavior or production evidence. It is a synthetic marker created
solely to validate queue plumbing (issue → branch → PR → CI → merge → `queue:done`).

Stage B (`QUEUE-004B`) must not start before `stageBReleaseAtUtc` above.
