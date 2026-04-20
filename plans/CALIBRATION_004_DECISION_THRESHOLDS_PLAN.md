# CALIBRATION-004: Decision Thresholds Optimization Plan

## Ziel
Reduzierung von false ambiguous Entscheidungen durch gezielte Anpassung der Decision-Thresholds, ohne Retrieval, Source Priorities oder Score-Gewichte zu ändern.

## Analyse der aktuellen Decision-Layer-Logik

### Aktuelle Threshold-Werte (in FusionCandidateResolver.ts)

```typescript
// Zeile 211: Ambiguous-Check
if (secondBest && Math.abs(best.breakdown.finalScore - secondBest.breakdown.finalScore) < 0.12) {
  return this.createAmbiguousDecision(rankedCandidates, query, traceId);
}

// Zeile 216-224: Confidence-Thresholds
if (best.breakdown.finalScore >= 0.82) {
  return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED');
} else if (best.breakdown.finalScore >= 0.62) {
  return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED_WITH_ASSUMPTION');
} else if (best.breakdown.finalScore >= 0.42) {
  return this.createAmbiguousDecision(rankedCandidates, query, traceId);
} else {
  return this.createRejectedDecision(rankedCandidates, query, traceId);
}
```

### Identifizierte Probleme

1. **Zu konservative Gap-Prüfung**: 0.12 Gap ist zu hoch, führt zu unnötigen ambiguous-Entscheidungen
2. **Zu hohe accepted-Schwelle**: 0.82 ist zu streng für gute Matches
3. **Fehlende semantische Nähe-Prüfung**: Keine Unterscheidung zwischen echten Alternativen und Varianten

### CALIBRATION-004 Zielregeln

#### 1. Accepted (score >= 0.82 und gap >= 0.04)
- **Aktuell**: score >= 0.82, gap >= 0.12
- **Neu**: score >= 0.82, gap >= 0.04
- **Begründung**: Lockert gap-Anforderung, behält hohe Score-Schwelle

#### 2. Accepted_with_assumption (score >= 0.78, auch bei kleinerem gap)
- **Aktuell**: score >= 0.62
- **Neu**: score >= 0.78, wenn Top-1 und Top-2 semantisch nah
- **Bedingung**: Semantische Nähe = gleiche Food-Klasse/Grundbedeutung/Varianten

#### 3. Ambiguous (nur bei echter semantischer Konkurrenz)
- **Aktuell**: gap < 0.12 oder score < 0.82
- **Neu**: Nur wenn Top-2 echte alternative Interpretation repräsentiert
- **Nicht**: Lexikalische Ähnlichkeit bei anderer Produktklasse

## Implementierungsplan

### Schritt 1: Semantische Nähe-Erkennung implementieren

**Datei**: `src/features/nutrition/domain/fusion/SemanticSimilarity.ts` (neu)

```typescript
export interface SemanticSimilarityAnalyzer {
  areSemanticallySimilar(candidate1: FusionCandidate, candidate2: FusionCandidate): boolean;
  getSemanticDistance(candidate1: FusionCandidate, candidate2: FusionCandidate): number;
}

export class DefaultSemanticSimilarityAnalyzer implements SemanticSimilarityAnalyzer {
  // Implementierung der semantischen Nähe-Logik
}
```

**Kriterien für semantische Nähe**:
- Gleiche Grundkategorie (Milchprodukt, Ei-Produkt, Brot, etc.)
- Varianten desselben Grundprodukts (Quark vs. Magerquark)
- Ähnliche Zubereitungsformen (Ei vs. Rührei)

### Schritt 2: Erweiterte Decision-Logik

**Datei**: `src/features/nutrition/application/services/FusionCandidateResolver.ts`

**Neue `makeDecision` Methode**:

```typescript
private makeDecision(
  rankedCandidates: { candidate: FusionCandidate; breakdown: ConfidenceBreakdown; rank: number }[],
  query: FoodSearchQuery,
  traceId: string,
): FusionResolverDecision {
  if (rankedCandidates.length === 0) {
    return this.createNoResultsDecision(query, traceId);
  }

  const best = rankedCandidates[0];
  const secondBest = rankedCandidates[1];
  const scoreGap = secondBest ? best.breakdown.finalScore - secondBest.breakdown.finalScore : 1.0;

  // CALIBRATION-004: Neue Decision-Regeln
  
  // 1. Accepted: score >= 0.82 und gap >= 0.04
  if (best.breakdown.finalScore >= 0.82 && scoreGap >= 0.04) {
    return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED');
  }
  
  // 2. Accepted_with_assumption: score >= 0.78 bei semantischer Nähe
  if (best.breakdown.finalScore >= 0.78 && secondBest) {
    const areSemanticallySimilar = this.semanticAnalyzer.areSemanticallySimilar(
      best.candidate, 
      secondBest.candidate
    );
    
    if (areSemanticallySimilar) {
      return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED_WITH_ASSUMPTION');
    }
  }
  
  // 3. Ambiguous: nur bei echter semantischer Konkurrenz
  if (secondBest && scoreGap < 0.08) {
    const areSemanticallySimilar = this.semanticAnalyzer.areSemanticallySimilar(
      best.candidate, 
      secondBest.candidate
    );
    
    if (!areSemanticallySimilar) {
      // Echte alternative Interpretation
      return this.createAmbiguousDecision(rankedCandidates, query, traceId);
    } else {
      // Semantisch ähnlich -> accepted_with_assumption
      return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED_WITH_ASSUMPTION');
    }
  }
  
  // 4. Fallback zu bestehender Logik
  if (best.breakdown.finalScore >= 0.62) {
    return this.createAcceptedDecision(rankedCandidates, query, traceId, 'ACCEPTED_WITH_ASSUMPTION');
  } else if (best.breakdown.finalScore >= 0.42) {
    return this.createAmbiguousDecision(rankedCandidates, query, traceId);
  } else {
    return this.createRejectedDecision(rankedCandidates, query, traceId);
  }
}
```

### Schritt 3: Test-Erweiterungen

**Datei**: `src/features/nutrition/__tests__/FusionCalibrationMatrix.test.ts`

**Neue Test-Fälle für CALIBRATION-004**:

```typescript
describe('CALIBRATION-004: Decision Thresholds', () => {
  it('should accept with relaxed gap for high scores', async () => {
    // Test: score >= 0.82, gap >= 0.04 -> accepted
  });
  
  it('should accept_with_assumption for semantically similar candidates', async () => {
    // Test: score >= 0.78, semantisch nah -> accepted_with_assumption
  });
  
  it('should remain ambiguous for true semantic alternatives', async () => {
    // Test: echte Alternativen -> ambiguous
  });
  
  it('should reduce false ambiguous for simple foods', async () => {
    // Test: ei, milch, toast -> weniger ambiguous
  });
});
```

### Schritt 4: Threshold-Konstanten aktualisieren

**Datei**: `src/features/nutrition/domain/fusion/FusionCandidate.ts`

```typescript
export const FUSION_THRESHOLDS = {
  HIGH_CONFIDENCE: 0.82,        // Accepted (war 0.85)
  MEDIUM_CONFIDENCE: 0.78,      // Accepted_with_assumption (war 0.70)
  LOW_CONFIDENCE: 0.42,         // Ambiguous/reject threshold (unverändert)
  AMBIGUOUS_DIFF: 0.04,         // Max diff für clear winner (war 0.05)
  SEMANTIC_SIMILARITY_THRESHOLD: 0.08, // Neu: Schwelle für semantische Prüfung
} as const;
```

## Erwartete Verbesserungen

### Quantitative Ziele
- **Reduzierung ambiguous**: Von ~40% auf ~25% bei einfachen Foods
- **Erhöhung accepted**: Von ~35% auf ~50% bei klaren Matches
- **Beibehaltung Präzision**: Keine false accepts bei echten Alternativen

### Qualitative Verbesserungen
- Weniger Nutzer-Friction bei eindeutigen Inputs
- Bessere UX für Standard-Lebensmittel (ei, milch, toast)
- Erhaltung der Sicherheit bei echten Mehrdeutigkeiten

## Risiken und Mitigation

### Risiko 1: False Accepts
**Mitigation**: Semantische Nähe-Prüfung verhindert Accepts bei echten Alternativen

### Risiko 2: Komplexität
**Mitigation**: Minimale Änderung nur in Decision-Layer, keine Architektur-Änderung

### Risiko 3: Performance
**Mitigation**: Semantische Prüfung nur bei Top-2 Kandidaten, einfache Heuristiken

## Verifikation

### Test-Matrix
```
Input          | Aktuell    | CALIBRATION-004 | Verbesserung
---------------|------------|-----------------|-------------
ei             | ambiguous  | accepted        | ✓
quark          | ambiguous  | accepted        | ✓
toast          | ambiguous  | accepted        | ✓
protein quark  | ambiguous  | accepted_w_ass  | ✓
greek yogurt   | ambiguous  | accepted_w_ass  | ✓
cottage cheese | ambiguous  | ambiguous       | = (korrekt)
```

### Verify-Schritte
1. `npm run test -- --testPathPattern="FusionCalibrationMatrix"`
2. `npm run verify`
3. Manuelle Prüfung der Log-Ausgaben
4. Performance-Messung der Decision-Layer

## Implementierungs-Reihenfolge

1. **SemanticSimilarityAnalyzer** implementieren
2. **FusionCandidateResolver.makeDecision** erweitern
3. **FUSION_THRESHOLDS** aktualisieren
4. **Test-Fälle** für CALIBRATION-004 hinzufügen
5. **Verify-Schritte** ausführen
6. **Dokumentation** der Änderungen

## Definition of Done

- [ ] Alle neuen Tests bestehen
- [ ] `npm run verify` erfolgreich
- [ ] Ambiguous-Rate bei einfachen Foods reduziert
- [ ] Keine Regression bei echten Mehrdeutigkeiten
- [ ] Performance bleibt innerhalb Budget
- [ ] Dokumentation aktualisiert