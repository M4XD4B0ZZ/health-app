import {
  PERSONAL_RESOLUTION_MEMORY_CONTRACT_VERSION as MEMORY_CONTRACT_VERSION,
  PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES,
  type PersonalResolutionMemory,
  type PersonalResolutionMemoryEvidence,
  type PersonalResolutionMemoryEvidenceType,
  type PersonalResolutionMemoryTransition,
  type PersonalResolutionNegativeEvidence,
} from '../../domain/models/PersonalResolutionMemory';
import {
  PERSONAL_RESOLUTION_MEMORY_RECORDING_CONTRACT_VERSION as VERSION,
  type PersonalResolutionMemoryRecordingErrorCode,
  type PersonalResolutionMemoryRecordingResult,
  type RecordPersonalResolutionMemoryRequest,
} from '../../domain/models/PersonalResolutionMemoryRecording';
import { promotionForEvidence } from '../services/PersonalResolutionMemoryPromotionPolicy';
import type { PersonalResolutionMemoryRepository } from '../ports/PersonalResolutionMemoryRepository';

/**
 * RESOLVER-V3-026: the production write boundary for RESOLVER-V3-017's contract. Every call
 * creates exactly one new, immutable memory (there is no read path to merge into an existing
 * one — that is RESOLVER-V3-019's job). The action ID is the sole idempotency boundary and, by
 * construction, also the new memory's ID: retrying the same action can therefore never create a
 * second memory, evidence event, transition event, or negative-evidence event, because every ID
 * derived from it is byte-identical on retry and the underlying tables are unique on
 * (owner, id). Correction precedence is enforced structurally, not inferred: `explicit_correction`
 * evidence is rejected unless the caller names the specific prior memory it overrides, and doing
 * so always produces a negative-evidence event against that prior memory — a correction can never
 * be silently dropped or treated as mere confirmation.
 */
export class RecordPersonalResolutionMemoryUseCase {
  constructor(private readonly repository: PersonalResolutionMemoryRepository) {}

  async execute(
    request: RecordPersonalResolutionMemoryRequest,
  ): Promise<PersonalResolutionMemoryRecordingResult> {
    if (request.contractVersion !== VERSION) return invalid('unknown_contract_version');
    if (!request.ownerId) return invalid('missing_owner');
    if (!request.actionId) return invalid('missing_action_id');
    if (!request.target?.sourceType || !request.target?.sourceId) return invalid('missing_target');
    if (
      !(PERSONAL_RESOLUTION_MEMORY_EVIDENCE_TYPES as readonly string[]).includes(
        request.evidenceType,
      )
    )
      return invalid('unknown_evidence_type');

    const evidenceType = request.evidenceType as PersonalResolutionMemoryEvidenceType;
    const isCorrection = evidenceType === 'explicit_correction';
    if (isCorrection && !request.priorMemoryId)
      return invalid('correction_requires_prior_memory_id');

    const level = promotionForEvidence(MEMORY_CONTRACT_VERSION, evidenceType);
    const memoryId = request.actionId;

    const memory: PersonalResolutionMemory = {
      contractVersion: MEMORY_CONTRACT_VERSION,
      memoryId,
      locale: request.locale,
      scopeKey: `${request.target.sourceType}:${request.target.sourceId}`,
      target: request.target,
      level,
      status: 'active',
      createdAt: request.occurredAt,
      updatedAt: request.occurredAt,
      observedAt: request.occurredAt,
      ...(request.priorMemoryId
        ? { supersedesMemoryId: request.priorMemoryId, correctionReference: request.priorMemoryId }
        : {}),
    };

    const evidence: PersonalResolutionMemoryEvidence = {
      evidenceId: `${request.actionId}:evidence`,
      memoryId,
      type: evidenceType,
      occurredAt: request.occurredAt,
      actionId: request.actionId,
    };

    const transition: PersonalResolutionMemoryTransition = {
      transitionId: `${request.actionId}:transition`,
      memoryId,
      nextLevel: level,
      nextStatus: 'active',
      evidenceId: evidence.evidenceId,
      occurredAt: request.occurredAt,
    };

    const negativeEvidence: PersonalResolutionNegativeEvidence | undefined = isCorrection
      ? {
          negativeEvidenceId: `${request.actionId}:negative`,
          priorMemoryId: request.priorMemoryId as string,
          correctedMemoryId: memoryId,
          reason: 'user_correction',
          correctionReference: request.priorMemoryId as string,
          occurredAt: request.occurredAt,
        }
      : undefined;

    try {
      const outcome = await this.repository.record(
        request.ownerId,
        memory,
        evidence,
        transition,
        negativeEvidence,
      );
      if (outcome === 'failed') return { status: 'failed' };
      return { status: outcome, memoryId, level };
    } catch {
      return { status: 'failed' };
    }
  }
}

function invalid(
  code: PersonalResolutionMemoryRecordingErrorCode,
): PersonalResolutionMemoryRecordingResult {
  return { status: 'invalid_request', code };
}
