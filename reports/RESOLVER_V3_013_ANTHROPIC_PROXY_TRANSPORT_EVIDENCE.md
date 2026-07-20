# RESOLVER-V3-013 — Proxy-Aware Anthropic Benchmark Transport Evidence

**Date:** 2026-07-20
**Task status:** `blocked`
**Scope:** benchmark-local transport only; no B/C live benchmark was run.

## Implemented transport architecture

`AnthropicBenchmarkTransport` is one benchmark-infrastructure abstraction used by both live
providers. It selects a non-empty standard proxy configuration in this precedence order:
`HTTPS_PROXY`, `https_proxy`, `HTTP_PROXY`, `http_proxy`, `ALL_PROXY`, `all_proxy`. When one is
present it creates Undici's `ProxyAgent` and passes it explicitly as the dispatcher for that
individual Messages `fetch` call. When none is present, it keeps direct Node transport.

The implementation does not call `setGlobalDispatcher`; no process-global dispatcher state is
mutated. Proxy values are never logged, exported, persisted, or included in errors. Invalid proxy
configuration reports only a fixed secret-free error message.

## Runtime proxy detection and safe transport proof

At execution time a suitable standard proxy configuration was **present**. Its variable value and
all credentials were intentionally neither read into output nor recorded.

One and only one transport-only POST was made to `https://api.anthropic.com/v1/messages`, using an
intentionally invalid dummy key and a minimal syntactically valid Messages body. The explicit
Undici proxy dispatcher returned **HTTP 401**. Node/Undici reached Anthropic and received an HTTP
response; there was no `ENETUNREACH` or generic `fetch failed` result. No real provider key, B/C
benchmark request, fixture fallback, prompt/schema change, ground-truth change, or production
wiring was used.

## Offline safeguards verified

- No proxy variable selects direct transport; a standard proxy variable selects a per-request
  dispatcher.
- Both B and C use the shared factory and preserve pre-request shared budget reservations.
- Credential guards fail before provider construction/network use.
- Fixture A/B/C regressions remain offline and do not use proxy transport or Anthropic calls.
- Normal Jest test discovery excludes `runResolverV3LiveEvidence.harness.ts`, so `npm run verify`
  does not invoke paid live evidence.
- Tests confirm no global Undici dispatcher state changes between tests.

## Remaining risks and decision

The local `undici` runtime dependency is currently available transitively rather than declared as a
direct package dependency; this benchmark-local implementation adds no dependency change. Proxy
availability can differ across environments; without a proxy, direct transport is retained and may
still fail in an environment requiring proxy egress.

The successful dummy-key HTTP response clears only the prior transport blocker. It does not
produce provider-quality, cost, latency, usage, or repeatability evidence. `RESOLVER-V3-013` and
`RESOLVER-V3-010` remain `blocked`; a new context may consider the fixed, one-time B/C protocol
only after human review confirms this scoped change and the shared USD budget gate remains
authorized.
