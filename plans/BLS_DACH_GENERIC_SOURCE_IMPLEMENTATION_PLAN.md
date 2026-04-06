# BLS DACH Generic Source - Implementierungsplan

## Analyseergebnisse

### Aktuelle Architektur
- **FoodCatalogSource Interface**: Bereits vorhanden mit `type`, `search()` Methode
- **SequentialFoodCatalogResolver**: Implementiert DACH Data Strategy mit Input Classification Routing
- **Routing-Logik**: `DACH_GENERIC_FIRST` für `locale=de` + `inputType=generic`
- **Canonical Food System**: Vorhanden mit DE/EN Aliases für ~20 häufige Lebensmittel
- **Source Types**: `'user' | 'off' | 'usda' | 'ai'` - **BLS fehlt noch**

### BLS 4.0 Struktur (Typisch)
- **Hauptdatei**: `BLS_4_0_Daten_2025_DE.xlsx` - Lebensmitteldaten mit Nährwerten
- **Komponenten**: `BLS_4_0_Components_DE_EN.xlsx` - Nährstoff-Definitionen
- **Erwartete Spalten**: 
  - Lebensmittel-ID, Name (DE), Kategorie
  - Energie (kcal/100g), Protein, Kohlenhydrate, Fett
  - Weitere Mikronährstoffe

## Implementierungsplan

### 1. BLS Source Type Integration

#### 1.1 FoodSourceType erweitern
```typescript
// src/features/nutrition/domain/catalog/FoodCatalogSource.ts
export type FoodSourceType = 'user' | 'off' | 'usda' | 'bls' | 'ai';
```

#### 1.2 BLS Generic Source implementieren
```typescript
// src/features/nutrition/infrastructure/catalog/sources/BlsGenericSource.ts
export class BlsGenericSource implements FoodCatalogSource {
  type = 'bls' as const;
  
  async search(query: FoodSearchQuery): Promise<FoodCandidate[]> {
    // Read-only BLS lookup
    // Fuzzy matching gegen deutsche Lebensmittelnamen
    // Per-100g Nährwerte zurückgeben
  }
}
```

### 2. BLS Data Access Layer

#### 2.1 BLS Data Reader
```typescript
// src/features/nutrition/infrastructure/bls/BlsDataReader.ts
interface BlsFoodItem {
  id: string;
  nameDe: string;
  category: string;
  macrosPer100g: {
    kcal: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export class BlsDataReader {
  private foods: Map<string, BlsFoodItem> = new Map();
  
  constructor() {
    this.loadBlsData();
  }
  
  private loadBlsData(): void {
    // CSV/JSON aus BLS 4.0 laden
    // In-Memory Index aufbauen
  }
  
  searchByName(query: string): BlsFoodItem[] {
    // Fuzzy matching gegen nameDe
  }
}
```

#### 2.2 BLS Data Preprocessing
- BLS Excel → JSON/CSV Konvertierung
- Nur generische Lebensmittel (keine Markenprodukte)
- Normalisierung der deutschen Namen
- Mapping auf CanonicalFood Format

### 3. Source Routing Anpassung

#### 3.1 Resolver Source Order
```typescript
// Für locale=de + inputType=generic:
// 1. user (aliases)
// 2. bls (DACH generic)  ← NEU
// 3. off (EU database)
// 4. usda (fallback)
```

#### 3.2 Routing Strategy Update
```typescript
// SequentialFoodCatalogResolver.ts
private determineSourceRoutingStrategy(query: FoodSearchQuery) {
  if (locale === 'de' && inputType === 'generic') {
    return {
      name: 'DACH_GENERIC_FIRST',
      preferredSources: ['user', 'bls', 'off', 'usda'], // BLS vor OFF
      offEarlyReturnDisabled: true
    };
  }
  // ...
}
```

### 4. Canonical Shortcuts System

#### 4.1 Canonical Shortcuts Definition
```typescript
// src/features/nutrition/domain/catalog/CanonicalShortcuts.ts
interface CanonicalShortcut {
  input: string;
  canonicalTarget: string;
  defaultAssumption: string;
  locale: 'de' | 'en';
}

export const CANONICAL_SHORTCUTS: CanonicalShortcut[] = [
  {
    input: 'buttertoast',
    canonicalTarget: 'toast_with_butter',
    defaultAssumption: '1 Scheibe Toast (50g) mit Butter (5g)',
    locale: 'de'
  }
];
```

#### 4.2 Shortcut Resolution
```typescript
// src/features/nutrition/domain/catalog/CanonicalShortcuts.ts
export function resolveCanonicalShortcut(
  input: string, 
  locale: string
): CanonicalShortcut | null {
  return CANONICAL_SHORTCUTS.find(
    s => s.input === input.toLowerCase() && s.locale === locale
  ) || null;
}
```

#### 4.3 Integration in Resolver
```typescript
// SequentialFoodCatalogResolver.ts - vor Source-Aufruf
const shortcut = resolveCanonicalShortcut(normalizedQuery, query.locale);
if (shortcut) {
  console.log(`[${traceId}] PROOF_CANONICAL_SHORTCUT_USED input="${query.raw}" target="${shortcut.canonicalTarget}" assumption="${shortcut.defaultAssumption}"`);
  // Shortcut-spezifische Nährwerte zurückgeben
}
```

### 5. Logging & Observability

#### 5.1 BLS Source Logging
```typescript
// Neue PROOF-Events:
PROOF_BLS_SOURCE_USED: `rawInput="${query.raw}" blsMatch="${bestMatch.nameDe}" confidence=${score}`
PROOF_CANONICAL_SHORTCUT_USED: `input="${input}" target="${target}" assumption="${assumption}"`
PROOF_DACH_ROUTING_APPLIED: `locale="${locale}" inputType="${inputType}" sourceOrder="${sources.join(',')}"`
```

#### 5.2 Debug Collector Integration
```typescript
// ResolverDebugTypes.ts - BLS Source Support
source: 'off' | 'usda' | 'user' | 'bls'  // BLS hinzufügen
```

### 6. Tests

#### 6.1 BLS Source Tests
```typescript
// src/features/nutrition/__tests__/BlsGenericSource.test.ts
describe('BlsGenericSource', () => {
  it('sollte deutsche Lebensmittel finden', async () => {
    const result = await blsSource.search({
      raw: 'ei',
      normalized: 'ei',
      locale: 'de',
      inputType: 'generic'
    });
    expect(result).toHaveLength(1);
    expect(result[0].food.name).toContain('Ei');
  });
});
```

#### 6.2 Canonical Shortcuts Tests
```typescript
// src/features/nutrition/__tests__/CanonicalShortcuts.test.ts
describe('Canonical Shortcuts', () => {
  it('sollte buttertoast zu toast_with_butter mappen', () => {
    const shortcut = resolveCanonicalShortcut('buttertoast', 'de');
    expect(shortcut?.canonicalTarget).toBe('toast_with_butter');
  });
});
```

#### 6.3 DACH Routing Tests
```typescript
// InputClassificationRouting.test.ts erweitern
it('sollte BLS vor USDA für deutsche generische Inputs priorisieren', async () => {
  // Mock BLS und USDA Sources
  // Verify BLS wird vor USDA aufgerufen
});
```

### 7. Implementierungsreihenfolge

1. **BLS Data Reader** - CSV/JSON Loader + In-Memory Index
2. **BlsGenericSource** - FoodCatalogSource Implementation
3. **Source Type Extension** - 'bls' zu FoodSourceType hinzufügen
4. **Routing Integration** - BLS in DACH_GENERIC_FIRST Strategy
5. **Canonical Shortcuts** - buttertoast System
6. **Logging Integration** - PROOF Events
7. **Tests** - Unit + Integration Tests
8. **Verification** - npm run verify

## Architektur-Diagramm

```mermaid
graph TD
    A[Raw Input: "ei"] --> B[Input Classification]
    B --> C{locale=de & inputType=generic?}
    C -->|Yes| D[DACH_GENERIC_FIRST Strategy]
    C -->|No| E[Standard Strategy]
    
    D --> F[1. User Aliases]
    F --> G[2. BLS Generic Source]
    G --> H[3. OFF Source]
    H --> I[4. USDA Source]
    
    G --> J[BLS Data Reader]
    J --> K[In-Memory BLS Index]
    K --> L[German Food Names]
    
    M[Canonical Shortcuts] --> N{buttertoast?}
    N -->|Yes| O[toast_with_butter + Default Assumption]
    N -->|No| P[Normal Resolution]
    
    style G fill:#e1f5fe
    style J fill:#e8f5e8
    style M fill:#fff3e0
```

## Risiken & Mitigation

### Risiken
1. **BLS Datenqualität**: Unvollständige oder inkonsistente Nährwerte
2. **Performance**: In-Memory Loading aller BLS Daten
3. **Matching-Qualität**: Deutsche Fuzzy-Suche Herausforderungen
4. **Maintenance**: BLS Updates erfordern Daten-Refresh

### Mitigation
1. **Datenvalidierung**: Plausibility Checks wie bei ScoreCalculator
2. **Lazy Loading**: Nur häufige Lebensmittel in Memory, Rest on-demand
3. **Normalisierung**: Umlaut-Handling, Plural-Forms wie in CanonicalFood
4. **Versionierung**: BLS Data Version Tracking

## Nächste Schritte

1. **User Feedback** zu diesem Plan einholen
2. **BLS Excel → CSV Konvertierung** abschließen
3. **MVP Implementation** starten mit Top 50 BLS Lebensmitteln
4. **Integration Testing** mit bestehenden Resolver Tests
5. **Performance Benchmarking** gegen aktuelle USDA/OFF Performance

## Constraints Erfüllung

✅ **Keine neuen Dependencies** - Nur TypeScript/Node.js  
✅ **Keine allgemeine Split-Engine** - Nur explizite Canonical Shortcuts  
✅ **Minimaler MVP** - Read-only BLS Access, Top Foods only  
✅ **Architektur erweitern** - Bestehende FoodCatalogSource Interface  
✅ **Whole-food-first** - Keine automatischen Compound Splits  
✅ **DACH Data Strategy** - BLS für locale=de + generic inputs  