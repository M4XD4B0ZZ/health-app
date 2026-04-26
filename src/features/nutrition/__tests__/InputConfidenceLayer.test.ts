import { DefaultInputConfidenceClassifier } from '../application/services/DefaultInputConfidenceClassifier';

describe('Input Confidence Layer', () => {
  let classifier: DefaultInputConfidenceClassifier;

  beforeEach(() => {
    classifier = new DefaultInputConfidenceClassifier();
  });

  describe('DefaultInputConfidenceClassifier', () => {
    it('should classify exact known foods as HIGH confidence', () => {
      const result = classifier.classify('magerquark', 'magerquark');

      expect(result.level).toBe('high');
      expect(result.reason).toBe('exact_known_food');
      expect(result.assumptions).toBeUndefined();
    });

    it('should classify alias matches as MEDIUM confidence', () => {
      const result = classifier.classify('quark', 'quark', {
        usedHeuristic: 'alias',
        fromAlias: true,
      });

      expect(result.level).toBe('medium');
      expect(result.reason).toBe('alias_match');
      expect(result.assumptions).toContain('interpreted as magerquark');
    });

    it('should classify fuzzy matches as LOW confidence', () => {
      const result = classifier.classify('pizza', 'pizza', {
        usedHeuristic: 'fuzzy',
        exact: false,
      });

      expect(result.level).toBe('low');
      expect(result.reason).toBe('fuzzy_or_partial_match');
    });

    it('should classify vague inputs as LOW confidence', () => {
      const result = classifier.classify('essen', 'essen');

      expect(result.level).toBe('low');
      expect(result.reason).toBe('vague_input');
    });

    it('should default to MEDIUM confidence for unknown inputs', () => {
      const result = classifier.classify('unknown_food', 'unknown_food');

      expect(result.level).toBe('medium');
      expect(result.reason).toBe('default_classification');
    });

    it('should prioritize alias detection over exact match', () => {
      const result = classifier.classify('magerquark', 'magerquark', {
        usedHeuristic: 'alias',
        fromAlias: true,
      });

      expect(result.level).toBe('medium');
      expect(result.reason).toBe('alias_match');
    });

    it('should prioritize fuzzy detection over exact match', () => {
      const result = classifier.classify('magerquark', 'magerquark', {
        usedHeuristic: 'fuzzy',
        exact: false,
      });

      expect(result.level).toBe('low');
      expect(result.reason).toBe('fuzzy_or_partial_match');
    });
  });
});
