# Zera (HealthApp) — Umfassender App-Test & Bewertungsbericht

**Datum:** 2026-07-16
**Branch:** `claude/app-testing-evaluation-yogpjt`
**Bezug:** `UT-001` (Practical MVP Validation, Status `todo`) — dieser Bericht ist methodisch
äquivalent zu einer A0-Baseline nach
[`plans/UT-001_PRACTICAL_MVP_VALIDATION_PLAN.md`](../plans/UT-001_PRACTICAL_MVP_VALIDATION_PLAN.md)
und kann als deren Evidenz dienen. Er ändert selbst keinen `ROADMAP.md`-Status (das
Ausrufen/Abschließen von UT-001-Phasen ist eine menschliche Entscheidung).
**Kategorie nach `VERIFY.md`:** Documentation-only (Kategorie 1) — dieser Bericht fügt nur
eine Datei unter `reports/` hinzu; kein Produktcode wurde geändert.

---

## 0. Zusammenfassung (TL;DR)

Die App ist in ihrem Vier-Tab-MVP-Kern (**Protokoll → Ziele → Vorlagen → Auswertung**)
**funktional stabil, konsistent mit den eigenen Governance-/Vision-Dokumenten und für die
definierten Personas 6.1 („gesünder ernähren") und 6.2 („Gewicht verlieren") real nutzbar**.
Der komplette Kernfluss — natürlichsprachliches Erfassen, Zielsetzung über Metabolismus-Profil,
Zielwechsel mit sofortiger Neubewertung (Variante B), Vorlagen, Persistenz — wurde live per
`expo start --web` + Headless-Playwright/Chromium verifiziert und funktioniert ohne einen
einzigen Runtime-/Konsolenfehler der App selbst.

Gleichzeitig gibt es eine klare Liste konkreter Befunde: einen sichtbaren Anzeigefehler
(„= 0" in den Berechnungs-Details), stillschweigend unvollständige Vorlagen-Erstellung
(Stück-basierte Einträge werden ohne Hinweis übersprungen), irreführendes Feedback bei
Teilerfolgen, eine invertierte Aktiv/Inaktiv-Optik im Ziel-Umschalter, Sprachmix
(Deutsch/Englisch) an mehreren Stellen sowie Löschen ohne Bestätigung/Undo. Nichts davon ist
ein Blocker für das geplante Dogfooding (UT-001 Phase B), aber mehrere Punkte sollten vor dem
Test mit einer produktfremden Person (Phase C) behoben werden. Details in Abschnitt 4,
priorisiert in Abschnitt 7.

**Verifikationsstand:** `npm run verify` vollständig grün — 113 Test-Suites / 854 Tests,
Typecheck, ESLint, Prettier.

---

## 1. Testumgebung und Methode

- **Umgebung:** Headless-Linux-Container (Claude Code Remote), kein Android-Emulator/iOS-
  Simulator verfügbar — gleiche Einschränkung wie in `docs/MANUAL_TESTING_GAPS.md` und im
  UT-001-Plan dokumentiert.
- **Methode:** `npm ci --ignore-scripts` (das `supabase`-Paket-postinstall lädt ein
  CLI-Binary von GitHub, das der Umgebungs-Proxy blockiert — identisch zum in `WEB-001`
  dokumentierten Fall), dann `EXPO_OFFLINE=1 npx expo start --web` + Playwright/Chromium
  (1024×900 sowie 375×720). Dieselbe Methode wie die früheren Audits zu `WEB-001`, `DI-007`,
  `DI-008`, `DI-009` und `PR-001`.
- **Supabase:** Für den Boot wurde eine lokale, nicht committete `.env` mit
  Platzhalterwerten angelegt (der `supabaseClient` wirft sonst beim Start) und nach dem Test
  wieder entfernt. Die Edge-Quellen (OFF/USDA) schlagen dadurch kontrolliert fehl; die
  Lebensmittel-Auflösung lief vollständig über die **offline BLS-Static-Quelle** (DACH-first).
  Konsequenz: Alle Resolver-Aussagen in diesem Bericht gelten für den BLS-Pfad; das Verhalten
  der Remote-Quellen (OFF/USDA, User-Aliases, Resolver-Run-Logging) konnte nicht geprüft
  werden.
- **Grenze der Methode (ehrlich benannt, wie im UT-001-Plan):** Web via `react-native-web`
  ist kein echtes Gerät. Touch-Gesten, Keyboard-Verhalten, Safe-Areas, Haptik und natives
  Rendering (iOS/Android) bleiben ungeprüft. Ein Tab-Navigator-Verhalten fiel nur im Web auf
  (alle Screens bleiben im DOM gemountet und gestapelt) — auf nativen Plattformen ist das
  Standardverhalten, für eine spätere echte Web-Unterstützung wäre es relevant.

### Durchgeführte Testabdeckung

| Bereich                                                       | Getestet      | Ergebnis                                                                     |
| ------------------------------------------------------------- | ------------- | ---------------------------------------------------------------------------- |
| Kaltstart, leerer Zustand, Tab-Inventar                       | ✅            | Pass                                                                         |
| Erfassen: Erfolg / Teilerfolg / Unsinnseingabe                | ✅            | Pass mit Befunden (4.3)                                                      |
| Eintrag bearbeiten (Natural-Language-Edit)                    | ✅            | Pass                                                                         |
| Eintrag löschen                                               | ✅            | Pass (kein Confirm — 4.7)                                                    |
| Auto-Merge (Annahme → Gramm-Korrektur) + Undo                 | ✅            | Pass                                                                         |
| Portionsgewicht-fehlt-Flow                                    | ✅            | Befund im Offline-Fall (4.6)                                                 |
| Metabolismus-Profil + BMR/TDEE + Breakdown                    | ✅            | Pass mit Anzeigefehler (4.1)                                                 |
| Zielvorschlag (Balanced/High Protein) + manuell               | ✅ (Balanced) | Pass                                                                         |
| Ziel wählen (GE-008) in beiden Tabs + Cross-Tab-Sync (DI-009) | ✅            | Pass                                                                         |
| Auswertung: Bewertung/Fortschritt/Einordnung/Empfehlungen     | ✅            | Pass                                                                         |
| Profilwechsel = sofortige Neubewertung (Variante B)           | ✅            | Pass                                                                         |
| Vorlagen: erstellen / loggen / umbenennen / löschen           | ✅            | Pass mit Befund (4.2)                                                        |
| Persistenz über Reload und Browser-Neustart                   | ✅            | Pass                                                                         |
| Schmaler Viewport (375 px), horizontaler Overflow             | ✅            | Pass                                                                         |
| Konsolen-/Runtime-Fehler                                      | ✅            | Keine App-Fehler (nur erwartete Netzwerkfehler der Placeholder-Supabase-URL) |
| `npm run verify`                                              | ✅            | 113 Suites / 854 Tests grün                                                  |

---

## 2. Funktionstest im Detail (Ist-Verhalten, live beobachtet)

### 2.1 Kaltstart und Grundzustand

Die App startet auf **Protokoll** (P0-005 ✓). Die Tab-Bar zeigt exakt die vier Tabs
`Protokoll · Ziele · Vorlagen · Auswertung`; die in `PR-001` entfernten Mock-Tabs
(„Ernährung", „Erholung") sind nicht erreichbar und tauchen auch im DOM nicht auf (✓,
PR-001-DoD bestätigt sich weiterhin). Leerzustände sind überall vorhanden und ehrlich
formuliert („Noch keine gespeicherten Einträge für heute.", „Noch keine gespeicherten
Mahlzeiten.", „Bitte zuerst im Ziele-Tab Ziele festlegen.").

### 2.2 Natürlichsprachliches Erfassen (Kernfunktion)

- **„2 Eier und 200g Magerquark"** → zwei Einträge: Eier „2 Stück (120 g)" 164.4 kcal,
  Magerquark „200 g" 132 kcal; Tagesleiste 296 kcal / PRO 38g / CARB 9g / FAT 12g.
  (Identisch zu den 296 kcal des PR-001-Audits — deterministische Reproduzierbarkeit ✓.)
- **Unsinnseingabe** („xyzblorb foo123") → ehrliche Ablehnung: „Zu ungenau — bitte
  Lebensmittel oder Menge genauer angeben." Es wird **nichts geschätzt und nichts
  gespeichert** (Zero-Macro-Blocker ✓, Ehrlichkeitsprinzip ✓).
- **Teilerfolg** („1 Banane und zorbfrucht") → Banane wird gespeichert (76.8 kcal),
  „zorbfrucht" erscheint als „NICHT ERKANNT" ohne Schätzung. Sachlich korrekt — aber das
  Status-Feedback ist irreführend (Befund 4.3).
- **Bearbeiten per Anweisung:** Eintrag antippen → Modal → „nur 100g" → Magerquark wird
  von 200 g/132 kcal auf 100 g/66 kcal korrigiert, Tagessumme passt sich exakt an ✓.
- **Löschen:** sofortige Entfernung, Tagessumme korrekt reduziert (307 → 230 kcal nach
  Löschen der 76.8-kcal-Banane, rundungsbedingt exakt) ✓.
- **Auto-Merge (J-005):** „Haferflocken" (Annahme: 100 g) gefolgt von „80g Haferflocken"
  → ein einziger Eintrag „80 g", sichtbare Notice „Mit vorherigem Eintrag zusammengeführt"
  mit funktionierendem **Rückgängig** (stellt 100 g wieder her) ✓ — exakt das in J-005
  geforderte sichtbare, undoable Verhalten.
  „1 Banane" + „2 Bananen" erzeugen dagegen zwei getrennte Einträge (verschiedene
  Food-Keys durch Singular/Plural). Das ist vertretbar („noch eine Banane gegessen" ist der
  häufigere Fall als „Korrektur"), aber als Randnotiz festgehalten (4.8).

### 2.3 Ziele (Metabolismus-Profil, Zielvorschlag, Ziel wählen)

- Formular (75 kg / 180 cm / 30 J / männlich / moderat) → **BMR 1730 kcal/Tag, TDEE 2682
  kcal/Tag** (Mifflin-St-Jeor korrekt gerechnet: 10·75 + 6.25·180 − 5·30 + 5 = 1730;
  ×1.55 = 2682 ✓). Der aufklappbare Rechenweg („Berechnungs-Details") ist ein echtes
  Transparenz-Plus — mit einem Anzeigefehler (4.1).
- **Balanced-Vorschlag** → 2682 kcal, 168 g Protein, 302 g KH, 89 g Fett, mit Begründungssatz
  („Balanced macro distribution based on TDEE of 2682 kcal/day" — Englisch, siehe 4.4).
- **„Ziel wählen"-Karte (GE-008):** beide Presets erscheinen als „VORGESCHLAGENES ZIEL" mit
  Motivationssatz („Ich möchte mich gesünder ernähren." / „Ich möchte Gewicht verlieren.").
  Die interne Architektursprache („Evaluation Profile", „Preset", „Origin") taucht nirgends
  auf — Product-Bible-§4b-konform ✓ (Wortprüfung über den sichtbaren Text bestätigt).

### 2.4 Auswertung (Evaluation Engine live)

Mit 230 kcal geloggt, Evidence-based Standard aktiv:

> Heutige Bewertung: **Im Zielkorridor** · Kalorien 230 / 2682 (noch 2452) · Protein 26 /
> 168 (noch 142) · KH 5 / 302 · Fett 11 / 89 · Einordnung: „Noch 142 g Protein übrig, um
> das Tagesziel zu erreichen."

Wechsel auf **Weight Loss** (ein Klick):

> Kalorien 230 / **2146** (TDEE × 0.8 = 2146 ✓) · Protein 26 / 161 · Einordnung:
> „Kaloriendefizit von ca. 536 kcal gegenüber dem geschätzten Erhaltungsbedarf (TDEE) —
> ein moderates, nachhaltiges Tempo…" · Empfehlung: „Proteinziel noch nicht erreicht —
> proteinreiche Lebensmittel priorisieren…"

Das ist **Variante B (historische Neubewertung) live**: identische Journal-Fakten, sofort
andere Interpretation, keinerlei Datenmigration. Zurückwechseln reproduziert exakt die
Standard-Werte. Der Zielwechsel im **Ziele-Tab** wird beim Tab-Wechsel von der Auswertung
übernommen (DI-009-Fokus-Reload ✓) und umgekehrt markiert der Ziele-Tab das in der
Auswertung gewählte Ziel als aktiv ✓.

### 2.5 Vorlagen (Saved Meals)

- **Erstellen aus heutigen Einträgen** („Mein Frühstück") → Vorlage erscheint mit
  „1 Zutat · ~66 kcal" — **nur der Magerquark**; die Eier (Stück-Eintrag) wurden
  stillschweigend übersprungen (Befund 4.2).
- **Loggen** → „»Mein Frühstück« zum heutigen Tag hinzugefügt"; der Protokoll-Tab zeigt den
  neuen Eintrag beim Tab-Wechsel sofort (DI-009 ✓). Kein Auto-Merge mit dem vorhandenen
  identischen Magerquark-Eintrag — korrekt, da beide explizite Gramm haben (J-005-Narrowing ✓).
- **Umbenennen** (Stift-Icon → Modal) und **Löschen** (Papierkorb) funktionieren; Löschen
  erfolgt ohne Rückfrage (4.7).

### 2.6 Persistenz

Harter Seiten-Reload und kompletter Browser-Neustart (persistenter Profilordner): Einträge,
Metabolismus-Profil, Ziele, aktives Ziel (Evaluation Profile) und Vorlagen bleiben vollständig
erhalten (868 kcal vor/nach Reload identisch). „Value Before Account" (UX-Prinzip 3.3) ist
damit faktisch belegt: Der gesamte Kern funktioniert ohne Konto, rein lokal ✓.

### 2.7 Responsivität

Bei 375 px Breite: kein horizontaler Overflow, saubere Zeilenumbrüche, Tab-Bar und
Summary-Leiste intakt, Auswertungstexte umbrechen korrekt. Bei 1024 px wirken die Screens
sehr leer (einspaltiges Mobile-Layout auf voller Breite) — für ein Mobile-first-MVP
akzeptabel, für eine echte Web-Unterstützung (bewusst offene WEB-001-Frage) nicht.

---

## 3. Soll-Ist-Vergleich mit den Repo-Dokumenten

### 3.1 Vision & Product Bible (Founding Brief, `accepted`; Product Bible, `accepted`)

| Vorgabe                                                        | Ist-Zustand                                                                                                                                                                     | Urteil                                                                                                                                                                  |
| -------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Prinzip 0:** Kein Profile verändert jemals Fakten            | Profilwechsel ändert ausschließlich Zielwerte/Interpretation; Journal-Zeilen (kcal, Gramm) bleiben byte-identisch (live geprüft)                                                | ✅ erfüllt                                                                                                                                                              |
| **Drei Schichten:** Food Catalog → Journal → Evaluation Engine | Im Code sauber getrennt: Resolver/BLS (Catalog), `FoodEntry`+`foodCatalogRef` (Journal), Rules/Profiles/Registry (Evaluation). Journal-Anzeige enthält keinerlei Bewertung      | ✅ erfüllt                                                                                                                                                              |
| **Variante B:** jede Bewertung jederzeit neu berechnet         | Live bestätigt (2.4); `GetActiveEvaluationOutputUseCase` ist stateless, kein Bewertungs-Cache                                                                                   | ✅ erfüllt                                                                                                                                                              |
| **§4b:** „Profil/Preset/Origin" nie in der Oberfläche          | „Ziel wählen", „Vorgeschlagenes Ziel" — kein Leak. **Aber:** „Metabolismus-Profil", „Profil speichern", „Ziele & Profil" verwenden das Wort „Profil" für das Körperdaten-Profil | ⚠️ formal erfüllt (§4b meint Evaluation Profiles), aber begrifflich riskant: derselbe Nutzer sieht „Profil" jetzt in anderer Bedeutung. Empfehlung: „Körperdaten" o. ä. |
| **Journal profilunabhängig (§6/§7)**                           | JournalScreen zeigt reine Fakten; Fortschritt lebt ausschließlich in der Auswertung (GE-007 umgesetzt)                                                                          | ✅ erfüllt                                                                                                                                                              |
| **Saved Meals = reine Erfassungs-Vorlagen (§6)**               | Vorlagen zeigen nur Name/Zutatenzahl/~kcal, keine Bewertung                                                                                                                     | ✅ erfüllt                                                                                                                                                              |
| **Regeln als atomare Einheiten (§4a)**                         | `CalorieMacroCorridorRule`, `ProteinPreservingDeficitRule` — stateless, deklarativ, in Profilen gebündelt                                                                       | ✅ erfüllt (2 Regeln, 2 Preset-Profile — kleiner, aber vertragskonformer Anfang)                                                                                        |
| **Zielgruppen-Presets (§5)**                                   | Nur „Evidence-based Standard" + „Weight Loss" implementiert; Muscle Gain, Low Carb, Mediterranean, Cholesterol, User-Profile fehlen                                             | ⚠️ planmäßig unvollständig (Roadmap sieht das so vor), siehe Persona-Analyse                                                                                            |
| **Keine Modell-/Provider-Namen in Domain/Application**         | Stichproben + `FakeAiFoodMapper`/`FakeAiMealParser` als neutrale Ports                                                                                                          | ✅ erfüllt                                                                                                                                                              |

### 3.2 SSOK.md Product Principles / README Input-Philosophie

| Prinzip                                                  | Befund                                                                                                                                                     | Urteil                                                                                  |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| „Minimize user input friction at all costs"              | Ein Textfeld, Enter, fertig. Kein Pflicht-Onboarding, kein Konto, keine Pflichtfelder                                                                      | ✅ stark umgesetzt                                                                      |
| „Natural language is the primary input method"           | Einziger Erfassungsweg ist das NL-Feld                                                                                                                     | ✅                                                                                      |
| „Approximation acceptable, correction afterwards"        | Stück-Annahmen (Ei 60 g, Banane 120 g) + Edit-Modal + Auto-Merge-Korrektur + Undo                                                                          | ✅                                                                                      |
| „System should feel instant and effortless"              | BLS-Treffer fühlen sich schnell an (~1–2 s). **Aber:** Bei unaufgelösten Items wartet die UI die Edge-Timeouts ab (offline ~5 s+, „LOGGING MEAL…"-Spinner) | ⚠️ im Offline-/Fehlerfall nicht „instant"; auf echter Hardware mit Netz zu verifizieren |
| Deterministik: „AI ersetzt keine deterministische Logik" | Resolver rein deterministisch (BLS/Aliases/Portion-Hints); AI-Mapper sind Fakes/eng begrenzte Ports                                                        | ✅                                                                                      |

### 3.3 ROADMAP.md (Task-Stände vs. Realität)

Stichprobenartige Verifikation der als `done` markierten Kern-Tasks gegen das Live-Verhalten:

- **PR-001** (Mock-Tabs entfernt): bestätigt ✅
- **GE-008** („Ziel wählen"): bestätigt ✅ (inkl. §4b-Wortprüfung)
- **DI-002/DI-003/DI-007** (Evaluation Summary + Rule-Insights): bestätigt ✅ (Sektionen
  erscheinen nur wenn nicht leer; Reihenfolge Bewertung → Fortschritt → Einordnung →
  Empfehlungen stimmt)
- **DI-008** (expliziter Loading-State): „Auswertung wird geladen…" beobachtet ✅
- **DI-009** (Cross-Tab-Freshness): in beide Richtungen bestätigt ✅
- **J-005** (sichtbarer, undoable Auto-Merge): bestätigt ✅
- **SM-001–SM-006**: CRUD bestätigt ✅, mit dem Transparenz-Befund 4.2
- **WEB-001** (Expo Web bootet auf sauberem `npm ci`): bestätigt ✅ (inkl. der dort
  dokumentierten `--ignore-scripts`-Notwendigkeit in dieser Sandbox)

Die Selbstauskunft der Roadmap ist damit in allen geprüften Punkten **ehrlich** — die
`done`-Markierungen decken sich mit dem beobachteten Verhalten. Das ist bemerkenswert
diszipliniert für ein Repo dieser Größe.

**Nächster offener Schritt laut Roadmap ist folgerichtig UT-001** — der Stand der Codebasis
(kohärente vier Tabs, grüne Suite, keine bekannten Blocker) deckt sich mit dieser
Priorisierung.

### 3.4 Governance-Beobachtungen am Rande

- `docs/MANUAL_TESTING_GAPS.md` wird tatsächlich gepflegt und die Einträge decken sich mit
  der Historie — das bindende Gap-Log funktioniert in der Praxis.
- Der Governance-Apparat (SSOK/AGENTS/VERIFY/`.governance/` + Ralph-Loop) ist für ein
  Ein-Personen-MVP außergewöhnlich schwergewichtig. Er erfüllt seinen Zweck (siehe ehrliche
  Task-Stände), kostet aber sichtbar Kontext: `ROADMAP.md` ist ~310 KB groß, und die
  RALPH-Tasks dominieren die Datei gegenüber den Produkt-Tasks. Eine Aufteilung
  (z. B. Produkt-Roadmap vs. Agenten-/Infra-Roadmap) würde die „Single Source of Knowledge"
  für Menschen wie Agenten schneller lesbar machen — ohne die SSOK-Regel zu verletzen
  (eine Master-Datei kann auf Domänen-Dateien verweisen). Nur eine Beobachtung, keine
  Empfehlung zur sofortigen Umsetzung.
- Der `VoiceScreen` existiert als Route im Stack, ist aber aus keiner UI erreichbar
  (Navigation im JournalScreen auskommentiert) und enthält **hartcodierte Dummy-Werte**
  („1,420 kcal Remaining", englische Texte, simulierte Transkription). Unreachable = kein
  Nutzerschaden (gleiche Logik wie PR-001), aber er sollte perspektivisch denselben Weg
  gehen wie die Mock-Tabs: entweder real machen oder aus dem Stack nehmen.

---

## 4. Befunde (nummeriert, mit Schweregrad nach UT-001-Skala)

Skala: **Blocker** (verhindert Kernnutzung) · **Hoch** (verfälscht Verständnis/Vertrauen) ·
**Mittel** (stört, Workaround existiert) · **Niedrig** (kosmetisch).

### 4.1 „= 0" in den Berechnungs-Details — **Hoch** (Vertrauen)

Die erste Zeile des BMR-Rechenwegs („BMR Formula (Mifflin-St Jeor)") rendert ihr
Platzhalter-`result: 0` als „**= 0**" (live gesehen, Screenshot-Evidenz; Ursache:
`MetabolismCalculator.ts` Schritt `bmr_formula` setzt `result: 0, // Placeholder`, und
`GoalsScreen` rendert `step.result` bedingungslos). Ausgerechnet das Transparenz-Feature
zeigt damit als erstes eine falsch aussehende Zahl — für Persona 6.4 (Blutwerte,
Nachvollziehbarkeit!) besonders schädlich. Fix ist trivial: Formel-Schritte ohne echtes
Ergebnis nicht mit „=" rendern (oder `result` optional machen).

### 4.2 Vorlagen-Erstellung überspringt Stück-Einträge stillschweigend — **Hoch** (Vertrauen/Datenverlust-Gefühl)

„Vorlage aus heutigen Einträgen erstellen" bei einem Tag mit „Eier 2 Stück (120 g)" +
„Magerquark 100 g" erzeugt eine Vorlage mit **nur 1 Zutat (~66 kcal)** — die Eier fehlen,
ohne jeden Hinweis. Ursache: `CreateSavedMealFromDateUseCase` filtert auf
`entry.quantityGrams > 0`; Stück-basierte Einträge führen ihre Gramm aber offenbar nur im
`calcBreakdown` (Anzeige „(120 g)"), nicht in `quantityGrams`. Für Nutzer ist „mein
Frühstück speichern" die naheliegendste Aktion — dass die Hälfte fehlt, merkt man erst
beim nächsten Loggen (falsche Tagessumme) oder nie. Zwei mögliche Fixes: (a) `gramsUsed`
aus dem Breakdown als Fallback verwenden (fachlich korrekt, da eingefroren), oder
(b) mindestens ein sichtbarer Hinweis „N Einträge ohne Gramm-Angabe wurden übersprungen".
Der UI-Text „Keine heutigen Einträge mit Gramm-Angabe gefunden" existiert nur für den
Totalfall (0 Zutaten), nicht für den Teilfall.

### 4.3 Irreführendes Feedback bei Teilerfolg — **Mittel bis Hoch** (Verständnis)

Bei „1 Banane und zorbfrucht" wird die Banane gespeichert, aber die Statuszeile zeigt
**„EINTRAG KONNTE NICHT VERARBEITET WERDEN"** (Fehler-Rot) plus Trust-Message „Zu ungenau —
bitte Lebensmittel oder Menge genauer angeben", und die Eingabe bleibt im Feld stehen.
Die eigens dafür gebaute Teilerfolgs-Botschaft („Teilweise erkannt: Gespeicherte Einträge
wurden übernommen; …") und der Pfad „N gespeichert, M nicht erkannt" greifen hier nicht,
weil das unaufgelöste Item als `blockedEntries > 0` in den Fehlerzweig läuft
(`JournalScreen.submitRawInput`: der `blockedCount > 0`-Check kommt vor dem
Teilerfolgs-Check). Der Nutzer, der die Liste darunter nicht genau liest, glaubt, nichts
sei gespeichert — und loggt die Banane ggf. doppelt. Journal-UI-Truthfulness ist als
Testdatei (`journalUITruthfulness.test.ts`) vorhanden — dieser konkrete Kombinationsfall
(blocked + persisted gemischt) fehlt darin offenbar.

### 4.4 Sprachmix Deutsch/Englisch — **Mittel** (Politur, Persona-C-relevant)

Durchgängig deutsche UI, aber: „LOGGING MEAL…", „Balanced"/„High Protein",
„Balanced macro distribution based on TDEE…", „BMR Formula"/„Activity Multiplier"/„Total
Daily Energy Expenditure", Makro-Labels „PRO/CARB/FAT", Einheit „**2 slice**" beim
Portions-Flow (statt „2 Scheiben"), englischer Fallback im (unerreichbaren) VoiceScreen.
Einzeln harmlos, in Summe wirkt es unfertig — genau das, was einer produktfremden
Testperson (UT-001 Phase C) zuerst auffällt.

### 4.5 Invertierte Aktiv-Optik im Auswertungs-Ziel-Umschalter — **Mittel** (Bedienbarkeit)

Im Auswertungs-Tab ist das **aktive** Ziel der ausgegraute, deaktivierte Button
(`disabled` + Surface-Farbe), während das **inaktive** Ziel als kräftiger Terracotta-Button
erscheint. Die visuelle Sprache sagt damit das Gegenteil des Zustands („das Kräftige ist
das Gewählte" wäre die Erwartung). Die „Ziel wählen"-Karte im Ziele-Tab macht es richtig
(aktive Karte farblich hervorgehoben + Rahmen). Der Umschalter sollte der Karten-Logik
folgen — oder schlicht entfallen und nur im Ziele-Tab leben (eine Stelle, eine Wahrheit).

### 4.6 Portionsgewicht-Flow als Sackgasse bei unaufgelöstem Lebensmittel — **Mittel** (im Offline-Fall beobachtet)

„2 Scheiben Gouda" (BLS kennt Gouda nicht; Edge-Quellen offline) erzeugt die Sektion
„Portionsgewicht fehlt" mit „Ich kenne das Stückgewicht für gouda noch nicht. Schätzen?" —
aber **beide Aktions-Buttons sind deaktiviert** (kein `foodIdentityKey`, da unaufgelöst).
Die UI stellt eine Frage und bietet nur tote Buttons als Antwort. Mit erreichbaren
Remote-Quellen würde Gouda vermutlich aufgelöst und der Flow normal funktionieren — der
Zustand „Portion-Prompt für unaufgelöstes Food" sollte aber gar nicht erst gerendert werden
(oder die Buttons durch „zuerst genauer benennen" ersetzt werden). Auf echter Hardware
gegenzuprüfen.

### 4.7 Destruktive Aktionen ohne Bestätigung/Undo — **Mittel**

Journal-Eintrag-Löschen und Vorlagen-Löschen wirken sofort, ohne Rückfrage und ohne Undo
(Undo existiert nur für den Auto-Merge). Auf Touch-Geräten mit direkt nebeneinander
liegenden Icons (Stift/Papierkorb, 44-px-Targets) ist ein Fehl-Tap realistisch. J-003 hat
Soft-Delete/Correction-Log im Datenmodell bereits angelegt — ein „Rückgängig"-Snackbar nach
Löschen wäre damit konsistent und günstig zu haben.

### 4.8 Randnotizen — **Niedrig**

- Singular/Plural („Banane"/„Bananen") erzeugt getrennte Einträge mit getrennten Food-Keys;
  gewollt als „noch eine gegessen", aber der Anzeigename übernimmt die Roheingabe
  inkonsistent (mal „Banane", mal „Bananen" als Titel).
- „Erkannte Einträge"-Sektion (Submit-Echo) bleibt nach Tab-Wechseln/Folge-Submits sichtbar
  stehen und vermischt sich optisch mit „Heutige Einträge" (gleiche Zeilenform, andere
  Bedeutung: Echo vs. persistierte Fakten). Kleinere Trennschärfe (z. B. Ausblenden nach
  Erfolg, dezenter Hintergrund) würde helfen.
- Eintragstitel übernehmen die Roheingabe in Kleinschreibung („eier" im Echo vs. „Eier"
  in der Liste — uneinheitlich).
- Desktop-Breite (≥1024 px): einspaltiges Layout auf voller Breite, sehr viel Leerraum —
  irrelevant solange Web nur interner Verifikationspfad ist (WEB-001-Entscheidung offen).
- Der Metabolismus-„Profil bearbeiten"-Button wirft das Formular in den Neuanlage-Zustand
  zurück (leere Felder statt vorbefüllter Werte) — für schnelle Gewichts-Updates
  (Persona 6.2, wöchentliches Wiegen!) unnötig mühsam.

---

## 5. Bewertung der Oberfläche (UI/UX-Gesamteinschätzung)

**Positiv:**

- Das **Warm-Neutral-Designsystem** (`src/ui/theme.ts`: Off-White, warmes Anthrazit,
  Terracotta-Akzent, tabular-nums für Zahlen) ist auf Protokoll, Vorlagen und Auswertung
  konsequent und wirkt ruhig, eigenständig und „nicht nach Tracking-App" — das passt exakt
  zur Vision („ohne den Aufwand klassischer Tracking-Apps").
- Die Informationshierarchie im Protokoll ist richtig: dominantes Eingabefeld oben
  (die Kernhandlung), Fakten in der Mitte, Tagessumme unten.
- Die Auswertung liest sich wie ein kurzer, verständlicher Text statt wie ein Dashboard
  voller Gauges — Einordnung und Empfehlungen sind konkret und in natürlicher Sprache.
  Das ist die richtige Übersetzung von „Bewertung ist das eigentliche Produkt".
- Ehrliche Kommunikation überall: keine erfundenen Schätzwerte, keine Fake-Prozente —
  im Einklang mit den UX-Principles-Guards (Never-Start-at-Zero geschärfte Fassung).

**Negativ:**

- **Zwei Designsysteme leben parallel:** `GoalsScreen` nutzt das alte Blau/Weiß-Kartendesign
  (`#4a90e2`, weiße Cards mit Drop-Shadow, eigenes StyleSheet) statt `tokens`/`AppText`/
  `ScreenContainer`. Der Bruch ist beim Tab-Wechsel deutlich sichtbar (Screenshot-Evidenz)
  — dieselbe Klasse von Inkonsistenz, die PR-001 bei den Mock-Tabs als Vertrauensrisiko
  eingestuft hat, nur ohne die falschen Daten. Auch die Tab-Bar (aktiv-Blau `#4a90e2`)
  gehört zum alten System, während Inhalte Terracotta akzentuieren — zwei konkurrierende
  Akzentfarben in einem Screen.
- Die unter 4.3/4.5 beschriebenen Feedback-/Affordanz-Schwächen.
- Kein Datumszugriff: Es gibt ausschließlich „heute". Gestern nachtragen oder gestern
  ansehen ist unmöglich (kein Datums-Navigator), obwohl `GetCalendarMonthSummaryUseCase`
  im Backend existiert und getestet ist. Für tägliches Dogfooding ist das die vermutlich
  erste real vermisste Funktion („abends das Mittagessen von gestern nachtragen").

**Gesamturteil UI:** Für ein MVP klar überdurchschnittlich in Konzept und Ton; die größte
Einzelmaßnahme mit dem besten Aufwand/Wirkung-Verhältnis ist die Migration des GoalsScreen
auf das Token-Designsystem.

---

## 6. Persona-Bewertung (Founding Brief Abschnitt 6)

Die sechs Zielgruppen sind als **Motivationen** definiert; Presets laut Product Bible §5.

| #   | Motivation                                         | Abdeckung heute                                                                                                                          | Einschätzung                                                                                                                                                                                                          |
| --- | -------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 6.1 | „Gesünder ernähren"                                | **Gut.** Evidence-based Standard als Default, verständliche Korridor-Bewertung, ehrliche Einordnung                                      | Kern-Persona des MVP; nutzbar. Es fehlt v. a. Historie/Trend (nur „heute" sichtbar) — nach einer Woche Nutzung gibt es nichts zum Zurückschauen, was die Bindung („Grund, nach Woche 2 zu bleiben") direkt untergräbt |
| 6.2 | „Gewicht verlieren"                                | **Gut.** Weight-Loss-Preset mit sinnvollem, nicht-aggressivem Defizit (−20 % TDEE), Proteinerhalt-Empfehlungen                           | Zweite real bediente Persona. Schwächen: Gewicht aktualisieren ist mühsam (4.8, Formular-Reset), kein Verlaufs-/Gewichts-Tracking, keine Sättigungs-Perspektive (laut §5 vorgesehen)                                  |
| 6.3 | „Muskeln aufbauen"                                 | **Nicht bedient.** Kein Muscle-Gain-Preset; „High Protein"-Makrovorschlag existiert, ist aber kein Ziel im Sinne der Engine              | Für diese Persona wirkt die App wie „nur Abnehmen + Standard". Roadmap-konform offen; das Regel-/Profil-System ist nachweislich bereit dafür (Swappability durch GE-004 bewiesen)                                     |
| 6.4 | „Blutwerte verbessern"                             | **Nicht bedient**, und Datenbedarf (Fettsäuren, Ballaststoffe) fehlt im Catalog                                                          | Bewusst vertagt (Product Bible §10, Haftungsfragen). Richtig so — aber Befund 4.1 („= 0") zeigt, wie hoch die Transparenz-Messlatte für diese Persona liegen wird                                                     |
| 6.5 | „Bestimmte Ernährungsweise" (Low Carb, Mediterran) | **Nicht bedient**; Mediterranean bräuchte Lebensmittelgruppen-Klassifikation (existiert nicht)                                           | Roadmap-konform offen. Low Carb wäre mit vorhandenen Makro-Daten der günstigste nächste Preset-Kandidat                                                                                                               |
| 6.6 | „Eigene Ziele"                                     | **Teilweise.** Manuelle Kalorien-/Makro-Ziele existieren (im Ziele-Tab), aber kein komponierbares User-Profile (Regeln frei kombinieren) | Die manuelle Zielsetzung deckt den häufigsten Fall („eigene Zahlen") ab; die eigentliche §5-Vision (Regel-Komposition) fehlt planmäßig                                                                                |

**Persona-Fazit:** Das MVP bedient bewusst 2 von 6 Motivationen vollständig — eine legitime,
in der Roadmap so angelegte Entscheidung, und die Architektur hat den Beweis erbracht, dass
weitere Profile reine Additionen sind (GE-004-Swappability, live per Profilwechsel
verifiziert). Die kritischste Lücke ist personas-übergreifend dieselbe und keine
Profil-Lücke: **Es gibt keinerlei Blick in die Vergangenheit** (kein gestern, keine Woche,
kein Trend). Die Vision begründet die Bindung explizit über personalisierte Bewertung —
aber Bewertung nur für „heute" trägt keine zwei Wochen. Backend-Bausteine
(`GetCalendarMonthSummaryUseCase`, Variante B als „Wie wäre mein Monat unter Ziel X gewesen")
liegen bereit.

---

## 7. Priorisierte Empfehlungen

**Vor Phase C von UT-001 (Test mit produktfremder Person) beheben:**

1. **4.1** „= 0"-Zeile in Berechnungs-Details (trivialer Fix, hoher Vertrauensschaden).
2. **4.3** Teilerfolgs-Feedback korrigieren (blocked+persisted-Kombination in
   `buildTrustMessage`/Statuszweig; Testfall in `journalUITruthfulness` ergänzen).
3. **4.2** Vorlagen: Stück-Einträge übernehmen (gramsUsed-Fallback) oder Übersprungenes
   sichtbar machen.
4. **4.4** Sprachmix vereinheitlichen (reine Textänderungen).

**Mittelfristig (nach Dogfooding-Erkenntnissen priorisieren):**

5. **GoalsScreen** auf das Token-Designsystem migrieren (größter sichtbarer Qualitätssprung).
6. **4.5** Aktiv/Inaktiv-Affordanz im Auswertungs-Umschalter drehen oder Umschalter
   konsolidieren.
7. **4.7** Undo/Bestätigung für Löschaktionen (J-003-Infrastruktur nutzen).
8. **Tages-Navigation/Historie** — aus Persona-Sicht die wichtigste fehlende Produktfähigkeit
   (siehe 6.); sollte als eigener ROADMAP-Task geschnitten werden, bevor weitere Presets
   gebaut werden.
9. **4.6** Portion-Prompt für unaufgelöste Lebensmittel unterdrücken; VoiceScreen-Route
   entscheiden (real machen oder entfernen).

Gemäß UT-001-DoD sollte jeder Blocker-/Hoch-Befund vor Fix-Beginn eine eigene
`ROADMAP.md`-Task-ID bekommen — dieser Bericht legt bewusst keine IDs an.

---

## 8. Verifikationsnachweis (Handoff-Pflichtangaben)

- **Geänderte Dateien:** nur diese Datei (`reports/APP_TESTING_EVALUATION_2026-07-16_REPORT.md`).
- **Ausgeführte Checks:** `npm ci --ignore-scripts` (Wiederherstellung fehlender lokaler
  Dependencies, gemäß CLINE-OPS-003 zulässig; `package.json`/`package-lock.json` unverändert);
  `npm run verify` → **pass** (Typecheck, ESLint, Prettier, Jest: 113 Suites / 854 Tests);
  Live-Verifikation `expo start --web` + Playwright/Chromium (Desktop- und Mobile-Viewport,
  vollständiger Kernfluss, Screenshots); Readback-Checks für Docs-only-Kategorie
  (`git status --short`, `git diff --stat`, `git diff --name-only`) vor Commit.
- **Bekannte Rest-Risiken:** Remote-Resolver-Pfad (OFF/USDA/Aliases) ungeprüft (kein echtes
  Supabase-Projekt in dieser Umgebung); natives Rendering/Touch ungeprüft (headless);
  `verify:edge`/`verify:schema` nicht ausführbar (keine Credentials — keine Edge-Änderungen
  in dieser Session, daher laut `VERIFY.md` nicht erforderlich).
- **Follow-ups:** Abschnitt 7; keine ROADMAP-Statusänderungen vorgenommen (Begründung im Kopf
  dieses Berichts).
