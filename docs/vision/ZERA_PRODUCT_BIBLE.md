# Zera — Product Bible: Evaluation Engine

Status: `draft` — überarbeitet nach Concept Review R1, weiterhin nicht freigegeben
Ebene: Produkt-/Architekturkonzept (unterhalb des Founding Brief, oberhalb der
`ROADMAP.md`-Task-Zerlegung)
Voraussetzung: [`ZERA_FOUNDING_BRIEF.md`](./ZERA_FOUNDING_BRIEF.md) (Vision, Zielgruppen,
Kernprinzip)

> Revision: Nach [`ZERA_CONCEPT_REVIEW_R1.md`](./ZERA_CONCEPT_REVIEW_R1.md) überarbeitet:
> (1) "Evaluation Model" → "Evaluation Profile" + neue Regel-Ebene (Profile sind
> Preset- oder nutzerkomponierte Regel-Bündel, keine festen Algorithmus-Klassen mehr —
> löst den Widerspruch zwischen fixen Modell-Klassen und dem "User-defined Goals"-Anspruch
> auf freie Komposition), (2) explizite Statelessness-Regel für Profile ergänzt,
> (3) Zuständigkeit für lebensmittel-intrinsische Zusatzdaten (Food-Catalog-Schicht statt
> Evaluation Engine) geklärt, (4) explizite Motivation-↔-Profil-Zuordnung ergänzt.

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
┌─────────────────────────┐        ┌───────────────────────────────┐
│         Journal          │        │        Evaluation Engine        │
│   (neutral, dauerhaft)   │──────▶│                                 │
│                          │  liest │  aktives Evaluation Profile     │
│  - Was gegessen wurde    │  nur   │  (Preset ODER Custom)           │
│  - Wann, wie viel        │        │            │                    │
│  - Aufgelöste Makros     │        │            ▼                    │
│  - Portionsdaten         │        │       Regelsammlung             │
│  - Korrekturen           │        │  ("Protein hoch",               │
│                          │        │   "Zucker niedrig", ...)        │
│  Kennt kein Profile.     │        │            │                    │
│  Ändert sich nie durch   │        │            ▼                    │
│  einen Profilwechsel.    │        │        Bewertung                │
└─────────────────────────┘        └───────────────────────────────┘
                                                    │
                                                    ▼
                                    Dashboard · Goals · Insights · Reports
                                    · (später) AI Coach
```

**Preset Profiles** (kuratierte Regel-Bündel, analog zu den bisherigen "Modellen"):
Evidence-based Standard, Weight Loss, Muscle Gain, Low Carb, Mediterranean, Cholesterol
Focus (Details: Abschnitt 5). **Custom Profile:** eine nutzerkomponierte Regelauswahl —
strukturell identisch zu einem Preset, nur nicht kuratiert, sondern selbst zusammengestellt
(ersetzt das bisherige separate "User-defined Goals"-Modell als Sonderfall: Composition ist
jetzt der Normalfall der Architektur, nicht die Ausnahme).

Zentrale Regel: **Die Evaluation Engine liest Journaldaten, sie besitzt sie nicht.** Kein
Evaluation Profile und keine Regel darf Journaldaten verändern, löschen oder in einem
eigenen Format duplizieren. Ein Profilwechsel ist ein reiner Lesekontext-Wechsel, kein
Datenmigrationsschritt.

---

## 3. Datenverantwortung: Journal vs. abgeleitet

| Datenkategorie                        | Gehört zu                      | Charakter                                    | Beispiele                                                                   |
| ------------------------------------- | ------------------------------ | -------------------------------------------- | --------------------------------------------------------------------------- |
| Rohangaben aus der Erfassung          | Journal                        | dauerhaft, unveränderlich durch Profile      | Rohtext, Zeitpunkt, Menge/Einheit wie eingegeben                            |
| Aufgelöste Fakten                     | Journal                        | dauerhaft, deterministisch aus Rohangaben    | Zugeordnetes Lebensmittel, Quelle (BLS/OFF/USDA), Makros/Portionen in Gramm |
| Lebensmittel-intrinsische Zusatzdaten | Journal (Food-Catalog-Schicht) | dauerhaft, deterministisch, profilunabhängig | Lebensmittelgruppen-Klassifikation, Fettsäureprofile (siehe Hinweis unten)  |
| Nutzer-Korrekturen                    | Journal                        | dauerhaft, Teil der Fakten-Historie          | Manuell angepasste Menge, korrigierte Zuordnung                             |
| Gruppierungsmetadaten                 | Journal                        | dauerhaft, profilunabhängig                  | `groupId`/`groupLabel` aus P1-003C (composite-dish)                         |
| Zielwerte/Referenzbereiche            | Evaluation Engine              | profilabhängig, austauschbar                 | Kalorienziel, Makro-Korridor, Cholesterin-Grenzwert                         |
| Bewertungen/Scores                    | Evaluation Engine              | abgeleitet, jederzeit neu berechenbar        | "Tag im Zielkorridor", Ampel-Status                                         |
| Insights/Hinweise                     | Evaluation Engine              | abgeleitet, profilabhängig                   | "Zu wenig Ballaststoffe für Cholesterin-Fokus"                              |
| Fortschrittsverlauf ggü. Ziel         | Evaluation Engine              | abgeleitet aus Journal + aktivem Profile     | Trendlinie Gewicht vs. Kalorienbilanz                                       |

Faustregel: **Wenn ein Datenpunkt beim Löschen/Wechsel des Evaluation Profiles verschwinden
darf, gehört er zur Evaluation Engine. Wenn er das nicht darf, gehört er zum Journal.**
Alles, was zur Evaluation Engine gehört, muss aus Journaldaten **neu berechenbar** sein —
es darf keine Evaluation-Daten geben, die nicht aus dem Journal plus aktivem Profile
reproduzierbar wären.

**Hinweis zu lebensmittel-intrinsischen Zusatzdaten (Empfehlung aus Review R1):** Daten wie
Lebensmittelgruppen-Klassifikation oder Fettsäureprofile sind eine **Eigenschaft des
Lebensmittels**, keine Bewertung — sie entstehen deterministisch aus der Food-Auflösung,
genau wie Makros/Portionen heute schon aus BLS/OFF/USDA. Sie gehören deshalb zur
deterministischen Food-Catalog-/Resolver-Schicht des Journals, **nicht** zur Evaluation
Engine, auch wenn zunächst nur ein einzelnes Profile (z. B. Mediterranean) sie benötigt.
Jedes Profile, das eine solche Eigenschaft braucht, liest sie einfach mit; Profile, die sie
nicht brauchen, ignorieren sie — die Journal-Neutralität bleibt gewahrt, weil die Daten
unabhängig vom aktiven Profile immer gleich und immer vorhanden sind (wo auflösbar), statt
nur bei aktivem Profile berechnet zu werden.

---

## 4. Evaluation Profile — Konzeptvertrag

Jedes Evaluation Profile folgt konzeptionell demselben Vertrag (kein Code, nur
Verantwortlichkeiten). Der Vertrag ist bewusst als strikte Ein-/Ausgabe-Formel gefasst
(Empfehlung aus Review R1), damit "datengetrieben, kein eigener Speicher" nicht nur Geist,
sondern explizite Regel ist:

```text
Journal + Benutzerprofil + Profileinstellungen
                    │
                    ▼
Bewertung + Insights + Warnungen + Empfehlungen + Zielerreichung
```

**Eingaben, die ein Profile erhalten darf:**

- Journaldaten des betrachteten Zeitraums (nur lesend)
- Benutzerprofil-Basisdaten, sofern relevant (z. B. Gewicht, Aktivitätslevel für
  Kalorienbedarf — bereits vorhanden über `MetabolismCalculator`/`GoalsUseCases`)
- Profileinstellungen: die aktive Regelauswahl plus deren Parameter (z. B.
  Ziel-Cholesterin-Obergrenze für eine "Cholesterin niedrig"-Regel, eigene Makro-Ranges bei
  einem Custom Profile)

**Ausgaben, die ein Profile liefern muss:**

- Bewertung (z. B. Ampel-/Fortschrittsstatus für Dashboard-Anzeige)
- Insights (kurz, nachvollziehbar, keine "stille" Bewertung ohne erklärbare Basis —
  konsistent mit dem bestehenden Determinismus-Prinzip)
- Warnungen
- Empfehlungen
- Zielerreichung (Ziel-Fortschritt für Goals-Anzeige)

**Was ein Profile niemals darf:**

- Journaldaten schreiben, löschen oder umformen
- **Einen eigenen Datenspeicher außerhalb des Journals führen** — kein Profil-eigener
  Cache, keine Parallel-Datenbank, keine Zwischenspeicherung, die zur Nebenwahrheit werden
  könnte. Jede Ausgabe muss bei jeder Anfrage erneut aus der obigen Formel berechenbar sein.
- Voraussetzungen an das Erfassungsformat stellen (z. B. "Nutzer muss X anders eingeben,
  damit dieses Profile funktioniert") — Journal bleibt für alle Profile identisch nutzbar
- Andere Profile in ihrer Verfügbarkeit oder ihren Ergebnissen beeinflussen

**Profil-Metadaten (konzeptionell, keine Schema-Festlegung):**

- Eindeutige Kennung und Name
- Typ: Preset (kuratiert) oder Custom (nutzerkomponiert)
- Zusammensetzung: welche Regeln dieses Profile aktiviert (bei Presets kuratiert vorgegeben,
  bei Custom Profiles vom Nutzer gewählt)
- Zielgruppenbeschreibung/Motivation (aus Founding Brief Abschnitt 6 abgeleitet)
- Reifegrad (z. B. "Kandidat", "MVP", "vollständig")

### 4a. Regel — Konzeptvertrag

Die **Regel** ist die atomare, wiederverwendbare Bewertungseinheit — nicht das Profile. Ein
Profile ist ein benanntes Bündel von Regeln, kein eigener Algorithmus. Jede Regel:

- hat eine eindeutige Kennung, einen Namen und eine kurze, nachvollziehbare
  Bewertungslogik-Beschreibung (z. B. "Protein hoch": bewertet Tagesprotein gegen einen
  Zielkorridor)
- deklariert ihren Datenbedarf über die Journal-Basisdaten hinaus, sofern vorhanden (z. B.
  Ballaststoffdaten für eine "Netto-Carbs"-Regel) — dieser Datenbedarf wird, falls
  lebensmittel-intrinsisch, in der Food-Catalog-Schicht gedeckt (siehe Abschnitt 3), nicht
  von der Regel selbst gespeichert
- ist unabhängig von jedem konkreten Profile nutzbar und kann in mehreren Preset- oder
  Custom-Profilen gleichzeitig vorkommen (z. B. kann "Zucker niedrig" sowohl in einem
  Cholesterol-Focus-Preset als auch in einem Custom Profile stecken)
- folgt demselben Statelessness-Vertrag wie ein Profile (Abschnitt 4): rein lesend,
  reproduzierbar, kein eigener Speicher

---

## 5. Kandidaten-Evaluation-Profiles

Diese Liste ist der initiale, bewusst kleine Kandidatensatz aus dem Founding Brief,
übersetzt in Preset-Profile (kuratierte Regel-Bündel, keine eigenen Algorithmen — siehe
Abschnitt 4/4a). Sie ist **nicht** final und **nicht** priorisiert für die
Umsetzungsreihenfolge — diese Priorisierung ist Teil der späteren Tier-1-Zerlegung.

### Evidence-based Standard (Preset)

- **Motivation (Founding Brief 6.1):** "Ich möchte mich gesünder ernähren."
- **Fokus:** Ausgewogenheit gemäß anerkannten Referenzwerten (z. B. DACH-Referenzwerte),
  keine aggressive Kalorienrestriktion.
- **Rolle:** Dient als **Default-Profile** — neutralste Bewertung, sinnvoll auch als
  Fallback, wenn (noch) kein spezifisches Profile gewählt wurde.
- **Zusätzlicher Datenbedarf:** Keiner über Journal-Basisdaten hinaus.

### Weight Loss (Preset)

- **Motivation (Founding Brief 6.2):** "Ich möchte Gewicht verlieren."
- **Fokus:** Kaloriendefizit, Proteinerhalt zum Muskelschutz, Sättigungsaspekte.
- **Zusätzlicher Datenbedarf:** Zielgewicht/-tempo, ggf. Aktivitätslevel (bereits über
  bestehenden `MetabolismCalculator` verfügbar).

### Muscle Gain (Preset)

- **Motivation (Founding Brief 6.3):** "Ich möchte Muskeln aufbauen."
- **Fokus:** Kalorienüberschuss, Proteinverteilung über den Tag, nicht nur Tagessumme.
- **Zusätzlicher Datenbedarf:** Trainingsbezug/-frequenz (optional, spätere Ausbaustufe).

### Low Carb (Preset)

- **Motivation (Founding Brief 6.5):** "Ich folge einer bestimmten Ernährungsweise."
- **Fokus:** Kohlenhydratlimits, ggf. Netto-Kohlenhydrate.
- **Zusätzlicher Datenbedarf:** Ballaststoffdaten für Netto-Carb-Berechnung (Food-Catalog-
  Schicht, siehe Abschnitt 3) — abhängig von Datenqualität der Quellen (BLS/OFF/USDA),
  siehe offene Frage in Abschnitt 10.

### Mediterranean (Preset)

- **Motivation (Founding Brief 6.5):** "Ich folge einer bestimmten Ernährungsweise."
- **Fokus:** Lebensmittelgruppen-Qualität (Gemüse-/Fischanteil, Fettqualität) statt reiner
  Makro-Zielwerte.
- **Zusätzlicher Datenbedarf:** Lebensmittelgruppen-Klassifikation pro Lebensmittel
  (Food-Catalog-Schicht, siehe Abschnitt 3 — **nicht** profilspezifisch am Journal-Eintrag) —
  existiert aktuell nicht und wäre ein eigener Vorlauf-Task (nicht Teil dieses Dokuments).

### Cholesterol Focus (Preset)

- **Motivation (Founding Brief 6.4):** "Ich möchte meine Blutwerte verbessern."
- **Fokus:** Gesättigte Fette, Ballaststoffe, ggf. spezifische Lebensmittelgruppen.
- **Zusätzlicher Datenbedarf:** Detailliertere Fettsäure-/Ballaststoffdaten (Food-Catalog-
  Schicht, siehe Abschnitt 3) als aktuell durchgängig verfügbar.
- **Besonderheit:** Höchste Sorgfaltsanforderung an Nachvollziehbarkeit; explizit **kein**
  Ersatz für ärztliche Beratung — siehe offene Frage in Abschnitt 10.

### Custom Profile (kein Preset, sondern der allgemeine Mechanismus)

- **Motivation (Founding Brief 6.6):** "Ich habe meine eigenen Ziele."
- **Charakter:** Kein siebtes Preset, sondern der **Normalfall der Architektur**: eine frei
  vom Nutzer komponierte Regelauswahl (z. B. Protein hoch + Zucker niedrig + Salz niedrig +
  Mediterrane Gewichtung + Kalorien egal). Strukturell identisch zu einem Preset (Abschnitt
  4), nur nutzerkomponiert statt kuratiert — löst den in Review R1 identifizierten
  Widerspruch, dass freie Komposition mit festen Modell-Klassen nicht abbildbar war.
- **Zusätzlicher Datenbedarf:** Keiner über Journal-Basisdaten und die von den gewählten
  Regeln jeweils deklarierten Datenbedarfe hinaus; Zielparameter kommen vollständig vom
  Nutzer.

### Zuordnung Motivation ↔ Profile (Empfehlung aus Review R1)

Die Zuordnung ist n:m, nicht 1:1 — eine Motivation kann mehrere Profile/Regeln berühren,
ein Profile kann mehrere Motivationen bedienen:

| Motivation (Founding Brief 6) | Passende Preset-Profile                         |
| ----------------------------- | ----------------------------------------------- |
| 6.1 Gesünder ernähren         | Evidence-based Standard                         |
| 6.2 Gewicht verlieren         | Weight Loss                                     |
| 6.3 Muskeln aufbauen          | Muscle Gain                                     |
| 6.4 Blutwerte verbessern      | Cholesterol Focus, ggf. Low-Carb-Regeln einzeln |
| 6.5 Bestimmte Ernährungsweise | Low Carb, Mediterranean                         |
| 6.6 Eigene Ziele              | Custom Profile (beliebige Regelkombination)     |

---

## 6. Profil-/Regel-unabhängige App-Teile

Diese Bereiche dürfen **niemals** Wissen über ein spezifisches Evaluation Profile oder eine
spezifische Regel enthalten, damit neue Profile/Regeln ergänzt werden können, ohne sie
anzufassen:

- **Journal-Erfassung** (Input-Pipeline, Resolver, Portion Knowledge — der gesamte
  bisherige Tier-1-Resolver-Kern aus P1-001 bis P1-005)
- **Food-Datenquellen** (BLS/OFF/USDA-Anbindung, Kandidaten-Fusion, inkl. künftiger
  lebensmittel-intrinsischer Zusatzdaten wie Lebensmittelgruppen — siehe Abschnitt 3)
- **Saved Meals als Erfassungs-Vorlagen** — eine gespeicherte Mahlzeit ist eine
  Logging-Beschleunigung, kein Bewertungsobjekt; sie muss unabhängig vom aktiven Profile
  identisch funktionieren
- **Journal-Anzeige der reinen Fakten** (was wurde wann gegessen) — unabhängig davon, ob
  überhaupt ein Evaluation Profile aktiv ist

## 7. Profil-abhängige App-Teile

Diese Bereiche lesen Journaldaten **und** das aktive Evaluation Profile (und dessen
Regelsammlung) und werden durch Letzteres bestimmt:

- **Dashboard** — Zusammenfassung/Fortschritt gemäß aktivem Profile
- **Goals** — Zielwerte und Zielfortschritt kommen vom aktiven Profile, nicht aus einem
  festen Schema
- **Insights/Reports** — Ableitungen, die ohne ein Profile keine Bedeutung hätten
- **AI Coach (später)** — konsumiert Profil-Output, trifft aber gemäß bestehendem
  KI-Prinzip (`SSOK.md`) keine stillen Bewertungsentscheidungen selbst

---

## 8. Erweiterbarkeit: Neue Profile und Regeln ohne Änderung des Logging-Kerns

Konzeptionelle Anforderungen an künftige Erweiterbarkeit (keine Implementierungsdetails):

1. Eine neue Regel wird **registriert** — die atomare, wiederverwendbare Einheit (siehe
   Abschnitt 4a). Ein neues Profile wird als Kombination bestehender (oder neuer) Regeln
   registriert. Beides ohne Eingriff in Journal-/Resolver-Logik.
2. Weder eine neue Regel noch ein neues Profile darf eine Änderung an
   Journal-Datenerfassung oder -Speicherung voraussetzen. Falls eine Regel zusätzliche
   Datenqualität benötigt (z. B. Lebensmittelgruppen für eine "Mediterrane
   Gewichtung"-Regel), ist das ein **optionaler Anreicherungs-Task auf der
   deterministischen Food-Catalog-Schicht** (Abschnitt 3), der allen Profilen zugutekommt,
   die diese Regel nutzen — nicht eine profilspezifische Journal-Änderung.
3. Regeln und Profile sind untereinander **unabhängig**: Das Hinzufügen einer neuen Regel
   oder eines neuen Profils darf bestehende Profile nicht verändern.
4. Ein Wechsel des aktiven Profils muss **rückwirkend** auf bestehende Journaldaten
   anwendbar sein (Neubewertung historischer Tage), ohne erneute Erfassung.
5. Custom Profiles (nutzerkomponierte Regelauswahl) folgen exakt demselben Mechanismus wie
   Preset Profiles — kein separater Codepfad, keine Sonderbehandlung.

---

## 9. Auswirkung auf die vier Tier-1-Platzhalter

Diese Trennung reframt die vier offenen Module wie folgt (weiterhin **keine** Zerlegung in
Tasks — das folgt separat nach Freigabe):

- **Journal** wird zur reinen, profilunabhängigen Erfassungs- und Fakten-Anzeigeschicht.
- **Saved Meals** bleibt profilunabhängige Logging-Beschleunigung, keine Bewertungsfunktion.
- **Dashboard** wird zur Ansicht, die vollständig vom aktiven Evaluation Profile bestimmt
  wird — nicht zu einem festen, generischen Kalorien-/Makro-Screen.
- **Goals** wird zur Zielkonfiguration/-anzeige innerhalb eines Profiles, statt eines
  einzelnen festen Zielschemas.

---

## 10. Offene Fragen (bewusst vertagt)

Diese Fragen werden **nicht** in diesem Dokument entschieden, sondern markieren bewusst
offene Punkte für spätere, gezielte Entscheidungen:

- Kann zu einem Zeitpunkt nur genau ein Evaluation Profile aktiv sein, oder ist mit der
  Regel-Ebene ohnehin nur noch relevant, welche Regeln aktiv sind, statt welches
  benannte Profile (z. B. Weight-Loss-Regeln + Cholesterol-Regeln gleichzeitig)?
- Wie wird der Wechsel des aktiven Profiles in der UX gestaltet (Onboarding-Frage,
  jederzeit änderbar, mehrere gespeicherte Profile)?
- Welche Regeln erfordern zusätzliche Datenqualität, die die bestehenden Quellen
  (BLS/OFF/USDA) aktuell nicht durchgängig liefern (z. B. Lebensmittelgruppen für eine
  Mediterranean-Regel, detaillierte Fettsäuren für eine Cholesterol-Regel)?
- Wie granular sollten Regeln sein (z. B. eine Regel pro Nährstoff-Grenzwert vs. größere
  thematische Bündel)? Das betrifft direkt, wie leicht sich Custom Profiles komponieren
  lassen.
- Wie wird bei medizinisch geprägten Profilen/Regeln (Cholesterol Focus) mit Haftungs- und
  Vertrauensfragen umgegangen (Disclaimer, keine Diagnosefunktion, ärztliche Rücksprache)?
- Werden einzelne Profile Teil eines Freemium-/Monetarisierungsmodells? (Explizit nicht
  Teil des Founding Brief oder dieses Dokuments.)
- Wie wird der spätere AI Coach konkret an Profil-Output angebunden?

---

## 11. Nächste Schritte

1. Freigabe von Founding Brief und dieser Product Bible.
2. Erst danach: Zerlegung von Journal, Saved Meals, Dashboard und Goals in konkrete,
   verifizierbare `ROADMAP.md`-Tasks unter expliziter Berücksichtigung der hier
   festgelegten Journal/Evaluation-Engine-Trennung.
3. Auswahl eines ersten MVP-Profiles (vermutlich Evidence-based Standard als neutraler
   Default) für die erste konkrete Evaluation-Engine-Implementierung — Priorisierung folgt
   in der Tier-1-Zerlegung, nicht hier.
