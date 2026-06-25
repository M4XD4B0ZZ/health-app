import { resolvePortionGrams } from '../domain/portion/resolvePortionGrams';
import {
  InMemoryPortionHintRepository,
  PortionKnowledgeService,
} from '../domain/portion/PortionKnowledgeService';
import { SEED_PORTION_HINTS } from '../domain/portion/seedPortionHints';

describe('resolvePortionGrams', () => {
  it('uses explicit grams without overriding them', async () => {
    await expect(resolvePortionGrams('ei', 200, undefined)).resolves.toEqual({
      status: 'resolved',
      grams: 200,
      reasonCode: 'EXPLICIT_GRAMS',
    });

    await expect(resolvePortionGrams('egg', 150, 2)).resolves.toEqual({
      status: 'resolved',
      grams: 150,
      reasonCode: 'EXPLICIT_GRAMS',
    });
  });

  it.each(['karotte', 'karotten', 'möhre', 'möhren'])(
    'resolves "%s" through the shared carrot identity piece hint',
    async (alias) => {
      await expect(resolvePortionGrams(alias, 0, 1)).resolves.toMatchObject({
        status: 'resolved',
        grams: 60,
        reasonCode: 'PORTION_KNOWLEDGE_HINT',
        gramsPerUnit: 60,
        foodIdentityKey: 'canonical:carrot',
      });
    },
  );

  it('resolves seeded count and slice portions', async () => {
    await expect(resolvePortionGrams('karotten', 0, 8)).resolves.toMatchObject({
      status: 'resolved',
      grams: 480,
      foodIdentityKey: 'canonical:carrot',
    });

    await expect(resolvePortionGrams('eier', 0, 2)).resolves.toMatchObject({
      status: 'resolved',
      grams: 120,
      foodIdentityKey: 'canonical:egg',
    });

    await expect(resolvePortionGrams('bananen', 0, 2)).resolves.toMatchObject({
      status: 'resolved',
      grams: 240,
      foodIdentityKey: 'canonical:banana',
    });

    await expect(resolvePortionGrams('toast', 0, 2, { unit: 'slice' })).resolves.toMatchObject({
      status: 'resolved',
      grams: 70,
      foodIdentityKey: 'canonical:toast',
    });
  });

  it('lets a user-private hint override the seed hint for the same user only', async () => {
    const service = new PortionKnowledgeService(
      new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
    );

    const privateHint = await service.confirmUserPrivateHint({
      foodIdentityKey: 'canonical:carrot',
      unit: 'piece',
      gramsPerUnit: 80,
      userId: 'user-1',
      reviewStatus: 'none',
    });

    await expect(
      resolvePortionGrams('karotten', 0, 8, {
        userId: 'user-1',
        portionKnowledgeService: service,
      }),
    ).resolves.toMatchObject({
      status: 'resolved',
      grams: 640,
      gramsPerUnit: 80,
    });

    await expect(
      resolvePortionGrams('karotten', 0, 8, {
        userId: 'user-2',
        portionKnowledgeService: service,
      }),
    ).resolves.toMatchObject({
      status: 'resolved',
      grams: 480,
      gramsPerUnit: 60,
    });

    expect(privateHint).toMatchObject({
      visibility: 'user_private',
      reviewStatus: 'none',
    });
    expect(privateHint.visibility).not.toBe('global_verified');
  });

  it('uses canonical defaults and preserves no-count legacy fallback', async () => {
    await expect(resolvePortionGrams('milk', 0, undefined)).resolves.toMatchObject({
      status: 'resolved',
      grams: 244,
      reasonCode: 'KNOWN_DEFAULT_PORTION',
    });

    await expect(resolvePortionGrams('unknownfood', 0, undefined)).resolves.toEqual({
      status: 'resolved',
      grams: 100,
      reasonCode: 'NO_QUANTITY_LEGACY_100G_FALLBACK',
    });
  });

  it('requires edit instead of silently using 100g for explicit unknown count foods', async () => {
    await expect(resolvePortionGrams('pizza', 0, 2)).resolves.toMatchObject({
      status: 'needs_edit',
      reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
      needsEdit: {
        type: 'portion_needs_edit',
        rawInput: 'pizza',
        rawFoodName: 'pizza',
        displayName: 'pizza',
        foodIdentityKey: null,
        unit: 'piece',
        quantity: 2,
        suggestedGramsPerUnit: 60,
      },
    });
  });

  it('returns full context for known identity count foods without a unit hint', async () => {
    await expect(
      resolvePortionGrams('schinken', 0, 2, {
        rawInput: 'zwei scheiben schinken',
        unit: 'slice',
      }),
    ).resolves.toMatchObject({
      status: 'needs_edit',
      reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
      needsEdit: {
        rawInput: 'zwei scheiben schinken',
        rawFoodName: 'schinken',
        foodIdentityKey: 'canonical:ham',
        unit: 'slice',
        quantity: 2,
        suggestedGramsPerUnit: 35,
      },
    });
  });

  it('returns needs-edit context for radishes without creating global truth', async () => {
    await expect(resolvePortionGrams('radieschen', 0, 8)).resolves.toMatchObject({
      status: 'needs_edit',
      reasonCode: 'COUNT_WITHOUT_PORTION_HINT',
      needsEdit: {
        rawFoodName: 'radieschen',
        foodIdentityKey: 'canonical:radish',
        unit: 'piece',
        quantity: 8,
        suggestedGramsPerUnit: 60,
      },
    });
  });

  it('handles zero quantityCount as 0', async () => {
    await expect(resolvePortionGrams('egg', 0, 0)).resolves.toMatchObject({
      status: 'resolved',
      grams: 0,
    });
  });
});