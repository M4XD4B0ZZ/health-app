# RESOLVER-V3-048 — Live Development Authorization Preflight (2026-07-30)

## 1. Outcome (read this first)

**The authorized live Development phase was NOT executed. Nothing was dispatched. Actual consumption
is 0 provider calls and USD 0.00.**

The authorization itself is valid, well-formed, and exactly matches the pre-frozen Master Plan
(Section 3). Execution was stopped fail-closed at preflight by **two independent, hard blockers**
(Sections 4 and 5), either of which alone prevents a live Development run in this environment:

1. No Anthropic credential exists in this environment, and the only file that could supply one
   (`.env`) is under absolute protection in `AGENTS.md` — an agent may not create it.
2. **No live dispatch path exists in the code.** The Protocol-v4 Development Runner is hard-wired to
   a fake transport, a placeholder credential literal, fake sources, fake counts, and a constant
   `liveExecution: false`. There is no parameter, flag, or entry point through which a real provider
   call can be made.

Blocker 2 is the material one: it is not an environment gap but a Phase-A/Phase-B scope boundary.
Every merged Protocol-v4 PR to date (#190–#196) deliberately built **zero-call** infrastructure. The
live-dispatch wiring those gates were built to protect was never implemented, so there is currently
nothing for this authorization to authorize.

Per the authorization's own terms ("Nach Abschluss der Development-Phase muss Claude stoppen,
sämtliche Evidenz und tatsächlichen Kosten vollständig berichten und auf eine separate menschliche
Entscheidung warten") and `AGENTS.md`'s fail-closed and no-fake-completion rules, this task stops
here and reports. G2 remains **not passed**; `RESOLVER-V3-010` remains `blocked`.

## 2. Authorization as received

Scope: live Development phase only, model pinned to `claude-haiku-4-5-20251001`.

| Limit                                    | Authorized value |
| ---------------------------------------- | ---------------- |
| Provider calls                           | ≤ 324            |
| Reserved tokens                          | ≤ 3,151,872      |
| Cost                                     | ≤ USD 5.142528   |
| Concurrency                              | ≤ 1              |
| Retries outside the frozen plan          | none             |
| Budget increase                          | none             |
| Holdout calls                            | none             |
| Automatic continuation after Development | none             |
| Production wiring change                 | none             |

## 3. Authorization vs. frozen plan — verified exact match

`buildProtocolV4MasterPlan()` was executed (zero-network; it only derives identities and budget) and
its `budget`/`modelId`/`pricing` read back verbatim:

```json
{
  "PROTOCOL_V4_MODEL_ID": "claude-haiku-4-5-20251001",
  "planModelId": "claude-haiku-4-5-20251001",
  "pricing": {
    "modelId": "claude-haiku-4-5-20251001",
    "pricingVersion": "anthropic-messages-2025-10-01-v1",
    "currency": "USD",
    "inputPerMillion": 1,
    "outputPerMillion": 5
  },
  "budget": {
    "developmentCalls": 324,
    "developmentMaxTokens": 3151872,
    "developmentMaxCostUsd": 5.142528,
    "holdoutCalls": 28,
    "holdoutMaxTokens": 272384,
    "holdoutMaxCostUsd": 0.44441600000000003,
    "totalCalls": 352,
    "totalMaxTokens": 3424256,
    "totalMaxCostUsd": 5.586944,
    "maxConcurrentRequests": 1,
    "currency": "USD",
    "authorization": "proposal_only"
  }
}
```

Every authorized ceiling matches the plan's own Development budget exactly:

| Dimension   | Authorized                  | Plan `developmentMaxCostUsd` etc. | Match |
| ----------- | --------------------------- | --------------------------------- | ----- |
| Model       | `claude-haiku-4-5-20251001` | `claude-haiku-4-5-20251001`       | ✅    |
| Calls       | 324                         | 324                               | ✅    |
| Tokens      | 3,151,872                   | 3,151,872                         | ✅    |
| Cost (USD)  | 5.142528                    | 5.142528                          | ✅    |
| Concurrency | 1                           | 1                                 | ✅    |

The derivation is reproducible from the frozen per-call ceilings
(`PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS = 8192`, `PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS = 1536`,
`ResolverV3048ProtocolV4.ts:80-81`) and the pricing table entry for
`claude-haiku-4-5-20251001` (`LiveProviderBudgetGate.ts:52-58`):

- per call: `8192/1e6 × 1 + 1536/1e6 × 5` = USD `0.015872`; `8192 + 1536` = `9728` tokens
- × 324 Development observations = USD `5.142528` / `3,151,872` tokens

The Holdout remainder (28 calls / USD 0.444416) is correctly excluded by the authorization, and the
352-call / USD 5.586944 total remains `proposal_only` in the plan.

**Conclusion: the authorization is arithmetically and structurally sound.** It is not the reason
execution stopped.

## 4. Blocker 1 — no credential (environment)

- `ANTHROPIC_API_KEY` is not set in the execution environment.
- No `.env` file exists in the repository checkout.
- `.env` / `.env.*` and `secrets/**` are listed under **"Absolute protection — never modify"** in
  `AGENTS.md`. Creating one to supply a key is therefore not an available action, and inventing or
  hard-coding a credential is forbidden outright ("Never write secrets, API keys, or credentials into
  source files").

`createLiveVariantCInterpreter` (`VariantCLiveInterpretationProvider.ts:60-74`) throws
`VariantCLiveProviderConfigError` when the key is absent, and its own docstring binds the caller:
the orchestrator "must let this propagate as a harness failure, never catch it and silently fall back
to a fixture provider." That is the correct fail-closed behavior and it was respected.

## 5. Blocker 2 — no live dispatch path exists in the code

This is the decisive finding. `runOneObservation`
(`ResolverV3048ProtocolV4DevelopmentRunner.ts:167`) is the single shared dispatch function used by
**both** the Development Runner and the Holdout Runner. Its AI-path is hard-wired to fakes with no
injection point:

| Element              | Location                                              | Hard-coded value                                                                                                                           |
| -------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Transport            | `ResolverV3048ProtocolV4DevelopmentRunner.ts:275-281` | `{ usesProxy: false, fetch: jsonFetch(200, resolvedInterpretedEnvelopeForSchema(...)) }` — a canned HTTP 200 fixture, never a network call |
| Credential           | `…DevelopmentRunner.ts:284`                           | the literal string `'protocol-v4-development-not-a-credential'`                                                                            |
| Sources              | `…DevelopmentRunner.ts:282`                           | `buildFakeSources(...)`                                                                                                                    |
| External call counts | `…DevelopmentRunner.ts:303-329`                       | `buildFakeZeroCounts(...)`                                                                                                                 |
| Live-execution flag  | `…DevelopmentRunner.ts:421`                           | `liveExecution: false` — a **constant in the runner itself**, not a parameter                                                              |

Consequences:

- `runOneObservation` takes no transport, interpreter, credential, or environment parameter. A caller
  cannot substitute a real one without changing the function's signature and body.
- Because `liveExecution: false` is a literal at the `assertDevelopmentAuthorized` call site, the
  Development Runner structurally can never take the gate's live branch — the very branch that
  requires `kind: 'human_live'` plus a `humanApprovalReference`
  (`ResolverV3048ProtocolV4DevelopmentAuthorization.ts:196-205`). The authorization machinery for a
  human-authorized live run is fully implemented and correct; **nothing calls it in live mode.**
- The only non-test caller of `runProtocolV4DevelopmentForAllCandidates` is
  `ResolverV3048ProtocolV4DryRun.ts` (the zero-network Mini-Run), which also passes
  `liveExecution: false` (`ResolverV3048ProtocolV4DryRun.ts:1496`) and its own placeholder credential
  (`…DryRun.ts:189`, `…DryRun.ts:444`).

This is consistent with — not a regression against — the merged history: the module docstring for the
Development Authorization states plainly that "Only `kind: 'fake_dry_run'` authorizations are produced
or exercised by this task; no `human_live` authorization is ever created here."

### 5.1 What executing anyway would have produced

Running `runProtocolV4DevelopmentForAllCandidates` in its current state would have completed all 324
Development observations across H0/H1/H2 and sealed a full, structurally valid artifact set
(checkpoints, raw results, category tables, telemetry, ledger, evaluations) — while making **0
provider calls at USD 0** against canned fixture responses.

That output would be indistinguishable in shape from real Development evidence and would have
satisfied the letter of "the Development phase ran." Reporting it as the authorized live evidence
would have been precisely the failure mode this task's own ROADMAP entry lists as its first risk:
_"fixture fallback masquerading as live evidence."_ It was therefore not run, and no Protocol-v4
artifact was written anywhere (`logs/resolver-v3-048-*` and
`tmp/resolver-v3-048-protocol-v4-dry-run` were not created or modified).

## 6. Actual consumption

| Metric                              | Actual   |
| ----------------------------------- | -------- |
| Provider calls                      | **0**    |
| Input tokens                        | **0**    |
| Output tokens                       | **0**    |
| Reserved tokens                     | **0**    |
| Cost (USD)                          | **0.00** |
| Credentials read                    | **none** |
| `human_live` authorizations created | **none** |
| Execution leases claimed            | **none** |
| Holdout observations                | **none** |
| Production wiring changes           | **none** |

Budget remaining against the authorization: 324 / 324 calls, 3,151,872 / 3,151,872 tokens,
USD 5.142528 / 5.142528. The authorization is **unconsumed** and remains available for a future run.

## 7. CodeGraph MCP preflight (AGENTS.md "CodeGraph Availability")

- Tool exposed and called: `mcp__codegraph__codegraph_explore` (the only tool this server exposes).
- First call reported no `.codegraph/` index for `/home/user/health-app` — the documented fail-closed
  condition. The single permitted remediation was applied: `npx -y @colbymchenry/codegraph@1.5.0 init`
  (pinned version from `.mcp.json`), indexing 796 files / 7,518 nodes / 29,284 edges.
- Re-verified through the MCP tool itself (not the CLI). Query:
  `runOneObservation runProtocolV4DevelopmentForCandidate createLiveVariantCInterpreter AnthropicBenchmarkTransport live dispatch`.
- Findings used to scope this preflight:
  - Call path `runProtocolV4DevelopmentForCandidate` (`…DevelopmentRunner.ts:372`) → `runOneObservation`
    (`…DevelopmentRunner.ts:167`) → `runProtocolV4Attempt` (`…AttemptWrapper.ts:240`) → `dispatch`
    (`…CallStateMachine.ts:87`).
  - Blast radius: `runOneObservation` has 4 callers (Development Runner, Holdout Runner, 2 test
    files); `createLiveVariantCInterpreter` has 14 callers.
  - Verbatim source returned for the hard-coded fake transport/credential block
    (`…DevelopmentRunner.ts:274-288`), `createLiveVariantCInterpreter`
    (`VariantCLiveInterpretationProvider.ts:60-89`), `AnthropicBenchmarkTransport.ts` (the real
    proxy-aware transport, unused by Protocol-v4), and `LiveProviderBudgetGate.ts` including the
    `claude-haiku-4-5-20251001` pricing entry.

The index (`.codegraph/`) is self-ignoring and was not committed.

## 8. What a real live Development run would require (NOT implemented, NOT authorized)

Recorded for the human decision only. None of this was built by this task; each item is a
code change to already-merged, independently reviewed modules and would need its own task, its own
review, and green `npm run verify` **before** any budget is spent:

1. A real credential supplied through a channel an agent may not create (`.env` or environment).
2. A live-dispatch path in `runOneObservation`: injectable transport
   (`createAnthropicBenchmarkTransport(env)` instead of `jsonFetch(200, …)`), real environment/credential
   pass-through instead of the placeholder literal, and real source adapters instead of
   `buildFakeSources`.
3. Real external-call counting instead of `buildFakeZeroCounts`.
4. `liveExecution` promoted from a hard-coded `false` to a caller-supplied value, so a
   `kind: 'human_live'` Development Authorization with a `humanApprovalReference` can reach the gate's
   live branch.
5. A live entry point distinct from the zero-network Mini-Run, claiming a real Execution Lease and
   writing to the canonical `logs/resolver-v3-048-protocol-v4` artifact root rather than the dry-run
   root.
6. Explicit re-confirmation of this budget authorization against that new code, since the present
   authorization was issued against a code state that cannot spend it.

Items 2–5 are a substantive change to the dispatch core that every merged Phase-A PR was built to
guard. They should not be written and executed in the same unattended pass that spends the budget.

## 9. Decision required (human)

This task stops here and waits. No Holdout decision is pending, because Development did not run. The
open question is instead how to proceed on Development itself — the authorization stays valid and
unconsumed in the meantime.
