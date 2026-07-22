import fs from 'fs';
import path from 'path';
import {
  RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
  type ResolverKnowledgeCandidate,
} from '../domain/models/ResolverKnowledgeCandidate';
import {
  RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
  RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS,
  RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
  type ResolverKnowledgeReviewAction,
  type ResolverKnowledgeReviewRequest,
} from '../domain/models/ResolverKnowledgeReview';
import { ResolverKnowledgeReviewService } from '../application/knowledge/ResolverKnowledgeReviewService';
import {
  InMemoryResolverKnowledgeReviewCandidateReader,
  InMemoryResolverKnowledgeReviewRepository,
  type ResolverKnowledgeReviewFailureStage,
} from '../infrastructure/knowledge/InMemoryResolverKnowledgeReviewRepository';

const now = '2026-07-21T12:00:00.000Z';

function buildCandidate(
  overrides: Partial<ResolverKnowledgeCandidate> = {},
): ResolverKnowledgeCandidate {
  return {
    candidateId: 'rkc-v1-primary',
    contractVersion: RESOLVER_KNOWLEDGE_CANDIDATE_CONTRACT_VERSION,
    candidateType: 'source-routing-pattern',
    fingerprint: 'rkc-v1-primary',
    payload: {
      type: 'source-routing-pattern',
      locale: 'de',
      inputType: 'generic',
      sourceType: 'bls',
    },
    evidence: {
      supportingEvidenceCount: 5,
      contradictingEvidenceCount: 0,
      abstentionSignalCount: 0,
      clarificationSignalCount: 0,
      contradictionStatus: 'none',
      negativeEvidenceSummary: 'none',
      independentUserEvidence: 'not_evaluable',
      locales: ['de'],
      inputTypes: ['generic'],
      sourceTypes: ['bls'],
      provenanceStatuses: ['source_grounded'],
      reasonCodes: ['ACCEPTED_STRONG_MATCH'],
      privacyPolicyVersions: [RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION],
      observationContractVersions: ['resolver-observation-v1'],
      resolverVersions: ['resolver-v3'],
    },
    risk: 'low',
    status: 'pending_review',
    duplicateOfCandidateId: null,
    supersededByCandidateId: null,
    quarantineReasonCode: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

function request(
  candidate: ResolverKnowledgeCandidate,
  action: ResolverKnowledgeReviewAction,
  overrides: Record<string, unknown> = {},
): ResolverKnowledgeReviewRequest {
  return {
    decisionId: 'd1',
    candidateId: candidate.candidateId,
    action,
    reasonCode: RESOLVER_KNOWLEDGE_REVIEW_LEGAL_REASONS[action][0],
    occurredAt: now,
    reviewContractVersion: RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
    privacyPolicyVersion: RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
    candidateVersionAtDecision: candidate.updatedAt,
    riskDecision: candidate.risk,
    localeRestriction: 'restricted_to_candidate_locale',
    ...overrides,
  } as ResolverKnowledgeReviewRequest;
}

function subject(
  options: {
    authorized?: boolean;
    reviewerId?: string;
    candidates?: ResolverKnowledgeCandidate[];
  } = {},
) {
  const authorized = options.authorized ?? true;
  const reviewerId = options.reviewerId ?? 'reviewer-1';
  const store = {
    candidates: options.candidates ?? [buildCandidate()],
    events:
      [] as import('../domain/models/ResolverKnowledgeCandidate').ResolverKnowledgeCandidateLifecycleEvent[],
  };
  const reader = new InMemoryResolverKnowledgeReviewCandidateReader(store);
  const repository = new InMemoryResolverKnowledgeReviewRepository(store);
  const service = new ResolverKnowledgeReviewService(
    {
      authorizeDeveloperReview: async () =>
        authorized ? { authorized: true, reviewerId } : { authorized: false },
    },
    reader,
    repository,
  );
  return { store, reader, repository, service };
}

function snapshotOf(
  store: ReturnType<typeof subject>['store'],
  repository: InMemoryResolverKnowledgeReviewRepository,
) {
  return {
    candidates: JSON.parse(JSON.stringify(store.candidates)),
    candidateEvents: JSON.parse(JSON.stringify(store.events)),
    approved: JSON.parse(JSON.stringify(repository.approved)),
    reviewEvents: JSON.parse(JSON.stringify(repository.events)),
  };
}

describe('RESOLVER-V3-028 developer knowledge review governance', () => {
  describe('independent-user evidence gating', () => {
    it('blocks approval when independent-user evidence is not_evaluable, regardless of supporting-evidence count', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'not_evaluable',
          supportingEvidenceCount: 100000,
        },
      });
      const { service } = subject({ candidates: [candidate] });
      const before = candidate.status;
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('blocked_privacy');
      expect(candidate.status).toBe(before);
    });

    it('allows approval only for the closed positively-evaluated independent-user state', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, repository } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('applied');
      expect(repository.approved[0]).toMatchObject({
        candidateId: candidate.candidateId,
        status: 'active',
      });
    });

    it('does not invent a numeric independent-user-count threshold', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '../application/knowledge/ResolverKnowledgeReviewService.ts'),
        'utf8',
      );
      expect(source).not.toMatch(/independentUserEvidence\s*[<>]=?\s*\d/);
      expect(source).not.toMatch(/independentUserCount/i);
    });
  });

  describe('authorization', () => {
    it('produces zero mutations for an unauthorized review attempt', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({
        authorized: false,
        candidates: [candidate],
      });
      const before = snapshotOf(store, repository);
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_unauthorized',
      );
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('per-action legal lifecycle transitions', () => {
    it('approve: pending_review -> approved, with candidate lifecycle, payload, and event committed together', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('applied');
      expect(store.candidates[0].status).toBe('approved');
      expect(store.events[0]).toMatchObject({
        nextStatus: 'approved',
        reasonCode: 'APPROVED_BY_REVIEW',
      });
      expect(repository.approved[0]).toMatchObject({ status: 'active' });
      expect(repository.events).toHaveLength(1);
    });

    it.each([
      ['reject', 'rejected', 'REJECTED_BY_REVIEW'],
      ['needs_more_evidence', 'needs_more_evidence', 'INSUFFICIENT_EVIDENCE'],
      ['quarantine', 'quarantined', 'QUARANTINE_PRIVACY_REVIEW'],
    ] as const)(
      '%s: pending_review -> %s updates candidate lifecycle state, not just an event',
      async (action, nextStatus, reasonCode) => {
        const candidate = buildCandidate();
        const { service, store, repository } = subject({ candidates: [candidate] });
        await expect(service.review(request(candidate, action))).resolves.toBe('applied');
        expect(store.candidates[0].status).toBe(nextStatus);
        expect(store.events[0]).toMatchObject({ nextStatus, reasonCode });
        expect(repository.approved).toHaveLength(0);
        expect(repository.events).toHaveLength(1);
      },
    );

    it('revoke_approval and rollback commit payload state and event atomically without changing candidate.status', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      await service.review(request(candidate, 'approve'));
      await expect(
        service.review(request(candidate, 'revoke_approval', { decisionId: 'd2' })),
      ).resolves.toBe('applied');
      expect(repository.approved[0].status).toBe('revoked');
      expect(store.candidates[0].status).toBe('approved');
      expect(repository.events).toHaveLength(2);

      const rollbackCandidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const rollbackHarness = subject({ candidates: [rollbackCandidate] });
      await rollbackHarness.service.review(request(rollbackCandidate, 'approve'));
      await expect(
        rollbackHarness.service.review(
          request(rollbackCandidate, 'rollback', { decisionId: 'd2' }),
        ),
      ).resolves.toBe('applied');
      expect(rollbackHarness.repository.approved[0].status).toBe('rolled_back');
    });
  });

  describe('invalid transitions fail closed with zero mutation', () => {
    it.each(['approve', 'reject', 'needs_more_evidence', 'quarantine'] as const)(
      '%s is invalid from a non-pending_review status',
      async (action) => {
        const candidate = buildCandidate({
          status: 'candidate',
          evidence: {
            ...buildCandidate().evidence,
            independentUserEvidence: 'independently_confirmed',
          },
        });
        const { service, store, repository } = subject({ candidates: [candidate] });
        const before = snapshotOf(store, repository);
        await expect(service.review(request(candidate, action))).resolves.toBe(
          'invalid_transition',
        );
        expect(snapshotOf(store, repository)).toEqual(before);
      },
    );

    it.each(['revoke_approval', 'rollback'] as const)(
      '%s is invalid without a prior active approval',
      async (action) => {
        const candidate = buildCandidate({ status: 'pending_review' });
        const { service, store, repository } = subject({ candidates: [candidate] });
        const before = snapshotOf(store, repository);
        await expect(service.review(request(candidate, action))).resolves.toBe(
          'invalid_transition',
        );
        expect(snapshotOf(store, repository)).toEqual(before);
      },
    );
  });

  describe('duplicate and supersession targets', () => {
    it('requires a valid, existing target candidate', async () => {
      const candidate = buildCandidate();
      const target = buildCandidate({ candidateId: 'rkc-v1-target', fingerprint: 'rkc-v1-target' });
      const { service, store, repository } = subject({ candidates: [candidate, target] });
      await expect(
        service.review(
          request(candidate, 'mark_duplicate', { targetCandidateId: target.candidateId }),
        ),
      ).resolves.toBe('applied');
      expect(
        store.candidates.find((c) => c.candidateId === candidate.candidateId)
          ?.duplicateOfCandidateId,
      ).toBe(target.candidateId);

      const supersedeCandidate = buildCandidate();
      const supersedeTarget = buildCandidate({
        candidateId: 'rkc-v1-target-2',
        fingerprint: 'rkc-v1-target-2',
      });
      const harness = subject({ candidates: [supersedeCandidate, supersedeTarget] });
      await expect(
        harness.service.review(
          request(supersedeCandidate, 'supersede', {
            targetCandidateId: supersedeTarget.candidateId,
          }),
        ),
      ).resolves.toBe('applied');
      expect(harness.store.candidates[0].supersededByCandidateId).toBe(supersedeTarget.candidateId);
      expect(repository.events).toHaveLength(1);
    });

    it('fails closed for a self-reference (no target ambiguity permitted)', async () => {
      const candidate = buildCandidate();
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(
        service.review(
          request(candidate, 'mark_duplicate', { targetCandidateId: candidate.candidateId }),
        ),
      ).resolves.toBe('validation_failed');
      expect(snapshotOf(store, repository)).toEqual(before);
    });

    it('fails closed for a missing target candidate', async () => {
      const candidate = buildCandidate();
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(
        service.review(request(candidate, 'supersede', { targetCandidateId: 'does-not-exist' })),
      ).resolves.toBe('candidate_not_found');
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('atomicity via deterministic failure injection', () => {
    it.each([
      'candidate',
      'payload',
      'event',
    ] as const satisfies readonly ResolverKnowledgeReviewFailureStage[])(
      'a thrown failure at the %s stage during approve leaves every store unchanged',
      async (stage) => {
        const candidate = buildCandidate({
          evidence: {
            ...buildCandidate().evidence,
            independentUserEvidence: 'independently_confirmed',
          },
        });
        const { service, store, repository } = subject({ candidates: [candidate] });
        const before = snapshotOf(store, repository);
        repository.failureInjector = (injectedStage) => {
          if (injectedStage === stage) throw new Error('injected-failure');
        };
        await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
          'persistence_failed',
        );
        expect(snapshotOf(store, repository)).toEqual(before);
      },
    );

    it('a thrown failure during reject leaves candidate and event stores unchanged', async () => {
      const candidate = buildCandidate();
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      repository.failureInjector = (stage) => {
        if (stage === 'event') throw new Error('injected-failure');
      };
      await expect(service.review(request(candidate, 'reject'))).resolves.toBe(
        'persistence_failed',
      );
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('idempotency and conflict detection', () => {
    it('a literal retry of an applied decision is idempotent and produces zero additional mutation', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      const req = request(candidate, 'approve');
      await expect(service.review(req)).resolves.toBe('applied');
      const after = snapshotOf(store, repository);
      await expect(service.review(req)).resolves.toBe('already_applied');
      expect(snapshotOf(store, repository)).toEqual(after);
    });

    it('rejects a conflicting reuse of the same decisionId with different content instead of a false already_applied', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('applied');
      const after = snapshotOf(store, repository);
      await expect(
        service.review(
          request(candidate, 'approve', {
            decisionId: 'd1',
            occurredAt: '2026-07-21T13:00:00.000Z',
          }),
        ),
      ).resolves.toBe('conflict');
      expect(snapshotOf(store, repository)).toEqual(after);
    });
  });

  describe('audit completeness', () => {
    it('persists reviewer identity, versions, closed reason, risk decision, restriction, target, and an immutable review-material snapshot', async () => {
      const target = buildCandidate({ candidateId: 'rkc-v1-target', fingerprint: 'rkc-v1-target' });
      const candidate = buildCandidate();
      const { service, repository, reader } = subject({
        candidates: [candidate, target],
        reviewerId: 'reviewer-42',
      });
      await expect(
        service.review(
          request(candidate, 'mark_duplicate', { targetCandidateId: target.candidateId }),
        ),
      ).resolves.toBe('applied');
      const event = repository.events[0];
      expect(event).toMatchObject({
        reviewerId: 'reviewer-42',
        reviewContractVersion: RESOLVER_KNOWLEDGE_REVIEW_CONTRACT_VERSION,
        privacyPolicyVersion: RESOLVER_KNOWLEDGE_REVIEW_PRIVACY_POLICY_VERSION,
        candidateVersionAtDecision: candidate.updatedAt,
        riskDecision: candidate.risk,
        localeRestriction: 'restricted_to_candidate_locale',
        reasonCode: 'DUPLICATE_OF_EXISTING_CANDIDATE',
        targetCandidateId: target.candidateId,
      });
      expect(event.reviewMaterialSnapshot).toMatchObject({
        candidateType: candidate.candidateType,
        payload: candidate.payload,
        risk: candidate.risk,
        candidateStatus: 'pending_review',
      });
      const untouchedTarget = await reader.getById(target.candidateId);
      expect(untouchedTarget?.status).toBe('pending_review');
    });
  });

  describe('recursive privacy rejection', () => {
    it('rejects a private/linkable field nested below the top level, not only at the top level', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          // Nested two levels deep inside an otherwise-legitimate evidence field.
          reasonCodes: ['ACCEPTED_STRONG_MATCH'],
        },
      });
      (candidate as any).payload = {
        ...candidate.payload,
        nested: { deeply: { ownerId: 'should-never-appear' } },
      };
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(service.review(request(candidate, 'reject'))).resolves.toBe('blocked_privacy');
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('unknown versions and enum values fail closed', () => {
    it.each([
      ['reviewContractVersion', 'resolver-knowledge-review-v0'],
      ['privacyPolicyVersion', 'resolver-observation-privacy-v0'],
      ['reasonCode', 'NOT_A_REAL_REASON'],
      ['riskDecision', 'critical'],
      ['action', 'delete_forever'],
    ])('fails closed for unknown %s', async (field, value) => {
      const candidate = buildCandidate();
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      const result = await service.review(request(candidate, 'reject', { [field]: value }));
      expect(['validation_failed', 'blocked_privacy']).toContain(result);
      expect(snapshotOf(store, repository)).toEqual(before);
    });

    it('fails closed for an undetermined locale restriction on approve', async () => {
      const candidate = buildCandidate({
        evidence: {
          ...buildCandidate().evidence,
          independentUserEvidence: 'independently_confirmed',
        },
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(
        service.review(request(candidate, 'approve', { localeRestriction: 'unknown' })),
      ).resolves.toBe('blocked_privacy');
      expect(snapshotOf(store, repository)).toEqual(before);
    });

    it('fails closed for a stale candidateVersionAtDecision', async () => {
      const candidate = buildCandidate();
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(
        service.review(
          request(candidate, 'reject', { candidateVersionAtDecision: '2020-01-01T00:00:00.000Z' }),
        ),
      ).resolves.toBe('validation_failed');
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('no resolver-visible effect', () => {
    it('has no dependency on the production resolver decision path', () => {
      const service = fs.readFileSync(
        path.resolve(__dirname, '../application/knowledge/ResolverKnowledgeReviewService.ts'),
        'utf8',
      );
      const repository = fs.readFileSync(
        path.resolve(
          __dirname,
          '../infrastructure/knowledge/InMemoryResolverKnowledgeReviewRepository.ts',
        ),
        'utf8',
      );
      for (const source of [service, repository]) {
        expect(source).not.toMatch(
          /SequentialFoodCatalogResolver|DefaultFoodCatalogResolver|FusionCandidateResolver|FusionResolverAdapter|supabase|fetch\(/i,
        );
      }
    });
  });
});

describe('RESOLVER-V3-037 contradiction-aware review approval gate', () => {
  function candidateWithEvidence(
    overrides: Partial<ResolverKnowledgeCandidate['evidence']> = {},
    candidateOverrides: Partial<ResolverKnowledgeCandidate> = {},
  ): ResolverKnowledgeCandidate {
    return buildCandidate({
      evidence: { ...buildCandidate().evidence, ...overrides },
      ...candidateOverrides,
    });
  }

  describe('exact RESOLVER-V3-023 / LBV2-GC-DEV-006 defect reproduction', () => {
    it('blocks the exact fixture state (independently_confirmed + present + count 1) as blocked_contradiction with zero mutation', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 1,
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      let applyDecisionCalled = false;
      const originalApplyDecision = repository.applyDecision.bind(repository);
      repository.applyDecision = async (plan) => {
        applyDecisionCalled = true;
        return originalApplyDecision(plan);
      };

      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_contradiction',
      );

      expect(applyDecisionCalled).toBe(false);
      expect(candidate.status).toBe('pending_review');
      expect(snapshotOf(store, repository)).toEqual(before);
      expect(store.events).toHaveLength(0);
      expect(repository.events).toHaveLength(0);
      expect(repository.approved).toHaveLength(0);
    });
  });

  describe('independent gate ordering (contradiction checked before independent-user evidence)', () => {
    it.each([
      ['independently_confirmed', 'blocked_contradiction'],
      ['not_evaluable', 'blocked_contradiction'],
    ] as const)(
      'contradiction present + independentUserEvidence=%s -> %s (contradiction result is unaffected by evidence state)',
      async (independentUserEvidence, expected) => {
        const candidate = candidateWithEvidence({
          independentUserEvidence,
          contradictionStatus: 'present',
          contradictingEvidenceCount: 3,
        });
        const { service, store, repository } = subject({ candidates: [candidate] });
        const before = snapshotOf(store, repository);
        await expect(service.review(request(candidate, 'approve'))).resolves.toBe(expected);
        expect(snapshotOf(store, repository)).toEqual(before);
      },
    );

    it('no contradiction + not_evaluable -> existing blocked_privacy (unchanged)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'not_evaluable',
        contradictionStatus: 'none',
        contradictingEvidenceCount: 0,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('blocked_privacy');
    });

    it('no contradiction + independently_confirmed -> existing successful approval (unchanged)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'none',
        contradictingEvidenceCount: 0,
      });
      const { service, repository } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('applied');
      expect(repository.approved).toHaveLength(1);
    });

    it('no contradiction + confirmed + unknown locale -> existing blocked_privacy (unchanged)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'none',
        contradictingEvidenceCount: 0,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(
        service.review(request(candidate, 'approve', { localeRestriction: 'unknown' })),
      ).resolves.toBe('blocked_privacy');
    });
  });

  describe('zero threshold (no acceptable contradiction count)', () => {
    it('a contradiction count of 1 blocks', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 1,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_contradiction',
      );
    });

    it('a large contradiction count blocks identically to a count of 1 (no threshold)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 1_000_000,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_contradiction',
      );
    });

    it('a large supportingEvidenceCount cannot override a coherent contradiction', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 1,
        supportingEvidenceCount: 1_000_000,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_contradiction',
      );
    });

    it('does not invent a numeric contradiction-count threshold in source', () => {
      const source = fs.readFileSync(
        path.resolve(__dirname, '../application/knowledge/ResolverKnowledgeReviewService.ts'),
        'utf8',
      );
      // Legitimate runtime coherence checks compare only against 0 (`>= 0`, `=== 0`, `!== 0`); no
      // comparison against any nonzero number (a threshold) is permitted.
      expect(source).not.toMatch(/contradictingEvidenceCount\s*[<>]=?\s*[1-9]/);
      expect(source).not.toMatch(/contradictionThreshold/i);
    });
  });

  describe('runtime evidence coherence for approve', () => {
    it('none + 0 is valid (contradiction gate passes)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'none',
        contradictingEvidenceCount: 0,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe('applied');
    });

    it('present + positive integer is valid, but blocked', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 4,
      });
      const { service } = subject({ candidates: [candidate] });
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'blocked_contradiction',
      );
    });

    it.each([
      ['none + positive count', 'none', 2],
      ['present + zero count', 'present', 0],
      ['negative count', 'present', -1],
      ['fractional count', 'present', 1.5],
      ['NaN count', 'present', NaN],
      ['positive infinity count', 'present', Infinity],
      ['negative infinity count', 'present', -Infinity],
    ] as const)(
      '%s -> validation_failed with zero mutation',
      async (_label, contradictionStatus, contradictingEvidenceCount) => {
        const candidate = candidateWithEvidence({
          independentUserEvidence: 'independently_confirmed',
          contradictionStatus,
          contradictingEvidenceCount,
        });
        const { service, store, repository } = subject({ candidates: [candidate] });
        const before = snapshotOf(store, repository);
        await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
          'validation_failed',
        );
        expect(snapshotOf(store, repository)).toEqual(before);
      },
    );

    it('a non-number contradiction count -> validation_failed with zero mutation (adversarial runtime cast)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
      });
      (candidate.evidence as unknown as Record<string, unknown>).contradictingEvidenceCount =
        '3' as unknown;
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'validation_failed',
      );
      expect(snapshotOf(store, repository)).toEqual(before);
    });

    it('an unknown contradiction status -> validation_failed with zero mutation (adversarial runtime cast)', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictingEvidenceCount: 1,
      });
      (candidate.evidence as unknown as Record<string, unknown>).contradictionStatus =
        'unknown' as unknown;
      const { service, store, repository } = subject({ candidates: [candidate] });
      const before = snapshotOf(store, repository);
      await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
        'validation_failed',
      );
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });

  describe('applies to every candidate type; no candidate-type exemption', () => {
    it.each([
      [
        'source-routing-pattern',
        { type: 'source-routing-pattern', locale: 'de', inputType: 'generic', sourceType: 'bls' },
      ],
      [
        'abstention-policy-signal',
        {
          type: 'abstention-policy-signal',
          locale: 'de',
          inputType: 'generic',
          reasonCode: 'NO_CANDIDATES',
        },
      ],
      [
        'clarification-policy-signal',
        {
          type: 'clarification-policy-signal',
          locale: 'de',
          inputType: 'generic',
          reasonCode: 'MULTIPLE_CLOSE_MATCHES',
        },
      ],
      ['provenance-gap', { type: 'provenance-gap', locale: 'de', inputType: 'generic' }],
      [
        'negative-source-routing-rule',
        {
          type: 'negative-source-routing-rule',
          locale: 'de',
          inputType: 'generic',
          sourceType: 'bls',
          reasonCode: 'NO_CANDIDATES',
        },
      ],
    ] as const)(
      '%s is blocked when coherent contradiction evidence is present',
      async (candidateType, payload) => {
        const candidate = candidateWithEvidence(
          {
            independentUserEvidence: 'independently_confirmed',
            contradictionStatus: 'present',
            contradictingEvidenceCount: 1,
          },
          { candidateType, payload: payload as ResolverKnowledgeCandidate['payload'] },
        );
        const { service } = subject({ candidates: [candidate] });
        await expect(service.review(request(candidate, 'approve'))).resolves.toBe(
          'blocked_contradiction',
        );
      },
    );
  });

  describe('non-approve actions remain legal for contradicting evidence', () => {
    it('needs_more_evidence with CONTRADICTING_EVIDENCE remains legal', async () => {
      const candidate = candidateWithEvidence({
        contradictionStatus: 'present',
        contradictingEvidenceCount: 2,
      });
      const { service, store } = subject({ candidates: [candidate] });
      await expect(
        service.review(
          request(candidate, 'needs_more_evidence', { reasonCode: 'CONTRADICTING_EVIDENCE' }),
        ),
      ).resolves.toBe('applied');
      expect(store.candidates[0].status).toBe('needs_more_evidence');
    });

    it('reject with CONTRADICTING_EVIDENCE remains legal', async () => {
      const candidate = candidateWithEvidence({
        contradictionStatus: 'present',
        contradictingEvidenceCount: 2,
      });
      const { service, store } = subject({ candidates: [candidate] });
      await expect(
        service.review(request(candidate, 'reject', { reasonCode: 'CONTRADICTING_EVIDENCE' })),
      ).resolves.toBe('applied');
      expect(store.candidates[0].status).toBe('rejected');
    });
  });

  describe('idempotency of a blocked contradiction attempt', () => {
    it('repeating the exact same blocked request returns blocked_contradiction again, not already_applied, with zero mutation both times', async () => {
      const candidate = candidateWithEvidence({
        independentUserEvidence: 'independently_confirmed',
        contradictionStatus: 'present',
        contradictingEvidenceCount: 1,
      });
      const { service, store, repository } = subject({ candidates: [candidate] });
      const req = request(candidate, 'approve');
      const before = snapshotOf(store, repository);
      await expect(service.review(req)).resolves.toBe('blocked_contradiction');
      expect(snapshotOf(store, repository)).toEqual(before);
      await expect(service.review(req)).resolves.toBe('blocked_contradiction');
      expect(snapshotOf(store, repository)).toEqual(before);
    });
  });
});
