# Latest Handoff


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
