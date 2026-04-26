import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';

// Dummy Mocks für Konstruktor-Parameter
const mockRepository = {};
const mockClock = { now: () => new Date() };
const mockIdGenerator = { newId: () => 'test-id' };
const mockParser = { parse: jest.fn().mockImplementation((text) => ({ name: text })) };
const mockFoodCatalog = {};
const mockAliasRepository = { getCanonicalId: jest.fn(), saveAlias: jest.fn() };
const mockAiFoodMapper = { mapToCanonicalFood: jest.fn() };
const mockNutritionLookup = { getPer100gByName: jest.fn() };
const mockResolver = {
  resolve: jest.fn().mockResolvedValue({
    resolverDecision: {
      candidates: [
        {
          food: {
            id: 'test-food',
            name: 'Test Food',
            macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
            sourceId: 'test-source',
            normalizedName: 'test food',
          },
          score: 0.9,
          source: 'generic',
          reasonCodes: [],
          breakdown: { notes: [] },
        },
      ],
      best: {
        food: {
          id: 'test-food',
          name: 'Test Food',
          macrosPer100g: { kcal: 100, protein: 10, carbs: 20, fat: 5 },
          sourceId: 'test-source',
          normalizedName: 'test food',
        },
        score: 0.9,
        source: 'generic',
        reasonCodes: [],
        breakdown: { notes: [] },
      },
      reasonCodes: [],
    },
    resolverDecisionSummary: {},
    canonicalFood: null,
    sourceType: 'generic',
    confidence: 0.8,
    explanation: '',
    reasonCodes: [],
  }),
};

describe('LogFoodFromRawInputUseCase Input Tests', () => {
  const useCase = new LogFoodFromRawInputUseCase(
    mockRepository as any,
    mockClock as any,
    mockIdGenerator as any,
    mockParser as any,
    mockFoodCatalog as any,
    mockAliasRepository as any,
    mockAiFoodMapper as any,
    mockNutritionLookup as any,
    mockResolver as any,
  );

  const inputs = ['ei', 'zwei eier', '200g quark', 'buttertoast', 'zwei scheiben schinken'];

  inputs.forEach((input) => {
    it(`should process input and log PROOF logs for: ${input}`, async () => {
      const consoleSpy = jest.spyOn(console, 'log').mockImplementation();
      await useCase.execute({ rawText: input, rawInput: input });

      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/PROOF_USECASE_ENTERED/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/PROOF_ABOUT_TO_RESOLVE/));
      expect(consoleSpy).toHaveBeenCalledWith(expect.stringMatching(/PROOF_RESOLVER_CALLED/));
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_OFF_SOURCE_CALLED|PROOF_USDA_SOURCE_CALLED/),
      );

      consoleSpy.mockRestore();
    });
  });
});
