# RESOLVER-V3-014 — Knowledge-Growth Architecture & Human-Review Governance Handoff

## Status

- **Task:** `RESOLVER-V3-014`; **status:** `done`.
- **Architecture:** The accepted canonical authority is
  [`ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md`](../docs/domains/ZERA_RESOLUTION_KNOWLEDGE_GROWTH_DECISION_RECORD_1.md).
  It is Level-2 domain authority and extends, rather than replaces, Food Resolution Decision Record 1.
- **Production wiring:** Still **blocked**. RESOLVER-V3-013 remains valid evidence and its gate
  remains **NOT PASSED**; `RESOLVER-V3-010` was not unblocked.

## What Changed

- Documented four strictly separated layers: authoritative source data, private personal resolution
  memory, observations/candidates, and approved curated global knowledge.
- Bound personal P0/P1/P2, correction precedence, invalidation, candidate lifecycle, human review,
  shadow mode, negative knowledge, privacy/provenance, costs, and Learning Benchmark V2.
- Added concise binding agent invariants and minimally linked Food Resolution Decision Record 1.
- Replanned post-V3-013 work as V3-015 through V3-024. V3-008/009 history is preserved and their
  bundled future scope is explicitly superseded for planning, not silently deleted.

## No Implementation / External Effects

- No product code, database table, migration, RLS policy, dependency, prompt, provider, feature
  flag, observation writer, cache, candidate aggregator, review UI, shadow runner, promotion engine,
  correction wiring, benchmark corpus, or live AI run changed.
- No provider cost was incurred.

## Follow-up Order

Start with V3-015 (observation contract and data classification), then V3-016 privacy boundary,
V3-017 personal promotion/correction precedence, V3-018 invalidation, and V3-019 private read path.
Global aggregation/review/shadow and Benchmark V2 follow through V3-024. Numeric thresholds,
schemas, retention/access choices, and representative gates remain explicit follow-up decisions.
