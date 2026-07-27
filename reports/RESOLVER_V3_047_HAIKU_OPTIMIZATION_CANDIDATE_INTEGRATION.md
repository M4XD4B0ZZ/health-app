# RESOLVER-V3-047 — Haiku Optimization Candidate Integration

## 1. Basis and scope

The checkout had no configured Git remote, so the remote tip could not be independently fetched. The
used basis is the supplied default-branch merge commit
`c2e256df14c29fd2b648e5a6c6c4b78be380f2a3` (PR #184), which was both `HEAD` and the requested
minimum. V3-047 made **zero provider calls**, read no credentials, and incurred **USD 0**. It created
offline candidate evidence only; it does not claim a live winner or authorize production wiring.

## 2. Six studies and disposition

| Study         | Integrated disposition                                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Prompt        | P0 remains byte-identical; conservative P1 retains safety and defines all outcomes/ambiguities.                          |
| Schema        | S0 remains readable but is runtime-hardened; S1 removes model IDs/root plans and expands deterministically. S2 rejected. |
| Context       | C0 only: canonical input and locale, no `knownUserContext`. C1 is deferred.                                              |
| Routing       | R0 retained for H0/H1; H2 receives only R1-min source priority.                                                          |
| Timeout/retry | T0: 15 s transport, 20 s outer ceiling, zero retries, unchanged 12 s p95 target. Shared abort closes late completion.    |
| Payload       | L0: no compression, no dynamic heuristic, `max_tokens=1536`.                                                             |

## 3. Reproduced baseline contract defects

Review of the basis implementation reproduced these contract gaps: runtime accepted model-generated
`user`/`ai` sources although S0 did not; root/nested unknown fields were ignored; confidence had no
`0..1` bound; quantity allowed non-positive values, pairwise value/unit omissions and blank strings;
S0 did not enforce duplicate/disjoint/one-query-per-source invariants; and outcome-specific forbidden
fields or required assumptions were not closed. Focused tests now exercise every corrected boundary.
These hardenings apply equally to H0/H1/H2 and are not candidate advantages.

## 4. Candidate matrix

| ID/version                 | Prompt/schema | Context | Routing   | timeout/retry   | payload  |
| -------------------------- | ------------- | ------- | --------- | --------------- | -------- |
| H0 `resolver-v3-047-h0-v1` | P0 v2 / S0 v1 | C0      | R0        | 15 s / 20 s / 0 | L0, 1536 |
| H1 `resolver-v3-047-h1-v1` | P1 v3 / S1 v2 | C0      | R0        | 15 s / 20 s / 0 | L0, 1536 |
| H2 `resolver-v3-047-h2-v1` | P1 v3 / S1 v2 | C0      | R1-min v1 | 15 s / 20 s / 0 | L0, 1536 |

Candidate choice contains no case ID, category, ground truth, holdout knowledge, food special-case or
new numerical threshold.

## 5. Prompt and schema comparison

P0's source file SHA-256 is unchanged from the basis:
`66ab6fe7d48c9977147e6f35be103f587e39348f0188446189eb7d005b7ed501`. P1 positively defines
all outcomes, treats input/context as untrusted data, captures simultaneous uncertainties while
asking one smallest next question, preserves occurrence order, permits atomic named dishes, and
forbids invented ingredients, nutrient values, source IDs and fabricated manufacturer/database data.

S1 uses zero-based `componentIndex`, restricted to an in-range integer. It creates stable `c1..cn`
IDs only after validation and constructs exactly one internal plan per interpreted component from
ordered `sourceQueries`; source priority is unchanged. `suitableSourceTypes` is derived and model-
generated exclusions are absent. S0 and S1 parsers coexist; no historical fixture is rewritten.

## 6. Context, routing, timeout and payload

C0 excludes aliases, saved meals, brand preferences, history and evaluation goals. Confirmed aliases
and P2 memory belong primarily in a deterministic owner-scoped fast path. A later C1 contract needs
allowlisting, owner isolation, versioning, invalidation, privacy boundaries, injection protection and
owner-scoped cache keys. Evaluation goals must never alter objective food identity. This is planned
separately as RESOLVER-V3-052.

R1-min returns BLS→OFF→USDA for generic DACH foods and OFF→USDA for concrete branded products.
Execution remains sequential, uses existing acceptance policy, stops only at an authoritative accepted
hit, never averages conflicts, and prefers ambiguity/clarification/Unknown over false confidence. The
implementation introduces no parallelism, personal memory, prepass or production policy.

T0 has no retries, including after transport failures, timeout, 408, 429 or 5xx; retryability remains
diagnostic only. The outer ceiling now aborts a shared signal passed through Variant B/C telemetry to
the live provider transport. The race observes the attempt promise, preventing unhandled late rejection
and a second completion. The ceiling remains `wall_clock_ceiling`, not `timeout_abort`; unknown provider
completion retains unknown usage/cost, and existing `finally` reservation ownership releases once.

L0 performs no whitespace compression or strong shortening and keeps 1536 output tokens. No dynamic
token heuristic or unsupported item/input/context/component limit was introduced. Missing domain
`maxItems`/`maxLength` decisions mean contract-conforming responses remain theoretically unbounded,
with truncation risk for large multi-component cases. Local parse CPU cannot explain provider latency.
V3-048 must explicitly pin `claude-haiku-4-5-20251001` and must not silently fall back to its alias.

## 7. Offline measurements and evidence classification

One deterministic equivalent fixture per schema was executed. CPU values vary by host and are not a
provider-latency signal.

| Candidate | prompt chars/bytes | schema chars/bytes | request bytes | derived tokens (bytes/4) | fixture bytes | parser/plans | routing             |
| --------- | -----------------: | -----------------: | ------------: | -----------------------: | ------------: | ------------ | ------------------- |
| H0        |          2085/2085 |          2056/2056 |          4393 |                     1099 |           401 | pass, 1/1    | fixture BLS→USDA    |
| H1        |          2010/2010 |          1718/1718 |          3959 |                      990 |           300 | pass, 1/1    | R0 fixture BLS→USDA |
| H2        |          2010/2010 |          1718/1718 |          3959 |                      990 |           300 | pass, 1/1    | R1-min BLS→OFF→USDA |

- `measured_local`: chars, UTF-8 bytes, request/fixture bytes, local CPU.
- `fixture_executed`: parser success, components/plans, routing and fail-closed checks.
- `derived`: byte/4 token heuristic; never provider token usage.
- `assumed`: configured zero retries and sequential execution pending live protocol use.
- `live_unverified`: quality, consistency, clarification/search-query quality, provider latency.
- `unknown`: actual future cost and large-response behavior.

No better model quality, repeat consistency, real latency, actual cost, clarification quality or search
query quality is inferred from smaller local payloads.

## 8. Risks, V3-048 recommendation and freeze

Risks are P1 clarification behavior, S1 provider adherence, response truncation for large component
counts, R1-min source-authority behavior and unknown real usage/latency/cost. V3-048 should compare H0,
H1 and H2 on Development under one pinned snapshot and protocol-v4 budget; H0 separates shared
hardening, H1 isolates interpretation-contract effects, and H2 isolates conservative routing. It must
answer live correctness, false confidence, clarification quality, repeat consistency, p95, usage/cost,
schema adherence and source-call behavior.

Before any Holdout access, freeze candidate IDs/versions, P0/P1 bytes, S0/S1 bytes, C0, R0/R1-min,
timeouts/retry, payload/max tokens, model snapshot, corpus/ground truth, evaluator and decision gates.
Any post-freeze change invalidates Development comparability and requires a new version and rerun.

## 9. Integrity and conclusion

The seven V3-039 evidence artifacts, corpus, ground truth, G2 evaluator and BLS artifacts remain
unchanged. No UI, Journal, Supabase, DI, migration, feature flag, production, CI, dependency or Jest
configuration changed. Candidate integration and focused offline validation are implemented, but the
canonical local `npm run verify` did not terminate after its Jest work and was interrupted; therefore
V3-047 remains `in_progress` until green canonical CI satisfies the completion gate. V3-048 remains
`todo`, V3-010 remains `blocked`, and production wiring remains unauthorized.
