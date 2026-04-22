import { LogFoodFromRawInputUseCase } from '../application/usecases/LogFoodFromRawInputUseCase';

// Mock-Setup für Input-Preservation Tests
const mockRepository = {
  addEntry: jest.fn().mockResolvedValue(undefined),
};

const mockClock = { 
  now: () => new Date('2024-01-01T12:00:00Z') 
};

const mockIdGenerator = { 
  newId: () => 'test-entry-id' 
};

const mockParser = {
  parse: jest.fn().mockImplementation((text: string) => {
    // Simuliere echtes Parser-Verhalten für deutsche Zahlwörter
    const normalized = text.trim().toLowerCase();
    
    // "200g quark" -> name: "quark", quantityGrams: 200
    if (normalized.includes('200g')) {
      return { name: 'quark', quantityGrams: 200 };
    }
    
    // "zwei eier" -> name: "eier", quantityCount: 2
    if (normalized.startsWith('zwei ')) {
      const remainingName = normalized.replace(/^zwei\s+/, '');
      return { name: remainingName, quantityCount: 2 };
    }
    
    // "ei" -> name: "ei"
    return { name: normalized };
  })
};

const mockFoodCatalog = {
  getById: jest.fn().mockResolvedValue({
    id: 'test-food-id',
    name: 'Test Food',
    per100g: { calories: 155, protein: 13, carbs: 1, fat: 11 }
  }),
  searchByName: jest.fn().mockResolvedValue(null)
};

const mockAliasRepository = {
  getCanonicalId: jest.fn().mockResolvedValue(null),
  saveAlias: jest.fn().mockResolvedValue(undefined)
};

const mockAiFoodMapper = {
  mapToCanonicalFood: jest.fn().mockResolvedValue({
    canonicalId: 'ai-mapped-food',
    confidence: 0.8,
    explanation: 'AI mapping'
  })
};

const mockNutritionLookup = {
  getPer100gByName: jest.fn().mockResolvedValue(null)
};

// Mock Resolver mit Input-Preservation Tracking
const mockResolver = {
  resolve: jest.fn().mockImplementation(async (query: any, options: any) => {
    const { raw, normalized, locale } = query;
    const { traceId } = options || {};
    
    // Log für Verifikation der Input-Preservation
    console.log(`[${traceId}] MOCK_RESOLVER_RECEIVED raw="${raw}" normalized="${normalized}" locale="${locale}"`);
    
    // Simuliere erfolgreiche Auflösung für deutsche Inputs
    const isGermanInput = ['ei', 'eier', 'quark'].some(term => 
      normalized.includes(term) || raw.includes(term)
    );
    
    if (isGermanInput) {
      return {
        candidates: [{
          food: {
            id: `resolved-${normalized}`,
            name: `Resolved ${normalized}`,
            macrosPer100g: { kcal: 155, protein: 13, carbs: 1, fat: 11 },
            sourceId: 'bls-source',
            normalizedName: normalized,
          },
          score: 0.85,
          source: 'BLS',
          reasonCodes: ['BLS_EXACT_MATCH'],
          breakdown: { notes: ['German food match'] },
        }],
        best: {
          food: {
            id: `resolved-${normalized}`,
            name: `Resolved ${normalized}`,
            macrosPer100g: { kcal: 155, protein: 13, carbs: 1, fat: 11 },
            sourceId: 'bls-source',
            normalizedName: normalized,
          },
          score: 0.85,
          source: 'BLS',
          reasonCodes: ['BLS_EXACT_MATCH'],
          breakdown: { notes: ['German food match'] },
        },
        reasonCodes: ['BLS_EXACT_MATCH'],
      };
    }
    
    // Fallback für andere Inputs
    return {
      candidates: [],
      best: null,
      reasonCodes: ['NO_MATCH'],
    };
  })
};

describe('LogFoodFromRawInputUseCase - Input Preservation Tests', () => {
  let useCase: LogFoodFromRawInputUseCase;
  let consoleSpy: jest.SpyInstance;

  beforeEach(() => {
    useCase = new LogFoodFromRawInputUseCase(
      mockRepository as any,
      mockClock as any,
      mockIdGenerator as any,
      mockParser as any,
      mockFoodCatalog as any,
      mockAliasRepository as any,
      mockAiFoodMapper as any,
      mockNutritionLookup as any,
      mockResolver as any
    );
    
    consoleSpy = jest.spyOn(console, 'log').mockImplementation();
    
    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  describe('Deutsche Input-Preservation', () => {
    it('sollte "ei" als deutschen Input erhalten und nicht übersetzen', async () => {
      const rawInput = 'ei';
      
      await useCase.execute({ rawText: rawInput, rawInput });
      
      // Verifikation: rawInput bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*rawInput="ei"/)
      );
      
      // Verifikation: parsedName bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*parsedName="ei"/)
      );
      
      // Verifikation: Resolver erhält deutschen Input
      expect(mockResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: 'ei',
          normalized: 'ei',
          locale: 'de'
        }),
        expect.any(Object)
      );
      
      // Verifikation: Repository erhält Entry mit deutschem rawInput
      expect(mockRepository.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          rawInput: 'ei',
          parsedName: 'ei'
        })
      );
    });

    it('sollte "zwei eier" als deutschen Input erhalten', async () => {
      const rawInput = 'zwei eier';
      
      await useCase.execute({ rawText: rawInput, rawInput });
      
      // Verifikation: rawInput bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*rawInput="zwei eier"/)
      );
      
      // Verifikation: parsedName bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*parsedName="eier"/)
      );
      
      // Verifikation: Resolver erhält deutschen Input
      expect(mockResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: 'zwei eier',
          normalized: 'eier',
          locale: 'de'
        }),
        expect.any(Object)
      );
      
      // Verifikation: Repository erhält Entry mit deutschem rawInput
      expect(mockRepository.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          rawInput: 'zwei eier',
          parsedName: 'eier'
        })
      );
    });

    it('sollte "200g quark" als deutschen Input erhalten', async () => {
      const rawInput = '200g quark';
      
      await useCase.execute({ rawText: rawInput, rawInput });
      
      // Verifikation: rawInput bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*rawInput="200g quark"/)
      );
      
      // Verifikation: parsedName bleibt deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*parsedName="quark"/)
      );
      
      // Verifikation: Resolver erhält deutschen Input
      expect(mockResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: '200g quark',
          normalized: 'quark',
          locale: 'de'
        }),
        expect.any(Object)
      );
      
      // Verifikation: Repository erhält Entry mit deutschem rawInput
      expect(mockRepository.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          rawInput: '200g quark',
          parsedName: 'quark'
        })
      );
    });
  });

  describe('Canonical Entity Detection ohne frühe Übersetzung', () => {
    it('sollte canonical entity erkennen aber parsedName NICHT überschreiben', async () => {
      const rawInput = 'ei';
      
      await useCase.execute({ rawText: rawInput, rawInput });
      
      // Verifikation: Canonical Entity wird erkannt
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*canonicalId="egg"/)
      );
      
      // Verifikation: parsedName bleibt aber deutsch
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/PROOF_INPUT_PRESERVATION.*parsedName="ei"/)
      );
      
      // Verifikation: Repository Entry hat deutschen parsedName
      expect(mockRepository.addEntry).toHaveBeenCalledWith(
        expect.objectContaining({
          parsedName: 'ei' // NICHT 'egg'
        })
      );
    });
  });

  describe('Source-spezifische Query-Verifikation', () => {
    it('sollte BLS/OFF deutsche Queries erhalten', async () => {
      const rawInput = 'ei';
      
      await useCase.execute({ rawText: rawInput, rawInput });
      
      // Verifikation: Resolver wird mit deutschem Query aufgerufen
      expect(mockResolver.resolve).toHaveBeenCalledWith(
        expect.objectContaining({
          raw: 'ei',
          normalized: 'ei',
          locale: 'de'
        }),
        expect.any(Object)
      );
      
      // Mock Resolver sollte deutschen Input erhalten haben
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/MOCK_RESOLVER_RECEIVED.*raw="ei".*normalized="ei".*locale="de"/)
      );
    });
  });
});