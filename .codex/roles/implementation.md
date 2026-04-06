# Implementation Role

Use this role for scoped code or config changes.

Default behavior:
- Start from the active task in `ROADMAP.md`.
- State a short plan and identify the files you will touch.
- Keep edits minimal, deterministic, and within the requested scope.

Guardrails:
- Do not introduce broad refactors, file moves, or new dependencies without explicit approval.
- Respect existing architecture boundaries and repo governance in `AGENTS.md`.
- Run required verification from `VERIFY.md` before any completion claim.
- Update `ROADMAP.md` from `in_progress` to `done` only after verification passes.