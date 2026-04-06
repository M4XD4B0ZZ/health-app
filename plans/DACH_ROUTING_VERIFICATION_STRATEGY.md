# DACH Routing Verification Strategy

## Test Cases für Kernfälle

### Primäre Testfälle (Must Pass)

```typescript
const coreTestCases = [
  // Hauptproblem: ei sollte BLS finden
  {
    input: 'ei',
    locale: 'de',
    expectedInputType: 'ambiguous',
    expectedStrategy: 'DACH_AMBIGUOUS_FIRST',
    expectedSourceOrder: ['user', 'bls', 'off', 'usda'],
    expectedBLSCalled: true,
    expectedBLSMatch: 'Ruehrei gebraten',
    expectedWinnerSource: 'bls',
    description: 'ei sollte über BLS Token-Matching rührei finden'
  },
  
  // Regression: quark muss weiter funktionieren
  {
    input: 'quark',
    locale: 'de',
    expectedInputType: 'generic',
    expectedStrategy: 'DACH_GENERIC_FIRST',
    expectedSourceOrder: ['user', 'bls', 'off', 'usda'],
    expectedBLSCalled: true,
    expectedBLSMatch: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
    expectedWinnerSource: 'bls',
    description: 'quark muss weiter über BLS early return funktionieren'
  },
  
  // Weitere deutsche Kernfälle
  {
    input: 'magerquark',
    locale: 'de',
    expectedInputType: 'generic',
    expectedStrategy: 'DACH_GENERIC_FIRST',
    expectedBLSCalled: true,
    expectedWinnerSource: 'bls',
    description: 'magerquark direkter BLS Match'
  },
  
  {
    input: 'rührei',
    locale: 'de',
    expectedInputType: 'generic',
    expectedStrategy: 'DACH_GENERIC_FIRST',
    expectedBLSCalled: true,
    expectedWinnerSource: 'bls',
    description: 'rührei direkter BLS Match'
  },
  
  {
    input: 'toast',
    locale: 'de',
    expectedInputType: 'generic',
    expectedStrategy: 'DACH_GENERIC_FIRST',
    expectedBLSCalled: true,
    expectedWinnerSource: 'bls',
    description: 'toast direkter BLS Match'
  },
  
  {
    input: 'buttertoast',
    locale: 'de',
    expectedInputType: 'generic',
    expectedStrategy: 'DACH_GENERIC_FIRST',
    expectedBLSCalled: true,
    expectedBLSMatch: 'Buttertoast (Default-Shortcut aus BLS-Toast + Butter-Annahme)',
    expectedWinnerSource: 'bls',
    description: 'buttertoast über BLS Shortcut'
  }
];
```

### Branded Input Tests (Regression)

```typescript
const brandedTestCases = [
  {
    input: 'nutella',
    locale: 'de',
    expectedInputType: 'branded',
    expectedStrategy: 'BRANDED_OFF_FIRST',
    expectedSourceOrder: ['user', 'off', 'bls', 'usda'],
    expectedBLSCalled: false,
    expectedWinnerSource: 'off',
    description: 'Branded inputs sollen OFF-first bleiben'
  },
  
  {
    input: 'milka schokolade',
    locale: 'de',
    expectedInputType: 'branded',
    expectedStrategy: 'BRANDED_OFF_FIRST',
    expectedBLSCalled: false,
    description: 'Branded inputs mit Zusatz sollen OFF-first bleiben'
  }
];
```

### Edge Cases

```typescript
const edgeCases = [
  // Non-German locale sollte unverändert bleiben
  {
    input: 'egg',
    locale: 'en',
    expectedInputType: 'generic',
    expectedStrategy: 'STANDARD_SEQUENTIAL',
    expectedSourceOrder: ['user', 'off', 'bls', 'usda'],
    expectedBLSCalled: false,
    description: 'Englische Inputs sollen BLS nicht aufrufen'
  },
  
  // Ambiguous non-German
  {
    input: 'xyz',
    locale: 'en',
    expectedInputType: 'ambiguous',
    expectedStrategy: 'STANDARD_SEQUENTIAL',
    expectedBLSCalled: false,
    description: 'Ambiguous non-German sollen STANDARD_SEQUENTIAL verwenden'
  },
  
  // Deutsche ambiguous ohne BLS Match
  {
    input: 'unbekanntes essen',
    locale: 'de',
    expectedInputType: 'ambiguous',
    expectedStrategy: 'DACH_AMBIGUOUS_FIRST',
    expectedBLSCalled: true,
    expectedBLSMatch: null,
    expectedWinnerSource: 'off', // Fallback zu OFF/USDA
    description: 'Deutsche ambiguous ohne BLS Match sollen zu OFF/USDA fallen'
  }
];
```

## Expected Log Patterns

### Erfolgreiche BLS Aufrufe

```
[traceId] PROOF_SOURCE_ROUTING_DECISION rawInput="ei" classification="ambiguous" locale="de" chosenPriority="DACH_AMBIGUOUS_FIRST"
[traceId] PROOF_BLS_ALLOWED locale="de" inputType="ambiguous"
[traceId] PROOF_BLS_MATCH input="ei" candidates_count=1 best_match="Ruehrei gebraten" score=0.87
[traceId] RESULT bestMatch="Ruehrei gebraten" source="bls" confidence=0.87
```

### BLS Skip für Branded

```
[traceId] PROOF_SOURCE_ROUTING_DECISION rawInput="nutella" classification="branded" locale="de" chosenPriority="BRANDED_OFF_FIRST"
[traceId] PROOF_BLS_SKIPPED reason="branded_input_type" locale="de" inputType="branded"
```

### BLS Skip für Non-German

```
[traceId] PROOF_SOURCE_ROUTING_DECISION rawInput="egg" classification="generic" locale="en" chosenPriority="STANDARD_SEQUENTIAL"
[traceId] PROOF_BLS_SKIPPED reason="non_german_locale" locale="en" inputType="generic"
```

## Test Implementation

### Unit Test Structure

```typescript
// src/features/nutrition/__tests__/DachRoutingCorrection.test.ts
describe('DACH Routing Correction', () => {
  describe('Core Cases', () => {
    test.each(coreTestCases)('$description', async (testCase) => {
      const result = await resolver.resolve({
        raw: testCase.input,
        locale: testCase.locale,
        inputType: testCase.expectedInputType
      });
      
      expect(result.best?.source).toBe(testCase.expectedWinnerSource);
      if (testCase.expectedBLSMatch) {
        expect(result.best?.food.name).toContain(testCase.expectedBLSMatch);
      }
    });
  });
  
  describe('Branded Regression', () => {
    test.each(brandedTestCases)('$description', async (testCase) => {
      // Test branded behavior unchanged
    });
  });
  
  describe('Edge Cases', () => {
    test.each(edgeCases)('$description', async (testCase) => {
      // Test edge cases
    });
  });
});
```

### Integration Test

```typescript
// src/features/nutrition/__tests__/DachRoutingIntegration.test.ts
describe('DACH Routing Integration', () => {
  test('ei routing flow end-to-end', async () => {
    const query = { raw: 'ei', locale: 'de' };
    
    // 1. Input classification
    const inputType = detectInputType(query.raw);
    expect(inputType).toBe('ambiguous');
    
    // 2. Routing strategy
    const strategy = resolver.determineSourceRoutingStrategy({...query, inputType});
    expect(strategy.name).toBe('DACH_AMBIGUOUS_FIRST');
    expect(strategy.sourcePriority).toEqual(['user', 'bls', 'off', 'usda', 'ai']);
    
    // 3. BLS call
    const blsSource = new BlsStaticSource();
    const blsResults = await blsSource.search({...query, inputType, normalized: 'ei'});
    expect(blsResults.length).toBeGreaterThan(0);
    expect(blsResults[0].food.name).toContain('Ruehrei');
    
    // 4. Full resolution
    const decision = await resolver.resolve(query);
    expect(decision.best?.source).toBe('bls');
    expect(decision.best?.food.name).toContain('Ruehrei');
  });
});
```

## Verify Commands

### Automated Tests

```bash
# Alle Tests laufen lassen
npm run verify

# Spezifische DACH Routing Tests
npm run test -- --testNamePattern="DachRouting"

# BLS Integration Tests
npm run test -- --testNamePattern="BlsResolverIntegration"

# Type checking
npm run typecheck

# Linting
npm run lint
```

### Manual Verification

```bash
# Debug einzelne Fälle
node -e "
const { detectInputType } = require('./src/features/nutrition/application/utils/detectInputType');
console.log('ei:', detectInputType('ei'));
console.log('quark:', detectInputType('quark'));
console.log('nutella:', detectInputType('nutella'));
"

# Test BLS direkt
node debug-test.js
```

## Success Criteria Checklist

### ✅ Functional Requirements

- [ ] `ei` wird als `ambiguous` klassifiziert
- [ ] `ei` führt zu `DACH_AMBIGUOUS_FIRST` Strategie
- [ ] BLS wird für `locale=de + inputType=ambiguous` aufgerufen
- [ ] BLS findet `rührei` für Input `ei`
- [ ] `ei` Resolution gewinnt mit BLS als Quelle
- [ ] `quark` funktioniert weiterhin (Regression Test)
- [ ] Branded inputs bleiben OFF-first (Regression Test)

### ✅ Logging Requirements

- [ ] `PROOF_BLS_ALLOWED` für deutsche ambiguous inputs
- [ ] `PROOF_BLS_SKIPPED` mit korrektem reason
- [ ] `PROOF_SOURCE_ROUTING_DECISION` zeigt korrekte Strategie
- [ ] `PROOF_BLS_MATCH` für erfolgreiche BLS Treffer

### ✅ Performance Requirements

- [ ] Keine signifikante Performance-Verschlechterung
- [ ] BLS wird nicht unnötig oft aufgerufen
- [ ] Circuit Breaker funktioniert weiterhin

### ✅ Architecture Requirements

- [ ] Minimal-invasive Änderungen
- [ ] Keine Breaking Changes
- [ ] Bestehende Tests bestehen weiterhin
- [ ] Code bleibt wartbar und verständlich

## Risk Mitigation Tests

### False Positive Detection

```typescript
// Test für potentielle BLS false positives bei ambiguous inputs
const falsePositiveTests = [
  {
    input: 'random text',
    locale: 'de',
    description: 'Zufälliger Text sollte nicht fälschlicherweise BLS matchen'
  },
  {
    input: 'english word',
    locale: 'de', 
    description: 'Englische Wörter sollten nicht BLS matchen'
  }
];
```

### Performance Monitoring

```typescript
// Performance baseline tests
test('BLS call frequency monitoring', async () => {
  const testInputs = ['ei', 'quark', 'nutella', 'random'];
  let blsCallCount = 0;
  
  // Mock BLS to count calls
  const originalSearch = BlsStaticSource.prototype.search;
  BlsStaticSource.prototype.search = async function(...args) {
    blsCallCount++;
    return originalSearch.apply(this, args);
  };
  
  for (const input of testInputs) {
    await resolver.resolve({ raw: input, locale: 'de' });
  }
  
  // Erwarte: ei=1, quark=1, nutella=0, random=1 = 3 calls total
  expect(blsCallCount).toBe(3);
});
```

## Rollback Plan

Falls die Implementierung Probleme verursacht:

### Quick Rollback

```typescript
// In BlsStaticSource.ts - zurück zur alten Logik
if (query.locale !== 'de' || query.inputType !== 'generic') {
  console.log(`[DEBUG] BLS SKIPPED locale="${query.locale}" inputType="${query.inputType}"`);
  return [];
}
```

### Feature Flag Option

```typescript
// Für schrittweisen Rollout
const ENABLE_AMBIGUOUS_BLS = process.env.ENABLE_AMBIGUOUS_BLS === 'true';

if (query.locale !== 'de' || 
    (!ENABLE_AMBIGUOUS_BLS && query.inputType !== 'generic') ||
    (ENABLE_AMBIGUOUS_BLS && !['generic', 'ambiguous'].includes(query.inputType))) {
  // skip BLS
}
```

## Monitoring & Observability

### Key Metrics

- BLS call rate für ambiguous inputs
- BLS success rate für ambiguous vs generic
- Average confidence scores für ambiguous BLS matches
- Fallback rate zu OFF/USDA nach BLS miss

### Alert Conditions

- BLS call rate > 150% of baseline
- BLS success rate für ambiguous < 30%
- Resolver timeout rate > 5%

Diese Verify-Strategie stellt sicher, dass die DACH Routing Korrektur robust implementiert und getestet wird, ohne bestehende Funktionalität zu beeinträchtigen.