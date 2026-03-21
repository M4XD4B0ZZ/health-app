import { parseInput } from '../parseInput';
import { matchFood } from '../matchFood';
import { evaluateConfidence } from '../evaluateConfidence';
import { buildInputInterpretation } from '../buildInputInterpretation';

describe('buildInputInterpretation', () => {
  it('should handle multi item input', () => {
    const parsed = parseInput('2 Eier und Toast');
    const matches = matchFood(parsed);
    const confidence = evaluateConfidence(matches);
    const result = buildInputInterpretation(parsed, matches, confidence);

    expect(result.type).toBe('multi_item');
    expect(result.itemCount).toBe(2);
    expect(result.confidenceLevel).toBe('high');
    expect(result.summary).toBe('multiple_items_detected');
  });

  it('should handle single item input', () => {
    const parsed = parseInput('Toast');
    const matches = matchFood(parsed);
    const confidence = evaluateConfidence(matches);
    const result = buildInputInterpretation(parsed, matches, confidence);

    expect(result.type).toBe('single_item');
    expect(result.itemCount).toBe(1);
    expect(result.confidenceLevel).toBe('high');
    expect(result.summary).toBe('single_item_detected');
  });

  it('should handle unknown/empty input', () => {
    const parsed = { raw: '', items: [] };
    const matches = matchFood(parsed);
    const confidence = evaluateConfidence(matches);
    const result = buildInputInterpretation(parsed, matches, confidence);

    expect(result.type).toBe('unknown');
    expect(result.itemCount).toBe(0);
    expect(result.confidenceLevel).toBe('low');
    expect(result.summary).toBe('no_items_detected');
  });
});
