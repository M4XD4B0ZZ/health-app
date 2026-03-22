# Emulator Nutrition-Flow Test Plan

## Ziel

Strukturierter manueller Test des aktuellen Nutrition-Flow im Emulator mit priorisierten Testeingaben und Bewertungsraster.

## Test-Setup

- **Komponente:** JournalScreen mit InputArea
- **Navigation:** App → MainTabs → Journal Tab
- **Mock-Resolver:** Unterstützt die unten aufgeführten Lebensmittel
- **Fokus:** Resolver-Auswahl, Portion-Handling, UI-Konsistenz, unresolved items

---

## Priorisierte Testliste (10 Eingaben)

### 1. **egg** (Prio: HOCH)

**Erwartung:** Happy Path - Einzelnes Item, einfache Erkennung

- **Erkannt:** "Egg" (155 kcal/100g, 13g protein)
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Resolver wählt korrekte Quelle (MockSource)
  - Target grams = 100g (Standard-Portion)
  - Kcal-Berechnung: ~155 kcal
  - UI zeigt "1 Eintrag gespeichert"

### 2. **2 eggs** (Prio: HOCH)

**Erwartung:** Happy Path - Quantity-Parsing mit Plural

- **Erkannt:** "Egg" mit quantity=2
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Quantity-Erhaltung durch gesamten Flow
  - Target grams = 200g (2x 100g Standard-Portion)
  - Kcal-Berechnung: ~310 kcal
  - Journal zeigt "2x Egg" oder ähnlich

### 3. **200g egg** (Prio: HOCH)

**Erwartung:** Happy Path - Explizite Gramm-Angabe

- **Erkannt:** "Egg" mit 200g
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Gramm-Angabe überschreibt Standard-Portion
  - Target grams = 200g (explizit)
  - Kcal-Berechnung: ~310 kcal (200g \* 155/100)
  - UI zeigt Gramm-Angabe korrekt

### 4. **rice** (Prio: HOCH)

**Erwartung:** Happy Path - Kohlenhydrat-reiche Basis

- **Erkannt:** "Rice" (130 kcal/100g, 28g carbs)
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Resolver findet Rice-Match
  - Target grams = 100g (Standard)
  - Makro-Balance: Hohe Carbs, niedrige Protein/Fat
  - UI-Konsistenz mit anderen Items

### 5. **200g rice** (Prio: HOCH)

**Erwartung:** Happy Path - Reis mit expliziter Menge

- **Erkannt:** "Rice" mit 200g
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Portion-Handling für Kohlenhydrate
  - Target grams = 200g
  - Kcal-Berechnung: ~260 kcal (200g \* 130/100)
  - Realistische Reis-Portion

### 6. **toast** (Prio: MITTEL)

**Erwartung:** Happy Path - Verarbeitetes Getreide

- **Erkannt:** "Toast" (265 kcal/100g, 49g carbs)
- **Verhalten:** single_item, accepted
- **Achten auf:**
  - Mock-Resolver hat Toast definiert
  - Höhere Kaloriendichte als Rice
  - Standard-Portion sinnvoll (100g = ~2-3 Scheiben)
  - UI zeigt korrekte Makros

### 7. **mysteryfood** (Prio: HOCH)

**Erwartung:** Failure Path - Unbekanntes Item

- **Erkannt:** Nichts (rejected)
- **Verhalten:** single_item, rejected
- **Achten auf:**
  - **KRITISCH:** Keine falsche Success-Message
  - Error-Message: "Eintrag konnte nicht verarbeitet werden"
  - Unresolved Items Sektion sichtbar
  - Input-Feld behält Text
  - Keine Journal-Einträge hinzugefügt

### 8. **mysteryfood und eier** (Prio: HOCH)

**Erwartung:** Mixed Path - Partial Success

- **Erkannt:** "Egg" (eier), "mysteryfood" rejected
- **Verhalten:** multi_item, partial success
- **Achten auf:**
  - Success-Message: "1 Eintrag gespeichert, 1 nicht erkannt"
  - Erkannte Items Sektion: "eier" → "Egg"
  - Unresolved Items Sektion: "mysteryfood"
  - Input-Feld NICHT geleert (wegen unresolved)
  - 1 Journal-Eintrag hinzugefügt

### 9. **lasagne** (Prio: MITTEL)

**Erwartung:** Dish Recognition (falls implementiert)

- **Erkannt:** Abhängig von Dish-System
- **Verhalten:** dish oder rejected
- **Achten auf:**
  - Dish-Erkennung vs. normales Item-Matching
  - Spezielle Gericht-Message oder normaler Flow
  - Mock-Resolver hat keine Lasagne → vermutlich rejected
  - UI-Verhalten bei Dish-Eingaben

### 10. **lasagne und egg** (Prio: NIEDRIG)

**Erwartung:** Complex Mixed - Dish + Item

- **Erkannt:** "Egg" accepted, "lasagne" rejected
- **Verhalten:** multi_item, partial success
- **Achten auf:**
  - Gemischte Dish/Item-Logik
  - Ähnlich wie Test #8 aber mit Dish-Kontext
  - Verwirrende UI-Behandlung möglich
  - Dokumentation der aktuellen Limitationen

---

## Kompakte Ergebnistabelle

| #   | Input                | Erkannt?    | Target Grams | Kcal       | UI Message               | Unresolved  | Journal   | Notizen        |
| --- | -------------------- | ----------- | ------------ | ---------- | ------------------------ | ----------- | --------- | -------------- |
| 1   | egg                  | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 2   | 2 eggs               | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 3   | 200g egg             | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 4   | rice                 | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 5   | 200g rice            | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 6   | toast                | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 7   | mysteryfood          | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 8   | mysteryfood und eier | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 9   | lasagne              | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |
| 10  | lasagne und egg      | ☐ Ja ☐ Nein | \_\_\_g      | \_\_\_kcal | **\*\***\_\_\_\_**\*\*** | ☐ Ja ☐ Nein | ☐ +1 ☐ +0 | \***\*\_\*\*** |

---

## Detaillierte Bewertungskriterien

### Happy Path Tests (1-6)

**Erfolgskriterien:**

- ✅ Resolver findet korrektes Food-Match
- ✅ Target grams korrekt berechnet (Standard 100g oder explizit)
- ✅ Kcal-Berechnung mathematisch korrekt
- ✅ Success-Message: "1 Eintrag gespeichert"
- ✅ Input-Feld wird geleert
- ✅ Journal-Eintrag erscheint mit korrekten Makros

**Fail-Kriterien:**

- ❌ Resolver findet kein Match (obwohl Mock definiert)
- ❌ Target grams falsch berechnet
- ❌ Kcal-Berechnung inkorrekt
- ❌ Verwirrende oder falsche UI-Messages
- ❌ Input-Feld nicht geleert
- ❌ Journal-Eintrag fehlt oder falsche Werte

### Failure Path Test (7)

**Erfolgskriterien:**

- ✅ **KRITISCH:** Keine falsche Success-Message
- ✅ Error-Message klar und verständlich
- ✅ Unresolved Items Sektion sichtbar
- ✅ Input-Feld behält ursprünglichen Text
- ✅ Keine Journal-Einträge hinzugefügt

**Fail-Kriterien:**

- ❌ **BLOCKER:** Fake Success bei unbekanntem Item
- ❌ Unresolved Items nicht sichtbar
- ❌ Input-Feld fälschlicherweise geleert
- ❌ Item wird fälschlicherweise gespeichert

### Mixed Path Test (8, 10)

**Erfolgskriterien:**

- ✅ Partial Success Message: "X gespeichert, Y nicht erkannt"
- ✅ Erkannte Items Sektion zeigt erfolgreiche Matches
- ✅ Unresolved Items Sektion zeigt fehlgeschlagene
- ✅ Input-Feld NICHT geleert (wegen unresolved)
- ✅ Korrekte Anzahl Journal-Einträge

**Fail-Kriterien:**

- ❌ Verwirrende Success-Message
- ❌ Unresolved Items nicht klar getrennt
- ❌ Input fälschlicherweise geleert
- ❌ Falsche Anzahl Journal-Einträge

### Dish Recognition Test (9)

**Erfolgskriterien:**

- ✅ Konsistentes Verhalten (accepted oder rejected)
- ✅ Klare UI-Behandlung
- ✅ Keine verwirrende Mixed-Logik

**Fail-Kriterien:**

- ❌ Inkonsistentes Verhalten
- ❌ App crasht
- ❌ Völlig unverständliche UI

---

## Kritische Beobachtungspunkte

### Resolver-Auswahl

- Welche Quelle wird gewählt? (MockSource erwartet)
- Score-Berechnung nachvollziehbar?
- Fallback-Verhalten bei mehreren Kandidaten?

### Portion-Handling

- Standard-Portionen (100g) korrekt angewendet?
- Explizite Gramm-Angaben überschreiben Standard?
- Quantity-Multiplikation (2 eggs → 200g) funktioniert?

### UI-Konsistenz

- Success/Error Messages verständlich und korrekt?
- Erkannte vs. Unresolved Items klar getrennt?
- Input-Feld Verhalten logisch?
- Journal-Updates sofort sichtbar?

### Unresolved Items

- Klar als "nicht erkannt" markiert?
- "In Eingabe übernehmen" Button funktioniert?
- Keine falschen Success-Claims?

---

## Blocker-Level Issues

**Sofort stoppen bei:**

- ❌ Fake Success bei unbekannten Items (Test #7)
- ❌ App crasht bei normalen Eingaben
- ❌ Datenverlust (Einträge verschwinden)
- ❌ Unresolved Items komplett unsichtbar
- ❌ Mathematisch falsche Kcal-Berechnungen

**Akzeptabel für jetzt:**

- Dish-Erkennung noch nicht perfekt implementiert
- Korrektur-Flow etwas umständlich
- Success-Messages könnten spezifischer sein
- Loading-Feedback könnte prominenter sein

---

## Test-Ausführung

1. **Emulator starten** und zur Journal-Screen navigieren
2. **Jeden Test einzeln durchführen** und Tabelle ausfüllen
3. **Screenshots** von kritischen UI-Zuständen machen
4. **Blocker vs. akzeptable Issues** kategorisieren
5. **Nächste Schritte** basierend auf Ergebnissen priorisieren

**Geschätzte Test-Zeit:** 45-60 Minuten für alle 10 Szenarien
