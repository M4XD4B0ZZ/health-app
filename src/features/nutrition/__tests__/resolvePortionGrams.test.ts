import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';
import {
  InMemoryPortionHintRepository,
  PortionKnowledgeService,
} from '../domain/portion/PortionKnowledgeService';
import { SEED_PORTION_HINTS } from '../domain/portion/seedPortionHints';

describe('resolvePortionGrams', () => {
  describe('explicit grams (should not be overridden)', () => {
    it('should use explicit grams for "200g ei"', () => {
      const result = resolvePortionGrams('ei', 200, undefined);
      expect(result).toEqual({ status: 'resolved', grams: 200, reasonCode: 'EXPLICIT_GRAMS' });
    });

    it('should use explicit grams even for canonical foods', () => {
      const result = resolvePortionGrams('egg', 150, 2);
      expect(result).toEqual({ status: 'resolved', grams: 150, reasonCode: 'EXPLICIT_GRAMS' });
    });

    it('should use explicit grams even when a portion knowledge hint exists', () => {
      const result = resolvePortionGrams('karotten', 200, 8);
      expect(result).toEqual({ status: 'resolved', grams: 200, reasonCode: 'EXPLICIT_GRAMS' });
    });
  });

  describe('portion knowledge hints', () => {
    it.each(['karotte', 'karotten', 'möhre', 'möhren'])(
      'should resolve "%s" through the shared carrot identity piece hint',
      (alias) => {
        const result = resolvePortionGrams(alias, 0, 1);
        expect(result).toMatchObject({
          status: 'resolved',
          grams: 60,
          reasonCode: 'PORTION_KNOWLEDGE_HINT',
          gramsPerUnit: 60,
          foodIdentityKey: 'canonical:carrot',
        });
      },
    );

    it('should resolve "8 karotten" to 480g through portion knowledge', () => {
      const result = resolvePortionGrams('karotten', 0, 8);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 480,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
        foodIdentityKey: 'canonical:carrot',
      });
    });

    it('should resolve "8 möhren" to 480g through the same carrot hint', () => {
      const result = resolvePortionGrams('möhren', 0, 8);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 480,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
        foodIdentityKey: 'canonical:carrot',
      });
    });

    it('should resolve "2 eier" to 120g through portion knowledge', () => {
      const result = resolvePortionGrams('eier', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 120,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
        foodIdentityKey: 'canonical:egg',
      });
    });

    it('should resolve "2 bananen" to 240g through portion knowledge', () => {
      const result = resolvePortionGrams('bananen', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 240,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 120,
        foodIdentityKey: 'canonical:banana',
      });
    });

    it('should resolve "2 scheiben toast" to 70g through slice hint', () => {
      const result = resolvePortionGrams('toast', 0, 2, { unit: 'slice' });
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 70,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 35,
        foodIdentityKey: 'canonical:toast',
      });
    });

    it('should let a user-private carrot hint override the seed hint', () => {
      const service = new PortionKnowledgeService(
        new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
      );
      const privateHint = service.confirmUserPrivateHint({
        foodIdentityKey: 'canonical:carrot',
        unit: 'piece',
        gramsPerUnit: 80,
        userId: 'user-1',
        reviewStatus: 'none',
      });

      const result = resolvePortionGrams('karotten', 0, 8, {
        userId: 'user-1',
        portionKnowledgeService: service,
      });

      expect(result).toMatchObject({
        status: 'resolved',
        grams: 640,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 80,
        foodIdentityKey: 'canonical:carrot',
      });
      expect(privateHint).toMatchObject({
        visibility: 'user_private',
        reviewStatus: 'none',
      });
      expect(privateHint.visibility).not.toBe('global_verified');
    });
  });

  describe('unit-based canonical foods', () => {
    it('should resolve "egg" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "eier" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('eier', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "ei" to 60g (1 piece)', () => {
      const result = resolvePortionGrams('ei', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "2 eggs" to 120g (2 pieces)', () => {
      const result = resolvePortionGrams('eggs', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 120,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "3 eier" to 180g (3 pieces)', () => {
      const result = resolvePortionGrams('eier', 0, 3);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 180,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
      });
    });

    it('should resolve "toast" to 35g (1 slice/piece)', () => {
      const result = resolvePortionGrams('toast', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 35,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 35,
      });
    });

    it('should resolve "2 scheiben toast" to 70g using toast default portion', () => {
      const result = resolvePortionGrams('toast', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 70,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 35,
      });
    });
  });

  describe('other canonical foods', () => {
    it('should resolve "apple" to 180g from the seed portion hint', () => {
      const result = resolvePortionGrams('apple', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 180,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 180,
      });
    });

    it('should resolve "2 bananas" to 240g from the seed portion hint', () => {
      const result = resolvePortionGrams('bananas', 0, 2);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 240,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 120,
      });
    });

    it('should resolve "milk" to 244g (default portion)', () => {
      const result = resolvePortionGrams('milk', 0, undefined);
      expect(result).toMatchObject({
        status: 'resolved',
        grams: 244,
        reasonCode: 'KNOWN_DEFAULT_PORTION',
        gramsPerUnit: 244,
      });
    });
  });

  describe('non-canonical foods', () => {
    it('should preserve legacy 100g fallback only when no explicit count is provided', () => {
      const result = resolvePortionGrams('unknownfood', 0, undefined);
      expect(result).toEqual({
        status: 'resolved',
        grams: 100,
        reasonCode: 'NO_QUANTITY_LEGACY_100G_FALLBACK',
      });
    });

    it('should require edit instead of silently using 100g for explicit unknown count foods', () => {
      const result = resolvePortionGrams('pizza', 0, 2);
      expect(result).toMatchObject({
        status: 'needs_edit',
        reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
        needsEdit: {
          type: 'portion_needs_edit',
          rawInput: 'pizza',
          rawFoodName: 'pizza',
          displayName: 'pizza',
          foodIdentityKey: null,
          unit: 'piece',
          quantity: 2,
          suggestedGramsPerUnit: 60,
          suggestionSource: 'generic_fallback',
          message: 'Ich kenne das Stückgewicht für pizza noch nicht. Schätzen?',
        },
      });
    });
  });

  describe('structured needs-edit context', () => {
    it('returns full context for known identity count foods without a piece hint', () => {
      const result = resolvePortionGrams('schinken', 0, 2, {
        rawInput: 'zwei scheiben schinken',
        unit: 'slice',
      });

      expect(result).toMatchObject({
        status: 'needs_edit',
        reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
        needsEdit: {
          type: 'portion_needs_edit',
          reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
          rawInput: 'zwei scheiben schinken',
          rawFoodName: 'schinken',
          displayName: 'schinken',
          foodIdentityKey: 'canonical:ham',
          unit: 'slice',
          quantity: 2,
          suggestedGramsPerUnit: 35,
          suggestionSource: 'generic_fallback',
          message: 'Ich kenne das Stückgewicht für schinken noch nicht. Schätzen?',
        },
      });
    });
  });

  describe('edge cases', () => {
    it('should handle zero quantityGrams', () => {
      const result = resolvePortionGrams('egg', 0, 2);
      expect(result).toMatchObject({ status: 'resolved', grams: 120 });
    });

    it('should handle undefined quantityCount as 1', () => {
      const result = resolvePortionGrams('egg', 0, undefined);
      expect(result).toMatchObject({ status: 'resolved', grams: 60 });
    });

    it('should handle zero quantityCount as 0', () => {
      const result = resolvePortionGrams('egg', 0, 0);
      expect(result).toMatchObject({ status: 'resolved', grams: 0 });
    });
  });
});
