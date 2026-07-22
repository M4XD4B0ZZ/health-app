import * as fs from 'fs';
import * as path from 'path';
import { test } from '@jest/globals';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../RepresentativeHybridV1SourceSnapshotManifest';
import type { RepresentativeHybridV1ResolutionScenario } from '../RepresentativeHybridV1Types';
import { buildRepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';
import { createRepresentativeHybridV1LiveBudgetGate } from './RepresentativeHybridV1LiveBudget';
import { createLiveVariantBProvider } from '../../VariantBLiveProvider';
import { createLiveVariantCInterpreter } from '../../VariantCLiveInterpretationProvider';
import { createAnthropicBenchmarkTransport } from '../../AnthropicBenchmarkTransport';
import { TimeoutEnforcingAnthropicBenchmarkTransport } from './RepresentativeHybridV1LiveTimeout';
import {
  wrapVariantBProviderWithTelemetry,
  wrapVariantCInterpreterWithTelemetry,
} from './RepresentativeHybridV1LiveTelemetryProviders';
import { runRepresentativeHybridV1LivePartition } from './RepresentativeHybridV1LiveRunner';
import {
  buildRepresentativeHybridV1LiveReport,
  buildRepresentativeHybridV1LiveMarkdownReport,
} from './RepresentativeHybridV1LiveReportBuilder';
import { assertValidRepresentativeHybridV1LiveReport } from './RepresentativeHybridV1LiveReportValidator';
import { REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY } from './RepresentativeHybridV1LiveVersions';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';

/**
 * RESOLVER-V3-039 live execution entry point. Same `.harness.ts` convention as
 * `runRepresentativeHybridV1.harness.ts` (invisible to `jest.config.js`'s `testMatch`, executed
 * only via `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`). Reads configuration
 * from env vars, since Jest's CLI does not forward custom flags through a scoped test file.
 *
 * `REPRESENTATIVE_HYBRID_V1_LIVE_MODE`:
 *   'preflight' (default) -- builds the deterministic plan, reports readiness, makes NO provider
 *     request and NO credential-dependent throw.
 *   'execute' -- verifies protocol/corpus/hash/credential/budget, then runs the requested
 *     partition(s) for real. Missing `ANTHROPIC_API_KEY` fails closed here, before any request.
 */
test(
  'RESOLVER-V3-039 -- Controlled Representative Live Hybrid Evidence harness',
  async () => {
    const mode =
      process.env.REPRESENTATIVE_HYBRID_V1_LIVE_MODE === 'execute' ? 'execute' : 'preflight';
    const partitionArg = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PARTITION ?? 'development';
    const partitions: readonly RepresentativeHybridV1ResolutionScenario['partition'][] =
      partitionArg === 'holdout'
        ? ['holdout']
        : partitionArg === 'all'
          ? ['development', 'holdout']
          : ['development'];
    const finalEvaluation = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_FINAL_EVALUATION === 'true';
    const outputDir = path.resolve(__dirname, '../../../../../../logs');

    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();

    if (mode === 'preflight') {
      const apiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
      const summary = {
        mode: 'preflight',
        corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
        sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
        planHash: plan.planHash,
        counts: plan.counts,
        budget: plan.budget,
        apiKeyPresent,
        // Never the key value itself, only its presence -- secret-free by construction.
        readyForLiveExecution: apiKeyPresent,
      };
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(
        path.join(outputDir, 'resolver-v3-039-preflight.json'),
        JSON.stringify(summary, null, 2),
      );
      // eslint-disable-next-line no-console
      console.log(
        `RESOLVER-V3-039 preflight complete. planHash=${plan.planHash} ` +
          `maxCalls=${plan.budget.maxCalls} worstCaseReservedCostUsd=${plan.budget.worstCaseReservedCostUsd} ` +
          `apiKeyPresent=${apiKeyPresent}. No provider request made.`,
      );
      return;
    }

    // mode === 'execute'
    if ((partitionArg === 'holdout' || partitionArg === 'all') && !finalEvaluation) {
      throw new Error(
        `Refusing to run partition="${partitionArg}" without --final-evaluation (RESOLVER-V3-039 holdout discipline).`,
      );
    }

    const protocolPath = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_PATH;
    if (!protocolPath) {
      throw new Error('RESOLVER-V3-039 live execution requires --protocol=<protocol-json-path>.');
    }
    if (!fs.existsSync(protocolPath)) {
      throw new Error(`RESOLVER-V3-039 protocol file not found: ${protocolPath}`);
    }
    const protocol = JSON.parse(fs.readFileSync(protocolPath, 'utf-8')) as {
      planHash: string;
      corpusHash: string;
      sourceManifestHash: string;
    };
    if (protocol.planHash !== plan.planHash) {
      throw new Error(
        `RESOLVER-V3-039 plan hash mismatch: frozen protocol has "${protocol.planHash}", current computation has "${plan.planHash}". Refusing to execute.`,
      );
    }
    if (protocol.corpusHash !== REPRESENTATIVE_HYBRID_V1_CORPUS_HASH) {
      throw new Error(
        'RESOLVER-V3-039 corpus hash mismatch against frozen protocol. Refusing to execute.',
      );
    }
    if (protocol.sourceManifestHash !== REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH) {
      throw new Error(
        'RESOLVER-V3-039 source-manifest hash mismatch against frozen protocol. Refusing to execute.',
      );
    }

    const jsonReportPath = path.join(
      outputDir,
      'resolver-v3-039-controlled-representative-live-evidence.json',
    );
    if (
      fs.existsSync(jsonReportPath) &&
      process.env.REPRESENTATIVE_HYBRID_V1_LIVE_ALLOW_RERUN !== 'true'
    ) {
      throw new Error(
        `RESOLVER-V3-039 a report already exists at ${jsonReportPath}. Full-protocol rerun requires separate ` +
          'authorization (REPRESENTATIVE_HYBRID_V1_LIVE_ALLOW_RERUN=true), not exposed as a casual flag.',
      );
    }

    // Missing ANTHROPIC_API_KEY / missing budget gate throws here, before any network call --
    // createLiveVariantBProvider/createLiveVariantCInterpreter never fall back to a fixture.
    const budgetGate = await createRepresentativeHybridV1LiveBudgetGate();
    const timeoutTransport = new TimeoutEnforcingAnthropicBenchmarkTransport(
      createAnthropicBenchmarkTransport(),
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.perRequestTimeoutMs,
    );
    const liveB = createLiveVariantBProvider(process.env, budgetGate, timeoutTransport);
    const liveC = createLiveVariantCInterpreter(process.env, budgetGate, timeoutTransport);

    const rawTelemetry: LiveProviderUsageRecord[] = [];
    const wrappedB = wrapVariantBProviderWithTelemetry(
      liveB,
      rawTelemetry,
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.wallClockCeilingMs,
    );
    const wrappedC = wrapVariantCInterpreterWithTelemetry(
      liveC,
      rawTelemetry,
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.wallClockCeilingMs,
    );

    const { caseRecords } = await runRepresentativeHybridV1LivePartition(
      REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS as readonly RepresentativeHybridV1ResolutionScenario[],
      plan,
      partitions,
      { variantBProvider: wrappedB, variantCAiInterpreter: wrappedC },
    );

    const expectedBehaviorByScenarioId = new Map(
      (
        REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS as readonly RepresentativeHybridV1ResolutionScenario[]
      ).map((s) => [s.scenarioId, s.case.expectedBehavior]),
    );

    const report = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits: budgetGate.snapshot().limits,
      protocolFreezeCommit:
        process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_FREEZE_COMMIT ?? null,
      evidenceCommit: process.env.REPRESENTATIVE_HYBRID_V1_LIVE_EVIDENCE_COMMIT ?? null,
      executionStatus: {
        phase:
          partitionArg === 'development'
            ? 'development_complete'
            : 'development_and_holdout_complete',
        blockerReason: null,
      },
      rawTelemetry,
      developmentCaseRecords: partitions.includes('development') ? caseRecords : null,
      holdoutCaseRecords: partitions.includes('holdout') ? caseRecords : null,
      expectedBehaviorByScenarioId,
    });

    assertValidRepresentativeHybridV1LiveReport(report);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(jsonReportPath, JSON.stringify(report, null, 2));
    fs.writeFileSync(
      path.join(outputDir, 'resolver-v3-039-controlled-representative-live-evidence.md'),
      buildRepresentativeHybridV1LiveMarkdownReport(report),
    );

    // eslint-disable-next-line no-console
    console.log(
      `RESOLVER-V3-039 live execution complete (${partitionArg}). calls=${report.actualUsage.calls} ` +
        `estimatedCostUsd=${report.actualUsage.estimatedCostUsd ?? 'unknown'}`,
    );
  },
  20 * 60_000,
);
