import { parseInput } from '../parseInput';
import { matchFood } from '../matchFood';
import { evaluateConfidence } from '../evaluateConfidence';

describe('evaluateConfidence', () => {
  it('should return high confidence for all items matched', () => {
    const parsed = parseInput('2 Eier und Toast');
    const matches = matchFood(parsed);
    const result = evaluateConfidence(matches);

    expect(result.level).toBe('high');
    expect(result.score).toBe(1);
    expect(result.reason).toBe('all_items_matched');
  });

  it('should return low confidence for no items matched', () => {
    const parsed = parseInput('mysteryfood');
    const matches = matchFood(parsed);
    const result = evaluateConfidence(matches);

    expect(result.level).toBe('low');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('no_items_matched');
  });

  it('should return medium confidence for partial match', () => {
    const parsed = parseInput('Eier und mysteryfood');
    const matches = matchFood(parsed);
    const result = evaluateConfidence(matches);

    expect(result.level).toBe('medium');
    expect(result.score).toBe(0.5);
    expect(result.reason).toBe('partial_match');
  });

  it('should return low confidence for no items', () => {
    const result = evaluateConfidence([]);

    expect(result.level).toBe('low');
    expect(result.score).toBe(0);
    expect(result.reason).toBe('no_items');
  });
});
