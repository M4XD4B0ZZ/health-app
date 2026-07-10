# Tier 5 — Monetization: Task Breakdown Plan

Status: planning only — no implementation yet. This decomposes `ROADMAP.md`'s three Tier 5
tasks (P2-009, P2-010, RESOLVER-V2-007) into smaller, independently-scoped sub-tasks, each
marked with whether it can be scaffolded autonomously or is blocked on something only the
repo owner can provide (an account, a credential, a product decision).

## Why this split

Unlike Tier 3/4, most of Tier 5 depends on external services this session has no access to:
a RevenueCat account, App Store Connect / Google Play Console subscription products, and an
AI provider choice + API key. Rather than block entirely, each parent task is split into a
part that's pure code/schema design (safe to build now) and a part that genuinely needs your
input before it can be finished or tested.

---

## P2-009 — RevenueCat Entitlements

**Goal:** track each user's subscription ("Pro") state, synced from RevenueCat into Supabase.

| Sub-task                                                   | What it is                                                                                                                                                                                                                                          | Can scaffold now?                                                                                                                                                                                                                                              |
| ---------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-009-A** — Design `isPro` entitlement schema           | A new Supabase table (e.g. `public.user_entitlements`: `user_id`, `is_pro`, `product_id`, `expires_at`, `updated_at`) + RLS (user reads own row; only service role writes). Same idempotent-migration pattern already used for RESOLVER-V2-005/006. | **Yes** — pure schema design, no RevenueCat account needed.                                                                                                                                                                                                    |
| **P2-009-B** — RevenueCat webhook receiver (edge function) | A new Deno edge function that receives RevenueCat's webhook events (purchase, renewal, cancellation) and upserts P2-009-A's table.                                                                                                                  | **Partially** — the function skeleton + payload types can be written now; verifying the webhook's shared-secret header and RevenueCat's exact event shape needs either their public docs (fetchable) or your real RevenueCat project to test against.          |
| **P2-009-C** — Client-side RevenueCat SDK                  | `react-native-purchases` (or the Expo config plugin) wired into the app, so the app can show paywalls / initiate purchases and read `isPro`.                                                                                                        | **No** — needs a new npm dependency (approval-gated) _and_ your RevenueCat public API key _and_ App Store Connect / Google Play subscription products already created. Only a port/use-case scaffold (like P2-008's OAuth scaffold) is possible without those. |

**What I need from you before P2-009 can go further than schema + skeleton:**

1. A RevenueCat account + project (free to create, no App Store account needed yet to start).
2. RevenueCat's webhook shared secret (once the webhook is registered in their dashboard).
3. RevenueCat's public/app API key, for the client SDK.
4. Subscription products actually configured in App Store Connect / Google Play Console (their
   product IDs need to match what RevenueCat expects) — this is the slowest external
   dependency, typically requiring a paid Apple Developer Program membership.

---

## P2-010 — Paid-only Gating for AI Endpoints

**Goal:** AI/premium edge functions return `403` for non-Pro users.

| Sub-task                            | What it is                                                                                                                                                                                                                                                                                                                                                               | Can scaffold now?                                                                                                                                                                                   |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **P2-010-A** — Audit gating targets | `supabase/functions/` currently only has `food-off-search` and `food-usda-search` — both meant to stay free/anonymous (that's the whole point of P2-007's guardrails). There is **no AI or "premium insights" edge function yet** to gate. This sub-task is just documenting that finding in `ROADMAP.md` so P2-010 isn't attempted against a target that doesn't exist. | **Yes** — it's a documentation correction.                                                                                                                                                          |
| **P2-010-B** — `isPro` check helper | A shared Deno helper (`supabase/functions/_shared/authorization.ts`) that looks up P2-009-A's entitlement table and returns 403 if not Pro.                                                                                                                                                                                                                              | **Yes, but has nothing to apply to yet** — write it once P2-009-A's table exists; it won't be wired into a real function until one exists (see RESOLVER-V2-007, the most likely first AI endpoint). |

**Practical implication:** P2-010 is realistically sequenced _after_ RESOLVER-V2-007 produces
an actual AI endpoint to gate, even though it's numbered earlier in `ROADMAP.md`.

---

## RESOLVER-V2-007 — AI-Assisted Re-Ranking (Optional)

**Goal:** for low-confidence resolver decisions only, ask an AI model to re-rank candidates —
never to invent macro data, always rate-limited and logged.

### Two durable boundaries (do not soften these)

- **AI never decides macro/nutrition data, only candidate order.** It answers "of these N
  already-known candidates, which one is the best match?" — never "what are this food's
  macros?". Enforced today in `RateLimitedAiReranker` (falls back to the original order on
  any error, timeout, rate limit, or malformed response) and in `AiRerankingProvider`'s port
  contract.
- **A web-search-backed source (e.g. Perplexity, for foods missing from BLS/OFF/USDA
  entirely) is a different feature, not part of RESOLVER-V2-007.** That would be a new
  resolver _source_ — its own architecture/product decision, including whether it's
  acceptable for AI+web to become a macro-data source at all. Not scoped here.

| Sub-task                                            | What it is                                                                                                                                                                                                                                                                           | Can scaffold now?                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **RESOLVER-V2-007-A** — Port + rate-limited wrapper | An `AiRerankingProvider`-style port (mirrors the existing `AiFoodMapper` port pattern already in `src/features/nutrition/application/ports/`), a `NoopAiRerankingProvider`/fake default, and a wrapper enforcing the confidence-threshold gate + rate limit before ever calling out. | **Done** — same pattern as `FakeAiFoodMapper`/`NoopResolverRunLogger` already in the codebase.                                              |
| **RESOLVER-V2-007-B** — Real provider wiring        | Implement the port against a real AI API, once a provider is chosen.                                                                                                                                                                                                                 | **No** — needs a benchmark-driven provider choice (see below) and an API key.                                                               |
| **RESOLVER-V2-007-C** — Usage logs + rate limiting  | Persist each AI call (query, before/after confidence, latency, cost) and enforce the limit for real (not just the in-process gate from -A).                                                                                                                                          | **Partially** — could reuse `food_resolver_runs.metadata` (RESOLVER-V2-006) or a dedicated table; needs a small design decision either way. |

### Provider selection: benchmark-driven, not pricing-driven

Provider/model pricing changes every few months; the evaluation criteria don't. The
architecture already abstracts the provider behind `AiRerankingProvider`, so the choice is
deferred until it's actually needed, and made by running
[`scripts/benchmark-ai-reranking-providers.mjs`](../scripts/benchmark-ai-reranking-providers.mjs)
against whichever provider API keys are available at the time, scored against:

- **JSON/schema reliability** — does the provider reliably return a valid
  `AiRerankingResult` (a true permutation of the input candidate ids), not just "usually"?
- **Accuracy** — against a fixed set of realistic DACH ambiguity cases (quark vs. schmand,
  branded vs. generic matches, etc. — see `scripts/lib/ai-reranking-benchmark-fixtures.mjs`),
  does it pick the candidate a native speaker would mean?
- **Latency** — acceptable for a synchronous resolver call.
- **Cost** — at this task's actual token volume (a few hundred tokens per call), not in the
  abstract.
- **Provider-abstraction fit** — does it slot into `AiRerankingProvider` without needing a
  new SDK dependency or awkward adapter code?

A one-off pricing/competitor research snapshot that informed this section lives in
[`reports/AI_RERANKING_PROVIDER_PRICING_2026-07-13_REPORT.md`](../reports/AI_RERANKING_PROVIDER_PRICING_2026-07-13_REPORT.md)
— explicitly dated and non-authoritative, not duplicated here since it goes stale fast.

---

## Status

**Done:** RESOLVER-V2-007-A (port + rate-limited wrapper), P2-009-A (entitlement schema),
P2-010-A (gating audit), and the provider-selection benchmark harness
(`scripts/benchmark-ai-reranking-providers.mjs`).

**Waiting on you:**

- RevenueCat account + App Store/Play Store subscription products (P2-009-B/C).
- Running the benchmark harness with at least one provider API key, to pick a provider for
  RESOLVER-V2-007-B (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` — any subset;
  the script skips providers with no key configured).
- P2-010-B waits on both P2-009-A (done) and an actual AI/premium endpoint existing
  (RESOLVER-V2-007-B or a future premium feature).

This plan itself makes no code changes — see the individual task tracker entries (P2-009-A/B/C,
P2-010-A/B, RESOLVER-V2-007-A/B/C) for execution.
