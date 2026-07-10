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

| Sub-task                                            | What it is                                                                                                                                                                                                                                                                           | Can scaffold now?                                                                                                                           |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------- |
| **RESOLVER-V2-007-A** — Port + rate-limited wrapper | An `AiRerankingProvider`-style port (mirrors the existing `AiFoodMapper` port pattern already in `src/features/nutrition/application/ports/`), a `NoopAiRerankingProvider`/fake default, and a wrapper enforcing the confidence-threshold gate + rate limit before ever calling out. | **Yes** — this is the same pattern as `FakeAiFoodMapper`/`NoopResolverRunLogger` already in the codebase; no provider decision needed yet.  |
| **RESOLVER-V2-007-B** — Real provider wiring        | Implement the port against a real AI API.                                                                                                                                                                                                                                            | **No** — needs your decision on provider (Claude / GPT / other) and an API key (new env var, possibly new npm dependency).                  |
| **RESOLVER-V2-007-C** — Usage logs + rate limiting  | Persist each AI call (query, before/after confidence, latency, cost) and enforce the limit for real (not just the in-process gate from -A).                                                                                                                                          | **Partially** — could reuse `food_resolver_runs.metadata` (RESOLVER-V2-006) or a dedicated table; needs a small design decision either way. |

**What I need from you before RESOLVER-V2-007 can go further than the port scaffold:**

1. Which AI provider/model to use for re-ranking (this repo already talks to Claude via
   Claude Code, but that's a different concern from an in-app API call — needs its own key).
2. Confirmation of the rate-limit budget (RevenueCat-style "requests per Pro user per day" is
   a natural tie-in to P2-010, but that's a product decision, not a technical one).

---

## Suggested order (once you're back)

1. **RESOLVER-V2-007-A** (pure scaffold, zero external blockers) — gives Tier 5 a first real
   commit without waiting on anything.
2. **P2-009-A** (pure schema scaffold, zero external blockers).
3. **P2-010-A** (a documentation fix, five minutes).
4. Everything else waits on you: RevenueCat account + store subscription products (P2-009-B/C),
   an AI provider decision (RESOLVER-V2-007-B/C), and then P2-010-B once both exist.

This plan itself makes no code changes — see the individual task tracker entries (P2-009-A/B/C,
P2-010-A/B, RESOLVER-V2-007-A/B/C) for execution.
