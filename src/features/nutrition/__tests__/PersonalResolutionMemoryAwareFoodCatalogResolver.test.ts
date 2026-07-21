import { PersonalResolutionMemoryAwareFoodCatalogResolver } from '../application/services/PersonalResolutionMemoryAwareFoodCatalogResolver';
import { FoodCatalogResolver } from '../application/services/FoodCatalogResolver';
import { ReadPersonalResolutionMemoryUseCase } from '../application/usecases/ReadPersonalResolutionMemoryUseCase';
import type {
  PersonalResolutionMemoryReadRepository,
  PersonalResolutionMemoryReadRow,
} from '../application/ports/PersonalResolutionMemoryReadRepository';
import type { ResolverObservationOwnerProvider } from '../application/ports/ResolverObservationOwnerProvider';
import type {
  PersonalResolutionMemoryReadTelemetry,
  PersonalResolutionMemoryReadTelemetryEvent,
} from '../application/ports/PersonalResolutionMemoryReadTelemetry';
import { ResolvedFoodCandidate, ResolverDecision } from '../domain/models/ResolverDecision';
import { FoodSearchQuery } from '../domain/catalog/FoodCatalogSource';

function candidate(overrides: Partial<ResolvedFoodCandidate> = {}): ResolvedFoodCandidate {
  return {
    id: 'bls:egg-raw',
    source: 'BLS',
    food: {
      id: 'egg-raw',
      name: 'Egg',
      normalizedName: 'egg',
      macrosPer100g: { kcal: 143, protein: 13, carbs: 1, fat: 10 },
      source: 'bls',
      sourceId: 'egg-raw',
    },
    score: 0.6,
    breakdown: {
      matchScore: 0.6,
      dataQualityScore: 0.9,
      kcalConsistencyScore: 0.9,
      sourceTrustScore: 0.9,
      finalScore: 0.6,
      notes: ['fuzzy_match'],
    },
    ...overrides,
  };
}

function decision(overrides: Partial<ResolverDecision> = {}): ResolverDecision {
  const candidates = overrides.candidates ?? [candidate()];
  return {
    normalizedQuery: 'egg',
    status: 'ambiguous',
    reasonCodes: ['MULTIPLE_CLOSE_MATCHES'],
    candidates,
    best: candidates[0],
    createdAt: '2026-07-21T12:00:00.000Z',
    ...overrides,
  };
}

class FakeInnerResolver implements FoodCatalogResolver {
  decisionToReturn: ResolverDecision = decision();
  calls: FoodSearchQuery[] = [];

  async resolve(query: FoodSearchQuery): Promise<ResolverDecision> {
    this.calls.push(query);
    return this.decisionToReturn;
  }
}

class FakeReadRepository implements PersonalResolutionMemoryReadRepository {
  rows: PersonalResolutionMemoryReadRow[] = [];
  calls: { ownerId: string; scopeKeys: string[] }[] = [];
  throwOnCall = false;

  async findActiveByScopeKeys(
    ownerId: string,
    scopeKeys: string[],
  ): Promise<PersonalResolutionMemoryReadRow[]> {
    this.calls.push({ ownerId, scopeKeys });
    if (this.throwOnCall) throw new Error('boom');
    return this.rows;
  }
}

class FakeOwnerProvider implements ResolverObservationOwnerProvider {
  ownerId: string | null = 'owner-a';
  async getOwnerId(): Promise<string | null> {
    return this.ownerId;
  }
}

class FakeTelemetry implements PersonalResolutionMemoryReadTelemetry {
  events: PersonalResolutionMemoryReadTelemetryEvent[] = [];
  record(event: PersonalResolutionMemoryReadTelemetryEvent): void {
    this.events.push(event);
  }
}

const query: FoodSearchQuery = { raw: 'egg', normalized: 'egg', locale: 'de' };

function build() {
  const inner = new FakeInnerResolver();
  const readRepo = new FakeReadRepository();
  const readUseCase = new ReadPersonalResolutionMemoryUseCase(readRepo);
  const ownerProvider = new FakeOwnerProvider();
  const telemetry = new FakeTelemetry();
  const resolver = new PersonalResolutionMemoryAwareFoodCatalogResolver(
    inner,
    readUseCase,
    ownerProvider,
    telemetry,
  );
  return { inner, readRepo, ownerProvider, telemetry, resolver };
}

describe('RESOLVER-V3-019 PersonalResolutionMemoryAwareFoodCatalogResolver', () => {
  it('returns the base decision unchanged when there is no owner (fails open, never blocks)', async () => {
    const { inner, ownerProvider, resolver } = build();
    ownerProvider.ownerId = null;

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
  });

  it('returns the base decision unchanged and never looks up an owner when there are no candidates', async () => {
    const { inner, ownerProvider, resolver } = build();
    inner.decisionToReturn = decision({ candidates: [], best: undefined, status: 'rejected' });
    const getOwnerIdSpy = jest.spyOn(ownerProvider, 'getOwnerId');

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
    expect(getOwnerIdSpy).not.toHaveBeenCalled();
  });

  it('excludes user-sourced (alias) candidates from lookup entirely', async () => {
    const { inner, readRepo, resolver } = build();
    const userCandidate = candidate({
      food: {
        id: 'alias-1',
        name: 'My Alias',
        normalizedName: 'my alias',
        macrosPer100g: { kcal: 100, protein: 1, carbs: 1, fat: 1 },
        source: 'user',
        sourceId: 'alias-1',
      },
    });
    inner.decisionToReturn = decision({ candidates: [userCandidate], best: userCandidate });

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
    expect(readRepo.calls).toHaveLength(0);
  });

  it('returns the base decision unchanged when personal memory has no active match', async () => {
    const { inner, readRepo, telemetry, resolver } = build();
    readRepo.rows = [];

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
    expect(readRepo.calls).toEqual([{ ownerId: 'owner-a', scopeKeys: ['bls:egg-raw'] }]);
    expect(telemetry.events).toEqual([
      {
        ownerPresent: true,
        targetCount: 1,
        matchCount: 0,
        deterministicReuseMatchCount: 0,
        preferredMatchCount: 0,
        avoided: false,
      },
    ]);
  });

  it('deterministically overrides an ambiguous decision to accepted on a P2_confirmed match, and marks it avoided', async () => {
    const { inner, readRepo, telemetry, resolver } = build();
    readRepo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P2_confirmed' }];

    const result = await resolver.resolve(query);

    expect(result.status).toBe('accepted');
    expect(result.best?.score).toBe(0.95);
    expect(result.best?.food.sourceId).toBe('egg-raw');
    expect(result.best?.breakdown.finalScore).toBe(0.95);
    expect(result.best?.breakdown.notes).toContain('personal_resolution_memory_p2_confirmed');
    expect(result.reasonCodes).toContain('PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI');
    // Original decision object (and its candidate) must not be mutated in place.
    expect(inner.decisionToReturn.status).toBe('ambiguous');
    expect(inner.decisionToReturn.best?.score).toBe(0.6);
    expect(telemetry.events[0]).toMatchObject({ avoided: true, deterministicReuseMatchCount: 1 });
  });

  it('overrides a rejected (below-threshold) decision to accepted on a P2_confirmed match', async () => {
    const { inner, readRepo, resolver } = build();
    const lowScoreCandidate = candidate({
      score: 0.2,
      breakdown: { ...candidate().breakdown, finalScore: 0.2 },
    });
    inner.decisionToReturn = decision({
      status: 'rejected',
      reasonCodes: ['LOW_SCORE'],
      candidates: [lowScoreCandidate],
      best: lowScoreCandidate,
    });
    readRepo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P2_confirmed' }];

    const result = await resolver.resolve(query);

    expect(result.status).toBe('accepted');
    expect(result.best?.score).toBe(0.95);
  });

  it('does not re-mark an already-accepted, already-matching decision as avoided (no redundant override)', async () => {
    const { inner, readRepo, telemetry, resolver } = build();
    const confirmedCandidate = candidate({ score: 0.9 });
    inner.decisionToReturn = decision({
      status: 'accepted',
      reasonCodes: ['ACCEPTED_STRONG_MATCH'],
      candidates: [confirmedCandidate],
      best: confirmedCandidate,
    });
    readRepo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P2_confirmed' }];

    const result = await resolver.resolve(query);

    expect(result.status).toBe('accepted');
    expect(result.best).toBe(confirmedCandidate); // same object, not boosted/replaced
    expect(result.best?.score).toBe(0.9);
    expect(result.reasonCodes).toContain('PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI');
    expect(telemetry.events[0]).toMatchObject({ avoided: false });
  });

  it('annotates (but never overrides best/status for) a P1_provisional-only match', async () => {
    const { inner, readRepo, telemetry, resolver } = build();
    readRepo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P1_provisional' }];

    const result = await resolver.resolve(query);

    expect(result.status).toBe(inner.decisionToReturn.status);
    expect(result.best).toBe(inner.decisionToReturn.best);
    expect(result.reasonCodes).toContain('PERSONAL_MEMORY_P1_PREFERRED');
    expect(telemetry.events[0]).toMatchObject({ avoided: false, preferredMatchCount: 1 });
  });

  it('ignores a P0_observed-only match entirely (no reason code, no override)', async () => {
    const { inner, readRepo, resolver } = build();
    readRepo.rows = [{ memoryId: 'memory-1', scopeKey: 'bls:egg-raw', level: 'P0_observed' }];

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
  });

  it('fails open (returns the base decision unchanged) when the read use case reports failure', async () => {
    const { inner, readRepo, resolver } = build();
    readRepo.throwOnCall = true;

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
  });

  it('never throws even if the owner provider itself throws', async () => {
    const { inner, ownerProvider, resolver } = build();
    ownerProvider.getOwnerId = async () => {
      throw new Error('boom');
    };

    const result = await resolver.resolve(query);

    expect(result).toBe(inner.decisionToReturn);
  });

  it('passes the query through to the wrapped resolver unchanged', async () => {
    const { inner, resolver } = build();

    await resolver.resolve(query, { traceId: 'trace-1' });

    expect(inner.calls).toEqual([query]);
  });
});
