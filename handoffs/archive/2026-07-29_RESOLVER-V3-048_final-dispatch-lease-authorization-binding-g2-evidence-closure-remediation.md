# Handoff — RESOLVER-V3-048 Final Dispatch-Lease, Authorization-Binding and G2-Evidence Closure remediation (2026-07-29)

1. **Task ID/status:** RESOLVER-V3-048 — `in_progress — Protocol-v4 zero-call Phase-A authorization and
evidence preflight verified (per-observation lease re-check, full lease/authorization-hash binding,
self-validating Development/Holdout Runners, lease crash detection, full Development+Holdout evidence
revalidation, dry-run/authoritative final-report separation); live Development not authorized`. Basis
   `5897c559c4cd7d4aa79919691617d50e836ffc51` (PR #194 merge into `chore/clean-arch-structure`; PR #194
   itself is kept merged, not reverted, per explicit instruction). Working branch:
   `claude/resolver-v3-048-final-dispatch-authorization-closure-f3ky3z`. Final commit: see `git log -1`
   on this branch after the push below (this handoff is committed together with the code in the same
   commit).
2. **What changed:** an independent post-merge review of PR #194 found five residual defects (full
   detail in `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s new §35): (1) the persisted
   Execution Lease was checked once before the whole Development/Holdout candidate-dispatch loop, never
   again before each individual observation — `runOneObservation` (shared by both Runners, the function
   every real dispatch, fast-path or AI-path, goes through) took no lease parameter at all; (2) the
   Lease's own claim input/expected-identity contract accepted/stored `authorizationKind`/
   `maxConcurrentRequests`/`pricingVersion`/`modelId` without ever checking them at dispatch time, and
   never stored an Authorization Record hash at all; (3) the Holdout Runner accepted a minimal
   structural authorization shape (only ID + budget) and explicitly documented that it does not re-gate
   authorization itself, relying entirely on the caller; (4) the Lease store never checked for orphaned
   `vN.json.tmp-*` crash files on read/claim/transition (a crash on the very first claim read back as
   ordinary "no lease"; a crash on a later transition sat invisible next to a valid current version);
   (5) `deriveProtocolV4FinalG2Report` combined Development+Holdout artifacts directly from caller input,
   checking only the outer `candidateId` string, never recomputing a content hash, re-validating
   coverage/telemetry/ledger, or re-deriving either side's evaluation.

   All five are closed: `runOneObservation` now requires a `leaseExpectedIdentity` and re-checks the
   persisted lease from storage immediately before every dispatch (`ResolverV3048ProtocolV4DevelopmentRunner.ts`);
   the Execution Lease record/expected-identity contract grew `authorizationKind`/`runKind`/
   `authorizationSchemaVersion`/`authorizationRecordHash` (plus Holdout-only `holdoutPlanHash`/
   `selectionOrChoiceHash`) as load-bearing, dispatch-time-checked fields, and two new validated claim
   entry points (`claimProtocolV4ExecutionLeaseForDevelopmentAuthorization`/
   `claimProtocolV4ExecutionLeaseForDryRunHoldoutAuthorization`) derive every identity field from a
   genuinely validated Authorization Record chain, never caller overrides
   (`ResolverV3048ProtocolV4ExecutionLease.ts`); the Holdout Runner now requires an explicit
   discriminated `ProtocolV4HoldoutAuthorizationInput` union and independently re-validates it itself via
   the real `assertProtocolV4DryRunHoldoutAuthorized`/`assertHoldoutAuthorized` gate before dispatching
   (`ResolverV3048ProtocolV4HoldoutRunner.ts`); the Lease store detects orphaned `vN.json.tmp-*` on every
   read/claim/transition (`ProtocolV4ExecutionLeaseCrashError`) with a new, separate
   `recoverProtocolV4ExecutionLeaseCrash` that permanently poisons the authorization ID; and
   `deriveProtocolV4FinalG2Report` is replaced by `deriveProtocolV4DryRunFinalG2TechnicalReport`
   (`ResolverV3048ProtocolV4Evaluation.ts`), which independently revalidates both partitions' full
   artifact sets (content-hash recomputation, coverage, telemetry/ledger parity, evaluation
   re-derivation-and-compare) before combining them, and produces the new, structurally distinct
   `ProtocolV4DryRunFinalG2TechnicalReport` type (`authoritative: false`, `runKind: 'fake_dry_run_only'`,
   a fixed disclaimer) — the only report type this task's Mini-Run produces. A separate
   `ProtocolV4AuthoritativeFinalG2Report` type is declared purely structurally, with no builder function
   anywhere in this task. Two-concurrent-transition handling (the task's item 16) was investigated and
   found already correctly closed by the pre-existing exclusive-create version-file mechanism — verified
   with a fresh regression test, not re-implemented.

3. **Why it changed:** the task's own independent post-merge review confirmed all five defect categories
   against the actual PR #194 merge commit before any fix was written; a dedicated red-baseline test
   file was run unmodified against that commit first and reproduced 5 focused proofs (10 more items —
   4-8, 11-12, 16 — required brand-new fields/types that cannot be expressed against the pre-remediation
   types at all, so those are proven by direct code citation instead, matching this repository's
   established convention for that situation).
4. **Files changed:** rewrote `ResolverV3048ProtocolV4ExecutionLease.ts` (extended lease identity, crash
   detection, validated claim wrappers), `ResolverV3048ProtocolV4DevelopmentRunner.ts` (per-observation
   lease check in `runOneObservation`), `ResolverV3048ProtocolV4HoldoutRunner.ts` (discriminated
   authorization union, self-validation, per-observation lease check), `ResolverV3048ProtocolV4Evaluation.ts`
   (full Development+Holdout evidence revalidation, dry-run/authoritative final-report split),
   `ResolverV3048ProtocolV4DryRun.ts` (migrated to the new claim wrappers, Holdout Runner signature, and
   final-report function); new test file
   `__tests__/ResolverV3048ProtocolV4FinalDispatchAuthorizationClosureRedBaseline.test.ts` (23 focused
   items covering all 22 required regressions); updated
   `__tests__/ResolverV3048ProtocolV4FinalPhaseAClosureRedBaseline.test.ts` and
   `__tests__/ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts` (new required lease/
   authorization-input fields and signatures at existing call sites; one now-superseded fabricated-lease
   test removed with an explicit pointer to its stronger replacement); `ROADMAP.md` (V3-048 status
   update); `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md` (additive new §35); this handoff.
   No V3-039 evidence, corpus, ground truth, evaluator logic, BLS artifact, CI workflow, dependency,
   migration, `.env`, or production file changed; `package.json`/`package-lock.json` unchanged (`npm
install` was run only to restore missing `node_modules`, matching the existing lockfile exactly).
5. **Verification executed:** a dedicated red-baseline test file run unmodified against the base commit
   (5/5 focused proofs passed, confirming the defects); `npm install` (restoring missing
   `node_modules`); `npm run typecheck`, `npm run lint`, `npm run format:check` (repo-wide, all clean);
   `npx jest --runInBand src/features/nutrition/benchmark/protocolV4` (6 suites / 139 tests, all
   passing); `npx jest --runInBand src/features/nutrition/benchmark` (76 suites / 884 tests, all
   passing, unchanged outside `protocolV4/`); `npm run verify` (full combined command: typecheck + lint +
   format:check + complete Jest suite, run to completion); `git status`/`git diff --check`; manual `git
diff --stat` review confirming only `protocolV4/` implementation/test files plus `ROADMAP.md`/the
   preflight report/this handoff changed, no frozen/protected path touched.
6. **Verification result:** all of the above passed. `npm run verify` (the full combined command:
   typecheck + lint + format:check + complete `npm test`) ran to completion with exit code 0 — **252
   suites / 2693 tests passed repo-wide**, 1084.335 s. Provider calls 0; provider cost USD 0; no
   credential read (`ANTHROPIC_API_KEY` remains a literal placeholder string, never read from
   `process.env`, in every fixture).
7. **Known issues/blockers/residual risks:** green GitHub Verify is still required before merge — this
   agent did not create a PR (per explicit instruction, the user opens it manually). The 352-call / USD
   5.586944 proposal-only budget remains numerically unchanged and explicitly **not authorized**; no
   `human_live` authorization was created or exercised; no live Development or Holdout execution
   occurred. G2 remains **not passed**; V3-010 remains `blocked`; V3-048 remains `in_progress`. The new
   discriminated Holdout-authorization union's `human_live` branch and the structural-only
   `ProtocolV4AuthoritativeFinalG2Report` type are new, purely structural infrastructure only — neither
   constitutes new live evidence, an authorization, or a G2 decision, and neither changes V3-010's
   blocked status.
8. **Human review/next steps:** review this diff, in particular the per-observation lease-check wiring
   in `ResolverV3048ProtocolV4DevelopmentRunner.ts`/`ResolverV3048ProtocolV4HoldoutRunner.ts` and the
   Final-G2-report revalidation/split in `ResolverV3048ProtocolV4Evaluation.ts`
   (`reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s new §35); require green GitHub Verify
   before merge. The user creates and merges the PR manually after independent review — no PR was opened
   or merged by this agent, and this task is not marked done. Do not proceed automatically to any further
   task after this one.
