# Nutrition Feature Module

Sauber architekturierte Nutrition-Feature mit Clean Architecture-Prinzipien.

## Sprint 1: Core Logging Engine ✅

### Struktur

```
src/features/nutrition/
├── domain/                    # Pure Domain-Logik
│   ├── models/               # Typen & Interfaces
│   └── engine/               # Business-Logik-Engine
├── application/              # Use-Cases & Ports
│   ├── ports/                # Interface-Definitionen
│   └── usecases/             # Anwendungslogik
├── infrastructure/           # Implementierungen
│   ├── repositories/         # In-Memory-Persistierung
│   ├── parsers/              # Deterministischer Parser
│   ├── SystemClock.ts        # Zeit-Provider
│   └── RandomIdGenerator.ts  # ID-Generator
└── __tests__/                # Unit Tests
```

### Features

#### 1. Ports (Interfaces)
- **FoodEntryRepository**: Persistierung-Interface für FoodEntries
- **Clock**: Zeit-Abstraction für deterministische Tests
- **IdGenerator**: ID-Generierung-Interface

#### 2. Infrastructure
- **InMemoryFoodEntryRepository**: In-Memory-Speicher gruppiert nach Datum
- **SystemClock**: System-Zeit-Implementierung
- **RandomIdGenerator**: Einfacher ID-Generator ohne Dependencies
- **TestIdGenerator**: Deterministische ID-Generator für Tests

#### 3. Deterministic Parser
- Erkennt Gramm-Patterns: "250g", "250 g", "250.5g"
- Erkennt Count-Patterns: "2 eggs", "3x eggs", "2 x"
- Normalisiert Namen: lowercase, trim, collapse spaces
- **Keine AI/LLM-Calls**

#### 4. Use Cases

**LogFoodFromRawInputUseCase**
- Input: rawInput (string), dateISO (optional)
- Parsed via DeterministicFoodParser
- Confidence-Scoring:
  - 0.5: Gramm-Angabe vorhanden (Menge bekannt, Nutrition unbekannt)
  - 0.35: Nur Count oder keine Angabe (low confidence)
- Macros bleiben bei 0 (noch keine Nutrition-DB)
- Speichert via Repository

**GetDailySummaryUseCase**
- Input: dateISO
- Lädt alle Einträge für das Datum
- Aggregiert via NutritionEngine.aggregateDaily()

**DeleteFoodEntryUseCase**
- Input: entryId
- Löscht Eintrag via Repository

### Tests

Alle 26 Unit Tests erfolgreich:
```bash
npm test
```

- ✅ DeterministicFoodParser (12 Tests)
- ✅ LogFoodFromRawInputUseCase (6 Tests)
- ✅ GetDailySummaryUseCase (5 Tests)
- ✅ DeleteFoodEntryUseCase (3 Tests)

### Design-Prinzipien

1. **Deterministic-First**: Keine LLM-Calls im Core Logging
2. **Testbar**: Alle Dependencies injiziert via Ports
3. **Pure Functions**: Domain Engine ohne Side-Effects
4. **Zero Dependencies**: Keine externen Libraries für Core-Logik
5. **TypeScript-Strict**: Vollständige Type-Safety

### Nächste Schritte (Sprint 2+)

- Nutrition-Datenbank-Integration
- Confidence-basierte AI-Fallbacks
- Bias-Adjustments
- Caching-Layer
- React UI Integration
