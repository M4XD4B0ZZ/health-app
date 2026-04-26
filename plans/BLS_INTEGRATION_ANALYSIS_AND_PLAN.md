# BLS Integration - Bestandsaufnahme und MVP-Plan

## 1. Bestandsaufnahme

### Was existiert wirklich:

**✅ Vorhandene BLS-Integration:**

- `BlsStaticSource` - funktionsfähige BLS-Quelle
- `blsGenericFoods.ts` - 4 hardcodierte BLS-Einträge + 1 Shortcut
- Vollständige Resolver-Integration in `SequentialFoodCatalogResolver`
- BLS wird bereits als PRIMARY Quelle für `locale=de` + `inputType=generic` priorisiert
- Logging und Tracing bereits implementiert

**✅ Vorhandene BLS-Daten:**

```typescript
BLS_GENERIC_FOODS: [
  'magerquark' -> 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.'
  'frischkaese' -> 'Frischkaesezubereitung Natur < 10 % Fett i. Tr.'
  'ruehrei' -> 'Ruehrei gebraten'
  'toast' -> 'Weizentoastbrot/Buttertoastbrot'
]

BLS_CANONICAL_SHORTCUTS: [
  'buttertoast' -> Shortcut mit Butter-Annahme
]
```

**✅ Resolver-Architektur:**

- BLS ist bereits als `type: 'bls'` in `FoodSourceType` definiert
- Source-Priorität: `['user', 'bls', 'off', 'usda', 'ai']` für DACH_GENERIC_FIRST
- Early Return für BLS bei `score >= 0.75` für `locale=de` + `inputType=generic`
- Circuit Breaker, Timeouts, Caching bereits implementiert

**✅ Originale BLS-Datenbank:**

- `BLS_4_0_Daten_2025_DE.xlsx` - vollständige BLS-Datenbank
- `BLS_4_0_Components_DE_EN.xlsx` - Nährstoff-Definitionen
- `BLS_4_0_Dokumentation_DE.pdf` - Dokumentation

### Was existiert NICHT:

**❌ Fehlende Komponenten:**

- Keine konvertierte CSV/JSON-Version der vollständigen BLS-Datenbank
- `BLS_4_0_2025_DE_CSV/` Ordner ist leer
- Kein automatischer Excel-Import in der Runtime
- Nur 4 hardcodierte Beispiel-Einträge statt vollständiger Datenbank

**❌ Matching-Probleme:**

- Aktuelles Matching: nur `exact` und `includes`
- Kein Token-based Matching für "magerquark" -> "Speisequark Magerstufe"
- Keine Behandlung von BLS-Namensmustern (Slash-Varianten, Zubereitungsarten)

## 2. MVP-Entscheidung

**✅ Architekturentscheidung: BlsStaticSource erweitern (NICHT neue Source)**

**Begründung:**

- BLS-Integration ist bereits vollständig funktional
- Resolver-Priorität und Early Return bereits korrekt implementiert
- Nur das Matching und die Datenbasis müssen verbessert werden
- Keine Architektur-Änderungen nötig

## 3. Sofortige Verbesserungen (MVP)

### 3.1 Token-based Matching implementieren

**Problem:**

- "magerquark" findet "Speisequark Magerstufe" nicht
- "buttertoast" findet "Weizentoastbrot/Buttertoastbrot" nicht

**Lösung:**

```typescript
// Erweiterte Matching-Strategie in blsGenericFoods.ts
function tokenBasedMatch(input: string, record: BlsFoodRecord): number {
  const inputTokens = tokenize(input);
  const recordTokens = tokenize(record.displayName + ' ' + record.aliases.join(' '));

  // Token overlap scoring
  // Slash-Varianten als OR behandeln
  // Zubereitungsarten low-weight
}
```

### 3.2 BLS-Datenstruktur erweitern

**Aktuelle Einträge erweitern:**

```typescript
const BLS_GENERIC_FOODS = [
  {
    id: 'bls-magerquark',
    displayName: 'Speisequark Magerstufe, Magerquark < 10 % Fett i. Tr.',
    aliases: ['magerquark', 'quark', 'speisequark', 'magerstufe'],
    tokens: ['mager', 'quark', 'speise', 'magerstufe'], // für besseres Matching
    // ...
  },
];
```

### 3.3 PROOF_BLS_MATCH Logging

**Bereits vorhanden:**

- `PROOF_BLS_SOURCE_USED` in SequentialFoodCatalogResolver
- `PROOF_CANONICAL_SHORTCUT_USED` in BlsStaticSource

**Erweitern um:**

```typescript
console.log(
  `PROOF_BLS_MATCH input="${input}" candidates_count=${results.length} best_match="${best.name}" score=${best.score}`,
);
```

## 4. Dateien die JETZT angepasst werden

### 4.1 Sofort ändern:

- `src/features/nutrition/infrastructure/catalog/sources/blsGenericFoods.ts`
  - Token-based Matching implementieren
  - Mehr BLS-Einträge hinzufügen (manuell kuratiert)
  - Bessere Alias-Listen

### 4.2 Tests erweitern:

- `src/features/nutrition/__tests__/BlsStaticSource.test.ts`
  - Tests für "magerquark", "rührei", "buttertoast"
  - Token-based Matching Tests

## 5. Arbeiten die bewusst verschoben werden

### 5.1 Vollständige BLS-Datenbank (später):

- Excel -> JSON Konvertierung (offline)
- Automatischer Import-Prozess
- Vollständige 1000+ BLS-Einträge

### 5.2 Erweiterte Features (später):

- Fuzzy String Matching
- Machine Learning Scoring
- Dynamische Alias-Generierung

## 6. Nächste Schritte

1. **Sofort:** Token-based Matching in `blsGenericFoods.ts` implementieren
2. **Sofort:** Mehr kuratierte BLS-Einträge hinzufügen (10-20 wichtige)
3. **Sofort:** Tests für die 3 Ziel-Inputs erstellen
4. **Später:** Offline Excel-Import definieren
5. **Später:** Vollständige BLS-Datenbank integrieren

## 7. Erfolgs-Kriterien

**MVP erfolgreich wenn:**

- "magerquark" findet BLS-Eintrag
- "rührei" findet BLS-Eintrag
- "buttertoast" findet BLS-Eintrag
- `PROOF_BLS_MATCH` Logging funktioniert
- Tests bestehen

**Architektur bleibt sauber:**

- Keine Excel-Verarbeitung in Runtime
- Deterministic-first beibehalten
- Bestehende Resolver-Logik unverändert
