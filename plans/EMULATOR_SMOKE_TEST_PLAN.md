# HealthApp Natural-Language Input Flow - Emulator Smoke-Test Plan

## Überblick

Dieser Plan testet den aktuellen Natural-Language-Logging-Flow der HealthApp.

**KRITISCHER HINWEIS:** Die [`InputBar`](src/features/input/presentation/InputBar.tsx) Komponente ist derzeit NICHT in die App integriert. Der tatsächliche Input erfolgt über [`JournalScreen`](src/presentation/features/journal/JournalScreen.tsx) mit [`InputArea`](src/ui/components/InputArea.tsx).

## Test-Setup

**Zu testende Komponente:** JournalScreen mit InputArea (nicht InputBar)
**Navigation:** App → MainTabs → Journal Tab
**Mock-Resolver unterstützt:** "eier", "egg", "toast", "banana"
**Gericht-Aliase:** "lasagne", "spaghetti bolognese", "chicken bowl", "reis bowl", "hackbraten"

---

## Emulator Smoke-Test Checkliste

### A. Bekannte Multi-Item-Eingabe

**Input:** `2 Eier und Toast`

**Zu prüfen:**

- [ ] Sichtbares Loading-Feedback während Verarbeitung
- [ ] Success-Message: "2 Einträge gespeichert"
- [ ] Erkannte Items werden angezeigt mit Mengen
- [ ] Keine unresolved Items sichtbar
- [ ] Input-Feld wird nach Erfolg geleert
- [ ] Einträge erscheinen in der Journal-Liste
- [ ] Makro-Zusammenfassung wird aktualisiert

**Erwartetes Verhalten:**

- Parsing: 2 Items erkannt ("eier" mit quantity=2, "toast" ohne quantity)
- Matching: Beide Items matched (eier→egg, toast→toast)
- Confidence: High (100% match rate)
- Interpretation: multi_item
- Persistence: 2 Einträge gespeichert

**Fail-Kriterien:**

- Kein Loading-Feedback
- Falsche Erfolgs-Message
- Items nicht in Journal sichtbar
- Input nicht geleert

### B. Unbekannte Eingabe

**Input:** `mysteryfood`

**Zu prüfen:**

- [ ] Kein falscher Erfolg
- [ ] Error-Message: "Eintrag konnte nicht verarbeitet werden"
- [ ] Unresolved Item klar als "nicht erkannt" markiert
- [ ] "In Eingabe übernehmen" Button funktioniert
- [ ] Input-Feld behält ursprünglichen Text
- [ ] Keine Einträge in Journal hinzugefügt

**Erwartetes Verhalten:**

- Parsing: 1 Item erkannt ("mysteryfood")
- Matching: Kein Match gefunden
- Confidence: Low (0% match rate)
- Interpretation: single_item
- Persistence: 0 Einträge gespeichert

**Fail-Kriterien:**

- Fake Success-Message
- Item wird fälschlicherweise gespeichert
- Unresolved-Sektion nicht sichtbar

### C. Teilweiser Erfolg

**Input:** `Eier und mysteryfood`

**Zu prüfen:**

- [ ] Success-Message: "1 Eintrag gespeichert, 1 nicht erkannt"
- [ ] Erkannte Items-Sektion zeigt "eier"
- [ ] Nicht erkannte Items-Sektion zeigt "mysteryfood"
- [ ] 1 Eintrag in Journal hinzugefügt
- [ ] "Bearbeiten" Button für erkanntes Item funktioniert
- [ ] "In Eingabe übernehmen" für unresolved Item funktioniert
- [ ] Input-Feld wird NICHT geleert (wegen unresolved items)

**Erwartetes Verhalten:**

- Parsing: 2 Items erkannt
- Matching: 1 Match, 1 Unmatched
- Confidence: Medium (50% match rate)
- Interpretation: multi_item
- Persistence: 1 Eintrag gespeichert

**Fail-Kriterien:**

- Verwirrende Success-Message
- Unresolved Item nicht klar getrennt
- Input wird fälschlicherweise geleert

### D. Gericht-Erkennung

**Input:** `Lasagne`

**Zu prüfen:**

- [ ] Success-Message: "Gericht erkannt: Lasagne"
- [ ] Spezielle Gericht-Behandlung sichtbar
- [ ] Flow fühlt sich kohärent an
- [ ] Keine verwirrende Multi-Item-Behandlung
- [ ] Persistence/Result-Feedback verständlich
- [ ] Input-Feld wird geleert

**Erwartetes Verhalten:**

- Parsing: 1 Item erkannt ("lasagne")
- Dish Match: Matched (lasagne→lasagne)
- Interpretation: dish (nicht single_item)
- Spezielle Gericht-Message

**Fail-Kriterien:**

- Gericht wird als normales Item behandelt
- Keine spezielle Gericht-Erkennung sichtbar
- Verwirrende UI-Behandlung

### E. Mengen-schwere Eingabe

**Input:** `200g Reis`

**Zu prüfen:**

- [ ] Menge überlebt den gesamten Flow
- [ ] Erkannte Items-Anzeige zeigt Menge korrekt
- [ ] "Bearbeiten" Button stellt sinnvollen Text in Input wieder her
- [ ] Persistence berücksichtigt Menge
- [ ] Journal-Eintrag zeigt Menge

**Erwartetes Verhalten:**

- Parsing: 1 Item mit quantity=200, unit="g", name="reis"
- Matching: Abhängig von Alias-Map (vermutlich unmatched)
- Quantity-Erhaltung durch gesamten Flow

**Fail-Kriterien:**

- Menge geht verloren
- Edit-Funktion stellt falsche Werte wieder her
- Quantity nicht in Journal sichtbar

### F. Gemischtes Gericht/Item-Verhalten

**Input:** `Lasagne und Cola`

**Zu prüfen:**

- [ ] Verhalten ist akzeptabel oder verwirrend?
- [ ] Aktuelle Limitation klar dokumentiert
- [ ] Keine Crash oder unerwartete Fehler
- [ ] User kann verstehen was passiert ist

**Erwartetes Verhalten:**

- Parsing: 2 Items ("lasagne", "cola")
- Dish Match: Nur für gesamten Input, nicht für Teile
- Vermutlich als multi_item behandelt, nicht als dish
- Gemischte Logik noch nicht sauber implementiert

**Fail-Kriterien:**

- App crasht
- Völlig unverständliches Verhalten
- Keine Rückmeldung an User

---

## Was bei jedem Szenario zu beobachten

### Sichtbares UI-Verhalten

- **Loading-State:** ActivityIndicator während Verarbeitung
- **Success/Error Messages:** Klar und verständlich
- **Input-Feld Verhalten:** Geleert bei Erfolg, behalten bei Fehlern
- **Erkannte Items Sektion:** Korrekte Anzeige mit Mengen
- **Unresolved Items Sektion:** Klar als "nicht erkannt" markiert

### Trust-Verhalten

- **Keine falschen Erfolgs-Meldungen** bei unbekannten Items
- **Transparente Partial-Success** Kommunikation
- **Konsistente Persistence** - was gespeichert wird, wird auch angezeigt

### Korrektur-Verhalten

- **"Bearbeiten" Button:** Stellt sinnvollen Text in Input wieder her
- **"In Eingabe übernehmen" Button:** Übernimmt unresolved Items
- **Input-Feld Verhalten:** Behält Kontext bei Fehlern

### Wahrscheinliche Reibungspunkte

- **Gericht vs. Multi-Item Verwirrung** bei gemischten Eingaben
- **Unresolved Items** zu leicht zu übersehen
- **Korrektur-Flow** fühlt sich zu manuell an
- **Success-Messages** nicht spezifisch genug

---

## UX-Risiken zu beobachten

### Kritische Risiken

- **Fake Success:** Unbekannte Items werden als erfolgreich gemeldet
- **Verlorene Unresolved Items:** User übersieht nicht erkannte Eingaben
- **Input-Reset Verwirrung:** Input wird geleert obwohl Teile nicht verarbeitet wurden

### Mittlere Risiken

- **Gericht-Erkennung unklar:** User versteht nicht warum "Lasagne" anders behandelt wird
- **Partial Success verwirrend:** "1 gespeichert, 1 nicht erkannt" nicht transparent genug
- **Korrektur-Flow umständlich:** Zu viele Schritte für einfache Korrekturen

### Niedrige Risiken

- **Mengen-Anzeige inkonsistent:** Quantity/Unit Display nicht einheitlich
- **Loading-Feedback zu subtil:** ActivityIndicator zu klein/unauffällig
- **Success-Messages zu generisch:** Nicht spezifisch genug für verschiedene Szenarien

---

## Entscheidungsframework nach Testing

### Blocker-Level Issues (Stoppen weitere Entwicklung)

- Fake Success bei unbekannten Items
- Crash bei normalen Eingaben
- Datenverlust (Einträge verschwinden)
- Unresolved Items komplett unsichtbar

### Akzeptabel für jetzt (Können später behoben werden)

- Gericht/Multi-Item gemischte Logik noch nicht perfekt
- Korrektur-Flow etwas umständlich
- Success-Messages könnten spezifischer sein
- Loading-Feedback könnte prominenter sein

### Nächste Priorität nach Emulator-Testing

1. **Integration von InputBar** in JournalScreen (falls gewünscht)
2. **Verbesserung der Unresolved Items UX** (prominenter, einfachere Korrektur)
3. **Klarere Success/Error Messages** mit mehr Kontext
4. **Gericht + Multi-Item gemischte Eingaben** sauberer handhaben
5. **Quantity/Unit Display** konsistenter machen

---

## Test-Ausführung

1. **Emulator starten** und zur Journal-Screen navigieren
2. **Jeden Test-Fall einzeln durchführen** und Ergebnisse dokumentieren
3. **Screenshots** von kritischen UI-Zuständen machen
4. **Blocker vs. akzeptable Issues** kategorisieren
5. **Nächste Schritte** basierend auf Ergebnissen priorisieren

**Geschätzte Test-Zeit:** 30-45 Minuten für alle Szenarien
