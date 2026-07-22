import {
  planResolverKnowledgeContributionRecording,
  type ResolverKnowledgeContributionRecordingRequest,
} from '../../application/knowledge/ResolverKnowledgeContributionRecordingPlanner';
import { planResolverKnowledgeContributionRetraction } from '../../application/knowledge/ResolverKnowledgeContributionRetractionPlanner';
import { resolveResolverKnowledgeCandidateTerminalChain } from '../../application/knowledge/ResolverKnowledgeCandidateTerminalChainResolver';
import {
  computeResolverKnowledgeContributionReplaySummary,
  mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence,
} from '../../application/knowledge/ResolverKnowledgeContributionReplaySummaryCalculator';
import type {
  ResolverKnowledgeContributionLedgerRepository,
  ResolverKnowledgeContributionRecordingResult,
  ResolverKnowledgeContributionRetractionResult,
} from '../../application/ports/ResolverKnowledgeContributionLedgerRepository';
import type { ResolverKnowledgeFingerprintHasher } from '../../application/ports/ResolverKnowledgeFingerprintHasher';
import type {
  ResolverKnowledgeCandidate,
  ResolverKnowledgeCandidateLifecycleEvent,
} from '../../domain/models/ResolverKnowledgeCandidate';
import type {
  ResolverKnowledgeContribution,
  ResolverKnowledgeContributionRetractionEvent,
  ResolverKnowledgeContributionRetractionRequest,
} from '../../domain/models/ResolverKnowledgeContributionLedger';

/** Structural shape shared with the candidate/review in-memory repositories (same pattern as
 * `ResolverKnowledgeReviewSharedCandidateStore`) — the ledger never keeps a second, divergent copy
 * of candidate rows; it reads and writes only the `evidence` field of the shared store's rows. */
export interface ResolverKnowledgeContributionLedgerSharedCandidateStore {
  readonly candidates: ResolverKnowledgeCandidate[];
  readonly events: ResolverKnowledgeCandidateLifecycleEvent[];
}

export type ResolverKnowledgeContributionLedgerFailureStage =
  | 'candidate_stage'
  | 'contribution_stage'
  | 'chain_resolution_stage'
  | 'summary_recomputation_stage'
  | 'cache_replacement_stage'
  | 'retraction_stage';

/**
 * Reference in-memory contribution-ledger repository (RESOLVER-V3-032 binding requirement §22-§23).
 * `recordContribution` and `retractContributions` are each a single coherent write boundary:
 * candidate creation, contribution append, retraction-event append, canonical routing, summary
 * recomputation, and cached-summary replacement are all staged against a pre-call snapshot and
 * only committed once every internal step completes without throwing (mirroring
 * `InMemoryResolverKnowledgeReviewRepository.applyDecision`'s snapshot/restore pattern). Any thrown
 * error — including a test-injected `failureInjector` — restores every store to its pre-call state
 * and returns a `failed` result; there is no partial commit.
 *
 * This proves only the reference in-memory contract's atomicity. It is not evidence that a future
 * database implementation (RESOLVER-V3-033) is atomic.
 */
export class InMemoryResolverKnowledgeContributionLedgerRepository implements ResolverKnowledgeContributionLedgerRepository {
  readonly contributions: ResolverKnowledgeContribution[] = [];
  readonly retractionEvents: ResolverKnowledgeContributionRetractionEvent[] = [];
  private readonly retractionActionLog = new Map<
    string,
    ResolverKnowledgeContributionRetractionRequest
  >();

  /** Test-only deterministic failure injection hook; must stay unset in any real usage. */
  failureInjector: ((stage: ResolverKnowledgeContributionLedgerFailureStage) => void) | null = null;

  constructor(
    private readonly candidateStore: ResolverKnowledgeContributionLedgerSharedCandidateStore,
    private readonly hasher: ResolverKnowledgeFingerprintHasher,
  ) {}

  /** Test-only private readback — never used by any global-facing reader. */
  getPrivateContributionsForTesting(): readonly ResolverKnowledgeContribution[] {
    return this.contributions.slice();
  }

  /** Test-only private readback — never used by any global-facing reader. */
  getPrivateRetractionEventsForTesting(): readonly ResolverKnowledgeContributionRetractionEvent[] {
    return this.retractionEvents.slice();
  }

  private activeContributionsRoutedTo(
    terminalCandidateId: string,
  ): ResolverKnowledgeContribution[] {
    const retractedIds = new Set(this.retractionEvents.map((event) => event.contributionId));
    return this.contributions.filter((contribution) => {
      if (retractedIds.has(contribution.contributionId)) return false;
      const chain = resolveResolverKnowledgeCandidateTerminalChain(
        contribution.originalCandidateId,
        this.candidateStore.candidates,
      );
      return chain.status === 'resolved' && chain.terminalCandidateId === terminalCandidateId;
    });
  }

  private recomputeCandidateSummary(candidateId: string): boolean {
    const candidate = this.candidateStore.candidates.find(
      (value) => value.candidateId === candidateId,
    );
    if (!candidate) return false;
    const active = this.activeContributionsRoutedTo(candidateId);
    const summary = computeResolverKnowledgeContributionReplaySummary(
      candidate.payload,
      active,
      candidate.contractVersion,
    );
    candidate.evidence = mapResolverKnowledgeContributionReplaySummaryToLegacyEvidence(summary);
    return true;
  }

  private snapshotCandidates(): ResolverKnowledgeCandidate[] {
    return this.candidateStore.candidates.map((candidate) => ({
      ...candidate,
      evidence: { ...candidate.evidence },
    }));
  }

  private restoreCandidates(snapshot: readonly ResolverKnowledgeCandidate[]): void {
    this.candidateStore.candidates.splice(0, this.candidateStore.candidates.length, ...snapshot);
  }

  async recordContribution(
    request: ResolverKnowledgeContributionRecordingRequest,
  ): Promise<ResolverKnowledgeContributionRecordingResult> {
    const plan = await planResolverKnowledgeContributionRecording(
      request,
      this.candidateStore.candidates,
      this.contributions,
      this.hasher,
    );

    if (plan.status === 'already_recorded')
      return {
        status: 'already_recorded',
        contributionId: plan.contributionId,
        candidateId: plan.terminalCandidateId,
      };
    if (plan.status === 'conflict')
      return { status: 'conflict', contributionId: plan.contributionId };
    if (plan.status === 'failed') return { status: 'failed', code: plan.code };

    const candidatesSnapshot = this.snapshotCandidates();
    const contributionsSnapshot = this.contributions.slice();

    try {
      this.failureInjector?.('candidate_stage');
      if (plan.createCandidate) this.candidateStore.candidates.push(plan.createCandidate);

      this.failureInjector?.('contribution_stage');
      this.contributions.push(plan.contribution);

      this.failureInjector?.('chain_resolution_stage');
      const chain = resolveResolverKnowledgeCandidateTerminalChain(
        plan.terminalCandidateId,
        this.candidateStore.candidates,
      );
      if (chain.status !== 'resolved') throw new Error('CHAIN_RESOLUTION_FAILED_DURING_COMMIT');

      this.failureInjector?.('summary_recomputation_stage');
      if (!this.recomputeCandidateSummary(plan.terminalCandidateId))
        throw new Error('TERMINAL_CANDIDATE_MISSING_DURING_COMMIT');

      this.failureInjector?.('cache_replacement_stage');
      return {
        status: 'recorded',
        contributionId: plan.contribution.contributionId,
        candidateId: plan.terminalCandidateId,
      };
    } catch {
      this.restoreCandidates(candidatesSnapshot);
      this.contributions.splice(0, this.contributions.length, ...contributionsSnapshot);
      return { status: 'failed', code: 'staging_failed' };
    }
  }

  async retractContributions(
    request: unknown,
  ): Promise<ResolverKnowledgeContributionRetractionResult> {
    const plan = await planResolverKnowledgeContributionRetraction(
      request,
      this.contributions,
      this.retractionEvents,
      this.retractionActionLog,
      this.hasher,
    );

    if (plan.status === 'failed') return { status: 'failed', code: plan.code };
    if (plan.status === 'already_recorded') return { status: 'already_recorded' };
    if (plan.status === 'conflict') return { status: 'conflict' };
    if (plan.status === 'no_op') {
      // A validated action ID is remembered even on a zero-match no-op, so a later reuse of the
      // same action ID with different content still fails closed as a conflict.
      const validatedRequest = request as ResolverKnowledgeContributionRetractionRequest;
      this.retractionActionLog.set(validatedRequest.retractionActionId, validatedRequest);
      return { status: 'no_op' };
    }

    const validatedRequest = request as ResolverKnowledgeContributionRetractionRequest;
    const candidatesSnapshot = this.snapshotCandidates();
    const retractionEventsSnapshot = this.retractionEvents.slice();

    try {
      this.failureInjector?.('retraction_stage');
      this.retractionEvents.push(...plan.newEvents);
      this.retractionActionLog.set(validatedRequest.retractionActionId, validatedRequest);

      this.failureInjector?.('summary_recomputation_stage');
      const affectedTerminalIds = new Set<string>();
      for (const contributionId of plan.affectedContributionIds) {
        const contribution = this.contributions.find(
          (value) => value.contributionId === contributionId,
        );
        if (!contribution) continue;
        const chain = resolveResolverKnowledgeCandidateTerminalChain(
          contribution.originalCandidateId,
          this.candidateStore.candidates,
        );
        if (chain.status === 'resolved') affectedTerminalIds.add(chain.terminalCandidateId);
      }
      for (const candidateId of affectedTerminalIds) this.recomputeCandidateSummary(candidateId);

      this.failureInjector?.('cache_replacement_stage');
      return {
        status: 'applied',
        retractedContributionIds: plan.affectedContributionIds,
        affectedCandidateIds: [...affectedTerminalIds],
      };
    } catch {
      this.restoreCandidates(candidatesSnapshot);
      this.retractionEvents.splice(0, this.retractionEvents.length, ...retractionEventsSnapshot);
      // This action ID was absent from the log before this call (the planner would otherwise have
      // returned `already_recorded`/`conflict`), so on failure it must be removed again rather than
      // left recorded for content that was never actually committed.
      this.retractionActionLog.delete(validatedRequest.retractionActionId);
      return { status: 'failed', code: 'staging_failed' };
    }
  }
}
