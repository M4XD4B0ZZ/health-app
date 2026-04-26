# HealthApp 6 Master Roadmap (SSOK)

Status: Active

- [x] P0-002: Kerninputs Proof
Architecture: Clean Architecture + Feature-First + Deterministic-First Nutrition Engine

---

## DACH Data Strategy – Generic vs Branded Separation

### 1. Problem Statement

- Generische Lebensmittel sind kulturell nicht eindeutig (z.B. quark, schmand, curd)
- Internationale Datenquellen (USDA) führen zu semantisch falschen Matches
- Mittelwertbildung über mehrere Quellen ist nicht zulässig (unterschiedliche Produktklassen)

### 2. Core Principle

- "Locale-first truth before global approximation"
- Deutsche Inputs müssen gegen deutsche Produktrealität aufgelöst werden
- Klassifikation vor Datenwahl (nicht andersrum)

### 3. Data Layer Separation

#### Generic Foods (z.B. quark, ei, toast, schmand)

Priority:

1. DACH Generic Source (BLS – Bundeslebensmittelschlüssel)
2. OFF (nur wenn plausibel und generisch)
3. USDA als Fallback
4. AI nur als Mapping, nicht als Makroquelle

Definition:

- Canonical Food Layer bleibt bestehen
- Wird erweitert um DACH-validierte Referenzwerte

#### Branded / Packaged Foods

Priority:

1. OFF (DE/DACH filtered)
2. User Cache
3. später eigener Supabase DACH Cache

### 4. Ranking Adjustments

Für locale = de:

- - Score Boost für:
  * deutsche Namen / Aliases
  * generische DACH-Produkte
  * plausible Standard-Makros

- − Penalty für:
  - Dessert-/Fruchtvarianten
  - Protein-/Fitnessprodukte
  - internationale Surrogate (curd, cottage cheese)
  - implausible Makros

### 5. Resolver Decision Rule

Wenn:

- input = generic
- locale = de
- hoher Match auf DACH-Generic vorhanden

Dann:

- skip USDA
- akzeptiere DACH Source als truth

Wenn:

- mehrere plausible Treffer
  → status = ambiguous (kein blindes accept)

### 6. No-Average Rule

- Keine Mittelwertbildung über mehrere Quellen
- Jede Quelle wird einzeln bewertet
- Entscheidung basiert auf best match + plausibility, nicht Durchschnitt

### 7. Future Extension (optional, kein Scope jetzt)

- Aufbau eines eigenen DACH Canonical Cache (Supabase)
- Traffic-driven self-improving dataset
- Cross-source validation nur für Ranking, nicht für averaging

---

## SSOK Rules

- **ROADMAP.md is the Single Source of Knowledge (SSOK) for all planned and completed work.**
- Every task must have a stable ID, a status, and a Definition of Done.
- Task IDs are never reused. Completed tasks are marked `done`, never deleted.
- Larger epics must be broken into concrete, verifiable tasks.
- Task descriptions must be specific and checkable 6 not vague goals.
- No task may be marked `done` without passing verification (see VERIFY.md).

### Status values

| Status        | Meaning                           |
| ------------- | --------------------------------- |
| `todo`        | Planned, not started              |
| `in_progress` | Actively being worked on          |
| `blocked`     | Waiting on dependency or decision |
| `done`        | Completed and verified            |

---

## Principles

- Deterministic-first: prefer deterministic logic over AI/LLM calls
- AI only when deterministic logic is insufficient
- Clean Architecture: domain / application / infrastructure / presentation layers
- Feature-First: code organized by feature (nutrition, goals, auth, 5)
- Trust/Confidence/Editability: every logged entry must be trustworthy and editable
- Small, incremental, reviewable changes only

---

## Retention Strategy

**Primary KPI:** Week-1 retention rate

**Core Philosophy:**

- Retention is the single most important product metric
- All feature decisions must be evaluated through retention impact lens
- User engagement quality over feature quantity

**Strategic Priorities:**

1. **Magic Moments as UX Goal**
   - Educational insights that surprise and delight users
   - Unexpected nutritional discoveries ("Did you know...")
   - Personalized achievements and progress celebrations
   - Smart suggestions based on eating patterns

2. **Friction Reduction (Top Priority)**
   - Input speed and ease trumps feature complexity
   - Every additional tap/step must justify retention benefit
   - Error recovery must be instant and intuitive
   - Progressive disclosure: advanced features hidden initially

3. **AI Cost Optimization**
   - AI costs evaluated per retained user, not per API call
   - High-retention users justify higher AI investment
   - Cost-per-retained-user as primary AI ROI metric
   - Deterministic solutions preferred for cost efficiency

**Feature Prioritization Framework:**

- P0: Features that directly impact Week-1 retention
- P1: Features that improve long-term engagement
- P2: Features that reduce churn risk
- P3: Nice-to-have features with unclear retention impact

---

## Data Strategy – Multi-Source Resolver v2

**Goal:** Improve food matching accuracy and user trust for DACH market launch

**Source Priority Order:**

1. **User Cache** (Highest Priority)
   - Previously logged foods by same user
   - Instant recognition, zero latency
   - Builds user confidence through consistency

2. **DACH Source** (Planned - Critical for Launch)
   - German/Austrian/Swiss specific food database
   - Local brands, regional specialties, German portion sizes
   - Essential for market penetration and user trust
   - Reduces AI fallback dependency

3. **Open Food Facts (OFF)** (Brand/EAN Fallback)
   - Downgraded from primary to fallback role
   - Specialized for branded products with EAN codes
   - European brand coverage remains valuable
   - NOT replaced, but repositioned strategically

4. **USDA** (Canonical Generic Foods)
   - Reliable source for generic food categories
   - Standardized nutritional data
   - Fallback for foods not in regional databases

5. **AI Fallback** (Last Resort)
   - Only when all deterministic sources fail
   - Highest cost, lowest confidence
   - Must be clearly marked as estimated

**Strategic Rationale:**

- **DACH Source Critical:** German market requires local food recognition for user trust and adoption
- **OFF Repositioning:** Still valuable but not primary - focuses on its strength (branded products)
- **Trust Building:** Local data sources increase user confidence in accuracy
- **Cost Optimization:** Reduces expensive AI calls through better deterministic matching
- **Match Quality:** Regional specificity improves portion size and nutritional accuracy

**Implementation Notes:**

- Resolver maintains existing architecture, only source priority changes
- Each source maintains its specialized query adapters
- Fallback chain ensures no user input goes unresolved
- Performance monitoring per source to optimize query routing

### Resolver Decision Layer

**Candidate Ranking Criteria:**

- **Match Quality:** Exact text match > partial match > fuzzy match
- **Data Quality:** Complete nutritional profile > partial data > estimated values
- **Kcal Consistency:** Values within expected ranges for food type and portion
- **Source Trust:** User Cache > DACH > USDA > OFF > AI (descending reliability)

**Confidence Thresholds:**

- **High Confidence (≥85%):** Auto-accept, immediate save to journal
  - Exact canonical match from User Cache
  - Strong DACH match with complete nutritional data
  - USDA match with portion consistency
- **Medium Confidence (50-84%):** Accept with edit capability
  - Partial matches requiring portion adjustment
  - Good match but incomplete nutritional profile
  - User can quickly modify before saving
- **Low Confidence (<50%):** Require user clarification or fallback
  - Multiple ambiguous candidates
  - Significant data gaps or inconsistencies
  - Present options to user for selection

**Early Return Rules:**

- Strong canonical match (>90% confidence) from User Cache → skip remaining sources
- Exact brand match from DACH → skip OFF and later sources
- Multiple high-confidence candidates from same source → rank and return best match
- Zero candidates from primary sources → continue to fallback chain

### Fallback & Failure Handling

**Source-Specific Failure Modes:**

- **OFF API Failures (503, timeout):** Skip quickly without retry loops to preserve API budget
- **DACH Source Unavailable:** Log degradation, continue to OFF without user notification
- **USDA Query Errors:** Fallback to AI with explicit "estimated" marking
- **Network Failures:** Cache last successful results, show offline indicator

**No-Match Scenarios:**

- **Complete Resolution Failure:** Show clear UI feedback instead of silent failure
- **Partial Matches Only:** Present best candidates with confidence indicators
- **Zero Nutritional Data:** Block save operation, request user input for basic macros
- **Ambiguous Input:** Guide user to more specific description rather than guessing

**Zero-Macro Protection:**

- **Hard Block:** No food entry with kcal=0 can be saved to journal
- **No Food-Specific Bypass:** Rule applies universally, no exceptions for specific foods
- **User Feedback:** Clear error message explaining why save was blocked
- **Recovery Path:** Suggest portion adjustment or alternative food selection

### Input Quality Integration

**Input Classification System:**

- **High Quality Input:** Specific food name + clear portion (e.g., "200g Quark", "2 Eier")
  - Route to fast deterministic resolution path
  - High confidence threshold (≥85%) for auto-acceptance
  - Minimal user interaction required
- **Medium Quality Input:** Recognizable food, unclear portion (e.g., "Buttertoast", "Schinken")
  - Standard resolution with medium confidence acceptance (50-84%)
  - Present portion options for user selection
  - Allow quick edit before saving
- **Low Quality Input:** Vague or complex descriptions (e.g., "etwas Süßes", "Mittagessen")
  - Request clarification instead of attempting resolution
  - Guide user toward more specific input
  - Avoid expensive AI calls on ambiguous queries

**Quality-Confidence Integration:**

- **High Quality + High Confidence:** Instant save, optimal user experience
- **High Quality + Low Confidence:** Data quality issue, investigate source reliability
- **Low Quality + Any Confidence:** Always request clarification, never auto-accept
- **Medium Quality + Medium Confidence:** Standard edit flow, balanced trust/control

**Retention Impact Connection:**

- **Trust Building:** High-quality inputs with successful resolution build user confidence
- **Control Preservation:** Medium/low quality inputs maintain user agency through edit capability
- **Friction Reduction:** Quality classification enables appropriate UX flow selection
- **Learning Loop:** User corrections on medium-quality inputs improve future classification

---

## EPIC: Zero-Friction Input System (P0 - CORE PRODUCT)

Goal:
Enable users to log food using natural language with minimal friction, prioritizing ease-of-use over perfect accuracy.

Principles:

- Natural language first (no structured input required)
- Approximation over precision (initial input)
- Correction over prevention (user can quickly edit)
- System should feel "instant" and "effortless"

Scope:

- Free-text food input ("What did you eat?")
- Basic parsing (quantities, simple foods)
- Dish recognition (e.g. "Spaghetti Bolognese")
- Mapping to existing food database (Open Food Facts / USDA)
- Confidence scoring system (high / medium / low)
- Fallback handling for unknown inputs
- Quick-edit UX (portion adjustment, corrections)

Deliverables:

- Input component (UI)
- Parsing layer (initial rule-based)
- Dish mapping system (initial static dataset ~50 meals)
- Confidence evaluation
- Edit interaction flow

Constraints:

- Must integrate with existing deterministic pipeline
- Must NOT break current food search functionality
- No heavy AI dependency in initial implementation

---

## Current Focus

Core Logging Pipeline must be stable before any other feature work.

Definition of "working":

- `ei` 6 correct macros
- `zwei eier` 6 correct macros
- `200g quark` 6 correct macros
- `buttertoast` 6 correct macros
- `zwei scheiben schinken` 6 correct macros

---

# PHASE 0 6 LOGGING MUST WORK

## P0-001 Disable Multi-Item Structuring

Status: `done`

Temporarily disable AI multi-item structuring.
No "AI structured multi-item meal" text.
No artificial splitting while deterministic parser is unstable.

**DoD:** Single item passes cleanly through the pipeline without AI structuring.

---

## P0-002 Single Item 6 Resolver 6 Macros Pipeline

Status: `in_progress`

Minimal working chain:

1. Input: raw text (e.g. "ei")
2. Deterministic normalization
3. Resolver call
4. USDA/OFF match
5. Macro calculation
6. Journal persistence
7. SummaryBar update

No Review Modal. No Confirm All. No extra layers.

**DoD:** 5 individual foods produce correct macros without zero-macro results.

---

## P0-003 Remove Review Modal (Temporary)

Status: `done`

Disable Review Entries. Remove Confirm All. Save directly after successful match.
On no match: show error.

**DoD:** Flow shortened. No forced confirm step.

---

## P0-004 Zero-Macro Blocker

Status: `todo`

If `kcal == 0`: block save, show error, no success status.

**DoD:** Saving an entry with zero macros is impossible.

---

## P0-005 Hard Default to Protokoll Tab

Status: `done`

`initialRouteName` = Protokoll. App starts on input tab.

**DoD:** App opens on Protokoll tab on cold start.

---

## P0-007 Proof-of-Call Tracing (Gate)

Status: `in_progress`

Verify full resolver call chain via logs:

- PROOF UseCase entered
- PROOF ABOUT_TO_RESOLVE
- PROOF RESOLVER_CALLED with sourceCount > 0
- PROOF OFF_SOURCE_CALLED and USDA_SOURCE_CALLED
- Either candidates > 0 OR explicit HTTP status/error logged

**DoD:** All five proof points visible in logs for a valid input.

---

# PHASE 1 6 DETERMINISTIC MULTI-ITEM PARSING

## P1-001 Deterministic DE9EN Localization Alias Layer

Status: `done`

Deterministic step mapping common DE foods to EN equivalents for USDA source.
OFF targets original text.

**DoD:** Unit test for DE mapping passes (`npm run test`). `ei` returns candidates in manual app test.

---

## P1-002 Canonical Food Entity Dictionary + Source Adapters

Status: `todo`

Evolve flat alias map into structured canonical food entities with DE+EN alias lists,
portion hints, and source query adapters.
`detectCanonicalEntity()` for entity matching.
`getSourceQuery()` for per-source query routing.

**DoD:** ~20 canonical entities defined. Unit tests pass for DE+EN alias detection and source-specific query mapping. No macro key or unit inconsistencies.

**Verify:** `npx jest --testPathPattern="deEnAliases|smokeResolverDe"`, manual app test: "ei" produces candidates.

---

## EPIC: Resolver & Normalization

### P1-003 Multi-Item Split

Status: `todo`

Split input at "und", "mit", ",". Normalize number words. Force resolver per item.

**DoD:** "ei und quark" produces two separate resolved entries.

---

# PHASE 2 6 GUARDRAILS, AUTH & SUBSCRIPTION

## EPIC: Supabase Foundation

### P2-001 Verify Environment Wiring

Status: `todo`

Ensure `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` are strictly verified.
App throws fatal error on boot if variables are missing.

**Verify:** `npm run typecheck` + `npm run test` validating environment checks.

---

### P2-002 Enforce Single Supabase Client

Status: `todo`

Prevent any creation of new `createClient` instances globally.
`supabaseClient.ts` is the single source of truth.
No manual `fetch` calls to `/functions/v1/` exist.

**Verify:** `npm run lint` + global search for `fetch(` targeting Supabase URLs (must yield 0 results).

---

### P2-003 Document Edge Functions Deploy Process

Status: `todo`

Ensure `supabase/config.toml` is respected in deployment.
`verify_jwt=false` safely applied.
README section in `/supabase` on how to run `supabase functions deploy`.

**Verify:** Local `supabase start` parses `config.toml` and allows anonymous invokes.

---

## EPIC: Edge Guardrails (Food Search)

### P2-004 Query-length Guard and Sanitization

Status: `done`

Hard limit on food search query lengths. Sanitize input at Deno Edge function level.
Queries > 64 chars or containing special exploits blocked with 400.

---

### P2-005 Rate Limiting

Status: `done`

Basic rate limiting (IP/device based for anonymous).
Unauthenticated users cannot exceed 30 requests per minute to `food-search`.

---

### P2-006 Abuse Logging & Observability

Status: `done`

Structured logging for blocked requests (rate limit / guardrails) with `traceId` and user context.
Visible in Supabase Log Explorer as `ABUSE_DETECTED`.

---

### P2-007 Deploy & Verify Guardrails

Status: `todo`

Deploy guardrails with correct `verify_jwt=false` properties.
App calls remote endpoints anonymously without 401s.

**Verify:**

1. `npm run verify:supabase:link` must pass.
2. `npm run verify:schema` must pass.
3. `npm run deploy:edge:verify` must pass.

---

## EPIC: Auth & Subscription (Later)

### P2-008 Apple/Google Login via Supabase Auth

Status: `todo`

User can login via OAuth. App retrieves a valid Supabase JWT and stores it securely.

---

### P2-009 RevenueCat Entitlements

Status: `todo`

Integrate RevenueCat to manage subscription states.
`isPro` state synced from RevenueCat to Supabase `public.users` via Webhooks.

---

### P2-010 Paid-only Gating for AI Endpoints

Status: `todo`

Map `isPro` tier to Edge Function authorization.
AI structured log functions and premium insights return 403 for non-Pro users.

### P2-011 Project-Scoped Codex Governance

Status: `in_progress`

Add repo-local Codex guidance and role contracts aligned with `AGENTS.md`, `ROADMAP.md`, `VERIFY.md`, and `SSOK.md`.
Keep the setup minimal, deterministic-first, and scoped to this repository.

**DoD:** Repo-local Codex config exists under `.codex/`. Analysis, implementation, and review roles are defined. Setup does not modify user-global Codex config. Verification passes and task status is updated.

---

# PHASE 3 6 MODULES (planned)

These modules are planned but not yet scoped into tasks.
Each will be broken into concrete tasks when Phase 0 62 are stable.

| Module      | Status | Notes                                 |
| ----------- | ------ | ------------------------------------- |
| Journal     | `todo` | Editable food log, daily view         |
| Goals       | `todo` | Macro targets, metabolism profile     |
| Saved Meals | `todo` | Reusable meal templates               |
| Reminders   | `todo` | Notification-based logging reminders  |
| Dashboard   | `todo` | Summary view, progress indicators     |
| Health Sync | `todo` | Apple Health / Google Fit integration |
| Insights    | `todo` | Trend analysis, weekly summaries      |

---

## Resolver V2 – Multi-Source Fusion Architecture

**Goal:** Redesign nutrition resolver to eliminate early translation bias and enable true multi-source comparison for better food matching accuracy.

**Current Problems:**
- Early translation biases source selection (DE→EN before querying)
- Better matches in other sources are skipped due to sequential early-return logic
- No true multi-source comparison across all candidates
- Supabase underused (only cache, not knowledge layer)

**Target Architecture:**

### Core Principles

1. **NO EARLY TRANSLATION**
   - Input stays language-native until source-specific adaptation
   - Only normalize (case, umlauts, punctuation, tokens)
   - Each source receives appropriate query variant

2. **SOURCE-NATIVE QUERYING**
   - BLS receives "ei", "eier" (German terms)
   - USDA receives "egg" (English equivalent)
   - OFF receives original input (multilingual database)

3. **MULTI-SOURCE CANDIDATE RETRIEVAL**
   - All relevant sources return candidates before decision
   - No early return before cross-source comparison
   - Negative cache only exception

4. **CANDIDATE FUSION LAYER**
   - Central ranking across ALL sources
   - Unified scoring: lexical match + token overlap + source trust + locale relevance + data completeness + plausibility
   - Traceable decision process

5. **SUPABASE AS KNOWLEDGE LAYER**
   - Store queries, candidates, decisions, corrections, alias evolution
   - Build long-term canonical dataset from user interactions
   - Enable learning from resolution patterns

6. **OPTIONAL AI (STRICTLY LIMITED)**
   - ONLY for re-ranking low-confidence cases and semantic similarity
   - NEVER for macro calculation or silent decisions
   - Must be traceable and rate-limited

### Implementation Tasks

#### RESOLVER-V2-001: Remove Early Translation Layer
Status: `todo`

**Description:**
Remove global translation before source querying. Keep normalization only (case, umlauts, punctuation). Input must reach multiple sources unchanged.

**DoD:**
- Tests confirm same normalized input reaches multiple sources
- No DE→EN translation before source routing
- [`getSourceQuery()`](src/features/nutrition/domain/catalog/CanonicalFood.ts:199) only adapts per source, not globally

**Verify:** Unit tests show "ei" sent to BLS, "egg" sent to USDA, "ei" sent to OFF

---

#### RESOLVER-V2-002: Implement Source-Native Query Adapters
Status: `todo`

**Description:**
Each source builds its own query from normalized input. No shared query string across sources.

**DoD:**
- BLS adapter generates German-specific queries
- USDA adapter generates English equivalents
- OFF adapter preserves original multilingual input
- Logging shows different queries per source

**Verify:** Debug logs show source-specific query adaptation

---

#### RESOLVER-V2-003: Implement Multi-Source Candidate Retrieval
Status: `todo`

**Description:**
All sources return candidates before decision. Remove early-return logic except negative cache.

**DoD:**
- [`SequentialFoodCatalogResolver`](src/features/nutrition/application/services/SequentialFoodCatalogResolver.ts:56) collects from all sources
- No early return based on confidence thresholds
- Logs show candidates from multiple sources per query

**Verify:** Resolution logs show multi-source candidate collection

---

#### RESOLVER-V2-004: Build Candidate Fusion Layer
Status: `todo`

**Description:**
Central scoring across all sources. Introduce unified Candidate type with cross-source ranking.

**DoD:**
- Unified candidate scoring algorithm
- Cross-source comparison logic
- Ranking logs show source comparison rationale

**Verify:** Ranking logs demonstrate cross-source candidate evaluation

---

#### RESOLVER-V2-005: Introduce Supabase Knowledge Layer Tables
Status: `todo`

**Description:**
Define schema for persistent knowledge accumulation.

**Tables:**
- `canonical_foods`: Long-term food definitions
- `food_source_items`: Source-specific food mappings
- `food_aliases`: User-validated aliases
- `query_logs`: Resolution history
- `corrections`: User feedback on decisions

**DoD:**
- Schema exists and is documented
- Migration scripts available
- Edge functions can access tables

**Verify:** Schema documentation exists, tables accessible from Edge functions

---

#### RESOLVER-V2-006: Persist Resolution Decisions
Status: `todo`

**Description:**
Store query → candidates → final decision chain for learning and debugging.

**DoD:**
- Every resolution creates DB entries
- Decision rationale is traceable
- User corrections update knowledge base

**Verify:** DB entries created per resolution, correction flow works

---

#### RESOLVER-V2-007: AI-Assisted Re-Ranking (Optional)
Status: `todo`

**Description:**
AI only for low-confidence cases. Must be traceable and rate-limited.

**DoD:**
- AI triggered only below confidence threshold
- Usage logged and rate-limited
- Never authoritative, always assistive

**Verify:** AI usage logs exist, rate limiting works, confidence thresholds respected

---

### Resolver Rules (Global)

- **NEVER translate input before source querying**
- **ALWAYS allow multi-source candidate comparison**
- **BLS, OFF, USDA are candidate providers, not truth sources**
- **Supabase is long-term source of truth**
- **AI is assistive only, never authoritative**

### Verify Checklist

Before marking Resolver V2 as done:

- [ ] Same input sent to multiple sources without early translation
- [ ] No early translation exists in resolver pipeline
- [ ] Multiple candidates logged from different sources
- [ ] Final decision is traceable through logs
- [ ] Supabase stores resolution decisions
- [ ] Confidence system still works
- [ ] Existing tests pass
- [ ] Performance within acceptable bounds

---

## Decisions Log

- **Anon vs. Auth for Food Search:** Food search functions are anon for MVP (`verify_jwt=false`) with strict guardrails.
- **AI Endpoints gating:** AI endpoints will never be anon. Strictly JWT + subscription/entitlement required.
- **Deterministic-first:** No LLM calls in core logging pipeline. AI only for complex multi-item parsing when deterministic logic is insufficient.
- **Resolver V2 Architecture:** Multi-source fusion replaces sequential early-return to eliminate translation bias and improve match quality.
