import { resolvePreparedNutritionInputs } from '../resolvePreparedNutritionInputs'
import { prepareNutritionResolverDispatch } from '../prepareNutritionResolverDispatch'

describe('resolvePreparedNutritionInputs', () => {
  it('should dispatch and resolve matched multi-item input', async () => {
    const input = '2 Eier und Toast'
    const dispatch = prepareNutritionResolverDispatch(input, 'de')
    const result = await resolvePreparedNutritionInputs(dispatch)

    expect(result.dispatch.readyRequests.length).toBeGreaterThan(0)
    expect(result.resolvedResults.length).toBe(result.dispatch.readyRequests.length)
    expect(result.dispatch.unresolvedRequests.length).toBe(0)
  })

  it('should dispatch and resolve mixed known/unknown items', async () => {
    const input = 'Eier und mysteryfood'
    const dispatch = prepareNutritionResolverDispatch(input, 'de')
    const result = await resolvePreparedNutritionInputs(dispatch)

    expect(result.dispatch.readyRequests.length).toBe(1)
    expect(result.resolvedResults.length).toBe(1)
    expect(result.dispatch.unresolvedRequests.length).toBe(1)
  })

  it('should handle fully unresolved input', async () => {
    const input = 'mysteryfood'
    const dispatch = prepareNutritionResolverDispatch(input, 'de')
    const result = await resolvePreparedNutritionInputs(dispatch)

    expect(result.dispatch.readyRequests.length).toBe(0)
    expect(result.resolvedResults.length).toBe(0)
    expect(result.dispatch.unresolvedRequests.length).toBe(1)
  })
})
