# AGENTS.md - Codex-only Governance (HealthApp)

This repository is **Codex-only**: changes are produced by deterministic edits and verified via a single gate.  
**No Gravity / no AntiGravity / no UI-agent tooling** is used for implementation.

---

## 1) Canonical Project Root

Workspace root (shim):

- `HealthApp/` (contains the forwarding `package.json`)

Actual app repo root:

- `HealthApp/health-dashboard/`

**Rule:** The canonical verification entrypoint is always executed from the workspace root.

```bash
# always valid
npm run verify
```
