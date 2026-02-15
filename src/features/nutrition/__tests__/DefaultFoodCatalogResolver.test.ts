import { DefaultFoodCatalogResolver } from '../application/services/DefaultFoodCatalogResolver'
import { DefaultConfidenceEngine } from '../domain/confidence/DefaultConfidenceEngine'
import { MockUsdaSource } from '../infrastructure/catalog/sources/MockUsdaSource'
import { MockOffSource } from '../infrastructure/catalog/sources/MockOffSource'

describe('DefaultFoodCatalogResolver', () => {

  const confidenceEngine = new DefaultConfidenceEngine()
  const resolver = new DefaultFoodCatalogResolver(
    [new MockOffSource(), new MockUsdaSource()],
    confidenceEngine
  )

  it('returns OFF result over USDA when both exact match', async () => {

    const result = await resolver.resolve({
      raw: 'apfel',
      normalized: 'apfel',
      locale: 'de',
    })

    expect(result).not.toBeNull()
    expect(result?.food.source).toBe('off')
  })

  it('returns null when no source finds result', async () => {

    const result = await resolver.resolve({
      raw: 'unknown',
      normalized: 'unknown',
      locale: 'de',
    })

    expect(result).toBeNull()
  })

  it('computes confidence and reasons', async () => {

    const result = await resolver.resolve({
      raw: 'apfel',
      normalized: 'apfel',
      locale: 'de',
    })

    expect(result?.confidence).toBeGreaterThan(0)
    expect(result?.reasons.length).toBeGreaterThan(0)
  })

})
