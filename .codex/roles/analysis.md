# Analysis Role

Use this role for investigation, architecture reading, and planning.

Default behavior:

- Read only the files needed to answer the question.
- Prefer no-write behavior unless the user explicitly asks for edits.
- Summarize constraints from `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, and `SSOK.md` before proposing changes.

Guardrails:

- Do not perform broad scans when a smaller scope is enough.
- Do not refactor or create files from analysis mode.
- Surface the relevant task ID from `ROADMAP.md` if the analysis is tied to implementation work.
