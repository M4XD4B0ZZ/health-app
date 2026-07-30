import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import {
  REAL_REPO_ROOT,
  LauncherError,
  parseArgs,
  assertAbsoluteAndOutsideRepoRoot,
  assertExistingPathCanonicallyOutsideRepoRoot,
  assertNewFileParentCanonicallyOutsideRepoRoot,
  writeFileExclusive,
  assertLocalToolchainAvailable,
  isWorkingTreeClean,
  candidateIdentitiesMatch,
  buildPreflightReport,
  buildAuthorizationTemplate,
  canonicalDevelopmentMaxCostUsdString,
  validateAuthorizationFileStructure,
  validateAuthorizationAgainstRepositoryState,
  validateAuthorizationAgainstPlan,
  validateConfirmationFlags,
  summarizeActualUsage,
  summarizeSuccessUsage,
  summarizeFailureUsage,
  classifyLauncherError,
  loadCompiledBridge,
  runPreflight,
  runExecute,
  PROTOCOL_V4_PHASE_B1_POST_MERGE_REMEDIATION_COMMIT,
  LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION,
} from '../run-resolver-v3-048-live-development.mjs';

/**
 * RESOLVER-V3-048 Phase B3 -- focused, zero-network, USD-0 coverage for the canonical live
 * Development launcher (`scripts/run-resolver-v3-048-live-development.mjs`). Follows this
 * repository's existing convention for testing `.mjs` scripts (see
 * `scripts/automation/__tests__/claude-queue-preflight.test.mjs`) via Node's own built-in test
 * runner -- these tests are NOT picked up by `npm test` (Jest's `testMatch` is scoped to
 * `src/**` `.test.ts` files only) and are run separately via
 * `node --test scripts/__tests__/run-resolver-v3-048-live-development.test.mjs`.
 *
 * Most tests below exercise pure, exported validation functions with hand-built fixtures and never
 * touch git, the filesystem, or the real TypeScript build -- they are fast and do not require a
 * clean working tree. A small number of tests need the REAL compiled bridge (a real `tsc` build)
 * and/or a clean real working tree (this launcher's own fail-closed gate) -- these are grouped
 * under "real build" below and run once, sharing a single build via a `before()` hook.
 */

const bridgeFixture = {
  PROTOCOL_V4_PER_CALL_MAX_INPUT_TOKENS: 8192,
  PROTOCOL_V4_PER_CALL_MAX_OUTPUT_TOKENS: 1536,
};

function fixturePlan(overrides = {}) {
  const budgetOverrides = overrides.budget ?? {};
  return {
    planHash: 'fixture-plan-hash',
    developmentExecutionTreeHash: 'fixture-tree-hash',
    modelId: 'claude-haiku-4-5-20251001',
    pricing: { pricingVersion: 'anthropic-messages-2025-10-01-v1' },
    retryCount: 0,
    noCachePolicy: {
      promptCachingConfigured: false,
      positiveCacheTokensFailure: 'usage_cost_contract_error',
    },
    candidates: [
      {
        id: 'H0',
        version: 'h0-v1',
        promptVersion: 'prompt-v1',
        promptHash: 'prompt-hash-h0',
        schemaVersion: 'schema-v1',
        schemaHash: 'schema-hash-h0',
        routingVersion: 'R0',
      },
      {
        id: 'H1',
        version: 'h1-v1',
        promptVersion: 'prompt-v2',
        promptHash: 'prompt-hash-h1',
        schemaVersion: 'schema-v2',
        schemaHash: 'schema-hash-h1',
        routingVersion: 'R0',
      },
      {
        id: 'H2',
        version: 'h2-v1',
        promptVersion: 'prompt-v2',
        promptHash: 'prompt-hash-h1',
        schemaVersion: 'schema-v2',
        schemaHash: 'schema-hash-h1',
        routingVersion: 'R1-min-v1',
      },
    ],
    ...overrides,
    budget: {
      developmentCalls: 324,
      developmentMaxTokens: 3161088,
      developmentMaxCostUsd: 5.142528,
      maxConcurrentRequests: 1,
      currency: 'USD',
      ...budgetOverrides,
    },
  };
}

function validAuthFileFor(plan, commit) {
  const report = buildPreflightReport(plan, commit, bridgeFixture);
  const template = buildAuthorizationTemplate(plan, commit, report);
  return {
    ...template,
    authorizationTemplateOnly: false,
    humanApprovalReference: 'test-human-approval-reference-not-real',
  };
}

// -------------------------------------------------------------------------------------------
// parseArgs -- no mode / multiple modes rejected, unknown args rejected, value flags parsed.
// -------------------------------------------------------------------------------------------

describe('parseArgs', () => {
  test('rejects no mode', () => {
    const result = parseArgs([]);
    assert.equal(result.mode, null);
    assert.ok(result.errors.some((e) => e.includes('none given')));
  });

  test('rejects multiple modes', () => {
    const result = parseArgs(['--preflight', '--execute']);
    assert.equal(result.mode, null);
    assert.ok(result.errors.some((e) => e.includes('multiple given')));
  });

  test('accepts --preflight alone', () => {
    const result = parseArgs(['--preflight']);
    assert.equal(result.mode, 'preflight');
    assert.deepEqual(result.errors, []);
  });

  test('parses --execute with all required value flags', () => {
    const result = parseArgs([
      '--execute',
      '--authorization-file',
      '/outside/auth.json',
      '--confirm-development-only',
      '--confirm-max-cost-usd',
      '5.142528',
    ]);
    assert.equal(result.mode, 'execute');
    assert.equal(result.authorizationFile, '/outside/auth.json');
    assert.equal(result.confirmDevelopmentOnly, true);
    assert.equal(result.confirmMaxCostUsd, '5.142528');
    assert.deepEqual(result.errors, []);
  });

  test('rejects unknown arguments', () => {
    const result = parseArgs(['--preflight', '--not-a-real-flag']);
    assert.ok(result.errors.some((e) => e.includes('Unknown argument')));
  });

  test('rejects a value flag with no following value', () => {
    const result = parseArgs(['--execute', '--authorization-file']);
    assert.ok(result.errors.some((e) => e.includes('requires a value')));
  });
});

// -------------------------------------------------------------------------------------------
// Path safety: relative / inside-repo authorization paths are rejected.
// -------------------------------------------------------------------------------------------

describe('assertAbsoluteAndOutsideRepoRoot', () => {
  test('rejects a relative path', () => {
    assert.throws(
      () => assertAbsoluteAndOutsideRepoRoot(REAL_REPO_ROOT, 'relative/auth.json', '--x'),
      /LAUNCHER_PATH_NOT_ABSOLUTE/,
    );
  });

  test('rejects an absolute path inside the repository', () => {
    const inside = path.join(REAL_REPO_ROOT, 'scripts', 'auth.json');
    assert.throws(
      () => assertAbsoluteAndOutsideRepoRoot(REAL_REPO_ROOT, inside, '--x'),
      /LAUNCHER_PATH_INSIDE_REPO/,
    );
  });

  test('accepts an absolute path outside the repository', () => {
    const outside = path.join(os.tmpdir(), 'resolver-v3-048-auth-fixture.json');
    const resolved = assertAbsoluteAndOutsideRepoRoot(REAL_REPO_ROOT, outside, '--x');
    assert.equal(resolved, path.resolve(outside));
  });
});

// -------------------------------------------------------------------------------------------
// Defect 4: filesystem-canonical path safety -- realpath-based, Windows-case-correct,
// symlink/junction-aware outside-repo checks. Symlink/junction creation can require elevated
// privileges on some Windows configurations; those specific tests skip (not fail) when the
// environment refuses to create the link, since that is an environment limitation, not a defect.
// -------------------------------------------------------------------------------------------

describe('assertExistingPathCanonicallyOutsideRepoRoot / assertNewFileParentCanonicallyOutsideRepoRoot', () => {
  const tempDirs = [];
  function freshOutsideTempDir() {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-launcher-path-safety-'));
    tempDirs.push(dir);
    return dir;
  }
  after(() => {
    while (tempDirs.length) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  test(
    'the same Windows path with different case is still rejected as inside the repository',
    {
      skip: process.platform !== 'win32' ? 'case-insensitivity is only asserted on win32' : false,
    },
    () => {
      const insideDifferentCase = path.join(REAL_REPO_ROOT.toUpperCase(), 'SCRIPTS', 'AUTH.JSON');
      assert.throws(
        () => assertAbsoluteAndOutsideRepoRoot(REAL_REPO_ROOT, insideDifferentCase, '--x'),
        /LAUNCHER_PATH_INSIDE_REPO/,
      );
    },
  );

  test('a real external path (existing file) passes the canonical existing-path check', () => {
    const dir = freshOutsideTempDir();
    const filePath = path.join(dir, 'auth.json');
    fs.writeFileSync(filePath, '{}');
    const resolved = assertExistingPathCanonicallyOutsideRepoRoot(REAL_REPO_ROOT, filePath, '--x');
    assert.equal(fs.realpathSync(resolved), fs.realpathSync(filePath));
  });

  test('rejects a path that does not exist yet', () => {
    const dir = freshOutsideTempDir();
    const missing = path.join(dir, 'does-not-exist.json');
    assert.throws(
      () => assertExistingPathCanonicallyOutsideRepoRoot(REAL_REPO_ROOT, missing, '--x'),
      /LAUNCHER_PATH_NOT_FOUND/,
    );
  });

  test('an external symlink pointing at a file INSIDE the repository is rejected', () => {
    const dir = freshOutsideTempDir();
    const linkPath = path.join(dir, 'link-to-repo-file.json');
    const targetInRepo = path.join(REAL_REPO_ROOT, 'package.json');
    try {
      fs.symlinkSync(targetInRepo, linkPath, 'file');
    } catch (e) {
      // Creating a FILE symlink can require elevated privileges/Developer Mode on Windows -- an
      // environment limitation, not a defect in the launcher's own logic (already proven by the
      // directory-junction test below, which does not require elevation on Windows).
      return;
    }
    assert.throws(
      () => assertExistingPathCanonicallyOutsideRepoRoot(REAL_REPO_ROOT, linkPath, '--x'),
      /LAUNCHER_PATH_INSIDE_REPO/,
    );
  });

  test('a new-file parent directory that is itself a junction/symlink into the repository is rejected', () => {
    const dir = freshOutsideTempDir();
    const junctionPath = path.join(dir, 'junction-into-repo');
    try {
      fs.symlinkSync(
        REAL_REPO_ROOT,
        junctionPath,
        process.platform === 'win32' ? 'junction' : 'dir',
      );
    } catch (e) {
      return; // environment does not allow directory link creation here; not a logic defect.
    }
    const candidateInsideJunction = path.join(junctionPath, 'template-out.json');
    assert.throws(
      () =>
        assertNewFileParentCanonicallyOutsideRepoRoot(
          REAL_REPO_ROOT,
          candidateInsideJunction,
          '--authorization-template-out',
        ),
      /LAUNCHER_PATH_INSIDE_REPO/,
    );
  });

  test('a genuinely external new-file parent directory works', () => {
    const dir = freshOutsideTempDir();
    const candidate = path.join(dir, 'template-out.json');
    const finalPath = assertNewFileParentCanonicallyOutsideRepoRoot(
      REAL_REPO_ROOT,
      candidate,
      '--authorization-template-out',
    );
    assert.equal(path.basename(finalPath), 'template-out.json');
  });

  test('writeFileExclusive refuses to overwrite an existing file', () => {
    const dir = freshOutsideTempDir();
    const filePath = path.join(dir, 'existing.json');
    fs.writeFileSync(filePath, '{"first":true}');
    assert.throws(
      () => writeFileExclusive(filePath, '{"second":true}'),
      /LAUNCHER_TEMPLATE_OUTPUT_ALREADY_EXISTS/,
    );
    assert.equal(fs.readFileSync(filePath, 'utf-8'), '{"first":true}');
  });

  test('writeFileExclusive succeeds for a genuinely new file', () => {
    const dir = freshOutsideTempDir();
    const filePath = path.join(dir, 'new.json');
    writeFileExclusive(filePath, '{"ok":true}');
    assert.equal(fs.readFileSync(filePath, 'utf-8'), '{"ok":true}');
  });
});

// -------------------------------------------------------------------------------------------
// Authorization-file structural validation: template rejected, missing approval reference rejected.
// -------------------------------------------------------------------------------------------

describe('validateAuthorizationFileStructure', () => {
  const plan = fixturePlan();
  const report = buildPreflightReport(plan, 'deadbeef', bridgeFixture);
  const template = buildAuthorizationTemplate(plan, 'deadbeef', report);

  test('rejects the template itself (authorizationTemplateOnly: true)', () => {
    assert.throws(
      () => validateAuthorizationFileStructure(template),
      /LAUNCHER_AUTHORIZATION_FILE_IS_TEMPLATE_ONLY/,
    );
  });

  test('rejects a missing/empty humanApprovalReference', () => {
    const authFile = { ...template, authorizationTemplateOnly: false, humanApprovalReference: '' };
    assert.throws(
      () => validateAuthorizationFileStructure(authFile),
      /LAUNCHER_AUTHORIZATION_FILE_MISSING_HUMAN_APPROVAL_REFERENCE/,
    );
  });

  test('accepts a properly completed authorization file', () => {
    const authFile = {
      ...template,
      authorizationTemplateOnly: false,
      humanApprovalReference: 'ref-123',
    };
    assert.doesNotThrow(() => validateAuthorizationFileStructure(authFile));
  });

  // Defect 2: schema version must be exactly the current one -- missing/old/unknown all rejected.
  test('rejects a missing launcherAuthorizationFileSchemaVersion', () => {
    const authFile = {
      ...template,
      authorizationTemplateOnly: false,
      humanApprovalReference: 'ref-123',
      launcherAuthorizationFileSchemaVersion: undefined,
    };
    assert.throws(
      () => validateAuthorizationFileStructure(authFile),
      /LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION_MISMATCH/,
    );
  });

  test('rejects an old/unknown launcherAuthorizationFileSchemaVersion', () => {
    const authFile = {
      ...template,
      authorizationTemplateOnly: false,
      humanApprovalReference: 'ref-123',
      launcherAuthorizationFileSchemaVersion: 'resolver-v3-048-live-launcher-authorization-file-v0',
    };
    assert.throws(
      () => validateAuthorizationFileStructure(authFile),
      /LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION_MISMATCH/,
    );
  });

  test('the template itself already carries the current schema version', () => {
    assert.equal(
      template.launcherAuthorizationFileSchemaVersion,
      LAUNCHER_AUTHORIZATION_FILE_SCHEMA_VERSION,
    );
  });
});

// -------------------------------------------------------------------------------------------
// Repository-state checks: commit mismatch / PR #204 ancestry.
// -------------------------------------------------------------------------------------------

describe('validateAuthorizationAgainstRepositoryState', () => {
  test('rejects a commit mismatch', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstRepositoryState(
          { authorizedCommit: 'stale-commit-sha' },
          { headCommit: 'current-commit-sha', pr204IsAncestor: true },
        ),
      /LAUNCHER_HEAD_COMMIT_MISMATCH/,
    );
  });

  test('rejects when the PR #204 merge is not an ancestor', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstRepositoryState(
          { authorizedCommit: 'current-commit-sha' },
          { headCommit: 'current-commit-sha', pr204IsAncestor: false },
        ),
      /LAUNCHER_PR204_MERGE_NOT_ANCESTOR/,
    );
  });

  test('a PR #202-era authorization (stale commit) is rejected generically by the exact-HEAD check', () => {
    // The historical PR #202 authorization was issued against basis `e44cd5c...` -- any current or
    // future HEAD will never equal that commit again, so it is rejected by the same generic check
    // that rejects any stale commit, without needing a special case for that specific commit.
    assert.throws(
      () =>
        validateAuthorizationAgainstRepositoryState(
          { authorizedCommit: 'e44cd5c0000000000000000000000000000000' },
          { headCommit: 'current-head-sha', pr204IsAncestor: true },
        ),
      /LAUNCHER_HEAD_COMMIT_MISMATCH/,
    );
  });
});

// -------------------------------------------------------------------------------------------
// Authorization-vs-plan checks -- every field, one at a time; never touches process.env.
// -------------------------------------------------------------------------------------------

describe('validateAuthorizationAgainstPlan', () => {
  const plan = fixturePlan();
  const commit = 'deadbeef';
  const report = buildPreflightReport(plan, commit, bridgeFixture);

  function tamper(overrides) {
    return { ...validAuthFileFor(plan, commit), ...overrides };
  }

  test('accepts a matching authorization file', () => {
    assert.doesNotThrow(() =>
      validateAuthorizationAgainstPlan(validAuthFileFor(plan, commit), plan, report),
    );
  });

  test('rejects masterPlanHash mismatch', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ masterPlanHash: 'tampered' }), plan, report),
      /LAUNCHER_PLAN_HASH_MISMATCH/,
    );
  });

  test('rejects developmentExecutionTreeHash mismatch', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstPlan(
          tamper({ developmentExecutionTreeHash: 'tampered' }),
          plan,
          report,
        ),
      /LAUNCHER_EXECUTION_TREE_HASH_MISMATCH/,
    );
  });

  test('rejects modelId mismatch', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ modelId: 'some-other-model' }), plan, report),
      /LAUNCHER_MODEL_ID_MISMATCH/,
    );
  });

  test('rejects pricingVersion mismatch', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstPlan(
          tamper({ pricingVersion: 'drifted-pricing' }),
          plan,
          report,
        ),
      /LAUNCHER_PRICING_VERSION_MISMATCH/,
    );
  });

  test('rejects a candidate identity mismatch (tampered prompt hash)', () => {
    const authFile = validAuthFileFor(plan, commit);
    authFile.candidateIdentities = authFile.candidateIdentities.map((c) =>
      c.id === 'H0' ? { ...c, promptHash: 'tampered-prompt-hash' } : c,
    );
    assert.throws(
      () => validateAuthorizationAgainstPlan(authFile, plan, report),
      /LAUNCHER_CANDIDATE_IDENTITY_MISMATCH/,
    );
  });

  test('rejects a development-calls budget mismatch', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ developmentCalls: 1 }), plan, report),
      /LAUNCHER_BUDGET_MISMATCH_CALLS/,
    );
  });

  test('rejects a development-max-cost budget mismatch', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ developmentMaxCostUsd: 999 }), plan, report),
      /LAUNCHER_BUDGET_MISMATCH_COST/,
    );
  });

  test('rejects maxConcurrentRequests != 1', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ maxConcurrentRequests: 2 }), plan, report),
      /LAUNCHER_MAX_CONCURRENCY_NOT_ONE/,
    );
  });

  test('rejects retryCount != 0', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ retryCount: 1 }), plan, report),
      /LAUNCHER_RETRY_COUNT_NOT_ZERO/,
    );
  });

  test('rejects holdoutAuthorized: true', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ holdoutAuthorized: true }), plan, report),
      /LAUNCHER_HOLDOUT_MUST_NOT_BE_AUTHORIZED/,
    );
  });

  test('rejects automaticContinuation: true', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ automaticContinuation: true }), plan, report),
      /LAUNCHER_AUTOMATIC_CONTINUATION_MUST_BE_FALSE/,
    );
  });

  // Defect 2: currency and cache-policy fields must be bound exactly.
  test('rejects a different currency', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ currency: 'EUR' }), plan, report),
      /LAUNCHER_CURRENCY_MISMATCH/,
    );
  });

  test('rejects a changed noCachePolicy.promptCachingConfigured', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstPlan(
          tamper({ noCachePolicy: { ...plan.noCachePolicy, promptCachingConfigured: true } }),
          plan,
          report,
        ),
      /LAUNCHER_NO_CACHE_POLICY_MISMATCH/,
    );
  });

  test('rejects a changed noCachePolicy.positiveCacheTokensFailure', () => {
    assert.throws(
      () =>
        validateAuthorizationAgainstPlan(
          tamper({ noCachePolicy: { ...plan.noCachePolicy, positiveCacheTokensFailure: 'other' } }),
          plan,
          report,
        ),
      /LAUNCHER_NO_CACHE_POLICY_MISMATCH/,
    );
  });

  test('rejects a missing noCachePolicy', () => {
    assert.throws(
      () => validateAuthorizationAgainstPlan(tamper({ noCachePolicy: undefined }), plan, report),
      /LAUNCHER_NO_CACHE_POLICY_MISMATCH/,
    );
  });

  test('never reads process.env (pure function, source-level proof)', () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL('../run-resolver-v3-048-live-development.mjs', import.meta.url)),
      'utf-8',
    );
    const fnStart = source.indexOf('export function validateAuthorizationAgainstPlan');
    const fnEnd = source.indexOf('\n}\n', fnStart);
    const body = source.slice(fnStart, fnEnd);
    assert.equal(body.includes('process.env'), false);
  });
});

// -------------------------------------------------------------------------------------------
// Confirmation flags: missing flag / wrong cost value rejected.
// -------------------------------------------------------------------------------------------

describe('validateConfirmationFlags', () => {
  const plan = fixturePlan();

  test('accepts the exact matching cost value', () => {
    assert.doesNotThrow(() =>
      validateConfirmationFlags(
        { confirmDevelopmentOnly: true, confirmMaxCostUsd: '5.142528' },
        plan,
      ),
    );
  });

  test('rejects a missing --confirm-development-only', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: false, confirmMaxCostUsd: '5.142528' },
          plan,
        ),
      /LAUNCHER_CONFIRM_DEVELOPMENT_ONLY_MISSING/,
    );
  });

  test('rejects a wrong cost value', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: true, confirmMaxCostUsd: '9.999999' },
          plan,
        ),
      /LAUNCHER_CONFIRM_MAX_COST_MISMATCH/,
    );
  });

  // Defect 5: only the plan's own canonical decimal string is accepted -- no numerically
  // equivalent alternative spelling.
  test('rejects scientific notation even though numerically equal', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: true, confirmMaxCostUsd: '5.142528e0' },
          plan,
        ),
      /LAUNCHER_CONFIRM_MAX_COST_MISMATCH/,
    );
  });

  test('rejects surrounding whitespace', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: true, confirmMaxCostUsd: ' 5.142528 ' },
          plan,
        ),
      /LAUNCHER_CONFIRM_MAX_COST_MISMATCH/,
    );
  });

  test('rejects an extra trailing zero (numerically equal, not canonical)', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: true, confirmMaxCostUsd: '5.1425280' },
          plan,
        ),
      /LAUNCHER_CONFIRM_MAX_COST_MISMATCH/,
    );
  });

  test('rejects a leading plus sign', () => {
    assert.throws(
      () =>
        validateConfirmationFlags(
          { confirmDevelopmentOnly: true, confirmMaxCostUsd: '+5.142528' },
          plan,
        ),
      /LAUNCHER_CONFIRM_MAX_COST_MISMATCH/,
    );
  });

  test('canonicalDevelopmentMaxCostUsdString matches what --confirm-max-cost-usd must equal', () => {
    assert.equal(canonicalDevelopmentMaxCostUsdString(plan), '5.142528');
  });
});

// -------------------------------------------------------------------------------------------
// candidateIdentitiesMatch / summarizeActualUsage -- small pure-function unit checks.
// -------------------------------------------------------------------------------------------

describe('candidateIdentitiesMatch', () => {
  test('detects a missing candidate', () => {
    const expected = fixturePlan().candidates;
    assert.equal(candidateIdentitiesMatch(expected.slice(0, 2), expected), false);
  });

  test('accepts the correct candidates in a different order', () => {
    const expected = fixturePlan().candidates;
    const reordered = [expected[2], expected[0], expected[1]];
    assert.equal(candidateIdentitiesMatch(reordered, expected), true);
  });

  // Defect 3: exact set-and-identity comparison -- duplicates, missing, and unknown IDs rejected.
  test('rejects H0 duplicated three times (H0, H0, H0)', () => {
    const expected = fixturePlan().candidates;
    const h0 = expected.find((c) => c.id === 'H0');
    assert.equal(candidateIdentitiesMatch([h0, h0, h0], expected), false);
  });

  test('rejects a missing H1 (H0, H2, H2 -- H2 duplicated to keep the same length)', () => {
    const expected = fixturePlan().candidates;
    const h0 = expected.find((c) => c.id === 'H0');
    const h2 = expected.find((c) => c.id === 'H2');
    assert.equal(candidateIdentitiesMatch([h0, h2, h2], expected), false);
  });

  test('rejects H2 duplicated (extra entry, wrong length)', () => {
    const expected = fixturePlan().candidates;
    const h2 = expected.find((c) => c.id === 'H2');
    assert.equal(candidateIdentitiesMatch([...expected, h2], expected), false);
  });

  test('rejects an unknown candidate ID', () => {
    const expected = fixturePlan().candidates;
    const h0 = expected.find((c) => c.id === 'H0');
    const h1 = expected.find((c) => c.id === 'H1');
    const unknown = { ...expected[2], id: 'H9' };
    assert.equal(candidateIdentitiesMatch([h0, h1, unknown], expected), false);
  });

  test('rejects a tampered field on an otherwise-correct candidate', () => {
    const expected = fixturePlan().candidates;
    const tampered = expected.map((c) => (c.id === 'H1' ? { ...c, promptHash: 'tampered' } : c));
    assert.equal(candidateIdentitiesMatch(tampered, expected), false);
  });
});

describe('summarizeActualUsage', () => {
  test('aggregates calls/tokens/cost only from reported ledger entries', () => {
    const evidence = {
      candidates: [
        {
          ledger: {
            content: [
              { usageStatus: 'reported', inputTokens: 100, outputTokens: 20, actualCostUsd: 0.01 },
              {
                usageStatus: 'not_applicable',
                inputTokens: null,
                outputTokens: null,
                actualCostUsd: null,
              },
            ],
          },
        },
      ],
    };
    const usage = summarizeActualUsage(evidence);
    assert.equal(usage.calls, 1);
    assert.equal(usage.inputTokens, 100);
    assert.equal(usage.outputTokens, 20);
    assert.equal(usage.totalTokens, 120);
    assert.equal(usage.costUsd, 0.01);
  });
});

// -------------------------------------------------------------------------------------------
// Defect 1 (launcher level): a failed run never fabricates zero usage. `summarizeFailureUsage`
// only ever reads the authoritative `protocolV4FailureUsageSnapshot` the Protocol-v4 Development
// Runner attaches to a `human_live` failure -- these tests fabricate that snapshot shape directly
// (the real, end-to-end proof that the Runner actually attaches it correctly lives in
// `src/features/nutrition/benchmark/protocolV4/__tests__/ResolverV3048ProtocolV4FailureUsageSnapshot.test.ts`).
// -------------------------------------------------------------------------------------------

describe('summarizeFailureUsage', () => {
  test('an error with no snapshot (failure strictly before any dispatch was possible) reports exact 0 calls', () => {
    const usage = summarizeFailureUsage(new Error('plain error, no snapshot attached'));
    assert.equal(usage.accounting, 'exact');
    assert.equal(usage.calls, 0);
    assert.equal(usage.costUsd, 0);
    assert.equal(usage.reservedCostUsdUpperBound, null);
  });

  test('an "exact_zero" snapshot reports exact 0 calls', () => {
    const error = new Error('boom');
    error.protocolV4FailureUsageSnapshot = {
      accounting: 'exact_zero',
      completedCandidateIds: [],
      providerCallsAtLeast: 0,
      reservedInputTokensUpperBound: 0,
      reservedOutputTokensUpperBound: 0,
      reservedCostUsdUpperBound: 0,
      confirmedInputTokens: 0,
      confirmedOutputTokens: 0,
      confirmedCostUsd: 0,
    };
    const usage = summarizeFailureUsage(error);
    assert.equal(usage.accounting, 'exact');
    assert.equal(usage.calls, 0);
  });

  test('a "partial" snapshot after dispatch(es) never reports 0 calls, and exposes safe upper bounds', () => {
    const error = new Error('boom-mid-run');
    error.protocolV4FailureUsageSnapshot = {
      accounting: 'partial',
      completedCandidateIds: ['H0'],
      providerCallsAtLeast: 4,
      reservedInputTokensUpperBound: 32768,
      reservedOutputTokensUpperBound: 6144,
      reservedCostUsdUpperBound: 0.0635,
      confirmedInputTokens: 500,
      confirmedOutputTokens: 90,
      confirmedCostUsd: 0.0009,
    };
    const usage = summarizeFailureUsage(error);
    assert.equal(usage.accounting, 'partial');
    assert.notEqual(usage.calls, 0);
    assert.equal(usage.calls, 4);
    assert.equal(usage.inputTokens, 500);
    assert.equal(usage.costUsd, 0.0009);
    assert.equal(usage.reservedCostUsdUpperBound, 0.0635);
    assert.deepEqual(usage.completedCandidateIds, ['H0']);
  });
});

describe('summarizeSuccessUsage', () => {
  test('reports exact accounting with no upper bounds, and every candidate as completed', () => {
    const evidence = {
      candidates: [
        { candidateId: 'H0', ledger: { content: [] } },
        { candidateId: 'H1', ledger: { content: [] } },
        { candidateId: 'H2', ledger: { content: [] } },
      ],
    };
    const usage = summarizeSuccessUsage(evidence);
    assert.equal(usage.accounting, 'exact');
    assert.equal(usage.reservedCostUsdUpperBound, null);
    assert.deepEqual(usage.completedCandidateIds, ['H0', 'H1', 'H2']);
  });
});

// -------------------------------------------------------------------------------------------
// Secret-free error reporting: only an allowlisted domain error class's `.message` is ever
// surfaced; anything else is reported by stable class/code only.
// -------------------------------------------------------------------------------------------

describe('classifyLauncherError', () => {
  test('surfaces the message of an allowlisted LauncherError', () => {
    const result = classifyLauncherError(new LauncherError('LAUNCHER_SOME_CODE: detail'));
    assert.equal(result.class, 'LauncherError');
    assert.equal(result.code, 'LAUNCHER_SOME_CODE: detail');
  });

  test('surfaces the message of an allowlisted Protocol-v4 domain error by name', () => {
    class ProtocolV4ExecutionLeaseError extends Error {
      constructor(message) {
        super(message);
        this.name = 'ProtocolV4ExecutionLeaseError';
      }
    }
    const result = classifyLauncherError(
      new ProtocolV4ExecutionLeaseError('PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND:x'),
    );
    assert.equal(result.class, 'ProtocolV4ExecutionLeaseError');
    assert.equal(result.code, 'PROTOCOL_V4_EXECUTION_LEASE_NOT_FOUND:x');
  });

  test('never surfaces the message of an unrecognized error class -- only its stable class/code', () => {
    const foreign = new TypeError('some arbitrary internal detail that must never be echoed');
    const result = classifyLauncherError(foreign);
    assert.equal(result.class, 'unknown');
    assert.equal(result.code, 'TypeError');
    assert.equal(JSON.stringify(result).includes('arbitrary internal detail'), false);
  });

  test('handles a non-object thrown value without crashing', () => {
    const result = classifyLauncherError('a bare string throw');
    assert.equal(result.class, 'unknown');
    assert.equal(result.code, 'UnknownError');
  });
});

// -------------------------------------------------------------------------------------------
// Dirty working tree rejected -- exercised against a disposable throwaway git repo, never the
// real repository (so this test does not require the real tree to be clean).
// -------------------------------------------------------------------------------------------

describe('isWorkingTreeClean', () => {
  let tmpRepo;

  before(() => {
    tmpRepo = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-launcher-git-'));
    spawnSync('git', ['init', '--quiet'], { cwd: tmpRepo });
  });

  after(() => {
    fs.rmSync(tmpRepo, { recursive: true, force: true });
  });

  test('an empty freshly-initialized repo is clean', () => {
    assert.equal(isWorkingTreeClean(tmpRepo), true);
  });

  test('an untracked file makes the repo dirty', () => {
    fs.writeFileSync(path.join(tmpRepo, 'untracked.txt'), 'dirty');
    assert.equal(isWorkingTreeClean(tmpRepo), false);
    fs.rmSync(path.join(tmpRepo, 'untracked.txt'));
  });
});

// -------------------------------------------------------------------------------------------
// Missing local toolchain never triggers an automatic install.
// -------------------------------------------------------------------------------------------

describe('assertLocalToolchainAvailable', () => {
  test('rejects a directory with no node_modules, without spawning anything', () => {
    const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-no-node-modules-'));
    try {
      assert.throws(() => assertLocalToolchainAvailable(tmpDir), /LAUNCHER_NODE_MODULES_MISSING/);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('rejects a node_modules with no local typescript compiler', () => {
    const tmpDir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-no-tsc-'));
    fs.mkdirSync(path.join(tmpDir, 'node_modules'));
    try {
      assert.throws(
        () => assertLocalToolchainAvailable(tmpDir),
        /LAUNCHER_LOCAL_TYPESCRIPT_MISSING/,
      );
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  test('the launcher source never invokes npm/npx/install as an actual command', () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL('../run-resolver-v3-048-live-development.mjs', import.meta.url)),
      'utf-8',
    );
    // Checks for actual invocation string literals (e.g. spawnSync('npm', ...)), not the prose in
    // this file's own header comment that documents the constraint using these words/backticks.
    assert.equal(/['"](npm|npx|ts-node|tsx)['"]/.test(source), false);
    assert.equal(/spawnSync\(\s*['"]npm/.test(source), false);
  });
});

// -------------------------------------------------------------------------------------------
// Real-build tests: a single shared `tsc` compile for the whole block, run against the REAL
// repository. `runPreflight`/`runExecute`'s own working-tree-clean gate means the true end-to-end
// tests here only pass once every Phase B3 file (including this one) is committed -- this is the
// launcher's own fail-closed contract being exercised honestly, not a test-harness quirk.
// -------------------------------------------------------------------------------------------

describe('real build -- launcher bridge compiles and exposes no Holdout function', () => {
  let bridge;

  before(() => {
    bridge = loadCompiledBridge(REAL_REPO_ROOT);
  });

  test('the compiled bridge exports nothing whose name contains "Holdout"', () => {
    const holdoutLike = Object.keys(bridge).filter((k) => /holdout/i.test(k));
    assert.deepEqual(holdoutLike, []);
  });

  test('the launcher source imports no Holdout-named module', () => {
    const source = fs.readFileSync(
      fileURLToPath(new URL('../run-resolver-v3-048-live-development.mjs', import.meta.url)),
      'utf-8',
    );
    const bridgeSource = fs.readFileSync(
      fileURLToPath(new URL('../resolver-v3-048-live-launcher/launcherBridge.ts', import.meta.url)),
      'utf-8',
    );
    for (const line of [...source.split('\n'), ...bridgeSource.split('\n')]) {
      const trimmed = line.trim();
      if (trimmed.startsWith('import') || trimmed.startsWith('export {')) {
        assert.equal(/holdout/i.test(trimmed) && trimmed.includes("from '"), false, trimmed);
      }
    }
  });

  test('the real plan can be built and validated through the compiled bridge', () => {
    const plan = bridge.buildProtocolV4MasterPlan();
    assert.doesNotThrow(() => bridge.validateProtocolV4MasterPlan(plan));
    assert.equal(typeof plan.planHash, 'string');
    assert.ok(plan.planHash.length > 0);
  });

  test('build output directory is deterministic and gitignored', () => {
    const buildDir = path.join(REAL_REPO_ROOT, 'build', 'resolver-v3-048-live-launcher');
    assert.ok(fs.existsSync(buildDir));
    const statusResult = spawnSync('git', ['status', '--porcelain', '--', 'build/'], {
      cwd: REAL_REPO_ROOT,
      encoding: 'utf-8',
    });
    assert.equal(statusResult.stdout.trim(), '');
    const checkIgnore = spawnSync('git', ['check-ignore', '-q', buildDir], {
      cwd: REAL_REPO_ROOT,
    });
    assert.equal(checkIgnore.status, 0);
  });
});

describe('real build -- CLI end-to-end (requires a clean working tree)', () => {
  test('--preflight succeeds without ANTHROPIC_API_KEY, computes real plan hashes, and creates no live-root/lease/artifact', async () => {
    const result = await runPreflight({});
    assert.equal(typeof result.preflightReport.masterPlanHash, 'string');
    assert.ok(result.preflightReport.masterPlanHash.length > 0);
    assert.equal(result.authorizationTemplate.authorizationTemplateOnly, true);
    assert.equal(result.authorizationTemplate.holdoutAuthorized, false);
    assert.equal(result.authorizationTemplate.automaticContinuation, false);
    assert.equal(result.authorizationTemplate.humanApprovalReference, '');

    const realLiveRoot = path.join(REAL_REPO_ROOT, 'logs', 'resolver-v3-048-protocol-v4');
    assert.equal(fs.existsSync(realLiveRoot), false);
  });

  test('--preflight can write a non-authorizing template to an explicit external path', async () => {
    const outPath = path.join(
      fs.realpathSync(os.tmpdir()),
      `p4-launcher-template-${Date.now()}.json`,
    );
    try {
      const result = await runPreflight({ authorizationTemplateOut: outPath });
      assert.equal(result.authorizationTemplateWrittenTo, outPath);
      const written = JSON.parse(fs.readFileSync(outPath, 'utf-8'));
      assert.equal(written.authorizationTemplateOnly, true);
    } finally {
      fs.rmSync(outPath, { force: true });
    }
  });
});

describe('real build -- --execute guard rails (isolated repoRoot, never the real live root)', () => {
  let bridge;
  const tempDirs = [];

  before(() => {
    bridge = loadCompiledBridge(REAL_REPO_ROOT);
  });

  after(() => {
    while (tempDirs.length) {
      fs.rmSync(tempDirs.pop(), { recursive: true, force: true });
    }
  });

  function freshTempRepoRootWithRealEvaluatorFiles() {
    const dir = fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()), 'p4-launcher-exec-'));
    for (const relativePath of bridge.PROTOCOL_V4_EVALUATOR_MANIFEST_PATHS) {
      const src = path.resolve(REAL_REPO_ROOT, relativePath);
      const dest = path.resolve(dir, relativePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.copyFileSync(src, dest);
    }
    tempDirs.push(dir);
    return dir;
  }

  function writeAuthFile(dir, plan, commit, overrides = {}) {
    const authFile = { ...validAuthFileFor(plan, commit), ...overrides };
    const authPath = path.join(dir, 'authorization.json');
    fs.writeFileSync(authPath, JSON.stringify(authFile, null, 2));
    return authPath;
  }

  test('missing ANTHROPIC_API_KEY stops before any lease/live-root/artifact side effect', async () => {
    const isolatedRepoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const plan = bridge.buildProtocolV4MasterPlan(isolatedRepoRoot);
    const headCommit = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: REAL_REPO_ROOT,
      encoding: 'utf-8',
    }).stdout.trim();
    const authPath = writeAuthFile(isolatedRepoRoot, plan, headCommit);

    const parsedArgs = {
      mode: 'execute',
      authorizationFile: authPath,
      confirmDevelopmentOnly: true,
      confirmMaxCostUsd: String(plan.budget.developmentMaxCostUsd),
    };

    const result = await runExecute(parsedArgs, {
      repoRootForTests: isolatedRepoRoot,
      envForTests: {},
    }).catch((e) => e);
    assert.ok(result instanceof LauncherError);
    assert.match(result.message, /LAUNCHER_ANTHROPIC_API_KEY_MISSING/);

    const isolatedLiveRoot = path.join(isolatedRepoRoot, 'logs', 'resolver-v3-048-protocol-v4');
    assert.equal(fs.existsSync(isolatedLiveRoot), false);
    const realLiveRoot = path.join(REAL_REPO_ROOT, 'logs', 'resolver-v3-048-protocol-v4');
    assert.equal(fs.existsSync(realLiveRoot), false);
  });

  test('a relative --authorization-file is rejected before any git/plan check', async () => {
    const parsedArgs = {
      mode: 'execute',
      authorizationFile: 'relative/auth.json',
      confirmDevelopmentOnly: true,
      confirmMaxCostUsd: '5.142528',
    };
    const result = await runExecute(parsedArgs, {}).catch((e) => e);
    assert.ok(result instanceof LauncherError);
    assert.match(result.message, /LAUNCHER_PATH_NOT_ABSOLUTE/);
  });

  test('an authorization file inside the repository is rejected', async () => {
    const insidePath = path.join(REAL_REPO_ROOT, 'scripts', 'not-allowed-auth.json');
    const parsedArgs = {
      mode: 'execute',
      authorizationFile: insidePath,
      confirmDevelopmentOnly: true,
      confirmMaxCostUsd: '5.142528',
    };
    const result = await runExecute(parsedArgs, {}).catch((e) => e);
    assert.ok(result instanceof LauncherError);
    assert.match(result.message, /LAUNCHER_PATH_INSIDE_REPO/);
  });

  test('a template file passed as --authorization-file is rejected in execute mode', async () => {
    const isolatedRepoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const plan = bridge.buildProtocolV4MasterPlan(isolatedRepoRoot);
    const report = buildPreflightReport(plan, 'deadbeef', bridge);
    const template = buildAuthorizationTemplate(plan, 'deadbeef', report);
    const authPath = path.join(isolatedRepoRoot, 'template.json');
    fs.writeFileSync(authPath, JSON.stringify(template, null, 2));

    const parsedArgs = {
      mode: 'execute',
      authorizationFile: authPath,
      confirmDevelopmentOnly: true,
      confirmMaxCostUsd: String(plan.budget.developmentMaxCostUsd),
    };
    const result = await runExecute(parsedArgs, { repoRootForTests: isolatedRepoRoot }).catch(
      (e) => e,
    );
    assert.ok(result instanceof LauncherError);
    assert.match(result.message, /LAUNCHER_AUTHORIZATION_FILE_IS_TEMPLATE_ONLY/);
  });

  test('the full success path: mocked global.fetch reaches the real entry point, zero real network, no file under the real live root, Holdout not executed', async () => {
    const isolatedRepoRoot = freshTempRepoRootWithRealEvaluatorFiles();
    const plan = bridge.buildProtocolV4MasterPlan(isolatedRepoRoot);
    const headCommit = spawnSync('git', ['rev-parse', 'HEAD'], {
      cwd: REAL_REPO_ROOT,
      encoding: 'utf-8',
    }).stdout.trim();
    const authPath = writeAuthFile(isolatedRepoRoot, plan, headCommit);

    const parsedArgs = {
      mode: 'execute',
      authorizationFile: authPath,
      confirmDevelopmentOnly: true,
      confirmMaxCostUsd: String(plan.budget.developmentMaxCostUsd),
    };

    let fetchCallCount = 0;
    const originalFetch = global.fetch;
    global.fetch = async () => {
      fetchCallCount += 1;
      return new Response(
        JSON.stringify({
          id: 'msg_fixture',
          type: 'message',
          role: 'assistant',
          model: 'claude-haiku-4-5-20251001',
          content: [
            { type: 'text', text: JSON.stringify({ outcome: 'not_interpretable', reason: 'x' }) },
          ],
          stop_reason: 'end_turn',
          usage: { input_tokens: 10, output_tokens: 5 },
        }),
        { status: 200 },
      );
    };

    let outcome;
    try {
      outcome = await runExecute(parsedArgs, {
        repoRootForTests: isolatedRepoRoot,
        envForTests: { ANTHROPIC_API_KEY: 'test-key-not-real' },
      });
    } finally {
      global.fetch = originalFetch;
    }

    assert.equal(outcome.success, true);
    assert.ok(fetchCallCount > 0, 'expected the mocked fetch to have been called at least once');
    assert.equal(outcome.summary.holdoutExecuted, false);
    assert.equal(outcome.summary.note, 'Holdout was not executed');
    assert.equal(outcome.summary.leaseStatus, 'terminal_success');
    assert.equal(outcome.summary.authorizationConsumed, true);
    assert.equal(typeof outcome.summary.developmentEvidenceRoot, 'string');
    assert.equal(outcome.summary.usageAccounting, 'exact');
    assert.equal(outcome.summary.reservedCostUsdUpperBound, null);

    const realLiveRoot = path.join(REAL_REPO_ROOT, 'logs', 'resolver-v3-048-protocol-v4');
    assert.equal(fs.existsSync(realLiveRoot), false);
    const isolatedLiveRoot = path.join(isolatedRepoRoot, 'logs', 'resolver-v3-048-protocol-v4');
    assert.ok(fs.existsSync(isolatedLiveRoot));
  });
});
