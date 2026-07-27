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

---

## 10. Post-merge executable-candidate correction (2026-07-27)

### Basis and reproduced residual defects

The correction started at local/default-branch tip `e6615816e7ce066971061e33109ab5b55351258e`
(PR #185). This checkout has no configured remote, so an independent remote fetch was impossible;
the supplied expected merge commit and local tip match exactly. The pre-correction review reproduced
that H2 only returned an R1-min list, retrieval still called all planned sources, the fast path lacked
an H2 structural proof gate, the harness synthesized call decisions, the provider hard-coded P0/S0,
and S1 discarded `reason` during clarification. Focused red-baseline assertions for those boundaries
failed against the merge implementation; the corrected command is recorded in the handoff.

### Closed executable request/parser path

Each H0/H1/H2 object now carries its parser, pinned model snapshot, temperature, complete timeout/
retry/token policy, prompt/schema and their versions. One canonical request builder consumes that
object. The provider accepts an explicit candidate, pins `claude-haiku-4-5-20251001`, sends H0 P0/S0
or H1/H2 P1/S1, parses through the selected parser, and emits candidate/prompt/schema versions in run
metadata. The omitted-candidate path remains compatible with H0 and the historical model selection.
Injected transports prove this without network access; there is no silent H1/H2 downgrade.

### S1 coherence and R1-min execution

S1 now rejects a root `reason` for `clarification_required` rather than dropping it. Existing shared
S0 validation already rejects that field and enforces the same not-interpretable/interpreted outcome
rules. S1 continues to forbid clarification retrieval fields and constructs exactly one internal plan
per interpreted component.

H2 now selects R1-min in the real Variant-C adapter. Its benchmark-local tier executor calls sources
sequentially, accumulates candidates, and invokes the unchanged `ScoreCalculator` and
`buildResolverDecision` after every tier. An authoritative accepted current tier stops execution and
records lower tiers as avoided; empty, rejected, ambiguous, error, or non-authoritative results
continue. Generic order is BLS→OFF→USDA and branded order OFF→USDA. No averaging, score formula, or
acceptance threshold was introduced. H2 additionally requires an injected positive deterministic
single-component proof before using the legacy fast path; absent proof fails closed to the one-call AI
path. H0/H1 retain R0 behavior.

### Offline call matrix and evidence labels

| Scenario                                   |               AI calls |                      BLS |                      OFF |                     USDA | Result evidence                            |
| ------------------------------------------ | ---------------------: | -----------------------: | -----------------------: | -----------------------: | ------------------------------------------ |
| H0/H1 request/parser fixture               |       1 fake transport |              per R0 plan |              per R0 plan |              per R0 plan | `fixture_executed`                         |
| H2 generic, BLS accepted                   |         parser fixture |                        1 |                        0 |                        0 | `fixture_executed`; avoided calls asserted |
| H2 generic, earlier tier unresolved        |         parser fixture |                        1 |              1 as needed |              1 as needed | `fixture_executed`                         |
| H2 branded                                 |         parser fixture |                        0 |                        1 |                   0 or 1 | `fixture_executed`                         |
| H2 without positive single-component proof | exactly 1 fake AI call | interpretation-dependent | interpretation-dependent | interpretation-dependent | `fixture_executed`                         |
| contract error / clarification             |         1 fake AI call |                        0 |                        0 |                        0 | `fixture_executed`                         |

Request/schema byte sizes and local CPU durations are `measured_local`; byte/4 token estimates are
`derived`; provider quality, latency and cost remain `live_unverified`; anything not emitted by the
fake path is `unknown`. No configured lower bound is represented as an exact external-call count.
Existing outer-ceiling tests remain the authority for true abort propagation, exactly-once reservation
release, one terminal telemetry record and observed late rejection.

### Integrity and status

Provider calls were exactly **0** and provider cost exactly **USD 0**. No credential was read. The
seven frozen V3-039 evidence files, benchmark corpus, ground truth, evaluator, and BLS artifacts were
not changed. No Development/Holdout execution, production/DI/UI/Journal/Supabase/migration/feature-
flag/CI/dependency/Jest-configuration change occurred. V3-047 `done` means only executable candidate
integration and offline validation; H1/H2 superiority remains unproved and live-unverified. V3-048
remains `todo`, V3-010 remains `blocked`, and production wiring remains unauthorized.

---

## 11. Post-merge evidence-completeness correction (2026-07-27)

Work began at local default-branch tip `d5ad54d27b28bc85b4f0b8122b75f266c8d989b9`, the supplied PR
#186 merge commit. This checkout had no configured `origin`, so the pre-edit fetch failed and
independent remote-tip verification was impossible. Inspection reproduced all five residual classes:
exact-snapshot pricing, anonymous error/timeout/telemetry/ledger paths, a simulated central harness,
discarded R1-min diagnostics, and message-based S1 JSON classification.

Variant C now exposes one frozen pre-dispatch run identity containing candidate ID/version, prompt,
schema and routing versions, exact model ID, and pricing version. Success and returned failures reuse
it; outer-ceiling telemetry and ledger details persist it through optional fields that keep historical
V3-039 records readable. Variant B remains identity-free.

Pricing is an exact-model, versioned table shared by reservation and actual cost calculation. The
accepted Haiku 4.5 numeric assumption is listed explicitly for alias and pinned snapshot under
`anthropic-messages-2025-10-01-v1`; unknown exact models fail before dispatch. Cache counts remain
separate. H0/H1/H2 use typed parser diagnostics: invalid text JSON, schema/contract error, missing
text, unexpected parser error, or null success. No food-domain result contract was polluted.

The asynchronous candidate measurement harness now executes the request builder, fake Anthropic
transport, real provider adapter, and selected parser once for H0/H1/H2, reporting measured call
counts and identity rather than constant AI decisions. Adapter/fake-source execution remains covered
by the focused scenario suites. H2 component evidence now retains stop reason, avoided/called source
types, call order, per-tier counts, and the tier executor's existing decision; R0 diagnostics are
absent rather than invented. External request count counts actual traced dispatches only.

Focused correction verification passed 126/126 tests. Provider calls were **0**, provider cost was
**USD 0**, and no credential was read. Live quality, latency, actual usage/cost and H1/H2 superiority
remain unverified. Frozen V3-039 evidence, corpus, ground truth, evaluator and BLS artifacts were not
modified. V3-047 remains `in_progress` until required GitHub CI is green; V3-048 remains `todo`,
V3-010 remains `blocked`, and production wiring remains unauthorized.

## Final closeout — executable end-to-end evidence (2026-07-27)

### Remaining defects reproduced at PR #187 basis

The immutable basis used for this closeout is `3310752af4c4052c8241c79153e1a6985c56eadf` (the locally available PR #187 merge commit). The checkout has no configured remote, so an independent `git fetch origin chore/clean-arch-structure` failed before any edit. Static baseline assertions and the focused baseline test demonstrated that the old harness stopped at the fake transport/parser, exposed `not_executed_by_measurement_harness`, derived H2 routing only from `resolverV3047R1MinSources()`, persisted no Variant-C identity in reserved/dispatched/terminal ledger details, ignored positive cache tokens in cost, and described known pricing plus unknown usage as unknown pricing.

### Executable zero-network harness and actual call matrix

The replacement is asynchronous and calls the canonical request builder, `createLiveVariantCInterpreter()`, candidate parser, `runVariantCCase()`, controlled fast-path resolver, tracked fake `FoodCatalogSource` implementations, existing scoring and resolver decisions, and R0/R1-min retrieval. All counters and traces are collected from execution.

| scenario                  | candidate | AI/transport | BLS/OFF/USDA | order          | fast path | stop / avoided                     |
| ------------------------- | --------: | -----------: | -----------: | -------------- | --------: | ---------------------------------- |
| h0-r0                     |        H0 |          1/1 |        1/0/1 | bls, usda      |        no | R0                                 |
| h1-r0                     |        H1 |          1/1 |        1/1/1 | bls, off, usda |        no | R0                                 |
| h2-generic-bls-accepted   |        H2 |          1/1 |        1/0/0 | bls            |        no | authoritative_accepted / off, usda |
| h2-generic-off-accepted   |        H2 |          1/1 |        1/1/0 | bls, off       |        no | authoritative_accepted / usda      |
| h2-generic-usda-accepted  |        H2 |          1/1 |        1/1/1 | bls, off, usda |        no | authoritative_accepted / none      |
| h2-generic-exhausted      |        H2 |          1/1 |        1/1/1 | bls, off, usda |        no | tiers_exhausted / none             |
| h2-branded-off-accepted   |        H2 |          1/1 |        0/1/0 | off            |        no | authoritative_accepted / usda      |
| h2-branded-usda-accepted  |        H2 |          1/1 |        0/1/1 | off, usda      |        no | authoritative_accepted / none      |
| h2-no-proof-ai            |        H2 |          1/1 |        1/0/0 | bls            |        no | authoritative_accepted / off, usda |
| h2-safe-fast-path         |        H2 |          0/0 |        0/0/0 | none           |       yes | no retrieval                       |
| h2-multipart-no-fast-path |        H2 |          1/1 |        1/0/0 | bls            |        no | authoritative_accepted / off, usda |
| h2-clarification          |        H2 |          1/1 |        0/0/0 | none           |        no | no retrieval                       |

### Ledger identity and cost contract

The Variant-C ledger decorator now writes the exact frozen `VariantCRunIdentity` into reserved, dispatched, and terminal details; Variant B remains unchanged. Existing protocol-v3 ledger parsing remains unchanged. Provider success and closed failures retain candidate/version/prompt/schema/routing/model/pricing identity.

V3-047 explicitly activates no prompt caching. Missing, null, or zero cache fields remain valid. Positive cache creation/read tokens produce `usage_cost_contract_error`, preserve HTTP/usage/identity, set actual cost to null, and never retry. Pricing configuration (`estimated` for the frozen snapshot), usage (`reported` or `unknown`), and actual-cost status (`computed`, `usage_unknown`, or `usage_cost_contract_error`) are separate. A transport/timeout failure therefore retains known configured pricing while correctly reporting unknown usage and cost.

No real credential was read, no network transport was installed, real provider calls are **0**, and real provider cost is **USD 0**. Live superiority, provider reliability/latency, repeat consistency, and the unchanged 12,000-ms p95 target remain unverified and belong exclusively to V3-048. V3-048 remains `todo`, V3-010 remains `blocked`, and production wiring remains unauthorized.
