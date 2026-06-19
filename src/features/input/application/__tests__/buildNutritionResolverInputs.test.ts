import { buildNutritionResolverInputs } from '../buildNutritionResolverInputs';
import { ResolverFoodRequest } from '../../domain/ResolverFoodRequest';

describe('buildNutritionResolverInputs', () => {
  it('should convert ready resolver requests to nutrition resolver inputs', () => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'eier',
        rawText: 'eier',
        query: 'egg',
        canonicalName: 'egg',
        quantity: 2,
        unit: null,
        status: 'ready',
      },
      {
        rawName: 'toast',
        rawText: 'toast',
        query: 'toast',
        canonicalName: 'toast',
        quantity: null,
        unit: null,
        status: 'ready',
      },
    ];

    const result = buildNutritionResolverInputs(resolverRequests, 'de', 'test-trace-123');

    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({
      raw: 'eier',
      normalized: 'egg',
      locale: 'de',
      traceId: 'test-trace-123',
    });
    expect(result[1]).toEqual({
      raw: 'toast',
      normalized: 'toast',
      locale: 'de',
      traceId: 'test-trace-123',
    });
  });

  it('should exclude unresolved requests', () => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'eier',
        rawText: 'eier',
        query: 'egg',
        canonicalName: 'egg',
        quantity: 2,
        unit: null,
        status: 'ready',
      },
      {
        rawName: 'mysteryfood',
        rawText: 'mysteryfood',
        query: 'mysteryfood',
        canonicalName: null,
        quantity: null,
        unit: null,
        status: 'unresolved',
      },
    ];

    const result = buildNutritionResolverInputs(resolverRequests, 'de');

    expect(result).toHaveLength(1);
    expect(result[0].raw).toBe('eier');
    expect(result[0].normalized).toBe('egg');
  });

  it('should convert alias-miss ready requests using raw name as normalized query', () => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'karotten',
        rawText: '300g karotten',
        query: 'karotten',
        canonicalName: null,
        quantity: 300,
        unit: 'g',
        status: 'ready',
      },
    ];

    expect(buildNutritionResolverInputs(resolverRequests, 'de', 'carrot-trace')).toEqual([
      {
        raw: '300g karotten',
        normalized: 'karotten',
        locale: 'de',
        traceId: 'carrot-trace',
      },
    ]);
  });

  it('should preserve raw text for explicit count input without a unit', () => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'karotten',
        rawText: '8 karotten',
        query: 'karotten',
        canonicalName: null,
        quantity: 8,
        unit: null,
        status: 'ready',
      },
    ];

    expect(buildNutritionResolverInputs(resolverRequests, 'de', 'count-trace')).toEqual([
      {
        raw: '8 karotten',
        normalized: 'karotten',
        locale: 'de',
        traceId: 'count-trace',
      },
    ]);
  });

  it('should handle empty input', () => {
    const result = buildNutritionResolverInputs([], 'en');

    expect(result).toHaveLength(0);
  });

  it('should use default locale when not specified', () => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'eier',
        rawText: 'eier',
        query: 'egg',
        canonicalName: 'egg',
        quantity: 2,
        unit: null,
        status: 'ready',
      },
    ];

    const result = buildNutritionResolverInputs(resolverRequests);

    expect(result[0].locale).toBe('de');
    expect(result[0].traceId).toBeUndefined();
  });

  it.each([
    ['300 gramm toast', 300, 'g'],
    ['1 scheibe toast', 1, 'slice'],
    ['2 pieces toast', 2, 'piece'],
  ])('should preserve raw text for explicit portion unit input %s', (rawText, quantity, unit) => {
    const resolverRequests: ResolverFoodRequest[] = [
      {
        rawName: 'toast',
        rawText,
        query: 'toast',
        canonicalName: 'toast',
        quantity,
        unit,
        status: 'ready',
      },
    ];

    const result = buildNutritionResolverInputs(resolverRequests, 'de');

    expect(result).toEqual([
      {
        raw: rawText,
        normalized: 'toast',
        locale: 'de',
        traceId: undefined,
      },
    ]);
  });
});
