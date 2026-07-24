import * as fs from 'fs';
import * as path from 'path';
import { createHash } from 'node:crypto';
import { test } from '@jest/globals';
import { REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_CORPUS_HASH } from '../RepresentativeHybridV1Manifest';
import { REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH } from '../RepresentativeHybridV1SourceSnapshotManifest';
import type { RepresentativeHybridV1ResolutionScenario } from '../RepresentativeHybridV1Types';
import { buildRepresentativeHybridV1LiveExecutionPlan } from './RepresentativeHybridV1LiveExecutionPlan';
import { buildRepresentativeHybridV1LiveBudgetLimits } from './RepresentativeHybridV1LiveBudget';
import { createLiveVariantBProvider } from '../../VariantBLiveProvider';
import { createLiveVariantCInterpreter } from '../../VariantCLiveInterpretationProvider';
import { createAnthropicBenchmarkTransport } from '../../AnthropicBenchmarkTransport';
import { TimeoutEnforcingAnthropicBenchmarkTransport } from './RepresentativeHybridV1LiveTimeout';
import {
  wrapVariantBProviderWithTelemetry,
  wrapVariantCInterpreterWithTelemetry,
} from './RepresentativeHybridV1LiveTelemetryProviders';
import {
  wrapVariantBProviderWithLedger,
  wrapVariantCInterpreterWithLedger,
} from './RepresentativeHybridV1LiveLedgerProviders';
import { runRepresentativeHybridV1LivePartition } from './RepresentativeHybridV1LiveRunner';
import {
  buildRepresentativeHybridV1LiveReport,
  buildRepresentativeHybridV1LiveMarkdownReport,
} from './RepresentativeHybridV1LiveReportBuilder';
import { assertValidRepresentativeHybridV1LiveReport } from './RepresentativeHybridV1LiveReportValidator';
import {
  REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY,
  REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
  REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
  REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2,
  REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
  REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
} from './RepresentativeHybridV1LiveVersions';
import { verifyRepresentativeHybridV1LiveProtocolV3 } from './RepresentativeHybridV1LiveProtocolVerification';
import type { LiveProviderUsageRecord } from '../../LiveProviderUsage';
import {
  computeRepresentativeHybridV1LivePlannedCallIds,
  orderRepresentativeHybridV1LiveObservationsForExecution,
} from './RepresentativeHybridV1LiveCallId';
import { RepresentativeHybridV1LiveCallLedger } from './RepresentativeHybridV1LiveCallLedger';
import { reconstructRepresentativeHybridV1LiveCumulativeBudgetGate } from './RepresentativeHybridV1LiveCumulativeBudget';
import { computeCurrentRepresentativeHybridV1LiveExecutionTreeHash } from './RepresentativeHybridV1LiveExecutionTreeHash';
import {
  readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint,
  readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent,
  writeRepresentativeHybridV1LiveDevelopmentCheckpoint,
  writeRepresentativeHybridV1LiveHoldoutCheckpoint,
  type RepresentativeHybridV1LiveExpectedContinuationContext,
} from './RepresentativeHybridV1LiveCheckpoint';

/**
 * RESOLVER-V3-039 protocol-v3 live execution entry point. Protocol v2's two-phase
 * Development/Holdout orchestration (Phase-B continuation remediation, see
 * `reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md`) is unchanged; this v3 revision
 * fixes a *different*, separately discovered defect -- v2's frozen `executionTreeHash` literal was
 * not reproducible from either a canonical LF Git-content computation or this environment's Windows
 * CRLF working-tree computation, because the v2 hash implementation had no line-ending
 * normalization at all (see `reports/RESOLVER_V3_039_EXECUTION_TREE_HASH_REMEDIATION.md`). Zero
 * paid calls occurred under protocol v2. Same `.harness.ts` convention as
 * `runRepresentativeHybridV1.harness.ts` (invisible to `jest.config.js`'s `testMatch`, executed only
 * via `scripts/benchmark-resolver-v3-representative-hybrid-live.mjs`). Reads configuration from env
 * vars, since Jest's CLI does not forward custom flags through a scoped test file.
 *
 * Two-phase discipline, enforced here (not procedurally): Development writes a durable checkpoint;
 * Holdout requires and validates it, reconstructs the cumulative task-wide budget from the durable
 * call ledger (shared across both phases and both process invocations), and produces one final
 * report containing both partitions. `--partition=all` and `--allow-rerun` do not exist in this
 * protocol version -- the CLI refuses them before this harness is ever spawned.
 */

const repoRoot = path.resolve(__dirname, '../../../../../..');
const outputDir = path.join(repoRoot, 'logs');
const LEDGER_PATH = path.join(outputDir, 'resolver-v3-039-call-ledger.jsonl');
const DEVELOPMENT_CHECKPOINT_PATH = path.join(
  outputDir,
  'resolver-v3-039-development-checkpoint.json',
);
const HOLDOUT_CHECKPOINT_PATH = path.join(outputDir, 'resolver-v3-039-holdout-checkpoint.json');
const DEVELOPMENT_DIAGNOSTIC_JSON_PATH = path.join(
  outputDir,
  'resolver-v3-039-development-diagnostic.json',
);
const DEVELOPMENT_DIAGNOSTIC_MD_PATH = path.join(
  outputDir,
  'resolver-v3-039-development-diagnostic.md',
);
const FINAL_REPORT_JSON_PATH = path.join(
  outputDir,
  'resolver-v3-039-controlled-representative-live-evidence.json',
);
const FINAL_REPORT_MD_PATH = path.join(
  outputDir,
  'resolver-v3-039-controlled-representative-live-evidence.md',
);

function sha256(text: string): string {
  return createHash('sha256').update(text).digest('hex');
}

interface ParsedProtocolV3 {
  protocolVersion: string;
  planHash: string;
  corpusHash: string;
  sourceManifestHash: string;
  executionTreeHash: string;
  provider: { providerId: string; modelId: string; modelSnapshotId: string };
  pricing: { currency: string; inputPerMillion: number; outputPerMillion: number };
}

function readProtocolV3(protocolPath: string): {
  raw: string;
  protocolHash: string;
  protocol: ParsedProtocolV3;
} {
  if (!fs.existsSync(protocolPath)) {
    throw new Error(`RESOLVER-V3-039 protocol file not found: ${protocolPath}`);
  }
  const raw = fs.readFileSync(protocolPath, 'utf-8');
  const protocol = JSON.parse(raw) as ParsedProtocolV3;
  return { raw, protocolHash: sha256(raw), protocol };
}

test(
  'RESOLVER-V3-039 -- Controlled Representative Live Hybrid Evidence harness (protocol v3)',
  async () => {
    const mode =
      process.env.REPRESENTATIVE_HYBRID_V1_LIVE_MODE === 'execute' ? 'execute' : 'preflight';
    const partitionArg = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PARTITION ?? 'development';
    if (partitionArg !== 'development' && partitionArg !== 'holdout') {
      throw new Error(
        `RESOLVER-V3-039 protocol v3 only accepts partition="development" or "holdout" -- "all" is refused (it would skip the required Development-inspection boundary).`,
      );
    }
    const partition = partitionArg as RepresentativeHybridV1ResolutionScenario['partition'];
    const finalEvaluation = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_FINAL_EVALUATION === 'true';

    const plan = await buildRepresentativeHybridV1LiveExecutionPlan();

    if (mode === 'preflight') {
      const apiKeyPresent = Boolean(process.env.ANTHROPIC_API_KEY);
      const executionTreeHash = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
      const summary = {
        mode: 'preflight',
        protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
        corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
        sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
        planHash: plan.planHash,
        executionTreeHash,
        counts: plan.counts,
        budget: plan.budget,
        apiKeyPresent,
        // Never the key value itself, only its presence -- secret-free by construction.
        readyForLiveExecution: apiKeyPresent,
        developmentCheckpointExists: fs.existsSync(DEVELOPMENT_CHECKPOINT_PATH),
        holdoutCheckpointExists: fs.existsSync(HOLDOUT_CHECKPOINT_PATH),
        callLedgerExists: fs.existsSync(LEDGER_PATH),
        finalReportExists: fs.existsSync(FINAL_REPORT_JSON_PATH),
      };
      fs.mkdirSync(outputDir, { recursive: true });
      fs.writeFileSync(
        path.join(outputDir, 'resolver-v3-039-preflight.json'),
        JSON.stringify(summary, null, 2),
      );
      // eslint-disable-next-line no-console
      console.log(
        `RESOLVER-V3-039 preflight complete. planHash=${plan.planHash} executionTreeHash=${executionTreeHash} ` +
          `maxCalls=${plan.budget.maxCalls} worstCaseReservedCostUsd=${plan.budget.worstCaseReservedCostUsd} ` +
          `apiKeyPresent=${apiKeyPresent}. No provider request made.`,
      );
      return;
    }

    // mode === 'execute'
    if (partition === 'holdout' && !finalEvaluation) {
      throw new Error(
        'RESOLVER-V3-039 refusing to run partition="holdout" without --final-evaluation (holdout discipline).',
      );
    }

    const protocolPath = process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_PATH;
    if (!protocolPath) {
      throw new Error(
        'RESOLVER-V3-039 live execution requires --protocol=<protocol-v3-json-path>.',
      );
    }
    const executionTreeHash = computeCurrentRepresentativeHybridV1LiveExecutionTreeHash(repoRoot);
    const { protocolHash, protocol } = readProtocolV3(protocolPath);
    verifyRepresentativeHybridV1LiveProtocolV3(protocol, plan.planHash, executionTreeHash);

    const expectedContext: RepresentativeHybridV1LiveExpectedContinuationContext = {
      protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
      protocolHash,
      planHash: plan.planHash,
      corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
      sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
      executionTreeHash,
      providerId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId,
      modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
      modelSnapshotId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId,
      pricing: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
    };

    let developmentCheckpoint:
      | ReturnType<typeof readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint>
      | undefined;

    if (partition === 'development') {
      if (fs.existsSync(DEVELOPMENT_CHECKPOINT_PATH)) {
        throw new Error(
          `RESOLVER-V3-039 refuses to run Development: a checkpoint already exists at ${DEVELOPMENT_CHECKPOINT_PATH}. A completed Development phase is never rerun.`,
        );
      }
    } else {
      if (!process.env.REPRESENTATIVE_HYBRID_V1_LIVE_DEVELOPMENT_CHECKPOINT_PATH) {
        throw new Error(
          'RESOLVER-V3-039 Holdout requires --development-checkpoint=<path-to-development-checkpoint.json>.',
        );
      }
      const developmentCheckpointPath =
        process.env.REPRESENTATIVE_HYBRID_V1_LIVE_DEVELOPMENT_CHECKPOINT_PATH;
      // Validated fully (protocol/hash/corpus/tree/provider/pricing/completeness) before any
      // provider or budget-gate construction below -- checkpoint validation itself is zero-network.
      developmentCheckpoint = readAndValidateRepresentativeHybridV1LiveDevelopmentCheckpoint(
        developmentCheckpointPath,
        expectedContext,
      );
      const priorHoldout =
        readRepresentativeHybridV1LiveHoldoutCheckpointIfPresent(HOLDOUT_CHECKPOINT_PATH);
      if (priorHoldout && priorHoldout.phase === 'holdout_complete') {
        throw new Error(
          `RESOLVER-V3-039 refuses to run Holdout: a completed Holdout checkpoint already exists at ${HOLDOUT_CHECKPOINT_PATH}. Holdout runs exactly once.`,
        );
      }
      if (fs.existsSync(FINAL_REPORT_JSON_PATH)) {
        throw new Error(
          `RESOLVER-V3-039 refuses to run Holdout: a final combined report already exists at ${FINAL_REPORT_JSON_PATH}. There is no --allow-rerun escape hatch in protocol v3 -- a genuine restart requires an explicit, separate human action outside this CLI.`,
        );
      }
    }

    const ledger = RepresentativeHybridV1LiveCallLedger.open(LEDGER_PATH);
    const indeterminate = ledger.indeterminateCallIds();
    if (indeterminate.length > 0) {
      throw new Error(
        `RESOLVER-V3-039 refuses to proceed: ${indeterminate.length} call(s) are in an indeterminate state after a prior interruption (${indeterminate.slice(0, 5).join(', ')}${indeterminate.length > 5 ? ', ...' : ''}). These retain their full budget reservation and are never rerun automatically. Explicit human resolution is required (see reports/RESOLVER_V3_039_PHASE_B_CONTINUATION_REMEDIATION.md's "Indeterminate call resolution" procedure) before any further live call.`,
      );
    }

    const plannedCallIds = computeRepresentativeHybridV1LivePlannedCallIds(plan, partition);
    const alreadyLedgered = plannedCallIds.filter((id) => ledger.stateOf(id) !== null);
    if (alreadyLedgered.length > 0) {
      throw new Error(
        `RESOLVER-V3-039 refuses to start a fresh ${partition} run: the call ledger already has ${alreadyLedgered.length} entr(y/ies) for this partition's planned calls (e.g. "${alreadyLedgered[0]}"). This protocol version does not attempt automatic mid-partition resumption -- partial evidence is preserved durably, but restarting requires explicit human review of the existing ledger/checkpoint state first.`,
      );
    }

    const orderedAll = orderRepresentativeHybridV1LiveObservationsForExecution(plan.observations, [
      partition,
    ]);
    const orderedB = orderedAll.filter((o) => o.variant === 'B');
    const orderedCAiRouted = orderedAll.filter(
      (o) => o.variant === 'C' && o.expectedRoute === 'ai_routed',
    );

    // Missing ANTHROPIC_API_KEY / missing budget gate throws here, before any network call --
    // createLiveVariantBProvider/createLiveVariantCInterpreter never fall back to a fixture.
    const budgetLimits = await buildRepresentativeHybridV1LiveBudgetLimits();
    const budgetGate = reconstructRepresentativeHybridV1LiveCumulativeBudgetGate(
      budgetLimits,
      ledger,
      plan,
    );
    const timeoutTransport = new TimeoutEnforcingAnthropicBenchmarkTransport(
      createAnthropicBenchmarkTransport(),
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.perRequestTimeoutMs,
    );
    const liveB = createLiveVariantBProvider(process.env, budgetGate, timeoutTransport);
    const liveC = createLiveVariantCInterpreter(process.env, budgetGate, timeoutTransport);

    const rawTelemetry: LiveProviderUsageRecord[] = [];
    const telemetryB = wrapVariantBProviderWithTelemetry(
      liveB,
      rawTelemetry,
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.wallClockCeilingMs,
    );
    const telemetryC = wrapVariantCInterpreterWithTelemetry(
      liveC,
      rawTelemetry,
      REPRESENTATIVE_HYBRID_V1_LIVE_TIMEOUT_POLICY.wallClockCeilingMs,
    );
    const wrappedB = wrapVariantBProviderWithLedger(
      telemetryB,
      ledger,
      orderedB,
      plan.planHash,
      rawTelemetry,
    );
    const wrappedC = wrapVariantCInterpreterWithLedger(
      telemetryC,
      ledger,
      orderedCAiRouted,
      plan.planHash,
      rawTelemetry,
    );

    const { caseRecords } = await runRepresentativeHybridV1LivePartition(
      REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS as readonly RepresentativeHybridV1ResolutionScenario[],
      plan,
      [partition],
      { variantBProvider: wrappedB, variantCAiInterpreter: wrappedC },
    );

    const expectedBehaviorByScenarioId = new Map(
      (
        REPRESENTATIVE_HYBRID_V1_RESOLUTION_SCENARIOS as readonly RepresentativeHybridV1ResolutionScenario[]
      ).map((s) => [s.scenarioId, s.case.expectedBehavior]),
    );

    const completedCallIds = plannedCallIds.filter((id) => ledger.stateOf(id) === 'completed');
    const terminalFailureCallIds = plannedCallIds.filter(
      (id) => ledger.stateOf(id) === 'terminal_failure',
    );
    const indeterminateCallIds = plannedCallIds.filter(
      (id) => ledger.stateOf(id) === 'indeterminate_after_interruption',
    );
    const cumulativeBudget = budgetGate.snapshot();

    if (partition === 'development') {
      const checkpoint = writeRepresentativeHybridV1LiveDevelopmentCheckpoint(
        DEVELOPMENT_CHECKPOINT_PATH,
        {
          checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_CHECKPOINT_SCHEMA_VERSION,
          protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
          protocolHash,
          executionPlanVersion: plan.planVersion,
          planHash: plan.planHash,
          corpusHash: REPRESENTATIVE_HYBRID_V1_CORPUS_HASH,
          sourceManifestHash: REPRESENTATIVE_HYBRID_V1_SOURCE_MANIFEST_HASH,
          executionTreeHash,
          protocolFreezeCommit:
            process.env.REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_FREEZE_COMMIT ?? null,
          executionCommit: process.env.REPRESENTATIVE_HYBRID_V1_LIVE_EVIDENCE_COMMIT ?? null,
          providerId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.providerId,
          modelId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelId,
          modelSnapshotId: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT.modelSnapshotId,
          pricing: REPRESENTATIVE_HYBRID_V1_LIVE_PRICING_SNAPSHOT,
          plannedDevelopmentCallIds: plannedCallIds,
          completedCallIds,
          terminalFailureCallIds,
          indeterminateCallIds,
          rawTelemetry,
          developmentCaseRecords: caseRecords,
          cumulativeBudget: {
            calls: cumulativeBudget.calls,
            inputTokens: cumulativeBudget.inputTokens,
            outputTokens: cumulativeBudget.outputTokens,
            reservedCost: cumulativeBudget.reservedCost,
          },
          generatedAtUtc: new Date().toISOString(),
          phase: 'development_complete',
        },
      );

      const diagnosticReport = buildRepresentativeHybridV1LiveReport({
        plan,
        budgetLimits: cumulativeBudget.limits,
        protocolFreezeCommit: checkpoint.protocolFreezeCommit,
        evidenceCommit: checkpoint.executionCommit,
        executionStatus: { phase: 'development_complete', blockerReason: null },
        rawTelemetry,
        developmentCaseRecords: caseRecords,
        holdoutCaseRecords: null,
        expectedBehaviorByScenarioId,
        reportVersion: REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2,
        protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
      });
      assertValidRepresentativeHybridV1LiveReport(diagnosticReport);
      fs.writeFileSync(DEVELOPMENT_DIAGNOSTIC_JSON_PATH, JSON.stringify(diagnosticReport, null, 2));
      fs.writeFileSync(
        DEVELOPMENT_DIAGNOSTIC_MD_PATH,
        buildRepresentativeHybridV1LiveMarkdownReport(diagnosticReport),
      );

      // eslint-disable-next-line no-console
      console.log(
        `RESOLVER-V3-039 Development complete. calls=${completedCallIds.length + terminalFailureCallIds.length} ` +
          `completed=${completedCallIds.length} terminalFailures=${terminalFailureCallIds.length} ` +
          `cumulativeReservedCostUsd=${cumulativeBudget.reservedCost}. Checkpoint written to ${DEVELOPMENT_CHECKPOINT_PATH}.`,
      );
      return;
    }

    // partition === 'holdout'
    const checkpoint = developmentCheckpoint!;
    const holdoutCheckpoint = writeRepresentativeHybridV1LiveHoldoutCheckpoint(
      HOLDOUT_CHECKPOINT_PATH,
      {
        checkpointVersion: REPRESENTATIVE_HYBRID_V1_LIVE_HOLDOUT_CHECKPOINT_SCHEMA_VERSION,
        planHash: plan.planHash,
        plannedHoldoutCallIds: plannedCallIds,
        completedCallIds,
        terminalFailureCallIds,
        indeterminateCallIds,
        cumulativeBudget: {
          calls: cumulativeBudget.calls,
          inputTokens: cumulativeBudget.inputTokens,
          outputTokens: cumulativeBudget.outputTokens,
          reservedCost: cumulativeBudget.reservedCost,
        },
        generatedAtUtc: new Date().toISOString(),
        phase: 'holdout_complete',
      },
    );

    const combinedTelemetry: LiveProviderUsageRecord[] = [
      ...checkpoint.rawTelemetry,
      ...rawTelemetry,
    ];

    const finalReport = buildRepresentativeHybridV1LiveReport({
      plan,
      budgetLimits: cumulativeBudget.limits,
      protocolFreezeCommit: checkpoint.protocolFreezeCommit,
      evidenceCommit: process.env.REPRESENTATIVE_HYBRID_V1_LIVE_EVIDENCE_COMMIT ?? null,
      executionStatus: { phase: 'development_and_holdout_complete', blockerReason: null },
      rawTelemetry: combinedTelemetry,
      developmentCaseRecords: checkpoint.developmentCaseRecords,
      holdoutCaseRecords: caseRecords,
      expectedBehaviorByScenarioId,
      reportVersion: REPRESENTATIVE_HYBRID_V1_LIVE_REPORT_VERSION_V2,
      protocolVersion: REPRESENTATIVE_HYBRID_V1_LIVE_PROTOCOL_VERSION_V3,
    });
    assertValidRepresentativeHybridV1LiveReport(finalReport);

    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(FINAL_REPORT_JSON_PATH, JSON.stringify(finalReport, null, 2));
    fs.writeFileSync(
      FINAL_REPORT_MD_PATH,
      buildRepresentativeHybridV1LiveMarkdownReport(finalReport),
    );

    // eslint-disable-next-line no-console
    console.log(
      `RESOLVER-V3-039 Holdout complete. combined calls=${finalReport.actualUsage.calls} ` +
        `estimatedCostUsd=${finalReport.actualUsage.estimatedCostUsd ?? 'unknown'} ` +
        `cumulativeReservedCostUsd=${cumulativeBudget.reservedCost}. ` +
        `Holdout checkpoint written to ${HOLDOUT_CHECKPOINT_PATH} (phase=${holdoutCheckpoint.phase}). ` +
        `Final combined report written to ${FINAL_REPORT_JSON_PATH}.`,
    );
  },
  20 * 60_000,
);
