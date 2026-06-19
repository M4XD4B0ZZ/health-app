import { prepareNutritionResolverDispatch } from '../prepareNutritionResolverDispatch';

describe('prepareNutritionResolverDispatch', () => {
  it('should handle matched multi-item input', () => {
    const result = prepareNutritionResolverDispatch('2 Eier und Toast', 'de', 'test-trace');

    // Check parsed input
    expect(result.parsed.items).toHaveLength(2);
    expect(result.parsed.items[0].name).toBe('eier');
    expect(result.parsed.items[0].quantity).toBe(2);
    expect(result.parsed.items[1].name).toBe('toast');

    // Check matches
    expect(result.matches).toHaveLength(2);
    expect(result.matches[0].canonicalName).toBe('egg');
    expect(result.matches[1].canonicalName).toBe('toast');

    // Check confidence
    expect(result.confidence.level).toBe('high');
    expect(result.confidence.score).toBe(1);

    // Check interpretation
    expect(result.interpretation.type).toBe('multi_item');
    expect(result.interpretation.itemCount).toBe(2);

    // Check resolver requests
    expect(result.resolverRequests).toHaveLength(2);
    expect(result.readyRequests).toHaveLength(2);
    expect(result.unresolvedRequests).toHaveLength(0);

    // Check nutrition resolver inputs
    expect(result.nutritionResolverInputs).toHaveLength(2);
    expect(result.nutritionResolverInputs[0]).toEqual({
      raw: '2 Eier',
      normalized: 'egg',
      locale: 'de',
      traceId: 'test-trace',
    });
    expect(result.nutritionResolverInputs[1]).toEqual({
      raw: 'toast',
      normalized: 'toast',
      locale: 'de',
      traceId: 'test-trace',
    });
  });

  it('should handle mixed known/unknown items', () => {
    const result = prepareNutritionResolverDispatch('Eier und mysteryfood', 'de');

    expect(result.resolverRequests).toHaveLength(2);
    expect(result.readyRequests).toHaveLength(2);
    expect(result.unresolvedRequests).toHaveLength(0);

    expect(result.readyRequests[0].rawName).toBe('eier');
    expect(result.readyRequests[1].rawName).toBe('mysteryfood');

    // Alias misses still route to the nutrition resolver.
    expect(result.nutritionResolverInputs).toHaveLength(2);
    expect(result.nutritionResolverInputs[0].raw).toBe('eier');
    expect(result.nutritionResolverInputs[0].normalized).toBe('egg');
    expect(result.nutritionResolverInputs[1].raw).toBe('mysteryfood');
    expect(result.nutritionResolverInputs[1].normalized).toBe('mysteryfood');

    expect(result.confidence.level).toBe('medium');
    expect(result.confidence.score).toBe(0.5);
  });

  it('should handle fully unresolved input', () => {
    const result = prepareNutritionResolverDispatch('mysteryfood', 'en');

    expect(result.resolverRequests).toHaveLength(1);
    expect(result.readyRequests).toHaveLength(1);
    expect(result.unresolvedRequests).toHaveLength(0);

    // Alias misses still route to the nutrition resolver.
    expect(result.nutritionResolverInputs).toHaveLength(1);
    expect(result.nutritionResolverInputs[0].normalized).toBe('mysteryfood');

    expect(result.confidence.level).toBe('low');
    expect(result.confidence.score).toBe(0);
    expect(result.interpretation.type).toBe('single_item');
  });

  it.each([
    ['300g karotten', 'karotten', 300, 'g'],
    ['8 karotten', 'karotten', 8, null],
    ['4 bananen', 'bananen', 4, null],
  ])(
    'should route alias-miss input %s to resolver with raw text preserved',
    (input, name, quantity, unit) => {
      const result = prepareNutritionResolverDispatch(input, 'de', 'alias-miss-trace');

      expect(result.readyRequests).toEqual([
        {
          rawName: name,
          rawText: input,
          query: name,
          canonicalName: null,
          quantity,
          unit,
          status: 'ready',
        },
      ]);
      expect(result.unresolvedRequests).toHaveLength(0);
      expect(result.nutritionResolverInputs).toEqual([
        {
          raw: input,
          normalized: name,
          locale: 'de',
          traceId: 'alias-miss-trace',
        },
      ]);
    },
  );

  it('should use default locale when not specified', () => {
    const result = prepareNutritionResolverDispatch('Toast');

    expect(result.nutritionResolverInputs[0].locale).toBe('de');
    expect(result.nutritionResolverInputs[0].traceId).toBeUndefined();
  });

  it('should keep mixed-language egg items as two per-item resolver inputs', () => {
    const result = prepareNutritionResolverDispatch('Eier und egg', 'de', 'mixed-trace');

    expect(result.parsed.items).toHaveLength(2);
    expect(result.readyRequests).toHaveLength(2);
    expect(result.unresolvedRequests).toHaveLength(0);
    expect(result.readyRequests[0].rawName).toBe('eier');
    expect(result.readyRequests[1].rawName).toBe('egg');
    expect(result.nutritionResolverInputs).toEqual([
      {
        raw: 'eier',
        normalized: 'egg',
        locale: 'de',
        traceId: 'mixed-trace',
      },
      {
        raw: 'egg',
        normalized: 'egg',
        locale: 'de',
        traceId: 'mixed-trace',
      },
    ]);
  });

  it('should preserve unsupported ml inputs as unresolved without resolver dispatch', () => {
    const result = prepareNutritionResolverDispatch('500ml mysteryfood', 'de');

    expect(result.parsed.items).toHaveLength(1);
    expect(result.parsed.items[0]).toEqual({
      name: 'mysteryfood',
      quantity: 500,
      unit: 'ml',
      rawText: '500ml mysteryfood',
    });
    expect(result.readyRequests).toHaveLength(0);
    expect(result.unresolvedRequests).toHaveLength(1);
    expect(result.unresolvedRequests[0]).toEqual({
      rawName: 'mysteryfood',
      rawText: '500ml mysteryfood',
      query: 'mysteryfood',
      canonicalName: null,
      quantity: 500,
      unit: 'ml',
      status: 'unresolved',
    });
    expect(result.nutritionResolverInputs).toHaveLength(0);
  });

  it.each([
    ['1 scheibe toast', 1],
    ['eine scheibe toast', 1],
    ['2 scheiben toast', 2],
    ['zwei scheiben toast', 2],
  ])('should dispatch toast slice unit input %s with raw text preserved', (input, quantity) => {
    const result = prepareNutritionResolverDispatch(input, 'de', 'slice-trace');

    expect(result.parsed.items).toEqual([
      {
        name: 'toast',
        quantity,
        unit: 'slice',
        rawText: input,
      },
    ]);
    expect(result.readyRequests).toEqual([
      {
        rawName: 'toast',
        rawText: input,
        query: 'toast',
        canonicalName: 'toast',
        quantity,
        unit: 'slice',
        status: 'ready',
      },
    ]);
    expect(result.nutritionResolverInputs).toEqual([
      {
        raw: input,
        normalized: 'toast',
        locale: 'de',
        traceId: 'slice-trace',
      },
    ]);
  });

  it('should strip cooked and fried modifiers before dispatching egg queries', () => {
    const cooked = prepareNutritionResolverDispatch('gekochte Eier', 'de');
    const fried = prepareNutritionResolverDispatch('vier gebratene Eier', 'de');

    expect(cooked.readyRequests).toHaveLength(1);
    expect(cooked.readyRequests[0]).toEqual({
      rawName: 'eier',
      rawText: 'gekochte Eier',
      query: 'egg',
      canonicalName: 'egg',
      quantity: null,
      unit: null,
      status: 'ready',
    });

    expect(fried.readyRequests).toHaveLength(1);
    expect(fried.readyRequests[0]).toEqual({
      rawName: 'eier',
      rawText: 'vier gebratene Eier',
      query: 'egg',
      canonicalName: 'egg',
      quantity: 4,
      unit: null,
      status: 'ready',
    });
    expect(fried.nutritionResolverInputs[0].normalized).toBe('egg');
  });
});
