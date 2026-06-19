import { parseInput } from '../parseInput';
import { matchFood } from '../matchFood';
import { buildResolverFoodRequests } from '../buildResolverFoodRequests';

describe('buildResolverFoodRequests', () => {
  it('should handle matched multi-item input', () => {
    const parsed = parseInput('2 Eier und Toast');
    const matches = matchFood(parsed);
    const result = buildResolverFoodRequests(parsed, matches);

    expect(result).toHaveLength(2);

    expect(result[0].rawName).toBe('eier');
    expect(result[0].query).toBe('egg');
    expect(result[0].canonicalName).toBe('egg');
    expect(result[0].quantity).toBe(2);
    expect(result[0].unit).toBe(null);
    expect(result[0].status).toBe('ready');

    expect(result[1].rawName).toBe('toast');
    expect(result[1].query).toBe('toast');
    expect(result[1].canonicalName).toBe('toast');
    expect(result[1].quantity).toBe(null);
    expect(result[1].unit).toBe(null);
    expect(result[1].status).toBe('ready');
  });

  it('should route unmatched single item to resolver as an alias miss', () => {
    const parsed = parseInput('mysteryfood');
    const matches = matchFood(parsed);
    const result = buildResolverFoodRequests(parsed, matches);

    expect(result).toHaveLength(1);
    expect(result[0].rawName).toBe('mysteryfood');
    expect(result[0].query).toBe('mysteryfood');
    expect(result[0].canonicalName).toBe(null);
    expect(result[0].quantity).toBe(null);
    expect(result[0].unit).toBe(null);
    expect(result[0].status).toBe('ready');
  });

  it('should handle mixed known/unknown items', () => {
    const parsed = parseInput('Eier und mysteryfood');
    const matches = matchFood(parsed);
    const result = buildResolverFoodRequests(parsed, matches);

    expect(result).toHaveLength(2);

    expect(result[0].rawName).toBe('eier');
    expect(result[0].canonicalName).toBe('egg');
    expect(result[0].status).toBe('ready');

    expect(result[1].rawName).toBe('mysteryfood');
    expect(result[1].canonicalName).toBe(null);
    expect(result[1].status).toBe('ready');
  });
});
