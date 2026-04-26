# Candidate Fusion Layer Architecture Plan

**Status:** Design Phase  
**Target:** Resolver V2 Multi-Source Fusion  
**Created:** 2026-04-08

---

## Executive Summary

Die Candidate Fusion Layer ist das Herzstück der neuen Resolver V2 Architektur. Sie ersetzt die sequenzielle Early-Return-Logik durch eine zentrale, deterministische Bewertung aller Kandidaten aus allen Quellen.

**Kernprinzip:** Sammle alle Kandidaten → Bewerte deterministisch → Wähle besten aus

---

## 1. Unified Candidate Type

### 1.1 FusionCandidate Interface

```typescript
interface FusionCandidate {
  // Core Identity
  id: string; // Unique fusion candidate ID
  source: FoodSourceType; // 'bls' | 'off' | 'usda' | 'user' | 'ai'
  sourceId: string; // Original ID in source system

  // Food Data
  name: string; // Original name from source
  normalizedName: string; // Normalized for comparison
  macrosPer100g: MacroProfile; // Standardized macro structure

  // Match Signals
  matchSignals: MatchSignals;

  // Metadata
  metadata: CandidateMetadata;
}

interface MatchSignals {
  lexicalScore: number; // 0.0 - 1.0: exact text similarity
  tokenOverlap: number; // 0.0 - 1.0: token intersection ratio
  exactMatch: boolean; // Perfect name match
  aliasUsed: boolean; // Used alias/synonym
  fuzzyMatch: boolean; // Used fuzzy matching
  semanticNarrowing: boolean; // quark → magerquark
}

interface CandidateMetadata {
  locale: string; // Source locale (de/en/multi)
  sourceQuality: SourceQuality; // Source-specific quality metrics
  dataCompleteness: number; // 0.0 - 1.0: macro completeness
  assumptions: string[]; // Applied assumptions/heuristics
  usedHeuristic: string[]; // Specific heuristics used
  queryUsed: string; // Actual query sent to source
}

interface SourceQuality {
  trustLevel: number; // 0.0 - 1.0: source reliability
  dataFreshness: number; // 0.0 - 1.0: data recency
  coverageRelevance: number; // 0.0 - 1.0: locale/domain relevance
}
```

### 1.2 MacroProfile Standardization

```typescript
interface MacroProfile {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;

  // Quality indicators
  isEstimated: boolean;
  hasIncompleteData: boolean;
  plausibilityScore: number; // 0.0 - 1.0: macro consistency
}
```

---

## 2. Deterministic Scoring Model

### 2.1 Scoring Function

```
finalScore = (
  lexicalWeight * lexicalScore +
  tokenWeight * tokenOverlap +
  sourceTrustWeight * sourceTrustScore +
  localeWeight * localeMatchScore +
  completenessWeight * dataCompleteness +
  plausibilityWeight * plausibilityScore
) - penalties
```

### 2.2 Scoring Weights

| Component             | Weight | Rationale                      |
| --------------------- | ------ | ------------------------------ |
| **Lexical Match**     | 0.35   | Primary signal for user intent |
| **Token Overlap**     | 0.20   | Handles partial matches        |
| **Source Trust**      | 0.20   | Quality differentiation        |
| **Locale Match**      | 0.15   | DACH strategy priority         |
| **Data Completeness** | 0.05   | Prefer complete data           |
| **Plausibility**      | 0.05   | Sanity check                   |
| **Total**             | 1.00   |                                |

### 2.3 Source Trust Scores

| Source         | Trust Score | Rationale                          |
| -------------- | ----------- | ---------------------------------- |
| **User Cache** | 1.0         | User-validated, highest trust      |
| **BLS**        | 0.9         | Official German database           |
| **USDA**       | 0.8         | Official US database               |
| **OFF**        | 0.7         | Community-driven, variable quality |
| **AI**         | 0.3         | Estimated, lowest trust            |

### 2.4 Locale Match Scores

| Input Locale | Source | Locale Score | Boost |
| ------------ | ------ | ------------ | ----- |
| DE           | BLS    | 1.0          | +0.1  |
| DE           | OFF    | 0.8          | +0.05 |
| DE           | USDA   | 0.6          | 0     |
| EN           | USDA   | 1.0          | +0.1  |
| EN           | OFF    | 0.8          | +0.05 |
| EN           | BLS    | 0.4          | 0     |

### 2.5 Penalty System

| Penalty Type           | Deduction | Condition                  |
| ---------------------- | --------- | -------------------------- |
| **Alias Usage**        | -0.05     | `aliasUsed = true`         |
| **Fuzzy Match**        | -0.10     | `fuzzyMatch = true`        |
| **Semantic Narrowing** | -0.15     | `semanticNarrowing = true` |
| **Incomplete Data**    | -0.08     | Missing macros             |
| **Low Plausibility**   | -0.12     | `plausibilityScore < 0.5`  |

---

## 3. Ranking Pipeline

### 3.1 Pipeline Steps

```
1. COLLECT
   ├─ Receive FoodCandidate[] from each source
   ├─ Convert to FusionCandidate[]
   └─ Validate macro data

2. NORMALIZE
   ├─ Standardize names and macros
   ├─ Calculate match signals
   └─ Compute metadata scores

3. SCORE
   ├─ Apply scoring function to each candidate
   ├─ Calculate penalties
   └─ Generate score breakdown

4. RANK
   ├─ Sort by finalScore (descending)
   ├─ Handle score ties (source priority)
   └─ Select top candidates

5. DECIDE
   ├─ Apply decision thresholds
   ├─ Generate explanation
   └─ Return ResolverDecision
```

### 3.2 Data Flow Diagram

```
[BLS Source] ──┐
[OFF Source] ──┼─→ [Candidate Collector] ─→ [Normalizer] ─→ [Scorer] ─→ [Ranker] ─→ [Decision Engine] ─→ [ResolverDecision]
[USDA Source] ─┤                                ↑              ↑          ↑           ↑
[User Cache] ──┘                                │              │          │           │
                                                 │              │          │           └─ Thresholds
                                                 │              │          └─ Weights & Penalties
                                                 │              └─ Match Signals
                                                 └─ Metadata Enrichment
```

---

## 4. Decision Thresholds

### 4.1 Confidence Levels

| Final Score     | Status                     | Action                       | Confidence |
| --------------- | -------------------------- | ---------------------------- | ---------- |
| **≥ 0.85**      | `ACCEPTED`                 | Auto-accept, save to journal | High       |
| **0.70 - 0.84** | `ACCEPTED_WITH_ASSUMPTION` | Accept with edit capability  | Medium     |
| **0.50 - 0.69** | `AMBIGUOUS`                | Present options to user      | Low        |
| **< 0.50**      | `REJECTED`                 | Request clarification        | Very Low   |

### 4.2 Special Cases

| Condition                | Override                               | Rationale           |
| ------------------------ | -------------------------------------- | ------------------- |
| **User Cache Hit**       | Auto-accept if score ≥ 0.70            | User-validated data |
| **Single Candidate**     | Lower threshold to 0.60                | No alternatives     |
| **Multiple High Scores** | Mark as ambiguous if top 2 within 0.05 | Unclear winner      |
| **All Low Scores**       | Reject if best < 0.50                  | No good matches     |

---

## 5. Explainability Output

### 5.1 Enhanced ResolverDecision

```typescript
interface FusionResolverDecision extends ResolverDecision {
  explanation: FusionExplanation;
  fusionMetrics: FusionMetrics;
}

interface FusionExplanation {
  winningReasons: string[]; // Why this candidate won
  rejectedCandidates: RejectedCandidate[]; // Top 3 alternatives
  assumptions: string[]; // Applied assumptions
  confidenceBreakdown: ConfidenceBreakdown;
  sourceComparison: SourceComparison;
}

interface RejectedCandidate {
  candidate: FusionCandidate;
  score: number;
  rejectionReasons: string[];
}

interface ConfidenceBreakdown {
  lexicalContribution: number;
  tokenContribution: number;
  sourceTrustContribution: number;
  localeContribution: number;
  completenessContribution: number;
  plausibilityContribution: number;
  totalPenalties: number;
}

interface SourceComparison {
  sourcesQueried: string[];
  candidatesPerSource: Record<string, number>;
  bestPerSource: Record<string, number>; // Best score per source
}
```

### 5.2 Human-Readable Explanations

```typescript
// Example explanations
winningReasons: [
  'Exact lexical match (score: 0.95)',
  'High source trust: BLS official database (score: 0.9)',
  'Perfect locale match for German input (score: 1.0)',
  'Complete nutritional data (score: 1.0)',
];

rejectionReasons: [
  'Lower lexical similarity (0.72 vs 0.95)',
  'Used fuzzy matching (-0.10 penalty)',
  'Incomplete macro data (-0.08 penalty)',
];
```

---

## 6. Structured Logging

### 6.1 Logging Events

```typescript
// Input logging
PROOF_FUSION_INPUT: {
  traceId: string;
  normalizedQuery: string;
  candidateCount: number;
  sourceBreakdown: Record<string, number>;
  timestamp: string;
}

// Scoring logging
PROOF_FUSION_SCORES: {
  traceId: string;
  candidateId: string;
  source: string;
  scoreBreakdown: ConfidenceBreakdown;
  finalScore: number;
  rank: number;
}

// Decision logging
PROOF_FUSION_WINNER: {
  traceId: string;
  winnerId: string;
  winnerSource: string;
  winnerScore: number;
  status: ResolverStatus;
  alternativeCount: number;
  decisionReason: string;
}

// Performance logging
PROOF_FUSION_PERFORMANCE: {
  traceId: string;
  totalCandidates: number;
  processingTimeMs: number;
  sourcesQueried: string[];
  cacheHits: number;
}
```

### 6.2 Debug Logging Format

```
[TRACE_ID] PROOF_FUSION_INPUT candidates=5 sources="bls:2,off:2,usda:1"
[TRACE_ID] PROOF_FUSION_SCORES id="bls_123" score=0.87 rank=1 lexical=0.95 trust=0.9
[TRACE_ID] PROOF_FUSION_WINNER id="bls_123" source=bls score=0.87 status=ACCEPTED reason="high_confidence_match"
```

---

## 7. Failure Case Handling

### 7.1 No Candidates Found

```typescript
// Condition: All sources return empty arrays
// Action: Return REJECTED status
{
  status: 'rejected',
  reasonCodes: ['NO_CANDIDATES_FOUND'],
  candidates: [],
  explanation: {
    winningReasons: [],
    rejectedCandidates: [],
    assumptions: ['All sources exhausted'],
    sourceComparison: {
      sourcesQueried: ['bls', 'off', 'usda'],
      candidatesPerSource: { bls: 0, off: 0, usda: 0 }
    }
  }
}
```

### 7.2 Conflicting High Scores

```typescript
// Condition: Top 2 candidates within 0.05 score difference
// Action: Mark as AMBIGUOUS, present both options
{
  status: 'ambiguous',
  reasonCodes: ['CONFLICTING_HIGH_SCORES'],
  candidates: [candidate1, candidate2],
  explanation: {
    winningReasons: ['Multiple high-quality matches found'],
    rejectedCandidates: [],
    assumptions: ['User clarification needed'],
    confidenceBreakdown: { /* detailed breakdown */ }
  }
}
```

### 7.3 Only Low Confidence Candidates

```typescript
// Condition: Best candidate score < 0.50
// Action: Return REJECTED, suggest query refinement
{
  status: 'rejected',
  reasonCodes: ['LOW_CONFIDENCE_MATCHES'],
  candidates: lowConfidenceCandidates,
  explanation: {
    winningReasons: [],
    rejectedCandidates: topThreeRejected,
    assumptions: ['Query too vague or unknown food'],
    sourceComparison: { /* source breakdown */ }
  }
}
```

### 7.4 Source Timeout/Error Handling

```typescript
// Condition: Source fails or times out
// Action: Continue with available candidates, log degradation
{
  fusionMetrics: {
    sourcesAttempted: ['bls', 'off', 'usda'],
    sourcesSucceeded: ['bls', 'off'],
    sourcesFailed: ['usda'],
    degradedMode: true
  }
}
```

---

## 8. Integration Plan

### 8.1 Replacing SequentialFoodCatalogResolver

**Current Flow:**

```
Query → Source 1 → Early Return? → Source 2 → Early Return? → Decision
```

**New Flow:**

```
Query → All Sources (Parallel) → Fusion Layer → Decision
```

### 8.2 Migration Strategy

1. **Phase 1: Parallel Implementation**
   - Implement FusionCandidateResolver alongside existing resolver
   - A/B test with feature flag
   - Compare decision quality

2. **Phase 2: Gradual Rollout**
   - Enable for specific input types (generic foods first)
   - Monitor performance and accuracy
   - Collect user feedback

3. **Phase 3: Full Replacement**
   - Replace SequentialFoodCatalogResolver
   - Remove early return logic
   - Update all tests

### 8.3 Backward Compatibility

```typescript
// Adapter pattern for existing interfaces
class FusionResolverAdapter implements FoodCatalogResolver {
  private fusionResolver: FusionCandidateResolver;

  async resolve(query: FoodSearchQuery): Promise<ResolverDecision> {
    const fusionDecision = await this.fusionResolver.resolve(query);
    return this.adaptToLegacyFormat(fusionDecision);
  }
}
```

### 8.4 Performance Considerations

| Metric                 | Current    | Target    | Strategy                       |
| ---------------------- | ---------- | --------- | ------------------------------ |
| **Latency**            | 200-500ms  | 300-600ms | Parallel source queries        |
| **Accuracy**           | 75%        | 85%+      | Better cross-source comparison |
| **Cache Hit Rate**     | 60%        | 70%+      | Improved candidate caching     |
| **Source Utilization** | Sequential | Parallel  | All sources contribute         |

---

## 9. Testing Strategy

### 9.1 Unit Tests

```typescript
describe('FusionCandidateResolver', () => {
  describe('scoring', () => {
    it('should score exact matches higher than fuzzy matches');
    it('should apply locale boost for DACH sources with DE input');
    it('should penalize semantic narrowing');
    it('should handle missing macro data gracefully');
  });

  describe('ranking', () => {
    it('should rank by final score descending');
    it('should break ties using source priority');
    it('should handle empty candidate arrays');
  });

  describe('decision thresholds', () => {
    it('should accept high confidence matches automatically');
    it('should mark conflicting scores as ambiguous');
    it('should reject low confidence matches');
  });
});
```

### 9.2 Integration Tests

```typescript
describe('FusionResolver Integration', () => {
  it('should handle real BLS + OFF + USDA candidates for "ei"');
  it('should prefer BLS for German generic foods');
  it('should handle source timeouts gracefully');
  it('should maintain performance within budget');
});
```

### 9.3 A/B Testing Metrics

| Metric                | Description                      | Target |
| --------------------- | -------------------------------- | ------ |
| **Match Accuracy**    | User acceptance rate             | >85%   |
| **Decision Speed**    | Time to final decision           | <600ms |
| **User Satisfaction** | Edit rate after acceptance       | <15%   |
| **Source Coverage**   | % queries using multiple sources | >70%   |

---

## 10. Implementation Checklist

### 10.1 Core Components

- [ ] `FusionCandidate` interface definition
- [ ] `FusionCandidateResolver` class
- [ ] `CandidateScorer` with deterministic weights
- [ ] `CandidateRanker` with tie-breaking logic
- [ ] `DecisionEngine` with thresholds
- [ ] `FusionExplanation` generator

### 10.2 Integration Components

- [ ] `FusionResolverAdapter` for backward compatibility
- [ ] Migration scripts for existing tests
- [ ] Performance monitoring hooks
- [ ] A/B testing infrastructure

### 10.3 Testing & Validation

- [ ] Unit tests for all scoring components
- [ ] Integration tests with real sources
- [ ] Performance benchmarks
- [ ] User acceptance testing

---

## 11. Success Criteria

### 11.1 Functional Requirements

✅ **Multi-Source Comparison**: All sources contribute candidates before decision  
✅ **Deterministic Scoring**: Same input produces same ranking  
✅ **Explainable Decisions**: Clear reasoning for every choice  
✅ **Performance**: Maintains <600ms response time  
✅ **Accuracy**: >85% user acceptance rate

### 11.2 Technical Requirements

✅ **Type Safety**: Full TypeScript coverage  
✅ **Testability**: >90% test coverage  
✅ **Observability**: Structured logging for all decisions  
✅ **Maintainability**: Clear separation of concerns  
✅ **Extensibility**: Easy to add new sources or scoring factors

---

## 12. Future Enhancements

### 12.1 Machine Learning Integration

- **Personalized Scoring**: Learn user preferences over time
- **Dynamic Weights**: Adjust scoring weights based on success rates
- **Semantic Similarity**: Use embeddings for better matching

### 12.2 Advanced Features

- **Confidence Calibration**: Improve threshold accuracy
- **Multi-Language Support**: Extend beyond DE/EN
- **Real-Time Learning**: Update scores based on user feedback

---

**Document Status:** Complete  
**Next Steps:** Review with team, begin implementation of RESOLVER-V2-004  
**Dependencies:** RESOLVER-V2-001, RESOLVER-V2-002, RESOLVER-V2-003 must be completed first
