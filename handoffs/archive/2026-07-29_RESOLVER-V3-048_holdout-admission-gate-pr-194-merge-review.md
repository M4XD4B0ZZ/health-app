# Handoff — RESOLVER-V3-048 Holdout Admission Gate + PR #194 merge review (2026-07-29)

1. **Task ID/status:** RESOLVER-V3-048 — `in_progress — Phase-A lease/selection/holdout-evidence
remediation merged via PR #194 (green, though non-gating, GitHub Verify); explicit, pre-frozen
Holdout Admission Gate now closes the Development-to-Holdout selection contradiction; live
Development/Holdout still not authorized`; basis `5897c559c4cd7d4aa79919691617d50e836ffc51` (PR
   #194's merge commit into `chore/clean-arch-structure`, itself the tip of the designated branch
   `claude/phase-a-holdout-admission-urfjyk` at session start, plus one unrelated `.gitignore` commit).
2. **What changed:** two independent pieces of work, per the task's two explicit asks.

   **(a) PR #194 merge review.** Fetched PR #194's GitHub record: `merged: true`, `merged_at
2026-07-29T06:52:39Z`, its single `verify` check run `conclusion: success` — but that check's own
   `started_at` is `06:52:20Z` and `completed_at` is `07:10:31Z`, i.e. the merge happened ~19s after
   the check started and ~18 minutes _before_ it actually finished. The merge was therefore not
   gated on the check's completion, reproducing — on this very PR — the exact premature-merge-before-
   CI pattern the PR's own summary describes fixing for PR #193. The check did complete `success`
   before this session started, so no revert was warranted; the merged diff was independently
   re-reviewed (`ResolverV3048ProtocolV4ExecutionLease.ts`, the restored strict `SELECTION_RULE`
   eligibility screen in `ResolverV3048ProtocolV4.ts`, the new `ResolverV3048ProtocolV4DryRunChoice.ts`,
   the `partition`-aware `ResolverV3048ProtocolV4RealEvaluator.ts`/`ResolverV3048ProtocolV4Evaluation.ts`,
   and crash-detection integration in `ResolverV3048ProtocolV4ArtifactStore.ts`) against the six
   claimed defect fixes with no further code defect found. Recorded as a process-gap finding in
   `ROADMAP.md`'s V3-048 section (merges should wait for `completed`/`success`, not just existence, of
   the check run) — no code or CI-workflow change was made for this finding itself.

   **(b) Holdout Admission Gate (the task's primary ask).** The canonical `SELECTION_RULE` correctly
   requires `allMandatoryG2CriteriaPass === true`, which the real evaluator's joint gate combinator can
   never produce from Development-only evidence — so `selectCandidate`/
   `selectCandidateFromDevelopmentEvidence` always honestly throw `PROTOCOL_V4_NO_ELIGIBLE_CANDIDATE`
   pre-Holdout. The only existing alternative, `ProtocolV4DryRunCandidateChoice`
   (`ResolverV3048ProtocolV4DryRunChoice.ts`), is explicitly `authoritative: false`/
   `kind: 'fake_dry_run_only'` and structurally can never back a `human_live` authorization. There was
   therefore no legal path from genuine live Development evidence to a real Holdout dispatch at all.
   New module `ResolverV3048ProtocolV4HoldoutAdmission.ts` closes this with a third, separately-named,
   pre-frozen contract: `HOLDOUT_ADMISSION_RULE` (own version/hash, independent of `SELECTION_RULE`);
   `isProtocolV4CandidateAdmissibleForHoldout` (admits zero-critical-false-confidence,
   complete-contracts, no-explicit-`failed`-gate candidates — `not_evaluable`/`requires_human_judgment`
   joint gates are expected pre-Holdout and do not disqualify); `admitCandidateForHoldout(plan,
evidence, humanReview)` (the single entry point — requires all three candidates' real,
   artifact-validated Development evidence and a mandatory human review record, ranks admissible
   candidates via the same pre-declared ordered-comparison/tie-break methodology `SELECTION_RULE`
   already uses, admits exactly one, throws `PROTOCOL_V4_NO_HOLDOUT_ADMISSION_CANDIDATE` — never a
   fallback pick — when none qualify); `validateProtocolV4HoldoutAdmissionRecord`/
   `validateProtocolV4HoldoutAdmissionRecordAgainstEvidence`/
   `validateProtocolV4HoldoutAdmissionExecutionPlan`/`assertProtocolV4HoldoutAdmissionAuthorized` (all
   fail closed if `g2Passed`/`productionAuthorized` are ever tampered to `true`, even in an internally
   rehashed record, and re-derive from real evidence rather than trusting self-consistency alone).
   Every record/plan/authorization carries literal `g2Passed: false`/`productionAuthorized: false`.
   The Admission Authorization's `kind` is always `'human_live'` (reusing the execution lease's
   already-pinned `authorizationKind` literal, so `ResolverV3048ProtocolV4ExecutionLease.ts` needed no
   change) with a non-optional `humanApprovalReference`. The resulting
   `ProtocolV4HoldoutAdmissionExecutionPlan`/`ProtocolV4HoldoutAdmissionAuthorization` are structurally
   compatible with `ResolverV3048ProtocolV4HoldoutRunner.ts`'s existing minimal input interfaces
   (`ProtocolV4HoldoutRunnerPlanInput`/`ProtocolV4HoldoutRunnerAuthorizationInput`, already designed to
   accept multiple producers) — proven by a compile-time-checked test assignment — so the Runner itself
   required zero code changes, only a documentation-comment update noting the third satisfier. This
   module explicitly does **not** decide G2 pass/fail or production readiness (that remains exclusively
   `deriveProtocolV4FinalG2Report`'s job once both partitions' evidence exist) and does not itself
   authorize or perform any live execution.

3. **Why it changed:** the task explicitly identified a conceptual contradiction — the canonical
   Selection Rule requires all mandatory G2 criteria already passed before an authoritative candidate
   selection, but the real evaluator honestly returns `not_evaluable` until both Development and
   Holdout evidence exist, so Development alone could not legally select a candidate for Holdout at
   all. The task asked for a separately-named, pre-frozen Holdout Admission Gate (no final production
   decision; zero critical false-confidence cases; complete contracts/telemetry; no hard
   Development-gate failures; a predeclared ranking rule; human review; selection of exactly one
   candidate; no claim that G2 has passed) to resolve this without weakening the final rule, plus
   independent review/CI confirmation of the prior Phase-A correction PR.
4. **Files changed:** new `src/features/nutrition/benchmark/protocolV4/ResolverV3048ProtocolV4HoldoutAdmission.ts`;
   new test `__tests__/ResolverV3048ProtocolV4HoldoutAdmission.test.ts` (24 tests: rule identity,
   admissibility screen, admission happy/negative paths, record tamper resistance, execution-plan
   derivation/tamper, authorization gate happy/negative paths, compile-time-checked Holdout Runner
   structural compatibility, error-class identity); doc-comment-only update to
   `ResolverV3048ProtocolV4HoldoutRunner.ts` (noting the new third structural satisfier — no behavior
   change); `ROADMAP.md` (PR #194 merge-review finding + Holdout Admission Gate section + updated
   status line); this handoff. No `supabase/migrations/**`, `supabase/functions/**`, `package.json`,
   `package-lock.json`, environment file, `src/infrastructure/di/container.ts`, UI/journal file,
   `.github/workflows/**`, V3-039 evidence/corpus/ground-truth/evaluator logic, or any other
   `protocolV4/` module's logic changed.
5. **Verification executed:** `npm install` (restoring missing `node_modules`; lockfile diff-checked
   empty afterward); `npm run typecheck` (repo-wide, clean); `npx eslint` on the new/changed files
   (clean) and repo-wide as part of `npm run verify` below; `npx prettier -c`/`-w` on `ROADMAP.md` and
   the new/changed source files; `npx jest --runInBand src/features/nutrition/benchmark/protocolV4`
   (6 suites / 141 tests, all passing — 117 pre-existing + 24 new); full `npm run verify` (typecheck +
   lint + format:check + complete Jest suite) run to completion in the background, exit code 0; `git
status`/manual diff review confirming only the files listed above changed.
6. **Verification result:** all of the above passed, including the full `npm run verify` end to end,
   run to completion in the background and confirmed exit code 0: **252 suites / 2695 tests passed
   repo-wide**, 1098.2 s, 0 type errors, 0 lint errors, 0 format violations. Provider calls 0; provider
   cost USD 0; no credential read (`ANTHROPIC_API_KEY` is never referenced by the new module or its
   tests, which build only in-memory fake `CandidateEvaluation`/`ProtocolV4DevelopmentEvidence`
   fixtures).
7. **Known issues/blockers/residual risks:** the Holdout Admission Gate is zero-network infrastructure
   only — it does not itself constitute new live evidence, does not unblock `RESOLVER-V3-010`, and does
   not change G2's `not passed` status. The 352-call / USD 5.586944 proposal-only budget remains
   numerically unchanged and explicitly **not authorized**; no `human_live` authorization was created
   or exercised; no live Development or Holdout execution occurred. The PR #194 premature-merge-before-
   CI-completion finding (item 2a) is recorded as a process gap, not fixed at the tooling level in this
   session — a future session/human should consider making the merge step wait for the check run's
   terminal state.
8. **Human review/next steps:** review the new `ResolverV3048ProtocolV4HoldoutAdmission.ts` module and
   its test file, in particular the tamper-resistance tests (record/plan/authorization all fail closed
   on a flipped `g2Passed`/`productionAuthorized`, even after rehashing) and the compile-time Holdout
   Runner structural-compatibility proof. Per the task's own ordering ("Realistische Reststrecke"), the
   remaining steps before any live benchmark are: independent human review of this change; explicit
   Development budget authorization (unauthorized here); the Development run and its evaluation; the
   (non-final) Holdout admission decision for a real run (this module provides the mechanism, not the
   decision); a separate Holdout budget authorization; a full G2 pass across all mandatory dimensions;
   only then RESOLVER-V3-010. This agent did not open a pull request (per repository convention, the
   user opens/merges PRs manually after review) and did not push without the user's prior authorization
   for this session's git workflow.

---
