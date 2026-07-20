# Zera Resolution Knowledge Growth — Decision Record 1

**Status:** `accepted` (2026-07-20)

**Authority:** Level 2 canonical domain authority; this record is binding for Resolver, AI interpretation, search planning, catalog, personal memory, corrections, knowledge candidates, promotion, review, and food-resolution benchmarks.

**Decision owner:** explicit maintainer decision in RESOLVER-V3-014. Future change requires an explicit revision; implementation MUST NOT silently diverge.

## 1. Purpose, problem, and decision relationship

Zera SHALL use AI for semantic interpretation, multi-part decomposition, quantity/unit interpretation, search planning, source-type selection, uncertainty and minimal questions, error analysis, auditable knowledge-candidate proposals, and quality work. AI MUST NOT be an authoritative nutrient source. Source retrieval, ranking/decision policy, portion scaling, nutrient summation, provenance, cache/memory validity, and activation of curated knowledge remain deterministic.

This record **extends** [`ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md`](ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md): its persistent learning from validated results is specified here. It does not replace source-grounded nutrient truth, deterministic calculation, Product-Bible catalog/journal separation, or the production-wiring gate.

**Verified present state (not a target schema):** `food_resolver_runs` is written through `ResolverRunLogger`; `food_query_cache_results` and resolver-run tables exist with RLS; `AiInterpretationResult` is a provider-neutral contract; user aliases and local correction-log mechanisms exist. There is no approved personal-memory read path, observation writer, candidate aggregation, review system, shadow runner, or global promotion implementation. This record specifies architecture, not migrations.

## 2. Empirical starting point and production gate

RESOLVER-V3-013 tested C on the small 14-case corpus; C was weaker than A, B is not source-grounded, and both had false-confidence evidence. The gate is **NOT PASSED**, not passed or inconclusive. The hybrid SHALL NOT be production-wired; `RESOLVER-V3-010` remains blocked. This evidence does not reject knowledge growth: future research SHALL target complex inputs, personal memory, correction learning, and source-grounded knowledge growth.

## 3. Definitions and catalog boundary

A **Food Catalog** answers: _which identity and nutrients does food have according to which source?_ A **Resolution Knowledge** entry answers: _how should an input be understood and resolved in language, personal, and professional context?_ AI-generated aliases, decomposition patterns, or search plans MUST NOT become authoritative nutrient records. An **Observation** is auditable event evidence, not fact. A **Knowledge Candidate** is inactive proposed global resolution knowledge. **Curated Global Knowledge** is explicitly approved global resolution knowledge.

## 4. Four separated knowledge layers

1. **Authoritative source data.** BLS, Open Food Facts, USDA, later expressly approved sources, and personal recipes/foods with traceable provenance. AI MUST NOT insert guessed nutrients as canonical truth.
2. **Private Personal Resolution Memory.** User-only examples include “my breakfast,” preferred toast, protein powder, confirmed scoop/portion, saved meal/recipe, and corrected mapping. It MAY activate without developer review only when sufficiently confirmed; it MUST be private, editable, deletable, versioned, invalidatable, reversible, and source-grounded or explicitly personal/manual. It MUST NEVER silently globalize.
3. **Resolver Observations and Knowledge Candidates.** Observations are immutable or auditably versioned evidence. Candidate knowledge derived from strong or aggregated observations is quarantined/inactive until reviewed.
4. **Curated Global Resolution Knowledge.** Approved aliases, typo variants, decomposition/source-routing/query/household-measure rules, ambiguities, false-confidence protections, negative mappings, and dish structures. Only this active approved layer MAY influence global decisions.

## 5. AI roles, observation contract, and evidence

For each resolver run the future observation contract SHALL be able to retain raw and normalized input, language/locale, AI decomposition/components/quantities/units/assumptions/uncertainty, search plans and source-native queries, sources/candidates/rankings/decision, question or abstention, user choice/correction, final source references, resolver/model/prompt/schema/source versions, latency, tokens, cost, and later errors/corrections. This is a required **information contract**, not a decided table layout. Saving an observation MUST NOT require a second AI call.

Evidence is **strong** for correction, deliberate choice, confirmed decomposition/quantity, saved personal meal, multiple independent source-grounded confirmations, or human promotion; **medium** for unchanged save, repeated close use, AI/deterministic agreement, or repeatedly unambiguous retrieval; **weak** for AI confidence, resolver score, one run, absent correction, one-user repetition, or implicit behaviour. Guessed AI nutrients, invented source IDs, model confidence alone, non-source-grounded global identities, and personal raw data without privacy approval are inadmissible knowledge evidence.

## 6. Personal memory, correction precedence, and invalidation

- **P0 observed:** used/logged without explicit confirmation; weak, analyzable and re-suggestible only; MUST NOT aggressively transfer to similar inputs.
- **P1 provisional:** deliberate candidate selection, repeated close use of the same source-grounded result, or defined medium evidence; MAY be preferred for identical/very close input and MUST remain visibly correctable and private.
- **P2 confirmed:** explicit correction/confirmation, deliberately saved personal meal, or robust repeated source-identified selection; MAY deterministically reuse for that user and avoid an AI call.

A later user correction SHALL override unconfirmed AI/resolver output, update personal knowledge, create negative evidence against the prior decision, and invalidate or weaken dependent cache/memory entries. Unchanged saving alone is not strong confirmation. Source updates, contradictions, corrections, and known regressions SHALL trigger reassessment/invalidation. Every entry needs origin evidence, source references, relevant versions, timestamps, scope, status, review history, invalidation reason, and supersession/rollback relation.

## 7. Candidate lifecycle and human review

Main path: `observed → candidate → pending_review → approved`. `observed` is evidence only; `candidate` is aggregated inactive proposal; `pending_review` is complete inactive review material; `approved` alone is globally active. Alternatives: `needs_more_evidence` (inactive, may return to candidate), `rejected` (inactive retained negative decision), `personal_only` (not global, may inform private memory), `duplicate` (links canonical candidate), `superseded` (replaced, inactive), and `quarantined` (privacy/security/provenance issue; neither evaluated nor activated until resolved). All transitions MUST be auditable.

Developer review before global activation is mandatory. Review material MUST cover proposed type/rule/target and source ID where applicable; locale/region; aggregate observations and privacy-safe independent-user count; confirmations, corrections, contradictions, false-confidence risks, affected cases, relevant versions, expected effect, shadow results, regressions, and privacy classification. Raw text/journal information MUST NOT be normally exposed; examples require redaction, abstraction, or strict access control. Actions: `approve`, `reject`, `needs_more_evidence`, `personal_only`, `merge_with_existing`, `approve_as_negative_rule`, `restrict_locale_or_region`, `correct_then_approve`. Decisions SHALL record at least reviewer, time, decision, reason, and approved payload version (names/schema remain open).

## 8. Shadow mode, risk, and negative knowledge

A shadow rule MUST not change user results, ranking, or fast paths; it writes evaluation only. It SHALL measure altered decisions, prevented errors, worsened correct cases, locale/region effects, new false confidence, and development-versus-holdout differences. For risky rules, successful shadow evidence SHALL be a review prerequisite.

Risk is lower (typo/search term/regional alias/additional source), medium (household measure, source route, decomposition, candidate priority), or high (fast path, exclusion, global quantity assumption, canonical identity, catalog/nutrient change). Higher risk requires stronger evidence, review, and shadowing. No numerical thresholds are decided here.

**Negative Knowledge** is a first-class type: a candidate may be unsuitable, regional, require preparation/brand, require composition rather than single-product parsing, produce bad query results, make a fast path unsafe, or reveal unsuitable source routing. Once appropriately promoted it MAY block fast paths, require source retrieval/larger margins/questions, or constrain to multiple candidates/abstention. It follows the same review/promotion rules.

## 9. Privacy boundary and cost principles

Private: raw input, meal/product names, portions, journal history, mappings, user-linked correction history, and recipes. Only after data classification and de-identification may normalized terms, locale/region, abstract correction type, source type/ID, search pattern, counters, anonymized error class, and versions be aggregated. Removing a user ID alone is not anonymization of free text. Potentially global after review: curated aliases, abstract decomposition, routing, negative rules, household measures, locale/region hints. No personal knowledge or wording may silently cross the boundary.

Each normal run SHOULD yield user value and learning signal. Personal memory/deterministic fast paths take priority; AI is only for real semantic value, complexity, or uncertainty. Analysis SHALL be batched, asynchronous, and budget-bounded; batch jobs MUST NOT auto-promote. Costs, tokens, latency, and avoided AI calls MUST be measurable. The system SHALL reduce rather than necessarily add AI usage over time.

## 10. Learning Benchmark V2 and non-goals

Benchmark V2 SHALL separately maintain development and holdout corpora and cover resolution (simple/regional/branded/typos/quantities/multi-component/homemade/restaurant/international/questions/abstention), decomposition (complete/no invented components, quantities/modifiers/sources/search plans/no complete-meal assumption), and personal sequences: unknown → correction → exact repeat → near repeat → later contradiction. It SHALL measure adoption, exact-repeat speed, avoided AI, no overgeneralization, and weakening/invalidation.

Global-promotion checks SHALL prove one user cannot create global rule, contradiction prevents promotion, shadow has no production effect, review is auditable, rollback works, and rejected candidates are not endlessly recreated. Privacy checks SHALL prove no cross-user/raw-text leak, deletion removes personal memory, globals lack user reference, and paths are separable. Economics SHALL include fast-path/memory/AI rates, cost per log/complex log, avoided calls, latency before/after, batch cost, and amortization. The 14-case smoke corpus is historical evidence only and insufficient.

Non-goals: no schema, migration, RLS policy, cache/read path, observation writer, aggregator, UI, shadow runner, promotion engine, correction wiring, corpus, prompt/provider, feature flag, or live AI run.

## 11. Open decisions, invariants, and acceptance

Open follow-ups include data classifications/retention/access controls, contract fields and schemas, personal promotion semantics, invalidation graph, aggregation methodology, review operations, shadow thresholds, risk-to-evidence criteria, benchmark corpus and numeric gates. They MUST be data-driven; this record invents no thresholds.

**Invariants:** AI output is observation, never canonical nutrient truth; source-grounded deterministic calculation remains mandatory; personal/global knowledge is separate; unreviewed global candidates have no resolver effect; only explicit human approval activates global knowledge; corrections override unconfirmed results; negative knowledge is valid; raw personal text never silently globalizes; all knowledge is reversible/auditable; V3-010 remains blocked.

**Supersession/conflict analysis:** this record supersedes only the unresolved knowledge/privacy scope previously bundled in V3-009 and re-plans V3-008/009; it does not supersede V3-008/009 history, V3-013 evidence, or existing decision records. If later implementation conflicts, this accepted record governs knowledge growth until explicitly revised.

**Acceptance decision:** The maintainer accepts this architecture as binding and versionable. It authorizes planning, not product implementation or provider cost.
