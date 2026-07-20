import { SequentialFoodCatalogResolver } from '../application/services/SequentialFoodCatalogResolver';
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine';
import { InMemoryResolverObservationWriter } from '../infrastructure/observations/InMemoryResolverObservationWriter';
import type { FoodCatalogSource } from '../domain/catalog/FoodCatalogSource';

it('writes exactly one non-authoritative observation without another source call', async () => {
  const source: FoodCatalogSource = {
    type: 'bls',
    search: jest.fn().mockResolvedValue([
      {
        food: {
          id: 'apple',
          name: 'Apfel',
          normalizedName: 'apfel',
          macrosPer100g: { kcal: 52, protein: 0.3, carbs: 14, fat: 0.2 },
          source: 'bls',
          sourceId: 'apple',
        },
        match: { exact: true, similarity: 1 },
        confidence: 1,
      },
    ]),
  };
  const writer = new InMemoryResolverObservationWriter();
  const resolver = new SequentialFoodCatalogResolver(
    [source],
    new DefaultConfidenceEngine(),
    undefined,
    undefined,
    undefined,
    writer,
    { getOwnerId: jest.fn().mockResolvedValue('user-1') },
  );
  const decision = await resolver.resolve({
    raw: '1 Apfel',
    normalized: 'apfel',
    locale: 'de',
    inputType: 'generic',
    traceId: 'run-1',
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(decision.status).toBe('accepted');
  expect(source.search).toHaveBeenCalledTimes(1);
  expect(writer.observations).toHaveLength(1);
  expect(writer.observations[0]).toMatchObject({
    resolverRunId: 'run-1',
    contractVersion: 'resolver-observation-v1',
    input: { rawInput: '1 Apfel' },
    decision: { outcome: 'accepted', provenanceStatus: 'source_grounded' },
  });
});
