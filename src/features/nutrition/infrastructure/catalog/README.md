# Food Catalog - Supabase Edge Provider Integration

## Übersicht

Die Supabase Edge Provider (OFF + USDA) sind sauber in die Multi-Source FoodCatalog-Architektur integriert.

## Architektur

```
SupabaseClient (App-Level)
    ↓
SupabaseEdgeOffProvider / SupabaseEdgeUsdaProvider
    ↓
SupabaseEdgeOffSource / SupabaseEdgeUsdaSource
    ↓
SequentialFoodCatalogResolver
    ↓
Use Cases
```

## Dependency Injection Beispiel

```typescript
import { supabase } from '../../../infrastructure/supabase/supabaseClient';
import {
  SupabaseEdgeOffProvider,
  SupabaseEdgeUsdaProvider,
  SupabaseEdgeOffSource,
  SupabaseEdgeUsdaSource,
} from './infrastructure';
import { SequentialFoodCatalogResolver, DefaultConfidenceEngine } from './application';

// 1. Bestehenden App-weiten Supabase Client wiederverwenden (einzige Quelle der Wahrheit,
//    siehe P2-002) statt einen weiteren `createClient`-Aufruf zu machen.

// 2. Provider instanziieren
const offProvider = new SupabaseEdgeOffProvider(supabase);
const usdaProvider = new SupabaseEdgeUsdaProvider(supabase);

// 3. Sources erstellen
const offSource = new SupabaseEdgeOffSource(offProvider);
const usdaSource = new SupabaseEdgeUsdaSource(usdaProvider);

// Optional: User Alias Source
const userAliasSource = new UserAliasSource(aliasRepository);

// 4. Sequential Resolver verdrahten
const confidenceEngine = new DefaultConfidenceEngine();
const resolver = new SequentialFoodCatalogResolver(
  [
    userAliasSource, // 1. Höchste Priorität
    offSource, // 2. Branded products
    usdaSource, // 3. Generic foods (nur wenn OFF leer/niedrig)
    // aiSource,       // 4. AI Fallback (optional)
  ],
  confidenceEngine,
);

// 5. In Use Cases verwenden
const lookupUseCase = new LogFoodFromRawInputUseCase({
  resolver,
  // ... andere deps
});
```

## Fallback-Reihenfolge

1. **User Aliases** - Sofortiger Return ohne weitere Checks
2. **OFF (Open Food Facts)** - Branded products, Early Return bei Confidence ≥ 0.7
3. **USDA** - Generic foods, nur aufgerufen wenn:
   - OFF keine Ergebnisse liefert, oder
   - OFF-Confidence < 0.7
4. **AI** - Fallback (optional)

## Error Handling

Alle Provider werfen `FoodCatalogError` mit kategorisiertem `kind`:

```typescript
try {
  const result = await resolver.resolve(query);
} catch (error) {
  if (error instanceof FoodCatalogError) {
    switch (error.kind) {
      case 'network':
        // Handle network error
        break;
      case 'edge':
        // Handle edge function error
        break;
      case 'invalid_payload':
        // Handle invalid response
        break;
      case 'rate_limit':
        // Handle rate limiting
        break;
    }
  }
}
```

## Observability

Die Sources loggen automatisch in Development-Mode:

```typescript
console.debug('[SupabaseEdgeOffSource]', {
  sourceName: 'off',
  resultCount: 3,
  latencyMs: 142,
  query: 'apfel',
});
```

## Testing

Alle Komponenten sind vollständig testbar:

- `SupabaseEdgeOffProvider.test.ts` - Provider Unit Tests
- `SupabaseEdgeUsdaProvider.test.ts` - Provider Unit Tests
- `SequentialFoodCatalogResolver.test.ts` - Integration Tests

Mock den Supabase Client für Tests:

```typescript
const mockSupabase = {
  functions: {
    invoke: jest.fn().mockResolvedValue({
      data: { items: [...] },
      error: null
    })
  }
}

const provider = new SupabaseEdgeOffProvider(mockSupabase)
```

## Keine globalen Singletons

⚠️ **Wichtig**: Es gibt KEINE globalen Supabase-Instanzen!

- Supabase Client wird auf App-Level erzeugt
- Via Constructor an Provider übergeben
- Testbar durch Dependency Injection
- Kein versteckter globaler State
