// Test setup file - sets environment variables for Jest tests
process.env.EXPO_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

// Mock Supabase functions globally for all tests
jest.mock('@supabase/supabase-js', () => {
  const mockSupabaseClient = {
    functions: {
      invoke: jest.fn().mockResolvedValue({
        data: {
          type: 'fresh',
          items: [],
        },
        error: null,
      }),
    },
    from: jest.fn().mockReturnValue({
      select: jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          single: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
        order: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      }),
      insert: jest.fn().mockResolvedValue({ data: null, error: null }),
      update: jest.fn().mockResolvedValue({ data: null, error: null }),
      delete: jest.fn().mockResolvedValue({ data: null, error: null }),
    }),
  };

  return {
    createClient: jest.fn(() => mockSupabaseClient),
  };
});

// Mock the DI container to use MockResolverBuilder
jest.mock('./infrastructure/di/container', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    MockResolverBuilder,
  } = require('./features/nutrition/__tests__/helpers/MockResolverBuilder');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    InMemoryFoodEntryRepository,
  } = require('./features/nutrition/infrastructure/repositories/InMemoryFoodEntryRepository');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    DeterministicFoodParser,
  } = require('./features/nutrition/infrastructure/parsers/DeterministicFoodParser');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    LogFoodFromRawInputUseCase,
  } = require('./features/nutrition/application/usecases/LogFoodFromRawInputUseCase');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { TestIdGenerator } = require('./features/nutrition/infrastructure/RandomIdGenerator');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const {
    PortionKnowledgeService,
    InMemoryPortionHintRepository,
  } = require('./features/nutrition/domain/portion/PortionKnowledgeService');
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { SEED_PORTION_HINTS } = require('./features/nutrition/domain/portion/seedPortionHints');

  // Test-Implementierung für Clock
  class TestClock {
    private fixedDate: Date;

    constructor(fixedDate = new Date('2026-02-15T12:00:00Z')) {
      this.fixedDate = fixedDate;
    }

    now(): Date {
      return this.fixedDate;
    }

    todayISO(): string {
      return this.fixedDate.toISOString().slice(0, 10);
    }
  }

  const mockRepository = new InMemoryFoodEntryRepository();
  const mockClock = new TestClock();
  const mockIdGenerator = new TestIdGenerator();
  const mockParser = new DeterministicFoodParser();
  const mockResolver = MockResolverBuilder.createHappyPathResolver();

  // Create a minimal mock food catalog
  const mockFoodCatalog = {
    getById: jest.fn().mockResolvedValue(null),
    searchByName: jest.fn().mockResolvedValue(null),
  };

  // Same wiring as the real container (container.ts): a single PortionKnowledgeService
  // instance shared between the use case (read path) and the exposed container property
  // (write path via confirmUserPrivateHint), so P1-004C's confirm-and-retry flow is
  // testable end-to-end exactly as JournalScreen drives it in production.
  const mockPortionKnowledgeService = new PortionKnowledgeService(
    new InMemoryPortionHintRepository(SEED_PORTION_HINTS),
  );

  const mockLogFoodFromRawInputUseCase = new LogFoodFromRawInputUseCase(
    mockRepository,
    mockClock,
    mockIdGenerator,
    mockParser,
    mockFoodCatalog,
    undefined, // aliasRepository
    undefined, // aiFoodMapper
    undefined, // nutritionLookup
    mockResolver,
    mockPortionKnowledgeService,
  );

  return {
    __esModule: true,
    default: {
      logFoodFromRawInputUseCase: mockLogFoodFromRawInputUseCase,
      portionKnowledgeService: mockPortionKnowledgeService,
      // Add other container properties as needed
    },
  };
});

// Mock console.error to reduce noise in tests
const originalConsoleError = console.error;
console.error = jest.fn((message, ...args) => {
  // Only suppress specific test-related errors
  if (
    typeof message === 'string' &&
    (message.includes('Resolution failed for input:') ||
      message.includes('Failed to parse stored entries:'))
  ) {
    return;
  }
  originalConsoleError(message, ...args);
});
