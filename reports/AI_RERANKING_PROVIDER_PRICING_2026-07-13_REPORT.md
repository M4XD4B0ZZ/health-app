# AI Re-Ranking Provider Pricing & Competitor Research (2026-07-13)

Point-in-time research snapshot for RESOLVER-V2-007-B (AI-assisted re-ranking provider
choice). **Not authoritative** — provider pricing and model IDs change frequently; this is
background for the discussion that led to `scripts/benchmark-ai-reranking-providers.mjs`,
not a durable decision record. The actual provider choice should come from running that
benchmark against current pricing/models, not from this snapshot.

## Pricing snapshot (per 1M tokens, input/output), as researched 2026-07-10/13

| Model                  | Price          | Notes                                                                  |
| ---------------------- | -------------- | ---------------------------------------------------------------------- |
| GPT-5 Nano             | $0.05 / $0.40  | cheapest, built for simple classification                              |
| GPT-5.4 Nano           | $0.20 / $1.25  | successor, slightly pricier                                            |
| Gemini 3.1 Flash Lite  | $0.25 / $1.50  | Google's budget tier                                                   |
| GPT-5 Mini             | $0.25 / $2.00  | mini tier                                                              |
| Perplexity Sonar Small | $0.20 / $0.20  | includes web search, no per-query fee                                  |
| Gemini 3 Flash Preview | $0.50 / $3.00  |                                                                        |
| Claude Haiku 4.5       | $1.00 / $5.00  | pricier than nano tiers, strong JSON/instruction-following reliability |
| Perplexity Sonar Pro   | $3.00 / $15.00 | deeper citations/research                                              |
| Claude Sonnet 5        | $3.00 / $15.00 | overkill for this task                                                 |

At RESOLVER-V2-007's actual per-call token volume (~300–600 input, <100 output for a
2–5-candidate re-rank), absolute per-token price barely matters — even the priciest option
here costs fractions of a cent per call. The `scripts/benchmark-ai-reranking-providers.mjs`
harness measures the things that actually differentiate providers for this task: JSON/schema
reliability, ranking accuracy against known-ambiguous DACH cases, and latency.

## Competitor landscape (2026)

- **MyFitnessPal** acquired Cal AI (March 2026); photo-based "Meal Scan" (Premium+, ~97%
  accuracy per a University of Sydney study) is now their main differentiator.
- **Cronometer** deliberately avoids photo AI, relies on a verified/scientifically-validated
  database — considered the most accurate tracker, at the cost of photo-logging convenience.
- **Yazio** has photo AI recognition gated to its Pro tier; barcode scanning is free-tier.
- **PlateLens** / **Aumaï** are newer photo-first entrants leading 2026 accuracy benchmarks
  for photo-based logging specifically.

Industry direction in 2026 is overwhelmingly photo → AI → calories. Zera's text-first,
deterministic-catalog-first approach (BLS/OFF/USDA with AI only as a narrow re-ranking
assist) is closer in spirit to Cronometer's accuracy-first positioning than to the photo-AI
wave — a different niche, not a head-to-head price/feature race on the same axis.

## Decision boundaries established (see `plans/TIER5_MONETIZATION_TASK_BREAKDOWN_PLAN.md`)

These are the durable takeaways from this research, already reflected in
`AiRerankingProvider`/`RateLimitedAiReranker` and the plan doc — restated here only for
context, not as new information:

- AI is used exclusively to re-rank already-known, already-scored candidates — never to
  source or invent macro/nutrition data.
- A web-search-backed source (e.g. Perplexity) would be a new resolver source, not a
  re-ranking provider — a separate, later architecture/product decision, out of scope for
  RESOLVER-V2-007.
- Provider/model selection is deferred to the benchmark harness, run against defined
  evaluation criteria, not chosen from this pricing snapshot.
