import type { PersonalResolutionMemory } from '../../domain/models/PersonalResolutionMemory';
import {
  PERSONAL_RESOLUTION_MEMORY_INVALIDATION_CONTRACT_VERSION as VERSION,
  PERSONAL_RESOLUTION_MEMORY_INVALIDATION_REASONS as REASONS,
  type PersonalResolutionMemoryInvalidationEvent,
  type PersonalResolutionMemoryInvalidationPlan,
  type PersonalResolutionMemoryInvalidationPlanEntry,
  type PersonalResolutionMemoryInvalidationReason,
  type PersonalResolutionMemoryInvalidationRequest,
  type PersonalResolutionMemoryInvalidationResult,
} from '../../domain/models/PersonalResolutionMemoryInvalidation';
import type { PersonalResolutionMemoryInvalidationRepository } from '../ports/PersonalResolutionMemoryInvalidationRepository';

const MAX_TRAVERSAL = 100;
const inactive = new Set(['superseded', 'contradicted', 'deleted']);

type PlanFailureCode =
  | 'cycle_detected'
  | 'traversal_limit_exceeded'
  | 'invalid_dependency'
  | 'repository_failed';

type PlanBuildResult =
  | { ok: true; entries: PersonalResolutionMemoryInvalidationPlanEntry[] }
  | { ok: false; code: PlanFailureCode };

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

    const committed = await safeFindCommittedAction(
      this.repository,
      request.ownerId,
      request.actionId,
    );
    if (committed) return committed;

    const root = await this.repository.findForInvalidation(request.ownerId, request.memoryId);
    if (root.kind === 'owner_mismatch') return result('blocked_owner_mismatch', 'owner_mismatch');
    if (root.kind === 'not_found') return result('not_found');

    const plan = await buildPlan(this.repository, request, root.memory);
    if (!plan.ok) return result('failed', plan.code);

    const rootEntry = plan.entries.find((entry) => entry.memoryId === request.memoryId);
    const invalidationResult = summarize(request, rootEntry, plan.entries);

    const invalidationPlan: PersonalResolutionMemoryInvalidationPlan = {
      contractVersion: VERSION,
      actionId: request.actionId,
      ownerId: request.ownerId,
      rootMemoryId: request.memoryId,
      occurredAt: request.occurredAt,
      entries: plan.entries,
      result: invalidationResult,
    };

    const outcome = await this.repository.applyInvalidationPlanAtomically(invalidationPlan);
    if (outcome === 'applied') return invalidationResult;
    if (outcome === 'duplicate') {
      const replay = await safeFindCommittedAction(
        this.repository,
        request.ownerId,
        request.actionId,
      );
      return replay ?? result('failed', 'atomic_commit_failed');
    }
    return result('failed', 'atomic_commit_failed');
  }
}

async function safeFindCommittedAction(
  repository: PersonalResolutionMemoryInvalidationRepository,
  ownerId: string,
  actionId: string,
): Promise<PersonalResolutionMemoryInvalidationResult | null> {
  try {
    return await repository.findCommittedAction(ownerId, actionId);
  } catch {
    return null;
  }
}

/**
 * Phase 1 — plan. Reads the full reachable dependency graph and produces a deterministic,
 * immutable plan without writing anything. Pre-order DFS with explicit visiting/done coloring:
 * a node reached while still "visiting" (on the current path) is a true cycle; a node already
 * "done" (fully planned via another path) is a legitimate diamond revisit and is not replanned.
 * Already-inactive nodes are still classified and their dependents are still traversed.
 */
async function buildPlan(
  repository: PersonalResolutionMemoryInvalidationRepository,
  request: PersonalResolutionMemoryInvalidationRequest,
  rootMemory: PersonalResolutionMemory,
): Promise<PlanBuildResult> {
  const state = new Map<string, 'visiting' | 'done'>();
  const cache = new Map<string, PersonalResolutionMemory>([[request.memoryId, rootMemory]]);
  const entries: PersonalResolutionMemoryInvalidationPlanEntry[] = [];
  let failure: PlanFailureCode | null = null;
  let discovered = 0;

  const visit = async (
    memoryId: string,
    reason: PersonalResolutionMemoryInvalidationReason,
  ): Promise<void> => {
    if (failure) return;
    const status = state.get(memoryId);
    if (status === 'done') return;
    if (status === 'visiting') {
      failure = 'cycle_detected';
      return;
    }
    discovered += 1;
    if (discovered > MAX_TRAVERSAL) {
      failure = 'traversal_limit_exceeded';
      return;
    }
    state.set(memoryId, 'visiting');

    let memory = cache.get(memoryId);
    if (!memory) {
      let lookup;
      try {
        lookup = await repository.findForInvalidation(request.ownerId, memoryId);
      } catch {
        failure = 'repository_failed';
        return;
      }
      if (lookup.kind !== 'found') {
        failure = 'invalid_dependency';
        return;
      }
      memory = lookup.memory;
      cache.set(memoryId, memory);
    }

    const transitioned = next(memory, reason);
    if (transitioned) {
      const event: PersonalResolutionMemoryInvalidationEvent = {
        contractVersion: VERSION,
        eventId: `${request.actionId}:${memoryId}`,
        actionId: request.actionId,
        memoryId,
        reason,
        previousStatus: memory.status,
        nextStatus: transitioned.status,
        previousLevel: memory.level,
        nextLevel: transitioned.level,
        occurredAt: request.occurredAt,
      };
      entries.push({
        memoryId,
        reason,
        previousStatus: memory.status,
        previousLevel: memory.level,
        nextStatus: transitioned.status,
        nextLevel: transitioned.level,
        classification: 'write',
        event,
      });
    } else {
      entries.push({
        memoryId,
        reason,
        previousStatus: memory.status,
        previousLevel: memory.level,
        nextStatus: memory.status,
        nextLevel: memory.level,
        classification: 'noop',
        event: null,
      });
    }

    let dependents: string[];
    try {
      dependents = await repository.findDependents(request.ownerId, memoryId);
    } catch {
      failure = 'repository_failed';
      return;
    }
    for (const dependent of dependents) {
      if (failure) return;
      await visit(dependent, 'dependency_invalidated');
    }
    state.set(memoryId, 'done');
  };

  await visit(request.memoryId, request.reason as PersonalResolutionMemoryInvalidationReason);
  if (failure) return { ok: false, code: failure };
  return { ok: true, entries };
}

function summarize(
  request: PersonalResolutionMemoryInvalidationRequest,
  rootEntry: PersonalResolutionMemoryInvalidationPlanEntry | undefined,
  entries: PersonalResolutionMemoryInvalidationPlanEntry[],
): PersonalResolutionMemoryInvalidationResult {
  const affectedMemoryIds = entries
    .filter((entry) => entry.classification === 'write')
    .map((entry) => entry.memoryId);
  if (!rootEntry || rootEntry.classification !== 'write')
    return { status: 'already_inactive', affectedMemoryIds };
  const weakened =
    rootEntry.previousStatus === rootEntry.nextStatus &&
    rootEntry.previousLevel !== rootEntry.nextLevel;
  return { status: weakened ? 'weakened' : 'invalidated', affectedMemoryIds };
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
