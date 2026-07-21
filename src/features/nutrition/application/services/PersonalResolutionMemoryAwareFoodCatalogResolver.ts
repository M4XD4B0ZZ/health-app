import { FoodCatalogResolver } from './FoodCatalogResolver';
import { FoodSearchQuery } from '../../domain/catalog/FoodCatalogSource';
import { ResolvedFoodCandidate, ResolverDecision } from '../../domain/models/ResolverDecision';
import { PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION } from '../../domain/models/PersonalResolutionMemoryRead';
import { ReadPersonalResolutionMemoryUseCase } from '../usecases/ReadPersonalResolutionMemoryUseCase';
import {
  NoopResolverObservationOwnerProvider,
  ResolverObservationOwnerProvider,
} from '../ports/ResolverObservationOwnerProvider';
import {
  NoopPersonalResolutionMemoryReadTelemetry,
  PersonalResolutionMemoryReadTelemetry,
} from '../ports/PersonalResolutionMemoryReadTelemetry';

/** Score assigned to a P2-confirmed candidate. Deliberately below 1.0 (reserved for a literal
 * exact deterministic match elsewhere) but comfortably above `ACCEPT_THRESHOLD` (0.75) and any
 * plausible second-best delta, so the confirmed candidate always wins the comparison in
 * `LogFoodFromRawInputUseCase` (`resolved.score >= 0.7`) without claiming to be something the
 * personal-memory signal itself does not know (e.g. a perfect textual match). */
const PERSONAL_MEMORY_P2_CONFIRMED_SCORE = 0.95;

const REASON_CODE_P2_CONFIRMED = 'PERSONAL_MEMORY_P2_CONFIRMED_AVOIDED_AI';
const REASON_CODE_P1_PREFERRED = 'PERSONAL_MEMORY_P1_PREFERRED';

function candidateScopeKey(candidate: ResolvedFoodCandidate): string {
  return `${candidate.food.source}:${candidate.food.sourceId ?? candidate.food.id}`;
}

/**
 * RESOLVER-V3-019: wraps any `FoodCatalogResolver` and, only after it has already independently
 * found source-grounded candidates, checks the current owner's private, exact-match personal
 * resolution memory (RESOLVER-V3-017/026) for those same candidates. It never adds a candidate
 * the base resolver did not already find, never reads another owner's data (fails closed with no
 * owner), and never turns a lookup failure into a resolution failure — any error, missing owner,
 * or empty match set silently returns the base decision unchanged. `AI` is not wired into any
 * production resolver today (RESOLVER-V3-010 remains blocked), so "avoiding an AI call" is
 * measured as avoiding what would otherwise have been a non-`accepted` (`ambiguous`/`rejected`)
 * decision — the exact situation a future hybrid path would need to escalate to AI for.
 *
 * `'user'`-sourced candidates (the alias fast path, `SupabaseUserAliasSource`) are deliberately
 * excluded from lookup: they are a different, already-deterministic personal-data mechanism, and
 * mixing the two would blur the read boundary this task is scoped to.
 */
export class PersonalResolutionMemoryAwareFoodCatalogResolver implements FoodCatalogResolver {
  constructor(
    private readonly inner: FoodCatalogResolver,
    private readonly readUseCase: ReadPersonalResolutionMemoryUseCase,
    private readonly ownerProvider: ResolverObservationOwnerProvider = new NoopResolverObservationOwnerProvider(),
    private readonly telemetry: PersonalResolutionMemoryReadTelemetry = new NoopPersonalResolutionMemoryReadTelemetry(),
  ) {}

  async resolve(query: FoodSearchQuery, ctx?: { traceId?: string }): Promise<ResolverDecision> {
    const decision = await this.inner.resolve(query, ctx);
    try {
      return await this.applyPersonalMemory(decision);
    } catch {
      return decision;
    }
  }

  private async applyPersonalMemory(decision: ResolverDecision): Promise<ResolverDecision> {
    const eligibleCandidates = decision.candidates.filter((c) => c.food.source !== 'user');
    if (eligibleCandidates.length === 0) return decision;

    const ownerId = await this.ownerProvider.getOwnerId();
    if (!ownerId) return decision;

    const targets = eligibleCandidates.map((c) => ({
      sourceType: c.food.source,
      sourceId: c.food.sourceId ?? c.food.id,
    }));

    const result = await this.readUseCase.execute({
      contractVersion: PERSONAL_RESOLUTION_MEMORY_READ_CONTRACT_VERSION,
      ownerId,
      targets,
    });

    if (result.status !== 'ok' || result.matches.length === 0) {
      this.telemetry.record({
        ownerPresent: true,
        targetCount: targets.length,
        matchCount: 0,
        deterministicReuseMatchCount: 0,
        preferredMatchCount: 0,
        avoided: false,
      });
      return decision;
    }

    // Look the match up per-candidate, walking `eligibleCandidates` in the base resolver's own
    // (already deterministic, score-sorted) order — never `result.matches`' own order, which is
    // unordered SQL row order and must not be allowed to decide the outcome when an owner
    // happens to have more than one active memory among this single decision's candidates.
    const matchByScopeKey = new Map<string, (typeof result.matches)[number]>(
      result.matches.map((m) => [`${m.sourceType}:${m.sourceId}`, m]),
    );
    const deterministicCandidate = eligibleCandidates.find(
      (c) => matchByScopeKey.get(candidateScopeKey(c))?.eligibility.deterministicReuse,
    );
    const preferredCandidate = eligibleCandidates.find(
      (c) => matchByScopeKey.get(candidateScopeKey(c))?.eligibility.preferred,
    );

    let next = decision;
    let avoided = false;

    if (deterministicCandidate) {
      const alreadyAcceptedAsThis =
        decision.status === 'accepted' && decision.best === deterministicCandidate;
      avoided = !alreadyAcceptedAsThis;
      next = {
        ...decision,
        status: 'accepted',
        best: alreadyAcceptedAsThis ? decision.best : boostCandidate(deterministicCandidate),
        reasonCodes: [...decision.reasonCodes, REASON_CODE_P2_CONFIRMED],
      };
    } else if (preferredCandidate) {
      next = { ...decision, reasonCodes: [...decision.reasonCodes, REASON_CODE_P1_PREFERRED] };
    }

    this.telemetry.record({
      ownerPresent: true,
      targetCount: targets.length,
      matchCount: result.matches.length,
      deterministicReuseMatchCount: result.matches.filter((m) => m.eligibility.deterministicReuse)
        .length,
      preferredMatchCount: result.matches.filter((m) => m.eligibility.preferred).length,
      avoided,
    });

    return next;
  }
}

function boostCandidate(candidate: ResolvedFoodCandidate): ResolvedFoodCandidate {
  return {
    ...candidate,
    score: PERSONAL_MEMORY_P2_CONFIRMED_SCORE,
    breakdown: {
      ...candidate.breakdown,
      finalScore: PERSONAL_MEMORY_P2_CONFIRMED_SCORE,
      notes: [...candidate.breakdown.notes, 'personal_resolution_memory_p2_confirmed'],
    },
  };
}
