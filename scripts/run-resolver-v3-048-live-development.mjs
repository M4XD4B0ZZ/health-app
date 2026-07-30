#!/usr/bin/env node
/**
 * RESOLVER-V3-048 Phase B3 -- Canonical Live Development Launcher.
 *
 * The single, canonical, reproducible, fail-closed CLI entry point for the already-merged
 * `runProtocolV4LiveDevelopmentEntryPoint` (Phase B1 + post-merge remediation). This launcher is
 * Launcher-architecture only: it never makes a real provider call, never reads a real credential
 * value, and never produces live evidence by itself -- every real side effect it can trigger is
 * delegated unchanged to the already-reviewed entry point, only after every guard below passes.
 *
 * Build contract: this launcher never uses `tsx`, `ts-node`, a globally installed tool, `npx`, or
 * any automatic package install. It compiles a small, explicit TypeScript bridge
 * (`scripts/resolver-v3-048-live-launcher/launcherBridge.ts`, re-exporting only the Protocol-v4
 * functions this launcher calls) via the LOCAL `node_modules/typescript/bin/tsc`, driven by the
 * dedicated `scripts/resolver-v3-048-live-launcher.tsconfig.json`, into the deterministic, gitignored
 * `build/resolver-v3-048-live-launcher/` output directory (covered by this repository's existing
 * `build/` `.gitignore` entry), then loads the compiled CommonJS output directly -- never a `.ts`
 * file at runtime. If `node_modules` or the local TypeScript compiler is missing, it stops with a
 * clear, secret-free error and never runs `npm install`/`npm ci` itself.
 *
 * Usage:
 *   node --env-file=.env scripts/run-resolver-v3-048-live-development.mjs --preflight
 *   node --env-file=.env scripts/run-resolver-v3-048-live-development.mjs --execute \
 *     --authorization-file "<ABSOLUTE_PATH>" \
 *     --confirm-development-only \
 *     --confirm-max-cost-usd "5.142528"
 *
 * `--preflight` is fully zero-call and never checks for `ANTHROPIC_API_KEY`; it re-derives and
 * validates the real Master Plan, prints its exact identities/budget, and can emit a
 * non-authorizing authorization *template* (`authorizationTemplateOnly: true`) to an explicitly
 * given external path (or stdout). `--execute` requires a human-authored authorization file
 * (canonically outside the repository -- symlink/junction- and Windows-case-safe --,
 * `authorizationTemplateOnly: false`, a non-empty `humanApprovalReference`, the current schema
 * version) that is validated field-by-field against a freshly rebuilt Master Plan -- commit,
 * plan/tree hash, model, pricing, currency, cache policy, candidate/prompt/schema/routing
 * identities (an exact set: no duplicate/missing/unknown candidate ID), every Development budget
 * number, concurrency, retry count, Holdout-not-authorized, and automatic-continuation-disabled --
 * strictly BEFORE `ANTHROPIC_API_KEY` presence is even checked, and strictly before any
 * lease/live-root/artifact side effect. Only after every check above passes does this launcher
 * build the canonical `human_live` Development Authorization Record (via the real
 * `buildProtocolV4DevelopmentAuthorization`) and call the real `runProtocolV4LiveDevelopmentEntryPoint`
 * -- on the production path with EXACTLY `{ authorization, env: process.env }`, no `repoRoot` key at
 * all (never even `repoRoot: undefined`). This launcher never imports or references any Holdout
 * function; Development is the only thing it can ever run, and it stops for good afterwards.
 *
 * No budget number is independently re-typed as an alternative truth anywhere in this file. A
 * failed run never fabricates zero usage: see `summarizeFailureUsage` below, which reads the
 * transport-authoritative `protocolV4FailureUsageSnapshot` the Protocol-v4 Development Runner
 * attaches to a `human_live` failure (never re-deriving pricing/usage-parsing logic in this file),
 * and reports `'unknown'` (never a fabricated `0`) for any failure whose phase cannot be proven.
 *
 * Secret-free error reporting: every thrown `LauncherError`'s `.message` is one of a fixed,
 * enumerated set of constant codes (see `KNOWN_LAUNCHER_ERROR_CODES`) -- any descriptive detail
 * (a resolved path, a foreign error's own message, compiler stdout/stderr, submitted argument
 * values) is passed as a SEPARATE `internalDetail` constructor argument that `classifyLauncherError`
 * never reads and that never reaches stdout/stderr/the closing summary.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

export const REAL_REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

const BUILD_OUT_DIR = path.join(REAL_REPO_ROOT, 'build', 'resolver-v3-048-live-launcher');
const LAUNCHER_TSCONFIG_PATH = path.join(
  REAL_REPO_ROOT,
  'scripts',
  'resolver-v3-048-live-launcher.tsconfig.json',
);
const COMPILED_BRIDGE_PATH = path.join(
  BUILD_OUT_DIR,
  'scripts',
  'resolver-v3-048-live-launcher',
  'launcherBridge.js',
);

/** The PR #204 merge commit -- the base this Phase B3 launcher itself was built from, and the
 * oldest commit any real authorization may be issued against. Any authorization issued for an older
 * code state (e.g. the historical PR #202 authorization, basis `e44cd5c`) fails the exact-HEAD-match
 * check below on its own (a stale `authorizedCommit` can never equal a current, later HEAD), and
 * additionally fails this explicit ancestry check as defense in depth. */
export const PROTOCOL_V4_PHASE_B1_POST_MERGE_REMEDIATION_COMMIT =
  'd7a2cd3efff1ce08519675fcb48b4c4c5c6769b2';

export const LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION =
  'resolver-v3-048-live-launcher-authorization-file-v1';

/** Every `LauncherError` thrown anywhere in this file uses ONE of these constant codes as its
 * `.message` -- nothing else. `classifyLauncherError` uses this set as the single source of truth
 * for what is safe to surface; any `LauncherError` whose message is not in this set (which should
 * never happen, by construction) is reported generically rather than trusted. */
export const KNOWN_LAUNCHER_ERROR_CODES = new Set([
  'LAUNCHER_GIT_SPAWN_FAILED',
  'LAUNCHER_GIT_STATUS_FAILED',
  'LAUNCHER_GIT_REV_PARSE_FAILED',
  'LAUNCHER_GIT_MERGE_BASE_FAILED',
  'LAUNCHER_CWD_MUST_BE_REPO_ROOT',
  'LAUNCHER_NODE_MODULES_MISSING',
  'LAUNCHER_LOCAL_TYPESCRIPT_MISSING',
  'LAUNCHER_BUILD_SPAWN_FAILED',
  'LAUNCHER_BUILD_FAILED',
  'LAUNCHER_BUILD_OUTPUT_MISSING',
  'LAUNCHER_PATH_MISSING',
  'LAUNCHER_PATH_NOT_ABSOLUTE',
  'LAUNCHER_PATH_INSIDE_REPO',
  'LAUNCHER_PATH_NOT_FOUND',
  'LAUNCHER_PATH_REALPATH_FAILED',
  'LAUNCHER_PATH_PARENT_NOT_FOUND',
  'LAUNCHER_TEMPLATE_OUTPUT_ALREADY_EXISTS',
  'LAUNCHER_AUTHORIZATION_FILE_INVALID_SHAPE',
  'LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION_MISMATCH',
  'LAUNCHER_AUTHORIZATION_FILE_IS_TEMPLATE_ONLY',
  'LAUNCHER_AUTHORIZATION_FILE_MISSING_HUMAN_APPROVAL_REFERENCE',
  'LAUNCHER_AUTHORIZATION_FILE_MISSING_AUTHORIZATION_ID',
  'LAUNCHER_HEAD_COMMIT_MISMATCH',
  'LAUNCHER_PR204_MERGE_NOT_ANCESTOR',
  'LAUNCHER_PLAN_HASH_MISMATCH',
  'LAUNCHER_EXECUTION_TREE_HASH_MISMATCH',
  'LAUNCHER_MODEL_ID_MISMATCH',
  'LAUNCHER_PRICING_VERSION_MISMATCH',
  'LAUNCHER_CURRENCY_MISMATCH',
  'LAUNCHER_NO_CACHE_POLICY_MISMATCH',
  'LAUNCHER_CANDIDATE_IDENTITY_MISMATCH',
  'LAUNCHER_BUDGET_MISMATCH_CALLS',
  'LAUNCHER_BUDGET_MISMATCH_INPUT_TOKENS',
  'LAUNCHER_BUDGET_MISMATCH_OUTPUT_TOKENS',
  'LAUNCHER_BUDGET_MISMATCH_TOTAL_TOKENS',
  'LAUNCHER_BUDGET_MISMATCH_COST',
  'LAUNCHER_MAX_CONCURRENCY_NOT_ONE',
  'LAUNCHER_RETRY_COUNT_NOT_ZERO',
  'LAUNCHER_AUTHORIZED_PHASE_INVALID',
  'LAUNCHER_HOLDOUT_MUST_NOT_BE_AUTHORIZED',
  'LAUNCHER_AUTOMATIC_CONTINUATION_MUST_BE_FALSE',
  'LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING',
  'LAUNCHER_CONFIRM_MAX_COST_MISMATCH',
  'LAUNCHER_EXECUTE_WRONG_MODE',
  'LAUNCHER_EXECUTE_MISSING_AUTHORIZATION_FILE',
  'LAUNCHER_EXECUTE_MISSING_CONFIRM_MAX_COST',
  'LAUNCHER_AUTHORIZATION_FILE_NOT_REGULAR_FILE',
  'LAUNCHER_AUTHORIZATION_FILE_INVALID_JSON',
  'LAUNCHER_PREFLIGHT_WORKING_TREE_DIRTY',
  'LAUNCHER_EXECUTE_WORKING_TREE_DIRTY',
  'LAUNCHER_ANTHROPIC_API_KEY_MISSING',
]);

export class LauncherError extends Error {
  /** `code` MUST be one of `KNOWN_LAUNCHER_ERROR_CODES` -- it is the ONLY thing ever surfaced to
   * stdout/stderr/the closing summary (via `classifyLauncherError`). `internalDetail` (a resolved
   * path, a foreign error's own message, compiler output, a submitted argument value, ...) is kept
   * as a plain, non-message property for a developer attaching a debugger only -- nothing in this
   * file ever reads or prints it. */
  constructor(code, internalDetail) {
    super(code);
    this.name = 'LauncherError';
    this.internalDetail = internalDetail;
  }
}

// ---------------------------------------------------------------------------------------------
// Git helpers -- always operate on the real repository, never on any isolated test `repoRoot`.
// ---------------------------------------------------------------------------------------------

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });
  if (result.error) {
    throw new LauncherError('LAUNCHER_GIT_SPAWN_FAILED', result.error.message);
  }
  return result;
}

export function isWorkingTreeClean(repoRoot) {
  const result = runGit(repoRoot, ['status', '--porcelain']);
  if (result.status !== 0) {
    throw new LauncherError('LAUNCHER_GIT_STATUS_FAILED', `exit ${result.status}`);
  }
  return result.stdout.trim().length === 0;
}

export function getCurrentCommit(repoRoot) {
  const result = runGit(repoRoot, ['rev-parse', 'HEAD']);
  if (result.status !== 0) {
    throw new LauncherError('LAUNCHER_GIT_REV_PARSE_FAILED');
  }
  return result.stdout.trim();
}

export function isAncestor(repoRoot, ancestorSha, descendantSha) {
  const result = runGit(repoRoot, ['merge-base', '--is-ancestor', ancestorSha, descendantSha]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new LauncherError('LAUNCHER_GIT_MERGE_BASE_FAILED', `exit ${result.status}`);
}

function assertCwdIsRepoRoot() {
  if (path.resolve(process.cwd()) !== path.resolve(REAL_REPO_ROOT)) {
    throw new LauncherError(
      'LAUNCHER_CWD_MUST_BE_REPO_ROOT',
      `expected ${REAL_REPO_ROOT}, got ${process.cwd()}`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Local-only TypeScript build -- no tsx/ts-node/global tool/npx, no automatic install.
// ---------------------------------------------------------------------------------------------

export function assertLocalToolchainAvailable(repoRoot) {
  const nodeModulesPath = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new LauncherError('LAUNCHER_NODE_MODULES_MISSING');
  }
  const tscBinPath = path.join(nodeModulesPath, 'typescript', 'bin', 'tsc');
  if (!fs.existsSync(tscBinPath)) {
    throw new LauncherError('LAUNCHER_LOCAL_TYPESCRIPT_MISSING');
  }
  return tscBinPath;
}

/** Always compiles from `REAL_REPO_ROOT` (the only place `node_modules`/the source tree live) --
 * fully independent of any isolated `repoRootForTests` used later to redirect where the compiled
 * Protocol-v4 functions read/write plan/evidence files. Always a full, from-scratch recompile: the
 * output directory is removed first, so a stale prior build can never be silently reused. */
export function runLauncherBuild(repoRoot = REAL_REPO_ROOT) {
  const tscBinPath = assertLocalToolchainAvailable(repoRoot);
  fs.rmSync(BUILD_OUT_DIR, { recursive: true, force: true });
  const result = spawnSync(process.execPath, [tscBinPath, '--project', LAUNCHER_TSCONFIG_PATH], {
    cwd: repoRoot,
    encoding: 'utf-8',
  });
  if (result.error) {
    throw new LauncherError('LAUNCHER_BUILD_SPAWN_FAILED', result.error.message);
  }
  if (result.status !== 0) {
    // Compiler stdout/stderr is real, potentially large source-derived output -- never surfaced,
    // kept only as `internalDetail` for a developer attaching a debugger.
    throw new LauncherError(
      'LAUNCHER_BUILD_FAILED',
      `${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
  if (!fs.existsSync(COMPILED_BRIDGE_PATH)) {
    throw new LauncherError('LAUNCHER_BUILD_OUTPUT_MISSING', COMPILED_BRIDGE_PATH);
  }
  return COMPILED_BRIDGE_PATH;
}

/** Loads the freshly compiled bridge module. Uses `createRequire` (not a `file://` dynamic
 * `import()`) so Windows absolute paths never need URL conversion. Busts the CJS require cache for
 * the compiled path first -- the output path is deterministic/fixed, so a fresh compile of the same
 * path would otherwise silently return a stale cached module object within one long-lived process
 * (e.g. a test suite calling this repeatedly). */
export function loadCompiledBridge(repoRoot = REAL_REPO_ROOT) {
  const bridgePath = runLauncherBuild(repoRoot);
  const req = createRequire(import.meta.url);
  const resolved = req.resolve(bridgePath);
  delete req.cache[resolved];
  return req(bridgePath);
}

// ---------------------------------------------------------------------------------------------
// Path safety -- the authorization file (and any explicit template-output path) must live
// canonically outside the repository: symlink/junction-aware (resolved via `fs.realpathSync`, so a
// link whose real target lands inside the repository is rejected exactly like a direct in-repo
// path) and case-correct on Windows (NTFS path comparison is case-insensitive; POSIX stays
// case-sensitive).
// ---------------------------------------------------------------------------------------------

function canonicalizeForComparison(p) {
  return process.platform === 'win32' ? p.toLowerCase() : p;
}

function realpathOrNull(p) {
  try {
    return fs.realpathSync(p);
  } catch {
    return null;
  }
}

function assertResolvedOutsideRepoRoot(repoRootReal, candidateReal, label) {
  const a = canonicalizeForComparison(candidateReal);
  const b = canonicalizeForComparison(repoRootReal);
  const withSep = canonicalizeForComparison(repoRootReal + path.sep);
  if (a === b || a.startsWith(withSep)) {
    throw new LauncherError('LAUNCHER_PATH_INSIDE_REPO', `${label}: ${candidateReal}`);
  }
}

/** Fast, purely lexical pre-check: absolute and not textually inside the repo. Always followed by
 * `assertExistingPathCanonicallyOutsideRepoRoot`/`assertNewFileParentCanonicallyOutsideRepoRoot`
 * (below) for the filesystem-canonical, symlink/junction-aware, Windows-case-correct proof --
 * exported separately because it also validates basic shape (non-empty, absolute) before any
 * filesystem call. */
export function assertAbsoluteAndOutsideRepoRoot(repoRoot, candidatePath, label) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0) {
    throw new LauncherError('LAUNCHER_PATH_MISSING', label);
  }
  if (!path.isAbsolute(candidatePath)) {
    throw new LauncherError('LAUNCHER_PATH_NOT_ABSOLUTE', `${label}: ${candidatePath}`);
  }
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  assertResolvedOutsideRepoRoot(resolvedRepoRoot, resolvedCandidate, label);
  return resolvedCandidate;
}

/** For a path that must already exist (the authorization file): resolves both the candidate and the
 * repo root through `fs.realpathSync` (following any symlink/junction to its real target) and
 * re-checks outside-repo-ness against the REAL paths, case-normalized on Windows -- a symlink that
 * is lexically outside the repo but whose real target lands inside it is rejected here even though
 * the lexical pre-check above would have let it through. */
export function assertExistingPathCanonicallyOutsideRepoRoot(repoRoot, candidatePath, label) {
  const resolvedCandidate = assertAbsoluteAndOutsideRepoRoot(repoRoot, candidatePath, label);
  if (!fs.existsSync(resolvedCandidate)) {
    throw new LauncherError('LAUNCHER_PATH_NOT_FOUND', `${label}: ${resolvedCandidate}`);
  }
  const realCandidate = realpathOrNull(resolvedCandidate);
  const realRepoRoot = realpathOrNull(repoRoot);
  if (!realCandidate || !realRepoRoot) {
    throw new LauncherError('LAUNCHER_PATH_REALPATH_FAILED', label);
  }
  assertResolvedOutsideRepoRoot(realRepoRoot, realCandidate, label);
  return realCandidate;
}

/** For a NEW file that does not exist yet (the `--preflight` authorization-template output): a
 * nonexistent path cannot itself be `realpathSync`-resolved, so this resolves the PARENT directory
 * (which must already exist) through `fs.realpathSync` instead -- rejecting a parent that is itself
 * a symlink/junction whose real target lands inside the repository -- then reconstructs the final
 * write path from the REAL parent plus the original basename, so a symlinked parent's real target
 * directory is what is actually written into (never the symlink's lexical location). */
export function assertNewFileParentCanonicallyOutsideRepoRoot(repoRoot, candidatePath, label) {
  const resolvedCandidate = assertAbsoluteAndOutsideRepoRoot(repoRoot, candidatePath, label);
  const parentDir = path.dirname(resolvedCandidate);
  if (!fs.existsSync(parentDir)) {
    throw new LauncherError('LAUNCHER_PATH_PARENT_NOT_FOUND', `${label}: ${parentDir}`);
  }
  const realParent = realpathOrNull(parentDir);
  const realRepoRoot = realpathOrNull(repoRoot);
  if (!realParent || !realRepoRoot) {
    throw new LauncherError('LAUNCHER_PATH_REALPATH_FAILED', label);
  }
  assertResolvedOutsideRepoRoot(realRepoRoot, realParent, label);
  return path.join(realParent, path.basename(resolvedCandidate));
}

/** Writes `content` to `finalPath` exclusively -- refuses to silently overwrite an existing file
 * (atomic `wx` open flag; the existence check is the flag itself, not a separate racy `existsSync`
 * probe). */
export function writeFileExclusive(finalPath, content) {
  try {
    fs.writeFileSync(finalPath, content, { encoding: 'utf-8', flag: 'wx' });
  } catch (e) {
    if (e && e.code === 'EEXIST') {
      throw new LauncherError('LAUNCHER_TEMPLATE_OUTPUT_ALREADY_EXISTS', finalPath);
    }
    throw e;
  }
}

// ---------------------------------------------------------------------------------------------
// CLI argument parsing.
// ---------------------------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  '--authorization-file',
  '--confirm-max-cost-usd',
  '--authorization-template-out',
]);

export function parseArgs(argv) {
  const result = {
    mode: null,
    help: false,
    authorizationFile: null,
    confirmMaxCostUsd: null,
    confirmDevelopmentOnly: false,
    authorizationTemplateOut: null,
    errors: [],
  };
  const modesSeen = [];
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === '--help' || token === '-h') {
      result.help = true;
      continue;
    }
    if (token === '--preflight') {
      modesSeen.push('preflight');
      continue;
    }
    if (token === '--execute') {
      modesSeen.push('execute');
      continue;
    }
    if (token === '--confirm-development-only') {
      result.confirmDevelopmentOnly = true;
      continue;
    }
    if (VALUE_FLAGS.has(token)) {
      const value = argv[i + 1];
      if (value === undefined) {
        result.errors.push(`Flag ${token} requires a value.`);
        continue;
      }
      i += 1;
      if (token === '--authorization-file') result.authorizationFile = value;
      else if (token === '--confirm-max-cost-usd') result.confirmMaxCostUsd = value;
      else if (token === '--authorization-template-out') result.authorizationTemplateOut = value;
      continue;
    }
    result.errors.push(`Unknown argument: ${token}`);
  }
  if (modesSeen.length === 0) {
    result.errors.push('Exactly one of --preflight or --execute is required (none given).');
  } else if (modesSeen.length > 1) {
    result.errors.push('Exactly one of --preflight or --execute is required (multiple given).');
  } else {
    result.mode = modesSeen[0];
  }
  return result;
}

// ---------------------------------------------------------------------------------------------
// Plan reporting / authorization template.
// ---------------------------------------------------------------------------------------------

export function candidateIdentitiesFromPlan(plan) {
  return plan.candidates.map((c) => ({
    id: c.id,
    version: c.version,
    promptVersion: c.promptVersion,
    promptHash: c.promptHash,
    schemaVersion: c.schemaVersion,
    schemaHash: c.schemaHash,
    routingVersion: c.routingVersion,
  }));
}

export function buildPreflightReport(plan, commit, bridge) {
  const candidates = candidateIdentitiesFromPlan(plan);
  return {
    commitSha: commit,
    masterPlanHash: plan.planHash,
    developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    modelId: plan.modelId,
    pricingVersion: plan.pricing.pricingVersion,
    candidates,
    developmentCalls: plan.budget.developmentCalls,
    perCallMaxInputTokens: bridge.PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    perCallMaxOutputTokens: bridge.PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    developmentMaxInputTokens:
      plan.budget.developmentCalls * bridge.PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS,
    developmentMaxOutputTokens:
      plan.budget.developmentCalls * bridge.PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS,
    developmentMaxTotalTokens: plan.budget.developmentMaxTokens,
    developmentMaxCostUsd: plan.budget.developmentMaxCostUsd,
    currency: plan.budget.currency,
    maxConcurrentRequests: plan.budget.maxConcurrentRequests,
    retryCount: plan.retryCount,
    noCachePolicy: plan.noCachePolicy,
  };
}

export function buildAuthorizationTemplate(plan, commit, report) {
  return {
    launcherAuthorizationFileSchemaVersion: LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION,
    authorizationTemplateOnly: true,
    generatedAtIso: new Date().toISOString(),
    authorizedCommit: commit,
    masterPlanHash: plan.planHash,
    developmentExecutionTreeHash: plan.developmentExecutionTreeHash,
    modelId: plan.modelId,
    pricingVersion: plan.pricing.pricingVersion,
    candidateIdentities: report.candidates,
    developmentCalls: plan.budget.developmentCalls,
    developmentMaxInputTokens: report.developmentMaxInputTokens,
    developmentMaxOutputTokens: report.developmentMaxOutputTokens,
    developmentMaxTotalTokens: plan.budget.developmentMaxTokens,
    developmentMaxCostUsd: plan.budget.developmentMaxCostUsd,
    currency: plan.budget.currency,
    noCachePolicy: plan.noCachePolicy,
    maxConcurrentRequests: plan.budget.maxConcurrentRequests,
    retryCount: plan.retryCount,
    authorizedPhase: 'development',
    holdoutAuthorized: false,
    automaticContinuation: false,
    authorizationId: `protocol-v4-live-development-${commit.slice(0, 12)}-${randomUUID()}`,
    humanApprovalReference: '',
  };
}

/** The plan's own development-cost ceiling, rendered as JavaScript's canonical shortest
 * round-trip decimal string (`String(number)`) -- the single source of truth `--confirm-max-cost-usd`
 * must match byte-for-byte. Never introduces an alternative/hardcoded budget number. */
export function canonicalDevelopmentMaxCostUsdString(plan) {
  return String(plan.budget.developmentMaxCostUsd);
}

// ---------------------------------------------------------------------------------------------
// Authorization-file validation -- every check below must pass, in this order, strictly before
// `ANTHROPIC_API_KEY` presence is even checked and strictly before any lease/live-root/artifact
// side effect.
// ---------------------------------------------------------------------------------------------

function assertCheck(condition, code, internalDetail) {
  if (!condition) {
    throw new LauncherError(code, internalDetail);
  }
}

export function validateAuthorizationFileStructure(authFile) {
  assertCheck(
    authFile !== null && typeof authFile === 'object' && !Array.isArray(authFile),
    'LAUNCHER_AUTHORIZATION_FILE_INVALID_SHAPE',
  );
  assertCheck(
    authFile.launcherAuthorizationFileSchemaVersion === LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION,
    'LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION_MISMATCH',
    authFile.launcherAuthorizationFileSchemaVersion,
  );
  assertCheck(
    authFile.authorizationTemplateOnly === false,
    'LAUNCHER_AUTHORIZATION_FILE_IS_TEMPLATE_ONLY',
  );
  assertCheck(
    typeof authFile.humanApprovalReference === 'string' &&
      authFile.humanApprovalReference.length > 0,
    'LAUNCHER_AUTHORIZATION_FILE_MISSING_HUMAN_APPROVAL_REFERENCE',
  );
  assertCheck(
    typeof authFile.authorizationId === 'string' && authFile.authorizationId.length > 0,
    'LAUNCHER_AUTHORIZATION_FILE_MISSING_AUTHORIZATION_ID',
  );
}

export function validateAuthorizationAgainstRepositoryState(
  authFile,
  { headCommit, pr204IsAncestor },
) {
  assertCheck(
    authFile.authorizedCommit === headCommit,
    'LAUNCHER_HEAD_COMMIT_MISMATCH',
    `authorizedCommit=${authFile.authorizedCommit} headCommit=${headCommit}`,
  );
  assertCheck(pr204IsAncestor, 'LAUNCHER_PR204_MERGE_NOT_ANCESTOR');
}

const CANDIDATE_IDENTITY_FIELDS = [
  'version',
  'promptVersion',
  'promptHash',
  'schemaVersion',
  'schemaHash',
  'routingVersion',
];

/** Exact set-and-identity comparison: same count, every candidate ID appearing exactly once, no
 * unknown ID, no missing ID, and every version/prompt/schema/routing field identical -- order-
 * independent (candidates are matched by ID, never by array position). */
export function candidateIdentitiesMatch(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const actualIds = actual.map((c) => (c && typeof c === 'object' ? c.id : undefined));
  if (new Set(actualIds).size !== actualIds.length) return false; // rejects any duplicate ID
  const expectedIdSet = new Set(expected.map((c) => c.id));
  if (actualIds.some((id) => !expectedIdSet.has(id))) return false; // rejects any unknown ID
  if (new Set(actualIds).size !== expectedIdSet.size) return false; // rejects a missing ID
  const byId = new Map(expected.map((c) => [c.id, c]));
  for (const candidate of actual) {
    const target = byId.get(candidate.id);
    for (const key of CANDIDATE_IDENTITY_FIELDS) {
      if (candidate[key] !== target[key]) return false;
    }
  }
  return true;
}

export function validateAuthorizationAgainstPlan(authFile, plan, report) {
  assertCheck(authFile.masterPlanHash === plan.planHash, 'LAUNCHER_PLAN_HASH_MISMATCH');
  assertCheck(
    authFile.developmentExecutionTreeHash === plan.developmentExecutionTreeHash,
    'LAUNCHER_EXECUTION_TREE_HASH_MISMATCH',
  );
  assertCheck(authFile.modelId === plan.modelId, 'LAUNCHER_MODEL_ID_MISMATCH');
  assertCheck(
    authFile.pricingVersion === plan.pricing.pricingVersion,
    'LAUNCHER_PRICING_VERSION_MISMATCH',
  );
  assertCheck(authFile.currency === plan.budget.currency, 'LAUNCHER_CURRENCY_MISMATCH');
  assertCheck(
    authFile.noCachePolicy !== null &&
      typeof authFile.noCachePolicy === 'object' &&
      authFile.noCachePolicy.promptCachingConfigured ===
        plan.noCachePolicy.promptCachingConfigured &&
      authFile.noCachePolicy.positiveCacheTokensFailure ===
        plan.noCachePolicy.positiveCacheTokensFailure,
    'LAUNCHER_NO_CACHE_POLICY_MISMATCH',
  );
  assertCheck(
    candidateIdentitiesMatch(authFile.candidateIdentities, report.candidates),
    'LAUNCHER_CANDIDATE_IDENTITY_MISMATCH',
  );
  assertCheck(
    authFile.developmentCalls === plan.budget.developmentCalls,
    'LAUNCHER_BUDGET_MISMATCH_CALLS',
  );
  assertCheck(
    authFile.developmentMaxInputTokens === report.developmentMaxInputTokens,
    'LAUNCHER_BUDGET_MISMATCH_INPUT_TOKENS',
  );
  assertCheck(
    authFile.developmentMaxOutputTokens === report.developmentMaxOutputTokens,
    'LAUNCHER_BUDGET_MISMATCH_OUTPUT_TOKENS',
  );
  assertCheck(
    authFile.developmentMaxTotalTokens === plan.budget.developmentMaxTokens,
    'LAUNCHER_BUDGET_MISMATCH_TOTAL_TOKENS',
  );
  assertCheck(
    authFile.developmentMaxCostUsd === plan.budget.developmentMaxCostUsd,
    'LAUNCHER_BUDGET_MISMATCH_COST',
  );
  assertCheck(
    plan.budget.maxConcurrentRequests === 1 &&
      authFile.maxConcurrentRequests === plan.budget.maxConcurrentRequests,
    'LAUNCHER_MAX_CONCURRENCY_NOT_ONE',
  );
  assertCheck(
    plan.retryCount === 0 && authFile.retryCount === plan.retryCount,
    'LAUNCHER_RETRY_COUNT_NOT_ZERO',
  );
  assertCheck(authFile.authorizedPhase === 'development', 'LAUNCHER_AUTHORIZED_PHASE_INVALID');
  assertCheck(authFile.holdoutAuthorized === false, 'LAUNCHER_HOLDOUT_MUST_NOT_BE_AUTHORIZED');
  assertCheck(
    authFile.automaticContinuation === false,
    'LAUNCHER_AUTOMATIC_CONTINUATION_MUST_BE_FALSE',
  );
}

/** `--confirm-max-cost-usd` must equal the plan's own canonical decimal string BYTE FOR BYTE --
 * scientific notation, surrounding whitespace, a leading `+`, extra trailing zeros, or any other
 * numerically-equivalent-but-differently-written value is refused. No alternative budget truth is
 * ever introduced: the canonical string is derived only from `plan.budget.developmentMaxCostUsd`. */
export function validateConfirmationFlags(parsedArgs, plan) {
  assertCheck(
    parsedArgs.confirmDevelopmentOnly === true,
    'LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING',
  );
  const canonical = canonicalDevelopmentMaxCostUsdString(plan);
  assertCheck(
    typeof parsedArgs.confirmMaxCostUsd === 'string' && parsedArgs.confirmMaxCostUsd === canonical,
    'LAUNCHER_CONFIRM_MAX_COST_MISMATCH',
    `submitted=${parsedArgs.confirmMaxCostUsd} canonical=${canonical}`,
  );
}

// ---------------------------------------------------------------------------------------------
// Usage accounting -- success and failure. Neither path ever fabricates a number: `providerHttp-
// Requests` is always transport-authoritative (from the real, measured per-call counts on
// success; from the Protocol-v4 Development Runner's `protocolV4FailureUsageSnapshot` on
// failure), and `aiDispatchReservations` (the shared budget gate's reservation count) is always a
// clearly SEPARATE dimension -- never relabeled as a provider-call count.
// ---------------------------------------------------------------------------------------------

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting"): a
 * structurally successful Development run is NOT automatically billing-exact. Sums the real,
 * measured `counts.providerHttpRequests` from every ledger entry (exact, regardless of usage
 * outcome) separately from confirmed tokens/cost (summed only from entries with
 * `usageStatus === 'reported'` and a computed `actualCostUsd`) -- if any HTTP request lacks full
 * usage/cost information, the overall accounting is `'partial'` and that entry's own
 * `reservedWorstCaseCostUsd` (already computed by the real reservation, never re-derived here)
 * contributes to a safe upper bound instead of being silently treated as USD 0.00. */
export function summarizeSuccessUsage(evidence) {
  let providerHttpRequests = 0;
  let confirmedInputTokens = 0;
  let confirmedOutputTokens = 0;
  let confirmedCostUsd = 0;
  let reservedCostUsdUpperBound = 0;
  let hasIncompleteUsage = false;
  for (const candidate of evidence.candidates) {
    for (const entry of candidate.ledger.content) {
      const httpCount = entry.counts?.providerHttpRequests?.value ?? 0;
      providerHttpRequests += httpCount;
      if (httpCount === 0) continue;
      if (entry.usageStatus === 'reported' && typeof entry.actualCostUsd === 'number') {
        confirmedInputTokens += entry.inputTokens ?? 0;
        confirmedOutputTokens += entry.outputTokens ?? 0;
        confirmedCostUsd += entry.actualCostUsd;
      } else {
        hasIncompleteUsage = true;
        reservedCostUsdUpperBound += entry.reservedWorstCaseCostUsd ?? 0;
      }
    }
  }
  return {
    accounting: hasIncompleteUsage ? 'partial' : 'exact',
    providerHttpRequests,
    aiDispatchReservations: null,
    confirmedInputTokens,
    confirmedOutputTokens,
    confirmedTotalTokens: confirmedInputTokens + confirmedOutputTokens,
    confirmedCostUsd,
    reservedInputTokensUpperBound: null,
    reservedOutputTokensUpperBound: null,
    reservedCostUsdUpperBound: hasIncompleteUsage ? reservedCostUsdUpperBound : null,
    completedCandidateIds: evidence.candidates.map((c) => c.candidateId),
    leaseFinalization: null,
  };
}

/** Every Protocol-v4 domain error class this launcher can ever see BEFORE the Development Runner's
 * dispatch loop is entered (plan/authorization validation, credential check, storage/authorization
 * preflight, lease claim -- all inside `runProtocolV4LiveDevelopmentEntryPoint`, strictly before
 * `runProtocolV4DevelopmentForAllCandidates` is called). Verified by source inspection, not
 * assumed: none of these classes are ever thrown from inside the Runner's own dispatch loop. Only
 * these classes -- plus this launcher's own `LauncherError` for its pre-dispatch guards -- justify
 * reporting `providerHttpRequests: 0` in the absence of a snapshot; anything else is `'unknown'`. */
const KNOWN_PRE_DISPATCH_ERROR_CLASSES = new Set([
  'LauncherError',
  'ProtocolV4LiveDevelopmentEntryPointError',
  'ProtocolV4LiveExecutionContextError',
  'ProtocolV4DevelopmentAuthorizationError',
  'ProtocolV4ExecutionLeaseError',
  'ProtocolV4ArtifactStoreError',
  'ProtocolV4ArtifactCrashError',
]);

const UNKNOWN_USAGE = Object.freeze({
  providerHttpRequests: null,
  aiDispatchReservations: null,
  confirmedInputTokens: null,
  confirmedOutputTokens: null,
  confirmedTotalTokens: null,
  confirmedCostUsd: null,
  reservedInputTokensUpperBound: null,
  reservedOutputTokensUpperBound: null,
  reservedCostUsdUpperBound: null,
  completedCandidateIds: [],
});

const EXACT_ZERO_USAGE = Object.freeze({
  providerHttpRequests: 0,
  aiDispatchReservations: 0,
  confirmedInputTokens: 0,
  confirmedOutputTokens: 0,
  confirmedTotalTokens: 0,
  confirmedCostUsd: 0,
  reservedInputTokensUpperBound: null,
  reservedOutputTokensUpperBound: null,
  reservedCostUsdUpperBound: null,
  completedCandidateIds: [],
});

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting"): reads
 * ONLY the Protocol-v4 Development Runner's own `protocolV4FailureUsageSnapshot` when present
 * (attached for every `human_live` failure once the Runner's dispatch loop was ever entered) --
 * never re-derives pricing/usage-parsing logic. When no snapshot is present, this does NOT default
 * to "exact zero": only a recognized pre-dispatch error class (see
 * `KNOWN_PRE_DISPATCH_ERROR_CLASSES`, each verified to be structurally unreachable once dispatch
 * could have started) justifies reporting exact zero; any other error is reported as `'unknown'`
 * usage -- `null` fields, never fabricated `0`s. */
export function summarizeFailureUsage(error) {
  const isObject = error !== null && typeof error === 'object';
  const snapshot = isObject ? error.protocolV4FailureUsageSnapshot : undefined;
  const leaseFinalization =
    isObject && typeof error.protocolV4LeaseFinalizationStatus === 'string'
      ? error.protocolV4LeaseFinalizationStatus
      : null;

  if (snapshot) {
    const isExactZero = snapshot.providerHttpRequests === 0;
    return {
      accounting: isExactZero ? 'exact' : 'partial',
      providerHttpRequests: snapshot.providerHttpRequests,
      aiDispatchReservations: snapshot.aiDispatchReservations,
      confirmedInputTokens: snapshot.confirmedInputTokens,
      confirmedOutputTokens: snapshot.confirmedOutputTokens,
      confirmedTotalTokens: snapshot.confirmedInputTokens + snapshot.confirmedOutputTokens,
      confirmedCostUsd: snapshot.confirmedCostUsd,
      reservedInputTokensUpperBound: isExactZero ? null : snapshot.reservedInputTokensUpperBound,
      reservedOutputTokensUpperBound: isExactZero ? null : snapshot.reservedOutputTokensUpperBound,
      reservedCostUsdUpperBound: isExactZero ? null : snapshot.reservedCostUsdUpperBound,
      completedCandidateIds: snapshot.completedCandidateIds,
      leaseFinalization,
    };
  }

  const name = isObject && typeof error.name === 'string' ? error.name : undefined;
  if (name && KNOWN_PRE_DISPATCH_ERROR_CLASSES.has(name)) {
    return { accounting: 'exact', ...EXACT_ZERO_USAGE, leaseFinalization };
  }
  return { accounting: 'unknown', ...UNKNOWN_USAGE, leaseFinalization };
}

// ---------------------------------------------------------------------------------------------
// Secret-free error reporting -- a real, stable CODE redaction, never a blanket class-based trust
// decision. Every `LauncherError` is checked against the exact, enumerated `KNOWN_LAUNCHER_ERROR_
// CODES` set (its `internalDetail` -- which may embed a resolved path, a foreign error's message,
// or compiler output -- is NEVER read here). Protocol-v4 domain-error messages are truncated at
// the first non-code character as an extra safety margin, even though they are already verified by
// source inspection to be fixed constant-code strings (some interpolate a safe, self-generated
// identifier after a colon, e.g. an artifact relative path or authorizationId -- never a secret,
// but never trusted wholesale either). Anything else is reported by stable class/code ONLY.
// ---------------------------------------------------------------------------------------------

const KNOWN_SAFE_PROTOCOL_ERROR_CLASSES = new Set([
  'ProtocolV4LiveDevelopmentEntryPointError',
  'ProtocolV4ExecutionLeaseError',
  'ProtocolV4DevelopmentRunnerError',
  'ProtocolV4DevelopmentAuthorizationError',
  'ProtocolV4ArtifactStoreError',
  'ProtocolV4ArtifactCrashError',
  'ProtocolV4LiveExecutionContextError',
  'ProtocolV4AttemptWrapperError',
  'ProtocolV4AttemptContextError',
  'ProtocolV4CallStateMachineError',
  'ProtocolV4EvaluationDerivationError',
  'ProtocolV4EvaluatorManifestError',
  'ProtocolV4PricingAuthorityError',
  'ProtocolV4ReservationError',
  'ProtocolV4TelemetryLedgerError',
]);

const CODE_PREFIX_PATTERN = /^[A-Z][A-Z0-9_]*/;

/** Never returns raw provider payloads, headers, proxy values, request/response content, paths,
 * JSON excerpts, or compiler output. `LauncherError` codes are matched EXACTLY against
 * `KNOWN_LAUNCHER_ERROR_CODES`; anything not on that list is reported as a generic, still-safe
 * fallback code rather than trusted. */
export function classifyLauncherError(error) {
  const isObject = error !== null && typeof error === 'object';
  const name = isObject && typeof error.name === 'string' ? error.name : 'UnknownError';
  const message = isObject && typeof error.message === 'string' ? error.message : undefined;

  if (name === 'LauncherError' && message !== undefined) {
    return {
      class: 'LauncherError',
      code: KNOWN_LAUNCHER_ERROR_CODES.has(message) ? message : 'LAUNCHER_UNRECOGNIZED_CODE',
    };
  }
  if (KNOWN_SAFE_PROTOCOL_ERROR_CLASSES.has(name) && message !== undefined) {
    const prefixMatch = CODE_PREFIX_PATTERN.exec(message);
    return { class: name, code: prefixMatch ? prefixMatch[0] : 'UNSTRUCTURED_ERROR' };
  }
  return { class: 'unknown', code: name };
}

// ---------------------------------------------------------------------------------------------
// --preflight
// ---------------------------------------------------------------------------------------------

export async function runPreflight({ repoRootForTests, authorizationTemplateOut } = {}) {
  if (!repoRootForTests) assertCwdIsRepoRoot();
  if (!isWorkingTreeClean(REAL_REPO_ROOT)) {
    throw new LauncherError('LAUNCHER_PREFLIGHT_WORKING_TREE_DIRTY');
  }
  const bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const plan = bridge.buildProtocolV4MasterPlan(repoRootForTests);
  bridge.validateProtocolV4MasterPlan(plan, repoRootForTests);
  const commit = getCurrentCommit(REAL_REPO_ROOT);
  const report = buildPreflightReport(plan, commit, bridge);
  const template = buildAuthorizationTemplate(plan, commit, report);

  let authorizationTemplateWrittenTo = null;
  if (authorizationTemplateOut) {
    const finalPath = assertNewFileParentCanonicallyOutsideRepoRoot(
      REAL_REPO_ROOT,
      authorizationTemplateOut,
      '--authorization-template-out',
    );
    writeFileExclusive(finalPath, `${JSON.stringify(template, null, 2)}\n`);
    authorizationTemplateWrittenTo = finalPath;
  }

  return {
    preflightReport: report,
    authorizationTemplate: template,
    authorizationTemplateWrittenTo,
  };
}

// ---------------------------------------------------------------------------------------------
// --execute
// ---------------------------------------------------------------------------------------------

export async function runExecute(parsedArgs, { repoRootForTests, envForTests } = {}) {
  if (parsedArgs.mode !== 'execute') {
    throw new LauncherError('LAUNCHER_EXECUTE_WRONG_MODE');
  }
  if (!parsedArgs.authorizationFile) {
    throw new LauncherError('LAUNCHER_EXECUTE_MISSING_AUTHORIZATION_FILE');
  }
  if (!parsedArgs.confirmDevelopmentOnly) {
    throw new LauncherError('LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING');
  }
  if (!parsedArgs.confirmMaxCostUsd) {
    throw new LauncherError('LAUNCHER_EXECUTE_MISSING_CONFIRM_MAX_COST');
  }

  // 1. Authorization file path: absolute, a regular file, and canonically (symlink/junction- and
  // Windows-case-safe) outside the repository.
  const resolvedAuthPath = assertExistingPathCanonicallyOutsideRepoRoot(
    REAL_REPO_ROOT,
    parsedArgs.authorizationFile,
    '--authorization-file',
  );
  if (!fs.statSync(resolvedAuthPath).isFile()) {
    throw new LauncherError('LAUNCHER_AUTHORIZATION_FILE_NOT_REGULAR_FILE', resolvedAuthPath);
  }

  // 2. Parse + structural validation (schema version, template flag, human approval reference).
  // The raw file content and any JSON.parse error detail are NEVER embedded in the thrown code.
  let authFile;
  try {
    authFile = JSON.parse(fs.readFileSync(resolvedAuthPath, 'utf-8'));
  } catch (e) {
    throw new LauncherError('LAUNCHER_AUTHORIZATION_FILE_INVALID_JSON', e.message);
  }
  validateAuthorizationFileStructure(authFile);

  // 3. Working tree clean (the real repository, always).
  if (!isWorkingTreeClean(REAL_REPO_ROOT)) {
    throw new LauncherError('LAUNCHER_EXECUTE_WORKING_TREE_DIRTY');
  }

  // 4. HEAD identity + PR #204 ancestry.
  const headCommit = getCurrentCommit(REAL_REPO_ROOT);
  const pr204IsAncestor = isAncestor(
    REAL_REPO_ROOT,
    PROTOCOL_V4_PHASE_B1_POST_MERGE_REMEDIATION_COMMIT,
    headCommit,
  );
  validateAuthorizationAgainstRepositoryState(authFile, { headCommit, pr204IsAncestor });

  // 5. Production-path CWD sanity (skipped only under an explicit test override).
  if (!repoRootForTests) assertCwdIsRepoRoot();

  // 6. Local build + real, freshly (re)derived Master Plan.
  const bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const plan = bridge.buildProtocolV4MasterPlan(repoRootForTests);
  bridge.validateProtocolV4MasterPlan(plan, repoRootForTests);
  const report = buildPreflightReport(plan, headCommit, bridge);

  // 7. Authorization file vs. the freshly validated plan -- the plan is the sole authority.
  validateAuthorizationAgainstPlan(authFile, plan, report);

  // 8. Confirmation flags (canonical cost string).
  validateConfirmationFlags(parsedArgs, plan);

  // 9. Credential presence -- only now, after every check above has passed. Presence-only: the
  // value is never read into a variable we print, log, or embed in any error message.
  const env = envForTests ?? process.env;
  if (!env.ANTHROPIC_API_KEY) {
    throw new LauncherError('LAUNCHER_ANTHROPIC_API_KEY_MISSING');
  }

  // 10. The canonical human_live Authorization Record, derived only from the validated plan.
  const authorization = bridge.buildProtocolV4DevelopmentAuthorization({
    plan,
    kind: 'human_live',
    authorizationId: authFile.authorizationId,
    humanApprovalReference: authFile.humanApprovalReference,
  });

  const artifactStoreRoot = path.resolve(
    repoRootForTests ?? process.cwd(),
    bridge.PROTOCOL_V4_LIVE_ROOT,
  );

  // 11. The single allowed live call. Production-call contract: the dispatch object is EXACTLY
  // `{ authorization, env }` with no `repoRoot` key at all on the production path -- never even
  // `repoRoot: undefined` -- only a test override adds the key.
  const dispatchArgs = { authorization, env };
  if (repoRootForTests) {
    dispatchArgs.repoRoot = repoRootForTests;
  }
  let evidence = null;
  let dispatchError = null;
  try {
    evidence = await bridge.runProtocolV4LiveDevelopmentEntryPoint(dispatchArgs);
  } catch (e) {
    dispatchError = e;
  }

  let leaseStatus = 'no_lease';
  try {
    const lease = bridge.readProtocolV4ExecutionLease(
      artifactStoreRoot,
      authorization.authorizationId,
    );
    leaseStatus = lease ? lease.status : 'no_lease';
  } catch (e) {
    leaseStatus = `unreadable: ${classifyLauncherError(e).code}`;
  }

  let authorizationConsumed = false;
  try {
    authorizationConsumed = bridge.isProtocolV4LiveAuthorizationConsumedAtomically(
      artifactStoreRoot,
      authorization.authorizationId,
      repoRootForTests,
    );
  } catch {
    authorizationConsumed = false;
  }

  const usage = dispatchError
    ? summarizeFailureUsage(dispatchError)
    : summarizeSuccessUsage(evidence);

  const summary = {
    success: dispatchError === null,
    error: dispatchError ? classifyLauncherError(dispatchError) : null,
    usageAccounting: usage.accounting,
    providerHttpRequests: usage.providerHttpRequests,
    aiDispatchReservations: usage.aiDispatchReservations,
    confirmedInputTokens: usage.confirmedInputTokens,
    confirmedOutputTokens: usage.confirmedOutputTokens,
    confirmedTotalTokens: usage.confirmedTotalTokens,
    confirmedCostUsd: usage.confirmedCostUsd,
    reservedInputTokensUpperBound: usage.reservedInputTokensUpperBound,
    reservedOutputTokensUpperBound: usage.reservedOutputTokensUpperBound,
    reservedCostUsdUpperBound: usage.reservedCostUsdUpperBound,
    completedCandidateIds: usage.completedCandidateIds,
    leaseFinalization: usage.leaseFinalization,
    developmentEvidenceRoot: evidence?.developmentEvidenceRootHash ?? null,
    canonicalArtifactRoot: artifactStoreRoot,
    leaseStatus,
    authorizationConsumed,
    holdoutExecuted: false,
    note: 'Holdout was not executed',
  };

  return { success: summary.success, summary, evidence };
}

// ---------------------------------------------------------------------------------------------
// CLI entry point.
// ---------------------------------------------------------------------------------------------

function printHelp() {
  console.log(`RESOLVER-V3-048 Phase B3 Canonical Live Development Launcher

Usage:
  node --env-file=.env scripts/run-resolver-v3-048-live-development.mjs --preflight
    [--authorization-template-out <ABSOLUTE_PATH>]

  node --env-file=.env scripts/run-resolver-v3-048-live-development.mjs --execute \\
    --authorization-file <ABSOLUTE_PATH> \\
    --confirm-development-only \\
    --confirm-max-cost-usd <value>

Exactly one of --preflight or --execute is required. --preflight never checks for
ANTHROPIC_API_KEY and never writes under the real Development live root. --execute validates the
given authorization file against a freshly rebuilt Master Plan (commit, plan/tree hash, model,
pricing, currency, cache policy, exact candidate identity set, every Development budget number,
concurrency, retry count, Holdout-not-authorized, automatic-continuation-disabled) strictly before
checking for ANTHROPIC_API_KEY or causing any side effect, then calls the real
runProtocolV4LiveDevelopmentEntryPoint for Development only -- Holdout is never executed. A failed
run reports transport-authoritative (never fabricated-zero) usage accounting; provider HTTP
requests and AI-dispatch reservations are always reported as separate, distinct dimensions.
`);
}

async function main(argv) {
  const args = parseArgs(argv);
  if (args.help) {
    printHelp();
    return 0;
  }
  if (args.errors.length > 0 || !args.mode) {
    for (const message of args.errors) console.error(message);
    printHelp();
    return 1;
  }
  try {
    if (args.mode === 'preflight') {
      const result = await runPreflight({
        authorizationTemplateOut: args.authorizationTemplateOut,
      });
      console.log(JSON.stringify(result, null, 2));
      return 0;
    }
    const result = await runExecute(args);
    console.log(JSON.stringify(result.summary, null, 2));
    return result.success ? 0 : 1;
  } catch (err) {
    const classified = classifyLauncherError(err);
    console.error(`${classified.class}: ${classified.code}`);
    return 1;
  }
}

const isMainModule =
  process.argv[1] !== undefined &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMainModule) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (err) => {
      const classified = classifyLauncherError(err);
      console.error(`${classified.class}: ${classified.code}`);
      process.exit(1);
    },
  );
}
