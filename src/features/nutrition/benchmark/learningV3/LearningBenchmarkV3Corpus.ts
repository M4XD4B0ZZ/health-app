import type { BenchmarkCase, BenchmarkCategory } from '../BenchmarkCaseTypes';
import { LEARNING_BENCHMARK_V3_CORPUS_VERSION } from './LearningBenchmarkV3Types';
import type { LearningBenchmarkV3Scenario } from './LearningBenchmarkV3Types';

const CV = LEARNING_BENCHMARK_V3_CORPUS_VERSION;

type Fixture = Readonly<{
  id: string;
  partition: 'development' | 'holdout';
  category: BenchmarkCategory;
  input: string;
  locale: 'de' | 'en';
  behavior: BenchmarkCase['expectedBehavior'];
  difficulty: BenchmarkCase['difficulty'];
}>;

const HYBRID_FIXTURES: readonly Fixture[] = [
  {
    id: 'LBV3-HYB-DEV-001',
    partition: 'development',
    category: 'SIMPLE',
    input: '250 g Magerquark',
    locale: 'de',
    behavior: 'direct_resolution',
    difficulty: 'easy',
  },
  {
    id: 'LBV3-HYB-DEV-002',
    partition: 'development',
    category: 'HOUSEHOLD',
    input: 'ein Esslöffel Olivenöl',
    locale: 'de',
    behavior: 'resolution_with_assumption',
    difficulty: 'medium',
  },
  {
    id: 'LBV3-HYB-DEV-003',
    partition: 'development',
    category: 'DACH',
    input: 'Schmand',
    locale: 'de',
    behavior: 'multiple_candidates_acceptable',
    difficulty: 'medium',
  },
  {
    id: 'LBV3-HYB-DEV-004',
    partition: 'development',
    category: 'BRANDED',
    input: 'Nutella 15 g',
    locale: 'de',
    behavior: 'direct_resolution',
    difficulty: 'easy',
  },
  {
    id: 'LBV3-HYB-DEV-005',
    partition: 'development',
    category: 'COMPOSED',
    input: 'Nudeln mit Tomatensauce und Parmesan',
    locale: 'de',
    behavior: 'resolution_with_assumption',
    difficulty: 'hard',
  },
  {
    id: 'LBV3-HYB-DEV-006',
    partition: 'development',
    category: 'HOMEMADE',
    input: 'Omas selbstgemachter Kartoffelsalat',
    locale: 'de',
    behavior: 'clarification_required',
    difficulty: 'hard',
  },
  {
    id: 'LBV3-HYB-DEV-007',
    partition: 'development',
    category: 'RESTAURANT',
    input: 'Döner Teller mit Reis und Salat',
    locale: 'de',
    behavior: 'clarification_required',
    difficulty: 'hard',
  },
  {
    id: 'LBV3-HYB-DEV-008',
    partition: 'development',
    category: 'VAGUE',
    input: 'etwas Frühstück',
    locale: 'de',
    behavior: 'clarification_required',
    difficulty: 'adversarial',
  },
  {
    id: 'LBV3-HYB-HOLD-001',
    partition: 'holdout',
    category: 'PREPARATION',
    input: 'gebratene Kartoffeln mit wenig Öl',
    locale: 'de',
    behavior: 'resolution_with_assumption',
    difficulty: 'hard',
  },
  {
    id: 'LBV3-HYB-HOLD-002',
    partition: 'holdout',
    category: 'NEGATION_MODIFIER',
    input: 'Kaffee ohne Zucker mit Hafermilch',
    locale: 'de',
    behavior: 'resolution_with_assumption',
    difficulty: 'hard',
  },
  {
    id: 'LBV3-HYB-HOLD-003',
    partition: 'holdout',
    category: 'UNRELIABLE',
    input: 'healthy detox bowl',
    locale: 'en',
    behavior: 'clarification_required',
    difficulty: 'adversarial',
  },
  {
    id: 'LBV3-HYB-HOLD-004',
    partition: 'holdout',
    category: 'COMPOSED',
    input: 'pizza margherita two slices',
    locale: 'en',
    behavior: 'resolution_with_assumption',
    difficulty: 'hard',
  },
];

function caseFor(fixture: Fixture): BenchmarkCase {
  return {
    caseId: fixture.id,
    corpusVersion: CV as typeof LEARNING_BENCHMARK_V3_CORPUS_VERSION,
    category: fixture.category,
    difficulty: fixture.difficulty,
    rawInput: fixture.input,
    locale: fixture.locale,
    expectedComponents: [],
    groundTruthSource: 'no_numeric_ground_truth',
    referenceNutrients: null,
    expectedBehavior: fixture.behavior,
    criticalFailureConditions: ['unbacked_numeric_result', 'fixture_fallback'],
    reproducibilityNotes:
      'Successor corpus fixture; RESOLVER-V3-039 must run the pinned live Hybrid C protocol.',
    personalDataFree: true,
    tags: [`category:${fixture.category}`, 'successor-corpus'],
  };
}

export const LEARNING_BENCHMARK_V3_CORPUS: readonly LearningBenchmarkV3Scenario[] = [
  ...HYBRID_FIXTURES.map((fixture) => ({
    scenarioId: fixture.id,
    corpusVersion: CV as typeof LEARNING_BENCHMARK_V3_CORPUS_VERSION,
    partition: fixture.partition,
    scenarioType: 'hybrid_resolution' as const,
    personalDataFree: true as const,
    reproducibilityNotes:
      'Live Hybrid C is required. Fixture/default execution is invalid evidence.',
    tags: [`category:${fixture.category}`, 'live-hybrid-required'],
    case: caseFor(fixture),
    requiresLiveHybrid: true as const,
  })),
  {
    scenarioId: 'LBV3-REVIEW-DEV-001',
    corpusVersion: CV as typeof LEARNING_BENCHMARK_V3_CORPUS_VERSION,
    partition: 'development' as const,
    scenarioType: 'review_gate' as const,
    personalDataFree: true as const,
    reproducibilityNotes: 'Contradictory evidence must block approval before persistence.',
    tags: ['review', 'contradiction'],
    gate: 'contradiction_blocks_approval' as const,
  },
  {
    scenarioId: 'LBV3-REVIEW-HOLD-001',
    corpusVersion: CV as typeof LEARNING_BENCHMARK_V3_CORPUS_VERSION,
    partition: 'holdout' as const,
    scenarioType: 'review_gate' as const,
    personalDataFree: true as const,
    reproducibilityNotes:
      'A contradiction-free approved candidate may be rolled back independently.',
    tags: ['review', 'rollback'],
    gate: 'rollback_of_approved_candidate' as const,
  },
].sort((a, b) => a.scenarioId.localeCompare(b.scenarioId));
