# HOUSEKEEPING_2026-07-10 — Audit Report

## Scope

Housekeeping audit covering four areas requested by the maintainer after Tier 2 completion:
dead code from RESOLVER-V2-003, reports/documentation navigability, branch cleanup, and
dependency hygiene. This report documents findings and recommendations for the two areas
(branch cleanup, dependency upgrades) that require either environment capabilities this session
doesn't have, or explicit human approval per `AGENTS.md`/`VERIFY.md` policy — it does not itself
perform branch deletions or dependency upgrades.

## 1) Dead Code (fixed directly, see commit)

`ResolverDebugTypes.ts`'s `DecisionInfo['reason']` union still listed `'early_return_off'` and
`'early_return_off_blocked'`, both orphaned since RESOLVER-V2-003 removed OFF's confidence-based
early-return code path. Removed both values from the union; confirmed via repo-wide grep that no
other code referenced them.

## 2) Reports/Documentation Navigability (fixed directly, see commit)

Added `reports/README.md` (a new, purely additive index — no existing report files were
modified, moved, or deleted, consistent with the "completed tasks are never deleted" governance
principle) and a one-line "not part of the Tier 1–5 product roadmap" annotation under
`ROADMAP.md`'s standing "Phase C: OpenCode CLI Worker Integration" section, which otherwise reads
confusingly like it's the current plan.

## 3) Branch Cleanup — Recommendation Only

**Blocker:** `git push origin --delete <branch>` was rejected with HTTP 403 by this environment's
git proxy (re-confirmed in this session against a branch already known to be fully merged) — this
matches the incident already documented in `AGENTS.md`. There is no GitHub MCP tool for branch
deletion either. Per `AGENTS.md`, no ad-hoc workaround was attempted; this is reported for a human
(or a channel with the necessary repo-admin access) to act on instead.

**Merge status against `chore/clean-arch-structure`** (checked via
`git merge-base --is-ancestor <branch> chore/clean-arch-structure`):

| Branch                                         | Status         | Safe to delete?              |
| ---------------------------------------------- | -------------- | ---------------------------- |
| `claude/branch-cleanup-governance-rule`        | merged         | ✅ yes                       |
| `claude/continuation-esc10o`                   | merged         | ✅ yes                       |
| `claude/continuation-g7eyp1`                   | merged         | ✅ yes                       |
| `claude/git-sync-governance-rule`              | merged         | ✅ yes                       |
| `claude/p1-004c-portion-hint-test-wiring`      | merged         | ✅ yes                       |
| `claude/roadmap-composite-dish-entries-gd0kmg` | merged         | ✅ yes                       |
| `claude/tier-1-fertigstellen-cubftr`           | merged         | ✅ yes                       |
| `claude/cleanup-branches-skill-uyeqh5`         | **not merged** | ❌ no — has unmerged commits |
| `claude/continuation-keca9q`                   | **not merged** | ❌ no — has unmerged commits |
| `claude/expo-testing-docs-gsly5h`              | **not merged** | ❌ no — has unmerged commits |
| `claude/next-steps-f0pd81`                     | **not merged** | ❌ no — has unmerged commits |
| `claude/supabase-connector-check-bjj23q`       | **not merged** | ❌ no — has unmerged commits |

**Recommendation:** the 7 "merged" branches can be deleted directly via the GitHub UI
(Settings → Branches, or the branch list's trash-can icon) without losing any history — their
commits are preserved via the merge commits already in `chore/clean-arch-structure`. The 5
"not merged" branches should **not** be deleted without first reviewing what unmerged work they
contain; per `AGENTS.md`, deleting a branch whose PR was closed without merging requires explicit
human confirmation per branch, since its commits exist nowhere else.

## 4) Dependency Hygiene — Recommendation Only

`npm audit` currently reports **27 vulnerabilities**: 2 critical, 7 high, 17 moderate, 1 low.

**Low-risk, no major-version-bump needed** (plain `npm audit fix` reports `fixAvailable: true`,
not a semver-major bump, for all of these — this only needs a nod of approval per `AGENTS.md`'s
"npm audit fix requires explicit approval" rule, not a dependency-migration task):

- Critical: `handlebars`, `shell-quote`
- High: `@xmldom/xmldom`, `flatted`, `minimatch`, `picomatch`, `supabase` (the CLI dev dependency,
  not `@supabase/supabase-js`), `tar`, `ws`

All of the above are transitive dev-dependencies (build/CLI tooling), not runtime app code.

**Requires an explicit, separately-approved dependency-migration task** (semver-major bump):

- The remaining moderate vulnerabilities trace back to `@expo/*` sub-packages; `npm audit`'s only
  offered fix is bumping `expo` 54.0.35 → 57.0.4 (major).
- `eslint@8.57.1` is marked "no longer supported" upstream (current major is 10.x); upgrading
  means migrating `.eslintrc.cjs` to ESLint's flat-config format, not a drop-in bump.
- `npm outdated` additionally shows major-version gaps for `react-native` (0.81→0.86),
  `@react-native-async-storage/async-storage` (2.2.0→3.1.1), `typescript` (5.9→7.0), `jest`
  (29→30), and several Expo/React Navigation packages — none touched here.

**Recommendation:** run `npm audit fix` (non-forced) as its own small, explicitly-approved task to
clear the 9 critical/high transitive dev-dependency issues; scope the Expo/ESLint major upgrades
as a separate, dedicated dependency-migration task per `VERIFY.md` category 6, since those carry
real behavior-change risk (Expo SDK bump, ESLint config format change) and need their own
regression testing — not part of this housekeeping pass.
