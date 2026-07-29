# Handoff — RESOLVER-V3-048 Final Phase-A Closure remediation (2026-07-28)

1. **Task ID/status:** RESOLVER-V3-048 — `in_progress — Protocol-v4 zero-call Phase-A infrastructure
verified (atomic Execution Lease, strict Selection-Rule fidelity, non-authoritative Dry-Run Choice
contract, real Development/Holdout partitioning, joint G2 report, crash-detection integration); live
Development not authorized`; basis `02cbe71d715b987f1b21b63937b6868cca605ff6` (PR #193's merge
   commit into `chore/clean-arch-structure`; PR #193 itself is kept merged, not reverted, per explicit
   instruction). Working branch: `claude/resolver-v3-048-final-phase-a-closure`.
2. **What changed:** an independent post-merge review of PR #193 found six residual defect categories
   (full detail in `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`'s new §34): (1) GitHub
   Verify failed on `format:check` because `ROADMAP.md` was not Prettier-conformant, and the PR was
   merged ~5 seconds after opening, before CI could run; (2) the executed Development-time eligibility
   screen (`isProtocolV4CandidateEligibleAtDevelopmentTime`) had silently diverged from the still-hashed
   `SELECTION_RULE.eligibility` contract, accepting `not_evaluable`/`requires_human_judgment` mandatory
   gates as eligible and demoting `criticalFalseConfidenceCount` to a tie-breaker; (3)
   `assertDevelopmentAuthorized`/`assertHoldoutAuthorized` were check-then-act — an authorization's
   atomic consumption marker was only written AFTER every dispatch completed, leaving a race window
   where two concurrent callers could both pass the "not consumed" check before either had dispatched;
   (4) neither Runner required anything beyond the caller-gated authorization record itself — no
   independent, persisted, typed execution-permission object existed; (5)
   `assembleProtocolV4LiveCaseRecord` hard-coded `partition: 'development'` on every case record
   regardless of which phase produced it, so the Holdout Runner's own evaluation silently routed real
   Holdout evidence into the Development bucket of the real evaluator's report builder; (6)
   `detectProtocolV4ArtifactCrash()` existed but nothing called it, so
   `isProtocolV4ArtifactTargetUnused()` still reported a target with orphaned crash evidence
   (`*.tmp-*` sibling, no final file) as "unused".

   All six are closed: a new `ResolverV3048ProtocolV4ExecutionLease.ts` module provides a real atomic
   Execution Lease (exclusive-create claim, versioned/immutable, `claimed -> executing ->
terminal_success|terminal_failure`, plus a separate explicit `abandoned` recovery transition) that
   must be claimed before the first Development/Holdout dispatch and is re-checked from storage
   (never a caller-held object) immediately before every dispatch against phase/plan-hash/
   execution-tree-hash/authorization-id/artifact-root/candidate-scope/budget-scope; both
   `runProtocolV4DevelopmentForCandidate`/`runProtocolV4DevelopmentForAllCandidates`
   (`ResolverV3048ProtocolV4DevelopmentRunner.ts`) and `runProtocolV4HoldoutForSelectedCandidate`
   (`ResolverV3048ProtocolV4HoldoutRunner.ts`) now require this lease as a mandatory parameter and
   assert it active before dispatching; `isProtocolV4CandidateEligibleAtDevelopmentTime`/
   `selectCandidate` (`ResolverV3048ProtocolV4.ts`) are restored to the exact, strict
   `SELECTION_RULE.eligibility` contract, so `selectCandidate`/`selectCandidateFromDevelopmentEvidence`
   now honestly throw `PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE` on real Development-only evidence (the real
   evaluator's joint gate combinator structurally cannot resolve a mandatory gate to `passed` before
   Holdout data exists) rather than fabricating a live winner; a new, fully separate, explicitly
   non-authoritative `ResolverV3048ProtocolV4DryRunChoice.ts` module
   (`ProtocolV4DryRunCandidateChoice`/`ProtocolV4DryRunHoldoutExecutionPlan`/
   `ProtocolV4DryRunHoldoutAuthorization`/`assertProtocolV4DryRunHoldoutAuthorized`, every record
   `authoritative: false`/`kind: 'fake_dry_run_only'`, no `liveExecution`/`human_live` concept anywhere
   in the gate's signature) now drives the Zero-Network Mini-Run's technical Holdout exercise instead;
   `assembleProtocolV4LiveCaseRecord` (`ResolverV3048ProtocolV4RealEvaluator.ts`) takes an explicit,
   required `partition` parameter, and `deriveProtocolV4CandidateEvaluation`/
   `buildRealEvidenceForCandidate` (`ResolverV3048ProtocolV4Evaluation.ts`) route Development/Holdout
   case records into the correct bucket accordingly (Holdout is now genuinely evaluated with
   `partition: "holdout"`); a new `deriveProtocolV4FinalG2Report` function is the only entry point for
   a FINAL, joint Development+Holdout G2 verdict, requiring and combining both partitions' validated
   artifacts for the same candidate (joint-only mandatory gates now genuinely resolve beyond
   `not_evaluable` for the first time; a single-partition evaluation still honestly stays
   `not_evaluable`/`requires_human_judgment`); the Mini-Run
   (`runProtocolV4MiniProtocolRun`) claims a Development and Holdout lease before each phase's first
   dispatch, uses the Dry-Run Choice contract, and produces/persists a
   `final/g2-decision-report.json` artifact before stopping; and `isProtocolV4ArtifactTargetUnused()`
   (`ResolverV3048ProtocolV4ArtifactStore.ts`) now consults `detectProtocolV4ArtifactCrash()` and
   throws a new, distinct `ProtocolV4ArtifactCrashError` instead of reporting "unused", with a
   separate, explicit `recoverProtocolV4ArtifactCrash()` recovery function never invoked automatically.
   `ROADMAP.md` was reformatted with the existing Prettier config (no Prettier/ESLint/CI config
   changed, no `format:check` bypass).

3. **Why it changed:** the task's own independent post-merge review confirmed all six defect
   categories against the actual PR #193 merge commit before any fix was written; the GitHub Verify
   failure and premature merge were independently reported by the user and confirmed by reproducing
   the `format:check` failure against the unmodified base commit.
4. **Files changed:** 3 new files under `src/features/nutrition/benchmark/protocolV4/`
   (`ResolverV3048ProtocolV4ExecutionLease.ts`, `ResolverV3048ProtocolV4DryRunChoice.ts`, and the new
   test file `__tests__/ResolverV3048ProtocolV4FinalPhaseAClosureRedBaseline.test.ts`); rewrote
   `ResolverV3048ProtocolV4.ts` (strict eligibility restoration), `ResolverV3048ProtocolV4ArtifactStore.ts`
   (crash-integrated `isProtocolV4ArtifactTargetUnused`, new `ProtocolV4ArtifactCrashError`/
   `recoverProtocolV4ArtifactCrash`), `ResolverV3048ProtocolV4RealEvaluator.ts` (explicit `partition`
   parameter), `ResolverV3048ProtocolV4Evaluation.ts` (partition-aware derivation,
   `deriveProtocolV4FinalG2Report`), `ResolverV3048ProtocolV4DevelopmentRunner.ts` and
   `ResolverV3048ProtocolV4HoldoutRunner.ts` (mandatory lease parameter + lifecycle), and
   `ResolverV3048ProtocolV4DryRun.ts` (lease claiming, Dry-Run Choice wiring, final combined report);
   updated `__tests__/ResolverV3048ProtocolV4.test.ts`,
   `__tests__/ResolverV3048ProtocolV4DryRun.test.ts`,
   `__tests__/ResolverV3048ProtocolV4FinalEvidenceLineageRedBaseline.test.ts` (added mandatory `lease`
   parameters to existing direct Runner call sites; adjusted eligibility test data and the
   `finalG2ReportHash` artifact-hash key to match the restored strict rule and new artifact); formatted
   `ROADMAP.md`; updated `ROADMAP.md`'s V3-048 entry (new remediation section + status line);
   `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md` (additive new §34); this handoff. No
   V3-039 evidence, corpus, ground truth, evaluator logic, BLS artifact, CI workflow, dependency,
   migration, `.env`, or production file changed; `package.json`/`package-lock.json` unchanged (`npm
install` was run only to restore missing `node_modules`, matching the existing lockfile exactly).
5. **Verification executed:** `npm install` (restoring missing `node_modules`); `npm run typecheck`,
   `npm run lint`, `npm run format:check` (repo-wide, all clean); `npx jest --runInBand
src/features/nutrition/benchmark/protocolV4` (5 suites / 117 tests, all passing — 96 pre-existing +
   21 new focused regressions for this task's 18 required red-baseline items); `npx jest --runInBand
src/features/nutrition/benchmark` (74 suites / 841 tests, all passing, unchanged outside
   `protocolV4/`); `npm run verify` (full combined command: typecheck + lint + format:check + complete
   Jest suite, run to completion, no premature abort); `git status`/`git diff --check`; manual `git
diff --stat` review confirming only `protocolV4/` implementation/test files plus `ROADMAP.md`/the
   preflight report/this handoff changed, no frozen/protected path touched.
6. **Verification result:** all of the above passed, including the full `npm run verify` end to end,
   confirmed completed in the background after the commit/push below with exit code 0: **251 suites /
   2671 tests passed repo-wide**, 811.9 s (this is the first task in this series where the full-repo
   Jest run is confirmed to terminate and pass in this environment, rather than the previously-
   documented non-termination symptom — no configuration was changed to achieve this; the run simply
   took longer than earlier interrupt thresholds and completed cleanly). Provider calls 0; provider
   cost USD 0; no credential read (`ANTHROPIC_API_KEY` remains a literal placeholder string, never read
   from `process.env`, in every fixture).
7. **Known issues/blockers/residual risks:** green GitHub Verify is still required before merge — this
   agent did not create a PR (per explicit instruction, the user opens it manually). The 352-call /
   USD 5.586944 proposal-only budget remains numerically unchanged and explicitly **not authorized**;
   no `human_live` authorization was created or exercised; no live Development or Holdout execution
   occurred. G2 remains **not passed**; V3-010 remains `blocked`; V3-048 remains `in_progress`. The
   Dry-Run Choice / final-combined-G2-report machinery is new, technical, zero-network infrastructure
   only — it does not itself constitute new live evidence and does not change V3-010's blocked status
   or unblock V3-048.
8. **Human review/next steps:** review this diff, in particular the Selection-Rule restoration
   (§34.2) and the Execution Lease module (§34.3/34.4) in
   `reports/RESOLVER_V3_048_PROTOCOL_V4_PHASE_A_PREFLIGHT.md`; require green GitHub Verify before
   merge. The user creates and merges the PR manually after independent review — no PR was opened or
   merged by this agent, and this task is not marked done. Do not proceed automatically to any further
   task after this one.

---
