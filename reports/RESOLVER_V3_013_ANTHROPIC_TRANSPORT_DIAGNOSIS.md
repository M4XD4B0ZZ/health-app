# RESOLVER-V3-013 — Anthropic Messages Transport Diagnosis

**Date:** 2026-07-20
**Task status:** `blocked`
**Scope:** Transport connectivity only; no Variant B/C benchmark was run.

## Safe probe contract

Every HTTP probe used `POST https://api.anthropic.com/v1/messages` with the fixed, intentionally
invalid dummy key `invalid-diagnostic-key-not-a-secret` and a minimal syntactically valid Messages
body (`claude-haiku-4-5`, `max_tokens: 1`, one user message). The real `ANTHROPIC_API_KEY` was not
read, used, or logged. A `401` response is therefore the expected non-billed authentication result,
not a usable provider request.

## Reproducible results

| Check                                                                      | Result | Evidence                                                                                |
| -------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| System DNS                                                                 | pass   | `api.anthropic.com` resolved to IPv6 `2607:6bc0::10` and IPv4 `160.79.104.10`.          |
| Node DNS                                                                   | pass   | Node `dns.lookup(..., { all: true })` returned the same IPv6 and IPv4 addresses.        |
| curl TLS + dummy POST                                                      | pass   | curl exited `0`, TLS verification result was `0`, and the endpoint returned HTTP `401`. |
| Benchmark-equivalent Node global `fetch` + dummy POST                      | fail   | Node `v20.20.2` (Undici `6.24.1`) threw `TypeError: fetch failed`.                      |
| Node global `fetch` with the configured proxy dispatcher + same dummy POST | pass   | Returned HTTP `401`.                                                                    |

The unmodified benchmark-equivalent Node failure is recorded only with the approved secret-free
technical fields:

```json
{
  "error.name": "TypeError",
  "error.message": "fetch failed",
  "error.cause.name": "AggregateError",
  "error.cause.code": "ENETUNREACH",
  "error.cause.errno": null,
  "error.cause.syscall": null,
  "error.cause.hostname": null
}
```

Proxy environment variables were present (presence only was checked; their values were not printed).
For control, forcing Node DNS to IPv4 first did **not** change the same `ENETUNREACH` failure. With
the existing configured HTTPS proxy supplied to Undici's `ProxyAgent` in the diagnostic process,
the same Node global `fetch` received HTTP `401`.

## Root cause and decision

This is case **B**: curl reaches the Messages endpoint and receives an HTTP response, while the
benchmark's Node global `fetch` fails before HTTP. DNS and TLS endpoint reachability are not the
blocker. The demonstrated cause is that the benchmark uses raw Node/Undici global `fetch` without
an HTTP(S)-proxy dispatcher in an environment whose outbound route requires the configured proxy;
the direct Node route fails with `ENETUNREACH`. IPv4 preference does not resolve it.

No provider configuration, model ID, prompt, schema, ground truth, benchmark result, or live
provider code was changed from this diagnosis. `RESOLVER-V3-013` remains `blocked`, and its
dependent production task `RESOLVER-V3-010` remains `blocked`.

## Safe next step

Before any further live evidence, perform a separately scoped and reviewed change that makes the
benchmark transport explicitly proxy-aware (or provides an approved equivalent Node dispatcher),
with focused tests for direct and proxy-routed behaviour and secret-safe error metadata. Re-run this
dummy-key transport probe after that change. Only if it again receives the expected HTTP `401` may a
fresh context perform the fixed full B/C live protocol exactly once under its existing aggregate
budget gate.
