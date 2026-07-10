# ROADMAP-PRIORITY-001 — Roadmap Priority Review

## Scope

Analysis-only review of the current `ROADMAP.md` execution order against the current project strategy.

No roadmap edits, status changes, implementation, or commits were performed.

## Sources read

- `ROADMAP.md`
- `SSOK.md`
- `AGENTS.md`
- `VERIFY.md`

## Strategic lens used

- Conversation-first nutrition logging
- Zero-friction input
- Private-use-first deployment
- Monetization deferred
- DACH-first resolver strategy
- Trust-first UX
- Deterministic-first architecture

## Executive recommendation

The roadmap should prioritize the smallest path to a trustworthy private-use nutrition logger before public-launch infrastructure or monetization.

Recommended high-level order:

1. Finish the core logging experience: multi-item input, editable journal, and confidence/error recovery.
2. Stabilize resolver quality around DACH-first, source-native, deterministic matching.
3. Add only the infrastructure needed for private-use reliability and safe remote operation.
4. Defer public-launch auth/subscription/entitlement work until retention-critical product loops are proven.
5. Defer monetization until after trusted logging, journal, and retention loops exist.

## Current open tasks and recommended timing

| Task                                                       | User value                                               | MVP relevance       | Private-use relevance                 | Technical dependency level | Risk level     | Recommended timing |
| ---------------------------------------------------------- | -------------------------------------------------------- | ------------------- | ------------------------------------- | -------------------------- | -------------- | ------------------ |
| P1-003 Multi-Item Split                                    | Very high: users naturally log meals with multiple foods | Very high           | Very high                             | Medium                     | Medium         | Now                |
| P2-001 Verify Environment Wiring                           | Medium: prevents confusing runtime failures              | Medium              | High                                  | Low                        | Low            | Now                |
| P2-002 Enforce Single Supabase Client                      | Medium: reduces integration drift                        | Medium              | Medium                                | Medium                     | Medium         | Next               |
| P2-003 Document Edge Functions Deploy Process              | Low-to-medium direct user value                          | Low for private MVP | Medium                                | Low                        | Low            | Later              |
| P2-007 Deploy & Verify Guardrails                          | Medium: safe remote operation                            | Medium              | Medium if using remote edge functions | Medium                     | Medium         | Later              |
| P2-008 Apple/Google Login via Supabase Auth                | Low for private use, high later                          | Low now             | Low                                   | High                       | Medium         | Much later         |
| P2-009 RevenueCat Entitlements                             | Low now                                                  | Low                 | Low                                   | High                       | High           | Much later         |
| P2-010 Paid-only Gating for AI Endpoints                   | Low now                                                  | Low                 | Low                                   | High                       | Medium         | Much later         |
| Phase 3 — Journal                                          | Very high: editability and daily review create trust     | Very high           | Very high                             | Medium                     | Medium         | Now                |
| Phase 3 — Goals                                            | Medium: useful but not required for first logging loop   | Medium              | Medium                                | Medium                     | Medium         | Next               |
| Phase 3 — Saved Meals                                      | High: reduces repeated logging friction                  | High                | High                                  | Medium                     | Medium         | Next               |
| Phase 3 — Reminders                                        | Medium: retention support, not core accuracy             | Medium              | Medium                                | Medium                     | Medium         | Later              |
| Phase 3 — Dashboard                                        | Medium: feedback/progress loop                           | Medium              | Medium                                | Medium                     | Medium         | Next               |
| Phase 3 — Health Sync                                      | Low for private MVP                                      | Low                 | Low                                   | High                       | High           | Much later         |
| Phase 3 — Insights                                         | Medium-to-high after enough data exists                  | Medium later        | Medium                                | High                       | Medium         | Later              |
| RESOLVER-V2-001 Remove Early Translation Layer             | High: reduces DACH mismatch and trust loss               | High                | High                                  | Medium                     | Medium         | Now                |
| RESOLVER-V2-002 Implement Source-Native Query Adapters     | High: DACH-first matching foundation                     | High                | High                                  | Medium                     | Medium         | Now                |
| RESOLVER-V2-003 Implement Multi-Source Candidate Retrieval | High: better match quality                               | High                | High                                  | High                       | Medium-to-high | Next               |
| RESOLVER-V2-004 Build Candidate Fusion Layer               | Very high: central trust/quality decisioning             | High                | High                                  | High                       | High           | Next               |
| RESOLVER-V2-005 Introduce Supabase Knowledge Layer Tables  | Medium now, high later                                   | Medium              | Medium                                | High                       | High           | Later              |
| RESOLVER-V2-006 Persist Resolution Decisions               | Medium now, high later                                   | Medium              | Medium                                | High                       | Medium-to-high | Later              |
| RESOLVER-V2-007 AI-Assisted Re-Ranking                     | Low now due deterministic-first/private-use-first        | Low                 | Low                                   | High                       | High           | Much later         |

## Tier grouping

### Tier 1 — Core product value

These directly improve the user’s nutrition logging loop and should lead execution.

1. **P1-003 Multi-Item Split**
   - Rationale: Conversation-first logging requires users to type natural meal descriptions like `ei und quark` without manual decomposition.
   - Move: Up / keep immediate.

2. **Phase 3 — Journal**
   - Rationale: Trust-first UX requires logged entries to be reviewable and editable. Without an editable journal, direct-save logging remains risky.
   - Move: Up strongly, even though Phase 3 says modules are not yet scoped.

3. **Phase 3 — Saved Meals**
   - Rationale: Private-use users often repeat meals. Saved meals reduce friction more than account/payment features.
   - Move: Up after Journal basics.

4. **Phase 3 — Dashboard**
   - Rationale: A lightweight summary closes the feedback loop and improves perceived value, but should follow reliable logging and editability.
   - Move: Up moderately.

5. **Phase 3 — Goals**
   - Rationale: Useful for interpreting logs, but less urgent than making logging fast, trustworthy, and editable.
   - Move: Up moderately, after the logging loop is stable.

### Tier 2 — Core architecture

These make the core deterministic resolver more trustworthy, especially for DACH inputs.

1. **RESOLVER-V2-001 Remove Early Translation Layer**
   - Rationale: Early DE→EN translation conflicts with DACH-first strategy and can produce semantically wrong matches.
   - Move: Up strongly.

2. **RESOLVER-V2-002 Implement Source-Native Query Adapters**
   - Rationale: Enables BLS/DACH, USDA, and OFF to receive appropriate source-native queries without global translation bias.
   - Move: Up strongly.

3. **RESOLVER-V2-003 Implement Multi-Source Candidate Retrieval**
   - Rationale: Needed before reliable cross-source comparison; increases match quality but may increase complexity/latency.
   - Move: Next, after source-native query behavior is established.

4. **RESOLVER-V2-004 Build Candidate Fusion Layer**
   - Rationale: Trust-first UX depends on explainable scoring, confidence, and plausibility decisions.
   - Move: Next, paired with or immediately after multi-source retrieval.

5. **P2-001 Verify Environment Wiring**
   - Rationale: Small, low-risk stability task that prevents confusing local/private deployment failures.
   - Move: Up to Now because it is cheap and stabilizes private-use execution.

6. **P2-002 Enforce Single Supabase Client**
   - Rationale: Good architecture hygiene, but less user-visible than logging and resolver correctness.
   - Move: Next.

### Tier 3 — Infrastructure

These support safe operation but should not outrank the core private-use product loop.

1. **P2-003 Document Edge Functions Deploy Process**
   - Rationale: Useful for deployment repeatability, but not immediately required if private-use iteration is still local/manual.
   - Move: Down to Later.

2. **P2-007 Deploy & Verify Guardrails**
   - Rationale: Important before any broader remote use, but guardrail implementation tasks are already done and private-use can tolerate delayed production deploy work.
   - Move: Down to Later unless active remote testing requires it.

3. **RESOLVER-V2-005 Introduce Supabase Knowledge Layer Tables**
   - Rationale: Valuable long-term learning infrastructure, but heavier than needed before resolver behavior is validated locally/deterministically.
   - Move: Later.

4. **RESOLVER-V2-006 Persist Resolution Decisions**
   - Rationale: Useful for debugging and learning, but depends on schema/knowledge layer and correction UX.
   - Move: Later.

5. **Phase 3 — Reminders**
   - Rationale: Retention support feature, but should follow a product loop worth returning to.
   - Move: Later.

6. **Phase 3 — Insights**
   - Rationale: Insights need sufficient trusted historical data; premature implementation risks low relevance.
   - Move: Later.

### Tier 4 — Public launch

These matter for a public product but are not required for private-use-first validation.

1. **P2-008 Apple/Google Login via Supabase Auth**
   - Rationale: Public use needs identity, but private-use-first can operate without OAuth complexity.
   - Move: Down to Much later.

2. **Phase 3 — Health Sync**
   - Rationale: High integration risk and not necessary for validating core nutrition logging.
   - Move: Down to Much later.

### Tier 5 — Monetization

These should be explicitly deferred until retention and product value are proven.

1. **P2-009 RevenueCat Entitlements**
   - Rationale: Monetization is deferred; implementing subscription state before retention-critical logging risks wasted complexity.
   - Move: Down to Much later.

2. **P2-010 Paid-only Gating for AI Endpoints**
   - Rationale: AI endpoints and paid gating are not part of the deterministic-first private MVP path.
   - Move: Down to Much later.

3. **RESOLVER-V2-007 AI-Assisted Re-Ranking**
   - Rationale: Conflicts with deterministic-first unless strictly limited after deterministic fusion is stable. Also increases cost and policy surface.
   - Move: Down to Much later.

## Tasks that should move up

- **P1-003 Multi-Item Split** — immediate user value for conversation-first meal logging.
- **Phase 3 — Journal** — should be scoped earlier because editability is central to trust-first UX.
- **RESOLVER-V2-001 Remove Early Translation Layer** — directly supports DACH-first correctness.
- **RESOLVER-V2-002 Implement Source-Native Query Adapters** — foundational for DACH/BLS, OFF, and USDA routing.
- **P2-001 Verify Environment Wiring** — low-risk stability win for private-use deployment.
- **Phase 3 — Saved Meals** — high friction-reduction value once journal/edit loop exists.
- **Phase 3 — Dashboard / Goals** — useful after logging is trustworthy, but should remain behind journal and resolver quality.

## Tasks that should move down

- **P2-008 Apple/Google Login via Supabase Auth** — public-launch concern, not private-use-first.
- **P2-009 RevenueCat Entitlements** — monetization deferred.
- **P2-010 Paid-only Gating for AI Endpoints** — monetization/AI gating deferred.
- **RESOLVER-V2-007 AI-Assisted Re-Ranking** — deterministic resolver should be proven first.
- **Phase 3 — Health Sync** — high integration cost, weak MVP necessity.
- **P2-003 Document Edge Functions Deploy Process** — useful but can follow core product stabilization.
- **P2-007 Deploy & Verify Guardrails** — important before public/remote operation, but not above private-use product value unless remote edge deployment is actively needed.

## Proposed new roadmap sequence

This is a proposed sequence only; `ROADMAP.md` was not modified.

### Now

1. **P1-003 Multi-Item Split**
2. **P2-001 Verify Environment Wiring**
3. **RESOLVER-V2-001 Remove Early Translation Layer**
4. **RESOLVER-V2-002 Implement Source-Native Query Adapters**
5. **Scope Phase 3 — Journal into concrete tasks**
6. **Implement minimal editable Journal / daily log flow**

### Next

7. **RESOLVER-V2-003 Implement Multi-Source Candidate Retrieval**
8. **RESOLVER-V2-004 Build Candidate Fusion Layer**
9. **P2-002 Enforce Single Supabase Client**
10. **Scope and implement Saved Meals basics**
11. **Scope and implement lightweight Dashboard summary**
12. **Scope and implement basic Goals / macro targets**

### Later

13. **P2-003 Document Edge Functions Deploy Process**
14. **P2-007 Deploy & Verify Guardrails**
15. **RESOLVER-V2-005 Introduce Supabase Knowledge Layer Tables**
16. **RESOLVER-V2-006 Persist Resolution Decisions**
17. **Scope Reminders**
18. **Scope Insights after enough journal data exists**

### Much later

19. **P2-008 Apple/Google Login via Supabase Auth**
20. **Phase 3 — Health Sync**
21. **RESOLVER-V2-007 AI-Assisted Re-Ranking**
22. **P2-009 RevenueCat Entitlements**
23. **P2-010 Paid-only Gating for AI Endpoints**

## Rationale details

### Why logging and journal should precede public launch work

The current strategic context emphasizes private-use-first and zero-friction logging. OAuth, RevenueCat, and paid gating do not help validate whether the user can quickly and repeatedly log food with confidence. An editable journal does.

### Why DACH resolver tasks should move up

The roadmap explicitly identifies DACH-first strategy and warns against global approximation and averaging. Resolver tasks that remove early translation and enable source-native routing directly reduce false matches for German-language inputs and are aligned with deterministic-first architecture.

### Why Supabase knowledge persistence should wait

Long-term knowledge tables and decision persistence are valuable, but their schema should follow stable resolver semantics. Implementing persistence before the candidate model and fusion layer are validated risks locking in premature abstractions.

### Why monetization should be last

The strategic context says monetization is deferred. RevenueCat and paid-only AI gating introduce integration, state, edge authorization, and support complexity without improving the current private MVP logging loop.

## Risk notes

- **Highest product risk:** building infrastructure/payment/auth before the logging loop is trusted and repeatable.
- **Highest technical risk:** Resolver V2 tasks can become broad refactors; they should be split and verified narrowly.
- **Highest UX risk:** direct-save logging without fast edit/recovery can reduce trust even if macro resolution improves.
- **Highest strategy risk:** AI-assisted features too early may conflict with deterministic-first and private-use cost discipline.

## Verification plan for this analysis task

Per the user request, run separately:

```bash
git --no-pager status --short
```
