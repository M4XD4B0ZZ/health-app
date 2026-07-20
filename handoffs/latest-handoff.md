# RESOLVER-V3-013 — Proxy-Aware Anthropic Benchmark Transport Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** remains `blocked`. This run implemented and tested only the benchmark-local transport
  repair; it did not run a Variant B/C benchmark or use the real provider key. `RESOLVER-V3-010`
  remains blocked.

## What Changed and Why

- Added `AnthropicBenchmarkTransport`, the one shared benchmark-local B/C transport factory. It
  selects only standard proxy-variable presence, injects an Undici `ProxyAgent` dispatcher per
  request, and leaves direct transport unchanged when no proxy is configured.
- Both provider adapters retain the credential guard and shared budget reservation before their HTTP
  request. No prompt, schema, ground truth, fixture, production wiring, or provider decision changed.

## Changed Files

- `src/features/nutrition/benchmark/AnthropicBenchmarkTransport.ts`
- `src/features/nutrition/benchmark/VariantBLiveProvider.ts`
- `src/features/nutrition/benchmark/VariantCLiveInterpretationProvider.ts`
- `src/features/nutrition/benchmark/__tests__/AnthropicBenchmarkTransport.test.ts`
- `reports/RESOLVER_V3_013_ANTHROPIC_PROXY_TRANSPORT_EVIDENCE.md`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`
- `ROADMAP.md`
- `handoffs/latest-handoff.md`

## Validation Executed and Result

- Focused transport, B/C live-provider, and shared-budget-gate tests passed.
- A/B/C fixture regression tests passed offline.
- One post-change Node/Undici dummy-key POST used the explicit dispatcher and received HTTP 401;
  no proxy value, key, authorization header, or environment dump was output.
- `npm run typecheck`, `npm run lint`, and `npm run format:check` passed before full verification.

## Known Issues / Blockers / Risks

- The real API key was not read, printed, committed, or used. No billed request, fixture fallback,
  prompt/schema/ground-truth change, or B/C live rerun occurred.
- `undici` is currently available transitively rather than declared as a direct package dependency;
  future environment dependency changes could affect this benchmark-local transport.
- Proxy presence differs by environment. A direct path is deliberately retained when none is set.

## Human-Review Status

The dummy-key recheck succeeded. Human review is still required before one fixed full provider
protocol run; do not rerun individual cases or start production wiring.
