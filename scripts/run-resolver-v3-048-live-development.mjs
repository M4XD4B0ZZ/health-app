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
 *     --confirm-max-cost-usd "<EXACT_VALUE_FROM_PREFLIGHT>"
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
// CLI argument parsing -- RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Closed Output Surface"):
// every parser error is one of a fixed, enumerated code, exactly like `LauncherError` above. The
// original argv token/value is NEVER embedded in any error -- an unrecognized flag, a missing
// value, or any other submitted content (a path, a cost string, anything else) never reaches
// `result.errors`, and therefore never reaches stdout/stderr via `main()` below.
// ---------------------------------------------------------------------------------------------

const VALUE_FLAGS = new Set([
  '--authorization-file',
  '--confirm-max-cost-usd',
  '--authorization-template-out',
]);

const BOOLEAN_FLAGS = new Set(['--confirm-development-only']);

/** Every token `parseArgs` ever recognizes as a FLAG (mode, boolean, or value flag, or help) --
 * used only to detect "a known flag token was about to be consumed as a value flag's value"
 * (F5, "no flag token as a value"). A completely unknown, non-flag-shaped token is still accepted
 * as a real value; this set never restricts what a VALID value may contain. */
const KNOWN_FLAG_TOKENS = new Set([
  '--help',
  '-h',
  '--preflight',
  '--execute',
  ...BOOLEAN_FLAGS,
  ...VALUE_FLAGS,
]);

/** F5 ("mode-bound flags"): meaningful only under `--execute` -- rejected if present under
 * `--preflight`, even though each is independently recognized/parsed above. */
const EXECUTE_ONLY_FLAGS = new Set([
  '--authorization-file',
  '--confirm-development-only',
  '--confirm-max-cost-usd',
]);

/** F5 ("mode-bound flags"): meaningful only under `--preflight` -- rejected if present under
 * `--execute`. */
const PREFLIGHT_ONLY_FLAGS = new Set(['--authorization-template-out']);

/** The only argument-parsing codes `parseArgs`/`main` ever produce or print -- checked again in
 * `main()` before printing (defense in depth, mirroring `classifyLauncherError`'s own exact-match
 * pattern) so a code that somehow isn't on this list is never trusted either. */
export const KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES = new Set([
  'LAUNCHER_ARGUMENT_UNKNOWN',
  'LAUNCHER_ARGUMENT_VALUE_MISSING',
  'LAUNCHER_ARGUMENT_DUPLICATE',
  'LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_PREFLIGHT',
  'LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_EXECUTE',
  'LAUNCHER_MODE_MISSING',
  'LAUNCHER_MODE_MULTIPLE',
]);

/** RESOLVER-V3-048 Phase B3 post-merge remediation 4 (F5, "Unambiguous, Mode-Bound CLI
 * Arguments"): every flag may appear at most once (a duplicate -- value or boolean -- is a fixed,
 * enumerated parser error, first occurrence wins, the duplicate's own value is never read into
 * `result`); a value flag's value must be a real token, never another known flag token silently
 * swallowed as if it were a value (that case is reported as a missing value, and the wrongly-
 * assumed "value" token is re-parsed on the next loop iteration as its own flag); and
 * execute-only/preflight-only flags are rejected under the other mode. As before, no raw argv
 * token or value is ever pushed into `result.errors` -- every entry is one of the fixed codes
 * above. */
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
  const seenFlags = new Set();

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
    if (BOOLEAN_FLAGS.has(token)) {
      if (seenFlags.has(token)) {
        result.errors.push('LAUNCHER_ARGUMENT_DUPLICATE');
        continue;
      }
      seenFlags.add(token);
      result.confirmDevelopmentOnly = true;
      continue;
    }
    if (VALUE_FLAGS.has(token)) {
      const isDuplicate = seenFlags.has(token);
      seenFlags.add(token);
      const nextToken = argv[i + 1];
      const hasRealValue = nextToken !== undefined && !KNOWN_FLAG_TOKENS.has(nextToken);
      if (!hasRealValue) {
        result.errors.push('LAUNCHER_ARGUMENT_VALUE_MISSING');
        continue; // never consume nextToken -- it is re-parsed on the next iteration as its own token.
      }
      i += 1;
      if (isDuplicate) {
        result.errors.push('LAUNCHER_ARGUMENT_DUPLICATE');
        continue; // first-write-wins: the duplicate's own value is discarded, never overwrites.
      }
      if (token === '--authorization-file') result.authorizationFile = nextToken;
      else if (token === '--confirm-max-cost-usd') result.confirmMaxCostUsd = nextToken;
      else if (token === '--authorization-template-out')
        result.authorizationTemplateOut = nextToken;
      continue;
    }
    result.errors.push('LAUNCHER_ARGUMENT_UNKNOWN');
  }

  if (modesSeen.length === 0) {
    result.errors.push('LAUNCHER_MODE_MISSING');
  } else if (modesSeen.length > 1) {
    result.errors.push('LAUNCHER_MODE_MULTIPLE');
  } else {
    result.mode = modesSeen[0];
    if (result.mode === 'preflight') {
      for (const flag of EXECUTE_ONLY_FLAGS) {
        if (seenFlags.has(flag)) result.errors.push('LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_PREFLIGHT');
      }
    } else if (result.mode === 'execute') {
      for (const flag of PREFLIGHT_ONLY_FLAGS) {
        if (seenFlags.has(flag)) result.errors.push('LAUNCHER_ARGUMENT_NOT_ALLOWED_IN_EXECUTE');
      }
    }
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
/** RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Authoritative Success-Usage-Snapshot"): reads
 * ONLY the Protocol-v4 Development Runner's own `evidence.successUsageSnapshot` -- built from the
 * SAME authoritative sources (the shared budget gate, the execution context's transport-
 * authoritative counter) as the failure path's `protocolV4FailureUsageSnapshot` -- never re-derives
 * pricing/usage-parsing logic in this file. `aiDispatchReservations` is always a real number here
 * (never `null`); `reserved*UpperBound` denotes the shared gate's ENTIRE reserved-worst-case totals,
 * consistent with the failure path's own semantics -- never a partial sum restricted to only the
 * incomplete-usage entries (the pre-remediation-3 behavior). */
export function summarizeSuccessUsage(evidence) {
  const snapshot = evidence.successUsageSnapshot;
  if (snapshot) {
    return {
      accounting: snapshot.accounting,
      providerHttpRequests: snapshot.providerHttpRequests,
      aiDispatchReservations: snapshot.aiDispatchReservations,
      confirmedInputTokens: snapshot.confirmedInputTokens,
      confirmedOutputTokens: snapshot.confirmedOutputTokens,
      confirmedTotalTokens: snapshot.confirmedInputTokens + snapshot.confirmedOutputTokens,
      confirmedCostUsd: snapshot.confirmedCostUsd,
      reservedInputTokensUpperBound: snapshot.reservedInputTokensUpperBound,
      reservedOutputTokensUpperBound: snapshot.reservedOutputTokensUpperBound,
      reservedCostUsdUpperBound: snapshot.reservedCostUsdUpperBound,
      completedCandidateIds: snapshot.completedCandidateIds,
      leaseFinalization: null,
    };
  }
  // Unreachable on the real human_live path -- the Runner always attaches `successUsageSnapshot`
  // alongside `developmentEvidenceRootHash` in the same return statement. Never fabricates a number
  // if it somehow is missing: reports `'unknown'` rather than a fabricated exact/zero.
  return { accounting: 'unknown', ...UNKNOWN_USAGE, leaseFinalization: null };
}

/** RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Conservative Exact-Zero Rule"): every class
 * in this allowlist has been individually verified, by real CodeGraph relationship/throw-site
 * inspection (not assumed), to throw ONLY strictly before any real provider dispatch could ever have
 * started for the run in question. This list is intentionally much smaller than a prior revision's:
 * a post-merge review found (and this remediation independently re-confirmed via CodeGraph) that
 * several previously-allowlisted classes are ALSO reachable AFTER at least one real provider dispatch
 * already happened, which made this function capable of reporting a fabricated `exact`/all-zero
 * result for a failure that occurred after real, billable provider usage. Removed, with the concrete
 * reachable-after-dispatch call path each one was found at:
 * - `ProtocolV4ExecutionLeaseError`: `runProtocolV4DevelopmentForAllCandidates`'s own `catch` block
 *   calls `markProtocolV4ExecutionLeaseTerminalFailure` -> `transitionLease`, which throws this class
 *   (`PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND`/`_INVALID_TRANSITION`/a `writeLeaseVersionExclusive`
 *   version race) AFTER the candidate dispatch loop above it has already run.
 * - `ProtocolV4ArtifactStoreError`: `writeAndReadBackLiveArtifact` (called once per candidate, right
 *   after that candidate's own per-observation dispatch loop, and again for the shared plan-
 *   manifest/candidate-evaluation-table after ALL candidates have dispatched) throws this class on a
 *   content-hash mismatch, an already-existing target, or a readback hash mismatch.
 * - `ProtocolV4ArtifactCrashError`: `assertDevelopmentAuthorized` (called at the START of EACH
 *   candidate's own `runProtocolV4DevelopmentForCandidate`, i.e. AFTER any earlier candidate in the
 *   same run has already dispatched) calls `isProtocolV4LiveArtifactTargetUnused` ->
 *   `isTargetUnused`, which throws this class on leftover crash evidence. The source comment on the
 *   original `isProtocolV4LiveArtifactTargetUnused` call site inside
 *   `runProtocolV4LiveDevelopmentEntryPoint` correctly describes ITS OWN call (which IS strictly
 *   pre-lease-claim); the defect was generalizing that one pre-dispatch call site to the whole class,
 *   which also has this second, later-reachable throw site.
 * - `ProtocolV4DevelopmentAuthorizationError`: the very same per-candidate
 *   `assertDevelopmentAuthorized` call above can also fail its own budget/identity/consumption checks
 *   for the SECOND or THIRD candidate in a run, i.e. after an earlier candidate already dispatched.
 * - `ProtocolV4LiveExecutionContextError`: `runProtocolV4Attempt` (the single all-path attempt
 *   wrapper) calls `input.buildFastPathTerminal(raw, endToEndLatencyMs)` AFTER `input.attempt(...)`
 *   has already run and returned -- for `human_live`, that `attempt` is the real dispatch through the
 *   counting transport, so a real `fetch` (and therefore a real, non-zero
 *   `providerHttpRequestCount`/`cumulativeProviderHttpRequestCount`) can already have happened before
 *   `buildFastPathTerminal` throws `PROTOCOL_V4_LIVE_EXECUTION_UNEXPECTED_FAST_PATH`. The source
 *   comment at that throw site's own call site claims this is "structurally unreachable"; this
 *   remediation does not disprove that specific claim, but per the conservative rule below a class
 *   stays out of this allowlist unless EVERY throw site of that class is proven pre-dispatch -- one
 *   proven-pre-dispatch call site (`buildProtocolV4HumanLiveExecutionContext`'s own credential check)
 *   is not enough once a second, dispatch-loop-internal call site exists for the same class.
 *
 * Kept, each with every throw site verified strictly pre-dispatch:
 * - `LauncherError` (this module's own real class): every throw site in this file that can reach
 *   `dispatchError` in `runExecute` runs in steps 1-9, entirely before the `try` around
 *   `bridge.runProtocolV4LiveDevelopmentEntryPoint(...)` -- a `LauncherError` thrown there propagates
 *   out of `runExecute` itself and is never passed to `summarizeFailureUsage` at all. In production
 *   this branch is therefore never actually taken via `dispatchError`; it exists so a direct pure-unit
 *   test of `summarizeFailureUsage` can still assert the pre-dispatch contract without a bridge.
 * - `bridge.ProtocolV4LiveDevelopmentEntryPointError`: every throw site
 *   (`ResolverV3048ProtocolV4LiveDevelopmentEntryPoint.ts`, steps 1-4: plan/authorization
 *   validation, already-consumed check, artifact-target-reuse check) runs strictly before step 5
 *   (lease claim) and step 6 (`runProtocolV4DevelopmentForAllCandidates`, the only place dispatch can
 *   happen) in the same function.
 *
 * A trusted side-channel snapshot (see `summarizeFailureUsage` below) always takes priority over this
 * allowlist when present and valid -- this allowlist only matters for a failure that carries no
 * snapshot at all, e.g. one that occurred before the Runner's shared failure handler could even run.
 *
 * Membership is checked by real `instanceof` against the ACTUAL classes -- `LauncherError` (this
 * module's own real class, always available) plus the real Protocol-v4 classes re-exported by the
 * compiled bridge (only available once `loadCompiledBridge` has run; `bridge` is `undefined` in
 * pure unit tests that never touch the real TypeScript graph, in which case only the `LauncherError`
 * check applies -- an unrecognized foreign error, even one spoofing `error.name` to look like one of
 * these class names as a bare string, can never satisfy `instanceof` and therefore can never force a
 * fabricated exact-zero usage report here). Never a string comparison against `error.name` (a freely
 * settable property on any plain object) -- that was the original F1 defect this replaces. */
function isKnownPreDispatchError(error, bridge) {
  if (error instanceof LauncherError) return true;
  if (!bridge) return false;
  return [bridge.ProtocolV4LiveDevelopmentEntryPointError].some(
    (cls) => typeof cls === 'function' && error instanceof cls,
  );
}

/** RESOLVER-V3-048 Phase B3 Post-Merge Remediation 5 ("Runtime Snapshot Validation"): even a
 * snapshot produced by the trusted internal side channel must be validated at this launcher boundary
 * before being trusted -- the compiled bridge crosses a TypeScript-to-plain-JS boundary with no
 * runtime type enforcement, so a structurally malformed value here (a future bug, a partially
 * constructed object, ...) must never be partially trusted. Rejects (returns `false` for) anything
 * that is not a plain object with every field present and of the exact expected shape; a rejected
 * snapshot is treated by the caller as if no snapshot existed at all -- never a partial read. Never
 * includes the snapshot's own values in a thrown error or log line (this function only returns a
 * boolean). */
const KNOWN_CANDIDATE_IDS = new Set(['H0', 'H1', 'H2']);

function isFiniteNonNegativeInteger(value) {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0;
}

function isFiniteNonNegativeNumber(value) {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

export function isValidProtocolV4FailureUsageSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== 'object' || Array.isArray(snapshot)) return false;
  if (snapshot.accounting !== 'exact_zero' && snapshot.accounting !== 'partial') return false;
  if (!Array.isArray(snapshot.completedCandidateIds)) return false;
  if (!snapshot.completedCandidateIds.every((id) => KNOWN_CANDIDATE_IDS.has(id))) return false;
  if (!isFiniteNonNegativeInteger(snapshot.providerHttpRequests)) return false;
  if (!isFiniteNonNegativeInteger(snapshot.aiDispatchReservations)) return false;
  if (!isFiniteNonNegativeInteger(snapshot.reservedInputTokensUpperBound)) return false;
  if (!isFiniteNonNegativeInteger(snapshot.reservedOutputTokensUpperBound)) return false;
  if (!isFiniteNonNegativeNumber(snapshot.reservedCostUsdUpperBound)) return false;
  if (!isFiniteNonNegativeInteger(snapshot.confirmedInputTokens)) return false;
  if (!isFiniteNonNegativeInteger(snapshot.confirmedOutputTokens)) return false;
  if (!isFiniteNonNegativeNumber(snapshot.confirmedCostUsd)) return false;
  // `exact_zero` is only internally consistent with zero real, transport-authoritative HTTP
  // requests -- this mirrors exactly how `attachProtocolV4FailureUsageSnapshot` itself derives the
  // field (`accounting: providerHttpRequests > 0 ? 'partial' : 'exact_zero'`), and how this
  // launcher's own `summarizeFailureUsage` derives `isExactZero` below. Deliberately does NOT also
  // require `aiDispatchReservations === 0`: a budget-gate reservation that was made and then
  // released without ever reaching a real `fetch` is still `exact_zero` for PROVIDER usage -- the
  // reservation count is a separate, honestly-reported dimension (see `aiDispatchReservations`'s own
  // doc comment above), never conflated with "nothing happened at all".
  if (snapshot.accounting === 'exact_zero' && snapshot.providerHttpRequests !== 0) return false;
  return true;
}

const KNOWN_LEASE_FINALIZATION_STATUSES = new Set([
  'terminal_failure_confirmed',
  'failed_to_persist',
]);

export function isValidProtocolV4LeaseFinalizationStatus(status) {
  return typeof status === 'string' && KNOWN_LEASE_FINALIZATION_STATUSES.has(status);
}

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

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 2 ("Transport-Authoritative Accounting"), rebuilt in
 * Phase B3 Post-Merge Remediation 5 ("Trusted Failure Metadata, Non-Fabricated Usage") on top of a
 * non-spoofable side channel: reads ONLY the Protocol-v4 Development Runner's own trusted usage
 * snapshot, via `bridge.readProtocolV4FailureUsageSnapshot(error)` -- a `WeakMap`-backed accessor
 * keyed strictly on `error`'s own object identity (`ResolverV3048ProtocolV4FailureMetadataSideChannel.ts`),
 * never a property read on `error` itself. A foreign error can no longer pre-seed or spoof this
 * value: there is no property name to define for that purpose anymore. `bridge` is optional
 * (`undefined` in a pure unit test that never touches the real TypeScript graph, or a test bridge
 * fixture exposing only the two read-only functions this launcher actually calls) -- in that case no
 * snapshot can ever be read, exactly as if none had been recorded.
 *
 * Every snapshot this function is handed is still runtime-validated
 * (`isValidProtocolV4FailureUsageSnapshot`) before being trusted -- an internally-produced value that
 * somehow fails validation is treated exactly like "no snapshot at all", never partially consumed.
 * When no valid snapshot is present, this does NOT default to "exact zero": only a recognized
 * pre-dispatch error class (see `isKnownPreDispatchError`'s own doc comment for the now much smaller,
 * individually-verified allowlist) justifies reporting exact zero; any other error is reported as
 * `'unknown'` usage -- `null` fields, never fabricated `0`s. The lease-finalization status is read
 * and validated the identical way (`bridge.readProtocolV4LeaseFinalizationStatus`/
 * `isValidProtocolV4LeaseFinalizationStatus`) -- an invalid or absent status is reported as `null`,
 * never a foreign/fabricated value. */
export function summarizeFailureUsage(error, bridge) {
  const rawSnapshot = bridge?.readProtocolV4FailureUsageSnapshot(error);
  const snapshot = isValidProtocolV4FailureUsageSnapshot(rawSnapshot) ? rawSnapshot : undefined;
  const rawLeaseFinalization = bridge?.readProtocolV4LeaseFinalizationStatus(error);
  const leaseFinalization = isValidProtocolV4LeaseFinalizationStatus(rawLeaseFinalization)
    ? rawLeaseFinalization
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

  if (isKnownPreDispatchError(error, bridge)) {
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

/** RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("Real Protocol-v4 Code Allowlist"): every
 * constant base-code string actually thrown, anywhere in `src/features/nutrition/benchmark/
 * protocolV4/`, by one of the `KNOWN_SAFE_PROTOCOL_ERROR_CLASSES` above -- derived by direct source
 * inspection of every `throw new ProtocolV4...Error(...)` call site in that class (verified via
 * `mcp__codegraph__codegraph_explore`, not freely invented). A base code is the fixed leading
 * portion of a thrown message, before any dynamic suffix a call site appends after a `:` (an ID, a
 * path, a candidate/partition name, ...) -- `CODE_PREFIX_PATTERN` below extracts exactly that
 * portion, which is then checked EXACTLY against this set. Combining "known class" with "any
 * regex-shaped prefix" (the pre-remediation-3 behavior) was not enough: a corrupted/foreign message
 * that merely LOOKS like a constant code would still have been trusted and surfaced verbatim. Only
 * an EXACT match against this enumerated list is ever surfaced; anything else (including a base
 * code that is itself dynamic, e.g. `PROTOCOL_V4_EVALUATION_NO_${x}_REPORT`, which will never
 * exactly match a single fixed string here) falls through to the generic fallback code below. */
export const KNOWN_SAFE_PROTOCOL_ERROR_CODES = new Set([
  // ProtocolV4LiveDevelopmentEntryPointError
  'PROTOCOL_V4_LIVE_DEVELOPMENT_REQUIRES_HUMAN_LIVE_AUTHORIZATION',
  'PROTOCOL_V4_LIVE_DEVELOPMENT_HUMAN_APPROVAL_REFERENCE_REQUIRED',
  'PROTOCOL_V4_LIVE_DEVELOPMENT_AUTHORIZATION_PLAN_MISMATCH',
  'PROTOCOL_V4_LIVE_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
  'PROTOCOL_V4_LIVE_DEVELOPMENT_ARTIFACT_TARGET_REUSED',
  // ProtocolV4ExecutionLeaseError
  'PROTOCOL_V4_EXECUTION_LEASE_UNSAFE_ID',
  'PROTOCOL_V4_EXECUTION_LEASE_VERSION_RACE',
  'PROTOCOL_V4_EXECUTION_LEASE_READBACK_HASH_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_VERSION_FILENAME_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_REQUIRES_EVIDENCE_ROOT',
  'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_FORBIDS_EVIDENCE_ROOT',
  'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_FORBIDS_HOLDOUT_PLAN_BINDING',
  'PROTOCOL_V4_EXECUTION_LEASE_ALREADY_CLAIMED',
  'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_AUTHORIZATION_HASH_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_ROOT_DOES_NOT_MATCH_AUTHORIZATION_KIND',
  'PROTOCOL_V4_EXECUTION_LEASE_DEVELOPMENT_AUTHORIZATION_PLAN_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_DRY_RUN_HOLDOUT_AUTHORIZATION_IDENTITY_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_ADMISSION_AUTHORIZATION_IDENTITY_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND',
  'PROTOCOL_V4_EXECUTION_LEASE_INVALID_TRANSITION',
  'PROTOCOL_V4_EXECUTION_LEASE_NOT_ACTIVE',
  'PROTOCOL_V4_EXECUTION_LEASE_PHASE_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_PLAN_HASH_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_EXECUTION_TREE_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_ID_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_ARTIFACT_ROOT_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_CANDIDATE_SCOPE_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_EVIDENCE_ROOT_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_HOLDOUT_PLAN_HASH_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_SELECTION_OR_CHOICE_HASH_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_BUDGET_SCOPE_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_CONCURRENCY_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_PRICING_VERSION_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_MODEL_ID_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_KIND_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_RUN_KIND_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_SCHEMA_VERSION_MISMATCH',
  'PROTOCOL_V4_EXECUTION_LEASE_AUTHORIZATION_RECORD_HASH_MISMATCH',
  // ProtocolV4DevelopmentRunnerError
  'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNKNOWN_SCENARIO',
  'PROTOCOL_V4_EXECUTION_MODE_AUTHORIZATION_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_FAST_PATH',
  'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_CEILING',
  'PROTOCOL_V4_DEVELOPMENT_RUNNER_UNEXPECTED_TIMEOUT',
  // ProtocolV4DevelopmentAuthorizationError
  'PROTOCOL_V4_DEVELOPMENT_HUMAN_APPROVAL_REFERENCE_REQUIRED',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_HASH_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_SCHEMA_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_PHASE_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_IDENTITY_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CANDIDATE_SET_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CURRENCY_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_ALREADY_CONSUMED',
  'PROTOCOL_V4_DEVELOPMENT_ARTIFACT_TARGET_REUSED',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_LIMITS_INSUFFICIENT',
  'PROTOCOL_V4_DEVELOPMENT_AUTHORIZATION_CONCURRENCY_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_BUDGET_INSUFFICIENT',
  'PROTOCOL_V4_DEVELOPMENT_EXECUTION_MODE_AUTHORIZATION_MISMATCH',
  'PROTOCOL_V4_HUMAN_APPROVAL_REFERENCE_REQUIRED',
  // ProtocolV4ArtifactStoreError
  'PROTOCOL_V4_ARTIFACT_STORE_UNSAFE_AUTHORIZATION_ID',
  'PROTOCOL_V4_ARTIFACT_STORE_CONTENT_HASH_MISMATCH',
  'PROTOCOL_V4_ARTIFACT_ALREADY_EXISTS',
  'PROTOCOL_V4_ARTIFACT_READBACK_HASH_MISMATCH',
  'PROTOCOL_V4_AUTHORIZATION_ALREADY_CONSUMED_ATOMIC',
  'PROTOCOL_V4_ARTIFACT_STORE_LIVE_PATH_FORBIDDEN_IN_DRY_RUN',
  'PROTOCOL_V4_ARTIFACT_STORE_DRY_RUN_PATH_FORBIDDEN_IN_LIVE',
  // ProtocolV4ArtifactCrashError
  'PROTOCOL_V4_ARTIFACT_STORE_CRASH_EVIDENCE_DETECTED',
  // ProtocolV4LiveExecutionContextError
  'PROTOCOL_V4_LIVE_EXECUTION_CREDENTIAL_MISSING',
  'PROTOCOL_V4_LIVE_EXECUTION_UNEXPECTED_FAST_PATH',
  // ProtocolV4AttemptWrapperError
  'PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISSING',
  'PROTOCOL_V4_PROVIDER_RUN_IDENTITY_FIELD_MISSING',
  'PROTOCOL_V4_PROVIDER_PRICING_STATUS_UNKNOWN_NOT_ALLOWED',
  'PROTOCOL_V4_PROVIDER_USAGE_STATUS_MISSING',
  'PROTOCOL_V4_PROVIDER_ACTUAL_COST_STATUS_MISSING',
  'PROTOCOL_V4_PROVIDER_LATENCY_MISSING',
  'PROTOCOL_V4_PROVIDER_RETRYABLE_MISSING',
  'PROTOCOL_V4_PROVIDER_CACHE_TOKENS_MISSING',
  'PROTOCOL_V4_PROVIDER_HTTP_STATUS_MISSING',
  'PROTOCOL_V4_PROVIDER_FAILURE_KIND_MISSING',
  'PROTOCOL_V4_END_TO_END_LATENCY_INVALID',
  // ProtocolV4AttemptContextError
  'PROTOCOL_V4_ATTEMPT_CONTEXT_UNKNOWN_CANDIDATE',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_MODEL_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_PRICING_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_AUTHORIZATION_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_RESERVATION_CALL_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_HASH_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_NOT_FROZEN',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_PLAN_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_PRICING_MISMATCH',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_CANDIDATE_DRIFT',
  'PROTOCOL_V4_ATTEMPT_CONTEXT_PROVIDER_IDENTITY_MISMATCH',
  'PROTOCOL_V4_PROVIDER_RUN_IDENTITY_MISMATCH',
  // ProtocolV4CallStateMachineError
  'PROTOCOL_V4_CALL_ID_NOT_UNIQUE',
  'PROTOCOL_V4_CALL_UNKNOWN',
  'PROTOCOL_V4_CALL_INVALID_TRANSITION',
  // ProtocolV4EvaluationDerivationError
  'PROTOCOL_V4_EVALUATION_UNKNOWN_SCENARIO',
  'PROTOCOL_V4_EVALUATION_MISSING_ARM_BASELINE',
  'PROTOCOL_V4_EVALUATION_TELEMETRY_LEDGER_LENGTH_MISMATCH',
  'PROTOCOL_V4_EVALUATION_RECOMPUTATION_MISMATCH',
  'PROTOCOL_V4_DEVELOPMENT_EVIDENCE_EVALUATION_NOT_DERIVED',
  'PROTOCOL_V4_FINAL_G2_ARTIFACT_CANDIDATE_MISMATCH',
  'PROTOCOL_V4_FINAL_G2_RAW_RESULTS_CANDIDATE_MISMATCH',
  'PROTOCOL_V4_FINAL_G2_RAW_RESULTS_COVERAGE_MISMATCH',
  'PROTOCOL_V4_FINAL_G2_TELEMETRY_LEDGER_LENGTH_MISMATCH',
  'PROTOCOL_V4_FINAL_G2_EVALUATION_NOT_DERIVED',
  'PROTOCOL_V4_FINAL_G2_CANDIDATE_MISMATCH',
  'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_AUTHORIZATION_IDENTITY_MISMATCH',
  'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_CANDIDATE_MISMATCH',
  'PROTOCOL_V4_DRY_RUN_FINAL_REPORT_REDERIVATION_MISMATCH',
  // ProtocolV4EvaluatorManifestError
  'PROTOCOL_V4_EVALUATOR_MANIFEST_FILE_MISSING',
  // ProtocolV4PricingAuthorityError
  'PROTOCOL_V4_PRICING_AUTHORITY_MISSING',
  'PROTOCOL_V4_PRICING_AUTHORITY_UNVERSIONED',
  'PROTOCOL_V4_PRICING_AUTHORITY_MODEL_MISMATCH',
  'PROTOCOL_V4_PRICING_AUTHORITY_CURRENCY_UNSUPPORTED',
  'PROTOCOL_V4_PRICING_IDENTITY_MISMATCH',
  // ProtocolV4ReservationError
  'PROTOCOL_V4_RESERVATION_MODEL_MISMATCH',
  'PROTOCOL_V4_RESERVATION_TOKEN_MISMATCH',
  'PROTOCOL_V4_RESERVATION_HASH_MISMATCH',
  'PROTOCOL_V4_RESERVATION_NOT_FROZEN',
  'PROTOCOL_V4_RESERVATION_CURRENCY_MISMATCH',
  'PROTOCOL_V4_RESERVATION_TOTAL_TOKENS_INCONSISTENT',
  // ProtocolV4TelemetryLedgerError
  'PROTOCOL_V4_TERMINAL_CALL_ID_MISMATCH',
  'PROTOCOL_V4_TELEMETRY_LEDGER_SHARED_INSTANCE',
  'PROTOCOL_V4_WALL_CLOCK_WRAPPER_CONTRACT_VIOLATION',
]);

/** Never returns raw provider payloads, headers, proxy values, request/response content, paths,
 * JSON excerpts, or compiler output. `LauncherError` codes are matched EXACTLY against
 * `KNOWN_LAUNCHER_ERROR_CODES`; anything not on that list is reported as a generic, still-safe
 * fallback code rather than trusted. Protocol-v4 domain errors from a known-safe class are matched
 * EXACTLY (after extracting the fixed base-code prefix) against `KNOWN_SAFE_PROTOCOL_ERROR_CODES` --
 * a known class with an unrecognized/dynamic/tampered base code is reported via a generic, still-
 * safe fallback code, never the raw extracted text. */
export function classifyLauncherError(error) {
  const isObject = error !== null && typeof error === 'object';
  const name = isObject && typeof error.name === 'string' ? error.name : undefined;
  const message = isObject && typeof error.message === 'string' ? error.message : undefined;

  if (name === 'LauncherError' && message !== undefined) {
    return {
      class: 'LauncherError',
      code: KNOWN_LAUNCHER_ERROR_CODES.has(message) ? message : 'LAUNCHER_UNRECOGNIZED_CODE',
    };
  }
  if (name !== undefined && KNOWN_SAFE_PROTOCOL_ERROR_CLASSES.has(name) && message !== undefined) {
    const prefixMatch = CODE_PREFIX_PATTERN.exec(message);
    const baseCode = prefixMatch ? prefixMatch[0] : null;
    return {
      class: name,
      code:
        baseCode !== null && KNOWN_SAFE_PROTOCOL_ERROR_CODES.has(baseCode)
          ? baseCode
          : 'PROTOCOL_V4_UNRECOGNIZED_CODE',
    };
  }
  // RESOLVER-V3-048 Phase B3 post-merge remediation 4 (F4, "No Unfiltered error.name"): a
  // completely unrecognized error class's `.name` is a freely settable string on any plain
  // object -- it could contain a secret marker, an absolute path, embedded newlines, or text
  // crafted to look like a launcher success line. It is NEVER echoed here (nor is `.message`,
  // which was already excluded before this remediation): only this fixed, constant fallback code
  // is ever returned, exactly like `LAUNCHER_UNRECOGNIZED_CODE`/`PROTOCOL_V4_UNRECOGNIZED_CODE`
  // above are fixed constants rather than derived from foreign input.
  return { class: 'unknown', code: 'LAUNCHER_UNCLASSIFIED_ERROR' };
}

/** RESOLVER-V3-048 Phase B3 post-merge remediation 4 (F3, "Tri-State Authorization Consumption"):
 * a readback of whether the live Development authorization was atomically consumed must never be
 * collapsed into a boolean -- "confirmed not consumed" and "the on-disk marker could not be read"
 * are different claims with different operational meanings, and conflating them (the pre-
 * remediation-4 behavior, which reported `false`/"not consumed" for both) could make a genuinely
 * consumed-but-unreadable authorization look safe to retry. Takes the raw outcome of the
 * readback attempt (`{ ok: true, consumed }` on a successful read, `{ ok: false, error }` if the
 * read itself threw) and returns an explicit, secret-free tri-state. `errorCode` is always the
 * result of `classifyLauncherError` -- never the foreign error's own `.message`/`.name`/a path. */
export function summarizeAuthorizationConsumption(readResult) {
  if (readResult.ok) {
    return { status: readResult.consumed ? 'consumed' : 'not_consumed' };
  }
  return { status: 'unreadable', errorCode: classifyLauncherError(readResult.error).code };
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

  let authorizationConsumption;
  try {
    const consumed = bridge.isProtocolV4LiveAuthorizationConsumedAtomically(
      artifactStoreRoot,
      authorization.authorizationId,
      repoRootForTests,
    );
    authorizationConsumption = summarizeAuthorizationConsumption({ ok: true, consumed });
  } catch (e) {
    authorizationConsumption = summarizeAuthorizationConsumption({ ok: false, error: e });
  }

  const usage = dispatchError
    ? summarizeFailureUsage(dispatchError, bridge)
    : summarizeSuccessUsage(evidence);

  const summary = {
    // RESOLVER-V3-048 Phase B3 post-merge remediation 4 (F3): `success` denotes ONLY whether the
    // Development provider/dispatch call itself completed without throwing -- it says nothing
    // about whether the authorization-consumption marker could be read back (see
    // `authorizationConsumption` below, which is its own, separately reported tri-state). A
    // maintainer must never read `success: true` plus a non-`'consumed'` consumption status as
    // license to safely retry: an `'unreadable'` consumption status means the true on-disk state
    // is simply unknown, not that nothing was consumed.
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
    // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("No Absolute Paths"): a stable, secret-free
    // semantic identity -- never the real, absolute `artifactStoreRoot` filesystem path.
    artifactRootKind: 'protocol_v4_live',
    leaseStatus,
    authorizationConsumption,
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
    for (const code of args.errors) {
      console.error(
        KNOWN_LAUNCHER_ARGUMENT_ERROR_CODES.has(code)
          ? code
          : 'LAUNCHER_ARGUMENT_UNRECOGNIZED_CODE',
      );
    }
    printHelp();
    return 1;
  }
  try {
    if (args.mode === 'preflight') {
      const result = await runPreflight({
        authorizationTemplateOut: args.authorizationTemplateOut,
      });
      // RESOLVER-V3-048 Phase B3 pre-PR remediation 3 ("No Absolute Paths"): `runPreflight`'s own
      // return value keeps the real absolute `authorizationTemplateWrittenTo` path for programmatic
      // callers/tests (e.g. to read back and verify the written file), but the PRINTED preflight
      // output never includes it -- only a stable boolean.
      const printable = {
        preflightReport: result.preflightReport,
        authorizationTemplate: result.authorizationTemplate,
        authorizationTemplateWritten: result.authorizationTemplateWrittenTo !== null,
      };
      console.log(JSON.stringify(printable, null, 2));
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
