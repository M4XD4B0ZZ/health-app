# Handoff — RESOLVER-V3-048-INCIDENT-002: Crash-Durable Live Accounting and Governed Abandoned-Lease Recovery (2026-08-03)

1. **Task ID/status:** `RESOLVER-V3-048` — remains `in_progress`. This task remediates
   `RESOLVER-V3-048-INCIDENT-002`: a real Protocol-v4 `human_live` Development attempt that was
   interrupted after its Execution Lease had already reached `executing`. Basis:
   `90573aca45cdb1ada20876cf48971a97d56281a9` (the PR #207 merge and the verified tip of
   `origin/chore/clean-arch-structure`). Branch: `fix/resolver-v3-048-incident-002`. The independent
   incident review verdict was `REMEDIATION_REQUIRED`. **No live run happened in this task. Actual
   consumption for this remediation: 0 provider calls, 0 tokens, USD 0.00.** G2 remains `not passed`;
   `RESOLVER-V3-010` remains `blocked`; Holdout remains unexecuted, unauthorized, and unreferenced.
   **The real incident was NOT recovered here.**

2. **The incident and its usage classification:**
   - Surviving evidence: an append-only **v1 `claimed`** lease, a **v2 `executing`** lease, **no v3
     terminal version**, **no candidate artifacts**.
   - The authorization was **not consumed** (no atomic consumption marker was written) but is
     **permanently non-reusable**: `claimProtocolV4ExecutionLease` collides on the same
     exclusive-create `v1.json` for that authorization ID in any lifecycle state.
   - **Usage state: `POSSIBLE_NONZERO`.** Authorized ceiling **324 calls / USD 5.142528** — a budget
     bound, **not** evidence of actual consumption. This incident must **never** be recorded as zero
     calls / USD 0.00: at the moment of interruption the only provider-request accounting that existed
     was in process memory, so no durable artifact can support an exact-zero claim.
   - The real incident worktree `D:\Workspaces_VSCode\HealthApp-live-auth` and its
     `logs\resolver-v3-048-protocol-v4` evidence were never read, copied, edited, deleted, renamed,
     terminalized, or otherwise mutated. Known incident hashes are recorded for documentation only in
     `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_B3_LIVE_LAUNCHER.md` §15.1.

3. **The five confirmed defects:** (1) provider-request accounting existed only in process memory and
   was lost on abrupt termination; (2) candidate telemetry/ledger/results were persisted only after a
   candidate's full observation loop, so an abrupt termination could leave zero artifacts despite
   possible provider requests; (3) `recoverProtocolV4AbandonedExecutionLease` had no governed
   operator-invocable path; (4) a non-terminal `executing` lease carried insufficient durable liveness
   and transition evidence; (5) three launcher tests asserted `fs.existsSync(realLiveRoot) === false`
   and therefore failed once legitimate incident evidence was present.

4. **What changed:**
   - **Remediation A/D (new):**
     `src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4RuntimeJournal.ts` — a
     root-bound, authorization-bound, lease-bound, append-only, crash-durable journal under
     `<PROTOCOL_V4_LIVE_ROOT>/runtime-journal/<authorization-storage-key>/e<N>.json`. Event kinds:
     `executing_started`, `dispatch_intent`, `dispatch_completed`, `dispatch_failed`,
     `terminalization_started`, `recovery_recorded`. Every event is exclusively created (`wx` temp +
     `fsync` + `linkSync`), sequence-addressed by its own filename, **immediately read back and
     hash-validated**, immutable after creation, written only under the canonical live root, and bound
     to authorization ID / lease ID+version+status+hash (re-read from storage per append) / plan hash /
     execution-tree hash / phase / run kind / candidate ID / call ID / dispatch ID / model ID /
     pricing version. Every event also carries durable liveness identity (`pid`, `hostId`,
     `processStartedAtIso`, `recordedAtIso`).
   - **Dispatch ordering (the core fix)** in `ResolverV3048ProtocolV4ExecutionContext.ts`'s private
     counting transport — the single place a provider HTTP attempt can begin: **(1)** reserve on the
     canonical budget gate, **(2)** durably persist and read back `dispatch_intent`, **(3)** only then
     advance the transport-authoritative HTTP-attempt counter and call `realTransport.fetch`. A failed
     intent persist therefore throws strictly **before** the transport is reached. A rejected `fetch`
     is durably resolved at the same boundary as `dispatch_failed`; a resolved `fetch` is closed out as
     `dispatch_completed` carrying the terminal metadata's accepted usage fields.
   - **Lifecycle wiring** in `ResolverV3048ProtocolV4DevelopmentRunner.ts`: the journal is opened
     immediately after the `claimed -> executing` transition (so it is always lease-bound),
     `executing_started` is appended before any further work, and `terminalization_started` is appended
     before authorization consumption / `terminal_success` and (in its own nested `try`/`catch`, so it
     can never mask the original error) before `terminal_failure`. `human_live` only — `fake_dry_run`
     is unaffected. The new `runtimeJournal` parameter on
     `runProtocolV4DevelopmentForCandidate`/`runOneObservation` is **optional**, so the three existing
     direct-call test sites (identified via CodeGraph blast radius) keep compiling and passing
     unchanged.
   - **Remediation B:** `reduceProtocolV4RuntimeJournal` (pure) / `classifyProtocolV4DurableAccounting`
     (storage-backed) derive only `EXACT_ZERO` / `EXACT` / `PARTIAL` / `POSSIBLE_NONZERO`. Intents are
     the durable **upper** bound on provider requests (an intent proves a request _may_ have occurred,
     never that one was billed); completions are the durable **lower** bound. No journal at all ⇒
     `POSSIBLE_NONZERO`, never exact zero. Reserved worst-case ceilings are preserved whenever the
     accounting is not exact. No exact token or cost value is ever invented for an unresolved intent.
   - **Remediation C (new):** `ResolverV3048ProtocolV4LeaseRecovery.ts` +
     `scripts/recover-resolver-v3-048-abandoned-lease.mjs` (`--inspect` read-only / `--recover`). A
     dedicated executable, not a new launcher mode: it imports no transport, interpreter, runner or
     live entry point, so no code path from it to a provider request exists. Fails closed if
     `ANTHROPIC_API_KEY` is present. `--recover` requires the authorization ID, expected lease
     version + status + hash, an enumerated reason code, a non-empty approval reference, an exact
     confirmation token, and an explicit human liveness confirmation. It verifies the authorization is
     unconsumed, no terminal version exists anywhere in the history, and the lease is still
     `executing`; appends exactly one `abandoned` version; proves every earlier version is
     byte-for-byte unchanged; writes a durable, separately hashed, append-only recovery record; and
     never makes the authorization reusable. A repeat invocation fails closed.
   - **Remediation E:** the three defective assertions now snapshot the canonical live root's full
     structure + per-file SHA-256 hashes and require a byte-identical snapshot afterwards. A regression
     fixture seeds a genuinely legitimate `claimed -> executing` lease under an isolated temp repo root
     and proves preflight, missing-key rejection, and the mocked-success path all leave it
     byte-identical. **No real evidence is deleted or hidden to make a test pass.**
   - Two small additive read-only exports on the lease module
     (`listProtocolV4ExecutionLeaseVersions`, `readProtocolV4ExecutionLeaseVersion`) and matching
     read-only re-exports on `launcherBridge.ts`. The journal **writer** is deliberately **not**
     exported to the bridge — only
     `ResolverV3048ProtocolV4DevelopmentRunner.ts`/`...ExecutionContext.ts` may append dispatch events,
     mirroring the failure-metadata side channel's own rule.

5. **CodeGraph evidence:** `.codegraph/` was absent, so exactly one AGENTS.md-authorized bootstrap ran
   with the `.mcp.json`-pinned version (`npx -y @colbymchenry/codegraph@1.5.0 init`; 808 files, 7,801
   nodes, 30,781 edges; `.codegraph/` is gitignored, `git status --short` and
   `git status --short --untracked-files=all` were both empty afterwards, `HEAD` unchanged). All three
   mandated queries then ran through the real MCP tool `mcp__codegraph__codegraph_explore` with
   `projectPath=D:\Workspaces_VSCode\HealthApp-incident-002`; findings are recorded in the report's
   §15.7 (call flows, the no-caller proof for `recoverProtocolV4AbandonedExecutionLease`, the
   after-the-loop position of `writeAndReadBackLiveArtifact`, and the blast radius that drove the
   optional-parameter decision).

6. **Verification (all commands run in this worktree; exact results in the PR body):**
   - `npx jest --runInBand src/features/nutrition/benchmark/protocolV4` — all suites pass, including
     the three new ones (`...RuntimeJournal.test.ts`, `...LeaseRecovery.test.ts`,
     `...RuntimeJournalDispatchWiring.test.ts`).
   - `node --test scripts/__tests__/resolver-v3-048-runtime-journal-crash.test.mjs` — 9/9 pass. The
     crash tests use a **real child process killed with SIGKILL**, not a catchable exception.
   - `node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs` — requires a clean
     working tree (the launcher's own fail-closed gate), so it is run after committing.
   - `npm run test`, `npm run verify` (typecheck + lint + format:check + test).
   - The transient `build/resolver-v3-048-live-launcher/` output must be removed before `npm run lint`
     — `build/` is not in the ESLint `ignorePatterns` (pre-existing, out of scope).

7. **Explicitly NOT done (and must not be inferred as done):** the real incident recovery; any new live
   authorization; any reuse of the old authorization; any Development or Holdout execution; any
   inspection or use of a real API key; any production live root; any automatic retry; the Windows
   `.ps1` one-shot runner (a separate follow-up after this remediation is merged and independently
   reviewed); any product resolver behavior change; any G2 pass declaration.

8. **Human-review status / next steps:** not yet reviewed. A PR against `chore/clean-arch-structure`
   was opened by this task; no merge by this agent. Nothing here should be read as authorization to run
   live. The real incident lease remains `executing` and un-recovered — recovering it is a separate,
   explicitly human-authorized operation using `scripts/recover-resolver-v3-048-abandoned-lease.mjs`,
   which must record the incident's usage state as `POSSIBLE_NONZERO` and never as zero.
