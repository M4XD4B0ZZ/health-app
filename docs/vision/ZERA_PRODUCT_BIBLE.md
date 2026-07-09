# Zera — Product Bible: Evaluation Engine

Status: `draft` — zur Freigabe vor weiterer Tier-1-Zerlegung
Ebene: Produkt-/Architekturkonzept (unterhalb des Founding Brief, oberhalb der
`ROADMAP.md`-Task-Zerlegung)
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md) (Vision, Zielgruppen,
Kernprinzip)

---

## 1. Zweck dieses Dokuments

Das Founding Brief beantwortet _warum_ Zera Datenerfassung und Bewertung trennt. Dieses
Dokument beantwortet _wie_ diese Trennung produktseitig aussieht — als Brücke zwischen
Vision und der späteren Zerlegung von Journal, Saved Meals, Dashboard und Goals in konkrete
`ROADMAP.md`-Tasks.

Auch dieses Dokument ist **kein Implementierungsplan**. Es definiert Verantwortlichkeiten,
Datenkategorien und Konzepte auf Produktebene — keine Datenbankschemata, keine
TypeScript-Interfaces, keine konkreten Dateien. Diese Ebene folgt erst in den späteren
P1-Tasks, nachdem dieses Konzept freigegeben ist.

---

## 2. Architekturprinzip

```
┌─────────────────────────┐        ┌──────────────────────────────────────┐
│         Journal          │        │           Evaluation Engine            │
│   (neutral, dauerhaft)   │──────▶│   (austauschbar, modellabhängig)       │
│                          │  liest │                                        │
│  - Was gegessen wurde    │  nur   │  Aktives Modell, z. B.:                │
│  - Wann, wie viel        │        │   - Evidence-based Standard            │
│  - Aufgelöste Makros     │        │   - Weight Loss                        │
│  - Portionsdaten         │        │   - Muscle Gain                        │
│  - Korrekturen           │        │   - Low Carb                           │
│                          │        │   - Mediterranean                      │
│  Kennt kein Modell.      │        │   - Cholesterol Focus                  │
│  Ändert sich nie durch   │        │   - User-defined Goals                 │
│  einen Modellwechsel.    │        │                                        │
└─────────────────────────┘        └──────────────────────────────────────┘
                                                    │
                                                    ▼
                                    Dashboard · Goals · Insights · Reports
                                    · (später) AI Coach
```

Zentrale Regel: **Die Evaluation Engine liest Journaldaten, sie besitzt sie nicht.** Kein
Bewertungsmodell darf Journaldaten verändern, löschen oder in seinem eigenen Format
duplizieren. Ein Modellwechsel ist ein reiner Lesekontext-Wechsel, kein Datenmigrationsschritt.

---

## 3. Datenverantwortung: Journal vs. abgeleitet

| Datenkategorie                | Gehört zu         | Charakter                                 | Beispiele                                                                   |
| ----------------------------- | ----------------- | ----------------------------------------- | --------------------------------------------------------------------------- |
| Rohangaben aus der Erfassung  | Journal           | dauerhaft, unveränderlich durch Modelle   | Rohtext, Zeitpunkt, Menge/Einheit wie eingegeben                            |
| Aufgelöste Fakten             | Journal           | dauerhaft, deterministisch aus Rohangaben | Zugeordnetes Lebensmittel, Quelle (BLS/OFF/USDA), Makros/Portionen in Gramm |
| Nutzer-Korrekturen            | Journal           | dauerhaft, Teil der Fakten-Historie       | Manuell angepasste Menge, korrigierte Zuordnung                             |
| Gruppierungsmetadaten         | Journal           | dauerhaft, modellunabhängig               | `groupId`/`groupLabel` aus P1-003C (composite-dish)                         |
| Zielwerte/Referenzbereiche    | Evaluation Engine | modellabhängig, austauschbar              | Kalorienziel, Makro-Korridor, Cholesterin-Grenzwert                         |
| Bewertungen/Scores            | Evaluation Engine | abgeleitet, jederzeit neu berechenbar     | "Tag im Zielkorridor", Ampel-Status                                         |
| Insights/Hinweise             | Evaluation Engine | abgeleitet, modellabhängig                | "Zu wenig Ballaststoffe für Cholesterin-Fokus"                              |
| Fortschrittsverlauf ggü. Ziel | Evaluation Engine | abgeleitet aus Journal + aktivem Modell   | Trendlinie Gewicht vs. Kalorienbilanz                                       |

Faustregel: **Wenn ein Datenpunkt beim Löschen/Wechsel des Bewertungsmodells verschwinden
darf, gehört er zur Evaluation Engine. Wenn er das nicht darf, gehört er zum Journal.**
Alles, was zur Evaluation Engine gehört, muss aus Journaldaten **neu berechenbar** sein —
es darf keine Evaluation-Daten geben, die nicht aus dem Journal plus aktivem Modell
reproduzierbar wären.

---

## 4. Evaluation Model — Konzeptvertrag

Jedes Bewertungsmodell folgt konzeptionell demselben Vertrag (kein Code, nur
Verantwortlichkeiten):

**Eingaben, die ein Modell erhalten darf:**

- Journaldaten des betrachteten Zeitraums (nur lesend)
- Nutzerprofil-Basisdaten, sofern für das Modell relevant (z. B. Gewicht, Aktivitätslevel
  für Kalorienbedarf — bereits vorhanden über `MetabolismCalculator`/`GoalsUseCases`)
- Modellspezifische Zielparameter (z. B. Ziel-Cholesterin-Obergrenze bei Cholesterol Focus,
  eigene Makro-Ranges bei User-defined Goals)

**Ausgaben, die ein Modell liefern muss:**

- Fortschritts-/Statuswerte für Dashboard-Anzeige
- Insights/Hinweise (kurz, nachvollziehbar, keine "stille" Bewertung ohne erklärbare Basis —
  konsistent mit dem bestehenden Determinismus-Prinzip)
- Ziel-Fortschritt für Goals-Anzeige

**Was ein Modell niemals darf:**

- Journaldaten schreiben, löschen oder umformen
- Voraussetzungen an das Erfassungsformat stellen (z. B. "Nutzer muss X anders eingeben,
  damit dieses Modell funktioniert") — Journal bleibt für alle Modelle identisch nutzbar
- Andere Modelle in ihrer Verfügbarkeit oder ihren Ergebnissen beeinflussen

**Modell-Metadaten (konzeptionell, keine Schema-Festlegung):**

- Eindeutige Kennung und Name
- Zielgruppenbeschreibung (aus Founding Brief Abschnitt 6 abgeleitet)
- Zusätzlicher Datenbedarf über die Journal-Basisdaten hinaus (z. B. Lebensmittelgruppen-
  Klassifikation für Mediterranean)
- Reifegrad (z. B. "Kandidat", "MVP", "vollständig")

---

## 5. Kandidaten-Bewertungsmodelle

Diese Liste ist der initiale, bewusst kleine Kandidatensatz aus dem Founding Brief,
übersetzt in Modell-Konzepte. Sie ist **nicht** final und **nicht** priorisiert für die
Umsetzungsreihenfolge — diese Priorisierung ist Teil der späteren Tier-1-Zerlegung.

### Evidence-based Standard

- **Zielgruppe:** Allgemeine Gesundheit ohne konkretes Körperziel.
- **Fokus:** Ausgewogenheit gemäß anerkannten Referenzwerten (z. B. DACH-Referenzwerte),
  keine aggressive Kalorienrestriktion.
- **Rolle:** Dient als **Default-Modell** — neutralste Bewertung, sinnvoll auch als
  Fallback, wenn (noch) kein spezifisches Ziel gewählt wurde.
- **Zusätzlicher Datenbedarf:** Keiner über Journal-Basisdaten hinaus.

### Weight Loss

- **Zielgruppe:** Gewichtsreduktion.
- **Fokus:** Kaloriendefizit, Proteinerhalt zum Muskelschutz, Sättigungsaspekte.
- **Zusätzlicher Datenbedarf:** Zielgewicht/-tempo, ggf. Aktivitätslevel (bereits über
  bestehenden `MetabolismCalculator` verfügbar).

### Muscle Gain

- **Zielgruppe:** Muskelaufbau/Leistung.
- **Fokus:** Kalorienüberschuss, Proteinverteilung über den Tag, nicht nur Tagessumme.
- **Zusätzlicher Datenbedarf:** Trainingsbezug/-frequenz (optional, spätere Ausbaustufe).

### Low Carb

- **Zielgruppe:** Ernährungsstil-orientierte Nutzer:innen.
- **Fokus:** Kohlenhydratlimits, ggf. Netto-Kohlenhydrate.
- **Zusätzlicher Datenbedarf:** Ballaststoffdaten für Netto-Carb-Berechnung — abhängig von
  Datenqualität der Quellen (BLS/OFF/USDA), siehe offene Frage in Abschnitt 8.

### Mediterranean

- **Zielgruppe:** Ernährungsstil-orientierte Nutzer:innen.
- **Fokus:** Lebensmittelgruppen-Qualität (Gemüse-/Fischanteil, Fettqualität) statt reiner
  Makro-Zielwerte.
- **Zusätzlicher Datenbedarf:** Lebensmittelgruppen-Klassifikation pro Journal-Eintrag —
  existiert aktuell nicht und wäre ein eigener Vorlauf-Task (nicht Teil dieses Dokuments).

### Cholesterol Focus

- **Zielgruppe:** Medizinisch/ärztlich motivierte Nutzer:innen.
- **Fokus:** Gesättigte Fette, Ballaststoffe, ggf. spezifische Lebensmittelgruppen.
- **Zusätzlicher Datenbedarf:** Detailliertere Fettsäure-/Ballaststoffdaten als aktuell
  durchgängig verfügbar.
- **Besonderheit:** Höchste Sorgfaltsanforderung an Nachvollziehbarkeit; explizit **kein**
  Ersatz für ärztliche Beratung — siehe offene Frage in Abschnitt 8.

### User-defined Goals

- **Zielgruppe:** Selbstbestimmte Nutzer:innen.
- **Fokus:** Frei konfigurierte Makro-/Nährstoff-Zielkorridore statt vorgefertigtem Modell.
- **Zusätzlicher Datenbedarf:** Keiner über Journal-Basisdaten hinaus; Zielparameter kommen
  vollständig vom Nutzer.

---

## 6. Modellunabhängige App-Teile

Diese Bereiche dürfen **niemals** Wissen über ein spezifisches Bewertungsmodell enthalten,
damit neue Modelle ergänzt werden können, ohne sie anzufassen:

- **Journal-Erfassung** (Input-Pipeline, Resolver, Portion Knowledge — der gesamte
  bisherige Tier-1-Resolver-Kern aus P1-001 bis P1-005)
- **Food-Datenquellen** (BLS/OFF/USDA-Anbindung, Kandidaten-Fusion)
- **Saved Meals als Erfassungs-Vorlagen** — eine gespeicherte Mahlzeit ist eine
  Logging-Beschleunigung, kein Bewertungsobjekt; sie muss unabhängig vom aktiven Modell
  identisch funktionieren
- **Journal-Anzeige der reinen Fakten** (was wurde wann gegessen) — unabhängig davon, ob
  überhaupt ein Bewertungsmodell aktiv ist

## 7. Modellabhängige App-Teile

Diese Bereiche lesen Journaldaten **und** das aktive Bewertungsmodell und werden durch
Letzteres bestimmt:

- **Dashboard** — Zusammenfassung/Fortschritt gemäß aktivem Modell
- **Goals** — Zielwerte und Zielfortschritt kommen vom aktiven Modell, nicht aus einem
  festen Schema
- **Insights/Reports** — Ableitungen, die ohne ein Modell keine Bedeutung hätten
- **AI Coach (später)** — konsumiert Modell-Output, trifft aber gemäß bestehendem
  KI-Prinzip (`SSOK.md`) keine stillen Bewertungsentscheidungen selbst

---

## 8. Erweiterbarkeit: Neue Modelle ohne Änderung des Logging-Kerns

Konzeptionelle Anforderungen an künftige Erweiterbarkeit (keine Implementierungsdetails):

1. Ein neues Modell wird **registriert**, nicht in bestehende Journal-/Resolver-Logik
   einprogrammiert.
2. Ein neues Modell darf **keine** Änderung an Journal-Datenerfassung oder -Speicherung
   voraussetzen. Falls ein Modell zusätzliche Datenqualität benötigt (z. B. Mediterranean →
   Lebensmittelgruppen), ist das ein **optionaler Anreicherungs-Task auf Journal-Seite**,
   der allen Modellen zugutekommt — nicht eine Modell-spezifische Journal-Änderung.
3. Modelle sind untereinander **unabhängig**: Das Hinzufügen von Cholesterol Focus darf
   Weight Loss nicht verändern.
4. Ein Wechsel des aktiven Modells muss **rückwirkend** auf bestehende Journaldaten
   anwendbar sein (Neubewertung historischer Tage), ohne erneute Erfassung.

---

## 9. Auswirkung auf die vier Tier-1-Platzhalter

Diese Trennung reframt die vier offenen Module wie folgt (weiterhin **keine** Zerlegung in
Tasks — das folgt separat nach Freigabe):

- **Journal** wird zur reinen, modellunabhängigen Erfassungs- und Fakten-Anzeigeschicht.
- **Saved Meals** bleibt modellunabhängige Logging-Beschleunigung, keine Bewertungsfunktion.
- **Dashboard** wird zur Ansicht, die vollständig vom aktiven Evaluation Model bestimmt wird
  — nicht zu einem festen, generischen Kalorien-/Makro-Screen.
- **Goals** wird zur Zielkonfiguration/-anzeige innerhalb eines Modells, statt eines
  einzelnen festen Zielschemas.

---

## 10. Offene Fragen (bewusst vertagt)

Diese Fragen werden **nicht** in diesem Dokument entschieden, sondern markieren bewusst
offene Punkte für spätere, gezielte Entscheidungen:

- Kann zu einem Zeitpunkt nur genau ein Modell aktiv sein, oder mehrere parallel
  (z. B. Weight Loss + Cholesterol Focus gleichzeitig)?
- Wie wird der Wechsel des aktiven Modells in der UX gestaltet (Onboarding-Frage,
  jederzeit änderbar, mehrere gespeicherte Profile)?
- Welche Modelle erfordern zusätzliche Datenqualität, die die bestehenden Quellen
  (BLS/OFF/USDA) aktuell nicht durchgängig liefern (z. B. Lebensmittelgruppen für
  Mediterranean, detaillierte Fettsäuren für Cholesterol Focus)?
- Wie wird bei medizinisch geprägten Modellen (Cholesterol Focus) mit Haftungs- und
  Vertrauensfragen umgegangen (Disclaimer, keine Diagnosefunktion, ärztliche Rücksprache)?
- Werden einzelne Modelle Teil eines Freemium-/Monetarisierungsmodells? (Explizit nicht
  Teil des Founding Brief oder dieses Dokuments.)
- Wie wird der spätere AI Coach konkret an Modell-Output angebunden?

---

## 11. Nächste Schritte

1. Freigabe von Founding Brief und dieser Product Bible.
2. Erst danach: Zerlegung von Journal, Saved Meals, Dashboard und Goals in konkrete,
   verifizierbare `ROADMAP.md`-Tasks unter expliziter Berücksichtigung der hier
   festgelegten Journal/Evaluation-Engine-Trennung.
3. Auswahl eines ersten MVP-Modells (vermutlich Evidence-based Standard als neutraler
   Default) für die erste konkrete Evaluation-Engine-Implementierung — Priorisierung folgt
   in der Tier-1-Zerlegung, nicht hier.
