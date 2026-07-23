# SSOK v2 – Repository Governance (HealthApp)

> **Quick Guide:** If you are unsure where something belongs:
>
> - project governance / working rules → `AGENTS.md`
> - verification → `VERIFY.md`
> - task ordering → `ROADMAP.md`
> - reusable automated behavior for Claude Code → `.claude/skills/`

---

## Ralph-Loop Governance (Retired)

The Ralph-Loop agent-neutral governance migration this section used to describe is **retired**.
See the "Ralph-Loop Governance / Overnight Worker (Retired)" section in
[`ROADMAP.md`](ROADMAP.md) and
[`reports/RALPH_RETIRE_001_DEAD_RUNTIME_CLEANUP.md`](reports/RALPH_RETIRE_001_DEAD_RUNTIME_CLEANUP.md)
for what it was and why. The runtime paths it referenced (`tasks/`, `runs/`, `validation/`,
`.agent/`) no longer exist in this repository.

### Active Governance Authority Hierarchy

1. **Level 1 — Repository Governance Constitution:** [`SSOK.md`](SSOK.md), [`AGENTS.md`](AGENTS.md)
2. **Level 2 — Canonical Domain Authorities:** [`ROADMAP.md`](ROADMAP.md) (planning),
   [`VERIFY.md`](VERIFY.md) (verification)
3. **Level 3 — Operational Guides / Checklists:** non-canonical operational guidance

`RALPH-RETIRE-002` (see `ROADMAP.md`) consolidated `.governance/**` into `AGENTS.md` (its
"Protected Files" and "Handoff Requirements" sections) and retired the Roo-specific `.roo/` and
`.roomodes` files — see "Legacy Roo Workflow (Retired)" below. This repository's active workflow
is Claude Code / cloud coding agents operating uniformly under `AGENTS.md`, `SSOK.md`,
`ROADMAP.md`, and `VERIFY.md`; there is no separate Roo-specific or Ralph-Loop-specific
governance layer anymore.

### Conflict Resolution Order (Deterministic)

1. **Safety wins first** — `AGENTS.md`'s "Protected Files" section overrides conflicting
   operational instructions.
2. **Canonical domain authority wins second** — planning conflicts → [`ROADMAP.md`](ROADMAP.md);
   verification conflicts → [`VERIFY.md`](VERIFY.md); cross-agent governance interpretation →
   [`AGENTS.md`](AGENTS.md), constrained by this `SSOK.md`.
3. **Historical evidence never overrides current authority** — histories are evidence/audit, not
   current planning or policy truth.

---

## Legacy Roo Workflow (Retired)

Before this repository adopted Claude Code / cloud coding agents as its primary operational
tooling, it used [Roo Code](https://roocode.com) (a VS Code extension) as the operative agent,
configured via `.roomodes` (mode definitions: Ask, Code, Architect, Agentic Guarded) and
`.roo/rules/`, `.roo/rules-code/`, `.roo/commands/` (behavioral rules and slash-command
workflows: `/feature`, `/bugfix`, `/refactor`, `/review`, `/explain`, `/commit`, `/commit-push`).

Those files are **retired** as of `RALPH-RETIRE-002` — there is no evidence of active Roo usage
in this repository's recent history, and their operational content (small focused changes,
respect architecture boundaries, no secrets in code, minimal-context edits) is already covered by
`AGENTS.md`'s Core Rules. `.roo/` and `.roomodes` were removed from the repository; see Git
history for the exact prior definitions if ever needed for reference.

---

## Product Principles

- Minimize user input friction at all costs
- Natural language is the primary input method
- Approximation is acceptable at input stage
- Users can correct data after logging
- Speed and ease-of-use take priority over perfect accuracy
- System should feel "instant" and "effortless"
