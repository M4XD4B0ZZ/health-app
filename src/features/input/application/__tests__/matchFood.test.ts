import { parseInput } from '../parseInput';
import { matchFood } from '../matchFood';

describe('matchFood', () => {
  it("should match '2 Eier und Toast' correctly", () => {
    const parsed = parseInput('2 Eier und Toast');
    const result = matchFood(parsed);

    expect(result).toHaveLength(2);
    expect(result[0].rawName).toBe('eier');
    expect(result[0].canonicalName).toBe('egg');
    expect(result[0].status).toBe('matched');
    expect(result[1].rawName).toBe('toast');
    expect(result[1].canonicalName).toBe('toast');
    expect(result[1].status).toBe('matched');
  });

  it('should handle unknown food', () => {
    const parsed = parseInput('mysteryfood');
    const result = matchFood(parsed);

    expect(result).toHaveLength(1);
    expect(result[0].rawName).toBe('mysteryfood');
    expect(result[0].canonicalName).toBe(null);
    expect(result[0].status).toBe('unmatched');
  });

  it('should handle German/English alias coverage', () => {
    const parsed = parseInput('Chicken und Reis');
    const result = matchFood(parsed);

    expect(result).toHaveLength(2);
    expect(result[0].rawName).toBe('chicken');
    expect(result[0].canonicalName).toBe('chicken');
    expect(result[0].status).toBe('matched');
    expect(result[1].rawName).toBe('reis');
    expect(result[1].canonicalName).toBe('rice');
    expect(result[1].status).toBe('matched');
  });
});
