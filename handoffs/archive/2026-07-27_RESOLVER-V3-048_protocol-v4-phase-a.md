# Handoff — RESOLVER-V3-048 Protocol-v4 Phase A (2026-07-27)

1. **Task ID/status:** RESOLVER-V3-048 — `in_progress — protocol-v4 contract and zero-call preflight complete; live execution not authorized`; basis `d7e15aeaf0c66bab8a94eead266eb14add9e9a12`.
2. **What changed:** Added immutable protocol-v4 plan/tree hashing, candidate selection, category evidence, terminal usage/ledger/count contracts, fail-closed Holdout authorization, adapter metadata preservation, and a 22-scenario zero-network dry-run suite.
3. **Why it changed:** Phase B needs a closed, independently reviewable evidence and budget contract before any paid call; V3-047 did not prove a live winner.
4. **Files changed:** benchmark-local Protocol-v4 implementation/tests; Variant-C metadata projection and V3-047 harness; `LiveProviderUsage`; Phase-A report; `ROADMAP.md`; this handoff.
5. **Verification executed:** protocol/hash/manifest, selection, category, Holdout, usage/cost/cache, telemetry/ledger, timeout/failure, count and V3-047 compatibility tests; typecheck/lint/format/full verify/diff and immutable-path checks.
6. **Verification result:** Typecheck, lint, format, diff checks and 11 focused suites / 197 tests passed. Canonical `npm run verify` passed typecheck/lint/format and advanced through a large passing Jest set but did not terminate locally; it was interrupted after four minutes, so green GitHub Verify remains required. Provider calls 0, provider cost USD 0, credentials not read.
7. **Known issues/blockers/residual risks:** No live quality, reliability, cost, consistency, or p95 evidence exists. Remote tip/push checks are unavailable because this checkout has no configured remote. Budget is proposal-only. G2 remains not passed; V3-010 remains blocked.
8. **Human review/next steps:** Review and merge only after green CI, then independently inspect the merge. Phase B still requires explicit human approval of exact call/token/USD limits and must never auto-continue to Holdout.
