# RESOLVER-V3-013 — Anthropic Messages Transport Diagnosis Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** remains `blocked`. This run diagnosed only the preceding transport failure; it did
  not run a Variant B/C benchmark or use the real provider key. `RESOLVER-V3-010` remains blocked.

## What Changed and Why

- Added a reproducible, secret-safe transport diagnosis report and linked its evidence from the
  existing live-evidence report and the ROADMAP task record.
- This isolates the prior generic Node `fetch failed` result without altering a provider adapter,
  prompt, schema, ground truth, or benchmark result.

## Changed Files

- `reports/RESOLVER_V3_013_ANTHROPIC_TRANSPORT_DIAGNOSIS.md`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`
- `ROADMAP.md`
- `handoffs/latest-handoff.md`

## Validation Executed and Result

- System and Node DNS resolution checks for `api.anthropic.com` passed.
- A curl dummy-key TLS/POST probe received HTTP 401 with successful TLS verification.
- Node v20.20.2's benchmark-equivalent global fetch failed before HTTP with `TypeError: fetch
failed`, caused by `AggregateError` / `ENETUNREACH`; IPv4-first did not change it.
- The same Node fetch received HTTP 401 when the preconfigured HTTPS proxy was explicitly supplied
  through Undici's `ProxyAgent`, proving the missing Node/Undici proxy dispatcher is the blocker.
- Repository secret-pattern scan, whitespace validation, and documentation readback checks passed.

## Known Issues / Blockers / Risks

- The real API key was not read, printed, committed, or used. No billed request, fixture fallback,
  prompt/schema/ground-truth change, or B/C live rerun occurred.
- A separately scoped and reviewed proxy-aware transport change, followed by a dummy-key transport
  recheck, is required before exactly one future full protocol rerun.

## Human-Review Status

Human review is required before modifying benchmark transport configuration. Do not rerun any
provider benchmark until that reviewed change and dummy-key recheck succeed.
