import { classifyResolverKnowledgeCandidateContributionRelation } from '../application/knowledge/ResolverKnowledgeCandidateContributionRelationClassifier';

const routing = (overrides: Record<string, unknown> = {}) => ({
  type: 'source-routing-pattern' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  sourceType: 'bls' as const,
  ...overrides,
});
const negativeRouting = (overrides: Record<string, unknown> = {}) => ({
  type: 'negative-source-routing-rule' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  sourceType: 'bls' as const,
  reasonCode: 'NO_CANDIDATES' as const,
  ...overrides,
});
const abstention = (overrides: Record<string, unknown> = {}) => ({
  type: 'abstention-policy-signal' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  reasonCode: 'NO_CANDIDATES' as const,
  ...overrides,
});
const clarification = (overrides: Record<string, unknown> = {}) => ({
  type: 'clarification-policy-signal' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  reasonCode: 'MULTIPLE_CLOSE_MATCHES' as const,
  ...overrides,
});
const provenanceGap = (overrides: Record<string, unknown> = {}) => ({
  type: 'provenance-gap' as const,
  locale: 'de' as const,
  inputType: 'generic' as const,
  ...overrides,
});

const classify = classifyResolverKnowledgeCandidateContributionRelation;

describe('classifyResolverKnowledgeCandidateContributionRelation', () => {
  describe('support', () => {
    it.each([
      ['source-routing-pattern', routing()],
      ['negative-source-routing-rule', negativeRouting()],
      ['abstention-policy-signal', abstention()],
      ['clarification-policy-signal', clarification()],
      ['provenance-gap', provenanceGap()],
    ])('classifies an identical %s payload as support', (_type, payload) => {
      expect(classify(payload, { ...payload })).toBe('support');
    });

    it('is symmetric for identical valid payloads', () => {
      expect(classify(routing(), routing())).toBe(classify(routing(), routing()));
    });
  });

  describe('contradiction', () => {
    it('classifies matching-scope routing vs. negative-routing as contradiction', () => {
      expect(classify(routing(), negativeRouting())).toBe('contradiction');
    });

    it('classifies the mirrored negative-routing vs. routing direction as contradiction', () => {
      expect(classify(negativeRouting(), routing())).toBe('contradiction');
    });

    it('is symmetric for the positive/negative routing pair', () => {
      expect(classify(routing(), negativeRouting())).toBe(classify(negativeRouting(), routing()));
    });

    it('does not contradict on a non-matching source type', () => {
      expect(classify(routing(), negativeRouting({ sourceType: 'off' }))).not.toBe('contradiction');
    });

    it('does not contradict on a non-matching locale', () => {
      expect(classify(routing(), negativeRouting({ locale: 'en' }))).not.toBe('contradiction');
    });

    it('does not contradict on a non-matching input type', () => {
      expect(classify(routing(), negativeRouting({ inputType: 'branded' }))).not.toBe(
        'contradiction',
      );
    });
  });

  describe('orthogonal', () => {
    it('classifies two source-routing patterns with a different source type as orthogonal', () => {
      expect(classify(routing(), routing({ sourceType: 'off' }))).toBe('orthogonal');
    });

    it('classifies two source-routing patterns with a different locale as orthogonal', () => {
      expect(classify(routing(), routing({ locale: 'en' }))).toBe('orthogonal');
    });

    it('classifies two source-routing patterns with a different input type as orthogonal', () => {
      expect(classify(routing(), routing({ inputType: 'branded' }))).toBe('orthogonal');
    });

    it('classifies two negative-routing rules with a different source type as orthogonal', () => {
      expect(classify(negativeRouting(), negativeRouting({ sourceType: 'usda' }))).toBe(
        'orthogonal',
      );
    });

    it('classifies two negative-routing rules with a different locale as orthogonal', () => {
      expect(classify(negativeRouting(), negativeRouting({ locale: 'en' }))).toBe('orthogonal');
    });

    it('classifies two negative-routing rules with a different input type as orthogonal', () => {
      expect(classify(negativeRouting(), negativeRouting({ inputType: 'branded' }))).toBe(
        'orthogonal',
      );
    });

    it('classifies routing vs. negative-routing with a non-matching scope as orthogonal', () => {
      expect(classify(routing(), negativeRouting({ sourceType: 'off' }))).toBe('orthogonal');
    });

    it('classifies same-scope routing vs. abstention as orthogonal (distinct signal, not a contradiction)', () => {
      expect(classify(routing(), abstention())).toBe('orthogonal');
      expect(classify(abstention(), routing())).toBe('orthogonal');
    });

    it('classifies same-scope routing vs. clarification as orthogonal', () => {
      expect(classify(routing(), clarification())).toBe('orthogonal');
      expect(classify(clarification(), routing())).toBe('orthogonal');
    });

    it('classifies same-scope routing vs. provenance-gap as orthogonal', () => {
      expect(classify(routing(), provenanceGap())).toBe('orthogonal');
      expect(classify(provenanceGap(), routing())).toBe('orthogonal');
    });

    it('is symmetric for the matrix-defined orthogonal relations', () => {
      expect(classify(routing(), routing({ locale: 'en' }))).toBe(
        classify(routing({ locale: 'en' }), routing()),
      );
      expect(classify(routing(), abstention())).toBe(classify(abstention(), routing()));
    });
  });

  describe('not_evaluable', () => {
    it('does not invent a contradiction between abstention and clarification', () => {
      expect(classify(abstention(), clarification())).toBe('not_evaluable');
      expect(classify(clarification(), abstention())).toBe('not_evaluable');
    });

    it('does not invent a contradiction between clarification and provenance-gap', () => {
      expect(classify(clarification(), provenanceGap())).toBe('not_evaluable');
      expect(classify(provenanceGap(), clarification())).toBe('not_evaluable');
    });

    it('does not invent a contradiction between two different abstention reasons', () => {
      expect(classify(abstention(), abstention({ reasonCode: 'LOW_SCORE' }))).toBe('not_evaluable');
    });

    it('does not invent orthogonality for two negative-routing rules that only differ by reason code', () => {
      expect(classify(negativeRouting(), negativeRouting({ reasonCode: 'LOW_SCORE' }))).toBe(
        'not_evaluable',
      );
    });

    it('returns not_evaluable for every other valid unenumerated pairing', () => {
      expect(classify(negativeRouting(), abstention())).toBe('not_evaluable');
      expect(classify(negativeRouting(), clarification())).toBe('not_evaluable');
      expect(classify(negativeRouting(), provenanceGap())).toBe('not_evaluable');
      expect(classify(abstention(), provenanceGap())).toBe('not_evaluable');
    });

    it('does not become a stronger relation when arguments are reversed', () => {
      expect(classify(negativeRouting(), abstention())).toBe(
        classify(abstention(), negativeRouting()),
      );
    });
  });

  describe('validation', () => {
    it('fails closed for an unknown candidate type rather than becoming support', () => {
      expect(() =>
        classify({ type: 'invented', locale: 'de', inputType: 'generic' }, routing()),
      ).toThrow();
    });

    it('fails closed for a malformed payload rather than becoming support', () => {
      expect(() => classify({ type: 'source-routing-pattern' }, routing())).toThrow();
    });

    it('fails closed for a personal source type', () => {
      expect(() => classify(routing({ sourceType: 'user' }), routing())).toThrow();
    });
  });

  describe('purity', () => {
    it('is deterministic', () => {
      expect(classify(routing(), negativeRouting())).toBe(classify(routing(), negativeRouting()));
    });

    it('does not mutate either input', () => {
      const a = routing();
      const b = negativeRouting();
      const aCopy = { ...a };
      const bCopy = { ...b };
      classify(a, b);
      expect(a).toEqual(aCopy);
      expect(b).toEqual(bCopy);
    });

    it('does not depend on property insertion order', () => {
      const reordered = {
        sourceType: 'bls',
        inputType: 'generic',
        locale: 'de',
        type: 'source-routing-pattern',
      };
      expect(classify(routing(), reordered)).toBe(classify(routing(), routing()));
    });
  });
});
