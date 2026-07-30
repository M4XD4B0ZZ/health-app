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
 * (outside the repository, `authorizationTemplateOnly: false`, a non-empty
 * `humanApprovalReference`) that is validated field-by-field against a freshly rebuilt Master Plan
 * -- commit, plan/tree hash, model, pricing, candidate/prompt/schema/routing identities, every
 * Development budget number, concurrency, retry count, Holdout-not-authorized, and
 * automatic-continuation-disabled -- strictly BEFORE `ANTHROPIC_API_KEY` presence is even checked,
 * and strictly before any lease/live-root/artifact side effect. Only after every check above passes
 * does this launcher build the canonical `human_live` Development Authorization Record (via the
 * real `buildProtocolV4DevelopmentAuthorization`) and call the real
 * `runProtocolV4LiveDevelopmentEntryPoint({ authorization, env: process.env })` -- no `repoRoot` is
 * ever passed to it on this production path. This launcher never imports or references any Holdout
 * function; Development is the only thing it can ever run, and it stops for good afterwards.
 *
 * No budget number is independently re-typed as an alternative truth anywhere in this file -- every
 * comparison below reads from the freshly built, freshly validated Master Plan.
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

export class LauncherError extends Error {
  constructor(message) {
    super(message);
    this.name = 'LauncherError';
  }
}

// ---------------------------------------------------------------------------------------------
// Git helpers -- always operate on the real repository, never on any isolated test `repoRoot`.
// ---------------------------------------------------------------------------------------------

function runGit(repoRoot, args) {
  const result = spawnSync('git', args, { cwd: repoRoot, encoding: 'utf-8' });
  if (result.error) {
    throw new LauncherError(`LAUNCHER_GIT_SPAWN_FAILED: ${result.error.message}`);
  }
  return result;
}

export function isWorkingTreeClean(repoRoot) {
  const result = runGit(repoRoot, ['status', '--porcelain']);
  if (result.status !== 0) {
    throw new LauncherError(`LAUNCHER_GIT_STATUS_FAILED: git status exited ${result.status}`);
  }
  return result.stdout.trim().length === 0;
}

export function getCurrentCommit(repoRoot) {
  const result = runGit(repoRoot, ['rev-parse', 'HEAD']);
  if (result.status !== 0) {
    throw new LauncherError('LAUNCHER_GIT_REV_PARSE_FAILED: could not determine current HEAD');
  }
  return result.stdout.trim();
}

export function isAncestor(repoRoot, ancestorSha, descendantSha) {
  const result = runGit(repoRoot, ['merge-base', '--is-ancestor', ancestorSha, descendantSha]);
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  throw new LauncherError(
    `LAUNCHER_GIT_MERGE_BASE_FAILED: git merge-base --is-ancestor exited ${result.status}`,
  );
}

function assertCwdIsRepoRoot() {
  if (path.resolve(process.cwd()) !== path.resolve(REAL_REPO_ROOT)) {
    throw new LauncherError(
      `LAUNCHER_CWD_MUST_BE_REPO_ROOT: run this launcher from the repository root ` +
        `(${REAL_REPO_ROOT}), not from ${process.cwd()}.`,
    );
  }
}

// ---------------------------------------------------------------------------------------------
// Local-only TypeScript build -- no tsx/ts-node/global tool/npx, no automatic install.
// ---------------------------------------------------------------------------------------------

export function assertLocalToolchainAvailable(repoRoot) {
  const nodeModulesPath = path.join(repoRoot, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    throw new LauncherError(
      'LAUNCHER_NODE_MODULES_MISSING: node_modules is missing. Run `npm install` yourself first ' +
        '-- this launcher never installs dependencies automatically.',
    );
  }
  const tscBinPath = path.join(nodeModulesPath, 'typescript', 'bin', 'tsc');
  if (!fs.existsSync(tscBinPath)) {
    throw new LauncherError(
      'LAUNCHER_LOCAL_TYPESCRIPT_MISSING: node_modules/typescript/bin/tsc is missing. Run ' +
        '`npm install` yourself first -- this launcher never installs dependencies automatically.',
    );
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
    throw new LauncherError(`LAUNCHER_BUILD_SPAWN_FAILED: ${result.error.message}`);
  }
  if (result.status !== 0) {
    throw new LauncherError(
      `LAUNCHER_BUILD_FAILED: local tsc compile of the Protocol-v4 launcher graph failed ` +
        `(exit ${result.status}).\n${result.stdout ?? ''}\n${result.stderr ?? ''}`,
    );
  }
  if (!fs.existsSync(COMPILED_BRIDGE_PATH)) {
    throw new LauncherError(
      'LAUNCHER_BUILD_OUTPUT_MISSING: tsc succeeded but the compiled launcherBridge.js was not ' +
        `found at ${COMPILED_BRIDGE_PATH}.`,
    );
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
// Path safety -- the authorization file (and any explicit template-output path) must live outside
// the repository, addressed by an absolute path, per the task's explicit contract.
// ---------------------------------------------------------------------------------------------

export function assertAbsoluteAndOutsideRepoRoot(repoRoot, candidatePath, label) {
  if (typeof candidatePath !== 'string' || candidatePath.length === 0) {
    throw new LauncherError(`LAUNCHER_PATH_MISSING: ${label} requires a value.`);
  }
  if (!path.isAbsolute(candidatePath)) {
    throw new LauncherError(`LAUNCHER_PATH_NOT_ABSOLUTE: ${label} must be an absolute path.`);
  }
  const resolvedRepoRoot = path.resolve(repoRoot);
  const resolvedCandidate = path.resolve(candidatePath);
  const withSep = resolvedRepoRoot + path.sep;
  if (resolvedCandidate === resolvedRepoRoot || resolvedCandidate.startsWith(withSep)) {
    throw new LauncherError(
      `LAUNCHER_PATH_INSIDE_REPO: ${label} must be located outside the repository root ` +
        `(${resolvedRepoRoot}).`,
    );
  }
  return resolvedCandidate;
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
    maxConcurrentRequests: plan.budget.maxConcurrentRequests,
    retryCount: plan.retryCount,
    authorizedPhase: 'development',
    holdoutAuthorized: false,
    automaticContinuation: false,
    authorizationId: `protocol-v4-live-development-${commit.slice(0, 12)}-${randomUUID()}`,
    humanApprovalReference: '',
  };
}

// ---------------------------------------------------------------------------------------------
// Authorization-file validation -- every check below must pass, in this order, strictly before
// `ANTHROPIC_API_KEY` presence is even checked and strictly before any lease/live-root/artifact
// side effect.
// ---------------------------------------------------------------------------------------------

function assertCheck(condition, code, message) {
  if (!condition) {
    throw new LauncherError(`${code}: ${message}`);
  }
}

export function validateAuthorizationFileStructure(authFile) {
  assertCheck(
    authFile !== null && typeof authFile === 'object' && !Array.isArray(authFile),
    'LAUNCHER_AUTHORIZATION_FILE_INVALID_SHAPE',
    'the authorization file must contain a single JSON object',
  );
  assertCheck(
    authFile.authorizationTemplateOnly === false,
    'LAUNCHER_AUTHORIZATION_FILE_IS_TEMPLATE_ONLY',
    'refusing to execute a template (authorizationTemplateOnly must be exactly false)',
  );
  assertCheck(
    typeof authFile.humanApprovalReference === 'string' &&
      authFile.humanApprovalReference.length > 0,
    'LAUNCHER_AUTHORIZATION_FILE_MISSING_HUMAN_APPROVAL_REFERENCE',
    'humanApprovalReference must be a non-empty string',
  );
  assertCheck(
    typeof authFile.authorizationId === 'string' && authFile.authorizationId.length > 0,
    'LAUNCHER_AUTHORIZATION_FILE_MISSING_AUTHORIZATION_ID',
    'authorizationId must be a non-empty string',
  );
}

export function validateAuthorizationAgainstRepositoryState(
  authFile,
  { headCommit, pr204IsAncestor },
) {
  assertCheck(
    authFile.authorizedCommit === headCommit,
    'LAUNCHER_HEAD_COMMIT_MISMATCH',
    `authorizedCommit (${authFile.authorizedCommit}) does not match current HEAD (${headCommit})`,
  );
  assertCheck(
    pr204IsAncestor,
    'LAUNCHER_PR204_MERGE_NOT_ANCESTOR',
    'the PR #204 merge commit is not an ancestor of the current HEAD',
  );
}

export function candidateIdentitiesMatch(actual, expected) {
  if (!Array.isArray(actual) || actual.length !== expected.length) return false;
  const byId = new Map(expected.map((c) => [c.id, c]));
  for (const candidate of actual) {
    if (candidate === null || typeof candidate !== 'object') return false;
    const target = byId.get(candidate.id);
    if (!target) return false;
    for (const key of [
      'version',
      'promptVersion',
      'promptHash',
      'schemaVersion',
      'schemaHash',
      'routingVersion',
    ]) {
      if (candidate[key] !== target[key]) return false;
    }
  }
  return true;
}

export function validateAuthorizationAgainstPlan(authFile, plan, report) {
  assertCheck(
    authFile.masterPlanHash === plan.planHash,
    'LAUNCHER_PLAN_HASH_MISMATCH',
    "masterPlanHash does not match the freshly-built plan's own planHash",
  );
  assertCheck(
    authFile.developmentExecutionTreeHash === plan.developmentExecutionTreeHash,
    'LAUNCHER_EXECUTION_TREE_HASH_MISMATCH',
    'developmentExecutionTreeHash does not match the freshly-built plan',
  );
  assertCheck(
    authFile.modelId === plan.modelId,
    'LAUNCHER_MODEL_ID_MISMATCH',
    'modelId does not match the freshly-built plan',
  );
  assertCheck(
    authFile.pricingVersion === plan.pricing.pricingVersion,
    'LAUNCHER_PRICING_VERSION_MISMATCH',
    'pricingVersion does not match the freshly-built plan',
  );
  assertCheck(
    candidateIdentitiesMatch(authFile.candidateIdentities, report.candidates),
    'LAUNCHER_CANDIDATE_IDENTITY_MISMATCH',
    'candidate/prompt/schema/routing identities do not match the freshly-built plan',
  );
  assertCheck(
    authFile.developmentCalls === plan.budget.developmentCalls,
    'LAUNCHER_BUDGET_MISMATCH_CALLS',
    'developmentCalls does not match the plan budget',
  );
  assertCheck(
    authFile.developmentMaxInputTokens === report.developmentMaxInputTokens,
    'LAUNCHER_BUDGET_MISMATCH_INPUT_TOKENS',
    'developmentMaxInputTokens does not match the plan budget',
  );
  assertCheck(
    authFile.developmentMaxOutputTokens === report.developmentMaxOutputTokens,
    'LAUNCHER_BUDGET_MISMATCH_OUTPUT_TOKENS',
    'developmentMaxOutputTokens does not match the plan budget',
  );
  assertCheck(
    authFile.developmentMaxTotalTokens === plan.budget.developmentMaxTokens,
    'LAUNCHER_BUDGET_MISMATCH_TOTAL_TOKENS',
    'developmentMaxTotalTokens does not match the plan budget',
  );
  assertCheck(
    authFile.developmentMaxCostUsd === plan.budget.developmentMaxCostUsd,
    'LAUNCHER_BUDGET_MISMATCH_COST',
    'developmentMaxCostUsd does not match the plan budget',
  );
  assertCheck(
    plan.budget.maxConcurrentRequests === 1 &&
      authFile.maxConcurrentRequests === plan.budget.maxConcurrentRequests,
    'LAUNCHER_MAX_CONCURRENCY_NOT_ONE',
    'maxConcurrentRequests must be exactly 1 and match the plan',
  );
  assertCheck(
    plan.retryCount === 0 && authFile.retryCount === plan.retryCount,
    'LAUNCHER_RETRY_COUNT_NOT_ZERO',
    'retryCount must be exactly 0 and match the plan',
  );
  assertCheck(
    authFile.authorizedPhase === 'development',
    'LAUNCHER_AUTHORIZED_PHASE_INVALID',
    'authorizedPhase must be exactly "development"',
  );
  assertCheck(
    authFile.holdoutAuthorized === false,
    'LAUNCHER_HOLDOUT_MUST_NOT_BE_AUTHORIZED',
    'holdoutAuthorized must be exactly false',
  );
  assertCheck(
    authFile.automaticContinuation === false,
    'LAUNCHER_AUTOMATIC_CONTINUATION_MUST_BE_FALSE',
    'automaticContinuation must be exactly false',
  );
}

export function validateConfirmationFlags(parsedArgs, plan) {
  assertCheck(
    parsedArgs.confirmDevelopmentOnly === true,
    'LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING',
    '--confirm-development-only is required',
  );
  const confirmedCost = Number(parsedArgs.confirmMaxCostUsd);
  assertCheck(
    Number.isFinite(confirmedCost) && confirmedCost === plan.budget.developmentMaxCostUsd,
    'LAUNCHER_CONFIRM_MAX_COST_MISMATCH',
    `--confirm-max-cost-usd ("${parsedArgs.confirmMaxCostUsd}") must exactly equal the plan's ` +
      `own developmentMaxCostUsd (${plan.budget.developmentMaxCostUsd})`,
  );
}

// ---------------------------------------------------------------------------------------------
// Actual-usage aggregation for the secret-free closing summary -- reads only the ledger entries
// the real Development dispatch produced (never re-derives cost/tokens independently).
// ---------------------------------------------------------------------------------------------

export function summarizeActualUsage(evidence) {
  let calls = 0;
  let inputTokens = 0;
  let outputTokens = 0;
  let costUsd = 0;
  for (const candidate of evidence.candidates) {
    for (const entry of candidate.ledger.content) {
      if (entry.usageStatus === 'reported') {
        calls += 1;
        inputTokens += entry.inputTokens ?? 0;
        outputTokens += entry.outputTokens ?? 0;
      }
      if (typeof entry.actualCostUsd === 'number') {
        costUsd += entry.actualCostUsd;
      }
    }
  }
  return { calls, inputTokens, outputTokens, totalTokens: inputTokens + outputTokens, costUsd };
}

// ---------------------------------------------------------------------------------------------
// --preflight
// ---------------------------------------------------------------------------------------------

export async function runPreflight({ repoRootForTests, authorizationTemplateOut } = {}) {
  if (!repoRootForTests) assertCwdIsRepoRoot();
  if (!isWorkingTreeClean(REAL_REPO_ROOT)) {
    throw new LauncherError(
      'LAUNCHER_WORKING_TREE_DIRTY: refusing --preflight with an uncommitted working tree.',
    );
  }
  const bridge = loadCompiledBridge(REAL_REPO_ROOT);
  const plan = bridge.buildProtocolV4MasterPlan(repoRootForTests);
  bridge.validateProtocolV4MasterPlan(plan, repoRootForTests);
  const commit = getCurrentCommit(REAL_REPO_ROOT);
  const report = buildPreflightReport(plan, commit, bridge);
  const template = buildAuthorizationTemplate(plan, commit, report);

  let authorizationTemplateWrittenTo = null;
  if (authorizationTemplateOut) {
    const resolved = assertAbsoluteAndOutsideRepoRoot(
      REAL_REPO_ROOT,
      authorizationTemplateOut,
      '--authorization-template-out',
    );
    fs.writeFileSync(resolved, `${JSON.stringify(template, null, 2)}\n`, 'utf-8');
    authorizationTemplateWrittenTo = resolved;
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
    throw new LauncherError('LAUNCHER_EXECUTE_WRONG_MODE: runExecute called without --execute');
  }
  if (!parsedArgs.authorizationFile) {
    throw new LauncherError(
      'LAUNCHER_EXECUTE_MISSING_AUTHORIZATION_FILE: --authorization-file is required',
    );
  }
  if (!parsedArgs.confirmDevelopmentOnly) {
    throw new LauncherError(
      'LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING: --confirm-development-only is required',
    );
  }
  if (!parsedArgs.confirmMaxCostUsd) {
    throw new LauncherError(
      'LAUNCHER_EXECUTE_MISSING_CONFIRM_MAX_COST: --confirm-max-cost-usd is required',
    );
  }

  // 1. Authorization file path shape: absolute, outside the repo, a regular file.
  const resolvedAuthPath = assertAbsoluteAndOutsideRepoRoot(
    REAL_REPO_ROOT,
    parsedArgs.authorizationFile,
    '--authorization-file',
  );
  if (!fs.existsSync(resolvedAuthPath)) {
    throw new LauncherError(`LAUNCHER_AUTHORIZATION_FILE_NOT_FOUND: ${resolvedAuthPath}`);
  }
  if (!fs.statSync(resolvedAuthPath).isFile()) {
    throw new LauncherError(`LAUNCHER_AUTHORIZATION_FILE_NOT_REGULAR_FILE: ${resolvedAuthPath}`);
  }

  // 2. Parse + structural validation.
  let authFile;
  try {
    authFile = JSON.parse(fs.readFileSync(resolvedAuthPath, 'utf-8'));
  } catch (e) {
    throw new LauncherError(`LAUNCHER_AUTHORIZATION_FILE_INVALID_JSON: ${e.message}`);
  }
  validateAuthorizationFileStructure(authFile);

  // 3. Working tree clean (the real repository, always).
  if (!isWorkingTreeClean(REAL_REPO_ROOT)) {
    throw new LauncherError(
      'LAUNCHER_WORKING_TREE_DIRTY: refusing --execute with an uncommitted working tree.',
    );
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

  // 8. Confirmation flags.
  validateConfirmationFlags(parsedArgs, plan);

  // 9. Credential presence -- only now, after every check above has passed. Presence-only: the
  // value is never read into a variable we print, log, or embed in any error message.
  const env = envForTests ?? process.env;
  if (!env.ANTHROPIC_API_KEY) {
    throw new LauncherError(
      'LAUNCHER_ANTHROPIC_API_KEY_MISSING: ANTHROPIC_API_KEY is not set. Refusing to proceed ' +
        'before any lease/live-root/dispatch side effect.',
    );
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

  // 11. The single allowed live call. No `repoRoot` is passed here in production
  // (`repoRootForTests` is `undefined` unless a test explicitly overrides it).
  let evidence = null;
  let dispatchError = null;
  try {
    evidence = await bridge.runProtocolV4LiveDevelopmentEntryPoint({
      authorization,
      env,
      repoRoot: repoRootForTests,
    });
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
    leaseStatus = `unreadable: ${e.message}`;
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

  const usage = evidence
    ? summarizeActualUsage(evidence)
    : { calls: 0, inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: 0 };

  const summary = {
    success: dispatchError === null,
    error: dispatchError ? { name: dispatchError.name, message: dispatchError.message } : null,
    actualProviderCalls: usage.calls,
    actualInputTokens: usage.inputTokens,
    actualOutputTokens: usage.outputTokens,
    actualTotalTokens: usage.totalTokens,
    actualCostUsd: usage.costUsd,
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
pricing, candidate identities, every Development budget number, concurrency, retry count,
Holdout-not-authorized, automatic-continuation-disabled) strictly before checking for
ANTHROPIC_API_KEY or causing any side effect, then calls the real
runProtocolV4LiveDevelopmentEntryPoint for Development only -- Holdout is never executed.
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
    console.error(`${err.name ?? 'Error'}: ${err.message ?? String(err)}`);
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
      console.error(`${err.name ?? 'Error'}: ${err.message ?? String(err)}`);
      process.exit(1);
    },
  );
}
