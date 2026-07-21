# Latest Handoff

## RESOLVER-V3-025 — Documentation and Status Reconciliation (post-implementation review)

- **Basis and scope:** Reviewed the canonical branch at `df4accd02c7d79c44a0cb4d6f57f599c1809b458` (HEAD
  of `chore/clean-arch-structure` at review time, per `git log --oneline -15`; no further commits were
  found on top of it). Read `SSOK.md`, `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, the Knowledge-Growth
  Decision Record, and this handoff, then independently re-derived the RESOLVER-V3-017/018/020/021/022
  findings by reading the actual merged code rather than trusting prior status text.
- **What was reconciled:** `ROADMAP.md` had RESOLVER-V3-022 stuck on `todo` despite PR #110 being merged
  as `HEAD`, and RESOLVER-V3-018 simultaneously marked `done` and "(in progress)". Both are corrected.
  RESOLVER-V3-017/-018/-020/-021/-022 each now carry an inline "Post-implementation findings" note.
  RESOLVER-V3-019 and RESOLVER-V3-023 are changed from `todo` to `blocked`, with explicit new dependencies
  on the remediation tasks below. This handoff gained the missing RESOLVER-V3-021 and RESOLVER-V3-022
  sections (see below).
- **New remediation series:** RESOLVER-V3-025 (this task) through RESOLVER-V3-030 were added to
  `ROADMAP.md` to close the gaps found — personal-memory write integration/audit hardening (026),
  atomic/correct invalidation (027), review governance/atomic promotion (028), privacy-safe shadow
  projection/real metrics (029), and candidate-aggregation operational boundary (030).
- **Full findings:** see `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`.
- **Non-effect:** documentation-only change. No product code, migration, or dependency was touched. No
  live Supabase migration was applied or attempted (Supabase MCP access was unauthorized in this session,
  so live-database state is reported as carried over from the source review, not independently
  re-confirmed). No further live provider run was performed or authorized.
- **Verification:** documentation-only per `VERIFY.md` — `git --no-pager status --short`,
  `git --no-pager diff --stat`, `git diff --check` were run against the touched files.

## RESOLVER-V3-021 — Developer Review and Global Promotion

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`, merged twice by
  process error as PR #108 (`codex/implementiere-developer-review-vertrag`) and PR #109
  (`codex/implementiere-developer-review-vertrag-rqhv0v`); `git diff` between the two merge commits is
  empty, confirming identical content and no conflicting logic — only a duplicate-merge history.
- **Inventory:** No developer-review, approval, or global-activation mechanism existed before this task;
  candidates were inactive-only per RESOLVER-V3-020.
- **Implemented contract:** `resolver-knowledge-review-v1` with actions `approve`, `reject`,
  `needs_more_evidence`, `quarantine`, `mark_duplicate`, `supersede`, `revoke_approval`, `rollback`; a
  server-side authorization port, candidate reader port, review repository port, and
  `ResolverKnowledgeReviewService`; an in-memory review repository; Supabase tables
  `resolver_knowledge_reviews`, `approved_resolver_knowledge`, `resolver_knowledge_review_events` with RLS
  and no `anon`/`authenticated` grants.
- **Known gaps (see post-implementation review):** the service currently requires
  `independentUserEvidence === 'not_evaluable'` to allow approval, effectively treating "not evaluated" as
  passing evidence rather than blocking on it; `saveApproved`/`appendEvent` are non-atomic; `reject`/
  `needs_more_evidence`/`quarantine` do not transition candidate lifecycle state; the review event omits
  reviewer identity, decision reason, contract/candidate/privacy versions, and a material snapshot.
  Tracked as RESOLVER-V3-028.
- **Non-effect:** no app-facing grants, no resolver-effect wiring, no automatic approval.

## RESOLVER-V3-022 — Shadow Mode for Global Candidates

- **Basis and scope:** Implemented from the RESOLVER-V3-021 merge state on
  `codex/implementiere-shadow-mode-fur-globale-kandidaten`, merged as PR #110
  (`df4accd02c7d79c44a0cb4d6f57f599c1809b458`).
- **Implemented:** `resolver-knowledge-shadow-evaluation-v1` contract; a pure
  `ResolverKnowledgeShadowEvaluator` with no external ports, no network/provider calls, and no resolver
  mutation; development/holdout partitioning (duplicate case-ID rejection within one evaluation call);
  candidate-type/locale/input-type checks; delta categories (`no_change`, `hypothetical_source_change`,
  `hypothetical_abstention`, `hypothetical_clarification`, `hypothetical_provenance_warning`,
  `blocked_locale`, `not_evaluable`, `invalid_candidate`, `privacy_blocked`); an aggregate-metrics helper.
- **Known gaps (see post-implementation review):** `productionDecision` is typed as the full
  `ResolverDecision` (including `normalizedQuery`, candidates, source data), and the privacy check only
  inspects top-level keys of `candidate`/`candidate.payload` — it never inspects `productionDecision`, so
  private/linkable resolver data currently passes through shadow requests/results unfiltered.
  `falseConfidenceRegressionCount`, `falseConfidenceImprovementCount`, and `regressionCount` are hard-coded
  to `0`; `identificationAccuracy`, `abstentionPrecision`, and `clarificationRate` are always `'unknown'`;
  `fixtureExpectedStatus` is carried in the contract but never used to compute any of them. Holdout
  separation does not persist across runs. Tracked as RESOLVER-V3-029.
- **Non-effect:** confirmed no external ports, no network calls, no provider calls, no resolver mutation.

## RESOLVER-V3-018 — Personal Memory Invalidation

- **Basis and scope:** Started from the required `4c960d0b6a3abf78906661a660ea4fbde7963958` and created `codex/resolver-v3-018-personal-memory-invalidation`. Only the V3-018 private-memory contract, one authorized additive migration, focused tests, canonical documentation, roadmap status, and this handoff changed.
- **Inventory:** The actual implementation before this task consisted of the `personal-resolution-memory-v1` domain contract (P0/P1/P2; active/superseded/contradicted/deleted), promotion policy, write-only `record` port, and private state/event tables. There was no production writer, Supabase adapter, in-memory memory adapter, resolver read path, candidate link, source-update signal, or stored dependency edge. Correction logs and journal soft-delete/restore flows exist, but none carries an attributable personal-memory ID or action mapping. Alias/portion-hint deletion is likewise not connectable safely. Account cascade existed on state/events; source supersession, source unavailability, and source identity change therefore remain explicit-port-only signals.
- **Implementation:** Added the closed `personal-resolution-memory-invalidation-v1` request/result/event contract with nine closed reasons and closed failure codes. The use case is owner-scoped and fail-closed, preserves historical evidence through append-only events, turns P1 source-unavailability into P0 weakening, and can deactivate P2. The in-memory private adapter makes action/event retries idempotent and supports direct dependency storage. It neither logs raw inputs/owners/source user text nor imports resolver, AI, catalog, or candidates.
- **Dependencies and persistence:** One reserved-prefix migration adds same-owner direct dependency edges with account cascade, RLS, authenticated-only grants, no anon access, and a constrained `invalidation` event type. Traversal is bounded at 100 entries, detects cycles, and propagates via `dependency_invalidated`; cross-owner links are not traversed. There is no global view/function, generic metadata store, dummy owner, or real Supabase/network call.
- **Integration/non-effect:** No correction/journal action was wired because invalidation failure must not change a successful journal action and no safe memory identity signal exists. No resolver read, AI avoidance, ranking/query/fast path, candidate creation, source call, or catalog mutation was added. V3-019 receives only the inactive-state contract and must add its own exact private read policy.
- **Verification:** Focused invalidation/migration suites: 2 suites, 11 tests passed; personal-memory, correction, and journal regressions: 3 suites, 16 tests passed. Typecheck and lint were invoked without reported errors; touched-file Prettier check passed. `git diff --check`, no dependency drift, migration timestamp uniqueness, and secret-safe diff checks passed. No UI file changed, so no manual UI gap entry applies. PR #107 subsequently merged with green CI (`bd5bd7f2281e7aade99d05bcf7a1bfec401e9ff0`).
- **Post-implementation findings (RESOLVER-V3-025, 2026-07-21):** independent code review after merge found the traversal writes each transition immediately rather than planning fully first (no atomicity/rollback on later failure), the "detects cycles" behavior above is a false positive on diamond dependency graphs (a node reached via two valid paths is wrongly reported as a cycle), an already-inactive node's dependents are never enqueued for propagation, and `personal_resolution_memory_dependencies` has no foreign key to `personal_resolution_memories`. None of this was exercised by the test suite above. Full detail in `reports/RESOLVER_V3_017_018_020_021_022_POST_IMPLEMENTATION_REVIEW.md`; tracked for remediation as RESOLVER-V3-027. RESOLVER-V3-019 must not build on this path until that remediation lands.

## RESOLVER-V3-020 — Privacy-Safe Knowledge Candidate Aggregation

- **Basis and scope:** Implemented from `34fa3a1b42e637e75fb00d932166a31a24e4e2d7` on branch `feat/resolver-v3-020-knowledge-candidates`. This task does not change personal memory, resolver composition, provider wiring, dependencies, or the V3-017 scope.
- **Inventory:** The current privacy projection contains privacy/observation contract versions, locale, input type, outcome, candidate count, selected BLS/OFF/USDA source type and ID, provenance, resolver version, latency, and closed reason codes. V1 consequently supports only structured route, abstention, clarification, provenance-gap and negative-source-routing signals. It cannot derive aliases, terms, typo/locale mappings, meal names, searches, free-text templates, or independent-user counts; that status is always `not_evaluable`.
- **Implementation:** Added closed `resolver-knowledge-candidate-v1` model, fail-closed projection aggregator, deterministic safe-payload fingerprint deduplication, contradiction and negative-evidence preservation, and an in-memory server-boundary repository limited to inactive lifecycle transitions. `approved` is reserved and rejected. The aggregator has no import or read path for `resolver_observations`; source IDs are discarded before payload/fingerprint creation.
- **Persistence:** Added one additive migration defining `resolver_knowledge_candidates` and append-only `resolver_knowledge_candidate_events`, both RLS-enabled and fully revoked from `anon` and `authenticated`. It has no grants, app/global/resolver view, trigger, candidate activation, or curated-knowledge path. Existing observations, resolver runs, cache results, aliases, catalog and personal-memory structures remain untouched.
- **Documentation and follow-up:** `docs/domains/ZERA_RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_1.md` records the candidate inventory, contract, lifecycle, persistence boundary and V3-021/V3-022 handoff. Developer review/promotion belongs to V3-021; shadow evaluation belongs to V3-022. RESOLVER-V3-017 remains unchanged.
- **Verification:** Focused candidate/privacy/migration suites: 3 suites, 22 tests passed. `npm run typecheck` and `npm run lint` passed. The full prettier/verify commands were invoked but the command runner ended after starting their repository-wide formatting stages without printing a completion footer; rerun `npm run format:check` and `npm run verify` in CI before merge. No live Supabase, provider, network or AI call was performed.

## RESOLVER-V3-017 — Personal Memory Promotion and Correction Precedence

- **Basis:** `34fa3a1b42e637e75fb00d932166a31a24e4e2d7`.
- **Inventory:** logging is an implicit weak action; correction logs distinguish user/system edits; saved meals exist as personal templates; aliases, portion hints, resolver observations and journal snapshots are not reused as memory. Canonical catalog references are source-grounded; `user` source records are personal/manual. A dedicated private boundary is required.
- **Implemented contract:** `personal-resolution-memory-v1` defines closed P0/P1/P2, status, target references, evidence, transitions, and private correction negative evidence. The policy fails closed for unknown evidence/version and intentionally has no repetition threshold.
- **Storage:** one additive owner-scoped Supabase migration creates state/events tables with account cascade, RLS, no anon grant, and no views/aggregation.
- **Non-effect:** no resolver read/fast path/ranking/AI avoidance/global candidate path was added. V3-018 remains responsible for dependency invalidation and V3-019 for reads; V3-020 must not consume private memory.

## RESOLVER-V3-016 — Privacy Boundary Enforcement

- **Basiscommit:** `e67fb043e21796a937f5585475d80549ff2167ed` on expected base content; task branch `codex/resolver-v3-016-privacy-boundary`.
- **Policy:** `resolver-observation-privacy-v1`; executable field catalogs cover private storage columns and every V1 nested contract field. `owner_id`, row/observation/run IDs, and exact timestamps were corrected/treated as private or linkable exclusions, not operational projection fields.
- **Inventory:** raw/normalized inputs are free text; owner and IDs are direct/linkable; source `user` and its IDs are private; reason codes are only projectable from a closed allowlist. Structured V1 fields allowed in the in-memory-only projection are policy/contract version, locale, input type, outcome, candidate count, approved BLS/OFF/USDA source pair, provenance, resolver version, latency, and safe reason codes.
- **Excluded:** owner, raw/normalized text, all IDs/timestamps, journal/food-entry/correction links, metadata, provider data, prompts, secrets, headers, and stack traces. Normalized text remains blocked pending an explicit later policy/process; no hash or threshold is claimed as anonymization.
- **Deletion/retention/access:** deletion obtains the current owner through the canonical provider and deletes only that owner's private rows; missing owner fails closed. Existing account cascade and owner RLS remain unchanged. No automatic retention duration/job is introduced; no automatic candidate/global transfer exists.
- **Logging:** unconditional resolver logs containing raw or normalized query were converted to explicit debug-gated logs without input values. Observation errors log only closed codes; full Supabase response and owner are not logged.
- **Open questions:** future semantic alias/term aggregation, retention duration, and any controlled server path require a separate accepted policy. RESOLVER-V3-017 and V3-020 may begin in parallel on separate branches; V3-020 cannot read private rows as global candidates.
