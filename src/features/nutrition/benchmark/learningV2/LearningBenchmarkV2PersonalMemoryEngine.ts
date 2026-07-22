import { RecordPersonalResolutionMemoryUseCase } from '../../application/usecases/RecordPersonalResolutionMemoryUseCase';
import { ReadPersonalResolutionMemoryUseCase } from '../../application/usecases/ReadPersonalResolutionMemoryUseCase';
import { InvalidatePersonalResolutionMemoryUseCase } from '../../application/usecases/InvalidatePersonalResolutionMemoryUseCase';
import { InMemoryPersonalResolutionMemoryInvalidationRepository } from '../../infrastructure/repositories/InMemoryPersonalResolutionMemoryInvalidationRepository';
import { PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION } from '../../domain/models/PersonalResolutionMemoryRecording';
import { PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION } from '../../domain/models/PersonalResolutionMemoryRead';
import { PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION } from '../../domain/models/PersonalResolutionMemoryInvalidation';
import { LearningBenchmarkV2PersonalMemoryFixtureRepository } from './LearningBenchmarkV2PersonalMemoryFixtureRepository';
import { LearningBenchmarkV2FixtureInterpretationProvider } from './LearningBenchmarkV2FixtureInterpretationProvider';
import { LearningBenchmarkV2DeterministicClock } from './LearningBenchmarkV2DeterministicClock';
import type { LearningBenchmarkV2PersonalMemoryStep } from './LearningBenchmarkV2Types';

/**
 * Real-use-case execution engine shared by `personal_memory_sequence`, `privacy_deletion_sequence`,
 * and `economics_sequence` scenarios (all three operate over the same step vocabulary). Drives the
 * real `RecordPersonalResolutionMemoryUseCase`, `ReadPersonalResolutionMemoryUseCase`, and
 * `InvalidatePersonalResolutionMemoryUseCase` against fresh, isolated fixture state per scenario
 * (binding requirement §18). Never reimplements promotion/eligibility/invalidation policy -- those
 * decisions come only from the real use cases and the real policy functions they call.
 */
export interface LearningBenchmarkV2PersonalMemoryStepOutcome {
  stepId: string;
  kind: LearningBenchmarkV2PersonalMemoryStep['kind'];
  expected: string;
  actual: string;
  matched: boolean;
  deterministicReuse?: boolean;
  matchCount?: number;
  interpretationCallAvoided?: boolean;
}

export interface LearningBenchmarkV2PersonalMemoryRunResult {
  stepOutcomes: readonly LearningBenchmarkV2PersonalMemoryStepOutcome[];
  allStepsMatched: boolean;
  interpretationCallsInvoked: number;
  avoidedInterpretationCallCount: number;
  crossUserLeakCount: number;
  writeCount: number;
  readCount: number;
  invalidationCount: number;
}

export async function runLearningBenchmarkV2PersonalMemorySteps(
  steps: readonly LearningBenchmarkV2PersonalMemoryStep[],
): Promise<LearningBenchmarkV2PersonalMemoryRunResult> {
  const fixtureRepo = new LearningBenchmarkV2PersonalMemoryFixtureRepository();
  const invalidationRepo = new InMemoryPersonalResolutionMemoryInvalidationRepository();
  const interpretationProvider = new LearningBenchmarkV2FixtureInterpretationProvider();
  const recordUseCase = new RecordPersonalResolutionMemoryUseCase(fixtureRepo);
  const readUseCase = new ReadPersonalResolutionMemoryUseCase(fixtureRepo);
  const invalidateUseCase = new InvalidatePersonalResolutionMemoryUseCase(invalidationRepo);
  const clock = new LearningBenchmarkV2DeterministicClock();
  const stepIdToMemoryId = new Map<string, string>();

  const stepOutcomes: LearningBenchmarkV2PersonalMemoryStepOutcome[] = [];
  let avoidedInterpretationCallCount = 0;
  let crossUserLeakCount = 0;
  let writeCount = 0;
  let readCount = 0;
  let invalidationCount = 0;

  for (const step of steps) {
    if (step.kind === 'record') {
      writeCount += 1;
      const result = await recordUseCase.execute({
        contractVersion: PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION,
        ownerId: step.ownerId,
        actionId: step.actionId,
        locale: 'de',
        target: { sourceType: step.sourceType, sourceId: step.sourceId, kind: 'source_grounded' },
        evidenceType: step.evidenceType,
        occurredAt: clock.next(),
        priorMemoryId: step.priorMemoryId,
      });
      if (result.status === 'written' || result.status === 'duplicate') {
        stepIdToMemoryId.set(step.stepId, step.actionId);
        const memory = fixtureRepo.getMemoryForTesting(step.actionId);
        if (memory) invalidationRepo.seed(step.ownerId, memory);
      }
      stepOutcomes.push({
        stepId: step.stepId,
        kind: step.kind,
        expected: step.expectedStatus,
        actual: result.status,
        matched: result.status === step.expectedStatus,
      });
      continue;
    }

    if (step.kind === 'read') {
      readCount += 1;
      const result = await readUseCase.execute({
        contractVersion: PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION,
        ownerId: step.ownerId,
        targets: [{ sourceType: step.sourceType, sourceId: step.sourceId }],
      });
      const hasMatch = result.matches.length > 0;
      const deterministicReuse = result.matches.some(
        (match) => match.eligibility.deterministicReuse,
      );
      if (!step.expectAnyMatch && hasMatch) crossUserLeakCount += 1;
      if (deterministicReuse) {
        avoidedInterpretationCallCount += 1;
      } else {
        await interpretationProvider.interpret({
          rawInput: `${step.sourceType}:${step.sourceId}`,
          locale: 'de',
          traceId: step.stepId,
        });
      }
      const matched =
        hasMatch === step.expectAnyMatch && deterministicReuse === step.expectDeterministicReuse;
      stepOutcomes.push({
        stepId: step.stepId,
        kind: step.kind,
        expected: `anyMatch=${step.expectAnyMatch},deterministicReuse=${step.expectDeterministicReuse}`,
        actual: `anyMatch=${hasMatch},deterministicReuse=${deterministicReuse}`,
        matched,
        deterministicReuse,
        matchCount: result.matches.length,
        interpretationCallAvoided: deterministicReuse,
      });
      continue;
    }

    // step.kind === 'invalidate'
    invalidationCount += 1;
    const memoryId = stepIdToMemoryId.get(step.targetMemoryStepId);
    if (!memoryId) {
      stepOutcomes.push({
        stepId: step.stepId,
        kind: step.kind,
        expected: step.expectedStatus,
        actual: 'unknown_target_step',
        matched: false,
      });
      continue;
    }
    const result = await invalidateUseCase.execute({
      contractVersion: PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION,
      ownerId: step.ownerId,
      memoryId,
      actionId: step.actionId,
      reason: step.reason,
      occurredAt: clock.next(),
    });
    const updated = await invalidationRepo.findForInvalidation(step.ownerId, memoryId);
    if (updated.kind === 'found') fixtureRepo.syncFromInvalidation(step.ownerId, updated.memory);

    const actualStatus =
      result.status === 'invalidated' || result.status === 'weakened'
        ? 'invalidated'
        : result.status === 'already_inactive'
          ? 'already_processed'
          : result.status;
    stepOutcomes.push({
      stepId: step.stepId,
      kind: step.kind,
      expected: step.expectedStatus,
      actual: actualStatus,
      matched: actualStatus === step.expectedStatus,
    });
  }

  return {
    stepOutcomes,
    allStepsMatched: stepOutcomes.every((outcome) => outcome.matched),
    interpretationCallsInvoked: interpretationProvider.getInvocationCount(),
    avoidedInterpretationCallCount,
    crossUserLeakCount,
    writeCount,
    readCount,
    invalidationCount,
  };
}
