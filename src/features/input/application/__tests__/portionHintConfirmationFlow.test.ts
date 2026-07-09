import { logResolvedNutritionInput } from '../logResolvedNutritionInput';
import { LogFoodFromRawInputUseCase } from '../../../nutrition/application/usecases/LogFoodFromRawInputUseCase';
import container from '../../../../infrastructure/di/container';

describe('P1-004C: User-Private Portion Hint Confirmation Flow', () => {
  it('blocks an unknown count food, then confirming a private hint resolves the same input immediately without becoming global truth', async () => {
    const rawInput = 'zwei scheiben schinken';

    // Step 1: unknown count food with no portion hint blocks and surfaces a needs-edit item.
    const firstAttempt = await logResolvedNutritionInput(rawInput);

    expect(firstAttempt.blockedEntries).toBe(1);
    expect(firstAttempt.persistedEntries).toHaveLength(0);
    expect(firstAttempt.needsEditItems).toHaveLength(1);

    const needsEdit = firstAttempt.needsEditItems[0];
    expect(needsEdit.foodIdentityKey).toBe('canonical:ham');
    expect(needsEdit.unit).toBe('slice');

    // Step 2: confirm a private hint via the exact DI-container-exposed service the
    // running app uses (mirrors JournalScreen's savePortionHintAndRetry).
    await container.portionKnowledgeService.confirmUserPrivateHint({
      foodIdentityKey: needsEdit.foodIdentityKey as string,
      unit: needsEdit.unit,
      gramsPerUnit: 25,
      userId: LogFoodFromRawInputUseCase.LOCAL_PORTION_HINT_USER_ID,
      confidence: 0.6,
      reviewStatus: 'pending',
      now: new Date('2026-02-15T12:00:00Z').toISOString(),
    });

    // Step 3: the exact same input now resolves immediately for this user.
    const retryAttempt = await logResolvedNutritionInput(rawInput);

    expect(retryAttempt.blockedEntries).toBe(0);
    expect(retryAttempt.needsEditItems).toHaveLength(0);
    expect(retryAttempt.persistedEntries).toHaveLength(1);
    expect(retryAttempt.persistedEntries[0].grams).toBe(50); // 2 slices * 25g
    expect(retryAttempt.persistedEntries[0].calories).toBeGreaterThan(0);

    // Step 4: the hint stays private - a different user gets no hint for the same food/unit.
    const otherUsersHint = await container.portionKnowledgeService.lookup({
      foodIdentityKey: 'canonical:ham',
      unit: 'slice',
      userId: 'some-other-user',
    });

    expect(otherUsersHint).toBeNull();
  });
});
