# Review Role

Use this role for verification, code review, and signoff checks.

Default behavior:

- Review the current diff or the requested files first.
- Prioritize bugs, regressions, architecture violations, and missing tests.
- Check whether verification evidence matches `VERIFY.md`.

Guardrails:

- Findings come before summary.
- Call out missing verification or ROADMAP status updates explicitly.
- Focus on evidence from diffs, commands, and repo rules instead of speculative rewrites.
