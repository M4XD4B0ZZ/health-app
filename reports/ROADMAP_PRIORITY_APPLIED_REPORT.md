# ROADMAP-PRIORITY-002 — Roadmap Priority Applied Report

## Scope

Applied the approved roadmap reprioritization from `reports/ROADMAP_PRIORITY_REVIEW.md` as a roadmap-only governance/planning update.

No product code, resolver implementation, runtime logic, scripts, package files, validation files, or push actions were changed/performed.

## Files Changed

- `ROADMAP.md`
- `reports/ROADMAP_PRIORITY_APPLIED_REPORT.md`
- `handoffs/latest-handoff.md`

## Priority Changes Applied

`ROADMAP.md` now includes an explicit tier structure aligned to the approved strategic priorities:

1. Zero-friction logging
2. Trust-first UX
3. Private-use-first
4. DACH-first deterministic resolver
5. Infrastructure
6. Public launch
7. Monetization

### Tier 1 — Core Product Value

- `P1-003 Multi-Item Split`
- `Journal`
- `Saved Meals`
- `Dashboard`
- `Goals`

### Tier 2 — Core Architecture

- `P2-001 Verify Environment Wiring`
- `P2-002 Enforce Single Supabase Client`
- `RESOLVER-V2-001`
- `RESOLVER-V2-002`
- `RESOLVER-V2-003`
- `RESOLVER-V2-004`

### Tier 3 — Infrastructure

- `P2-003 Document Edge Functions Deploy Process`
- `P2-007 Deploy & Verify Guardrails`
- `RESOLVER-V2-005`
- `RESOLVER-V2-006`
- `Reminders`
- `Insights`

### Tier 4 — Public Launch

- `P2-008 Apple/Google Login via Supabase Auth`
- `Health Sync`

### Tier 5 — Monetization

- `P2-009 RevenueCat Entitlements`
- `P2-010 Paid-only Gating for AI Endpoints`
- `RESOLVER-V2-007`

## Moved-Up Tasks / Planning Targets

- `P1-003 Multi-Item Split` is now the first Tier 1 concrete task.
- `Journal` is now explicitly listed as a Tier 1 planning target requiring later decomposition.
- `Saved Meals` is now explicitly listed as a Tier 1 planning target requiring later decomposition.
- `Dashboard` is now explicitly listed as a Tier 1 planning target requiring later decomposition.
- `Goals` is now explicitly listed as a Tier 1 planning target requiring later decomposition.
- `P2-001 Verify Environment Wiring` moved into Tier 2 as near-term core architecture/private-use stability work.
- `P2-002 Enforce Single Supabase Client` moved into Tier 2 as core architecture hygiene.
- `RESOLVER-V2-001` through `RESOLVER-V2-004` moved into Tier 2 as DACH-first deterministic resolver architecture work.

## Moved-Down Tasks / Planning Targets

- `P2-003 Document Edge Functions Deploy Process` moved to Tier 3 infrastructure.
- `P2-007 Deploy & Verify Guardrails` moved to Tier 3 infrastructure.
- `RESOLVER-V2-005` and `RESOLVER-V2-006` moved to Tier 3 infrastructure/knowledge persistence.
- `Reminders` and `Insights` moved to Tier 3 planning targets.
- `P2-008 Apple/Google Login via Supabase Auth` moved to Tier 4 public launch.
- `Health Sync` moved to Tier 4 planning target.
- `P2-009 RevenueCat Entitlements`, `P2-010 Paid-only Gating for AI Endpoints`, and `RESOLVER-V2-007 AI-Assisted Re-Ranking` moved to Tier 5 monetization/deferred AI gating.

## Journal Planning

Because `Journal`, `Saved Meals`, `Dashboard`, and `Goals` were previously only unscoped Phase 3 module rows, `ROADMAP.md` now contains a Tier 1 planning placeholder section for them.

The placeholder explicitly states that these are planning targets only and must be decomposed into concrete, verifiable tasks before implementation. No implementation details were invented.

## Task Content Preserved Confirmation

Confirmed: existing task IDs, statuses, DoDs, descriptions, and Verify text were preserved while reordering/grouping the planning structure.

The roadmap edit only changed ordering/grouping and added planning structure/placeholders required by the approved review.

## Scope Safety Confirmation

- No `src/` changes.
- No `supabase/` changes.
- No `package.json` changes.
- No `package-lock.json` changes.
- No runtime files changed.
- No validation files changed.
- No scripts created or modified.
- No push performed.

## Verification / Final Checks

Required read-only git checks for this roadmap-only update:

1. `git --no-pager status --short`
2. `git --no-pager diff --stat`
3. `git --no-pager diff --name-only`

Results are documented in `handoffs/latest-handoff.md` after execution.

## Risks / Follow-Ups

- `Journal`, `Saved Meals`, `Dashboard`, `Goals`, `Reminders`, `Insights`, and `Health Sync` remain planning targets and still require later task decomposition before implementation.
- Resolver V2 tasks remain technically broad; implementation should be kept narrow and separately verified when those tasks start.
- Public launch and monetization work is intentionally deferred; future reprioritization should update the tier structure if strategy changes.
