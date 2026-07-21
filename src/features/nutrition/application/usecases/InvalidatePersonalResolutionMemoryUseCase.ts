import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import {
  PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION as VERSION,
  PERSONAL_RESOLUTION_MEMORY_INVALIDATION_REASONS as REASONS,
  type PersonalResolutionMemoryInvalidationEvent,
  type PersonalResolutionMemoryInvalidationReason,
  type PersonalResolutionMemoryInvalidationRequest,
  type PersonalResolutionMemoryInvalidationResult,
} from '../../domain/models/PersonalResolutionMemoryInvalidation';
import type { PersonalResolutionMemoryInvalidationRepository } from '../ports/PersonalResolutionMemoryInvalidationRepository';

const MAX_TRAVERSAL = 100;
const inactive = new Set(['superseded', 'contradicted', 'deleted']);

export class InvalidatePersonalResolutionMemoryUseCase {
  constructor(private readonly repository: PersonalResolutionMemoryInvalidationRepository) {}
  async execute(
    request: PersonalResolutionMemoryInvalidationRequest,
  ): Promise<PersonalResolutionMemoryInvalidationResult> {
    if (request.contractVersion !== VERSION)
      return result('invalid_request', 'unknown_contract_version');
    if (!(REASONS as readonly string[]).includes(request.reason))
      return result('invalid_request', 'unknown_reason');
    if (!request.ownerId) return result('invalid_request', 'missing_owner');
    if (!request.memoryId || !request.actionId)
      return result('invalid_request', 'missing_memory_id');
    const root = await this.repository.findForInvalidation(request.ownerId, request.memoryId);
    if (root.kind === 'owner_mismatch') return result('blocked_owner_mismatch', 'owner_mismatch');
    if (root.kind === 'not_found') return result('not_found');
    const visited = new Set<string>();
    const queue = [request.memoryId];
    const affected: string[] = [];
    let rootInactive = false;
    while (queue.length) {
      if (visited.size >= MAX_TRAVERSAL)
        return result('failed', 'traversal_limit_exceeded', affected);
      const memoryId = queue.shift()!;
      if (visited.has(memoryId)) return result('failed', 'cycle_detected', affected);
      visited.add(memoryId);
      const lookup = await this.repository.findForInvalidation(request.ownerId, memoryId);
      if (lookup.kind !== 'found') return result('failed', 'repository_failed', affected);
      const transition = next(
        lookup.memory,
        memoryId === request.memoryId
          ? (request.reason as PersonalResolutionMemoryInvalidationReason)
          : 'dependency_invalidated',
      );
      if (!transition) {
        if (memoryId === request.memoryId) rootInactive = true;
        continue;
      }
      const event: PersonalResolutionMemoryInvalidationEvent = {
        contractVersion: VERSION,
        eventId: `${request.actionId}:${memoryId}`,
        actionId: request.actionId,
        memoryId,
        reason:
          memoryId === request.memoryId
            ? (request.reason as PersonalResolutionMemoryInvalidationReason)
            : 'dependency_invalidated',
        previousStatus: lookup.memory.status,
        nextStatus: transition.status,
        previousLevel: lookup.memory.level,
        nextLevel: transition.level,
        occurredAt: request.occurredAt,
      };
      const write = await this.repository.applyInvalidation(request.ownerId, transition, event);
      if (write === 'failed') return result('failed', 'repository_failed', affected);
      if (write === 'written') affected.push(memoryId);
      for (const dependent of await this.repository.findDependents(request.ownerId, memoryId))
        queue.push(dependent);
    }
    return {
      status: affected.length
        ? affected.includes(request.memoryId) &&
          next(root.memory, request.reason as PersonalResolutionMemoryInvalidationReason)?.level !==
            root.memory.level
          ? 'weakened'
          : 'invalidated'
        : rootInactive
          ? 'already_inactive'
          : 'already_inactive',
      affectedMemoryIds: affected,
    };
  }
}
function next(
  memory: PersonalResolutionMemory,
  reason: PersonalResolutionMemoryInvalidationReason,
): PersonalResolutionMemory | null {
  if (inactive.has(memory.status)) return null;
  if (reason === 'source_unavailable' && memory.level === 'P1_provisional')
    return { ...memory, level: 'P0_observed', updatedAt: memory.updatedAt };
  const status =
    reason === 'user_correction' || reason === 'source_superseded'
      ? 'superseded'
      : reason === 'contradiction' || reason === 'source_identity_changed'
        ? 'contradicted'
        : 'deleted';
  return { ...memory, status, updatedAt: memory.updatedAt };
}
function result(
  status: PersonalResolutionMemoryInvalidationResult['status'],
  code?: PersonalResolutionMemoryInvalidationResult['code'],
  affectedMemoryIds: string[] = [],
): PersonalResolutionMemoryInvalidationResult {
  return { status, ...(code ? { code } : {}), affectedMemoryIds };
}
