# Zera — Food Resolution Benchmark Specification (RESOLVER-V3-001)

Status: `accepted` — verbindliche Benchmark-Spezifikation für den Resolver-V3-Variantenvergleich
Ebene: Domänen-/Benchmark-Design-Dokument (unterhalb `SSOK.md`/`AGENTS.md`, operationalisiert
[`ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md`](ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md) §7 für
die Epic "Resolver V3 – AI-First Interpretation & Source-Grounded Retrieval (Benchmark-Gated)"
in `ROADMAP.md`)
Voraussetzung: `SSOK.md`, `AGENTS.md`, `ROADMAP.md` (Resolver-V3-Epic), `VERIFY.md`,
`ZERA_FOOD_RESOLUTION_DECISION_RECORD_1.md` (verbindliche strategische Grundlage — dieses
Dokument dupliziert dessen Inhalt **nicht**, sondern konkretisiert §7 zu einer vollständigen
Spezifikation), [`AiInterpretationTypes.ts`](../../src/features/nutrition/domain/models/AiInterpretationTypes.ts)
/ [`AiInterpretationProvider.ts`](../../src/features/nutrition/application/ports/AiInterpretationProvider.ts)
(RESOLVER-V3-002, `done` — Vokabular-Quelle für Locale/Source-Typen/Quantity-Modell)

> **Task-Scope (RESOLVER-V3-001):** Dieses Dokument definiert Korpus-Taxonomie, Fall-Schema,
> Ground-Truth-Hierarchie, Metriken, Fehlerklassen, Variantenvergleichs-Protokoll, Leakage-/
> Versionierungs-/Datenschutzregeln und vorläufige Entscheidungsgates — vollständig genug, damit
> RESOLVER-V3-003/004/005/006 implementiert werden können, ohne eigene Grundsatzentscheidungen zu
> erfinden. Es enthält **keinen Benchmark-Harness, keine ausführbaren Fixture-Dateien, keinen
> echten AI-Provider, keine Provider-Auswahl und keine Änderung am produktiven Resolver.**
> Illustrative Beispiel-Fälle in diesem Dokument sind Schema-Illustrationen, keine committeten
> Fixtures — die tatsächliche Korpus-Fixture-Datei ist Aufgabe von RESOLVER-V3-003.

## Inhaltsverzeichnis

1. [Zweck und Hypothesen](#1-zweck-und-hypothesen)
2. [Benchmark-Fall-Schema](#2-benchmark-fall-schema)
3. [Korpus-Taxonomie](#3-korpus-taxonomie)
4. [Umfang und Verteilung](#4-umfang-und-verteilung)
5. [Ground-Truth-Hierarchie](#5-ground-truth-hierarchie)
6. [Metriken](#6-metriken)
7. [Fehlerklassen und Gewichtung](#7-fehlerklassen-und-gewichtung)
8. [Fairer Variantenvergleich](#8-fairer-variantenvergleich)
9. [Leakage, Versionierung und Reproduzierbarkeit](#9-leakage-versionierung-und-reproduzierbarkeit)
10. [Datenschutzgrenze](#10-datenschutzgrenze)
11. [Akzeptanz- und Entscheidungsgates](#11-akzeptanz--und-entscheidungsgates)
12. [Abgleich mit bestehendem Repository](#12-abgleich-mit-bestehendem-repository)
13. [Offene Entscheidungen](#13-offene-entscheidungen)
14. [Anschlussaufgaben](#14-anschlussaufgaben)

---

## 1. Zweck und Hypothesen

Zweck: reproduzierbarer, fairer Vergleich der drei in der Decision Record §7 definierten
Varianten (A = bestehender Zera-Resolver, B = direkte AI-Schätzung als Kontrollgruppe, C =
AI-first source-grounded Hybrid), bevor irgendein produktiver Umbau autorisiert wird
(`ROADMAP.md`s Resolver-V3-Epic, "benchmark-gated").

Die folgenden Hypothesen sind **überprüfbar formuliert, nicht als Ergebnis vorausgesetzt**. Kein
Task vor RESOLVER-V3-006 darf eine dieser Hypothesen als bereits bewiesen behandeln.

| ID  | Hypothese                                                                                                                                                                          | Falsifizierbar durch                                                                                         |
| --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| H1  | Variante C hat eine niedrigere False-confident-Rate (sichere, aber falsche Auflösung) als Variante B.                                                                              | Gleiche oder höhere False-confident-Rate von C gegenüber B im Vergleichsbericht.                             |
| H2  | Variante C verbessert komponentenweise Precision/Recall bei zusammengesetzten/DACH-regionalen Eingaben gegenüber Variante A.                                                       | Keine oder negative Differenz in den §6-Komponentenmetriken für die Kategorien `COMPOSED`/`DACH`/`HOMEMADE`. |
| H3  | Variante A bleibt bei Fast-Path-Eingaben (validierter Alias-Treffer, BLS-DACH-Wahrheit) schneller und günstiger als jede AI-Variante.                                              | p50/p95-Latenz oder Kosten von B/C unterhalb von A auf denselben Fast-Path-Fällen.                           |
| H4  | Eine gezielte Rückfrage bei unvollständigen/vagen Eingaben erzeugt eine niedrigere False-confident-Rate als eine scheinpräzise Schätzung — sowohl bei B als auch bei C.            | Höhere False-confident-Rate bei Varianten, die auf `VAGUE`/`UNRELIABLE`-Fällen dennoch direkt auflösen.      |
| H5  | Persistente Wiederverwendung (RESOLVER-V3-008, nicht Teil des A/B/C-Vergleichs selbst) senkt Kosten pro validiertem Log und erhöht Wiederholungskonsistenz gegenüber Kaltstart-AI. | Keine Kostensenkung/Konsistenzverbesserung im späteren V3-007/V3-008-Vergleich Kaltstart vs. Cache-Treffer.  |

H5 ist bewusst als **Anschlusshypothese** markiert: der Cache existiert erst ab RESOLVER-V3-008
und ist nicht Teil des RESOLVER-V3-006-Dreiervergleichs, wird hier aber bereits benannt, damit
RESOLVER-V3-007/008 dieselbe Metrik-Definition (§6 „Performance und Kosten") wiederverwenden statt
neu zu erfinden.

Explizit **nicht** formuliert: keine Hypothese mit fest codiertem Zielwert („C ist X % besser").
Zahlenwerte, die später als Schwelle dienen, gehören in §11 als **vorläufige, überprüfbare
Gates** — nicht in eine Hypothese, die sonst zirkulär gegen die eigene Definition „bewiesen" wäre.

---

## 2. Benchmark-Fall-Schema

Ein Benchmark-Fall ist eine versionierbare, unveränderliche Einheit. Das Schema unten ist die
verbindliche Struktur für die tatsächliche Fixture-Datei, die RESOLVER-V3-003 anlegt (Format dort
frei wählbar — JSON/YAML/TS-Modul —, Feldnamen und Semantik sind hier bereits verbindlich
festgelegt, damit spätere Harness-Implementierungen nicht erneut über die Bedeutung jedes Feldes
entscheiden müssen).

Locale-Vokabular (`'de' | 'en'`) und Source-Typ-Vokabular (`FoodSourceType = 'user' | 'off' |
'bls' | 'usda' | 'ai'`) werden **direkt aus dem bestehenden Code wiederverwendet**
([`FoodCatalogSource.ts`](../../src/features/nutrition/domain/catalog/FoodCatalogSource.ts),
[`AiInterpretationTypes.ts`](../../src/features/nutrition/domain/models/AiInterpretationTypes.ts))
statt neu erfunden zu werden.

### 2.1 Pflicht- und Optionalfelder

| Feld                        | Typ                                                                                                                                            | Pflicht                                                                          | Bedeutung                                                                                                                             |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| `caseId`                    | `string` (stabil, z. B. `RV3-0001`)                                                                                                            | ja                                                                               | Unveränderlich über alle Korpusversionen hinweg. Wird nie wiederverwendet oder umnummeriert (mirrors `AGENTS.md`s Task-ID-Regel).     |
| `corpusVersion`             | `string` (SemVer, z. B. `1.0.0`)                                                                                                               | ja                                                                               | Version des Korpus, in dem dieser Fall zuletzt geändert wurde (§9).                                                                   |
| `category`                  | Enum, siehe §3                                                                                                                                 | ja                                                                               | Primäre Taxonomie-Kategorie.                                                                                                          |
| `subcategory`               | `string`                                                                                                                                       | optional                                                                         | Feingranulare Einordnung, z. B. DACH-Gerichtname, Restaurant-Subtyp.                                                                  |
| `difficulty`                | `'easy' \| 'medium' \| 'hard' \| 'adversarial'`                                                                                                | ja                                                                               | Grobe Schwierigkeitseinstufung, siehe §4.                                                                                             |
| `rawInput`                  | `string`                                                                                                                                       | ja                                                                               | Wörtliche Nutzereingabe, wie sie ein AI-/Resolver-System erhält.                                                                      |
| `locale`                    | `'de' \| 'en'`                                                                                                                                 | ja                                                                               | Reuse von `FoodSearchQuery.locale`/`AiInterpretationRequest.locale`.                                                                  |
| `regionalContext`           | `string` (z. B. `'DE'`, `'AT'`, `'CH'`, `'unspecified'`)                                                                                       | optional                                                                         | Feinere regionale Einordnung als `locale` erlaubt; siehe §13 (offene Frage, ob dies später ein eigenes typisiertes Feld braucht).     |
| `expectedComponents`        | `ExpectedComponent[]` (siehe 2.2)                                                                                                              | ja, außer bei `expectedBehavior = abstention_expected` ohne bekannte Komponenten | Erwartete Lebensmittelbestandteile.                                                                                                   |
| `groundTruthSource`         | Enum, siehe §5                                                                                                                                 | ja                                                                               | Hierarchie-Ebene der Ground Truth.                                                                                                    |
| `groundTruthProvenance`     | `string`                                                                                                                                       | ja, außer bei Stufe 7 (keine Ground Truth)                                       | Konkrete Quellenangabe: BLS-`sourceId`, Etikett-/Produktreferenz, Restaurant-Dokument-URL/Name, Rezeptquelle, kuratierte Begründung.  |
| `referenceNutrients`        | `ReferenceNutrients \| null`                                                                                                                   | ja                                                                               | Siehe 2.3. `null` nur zulässig, wenn `groundTruthSource` Stufe 7 ist — niemals ein impliziter Nullwert für „nicht verfügbar".         |
| `tolerances`                | `ToleranceOverride`                                                                                                                            | optional                                                                         | Fallspezifische Abweichung vom Default-Toleranzband (§6.4); muss begründet sein, wenn gesetzt.                                        |
| `expectedBehavior`          | `'direct_resolution' \| 'resolution_with_assumption' \| 'clarification_required' \| 'multiple_candidates_acceptable' \| 'abstention_expected'` | ja                                                                               | Erwartetes Systemverhalten, unabhängig vom numerischen Ergebnis.                                                                      |
| `expectedClarificationKind` | `ClarificationKind` (reuse aus `AiInterpretationTypes.ts`)                                                                                     | ja, wenn `expectedBehavior = clarification_required`                             | Welche Art von Rückfrage korrekt wäre.                                                                                                |
| `criticalFailureConditions` | `string[]`                                                                                                                                     | ja                                                                               | Explizite Liste, was für diesen Fall ein kritischer Fehler wäre (§7) — z. B. „darf nicht ungefragt auf eine Speck-Variante fixieren". |
| `reproducibilityNotes`      | `string`                                                                                                                                       | ja                                                                               | Snapshot-/Versionsangabe der externen Quelle (BLS-Version, Abrufdatum bei OFF/USDA, Rezeptdatum).                                     |
| `personalDataFree`          | `boolean`                                                                                                                                      | ja, muss `true` sein                                                             | Erzwungene Selbstauskunft — jeder Fall muss synthetisch/kuratiert sein (§10).                                                         |
| `tags`                      | `string[]`                                                                                                                                     | optional                                                                         | Freitext-Filter, z. B. `['bls-precedent', 'resolver-v2-008']`.                                                                        |
| `notes`                     | `string`                                                                                                                                       | optional                                                                         | Freitext, z. B. Herkunft/Motivation des Falls.                                                                                        |

### 2.2 `ExpectedComponent`

Mirrors `InterpretedFoodComponent` (RESOLVER-V3-002), aber als Ground-Truth-Gegenstück, nicht als
System-Ausgabe:

| Feld                   | Typ                                                                                         | Bedeutung                                                                                                                                                                         |
| ---------------------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `componentId`          | `string`                                                                                    | Stabil innerhalb des Falls.                                                                                                                                                       |
| `expectedName`         | `string`                                                                                    | Kanonische Lebensmittelbezeichnung (nicht notwendig identisch mit dem Rohtext).                                                                                                   |
| `expectedBrand`        | `string`                                                                                    | Optional, nur bei Markenprodukten.                                                                                                                                                |
| `expectedPreparation`  | `string`                                                                                    | Optional, z. B. „gekocht", „gebraten".                                                                                                                                            |
| `expectedQuantity`     | `{ value?: number; unit?: 'g' \| 'ml' \| 'piece' \| 'portion'; householdMeasure?: string }` | Reuse von `InterpretedQuantity`'s Einheiten-Vokabular.                                                                                                                            |
| `required`             | `boolean`                                                                                   | `true` = fehlende Erkennung zählt als FN (§6.2); `false` = optionale/unsichere Komponente (z. B. „Soße" bei einer vage beschriebenen Mahlzeit), deren Fehlen nicht bestraft wird. |
| `canonicalEquivalents` | `string[]`                                                                                  | Optional. Alternative akzeptierte kanonische Identitäten (§6.1 „kanonische Äquivalenz"), z. B. verschiedene, fachlich austauschbare BLS-Einträge.                                 |

### 2.3 `ReferenceNutrients`

```
{
  kcal: number | null,
  protein_g: number | null,
  fat_g: number | null,
  carbs_g: number | null,
  fiber_g?: number | null,
  sugar_g?: number | null,
  salt_g?: number | null,
  // weitere Nährstoffe optional, je nach Verfügbarkeit der Ground-Truth-Quelle (§6.5)
}
```

`null` bedeutet ausdrücklich **„von dieser Quelle nicht bereitgestellt"**, nicht „null Gramm/kcal".
Ein Fall darf nicht `0` für einen von der Quelle nicht gelieferten Wert eintragen (§5 Grundsatz
„Fehlender Wert ist nicht Null").

### 2.4 Illustrative Beispiel-Fälle

Die folgenden vier Fälle sind **Schema-Illustrationen**, keine committeten Fixtures. Sie zeigen,
wie unterschiedliche Kategorien/Ground-Truth-Ebenen das Schema befüllen — inklusive des von
`ROADMAP.md`s DoD verlangten mindestens einen DACH-Regionalgericht-Falls.

<details>
<summary>Beispiel 1 — <code>SIMPLE</code>, Stufe-3-Ground-Truth (BLS)</summary>

```json
{
  "caseId": "RV3-0001",
  "corpusVersion": "1.0.0",
  "category": "SIMPLE",
  "difficulty": "easy",
  "rawInput": "200 g Quark",
  "locale": "de",
  "expectedComponents": [
    {
      "componentId": "c1",
      "expectedName": "Quark",
      "expectedQuantity": { "value": 200, "unit": "g" },
      "required": true
    }
  ],
  "groundTruthSource": "bls_generic",
  "groundTruthProvenance": "BLS 4.0, sourceId <TBD bei Fixture-Erstellung>",
  "referenceNutrients": { "kcal": null, "protein_g": null, "fat_g": null, "carbs_g": null },
  "expectedBehavior": "direct_resolution",
  "criticalFailureConditions": [
    "Auflösung auf ein verarbeitetes Quark-Dessert statt des generischen Speisequarks"
  ],
  "reproducibilityNotes": "BLS 4.0 2025 DE, committeter Artefakt-Snapshot",
  "personalDataFree": true,
  "tags": ["bls-generic"]
}
```

Numerische `referenceNutrients` sind hier bewusst als Platzhalter (`null`) markiert — die
konkreten BLS-Werte werden erst beim tatsächlichen Fixture-Bau (RESOLVER-V3-003) aus dem
committeten Artefakt gezogen, nicht in dieser Spezifikation erfunden.

</details>

<details>
<summary>Beispiel 2 — <code>DACH</code>, Stufe-4-Ground-Truth (dokumentiertes Rezept)</summary>

```json
{
  "caseId": "RV3-0042",
  "corpusVersion": "1.0.0",
  "category": "DACH",
  "subcategory": "Zwiebelrostbraten mit Spätzle",
  "difficulty": "hard",
  "rawInput": "Zwiebelrostbraten mit Spätzle und Soße",
  "locale": "de",
  "regionalContext": "DE",
  "expectedComponents": [
    {
      "componentId": "c1",
      "expectedName": "Rostbraten (Rindfleisch, gebraten)",
      "expectedQuantity": { "portionDescription": "TBD: recherchierte Standardportion" },
      "required": true
    },
    {
      "componentId": "c2",
      "expectedName": "Röstzwiebeln",
      "expectedQuantity": { "portionDescription": "TBD" },
      "required": true
    },
    {
      "componentId": "c3",
      "expectedName": "Spätzle",
      "expectedQuantity": { "portionDescription": "TBD" },
      "required": true
    },
    {
      "componentId": "c4",
      "expectedName": "Bratensoße",
      "expectedQuantity": { "portionDescription": "TBD" },
      "required": false
    }
  ],
  "groundTruthSource": "documented_recipe",
  "groundTruthProvenance": "TBD bei Fixture-Erstellung: dokumentiertes Rezept + BLS-Zutatenzuordnung je Komponente, KEINE Übernahme des Amy-Nutzerberichtswerts",
  "referenceNutrients": { "kcal": null, "protein_g": null, "fat_g": null, "carbs_g": null },
  "expectedBehavior": "resolution_with_assumption",
  "criticalFailureConditions": [
    "kcal-Wert, der ohne dokumentierte Zutaten-/Mengenherleitung als 'sicher' präsentiert wird",
    "Regionalfehlzuordnung (z. B. Verwechslung mit einem nicht-deutschen Gericht gleichen Namens)"
  ],
  "reproducibilityNotes": "Rezeptquelle + Abrufdatum bei Fixture-Erstellung zu dokumentieren",
  "personalDataFree": true,
  "tags": ["dach-regional", "amy-motivated", "resolver-decision-record-2.1"]
}
```

Dieser Fall ist **durch** den in der Decision Record §2.1 dokumentierten Amy-Nutzerbericht
(„Zwiebelrostbraten" ~60 % Überschätzung) **motiviert**, übernimmt aber **keinen** Amy-Zahlenwert
als Ground Truth — die tatsächliche Referenz muss beim Fixture-Bau unabhängig über ein
dokumentiertes Rezept + BLS-Zutatenzuordnung hergeleitet werden (§5, Stufe 4). Alle `TBD`-Platzhalter
sind bewusst nicht ausgefüllt, um keine unbelegte Zahl in eine „verbindliche Spezifikation" zu
schreiben.

</details>

<details>
<summary>Beispiel 3 — <code>COMPOSED</code>, mehrteilige Mahlzeit (deckt sich mit dem RESOLVER-V3-002-Testfall)</summary>

```json
{
  "caseId": "RV3-0080",
  "corpusVersion": "1.0.0",
  "category": "COMPOSED",
  "difficulty": "medium",
  "rawInput": "Zwei Scheiben Toast mit Butter und Gouda",
  "locale": "de",
  "expectedComponents": [
    {
      "componentId": "c1",
      "expectedName": "Toast",
      "expectedQuantity": { "value": 2, "unit": "piece", "householdMeasure": "2 Scheiben" },
      "required": true
    },
    {
      "componentId": "c2",
      "expectedName": "Butter",
      "expectedQuantity": { "portionDescription": "ungenannte Menge" },
      "required": true
    },
    {
      "componentId": "c3",
      "expectedName": "Gouda",
      "expectedQuantity": { "portionDescription": "ungenannte Menge" },
      "required": true
    }
  ],
  "groundTruthSource": "documented_recipe",
  "groundTruthProvenance": "BLS-Zutaten je Komponente + kuratierte Standardmengen für 'ungenannte Menge' (Butter/Gouda-Aufstrich), TBD bei Fixture-Erstellung",
  "referenceNutrients": { "kcal": null, "protein_g": null, "fat_g": null, "carbs_g": null },
  "expectedBehavior": "resolution_with_assumption",
  "criticalFailureConditions": [
    "fehlende Komponente (z. B. Butter oder Gouda nicht erkannt)",
    "halluzinierte zusätzliche Komponente"
  ],
  "reproducibilityNotes": "Standardmengenannahmen sind bei Fixture-Erstellung explizit zu dokumentieren",
  "personalDataFree": true,
  "tags": ["composed-meal", "resolver-v3-002-precedent"]
}
```

Bewusst identisch mit dem in
[`AiInterpretationProvider.test.ts`](../../src/features/nutrition/__tests__/AiInterpretationProvider.test.ts)
bereits verwendeten Beispiel — direkte Nachverfolgbarkeit zwischen Interpretationscontract-Test und
Benchmark-Korpus, keine neu erfundene Beispieleingabe.

</details>

<details>
<summary>Beispiel 4 — <code>VAGUE</code>, keine numerische Ground Truth (Stufe 7)</summary>

```json
{
  "caseId": "RV3-0120",
  "corpusVersion": "1.0.0",
  "category": "VAGUE",
  "difficulty": "hard",
  "rawInput": "eine normale Portion Nudeln",
  "locale": "de",
  "expectedComponents": [],
  "groundTruthSource": "no_numeric_ground_truth",
  "referenceNutrients": null,
  "expectedBehavior": "clarification_required",
  "expectedClarificationKind": "missing_quantity",
  "criticalFailureConditions": [
    "scheinpräziser kcal-Wert ohne Rückfrage oder ohne sichtbare Unsicherheit",
    "Abstention ohne jede Rückfrage, obwohl eine gezielte Mengenrückfrage möglich wäre"
  ],
  "reproducibilityNotes": "kein externer Quellenbezug nötig — Fall testet Unsicherheitsverhalten, nicht Nährwertgenauigkeit",
  "personalDataFree": true,
  "tags": ["vague-input", "no-ground-truth"]
}
```

</details>

---

## 3. Korpus-Taxonomie

| Kategorie-Code      | Name                                         | Beispiele                                                                                  | Typisches erwartetes Verhalten                                                                   | Typische Ground-Truth-Ebene (§5)                           |
| ------------------- | -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `SIMPLE`            | Einfache generische Lebensmittel             | `200 g Quark`, `zwei Eier`, `100 g Haferflocken`                                           | `direct_resolution`                                                                              | 3 (BLS)                                                    |
| `HOUSEHOLD`         | Haushaltsmaße und Stückeinheiten             | `eine Scheibe Brot`, `ein Becher Skyr`, `eine Handvoll Nüsse`                              | `direct_resolution` oder `resolution_with_assumption`                                            | 3 oder 6 (kuratierter Referenzbereich für „Handvoll" etc.) |
| `DACH`              | DACH-spezifische/regionale Lebensmittel      | Magerquark, Schmand, Brötchen, Leberkäse, Zwiebelrostbraten, regional mehrdeutige Begriffe | `direct_resolution`, `resolution_with_assumption`, oder `clarification_required` (z. B. „Speck") | 3 (generisch) oder 4 (Regionalgericht)                     |
| `BRANDED`           | Markenprodukte                               | eindeutige Marke + Produktvariante + Portionsgröße                                         | `direct_resolution`                                                                              | 1 (Hersteller/offizielle Produktdaten)                     |
| `COMPOSED`          | Zusammengesetzte Mahlzeiten                  | `Zwei Scheiben Toast mit Butter und Gouda`                                                 | `resolution_with_assumption`                                                                     | 4 (Rezept-/Komponentenzerlegung)                           |
| `HOMEMADE`          | Selbstgekochte Gerichte                      | dokumentiertes Rezept mit Mengen                                                           | `direct_resolution` oder `resolution_with_assumption`                                            | 4                                                          |
| `RESTAURANT`        | Restaurantgerichte (3 Subtypen, siehe unten) | Kettenrestaurant mit offiziellen Angaben; ohne offizielle Angaben; regional/unabhängig     | variiert je Subtyp                                                                               | 2, 4, oder 6                                               |
| `VAGUE`             | Vage Eingaben                                | `etwas Müsli`, `eine normale Portion Nudeln`, `Mittagessen`, `ein bisschen Butter`         | `clarification_required` oder `abstention_expected`                                              | 7 (keine numerische Ground Truth)                          |
| `PREPARATION`       | Zubereitungsabhängige Fälle                  | roh/gekocht, gebraten/gekocht, mit/ohne Öl, abgetropft/nicht abgetropft                    | `direct_resolution` (wenn Zubereitung explizit) oder `clarification_required` (wenn fehlend)     | 3 oder 6                                                   |
| `NEGATION_MODIFIER` | Negationen und Modifikatoren                 | `ohne Käse`, `wenig Soße`, `doppelte Portion`, `ungesüßt`, `fettarm`                       | `direct_resolution` oder `resolution_with_assumption`                                            | 3, 4, oder 6                                               |
| `UNRELIABLE`        | Nicht zuverlässig lösbare Fälle              | Fälle, in denen kein System verantwortungsvoll eine präzise Zahl bestimmen kann            | `clarification_required`, `multiple_candidates_acceptable`, oder `abstention_expected`           | 7                                                          |

**Restaurant-Subtypen** (`subcategory`): `restaurant_official_data` (Kette mit veröffentlichten
Nährwertangaben — Ground-Truth-Ebene 2), `restaurant_no_official_data` (kein veröffentlichter Wert
— Ebene 6, kuratierter Referenzbereich), `restaurant_regional_independent` (regionales/
unabhängiges Restaurant — praktisch immer Ebene 6 oder 7).

**`REPEAT_CONSISTENCY` ist kein eigenständiger Inhalts-Bucket**, sondern ein **Overlay**: eine
definierte Teilmenge bereits existierender Fälle aus allen obigen Kategorien wird zusätzlich als
Wiederholungs-/Paraphrase-Variante aufgenommen (gleicher Wortlaut erneut, leicht veränderte
Wortstellung, Singular/Plural, Zahlwort vs. Ziffer, eine zuvor validierte Eingabe wiederholt). Das
verhindert, dass Konsistenzmessung eine eigene inhaltliche Kategorie mit eigener Ground Truth
braucht — sie erbt die Ground Truth des Basisfalls (§6.6).

**Grundsatz „`UNRELIABLE` ist kein Fehlerbucket":** Ein Fall in dieser Kategorie darf vom Harness
**nicht automatisch als fehlgeschlagen gewertet werden**, wenn das System korrekt eine Rückfrage
stellt, Unsicherheit sichtbar macht, mehrere Kandidaten zeigt oder auf eine genaue Schätzung
verzichtet (§6.6, §7).

---

## 4. Umfang und Verteilung

**Zielkorridor für Korpusversion `1.0.0`** — ein begründeter Startpunkt, kein hartes Kriterium.
RESOLVER-V3-003 darf mit einer kleineren tatsächlichen Iteration 1 beginnen, sofern die
Kategorieabdeckung erhalten bleibt und die Abweichung im Korpus-Changelog (§9) dokumentiert wird.

- **Smoke-Subset:** ~25 Fälle — mindestens ein Fall pro Kategorie, gewichtet auf `SIMPLE`,
  `DACH`, `HOUSEHOLD`, `COMPOSED` (die am häufigsten erwarteten Zera-Alltagseingaben). Zweck:
  schnelle lokale Regression, nicht der Variantenvergleich selbst.
- **Vollständiges Vergleichskorpus:** Zielkorridor **150–200 Basis-Fälle** (vor dem
  `REPEAT_CONSISTENCY`-Overlay). Begründung: groß genug für belastbare Subgruppen pro Kategorie
  (mindestens ~8–12 Fälle je Hauptkategorie), klein genug, um RESOLVER-V3-003..006 nicht durch
  Korpuspflege zu blockieren — ein Amy-große Demokorpus (70 Fälle, nur einfache/homogene
  Kategorien) wäre für den hier geforderten Kategorienumfang zu klein; ein
  vierstelliges Korpus wäre für eine erste, benchmark-gated Iteration unverhältnismäßig.
- **`REPEAT_CONSISTENCY`-Overlay:** zusätzlich ~15–20 % der Basisfallzahl als
  Wiederholungs-/Paraphrase-Varianten einer Stichprobe bestehender Fälle → Gesamtkorpus grob
  **175–240 Fälle**.
- **Holdout-Subset (später, nicht in dieser Version erzeugt):** ~20 % des Korpus, eingefroren
  **nach** Code-Fertigstellung des RESOLVER-V3-005-Spikes und **vor** dem RESOLVER-V3-006-Bericht,
  um ein Overfitting der Variante-C-Prompts/Heuristiken auf den Eval-Datensatz zu verhindern (§9).

### Verteilungsbegründung (Basisfälle, Summe 100 %)

| Kategorie           | Anteil | Begründung                                                                                                                                                                                                               |
| ------------------- | -----: | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `SIMPLE`            |   12 % | Häufigster Alltagsfall, aber bereits gut durch bestehende Resolver-Tests abgedeckt (§12) — kein Übergewicht nötig.                                                                                                       |
| `HOUSEHOLD`         |    8 % | Wichtige, aber schmalere Fehlerklasse.                                                                                                                                                                                   |
| `DACH`              |   15 % | Bewusst überproportional: proaktiv dokumentierte Schwachstelle in **beiden** Systemen (Decision Record §2.1, §3 — Speck/Himbeeren/Haferflocken/Zwiebelrostbraten), zentrales Differenzierungsziel von Variante C.        |
| `BRANDED`           |   10 % | Deckt Ebene-1-Ground-Truth-Pfad ab; in der bisherigen Testsuite kaum vertreten (§12).                                                                                                                                    |
| `COMPOSED`          |   12 % | Amy-Nutzerbericht „complex meal breakdown" (Decision Record §2.1) als unabhängig bestätigte Schwachstelle — Kernhypothese H2.                                                                                            |
| `HOMEMADE`          |    8 % | Ergänzt `COMPOSED` um dokumentierte Rezept-Ground-Truth-Fälle mit klarerer Ebene-4-Herleitung.                                                                                                                           |
| `RESTAURANT`        |   10 % | Split ca. 40/30/30 über die drei Subtypen — deckt sowohl belastbare (Ebene 2) als auch bewusst unsichere (Ebene 6/7) Fälle ab.                                                                                           |
| `VAGUE`             |    8 % | Testet die Rückfrage-/Abstentions-Fähigkeit direkt (H4) — zentrale Produktprinzip-Frage („Rückfrage vs. scheinpräzise Schätzung").                                                                                       |
| `PREPARATION`       |    6 % | Bekannte Fehlerquelle (roh/gekocht-Verwechslung ändert Makros signifikant), schmaler aber wichtiger Bucket.                                                                                                              |
| `NEGATION_MODIFIER` |    6 % | Testet, ob Modifikatoren überhaupt in die Interpretation einfließen (AI-first-Kernfähigkeit).                                                                                                                            |
| `UNRELIABLE`        |    5 % | Bewusst niedrig, aber nicht null — muss vorhanden sein, um „ehrliche Abstention" von „Fehler" zu unterscheiden (§6.6, §7), darf den Korpus aber nicht dominieren, da sonst kein numerischer Vergleich mehr möglich wäre. |

**Schwierigkeitsverteilung (quer über alle Kategorien):** ~30 % `easy`, ~40 % `medium`, ~20 %
`hard`, ~10 % `adversarial` (Tippfehler, widersprüchliche Eingaben, Negationskombinationen).

**Anteil eindeutiger vs. uneindeutiger Fälle:** ~70 % mit einer einzelnen vertretbaren Ground
Truth (oder eng definiertem Referenzbereich), ~30 % bewusst ohne eindeutige numerische Ground
Truth (primär `VAGUE`/`UNRELIABLE`, aber auch Teile von `PREPARATION`/`NEGATION_MODIFIER`, wo eine
fehlende Angabe echte Mehrdeutigkeit erzeugt).

**DACH-Anteil gesamt:** `DACH` (15 %) plus DACH-geprägte Anteile aus `HOMEMADE`/
`restaurant_regional_independent` ergeben einen kombinierten DACH-Schwerpunkt von grob **25–30 %**
— konsistent mit `SSOK.md`s „DACH Data Strategy" und der Produktausrichtung.

**Anteil komplexer Mahlzeiten:** `COMPOSED` + `HOMEMADE` + `RESTAURANT` = 30 % — bewusst hoch, da
dies laut Decision Record der Bereich ist, in dem Amys eigene Nutzer die größten,
unabhängig bestätigten Schwächen berichten (§2.1) und in dem Variante C sich am ehesten von
Variante A/B differenzieren müsste (H2).

---

## 5. Ground-Truth-Hierarchie

Verbindliche Rangfolge, absteigend nach Belastbarkeit. `groundTruthSource` muss exakt einen dieser
Werte tragen:

1. **`manufacturer_label`** — Herstelleretikett oder offizielle produktspezifische Daten.
2. **`official_restaurant_data`** — offizielle Restaurant-Nährwertangabe.
3. **`bls_generic`** — BLS 4.0 für einen fachlich passenden generischen DACH-Eintrag.
4. **`documented_recipe`** — dokumentiertes Rezept mit deterministischer Zutaten-/
   Mengenberechnung (jede Zutat selbst wieder über Ebene 1–3 belegt).
5. **`other_verified_database`** — andere qualitätsgeprüfte Nährstoffdatenbank (z. B. OFF/USDA für
   Fälle ohne passenden BLS-Eintrag), mit Datenbank-ID und Abrufdatum.
6. **`curated_reference_range`** — kuratierter Referenzbereich mit dokumentierter Unsicherheit
   (z. B. „Handvoll Nüsse" = 20–30 g, begründet, nicht gewürfelt).
7. **`no_numeric_ground_truth`** — keine numerische Ground Truth; erwartetes Verhalten ist
   `clarification_required` oder `abstention_expected`.

### Verbindliche Grundsätze

- **Fehlender Wert ist nicht Null.** `referenceNutrients` trägt `null` für nicht verfügbare Werte,
  niemals `0`.
- **Keine Mittelwertbildung nicht-äquivalenter Lebensmittel.** Zwei fachlich verschiedene
  BLS-Cluster (z. B. die drei „Speck"-Cluster, Decision Record §3) dürfen nicht zu einem
  Referenzwert gemittelt werden — entweder wird die kanonische Äquivalenzklasse (§2.2
  `canonicalEquivalents`) explizit benannt, oder der Fall gehört auf Ebene 6/7.
- **Keine scheinpräzise Zahl als erfundene Ground Truth.** Wenn keine der Ebenen 1–5 zutrifft und
  Ebene 6 keine belastbare Eingrenzung erlaubt, ist Ebene 7 zu verwenden — nicht eine plausibel
  klingende Zahl ohne Herleitung.
- **Jede Ground Truth braucht Provenienz.** `groundTruthProvenance` ist Pflicht (außer Ebene 7)
  und muss so konkret sein, dass ein Dritter den Wert nachvollziehen kann (BLS-`sourceId`,
  Etikett-Referenz, Dokument-URL/Name + Datum, Rezeptquelle + Datum).
- **Zusammengesetzte Gerichte legen ihre Zutaten-/Mengenannahmen offen.** Bei Ebene 4 muss jede
  `expectedComponents`-Zeile ihre eigene Herkunft/Menge dokumentieren, nicht nur die Summe.
- **Portionsabhängige Toleranzen sind dokumentiert.** Siehe §6.4 — case-level `tolerances` müssen
  begründet sein, nicht implizit übernommen werden.
- **Amy-Ergebnisse sind niemals Ground Truth.** Amys eigener Report (`/accuracy`) darf Kategorien
  inspirieren (Decision Record §2.1/§2.3), ersetzt aber nie eine Zera-Referenz — direkt bindend
  aus dem Auftrag und der Decision Record.

---

## 6. Metriken

Alle Metriken werden **pro Variante, pro Kategorie und aggregiert** berechnet. Jede Metrik, die auf
einem numerischen Referenzwert beruht, schließt Fälle mit `referenceNutrients = null` für den
jeweiligen Nährstoff explizit aus der Aggregation aus (nicht als 0 zählen) und meldet die
Ausschlusszahl separat, damit eine hohe „% innerhalb Toleranz"-Quote nicht durch stilles
Wegfiltern schwieriger Fälle entsteht.

### 6.1 Identifikation

- **Exakte Food-/Produktidentifikation:** System-Ergebnis referenziert exakt dieselbe kanonische
  Identität wie `expectedComponents[].expectedName` (bzw. denselben BLS-`sourceId`/OFF-Barcode/
  USDA-FDC-ID, sofern das System das offenlegt).
- **Akzeptable kanonische Äquivalenz:** ein Treffer auf einen in `canonicalEquivalents` gelisteten
  Alternativwert zählt ebenfalls als korrekt (mirrors die bestehende
  `COMPATIBILITY_ALIASES_BY_SOURCE_ID`-Idee aus `BlsCompactRuntimeAdapter.ts`).
- **Top-1-Richtigkeit:** Anteil der Fälle, in denen das gewählte Ergebnis korrekt/äquivalent ist.
- **Kandidaten-Recall:** falls das System mehrere Kandidaten offenlegt (Variante A tut dies
  strukturell über `ScoreCalculator`/Fusion-Kandidaten) — ist die korrekte Identität überhaupt
  unter den Top-N-Kandidaten, auch wenn nicht gewählt.
- **Regionale Fehlzuordnung:** eigens markiertes Flag, wenn ein Ergebnis einer nicht-DACH-Variante
  eines DACH-spezifischen Lebensmittels entspricht (direkte Operationalisierung des
  Zwiebelrostbraten-/Locale-Befunds, Decision Record §2.1).

### 6.2 Komponentenzerlegung (für `COMPOSED`/`HOMEMADE`/`RESTAURANT`)

Für jeden Fall: TP = erkannte Komponente entspricht (kanonisch-äquivalent) einer
`required: true`-Erwartung; FN = eine `required: true`-Erwartung wurde nicht erkannt; FP =
erkannte Komponente entspricht keiner erwarteten Komponente (Halluzination). Fehlende/zusätzliche
`required: false`-Komponenten fließen **nicht** in FN/FP ein, werden aber separat als
„optionale Abweichung" gezählt.

```
Precision = TP / (TP + FP)
Recall    = TP / (TP + FN)
F1        = 2 * Precision * Recall / (Precision + Recall)
```

Gemeldet werden zusätzlich absolute Zahlen fehlender/halluzinierter Komponenten (nicht nur die
abgeleiteten Raten), da eine halluzinierte Markenkomponente (§7) unabhängig von ihrem Effekt auf
F1 als kritisch gilt.

### 6.3 Mengen und Einheiten

- **Korrekte Einheit:** kategorialer Abgleich (`g`/`ml`/`piece`/`portion`) gegen
  `expectedQuantity.unit`.
- **Korrekte Stückzahl:** bei `piece`-Einheiten exakter Zahlenabgleich.
- **Absolute Mengenabweichung:** `|predicted_value - expected_value|` in der erwarteten Einheit.
- **Relative Mengenabweichung:** `absolute / expected_value` — **nur berechnet, wenn
  `expected_value >= 5` (g/ml) bzw. `>= 1` (piece)**. Unterhalb dieser Schwelle wird ausschließlich
  die absolute Abweichung berichtet, da relative Fehler (MAPE-artig) bei Referenzwerten nahe null
  irreführend groß werden (explizite Vorgabe aus dem Auftrag).
- **Korrekte Behandlung unbekannter Mengen:** wenn `expectedQuantity` nur eine
  `portionDescription`/keine Zahl trägt, wird geprüft, ob das System dies als Annahme markiert
  (`resolution_with_assumption`) statt eine unbelegte Zahl als sicher zu präsentieren — dies ist
  eine Unsicherheitsmetrik (§6.6), keine Mengenmetrik im engeren Sinn.

### 6.4 Energie und Makronährstoffe

Pflicht für `kcal`, `protein_g`, `fat_g`, `carbs_g`. Pro Fall und pro Nährstoff:

- Absolute Abweichung, relative Abweichung (gleiche Nahe-Null-Ausnahme wie §6.3 — Referenzwerte
  `< 5` g bzw. `< 20` kcal werden nur absolut berichtet).
- Aggregiert über alle Fälle/eine Kategorie: Medianfehler, p90- und p95-Fehler, Anteil der Fälle
  innerhalb der Toleranzgrenze, mittlerer **vorzeichenbehafteter** Fehler (zur Erkennung
  systematischer Über-/Unterschätzung pro Variante — nicht nur der Betragsfehler).

**Default-Toleranzbänder** (case-level `tolerances` kann dies begründet überschreiben):

| Kategorie                                                         |                                                                kcal-Toleranz | Makro-Toleranz | Begründung                                                                                                                                                                                                                  |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------: | -------------: | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SIMPLE` / `BRANDED` / `restaurant_official_data`                 |                                                                        ±10 % |          ±15 % | Belastbare Ebene-1/2/3-Ground-Truth erlaubt engere Bänder.                                                                                                                                                                  |
| `HOMEMADE` / `COMPOSED` / `DACH` (Rezeptfälle)                    |                                                                        ±20 % |          ±25 % | Rezept-/Mengenunsicherheit ist real, unabhängig vom System — **unabhängig hergeleitet, nicht aus Amys `±20 %`-Homemade-Band übernommen**, auch wenn der Wert zufällig ähnlich liegt (siehe Decision Record §2.3-Vorbehalt). |
| `restaurant_no_official_data` / `restaurant_regional_independent` | kein festes Band — Bewertung gegen den kuratierten Referenzbereich (Ebene 6) |              — | Ebene-6-Ground-Truth ist selbst ein Bereich, keine Punktzahl.                                                                                                                                                               |

Diese Bänder sind ein **vorläufiger, begründeter Startpunkt** (siehe §11) — keine endgültig
bewiesene fachliche Wahrheit.

### 6.5 Weitere Nährstoffe

Zera hat eine tiefere Nährstoffbasis als Amy (Decision Record §2.4). Weitere Nährstoffe (Ballaststoffe,
Zucker, Salz, ggf. Mikronährstoffe, sofern die Quelle sie liefert) werden **separat** von der
Kern-Metrik (kcal/Protein/Fett/Kohlenhydrate) berichtet und **nie** gegen Fälle gewertet, deren
Ground-Truth-Quelle diesen Wert schlicht nicht bereitstellt (`null`-Regel aus §2.3/§5 gilt
identisch). Eine „Nährstoff-Vollständigkeits"-Kennzahl pro Variante (wie viele der von der Quelle
bereitgestellten weiteren Nährstoffe hat das System überhaupt zurückgegeben) wird getrennt
ausgewiesen, um Datentiefe von Genauigkeit zu unterscheiden.

### 6.6 Unsicherheit und Sicherheit

Die wichtigste Metrikgruppe dieses Dokuments — direkt aus dem Auftrag: _„Eine falsche sichere
Entscheidung muss stärker gewichtet werden als eine ehrliche Rückfrage."_

- **False-confident rate:** Anteil der Fälle, in denen die Variante `direct_resolution`-artiges
  Verhalten zeigt (keine Rückfrage, keine sichtbare Unsicherheit), das Ergebnis aber außerhalb der
  Toleranz liegt **oder** der Fall `expectedBehavior != direct_resolution` war. Dies ist die
  einzige Metrik, die in §11 als hartes (nicht nur vorläufiges) Gate-Kriterium behandelt wird.
- **Korrekte Rückfragenquote:** Fall erwartet `clarification_required`, System stellt eine
  passende Rückfrage (`expectedClarificationKind`-Übereinstimmung optional gewertet, grobe
  Übereinstimmung reicht für „korrekt").
- **Unnötige Rückfragen:** Fall erwartet `direct_resolution`, System fragt dennoch nach.
- **Korrekte Abstention:** Fall erwartet `abstention_expected`, System verzichtet auf eine Zahl.
- **Falsche Abstention:** Fall hatte eine belastbare Ground Truth (Ebene 1–5), System verzichtet
  dennoch vollständig.
- **Konfidenz-Kalibrierung:** nur berechnet, wenn die Variante einen numerischen Konfidenzwert
  ausgibt (Variante A: `ResolverDecision`/`ScoreCalculator.finalScore`; B/C: `InterpretedFoodComponent.confidence`
  aus `AiInterpretationTypes.ts`). Reliability-Diagramm-artige Bucket-Analyse (Konfidenz-Bucket vs.
  tatsächliche Trefferquote). **Die Normalisierungsmethode über unterschiedliche Konfidenz-Skalen
  hinweg ist RESOLVER-V3-006s Aufgabe, nicht hier vorentschieden** (§13).

### 6.7 Konsistenz

- **Gleiche Eingabe, mehrere Durchläufe:** AI-Varianten (B/C) mindestens **3 Durchläufe** pro
  Fall in der `REPEAT_CONSISTENCY`-Stichprobe (nicht über das gesamte Korpus, aus Kostengründen —
  §8); Variante A ist deterministisch, wird aber dennoch mindestens 2× erneut ausgeführt, um
  Cache-/Flakiness-Artefakte auszuschließen. Metrik: Übereinstimmungsrate (identische kanonische
  Identität + Makros innerhalb einer engen Epsilon-Grenze).
- **Semantisch äquivalente Eingaben:** dieselbe Übereinstimmungsrate für die
  `REPEAT_CONSISTENCY`-Paraphrase-Varianten (Wortstellung, Singular/Plural, Zahlwort vs. Ziffer).
- **Verhalten nach validierter Korrektur:** **nicht messbar in RESOLVER-V3-003..006** — der
  Korrekturrückkanal existiert erst ab RESOLVER-V3-009. Metrik-Definition wird hier bereits
  reserviert (identisch zur obigen Übereinstimmungsrate, angewendet auf Vorher/Nachher-Paare),
  damit RESOLVER-V3-009 sie direkt übernehmen kann.
- **Cache-Hit-Konsistenz:** **nicht messbar vor RESOLVER-V3-008** (Cache-Lesepfad existiert noch
  nicht) — gleiche Reservierung wie oben.

### 6.8 Provenienz

Checkliste pro Fallergebnis: Source-ID vorhanden; Grounding nachvollziehbar (welcher
Quelleneintrag führte zum Ergebnis); Datenherkunft je Komponente vollständig; Annahmen
dokumentiert (sichtbar, nicht still); **„keine unbelegte Zahl als autoritatives Ergebnis"** — ein
numerisches Ergebnis ohne bestimmbare Datenquelle ist ein automatischer Provenienzfehler,
unabhängig davon, ob die Zahl zufällig nah an der Ground Truth liegt.

### 6.9 Performance und Kosten

- **p50-/p95-Latenz** je Variante, je Kategorie (insbesondere getrennt für Fast-Path- vs.
  Nicht-Fast-Path-Fälle bei Variante A, relevant für H3).
- **Kosten pro neuem Log** ($, `0` für Variante A außerhalb ihres bestehenden, nicht verdrahteten
  AI-Rerankings; real gemessen für B/C über Token-Nutzung, gleiches Muster wie
  `ai-reranking-benchmark-scoring.mjs`s `computeCostUsd`).
- **Kosten pro validiertem Log:** Kosten geteilt durch die Anzahl akzeptabler Ergebnisse (weder
  false-confident noch fälschlich abstiniert).
- **Kosten pro korrekter komplexer Auflösung:** dieselbe Rechnung, aber beschränkt auf
  `COMPOSED`/`HOMEMADE`/`RESTAURANT` — das eigentliche Differenzierungsziel.
- **Anzahl externer Requests** je Quelltyp (reuse `ResolverDebugLog.sources[]`-Struktur als Vorbild
  für die Zähllogik).
- **AI-Aufrufe** (Anzahl, nicht nur Kosten — relevant für Rate-Limit-Planung, analog
  `RateLimitedAiReranker`).
- **Cache-Hit-Rate:** **strukturell `0 %` vor RESOLVER-V3-008** (kein Cache existiert) — als
  Baseline für den späteren Vorher/Nachher-Vergleich dokumentiert, nicht als Fehlwert.
- **Kostenersparnis durch Wiederverwendung:** dieselbe Reservierung — erst ab RESOLVER-V3-007/008
  berechenbar.

---

## 7. Fehlerklassen und Gewichtung

| Fehlerklasse                              | Beispiel                                                                                     | Schweregrad                                   |
| ----------------------------------------- | -------------------------------------------------------------------------------------------- | --------------------------------------------- |
| Plausible, aber falsche sichere Auflösung | System liefert einen glaubwürdigen, aber falschen kcal-Wert ohne jede Unsicherheitsangabe    | **kritisch**                                  |
| Regionale Fehlzuordnung                   | US-/UK-Variante eines DACH-Gerichts, falsche Locale-Referenz                                 | **kritisch**                                  |
| Erfundenes Markenprodukt                  | Halluzinierte Marke/Produktvariante ohne Quellenbeleg                                        | **kritisch**                                  |
| Unbelegter Nährwert                       | Zahl ohne bestimmbare Quelle (§6.8)                                                          | **kritisch**                                  |
| Stiller Nullwert bei fehlenden Daten      | `0` statt `null` für einen von der Quelle nicht gelieferten Nährstoff                        | **kritisch**                                  |
| Falsches Lebensmittel                     | Falsche kanonische Identität insgesamt                                                       | hoch                                          |
| Falsche Produktvariante                   | Richtige Marke, falsche Variante/Portionsgröße                                               | hoch                                          |
| Falsche Zubereitung                       | roh statt gekocht o. ä., mit relevantem Makroeffekt                                          | hoch                                          |
| Fehlende Komponente                       | `required: true`-Komponente nicht erkannt (FN, §6.2)                                         | hoch                                          |
| Halluzinierte Komponente                  | Zusätzliche, nicht erwartete Komponente (FP, §6.2)                                           | hoch                                          |
| Unzulässige sichere Schätzung bei Vagheit | `VAGUE`/`UNRELIABLE`-Fall dennoch als `direct_resolution` behandelt                          | hoch                                          |
| Falsche Menge                             | Zahlenabweichung außerhalb Toleranz                                                          | mittel                                        |
| Falsche Einheit                           | Kategorialer Einheitenfehler (z. B. `piece` statt `g`)                                       | mittel                                        |
| Fehlende Provenienz                       | Ergebnis ohne nachvollziehbare Quelle, aber sonst zahlenmäßig korrekt                        | mittel                                        |
| Unnötige Rückfrage                        | Rückfrage bei eindeutigem `direct_resolution`-Fall                                           | mittel                                        |
| Unterlassene Rückfrage                    | Keine Rückfrage bei `clarification_required`-Fall, aber Ergebnis zufällig innerhalb Toleranz | mittel                                        |
| Technischer Fehler                        | Exception, Timeout ohne Fallback                                                             | niedrig–mittel (kontextabhängig)              |
| Quellenausfall                            | Externe Quelle nicht erreichbar, korrekt als solcher behandelt                               | niedrig (kein Fehler, wenn korrekt behandelt) |

**Bindende Gewichtungsregel für RESOLVER-V3-006:** die **False-confident-Rate** (§6.6) wird als
eigenständiges Gate-Kriterium **vor und unabhängig** von jeder aggregierten
Genauigkeits-Kennzahl berichtet. Ein Variantenvergleich, der eine hohe False-confident-Rate durch
einen guten mittleren kcal-Fehler „aufwiegt", erfüllt nicht die Vorgabe dieses Dokuments — der
Auftrag ist hier eindeutig: _„Eine falsche sichere Entscheidung muss stärker gewichtet werden als
eine ehrliche Rückfrage."_ Kritische Fehlerklassen (Tabelle oben) fließen zusätzlich als eigene
Zählgröße in den §11-Gate-Vergleich ein, unabhängig von ihrem Effekt auf den mittleren Fehler.

---

## 8. Fairer Variantenvergleich

Verbindliches Protokoll für RESOLVER-V3-003/004/005/006:

- **Identisches Eingabekorpus, identische Locale, identische Ground Truth** für alle drei
  Varianten — kein Fall wird pro Variante unterschiedlich formuliert oder gefiltert.
- **Modell-/Promptversion für AI-Varianten (B/C)** wird pro Lauf dokumentiert und im Bericht
  festgehalten — reuse des bereits definierten `interpreterVersion`-Felds
  (`AiInterpretationMetadata`, RESOLVER-V3-002) statt eines neuen Felds.
- **Temperatur/Nichtdeterminismus-Einstellungen** werden dokumentiert, wo relevant (nicht in
  diesem Dokument vorentschieden — Provider-/Modellwahl ist ausdrücklich Nicht-Ziel dieses Tasks).
- **Wiederholungen pro AI-Fall:** volle Genauigkeits-/Kosten-/Latenzmessung mit **1 Primärlauf**
  pro Fall (Kostenkontrolle); Konsistenzmessung (§6.7) separat auf einer **Stichprobe** (der
  `REPEAT_CONSISTENCY`-Overlay-Fälle) mit **≥ 3 Durchläufen** — nicht das gesamte Korpus
  mehrfach, aus Kostengründen.
- **Warm-/Kaltstart-Trennung:** vor RESOLVER-V3-008 existiert kein persistenter Cache — jeder Lauf
  ist per Definition „kalt". Anbieterseitiges Prompt-Caching (sofern ein Provider das anbietet)
  muss deaktiviert oder explizit protokolliert werden, da es sonst stillschweigend die
  „Kaltstart"-Annahme verletzt — Hinweis für die RESOLVER-V3-004/005-Implementierung.
- **Netzwerk-/Quellenausfälle:** identische Retry-/Timeout-Policy für alle Varianten, die dieselben
  Quelladapter nutzen (Wiederverwendung der bereits im Resolver vorhandenen Circuit-Breaker-/
  Timeout-Budgets, kein neuer Mechanismus pro Variante).
- **Alle externen Requests werden gezählt** (§6.9) — kein Proxy/Cache darf Aufrufe unsichtbar
  absorbieren.
- **Keine manuelle Nachkorrektur während eines automatisierten Durchlaufs.** Eingaben und
  erwartete Werte sind vor Laufbeginn eingefroren.
- **Getrennte Auswertung von Erstauflösung und Wiederverwendung:** vor RESOLVER-V3-008 ist jede
  Auflösung eine Erstauflösung — die Trennung wird hier als Regel definiert, damit der spätere
  V3-007/008-Bericht Erstauflösung und Cache-Treffer nicht vermischt.

---

## 9. Leakage, Versionierung und Reproduzierbarkeit

- **Korpusversionierung:** SemVer (`corpusVersion`, §2.1) auf Fallebene plus ein Gesamt-Manifest
  (bei Fixture-Erstellung in RESOLVER-V3-003 anzulegen).
- **Unveränderliche Case-IDs:** `caseId` wird nie wiederverwendet oder umnummeriert — veraltete
  Fälle werden markiert (`tags: ["deprecated"]`), nicht gelöscht. Direkte Übernahme des in
  `AGENTS.md` bereits etablierten Grundsatzes „Task-IDs werden nie wiederverwendet".
- **Änderungsprotokoll:** die zukünftige Korpus-Fixture-Datei führt ein Changelog (Version,
  Datum, geänderte/hinzugefügte/deprecatete `caseId`s, Begründung).
- **Trennung Entwicklungsfälle vs. Holdout:** ~80/20-Split, Holdout wird **nach** Code-Fertigstellung
  des RESOLVER-V3-005-Spikes und **vor** dem RESOLVER-V3-006-Lauf eingefroren.
- **Vermeidung von Prompt-/Fixture-Leakage:** AI-Prompts für Variante B/C dürfen erwartete
  Ground-Truth-Werte oder BLS-`sourceId`s **nicht** wörtlich als Beispiel/Few-Shot einbetten.
- **Pinning/Protokollierung von Modellen und Providerkonfiguration:** jeder B/C-Lauf protokolliert
  exakte Modell-ID/-version + Promptversion (reuse `interpreterVersion`, s. §8).
- **Umgang mit veränderlichen externen Quellen:** BLS ist als committetes Artefakt automatisch
  reproduzierbar; OFF/USDA sind Live-Abrufe, die driften können — jeder Benchmark-Lauf muss die
  rohen Quellenantworten pro Fall als Snapshot ablegen (Ziel-Verzeichnis bei Harness-Bau
  festzulegen, z. B. unter `reports/` — nicht zwingend committet, aber die Policy „Snapshot pro
  Lauf" ist hier bereits verbindlich).
- **Deterministische Auswertung:** Scoring-Funktionen sind reine Funktionen über protokollierte
  Rohdaten (reuse des bestehenden `ai-reranking-benchmark-scoring.mjs`-Musters).
- **Seed-/Wiederholungsregeln:** siehe §8 — keine zusätzliche Zufälligkeit außerhalb der dort
  definierten Wiederholungsstichprobe.

---

## 10. Datenschutzgrenze

- Das Korpus besteht ausschließlich aus **synthetischen bzw. bewusst kuratierten** Eingaben.
- Reale, dokumentierte Fehlermuster (z. B. der Amy-Zwiebelrostbraten-Bericht) dürfen als
  **anonymisiertes Szenario** Kategorien motivieren (§4), niemals als wörtlich übernommener,
  echter Nutzertext oder echte private Eingabe.
- **Keine Namen, keine personenbezogenen Gesundheitsdaten** in irgendeinem Fall.
- **Keine automatische Übernahme privater Nutzer-Journale** (`food_resolver_runs`,
  Journal-Einträge o. ä.) in dieses Korpus — direkte Fortführung der in der Decision Record §5.7/§8
  bewusst offengelassenen Datenschutzgrenze.
- Eine getrennte Freigabe für eine spätere **Real-World-Evaluation** (echte, anonymisierte
  Nutzungsdaten) ist ausdrücklich ein eigener, zukünftiger, separat zu autorisierender Schritt —
  nicht Teil dieses Korpus und nicht implizit durch dieses Dokument freigegeben.
- **Keine Vermischung** des persönlichen Resolver-Caches (RESOLVER-V3-008) mit globalem
  Benchmark-Wissen — das Benchmark-Korpus ist ein separates, nicht-personenbezogenes,
  versioniertes Repository-Artefakt, kein Ableger des Knowledge Layer.

---

## 11. Akzeptanz- und Entscheidungsgates

**Kein Gate hier entscheidet einen Produktions-Cutover.** Alle Schwellenwerte unten sind
**vorläufige, überprüfbare Entscheidungsgates**, keine bewiesene fachliche Wahrheit — sie folgen
demselben „bewusster Review-/Revisionsprozess statt stiller Edits"-Grundsatz wie die Decision
Record selbst und werden anhand der RESOLVER-V3-006/007-Ergebnisse überprüft, nicht vorab
zementiert.

| Gate | Voraussetzung für...                                        | Kombinierte Dimensionen (alle müssen erfüllt sein)                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| ---- | ----------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| G1   | Technischen Spike (RESOLVER-V3-005) fortsetzen              | Auf dem Smoke-Subset zeigt Variante C eine **niedrigere** False-confident-Rate als Variante B, ohne kategorialen Latenz-/Kostenausreißer. Niedrige Hürde, früh im Prozess prüfbar.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| G2   | Variante C als überlegen betrachten (RESOLVER-V3-006-Fazit) | (a) **Qualität:** Top-1-Identifikation ≥ Variante A mindestens in `DACH`/`COMPOSED`/`RESTAURANT`, ohne Regression in `SIMPLE`/`HOUSEHOLD`; (b) **False Confidence:** streng niedriger als A **und** B (hartes, nicht-vorläufiges Kriterium — s. §7); (c) **Nutzerfriktion:** Rückfragenrate nicht drastisch über dem bestehenden Speck-Präzedenzfall-Volumen (RESOLVER-V2-010) — qualitativ zu prüfen, kein Fixwert; (d) **Latenz:** p95 innerhalb eines in RESOLVER-V3-007 explizit herzuleitenden, akzeptablen Vielfachen von As p95 außerhalb des Fast Path (Vielfaches hier **nicht** vorentschieden); (e) **Kosten:** Kosten pro validiertem Log dokumentiert und gegen Produktökonomie geprüft (kein Fixwert — Tier-5-Monetarisierung ist noch `todo`); (f) **Provenienz:** **keine** unbelegten autoritativen Zahlen — hartes Kriterium, keine Ausnahme; (g) **Konsistenz:** Wiederholungs-Übereinstimmungsrate nicht wesentlich schlechter als As (die strukturell nahe 100 % liegt). |
| G3   | Feature-Flag-Integration rechtfertigen (RESOLVER-V3-010)    | G2 bestanden **und** RESOLVER-V3-007s Kosten-/Latenzmodell geprüft **und** RESOLVER-V3-008s Cache-Lesepfad existiert (keine ungecachte Vollkosten-AI-Pipeline geht live) — deckt sich mit der bereits in `ROADMAP.md` bestehenden Dependency (`RESOLVER-V3-010` hängt von `-006` und `-008` ab); dieses Dokument erfindet keine neue Regel, sondern erklärt die bestehende.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| G4   | Cutover überhaupt diskutieren (RESOLVER-V3-012)             | G3 hinter Flag ausgeliefert **und** Regression + Real-Device-Verifikation gemäß `VERIFY.md` **und** kein offener kritischer Fehlerklassen-Fall (§7) aus einem noch zu definierenden Monitoring-Zeitraum — Zeitraum/Monitoring-Mechanismus ist **nicht** Teil dieses Dokuments.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |

**Ausdrücklich festgehalten:** _„Ein geringer kcal-Mittelwertfehler allein reicht nicht aus."_ Kein
Gate darf auf eine einzelne Kennzahl reduziert werden.

---

## 12. Abgleich mit bestehendem Repository

**Als Ground-Truth-Seed direkt wiederverwendbare Tests/Reports:**

- [`FusionCalibrationMatrix.test.ts`](../../src/features/nutrition/__tests__/FusionCalibrationMatrix.test.ts)
  (15 kanonische DACH-Abfragen mit vollständigen Mock-Kandidaten inkl. realer BLS-`sourceId`s/
  Makros, z. B. Magerquark `M713100`) und
  [`ScoreCalculator.plausibility.test.ts`](../../src/features/nutrition/__tests__/ScoreCalculator.plausibility.test.ts)
  (reale Makrowerte, z. B. Ei roh 143 kcal/12,6 g Protein) — beste Quelle für Ebene-3-Ground-Truth-Zahlen
  beim Fixture-Bau. Ihre eigenen Testassertions sind jedoch komparativ (Ranking/`toBeLessThan`),
  nicht exakte Ground-Truth-Prüfungen — die eingebetteten Zahlen sind wiederverwendbar, die Tests
  selbst nicht direkt als Benchmark-Fälle.
- [`reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md`](../../reports/RESOLVER-V2-008_GENERIC_FOOD_TRUST_DIAGNOSIS.md)
  liefert vier real getracte, bereits bewiesene DACH-Fälle mit exakten BLS-`sourceId`s/kcal
  (Himbeeren → `F302100`, 43 kcal; Haferflocken → `C133000`, 348 kcal; Speck → Mehrdeutigkeit
  zwischen drei Clustern; Magerquark → `M713100`, 66 kcal) — direkt in `DACH`-Kategorie-Fixtures
  überführbar, inklusive belegter `criticalFailureConditions` (z. B. „darf nicht auf die
  Dessert-/Suppenvariante fixieren").
- [`BlsPlainGenericReachability.test.ts`](../../src/features/nutrition/__tests__/BlsPlainGenericReachability.test.ts)
  bestätigt dieselben Fälle bereits als Regressionsschutz nach dem RESOLVER-V2-009-Fix.
- [`plans/RESOLVER-V2-010_SPECK_DISAMBIGUATION_DECISION_PLAN.md`](../../plans/RESOLVER-V2-010_SPECK_DISAMBIGUATION_DECISION_PLAN.md)
  und [`SpeckAmbiguity.ts`](../../src/features/nutrition/domain/catalog/SpeckAmbiguity.ts)/
  [`SpeckAmbiguity.test.ts`](../../src/features/nutrition/domain/catalog/__tests__/SpeckAmbiguity.test.ts)
  sind das direkte, bereits produktive Vorbild für die `clarification_required`/`expectedClarificationKind`-
  Taxonomie dieses Dokuments (§2, §6.6).
- [`AiInterpretationProvider.test.ts`](../../src/features/nutrition/__tests__/AiInterpretationProvider.test.ts)s
  „Zwei Scheiben Toast mit Butter und Gouda"-Fall wurde bewusst 1:1 als Beispiel 3 in §2.4
  übernommen, statt eine neue Beispieleingabe zu erfinden.

**Reine Regressionstests, keine Ground-Truth-Quelle:**
`SequentialFoodCatalogResolver.test.ts`, `SequentialFoodCatalogResolver.debug.test.ts`,
`FusionCandidateResolver.integration.test.ts`, `FusionCandidateScorer.test.ts`,
`BlsResolverIntegration.test.ts`, `BlsTokenMatching.test.ts`, `BlsArtifactEquivalence.test.ts`,
`BlsStaticSource.test.ts`, `BlsCompactRuntimeAdapter.test.ts`, `DachRoutingCorrection.test.ts`,
`smokeResolverDe.test.ts`, `ResolverDebugSystem.demo.test.ts`, `DecisionMetaBuilders.test.ts`,
`SupabaseResolverRunLogger.test.ts`, `JournalDomainRegressionCoverage.test.ts` — alle prüfen
Verhalten/Struktur (Kandidatenreihenfolge, Log-Feldform, Persistenzverhalten), nicht absolute
Nährwert-Korrektheit gegen eine externe Referenz. Sie bleiben für die Produktverifikation wichtig,
sind aber keine Benchmark-Ground-Truth-Quelle.

**Bereits vorhandene BLS-Daten:** committeter Laufzeit-Artefakt
[`bls-runtime-compact.v1.json`](../../src/features/nutrition/infrastructure/catalog/sources/bls/generated/bls-runtime-compact.v1.json)
(7.090 Datensätze, BLS 4.0 2025 DE) — die primäre Quelle für Ground-Truth-Ebene 3. Kein separates
BLS-Manifest-Dokument existiert; Provenienz-Metadaten liegen in den `artifact`/`source`-Feldern des
Artefakts selbst sowie in `plans/BLS_INTEGRATION_ANALYSIS_AND_PLAN.md` und
`plans/BLS_DACH_GENERIC_SOURCE_IMPLEMENTATION_PLAN.md`.

**Bereits vorhandene Trace-/Kosten-/Latenz-Infrastruktur:**
[`ResolverDebugTypes.ts`](../../src/features/nutrition/application/services/ResolverDebugTypes.ts)
(Per-Quelle-Status/Dauer/Kandidaten, Per-Kandidat-Scores, Timing) und
[`ResolverRunLogger.ts`](../../src/features/nutrition/application/ports/ResolverRunLogger.ts)/
[`SupabaseResolverRunLogger.ts`](../../src/features/nutrition/infrastructure/repositories/SupabaseResolverRunLogger.ts)
decken Latenz/Cache-Hit/Status für Variante A bereits strukturell ab. Für Kosten (§6.9) existiert
noch keine Infrastruktur im Resolver selbst — das Muster dafür liefert
[`scripts/benchmark-ai-reranking-providers.mjs`](../../scripts/benchmark-ai-reranking-providers.mjs)

- [`scripts/lib/ai-reranking-benchmark-{scoring,fixtures,providers}.mjs`](../../scripts/lib/)
  (RESOLVER-V2-007-B) — reine `fetch()`-Provider-Adapter, env-var-basierte Modellwahl,
  `node:test`-getestete Scoring-Logik, `computeCostUsd` aus echter Token-Nutzung — der explizit in
  `ROADMAP.md` benannte strukturelle Vorlage für RESOLVER-V3-003..005s Harness.

**Metriken, die erst in späteren Tasks implementierbar sind (hier nur definiert, s. §6.7/§6.9):**
Cache-Hit-Rate/Kostenersparnis durch Wiederverwendung (RESOLVER-V3-008), Konsistenz nach
validierter Korrektur (RESOLVER-V3-009), finale Konfidenz-Skalen-Normalisierung über A/B/C hinweg
(RESOLVER-V3-006 selbst).

**Von RESOLVER-V3-001 entschieden:** Fall-Schema (§2), Korpus-Taxonomie inkl. Verteilung (§3–4),
Ground-Truth-Hierarchie (§5), vollständige Metrik-Definitionen inkl. Berechnungsregeln (§6),
Fehlerklassen-Gewichtung (§7), Variantenvergleichs-Protokoll (§8), Leakage-/Versionierungs-/
Datenschutzregeln (§9–10), vorläufige mehrdimensionale Gates (§11).

**Von RESOLVER-V3-001 bewusst offengelassen:** siehe §13.

---

## 13. Offene Entscheidungen

Diese Punkte werden **von diesem Dokument bewusst nicht entschieden**:

- Exakte Zahlenwerte für die G2/G3-Latenz-/Kosten-Dimensionen (§11) — Herleitung ist
  RESOLVER-V3-007s Aufgabe.
- Ob `regionalContext` (§2.1) ein eigenes, typisiertes Feld über `locale: 'de' | 'en'` hinaus
  braucht (AT/CH-Differenzierung) — hier nur als optionales Freitextfeld vorgesehen, nicht
  final spezifiziert.
- Methodik zur Normalisierung unterschiedlicher Konfidenz-Skalen zwischen Variante A
  (`ScoreCalculator.finalScore`) und B/C (`InterpretedFoodComponent.confidence`) — RESOLVER-V3-006.
- Ob das Holdout-Subset (§4, §9) als eigene physische Datei oder als logisches Flag in derselben
  Korpusdatei umgesetzt wird — RESOLVER-V3-003s Implementierungsentscheidung.
- Die endgültige tatsächliche Korpusgröße jenseits des begründeten Zielkorridors (§4) — wird beim
  tatsächlichen Fixture-Bau (RESOLVER-V3-003) final festgelegt und im Korpus-Changelog dokumentiert.
- Jede Form von Real-World-/privater-Log-Evaluation — ausdrücklich außerhalb des Scopes dieses
  Korpus, gebunden an eine eigene künftige Freigabe (§10, Decision Record §5.7/RESOLVER-V3-009).
- Providerwahl, Prompt-Implementierung, Modell-Pinning-Details für B/C — ausdrückliches Nicht-Ziel
  dieses Tasks (s. Kopfzeile), bleibt bei RESOLVER-V3-004/005.

---

## 14. Anschlussaufgaben

Die maßgebliche, aktuelle Aufgaben-/Abhängigkeitslage steht in `ROADMAP.md` (Resolver-V3-Epic) —
dieses Dokument dupliziert sie nicht. Kurz zusammengefasst: RESOLVER-V3-002 ist bereits `done`;
mit Abschluss dieses Dokuments (RESOLVER-V3-001) sind RESOLVER-V3-003 (Harness Variante A),
RESOLVER-V3-004 (Variante B, zusätzlich abhängig von RESOLVER-V3-002) und RESOLVER-V3-005
(Variante C, ebenfalls zusätzlich abhängig von RESOLVER-V3-002) strukturell unblockiert.
RESOLVER-V3-006 (Vergleichsbericht) bleibt bis zum Abschluss aller drei Variantenharnesses
blockiert.
