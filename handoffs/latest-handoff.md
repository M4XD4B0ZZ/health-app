# RESOLVER-V3-013 — Anthropic Structured-Output Schema Remediation Handoff

## Run / Task Identity and Status

- **Task:** RESOLVER-V3-013 — Controlled Live Provider Evidence for Variants B and C
- **Status:** remains `blocked`. The controlled B/C live invocation remains incomplete technical
  evidence; this schema-only follow-up made no provider request and `RESOLVER-V3-010` remains
  blocked.

## What Changed and Why

- Corrected the Variant B provider-facing schema fragments rejected by Anthropic because nested
  object schemas lacked `additionalProperties: false`: component, quantity, totals, and
  clarification. The top-level object was already compliant.
- Bumped only `VARIANT_B_SCHEMA_VERSION` from `variant-b-schema-v1` to `variant-b-schema-v2` for
  provider compatibility. The prompt, prompt version, and estimator version are unchanged.
- Added one common recursive B/C schema-contract test (including `properties`, `items`, `anyOf`,
  `oneOf`, and `allOf` traversal with complete paths) plus the exact nested-B regression. Variant C
  was already compliant and did not change.

## Changed Files

- `src/features/nutrition/benchmark/variantBPrompt.ts`
- `src/features/nutrition/benchmark/__tests__/variantResponseSchemaContract.test.ts`
- `ROADMAP.md`
- `reports/RESOLVER_V3_013_LIVE_EVIDENCE_REPORT.md`
- `handoffs/latest-handoff.md`

## Validation Executed and Result

- Focused B schema/validator, B/C live-provider, shared recursive contract, B/C fixture-regression,
  and Variant-A-baseline tests passed with no network I/O. `npm run verify` passed (157 suites,
  1,435 tests) and remained offline with respect to provider requests.

## Known Issues / Blockers / Risks

- Actual B token usage and provider billing remain unknown because the rejected responses carried
  no usage. Reserved cost is not actual cost; C live evidence is unavailable.
- The schema-format blocker is removed, but no new evidence validates provider execution, quality,
  cost, or billing. Do not repeat this run or individual cases without a fresh explicit
  authorization for the complete fixed protocol.

## Human-Review Status

Human review and a fresh explicit authorization for the complete fixed protocol are required before
any new controlled provider run; do not start production wiring.
