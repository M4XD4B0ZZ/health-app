# HealthApp Workspace

The runnable project root is `health-dashboard/`.

Root-level scripts in this folder are shims that forward commands (for example `npm run verify`) to `health-dashboard/` for a single deterministic verification entry point.

This is a workspace shim.

All real application code lives in:

    health-dashboard/

All root-level npm scripts forward into that folder.

Canonical verify command:

    npm run verify
