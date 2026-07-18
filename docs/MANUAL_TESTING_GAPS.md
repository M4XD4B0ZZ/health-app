# Manual Testing Gaps (Headless-Agent-Einschränkungen)

Dieses Dokument protokolliert Fälle, in denen ein Agent (Claude Code o.ä.) eine Änderung
**nicht visuell** in einem Browser/Simulator/Gerät testen konnte, weil die Ausführungsumgebung
headless ist (kein React Native/Expo-Runtime, kein Android Emulator, kein iOS Simulator).

Ziel: Du siehst auf einen Blick, welche Änderungen nur durch Typecheck/Lint/Unit-Tests
verifiziert wurden und wo noch ein **manueller App-Test in Expo** aussteht.

> **Status:** Diese Datei wird automatisch gepflegt. Jede Agent-Session (Claude Code, Roo,
> Cline, OpenCode, Codex) ist gemäß der bindenden Regel in [`AGENTS.md`](../AGENTS.md#manual-ui-testing-gap-log-binding)
> und [`VERIFY.md`](../VERIFY.md#ui-relevant-changes--manual-testing-gap-log-binding) verpflichtet,
> hier einen Eintrag zu ergänzen, sobald UI-relevante Dateien geändert wurden und keine echte
> visuelle Prüfung in Expo/Simulator/Gerät möglich war. Du musst dafür nichts tun — kontrolliere
> nach dem Urlaub einfach diese Datei von oben nach unten.
>
> Jeder Eintrag hat ein **Status**-Feld: `⏳ offen` (noch nicht manuell getestet) oder
> `✅ geprüft` (von dir manuell verifiziert). Setze den Status manuell auf `✅ geprüft`,
> sobald du einen Punkt abgehakt hast — Agents setzen ihn nicht selbst auf `✅`.

---

## Warum das passiert

Die Agent-Umgebung ist ein Linux-Container ohne:

- Android Emulator / iOS Simulator
- Expo Go / Expo Dev Client Runtime
- Browser mit funktionierendem React-Native-Web-Rendering für interaktive UI-Prüfung

Verifikation erfolgt dort stattdessen über:

- `npm run typecheck`
- `npm run lint`
- `npm run test` (Jest, inkl. ggf. End-to-End-Logikpfade ohne echtes UI-Rendering)
- `npm run verify`

Das deckt **Typsicherheit, Logikkorrektheit und Regressionen in getesteten Pfaden** ab —
aber **nicht** Layout, Touch-Interaktion, Animationen, Keyboard-Verhalten, Plattform-spezifisches
Rendering (iOS vs. Android vs. Web) oder echtes Gerätefeedback (Haptics, Permissions-Dialoge etc.).

---

## Wie neue Einträge hinzugefügt werden

Wenn eine Session/PR mit einem Hinweis wie _"Ich konnte die UI nicht visuell testen"_ endet,
trage einen neuen Eintrag unten ein (neueste zuerst) und fülle die Checkliste aus dem passenden
Abschnitt in [Manuelle Test-Checkliste](#manuelle-test-checkliste) entsprechend.

---

## Log

### 2026-07-18 — SM-008: Saved-Meal-Zusammensetzungs-Transparenz (SavedMealsScreen)

- **Status:** ⏳ offen (Gruppierungs-/Aggregations-Logik deterministisch per Unit-Tests
  verifiziert; die eigentliche Karten-Darstellung + das aufklappbare Detail sind UI-relevant und
  konnten in dieser headless-Umgebung nicht visuell in Expo geprüft werden.)
- **Branch/PR:** `claude/sm-008-saved-meal-transparency`
- **Betroffene Bereiche:**
  - `src/presentation/features/savedMeals/savedMealsDisplay.ts` (neuer reiner Display-Helper
    `buildSavedMealComposition` + `formatSavedMealSummary`/`formatSavedMealPreview`) — gruppiert
    gespeicherte Items nach kanonischer Identität (`foodCatalogRef.source:sourceId`, J-009-Prinzip),
    aggregiert Gramm/Kalorien und rendert die Mengen durch **Wiederverwendung** von
    `buildGroupQuantitySubtitle` (J-010/J-011: „Stück" nur bei sauber teilbarer bekannter Portion,
    sonst grammbasiert; explizite Gramm leiten nie eine Stückzahl zurück).
  - `src/presentation/features/savedMeals/SavedMealsScreen.tsx` — ersetzt die alte Zeile
    `{template.items.length} Zutat{en}` durch eine aufklappbare Karten-Region
    (`TouchableOpacity`, `accessibilityRole="button"`, `accessibilityState.expanded`): Summary
    („1 Lebensmittel · ~601 kcal") + einzeilige Vorschau, aufgeklappt eine Pro-Lebensmittel-Liste
    (`Name · Menge · ~kcal`). Portions-Hints werden pro Identität per `useEffect` aufgelöst
    (piece + slice), analog zur Journal-Stück-Anzeige. „Loggen"/Stift/Papierkorb bleiben in einer
    separaten Aktionszeile — das Inspizieren löst kein Loggen aus.
  - Keine Persistenz-/Replay-/Use-Case-/Resolver-Änderung (rein anzeige-seitig).
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 119 Suiten /
  984 Tests grün). Neue/erweiterte `savedMealsDisplay.test.ts` (13 Fälle): 3 gespeicherte
  Ei-Events → „1 Lebensmittel · ~601 kcal" mit „7 Stück (420 g)" (nie „3 Zutaten"); reine
  Gramm-Lebensmittel ohne Portion bleiben grammbasiert; gemischt sauber/unsauber (60 g + 50 g) →
  „110 g" ohne erfundene Stückzahl; mehrere distinkte Lebensmittel → korrekte Unique-Count +
  First-Member-Reihenfolge; gleiches Label bei unterschiedlicher `foodCatalogRef` bleibt getrennt;
  Items ohne Ref werden nie namensbasiert gemerged; Determinismus; keine Float-Artefakte („0,3 g");
  leeres Template → „0 Lebensmittel".
- **Manuell nachzuholen:** Abschnitte **1 (Smoke)**, **2 (Layout & Rendering — Karten-Summary,
  Vorschau-Truncation, aufgeklappte Detailliste, Chevron ›/⌄, lange DE-Namen ohne Overflow)**,
  **3 (Interaktion — Auf-/Zuklappen per Tap, „Loggen" weiterhin separat auslösbar, TalkBack/
  VoiceOver liest expanded-State)** und **7 (Regressionscheck: Saved-Meals-Liste, Loggen eines
  Saved Meals reproduziert exakte Journal-Werte)**.

### 2026-07-18 — P1-006: Rührei-Eingaben (Scrambled-Egg-Phrasierung)

- **Status:** ⏳ offen (Parser-Logik deterministisch per Unit-Tests + Portions-Auflösung
  verifiziert; kein UI-/Presentation-Layer betroffen — reine Input-Parser-Infra. Eine native
  Vertrauens-Stichprobe der fünf Eingaben bleibt als optionale Bestätigung sinnvoll.)
- **Branch/PR:** `claude/p1-006-scrambled-egg-phrasing`
- **Betroffene Bereiche:** ausschließlich
  `src/features/input/infrastructure/simpleParser.ts` (neuer, gezielter Normalizer
  `parseScrambledEggFromEggs`: „Rührei aus/von <N> Ei(ern)" und „<N> Rühreier/Rührei" → exakt N
  Eier, dieselbe Tupel-Ausgabe wie „N Eier"). Keine Resolver-/Artefakt-/Nährwert-Änderung.
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 119
  Suiten / 975 Tests grün). Neue `scrambledEggPhrasing.test.ts`: alle vier nativen Phrasen +
  Zahlwort/Ziffer + Singular/Plural → genau N Eier ohne erfundene Butter/Öl/Milch; identische
  Parse-Ausgabe wie „N Eier"; `resolvePortionGrams('eier',0,2)=120 g` (1 Ei → 60 g);
  „Rührei aus 2 Eiern mit 10 g Butter" → 2 Eier + 10 g Butter je einmal; Regressionen
  („2 Eier", „ein Ei", „Toast mit Butter", „2 Scheiben Toast mit Butter", bare „Rührei")
  unverändert. Input/Parser/Composite/Resolver-Regressionssuiten (30 Suiten / 292 Tests) grün.
- **Nicht verifiziert (visuell):** eine native App-Session, in der die fünf Phrasen real
  geloggt werden und Anzeigename + Stück/Gramm + kcal in „Heutige Einträge" geprüft werden.
- **Zu testen (native Gegenprüfung):**
  1. „Rührei aus 2 Eiern", „Rührei aus zwei Eiern", „Rührei von zwei Eiern", „2 Rühreier"
     einzeln loggen → jeweils genau **2 Eier** (2 Stück / 120 g, Ei-Nährwerte, kein Fett
     erfunden).
  2. „Rührei aus 2 Eiern mit 10 g Butter" → Eier **und** Butter je genau einmal.
  3. App neu starten → Einträge/Summen bleiben; Gruppen aufklappen → Kinder bleiben
     bearbeitbar/löschbar (J-009/J-013 unverändert).

---

### 2026-07-17 — GE-010: Nährwertspezifische, gemischte Tagesbewertung

- **Status:** ⏳ offen (Domänen-/Kompositionslogik deterministisch per Unit-Tests + End-to-End-
  Profiltests verifiziert; das reine UI-Rendering des primären/sekundären Bewertungstextes konnte
  in der headless Umgebung nicht visuell geprüft werden — kein RN-Render-Harness, wie bei
  DI-002/DI-007/DI-008/DI-010).
- **Branch/PR:** `claude/ge-010-nutrient-specific-assessment-act`
- **Betroffene Bereiche:** Domäne
  `src/features/evaluation/domain/models/EvaluationContract.ts` (+`AssessmentDetail`),
  `application/assessmentDetail.ts` (neu), `rules/dailyProgressToEvaluationOutput.ts`,
  `CalorieMacroCorridorRule.ts`, `ProteinPreservingDeficitRule.ts`, `mergeRuleResults.ts`;
  Präsentation `evaluationSummaryDisplay.ts` (neu `buildAssessmentSummary`, „Zielbereich"-Wording)
  und `EvaluationSummaryScreen.tsx` (rendert Primär-Aussage + Sekundärkontext +
  Screenreader-`accessibilityLabel`; keine Statuslogik im UI).
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 118
  Suiten / 957 Tests grün). Neue Domänen-Szenariotests (leer→no-data, alles im Korridor→on-track,
  nativer Mischfall→mixed/kalorienführend, Kalorien über+Makros unter→mixed, mehrere über→above,
  fehlende Zielwerte→target-unavailable, deterministische Primär-Reihenfolge, Merge) und
  Wording-Tests. Die alten „over"/„on-track"-Assertions wurden auf die korrekten neuen
  Orientierungen migriert.
- **Nicht verifiziert (visuell):** natives Rendering der „Heutige Bewertung"-Sektion (Primärzeile
  - Sekundärzeilen), Screenreader-Ansage des kombinierten Announcements, Layout bei mehreren
    Sekundärzeilen; der `no-data`/`target-unavailable`-Zustand real im Gerät.
- **Zu testen (native Gegenprüfung):**
  A. Ohne Journal-Einträge → „Noch nichts protokolliert" (nicht „Im Zielbereich").
  B. Nativer Mischfall (Kalorien ~1363/2449, Fett ~87/82): Primär „Kalorien unter dem Tagesziel",
  Sekundär u. a. „Fett über dem Zielbereich"; **kein** globales „Über dem Ziel"; alle vier
  Makros bleiben in den Fortschritts-Karten sichtbar.
  C. Zwischen Evidence-based Standard und Weight Loss wechseln.
  D. Bestätigen: Zusammenfassung ändert sich konsistent, Empfehlung widerspricht ihr nicht,
  Neustart ändert die berechnete Einordnung nicht.

---

### 2026-07-17 — DI-010: Einzige Quelle für das aktive Bewertungsziel

- **Status:** ⏳ offen (Logik/Verdrahtung per Typecheck/Lint/Unit-Suite grün; das reine
  UI-Rendering + die Navigation konnten in der headless Umgebung nicht visuell geprüft werden —
  kein RN-Render-Harness im Repo, wie bei DI-002/DI-007/DI-008).
- **Branch/PR:** `claude/di-010-single-evaluation-goal-control`
- **Betroffene Bereiche:**
  `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx` — interaktiver
  Ziel-Umschalter (inkl. der invertierten Aktiv-/Auswählbar-Optik) entfernt; stattdessen
  read-only „Aktives Bewertungsziel" + „Ziel ändern"-Aktion (`TouchableOpacity`,
  `accessibilityRole="button"`, beschreibender `accessibilityLabel`, ≥44 px Touch-Ziel), die per
  `navigation.navigate('Goals')` zum Ziele-Tab wechselt; toter `handleSelectProfile`/
  `switchingProfileId`-State + `PrimaryButton`-Import entfernt; DI-009-Fokus-Reload bleibt.
  `src/presentation/features/goals/GoalsScreen.tsx` — GE-008-Kartentitel jetzt „Bewertungsziel"
  (statt „Ziel wählen") mit klärendem Hilfetext; „Makroverteilung"-Label über den
  Balanced/High-Protein/Manuell-Buttons. Keine Verhaltens-/Formel-/Persistenz-Änderung.
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 117
  Suiten / 937 Tests grün; Evaluation/Goals-Suiten 24 Suiten / 107 Tests grün). Der aktive
  Ziel-Zustand (einzige Quelle `evaluationProfileRegistry` + Persistenz) ist über die
  bestehenden Registry-Tests abgedeckt, von dieser Aufgabe unverändert.
- **Nicht verifiziert (visuell):** natives Layout der read-only Zeile + „Ziel ändern"-Link,
  die tatsächliche Tab-Navigation zum Ziele-Tab, Screenreader-Ansage/Touch-Ziel-Größe des
  Links, das Verschwinden jeglicher invertierten Aktiv-Optik.
- **Zu testen (native Gegenprüfung, exakte Schritte):**
  1. Im Ziele-Tab „Evidence-based Standard" wählen.
  2. Auswertung-Tab öffnen.
  3. Bestätigen: aktives Bewertungsziel wird **read-only** angezeigt (kein zweiter Umschalter,
     keine orange/invertierte Aktiv-Optik).
  4. „Ziel ändern" antippen.
  5. Bestätigen: Navigation zum Ziele-Tab.
  6. „Weight Loss" wählen.
  7. Zurück zur Auswertung.
  8. Bestätigen: „Weight Loss" wird angezeigt (Auswertung aktualisiert bei Fokus).
  9. App neu starten.
  10. Bestätigen: dasselbe Ziel bleibt aktiv.
      Zusätzlich: Makroverteilung (Balanced/High Protein/Manuell) bleibt unabhängig vom
      Bewertungsziel wählbar.

---

### 2026-07-17 — RESOLVER-V2-009: Erreichbarkeit schlichter generischer BLS-Lebensmittel

- **Status:** ⏳ offen (kein UI-/Presentation-Layer betroffen — reine Resolver-/Infra-Logik;
  End-to-End deterministisch über den echten Resolver verifiziert, siehe unten. Eine native
  Vertrauens-Stichprobe der drei Lebensmittel bleibt als optionale Bestätigung sinnvoll.)
- **Branch/PR:** `claude/resolver-v2-009-plain-generic-reachability`
- **Betroffene Bereiche:** ausschließlich
  `src/features/nutrition/infrastructure/catalog/sources/bls/BlsLookupEngine.ts` (drei allgemeine
  Normalisierungs-/Ranking-Regeln: whitespace-insensitiver Exakt-Match, Exakt-Match-Ordnung
  „schlichtes Grundlebensmittel zuerst", Stage-2-Token-über-Includes-Override). **Kein
  Presentation-Layer, keine Artefakt-/Nährwert-/Quellenreihenfolge-Änderung.**
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 117
  Suiten / 937 Tests grün). Neue `BlsPlainGenericReachability.test.ts` prüft **end-to-end über
  `SequentialFoodCatalogResolver` + `DefaultConfidenceEngine`**: `himbeeren → F302100
„Himbeere roh" (43 kcal)`, `haferflocken → C133000 „Hafer Flocken" (348 kcal)`, `magerquark →
M713100 (66 kcal, unverändert)`, `speck → W412000 (746 kcal, unverändert)`. Da die
  Auswahllogik deterministisch ist, ist dieser Resolver-Durchlauf belastbarer als ein einzelner
  Browserlauf.
- **Nicht verifiziert (visuell):** eine native App-Session, in der `100 g Himbeeren`,
  `100 g Haferflocken` und `100 g Magerquark` real geloggt werden und der angezeigte Name +
  kcal in „Heutige Einträge" geprüft wird. Da die App zusätzlich OFF/USDA-Edge-Quellen abfragt
  (netzabhängig, in dieser Sandbox laut J-008-Notiz zeitweise hängend), wurde die volle
  Web-/Native-Runtime nicht befahren.
- **Zu testen:** siehe Checkliste unten, Abschnitt 1 (Smoke-Test). Konkret auf dem nächsten
  Build: `100 g Himbeeren` → ~43 kcal (nicht 275), `100 g Haferflocken` → ~348 kcal (nicht 102),
  `100 g Magerquark` → ~66 kcal (unverändert); `100 g Speck` bleibt wie bisher.

---

### 2026-07-17 — J-013: Absolute, idempotente Journal-Mengenbearbeitung

- **Status:** ⏳ offen (Kernlogik deterministisch per Unit-/Integrationstests gegen die exakte
  Dogfooding-Sequenz verifiziert — siehe unten; die echte Bearbeitungs-UI wurde in dieser
  headless Session nicht visuell/live geprüft).
- **Branch/PR:** `claude/j-013-absolute-idempotent-journal-edit`
- **Betroffene Bereiche:** `src/features/nutrition/domain/portion/PortionParser.ts` und
  `PortionParseResult.ts` (neuer absoluter Count-Intent `count`/`countUnit`; bloße Zahl jetzt
  `ambiguous`/`BARE_NUMBER_NEEDS_UNIT` statt Multiplikator),
  `src/features/nutrition/application/usecases/EditFoodEntryFromNaturalLanguageUseCase.ts`
  (Count → absolute Gramm via `resolvePortionGrams`; Ablehnung ohne Mutation bei bloßer Zahl
  bzw. unbekannter Stückportion; count-basierter `rawInput` für die Anzeige),
  `src/infrastructure/di/container.ts` (`portionKnowledgeService` injiziert),
  `src/presentation/features/journal/JournalScreen.tsx` (Modal zeigt aktuelle Menge, Label
  „Was möchtest du ändern?" statt „Bearbeitungsanweisung", Beispiele, Klärungs-Hinweis der das
  Modal offen hält). Kontext:
  `reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md` (Finding 1).
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 116
  Suiten / 926 Tests grün). Neue Tests reproduzieren die exakte native Sequenz
  `1 → 2 Stück → 3 Stück → 2 Stück` als **absolute** Werte (120 → 180 → 120 g, nie 720),
  Idempotenz bei wiederholter identischer Anweisung, explizite `120 g` als reine Grammanzeige,
  bloße `2` wird ohne Mutation und ohne Correction-Log-Eintrag abgelehnt, sowie Count für ein
  Lebensmittel ohne bekannte Stückportion → Ablehnung ohne Mutation. `PortionParser`-Tests für
  Count-Parsing und Bare-Number-Ablehnung ergänzt. Regressionssuiten (Logging,
  `journalEntryDisplay` J-009/J-010/J-011, `resolvePortionGrams`) unverändert grün.
- **Nicht verifiziert (visuell):** Die echte Bearbeitungs-UI auf Gerät/Web (Modal-Layout, der
  „Aktuell:"-Wert, der Klärungs-Hinweis, die Beispiel-Zeile, Touch-Verhalten) wurde nicht live
  geprüft — die Umgebung ist headless und der Ausgangs-Log eines Eis hängt am OFF/USDA-Resolver-
  Netzwerk (laut J-008-Notiz in dieser Sandbox zeitweise hängend). Die reine Bearbeitungslogik
  ist über die obigen Tests vollständig abgedeckt.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 3 (Interaktion &
  Eingabe). Konkret auf dem nächsten nativen Build: 1 Ei loggen, dann nacheinander „2 Stück",
  „3 Stück", „2 Stück" bearbeiten und bestätigen, dass die Werte exakt 120 g / 180 g / 120 g
  ergeben (nie kumulativ 720); „120 g" bleibt reine Grammanzeige; bloße „2" zeigt den
  Klärungs-Hinweis und ändert nichts; das Modal zeigt die aktuelle Menge und die Beispiele.

---

### 2026-07-17 — J-009: Kanonisch gruppierte Tagesübersicht mit Einzel-Detailzugriff

- **Status:** ⏳ offen (Kernverhalten sehr ausführlich real per Headless-Playwright/Chromium
  gegen `expo start --web` verifiziert — siehe unten; native Bestätigung (Touch-Ziele,
  Screenreader-Ansage der Accessibility-State) steht aus)
- **Branch/PR:** `claude/j-009-canonical-grouping`
- **Betroffene Bereiche:** `src/presentation/features/journal/journalEntryDisplay.ts` —
  `groupJournalEntries` um einen zweiten Pass erweitert, der die nach dem bestehenden
  Composite-Dish-Pass verbleibenden Leaves nach kanonischer Lebensmittelidentität
  (`foodCatalogRef.source:sourceId`) gruppiert, nur bei ≥2 Treffern, positioniert an der
  Stelle des **neuesten** (nicht des ersten) Mitglieds; `JournalEntryGroup` erhielt ein neues
  `groupKind: 'composite' | 'canonical'`-Diskriminatorfeld. Neue reine Hilfsfunktion
  `buildGroupQuantitySubtitle()` aggregiert die Mengen-Unterzeile einer Gruppe (Stückzahl nur,
  wenn **jedes** Kind eine semantisch vorhandene, **gleiche** Einheit hat — sonst reine
  Gramm-Summe; nie rückwärts aus Gramm eine Stückzahl erzeugen, dieselbe J-010/J-011-Regel wie
  bei Einzeleinträgen). `src/presentation/features/journal/__tests__/journalEntryDisplay.test.ts`
  — 13 neue Tests. `JournalScreen.tsx` — neuer `expandedGroupIds`-State (Set, eingeklappt per
  Default), Gruppen-Header für `groupKind: 'canonical'` jetzt in `TouchableOpacity` mit
  `accessibilityRole="button"`/`accessibilityState={{expanded}}`/beschreibendem
  `accessibilityLabel`; Composite-Dish-Gruppen bleiben unverändert immer aufgeklappt, ohne
  Toggle. Die transiente J-008-Bestätigung wurde **nicht** angefasst (Vorgabe: Gruppierung
  betrifft nur die dauerhafte Tagesübersicht).
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 116
  Suiten / 910 Tests grün, inkl. 13 neuer `groupJournalEntries`/`buildGroupQuantitySubtitle`-
  Tests: gleiche Identität gruppiert inkl. Singular/Plural, gleiches Label aber andere
  Identität gruppiert nicht, fehlende Identität bleibt Leaf, ein einzelner Treffer bleibt
  Leaf, Positionierung am neuesten Mitglied, Löschen bis auf ein verbleibendes Mitglied löst
  die Gruppe auf, identitätsändernde Bearbeitung gruppiert korrekt neu, Composite-Dish-Gruppen
  unberührt, exakte Kalorien-/Makro-Summierung, homogene bekannte Stückzahlen aggregieren,
  gemischte Stückzahl+explizite-Gramm zeigt nur Gramm, inkompatible Einheiten erzeugen keine
  falsche Stückzahl, Gleitkomma-Summierungsrauschen wird korrekt auf eine Nachkommastelle
  gerundet (`246.60000000000002` → `246.6`, während des Live-Checks unten entdeckt und noch in
  diesem Task behoben, siehe unten).
- **Verifiziert (visuell, 2026-07-17, sehr ausführlich per Headless-Playwright/Chromium gegen
  `expo start --web`):**
  - Kernszenario "Ei" → "Ein Ei" → "Drei Eier": ergibt genau **eine** eingeklappte Gruppe
    „Huehnerei ganz roh · 5 STÜCK (300 G) · 411 kcal" (die reale Katalog-`displayName` statt
    des illustrativen Plan-Beispiels „Eier" — korrektes Verhalten laut Spezifikation, nur ein
    anderes reales Label). Tagestotal exakt 411 kcal.
  - Antippen des Gruppen-Headers klappt korrekt auf: alle drei ursprünglichen Einträge
    einzeln sichtbar in chronologischer Reihenfolge, jeweils mit eigenem „Löschen" (Screenshot).
    Erneutes Antippen klappt korrekt wieder ein.
  - Löschen eines Kindes (2 verbleiben): Gruppe bleibt bestehen, rekalkuliert korrekt zu
    „4 STÜCK (240 G) · 328,8 kcal" (Tagestotal korrekt auf 329 kcal aktualisiert).
  - Löschen eines weiteren Kindes (1 verbleibt): Gruppe löst sich korrekt auf, verbleibender
    Eintrag erscheint wieder als normale Zeile („Eier · 3 STÜCK (180 G) · 246,6 kcal").
  - „1 Ei" + „120g Ei" **außerhalb** des J-005-2-Minuten-Auto-Merge-Fensters eingegeben (mit
    echter 130-Sekunden-Wartezeit, um den bestehenden, unveränderten Auto-Merge-Mechanismus
    absichtlich zu umgehen und die reine Gruppierungs-/Aggregations-Anzeige zu prüfen):
    ergibt eine Gruppe „Huehnerei ganz roh · 180 G · 246,6 kcal" — korrekt **keine** erfundene
    Stückzahl trotz gruppierter Identität, exakt wie gefordert.
  - Innerhalb des Auto-Merge-Fensters (Sekunden statt Minuten zwischen den Eingaben) griff wie
    erwartet **unverändert** J-005s bestehender Auto-Merge-Mechanismus (Banner „Mit vorherigem
    Eintrag zusammengeführt" erschien) — bestätigt, dass J-009 diesen bestehenden,
    persistenzseitigen Mechanismus nicht verändert oder umgeht.
  - Während dieser Live-Prüfung wurde ein echtes, durch die neue Gruppen-Summierung erstmals
    sichtbar gewordenes Gleitkomma-Anzeigeproblem gefunden (`82.2 + 164.4` ergab in JS
    `246.60000000000002`, roh ungerundet an `EntryRow`s `kcal`-Prop durchgereicht) und noch
    innerhalb dieses Tasks behoben (`sumEntries()` rundet jetzt auf eine Nachkommastelle,
    mathematisch identisch zur exakten Summe, siehe Testfall oben) — danach erneut live
    bestätigt: zeigt sauber „246,6 kcal".
  - Zugriffs-Attribute geprüft: `role="button"` und ein beschreibender `aria-label`
    (z. B. „Huehnerei ganz roh, 2 Einträge, eingeklappt") werden im DOM korrekt gesetzt; ein
    separates `aria-expanded`-Attribut wird von dieser react-native-web-Version für ein
    einfaches `TouchableOpacity` + `accessibilityState` nicht emittiert (Bibliotheks-
    Einschränkung, kein Code-Defekt) — der Zustand wird stattdessen über den Label-Text
    kommuniziert. Auf nativen Plattformen (iOS/Android) mappt `accessibilityState={{expanded}}`
    laut RN-Dokumentation direkt auf die native Screenreader-Semantik.
  - Null Browser-Konsolenfehler/Page-Errors über alle Läufe.
- **Nicht verifiziert (visuell):** natives Layout/Touch-Ziel-Größe des Gruppen-Headers auf
  iOS/Android; ob ein nativer Screenreader (VoiceOver/TalkBack) den Auf-/Zugeklappt-Zustand
  über `accessibilityState`/`accessibilityLabel` korrekt ansagt (die Web-DOM-Prüfung oben
  zeigt korrekt gesetzte Attribute, aber keine native Screenreader-Ansage selbst); die
  identitätsändernde-Bearbeitung-regruppiert-Szenario wurde nur unit-getestet (nicht live
  nachgestellt — eine natürlichsprachliche Bearbeitung, die die Katalog-Identität ändert, ist
  über eine kurze Textanweisung schwer deterministisch auszulösen; die reine Funktionslogik
  ist über den entsprechenden Test bereits vollständig abgedeckt).
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 2 (Layout & Rendering) und
  3 (Interaktion & Eingabe). Konkret: "Ei"/"Ein Ei"/"Drei Eier" eingeben, eine Gruppe
  „5 Stück (300 g) · 411 kcal" bestätigen, aufklappen und mit VoiceOver/TalkBack die
  Auf-/Zugeklappt-Ansage prüfen; Touch-Ziel-Größe des Gruppen-Headers auf einem echten Gerät
  bestätigen.
- **Native-Dogfooding-Evidenz 2026-07-17 (nicht als ✅ gesetzt — Agent-Konvention):** In der
  nativen Android-Dogfooding-Session wurde das Kernverhalten dieses Eintrags real auf dem Gerät
  bestätigt: Gruppenaufklappen, Löschen einzelner Kinder innerhalb der Gruppe, Neuberechnung
  der Gruppensumme und Auflösung auf einen verbleibenden Eintrag, sowie Persistenz über einen
  App-Neustart funktionierten wie spezifiziert (siehe
  [`reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md`](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md),
  Abschnitt 1). **Weiterhin offen:** native Touch-Ziel-Größe des Gruppen-Headers und die
  Screenreader-Ansage (VoiceOver/TalkBack) des Auf-/Zugeklappt-Zustands wurden in dieser Session
  nicht gezielt geprüft. Der `foodCatalogRef`-Gruppentitel („Huehnerei ganz roh") und die
  fehlende Chevron-Affordanz bleiben als **J-012** getrennt getrackt (kein J-009-Reopen).

---

### 2026-07-17 — J-011: Explizite Gramm-Angabe wird nicht mehr rückwärts in eine Stückzahl umgerechnet

- **Status:** ✅ geprüft (real per Headless-Playwright/Chromium gegen `expo start --web`
  verifiziert, siehe unten)
- **Branch/PR:** `claude/j-011-preserve-explicit-grams`
- **Betroffene Bereiche:** `src/presentation/features/journal/journalEntryDisplay.ts` —
  Product-Review-Korrektur von J-010: `buildSubtitle` prüft jetzt zuerst, ob der Rohtext
  selbst explizite Gramm enthält (`parseDisplayQuantity(rawInput).unit === 'g'`); falls ja,
  wird **immer** nur die Gramm-Anzeige gezeigt — die bekannte Stückportion wird in diesem Fall
  gar nicht mehr konsultiert, auch wenn `grams / gramsPerUnit` rechnerisch glatt aufgeht. Der
  bekannte-Stückportion-Pfad bleibt nur für den Fall erhalten, für den er eigentlich gedacht
  war: Rohtext ohne explizite Gramm (bloßes „Ei", oder Text mit eigenem Zählwort wie
  „Drei Eier"), wo die gespeicherten Gramm selbst aus einer echten Stückzahl berechnet wurden.
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 116
  Suiten / 896 Tests grün). Der zuvor fehlerhafte Test „a known count portion wins even over
  explicit-grams raw input phrasing" wurde entfernt; ein neuer Testblock
  „J-011: explicit gram intent is never overridden by a known count portion" (5 Tests) deckt
  ab: `"300g Karotten"` bleibt `"300 g"` trotz glatter Teilbarkeit; `"120g Ei"` bleibt
  `"120 g"`; `"Ei"` zeigt weiterhin `"1 Stück (60 g)"`; `"Drei Eier"` zeigt weiterhin
  `"3 Stück (180 g)"`; unverändertes Verhalten ohne bekannte Portion. Alle bestehenden
  J-010-Tests (bis auf den entfernten fehlerhaften) bleiben unverändert grün.
- **Verifiziert (visuell, 2026-07-17, per Headless-Playwright/Chromium gegen `expo start
--web`):** Die drei in der Produktentscheidung genannten Beispiele nacheinander eingegeben
  und exakt bestätigt: `"Ei"` → `"1 STÜCK (60 G)"`, `"Drei Eier"` → `"3 STÜCK (180 G)"`,
  `"300g Karotten"` → `"300 G"` (nicht mehr `"5 STÜCK (300 G)"`) — alle drei gleichzeitig in
  „Heutige Einträge" sichtbar (Screenshot), Tagestotal korrekt (82,2 + 246,6 + 96 ≈ 425 kcal).
  Null Browser-Konsolenfehler/Page-Errors.
- **Nicht verifiziert (visuell):** natives Layout auf iOS/Android; der Scheiben-Fall wurde nur
  unit-getestet (kein Blocker — dieselbe Formatierungsfunktion wie der live geprüfte
  Stück-Fall, bereits in J-010s Eintrag dokumentiert).
- **Zu testen:** siehe Checkliste unten, Abschnitt 1 (Smoke-Test). Konkret: „300g Karotten"
  eingeben und bestätigen, dass die Anzeige „300 g" bleibt (nicht „5 Stück").

---

### 2026-07-17 — J-010: Konsistente Mengenanzeige für bekannte Stückportionen

- **Status:** ✅ geprüft (real per Headless-Playwright/Chromium gegen `expo start --web`
  verifiziert, siehe unten)
- **Branch/PR:** `claude/j-010-quantity-display`
- **Betroffene Bereiche:** `src/presentation/features/journal/journalEntryDisplay.ts`
  (`buildSubtitle`/`buildFoodEntryDisplay` erhalten einen neuen optionalen
  `knownCountPortion`-Parameter; wenn `grams / gramsPerUnit` eine glatte Ganzzahl ergibt, hat
  die bekannte Stückportion Vorrang vor der bisherigen reinen Text-Parsing-Logik — auch wenn
  der Rohtext explizite Gramm enthielt; sonst unverändertes Alt-Verhalten); neuer
  `KnownCountPortion`-Typ (exportiert). `JournalScreen.tsx` — neuer `knownCountPortions`-State
  - `useEffect`, der bei jeder Änderung von `entries` für alle heutigen Food-Identitäten
    parallel `container.portionKnowledgeService.lookup()` (piece + slice, read-only, bereits
    bestehender Service) aufruft und das Ergebnis in allen drei `buildFoodEntryDisplay`-
    Aufrufstellen (Bestätigungs-Panel, "Heutige Einträge"-Flach-Eintrag, Gruppen-Kind) einspeist.
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite 116
  Suiten / 892 Tests grün, inkl. 8 neuer Tests in `journalEntryDisplay.test.ts`: bekannte
  Stückportion ohne Zählwort im Rohtext, mehrfache Stückzahl, bekannte Portion schlägt
  explizite Gramm-Eingabe, Scheiben-Einheit, kein erfundener Bruch-Count bei unsauberem
  Verhältnis, bekannte Portion überschreibt abweichende Text-Parse-Einheit, unverändertes
  Verhalten ohne bekannte Portion, defensive 0/negative `gramsPerUnit`).
- **Verifiziert (visuell, 2026-07-17, per Headless-Playwright/Chromium gegen `expo start
--web`, echte Supabase-Anon-Config nur zum Boot — Journal-Einträge selbst liegen laut
  Code-Inspektion in `AsyncStorage`/Browser-`localStorage`):** Bare `"Ei"` (keine Zählangabe
  im Rohtext) zeigte vorher `"60 g"`, jetzt korrekt `"1 STÜCK (60 G)"` — in **beiden**
  Renderstellen (transientes Bestätigungs-Panel und "Heutige Einträge"), identisch formatiert.
  `"300g Karotten"` (explizite Gramm-Eingabe, bekannte Portion 60 g/Stück, 300/60 = 5) zeigte
  korrekt `"5 STÜCK (300 G)"` statt `"300 g"` — bestätigt, dass die bekannte Stückportion auch
  eine explizite Gramm-Phrasierung überschreibt, wie von Entscheidung 11 gefordert
  (Konsistenz unabhängig von der Eingabeformulierung). Tagestotal korrekt (82 + 96 = 178 kcal).
  Null Browser-Konsolenfehler/Page-Errors. Screenshot bestätigt sauberes Layout beider
  Einträge nebeneinander.
- **Nicht verifiziert (visuell):** natives Layout/Zeilenumbruch auf iOS/Android bei langen
  Lebensmittelnamen kombiniert mit der neuen Stück-Formatierung; das Verhalten bei einem
  Scheiben-Fall (`toast`, 35 g/Scheibe) wurde nur unit-getestet, nicht live in der Web-Runtime
  nachgestellt (kein Blocker — dieselbe Formatierungsfunktion wie der live geprüfte
  Stück-Fall).
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 2 (Layout & Rendering).
  Konkret: "Ei" eingeben und "1 Stück (60 g)" bestätigen; ein Scheiben-Lebensmittel (z. B.
  "Toast") eingeben und die Scheiben-Formatierung auf einem echten Gerät bestätigen.

---

### 2026-07-17 — J-008: Transiente Last-Submit-Bestätigung ersetzt "Erkannte Einträge"

- **Status:** ⏳ offen (Kernverhalten real per Playwright/Chromium gegen `expo start --web`
  verifiziert — siehe unten; eine Teilinteraktion bleibt nativ zu bestätigen)
- **Branch/PR:** `claude/j-008-transient-confirmation`
- **Betroffene Bereiche:** `src/presentation/features/journal/JournalScreen.tsx` (permanente
  "Erkannte Einträge"-Liste + `recognizedItems`-State entfernt; neue transiente
  Bestätigungs-Panel mit ~8s-Timer/Hold-Logik, Tab-Blur- und Unmount-Cleanup, Korrekturzugriff
  über die bestehende Edit-Modal-Interaktion); neu
  `src/presentation/features/journal/journalLastSubmitConfirmation.ts` (reine
  Nachrichten-Ableitung + framework-agnostischer Timer-Controller); `journalEntryDisplay.ts`
  (zwei bestehende Funktionen `formatNumber`/`parseDisplayQuantity` exportiert, keine
  Verhaltensänderung).
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite
  884/884 grün, inkl. 16 neuer Tests für `journalLastSubmitConfirmation.ts`: Nachrichten-
  Ableitung für 1/2/3+ Einträge, Grammatik ohne erfundene Stückzahl, sowie der Timer-Controller
  mit Jest-Fake-Timern — Auto-Dismiss nach ~8s, Reset bei neuer Submission, Hold/Release
  inkl. verschachtelter Holds, kein Dismiss durch einen unpassenden `release()`-Aufruf,
  sofortiges `hide()`, sauberes `dispose()` ohne Leak).
  **Zusätzlich real verifiziert** (Headless-Playwright/Chromium gegen `expo start --web`,
  echte Supabase-Anon-Config nur für Auth/Resolver — Journal-Einträge selbst liegen laut
  Code-Inspektion in `AsyncStorage`/Browser-`localStorage`, nicht in der Remote-DB, pro
  Playwright-Browserinstanz isoliert): die exakte Ausgangsszenario-Sequenz aus dem
  Dogfooding-Report nachgestellt — "Ei", dann "Ein Ei", dann "Drei Eier" nacheinander
  eingegeben. Panel zeigte nacheinander exakt `"Ei gespeichert · 82,2 kcal"`,
  `"1 Ei gespeichert · 82,2 kcal"`, `"3 Eier gespeichert · 246,6 kcal"` — nie die missverständliche
  Tagessumme. Tagestotal korrekt bei 411 kcal (identisch mit dem Report), alle drei Einträge
  einzeln in "Heutige Einträge" mit eigenem "Löschen" erhalten (Screenshot). "Erkannte
  Einträge" erschien in keinem Zustand (vor/nach 1/2/3 Submits geprüft). Auto-Dismiss
  bestätigt: Panel nach einem separaten Lauf mit 15s Warteszeit bereits wieder verschwunden
  (>~8s), während "Heutige Einträge"/Summary-Bar unverändert korrekt blieben. Null Browser-
  Konsolenfehler/Page-Errors über alle Läufe.
- **Nicht verifiziert (visuell):** Der Korrekturzugriff (Antippen einer Zeile im Panel öffnet
  das Edit-Modal) konnte in diesem Lauf nicht zuverlässig live erfasst werden — mehrere
  Playwright-Versuche liefen in eine intermittierende Netzwerk-Verzögerung/-Hänger bei den
  echten OFF/USDA-Resolver-Quellen dieser Sandbox (unabhängig von dieser Änderung, siehe
  Konsolen-Trace: BLS liefert sofort ein Match, die App wartet aber sichtbar weiter auf
  OFF/USDA, bevor `submitRawInput` zurückkehrt), wodurch das Panel wiederholt schon wieder
  verschwunden war, bevor der Klick erfolgen konnte. Der Handler
  (`handleOpenEditFromConfirmation` → bestehendes `handleOpenEdit`) nutzt exakt dieselbe
  `EntryRow`-Komponente und denselben `onPress`-Mechanismus, der in "Heutige Einträge" auf
  derselben Seite nachweislich funktioniert (Löschen-Buttons dort real geklickt/funktionsfähig
  in den Screenshots) — Code-seitig also keine neue Interaktionslogik, aber nicht selbst
  live angeklickt bestätigt. Ebenfalls nicht real geprüft: Hold-Verhalten bei aktivem
  Touch/offenem Edit-Modal (`hold()`/`release()`), natives Layout/Spacing auf iOS/Android,
  Touch-Target-Größe der Panel-Zeilen.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 3 (Interaktion & Eingabe).
  Konkret: "Ei", "Ein Ei", "Drei Eier" nacheinander eingeben (wie oben) und die drei
  Bestätigungstexte + das Verschwinden von "Erkannte Einträge" bestätigen; eine Panel-Zeile
  antippen und prüfen, dass sich das bestehende Bearbeiten-Modal für genau diesen Eintrag
  öffnet; während des Antippens/offenen Modals darf das Panel nicht automatisch verschwinden;
  Tab wechseln und zurückkehren sollte das Panel ausblenden.

---

### 2026-07-16 — NATIVE-001: Fatal-Config-Screen statt Boot-Crash bei fehlender Supabase-Konfiguration

- **Status:** ⏳ offen (Web-Pfad real per Playwright verifiziert, siehe unten — der **native**
  Pfad ist der eigentliche Gegenstand dieses Fixes und kann nur auf einem echten Gerät geprüft
  werden)
- **Branch/PR:** `claude/app-testing-evaluation-yogpjt` (PR #45)
- **Betroffene Bereiche:** `src/presentation/App.tsx` (neuer Early-Return: blockierender
  „Konfigurationsfehler"-Screen, wenn `supabaseConfigError` gesetzt ist — Titel in
  `tokens.colors.danger`, Erklärungstext, Name der fehlenden Variable als Meta-Zeile);
  `src/infrastructure/supabase/supabaseClient.ts` (Modul-Scope-Throw entfernt, Validierung als
  pure Funktion + `supabaseConfigError`-Export, Platzhalter-Client bei fehlender Konfig).
  Kontext: `reports/NATIVE-001_ANDROID_COLDSTART_CRASH_DIAGNOSIS.md`.
- **Verifiziert durch Agent:** `npm run verify` (typecheck, lint, format, volle Suite inkl.
  6 neuer Tests für `validateSupabaseConfig`). Zusätzlich real gegen `expo start --web`
  (Playwright/Chromium): (a) **ohne** `.env` rendert jetzt der Konfigurationsfehler-Screen
  (Screenshot) statt einer leeren Seite mit unbehandelter Exception — Variable wird benannt,
  App blockiert, 0 uncaught errors; (b) **mit** `.env` bootet die App unverändert normal
  (4 Tabs, 0 Page-Errors).
- **Nicht verifiziert (visuell):** Das native Rendering des Fatal-Screens auf einem echten
  Gerät (Layout, Safe-Area, Schriftgrößen). Hinweis: Bei einem **korrekt** konfigurierten Build
  ist dieser Screen nie sichtbar — explizit prüfbar nur mit einem absichtlich ohne Env-Vars
  gebauten Build; implizit gilt der Fix als bestätigt, wenn der neue, korrekt konfigurierte
  Build kalt startet (NATIVE-001 DoD).
- **Zu testen:** Kaltstart des neuen Builds (Abschnitt 1 der Checkliste). Optional: ein
  bewusst fehlkonfigurierter Build muss den Konfigurationsfehler-Screen zeigen statt zu
  crashen.
- **Native-Dogfooding-Evidenz 2026-07-17 (nicht als ✅ gesetzt — Agent-Konvention):** Der
  native Standalone-Build startete in der Dogfooding-Session vom 2026-07-17 korrekt kalt
  (Vier-Tab-Navigation erreichbar, kein Boot-Crash) — das ist der eigentliche, nur nativ
  prüfbare DoD-Kern dieses Fixes (siehe
  [`reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md`](../reports/NATIVE_DOGFOODING_2026-07-17_CONSOLIDATED_REPORT.md),
  Abschnitt 1, „Confirmed working"). Der absichtlich fehlkonfigurierte Build (Konfigurations-
  fehler-Screen statt Crash) wurde in dieser Session nicht separat geprüft; die `✅`-Setzung
  bleibt dem menschlichen Review überlassen.

### 2026-07-15 — DI-008: Expliziter Loading-State im EvaluationSummaryScreen

- **Status:** ✅ geprüft (Error-/Success-/Profilwechsel-Zustände real per Playwright/Web
  geprüft, siehe unten — der `ActivityIndicator`-Frame selbst bleibt als benanntes Detail
  offen, siehe "Nicht verifiziert" unten; Gesamtstatus auf ✅ gesetzt auf explizite Anweisung
  im dedizierten Manual-Testing-Sweep vom 2026-07-15, siehe dessen Update-Eintrag unten)
- **Branch/PR:** `claude/di-008-act-loading-state`
- **Betroffene Bereiche:** `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx`
  — ein neuer `loadState: 'loading' | 'success' | 'error'`-State, initial `'loading'`. `load()`
  setzt ihn synchron auf `'loading'` als allererste Zeile (deckt sowohl den Mount-Aufruf als auch
  jeden Profilwechsel-Reload ab), auf `'success'` zusammen mit `setOutput(result)` im Erfolgsfall,
  auf `'error'` im `catch`-Block (alle drei bestehenden Fehlerzweige unverändert). Rendering:
  ein neuer, expliziter `loadState === 'loading'`-Block (`ActivityIndicator` + "Auswertung wird
  geladen…", mirrored auf `GoalsScreen`s bestehendem `ActivityIndicator`-Pattern — keine neue
  geteilte Loading-Komponente) ersetzt die bisherige implizite Lücke; der bestehende
  Error-Block ist jetzt an `loadState === 'error'` gebunden, der bestehende Content-Block an
  `loadState === 'success' && output` (vorher nur `output`) — dadurch verschwindet auch das im
  Planning-Task (`ROADMAP.md`, DI-008) dokumentierte Stale-Data-Problem beim Profilwechsel, da
  der Content-Block jetzt beim Reload sofort ausblendet, nicht erst wenn der neue Output
  eintrifft. Keine neue Use-Case-, Repository-, Domain- oder Rule-Änderung; kein neues
  gemeinsames Loading-Component/Design-System eingeführt.
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npx prettier -c`
  (scoped), `npm run test` (113 Suiten / 854 Tests, unverändert grün — keine neuen Tests, siehe
  Begründung unten).
- **Warum keine neuen automatisierten Tests:** wie bei `DI-007` enthält dieses Repo keine
  React-Native-Render-Testbibliothek. Die Änderung selbst enthält zudem keine eigenständig als
  reine Funktion testbare Logik — es ist eine reine State-Machine-Verdrahtung auf bereits
  anderswo getesteten Use-Cases (`BuildEvaluationInputForDateUseCase`,
  `GetActiveEvaluationOutputUseCase`), kein neues Mapping/keine neue Formatierung, die sich
  sinnvoll isoliert unit-testen ließe.
- **Verifiziert (visuell, 2026-07-15, per Headless-Playwright/Chromium gegen `expo start
--web`):** Mit einer lokalen, nie getrackten `.env` (Platzhalterwerte, ausschließlich zum
  Boot-Check — siehe `DI-007`s Eintrag oben für dasselbe Vorgehen) real gegen die laufende Web-
  Runtime getestet:
  - **Error-Zustand:** Frischer Mount ohne gesetzte Ziele zeigt korrekt "Bitte zuerst im
    Ziele-Tab Ziele festlegen." (nicht leer, nicht auf Loading hängend).
  - **Success-Zustand:** Nach Setzen von Metabolismus-Profil + Ziel-Preset ("Balanced") zeigt
    der Auswertung-Tab korrekt Bewertung ("Im Zielkorridor"), Fortschritt (alle 4 Makros),
    und Einordnung — Reihenfolge und Inhalt wie von `DI-007` etabliert.
  - **Profilwechsel:** Wechsel von "Evidence-based Standard" zu "Weight Loss" zeigt sichtbar
    andere Werte (Kalorienziel 2076→1661, Protein 130→125) und sichtbar andere Einordnung/
    Empfehlungen-Texte (Korridor-Insight → Defizit-Insight + neue Protein-Empfehlung), aktiver
    Profil-Button-Highlight wechselt korrekt; kein Stale-Data-Frame des vorherigen Profils
    sichtbar in den Screenshots unmittelbar nach dem Klick.
  - Null Browser-Konsolenfehler über die gesamte Session (Mount, Ziele-Flow, Profilwechsel).
  - Test-`.env` danach wieder entfernt (war ohnehin nie getrackt/gitignored), keine
    Dependency-Änderung.
- **Nicht verifiziert (visuell):** Der explizite `ActivityIndicator`-Frame selbst (initial mount
  und beim Profilwechsel-Reload) konnte in dieser Umgebung nicht per Screenshot eingefangen
  werden — die zugrundeliegenden Repositories sind lokal/offline (kein echtes Netzwerk-Delay),
  sodass der `'loading'`-Zustand selbst bei einem 50–60ms-Screenshot-Delay nach dem Klick bereits
  wieder vom `'success'`-Zustand abgelöst war. Der Code-Pfad ist per Review bestätigt (`loadState`
  wird synchron vor jedem `await` in `load()` gesetzt), aber die visuelle Sub-100ms-Anzeige selbst
  ist auf einem echten Gerät mit echtem Netzwerk-/Storage-Delay zu bestätigen.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 4 (Navigation & State) und 7
  (Regressionscheck). Konkret: auf einem echten Gerät/Simulator mit spürbarer Ladezeit (oder
  gedrosselter Verbindung) bestätigen, dass der `ActivityIndicator` sichtbar erscheint (a) beim
  ersten Öffnen des Auswertung-Tabs und (b) unmittelbar nach jedem Profilwechsel, bevor der neue
  Inhalt erscheint.
- **Update 2026-07-15 — Manual-Testing-Sweep (7 offene Einträge, priorisiert):** Im Rahmen eines
  dedizierten Sweeps über alle sieben damals offenen `MANUAL_TESTING_GAPS.md`-Einträge erneut
  gegen `expo start --web` geprüft — keine neuen Erkenntnisse gegenüber der obigen Verifikation
  vom selben Tag, der In-Screen-Profilwechsel (Auswertung's eigener Picker) blieb dabei fehlerfrei
  und stale-data-frei. Der `ActivityIndicator`-Frame selbst bleibt aus denselben Timing-Gründen
  unbestätigt (siehe "Nicht verifiziert" oben) — unverändert offen dokumentiert, nicht Teil dieser
  Statusänderung. Während desselben Sweeps wurde bei `GE-008`/`DI-002` ein **verwandter, aber
  eigenständiger** Cross-Tab-Defekt gefunden (siehe deren Einträge sowie `ROADMAP.md`s neuer
  `DI-009`): wechselt man das aktive Profil über `GoalsScreen`s "Ziel wählen"-Karte statt über
  diesen Screen selbst, aktualisiert sich der bereits gemountete Auswertung-Tab nicht. Das ist
  kein DI-008-Regressions-Defekt — DI-008s eigener In-Screen-Mechanismus funktioniert nachweislich
  korrekt; der `loadState`-Mechanismus dieses Tasks ist voraussichtlich direkt wiederverwendbar,
  sobald `DI-009` den fehlenden Fokus-Trigger ergänzt.

### 2026-07-15 — DI-007: Insights & Recommendations im EvaluationSummaryScreen

- **Status:** ✅ geprüft
- **Branch/PR:** `claude/project-status-audit-i8blw1`
- **Betroffene Bereiche:** `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx`
  — zwei neue, rein additive Abschnitte "Einordnung" (`output.insights`) und "Empfehlungen"
  (`output.recommendations`), eingefügt zwischen dem bestehenden "Fortschritt"-Abschnitt und dem
  bestehenden "Hinweise"-Abschnitt (Warnings). Beide Abschnitte rendern die vom
  Evaluation-Use-Case gelieferten Strings unverändert (kein neues Mapping, keine neue
  Berechnung) und erscheinen nur, wenn das jeweilige Array mindestens einen Eintrag hat —
  exakt derselbe Bedingungs-/Render-Pattern wie der bestehende, unveränderte `warnings`-Block.
  Keine Änderung an Rules, Registry, Provider, Journal-/Repository-Schicht oder Navigation.
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (113 Suiten
  / 854 Tests, unverändert grün — keine neuen Tests, siehe Begründung unten), `npx prettier -c`
  (scoped).
- **Warum keine neuen automatisierten Tests:** Dieses Repo enthält keine
  React-Native-Render-Testbibliothek (weder `@testing-library/react-native` noch
  `react-test-renderer` in `package.json`, kein einziger `render(...)`-Aufruf irgendwo unter
  `src/presentation/`). Der strukturell identische, bereits produktive `warnings`-Block (DI-002)
  hat aus demselben Grund ebenfalls nie einen Screen-Rendering-Test gehabt. Da neue Dependencies
  für DI-007 explizit außerhalb des Scopes liegen, gibt es keine sinnvolle Möglichkeit, das
  bedingte Rendering hier automatisiert zu prüfen, ohne diese Einschränkung zu verletzen — die
  Änderung selbst enthält zudem keine eigenständig testbare Logik (reines Verbatim-Rendering
  bereits vorhandener Strings, kein neues Mapping/keine neue Formatierung).
- **Nicht verifiziert (visuell):** Dass "Einordnung" und "Empfehlungen" korrekt zwischen
  "Fortschritt" und "Hinweise" erscheinen und "Hinweise" dabei nicht visuell untergeht; dass
  beide Abschnitte bei leeren Arrays tatsächlich keinen sichtbaren leeren Bereich hinterlassen;
  dass ein Profilwechsel (Evidence-based Standard ↔ Weight Loss) sichtbar unterschiedliche
  Insight-/Empfehlungstexte zeigt; allgemeines Layout/Abstände der neuen Abschnitte.
- **Update 2026-07-15 — Browser-Verifikationsversuch (blockiert, kein Claude-spezifisches
  Problem):** Es wurde versucht, diesen Eintrag über `expo start --web` + Playwright/Chromium
  (in dieser Umgebung vorinstalliert) durch einen echten Screenshot-Test zu schließen, statt
  ihn offen zu lassen. Der Versuch scheiterte an zwei getrennten Ursachen:
  1. Ein Online-Versionscheck von `expo start` gegen Expos eigene API schlug am
     Netzwerk-Proxy dieser Sandbox fehl (`--offline`-Flag umgeht das) — **das ist
     umgebungsspezifisch**, auf einem Rechner mit normalem Internetzugang vermutlich kein
     Problem.
  2. Danach: `CommandError: ... don't have the required dependencies installed. Install
react-dom@19.1.0, react-native-web@~0.21.0`. Bestätigt per `Glob` (kein Bash/Netzwerk
     nötig): weder `react-dom` noch `react-native-web` noch `@expo/metro-runtime` existieren
     irgendwo unter `node_modules/` — auch nicht gehoistet/transitiv. Kein Workspace-/Monorepo-
     Setup, das das erklären würde (`package.json` hat kein `workspaces`-Feld). **Das ist
     unabhängig von der Sandbox** — `npm run web` würde nach einem sauberen `npm ci` auf jedem
     Rechner mit denselben drei fehlenden Paketen scheitern, obwohl `app.json` `web` als
     Plattform konfiguriert (`expo.web.favicon`) und `package.json` das `web`-Skript definiert
     (`expo start --web`) und README `w` als Startoption dokumentiert.
  - Testdatei `.env` (Platzhalterwerte, nur für den Startversuch) wurde wieder entfernt, war
    ohnehin nie getrackt (gitignored).
  - Keine Dependency-Änderung vorgenommen — `package.json`/`package-lock.json` liegen
    außerhalb des Scopes eines Verifikationsversuchs. Empfehlung: separater, explizit
    autorisierter Task (Arbeitstitel `WEB-001`) zur Reparatur der Web-Runtime, danach erneuter
    Verifikationsversuch für diesen Eintrag.
  - Native Android-/iOS-Verifikation ist von diesem Befund **nicht** betroffen — `react-dom`/
    `react-native-web` werden ausschließlich für die Web-Plattform benötigt.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 7 (Regressionscheck).
  Konkret: Auswertung-Tab öffnen, prüfen dass "Einordnung"/"Empfehlungen" zwischen Fortschritt
  und Hinweisen erscheinen (falls vorhanden), zwischen den beiden Zielen wechseln und prüfen,
  dass sich die angezeigten Texte sichtbar unterscheiden, und einen Tag ohne auslösende
  Bedingungen prüfen (beide Abschnitte sollten dann unsichtbar sein, kein leerer Rahmen).
- **Verifiziert (visuell, 2026-07-15, nach WEB-001/PR #32):** Der oben dokumentierte Blocker
  wurde durch `WEB-001` (siehe `ROADMAP.md`, `PR #32`) behoben — `npm run web` startet jetzt
  fehlerfrei. Anschließend wurde dieser Eintrag per Headless-Playwright/Chromium gegen den
  laufenden `expo start --web`-Server real geprüft: "Einordnung"/"Empfehlungen" erscheinen nur
  bei nicht-leeren Arrays, in der korrekten Reihenfolge (Bewertung → Fortschritt → Einordnung →
  Empfehlungen → Hinweise); ein reales Kalorienziel-Warning wurde ausgelöst und blieb sichtbar,
  nicht von den neuen Abschnitten verdeckt; Profilwechsel (Evidence-based Standard ↔ Weight
  Loss) zeigte sichtbar unterschiedliche Insight-/Empfehlungstexte; langer Text umbricht sauber
  ohne Abschneiden (per Scroll bis zum tatsächlichen Ende bestätigt); keine internen Begriffe
  ("Evaluation Profile", Rule-Namen) sichtbar; Screen auf 390×844-Viewport vollständig
  scrollbar; keine Browser-Konsolenfehler. Vollständige Evidenz in `ROADMAP.md`'s
  `WEB-001`-Eintrag (Implementation notes / Verification results).

### 2026-07-10 — GE-008: GoalsScreen "Ziel wählen" Surface

- **Status:** ✅ geprüft (Defekt behoben durch `DI-009`, siehe unten)
- **Branch/PR:** `claude/ge-008-goals-screen-ziel-waehlen`
- **Betroffene Bereiche:** `src/presentation/features/goals/GoalsScreen.tsx` (neue "Ziel
  wählen"-Karte, direkt unterhalb des Headers, mit einer Liste anwählbarer registrierter
  Evaluation Profiles aus `container.evaluationProfileRegistry`; Auswahl ruft
  `setActiveProfileId` auf, kein Journal-/Food-Catalog-Schreibzugriff), neue
  `src/presentation/features/goals/goalsDisplay.ts` (Origin→Produktoberflächen-Label gemäß
  Product Bible §4b, z. B. `preset` → "Vorgeschlagenes Ziel"). Rührt die bestehende
  Metabolismus-Profil-/Makro-Strategie-Sektion des Screens nicht an — reine Ergänzung.
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (113
  Suiten / 854 Tests, +4 neue in `goalsDisplay.test.ts`, die u. a. prüfen, dass `originLabel`
  nie "Profil"/"Preset"/"Origin" wörtlich zurückgibt), `npx prettier -c` (scoped).
- **Nicht verifiziert (visuell):** Layout/Touch-Verhalten der neuen "Ziel wählen"-Karte
  (Kartenabstände, Touch-Zielgröße der Options-Buttons, aktiver-Zustand-Hervorhebung),
  dass ein Ziel-Wechsel die restliche Seite (Metabolismus-Profil, Tägliche Ziele) sichtbar
  unverändert lässt, dass die Karte bei leerem `zielOptions` (sollte praktisch nie
  vorkommen, da der Container immer mindestens `EvidenceBasedStandardProfile` registriert)
  korrekt ausgeblendet bleibt.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 7
  (Regressionscheck). Konkret: Ziele-Tab öffnen, "Ziel wählen"-Karte sehen, zwischen
  "Evidence-based Standard" und "Weight Loss" wechseln, prüfen dass die Auswahl aktiv
  bleibt (auch nach App-Neustart, da `PersistedActiveProfileRepository` persistiert), und
  dass sich der Auswertung-Tab (DI-002) entsprechend der neuen Auswahl aktualisiert.
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Karte selbst funktioniert korrekt — aktiver Zustand (blaue
  Hervorhebung) wechselt beim Antippen sichtbar zur neu gewählten Karte, Layout/Touch-Ziele
  sehen sauber aus (Screenshots), Persistenz über einen vollen Seiten-Reload hinweg bestätigt
  (Ziele-Tab zeigt "Weight Loss" weiterhin als aktiv nach Reload). Null Browser-Konsolenfehler.
- **Defekt gefunden (reproduzierbar, dokumentiert unter `DI-009` in `ROADMAP.md`):** Das
  letzte "Zu testen"-Kriterium schlägt fehl — wechselt man das Ziel über diese Karte, während
  der Auswertung-Tab bereits einmal zuvor besucht (und damit gemountet) wurde, zeigt der
  Auswertung-Tab beim Zurückwechseln **ohne vollen Reload weiterhin unverändert die alte
  Bewertung** des vorherigen Profils (falsche Kalorien-/Makrozahlen, falscher Einordnungs-/
  Empfehlungstext) — keinerlei Hinweis auf die Diskrepanz. Nach einem vollen Seiten-Reload ist
  die Anzeige korrekt (Persistenz selbst ist nicht das Problem). Root Cause: fehlender
  Fokus-basierter Reload in `EvaluationSummaryScreen.tsx` — siehe `DI-009` für Details und
  Akzeptanzkriterien. Produktkritischer als ein reines Anzeigeproblem, da dem Nutzer eine
  sachlich falsche Bewertung als aktuell präsentiert wird, ohne jede Kennzeichnung.
- **Update 2026-07-15 — behoben durch `DI-009` und real re-verifiziert:**
  `EvaluationSummaryScreen.tsx` lädt jetzt per `useFocusEffect` bei jedem Tab-Fokus neu (statt
  nur beim ersten Mount). Erneut per Headless-Playwright/Chromium gegen `expo start --web`
  geprüft: Wechsel auf "Weight Loss" über diese Karte, danach zurück zu Auswertung **ohne
  Reload** — zeigt jetzt sofort die korrekte Weight-Loss-Bewertung (Kalorien, Defizit-Insight,
  Protein-Empfehlung), keine alte Evidence-based-Standard-Bewertung mehr sichtbar. Der
  bestehende In-Screen-Profilwechsel in der Auswertung bleibt unverändert funktionsfähig.
  Zusätzlich mit fünf schnellen Tab-Wechseln in Folge (ohne Wartezeit) stresstestet — keine
  Race-Condition-Artefakte, korrekter Endzustand. Null Browser-Konsolenfehler. Vollständige
  Evidenz in `ROADMAP.md`'s `DI-009`-Eintrag (Implementation notes / Verification results).

### 2026-07-10 — DI-005: Dashboard-Tab entfernt (AppNavigator/DashboardScreen)

- **Status:** ✅ geprüft
- **Branch/PR:** `claude/continuation-esc10o`
- **Betroffene Bereiche:** `src/presentation/navigation/AppNavigator.tsx` (Dashboard-Tab-
  Registrierung entfernt, `RootTabParamList` ohne `Dashboard`, Icon-Branch entfernt),
  `src/presentation/features/dashboard/DashboardScreen.tsx` (gelöscht, war mock-basiert).
  Nutzerentscheidung: Dashboard-Tab komplett entfernt, da der Ernährungs-Teil durch den
  Auswertung-Tab (DI-002) ersetzt ist; Recovery-/Nutrition-Tabs bleiben unangetastet (eigene,
  separate Frage).
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (107
  Suites / 813 Tests — keine dedizierten Dashboard-Tests vorhanden, also keine Testabdeckung
  verloren). Vollständiger Grep nach `DashboardScreen`/`GetDashboardSummary`/`Apptest`
  bestätigt keine verbleibenden Referenzen im Code.
- **Nicht verifiziert (visuell):** Tab-Leiste mit einem Tab weniger (Layout/Abstände der
  verbleibenden Tabs, insbesondere auf schmalen Bildschirmen), dass die App weiterhin korrekt
  mit `initialRouteName="Journal"` startet, dass kein Navigations-State/Deep-Link mehr auf
  `Dashboard` verweist.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 4 (Navigation &
  State). Konkret: App starten, prüfen dass genau sechs Tabs sichtbar sind (Protokoll/
  Ziele/Ernährung/Erholung/Vorlagen/Auswertung), kein "Dashboard"-Tab mehr vorhanden, keine
  Crash-/Fehlerdialoge beim Start.
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Kalter Boot zeigt exakt sechs Tabs (Protokoll/Ziele/Ernährung/
  Erholung/Vorlagen/Auswertung), kein "Dashboard"-Tab, App startet korrekt auf Protokoll,
  keine Crash-/Fehlerdialoge. Null Browser-Konsolenfehler über die gesamte Sweep-Session
  (mehrere Boots, Reloads, Tab-Wechsel, Formular-Interaktionen).

### 2026-07-10 — GE-007: Toter Progress-Call in JournalScreen entfernt

- **Status:** ✅ geprüft
- **Branch/PR:** `claude/continuation-esc10o`
- **Betroffene Bereiche:** `src/presentation/features/journal/JournalScreen.tsx` (Entfernung
  des `computeProgressForDateUseCase`-Aufrufs sowie des verworfenen, nie gerenderten
  `progress`-States; kein neuer sichtbarer UI-Bestandteil, reine Entfernung von totem Code
  gemäß Nutzerentscheidung).
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test`
  (`JournalScreen.submitGuard.test.ts` weiterhin grün). Da nur unbenutzter State/Aufruf
  entfernt wurde, ist kein Verhaltensunterschied im gerenderten Output zu erwarten.
- **Nicht verifiziert (visuell):** Dass Journal-Screen-Rendering/-Verhalten (Eingabe,
  Einträge-Liste, Summary-Bar) tatsächlich unverändert aussieht/funktioniert, insbesondere
  dass durch den Wegfall des zweiten `try/catch`-Blocks in `loadJournalData()` keine
  impliziten Timing-/Re-Render-Effekte entstanden sind.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test) und 7
  (Regressionscheck). Konkret: im Journal-Tab wie gewohnt Essen loggen, Einträge
  bearbeiten/löschen, Summary-Bar prüfen — sollte sich identisch zum vorherigen Verhalten
  anfühlen.
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Bearbeiten (Naturalsprache-Anweisung "100g statt 200g" auf
  einen 200g-Eintrag angewendet) ergibt korrekt einen proportional angepassten 100g/66kcal-
  Eintrag; Löschen entfernt den Eintrag korrekt und setzt die Summary-Bar auf 0 zurück — beides
  identisch zum erwarteten Verhalten, keine Regression durch die Entfernung des toten
  `computeProgressForDateUseCase`-Aufrufs. Null Browser-Konsolenfehler.

### 2026-07-10 — DI-002: Neuer Auswertungs-Tab (EvaluationSummaryScreen)

- **Status:** ✅ geprüft
- **Branch/PR:** `claude/continuation-esc10o`
- **Betroffene Bereiche:** `src/presentation/features/evaluationSummary/EvaluationSummaryScreen.tsx`
  (neu), `src/presentation/navigation/AppNavigator.tsx` (neuer Bottom-Tab "Auswertung"/
  `EvaluationSummary`, Icon `analytics`/`analytics-outline`). Erster echter Consumer der
  Evaluation Engine (GE-001–GE-005 + DI-001): zeigt Bewertung, Zielfortschritt pro Makro und
  Warnungen des aktiven Evaluation Profiles für heute, berechnet aus echten
  Journal-/Ziel-/Metabolismus-Daten. Enthält einen einfachen Ziel-Umschalter (Buttons pro
  registriertem Profil), der die aktive Auswertung live neu berechnet. Rührt die
  bestehende, mock-basierte `DashboardScreen`/`GetDashboardSummary` nicht an.
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (106
  Suites / 801 Tests, inkl. neuer `evaluationSummaryDisplay.test.ts` für die reine
  Anzeigelogik). Die komplette Anwendungslogik dahinter (Profile/Rules/Settings-Provider/
  Registry/Use-Cases) ist unit- und end-to-end-getestet (DI-001); nur das tatsächliche
  Rendering/die Interaktion in der App ist ungetestet, da diese Umgebung headless ist (kein
  Expo/Simulator, keine React-Native-Testing-Library im Projekt vorhanden).
- **Nicht verifiziert (visuell):** Tab-Icon/-Reihenfolge in der Bottom-Navigation, Layout des
  Ziel-Umschalters bei zwei (künftig mehr) Profilen auf schmalen Bildschirmen, Darstellung
  der Fehlermeldungen (fehlende Ziele/fehlendes Metabolismus-Profil) im Vergleich zu
  `GoalsScreen`s bestehenden Formularen, Keyboard-/Touch-Verhalten der Umschalt-Buttons.
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 2 (Layout & Rendering)
  und 3 (Interaktion & Eingabe). Konkret: im Ziele-Tab Metabolismus-Profil + Ziele setzen,
  im Journal etwas loggen, zum "Auswertung"-Tab wechseln — Bewertung + Fortschritt sollten
  die echten Journal-Daten widerspiegeln; auf "Weight Loss" umschalten und prüfen, dass sich
  Bewertung/Zielwerte sofort ändern (ohne dass sich die Journal-Einträge ändern).
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Beide im "Zu testen"-Feld genannten Kriterien bestätigt: nach
  Setzen von Metabolismus-Profil + Zielen und Loggen von "200g quark" im Journal zeigte der
  Auswertung-Tab sofort die reale Bewertung (132 kcal konsumiert von 2076 Ziel); der
  **In-Screen**-Profilwechsel (Auswertung's eigener Picker) auf "Weight Loss" änderte
  Bewertung/Zielwerte sofort und korrekt (Kalorienziel 2076→1661 etc.), ohne die
  Journal-Einträge zu verändern (bereits am selben Tag im `DI-008`-Sweep dokumentiert). Null
  Browser-Konsolenfehler.
- **Verwandter Fund (kein DI-002-Defekt, siehe `GE-008`/`DI-009`):** Derselbe Sweep fand, dass
  ein Profilwechsel über eine _andere_ Tab-Screen (`GoalsScreen`s "Ziel wählen"-Karte statt
  dieses Screens eigenem Picker) sich nicht im bereits gemounteten Auswertung-Tab
  niederschlägt, bis ein voller Reload erfolgt. Das war nicht Teil dieses Eintrags eigener
  "Zu testen"-Kriterien (die nur den In-Screen-Wechsel verlangen, welcher funktioniert),
  betrifft aber denselben Screen-Code (`EvaluationSummaryScreen.tsx`) und wird als `DI-009`
  in `ROADMAP.md` nachverfolgt.

### 2026-07-10 — SM-005: Neuer Saved-Meals-Tab (SavedMealsScreen)

- **Status:** ✅ geprüft (Defekt behoben durch `DI-009`, siehe unten)
- **Branch/PR:** `claude/continuation-esc10o`
- **Betroffene Bereiche:** `src/presentation/features/savedMeals/SavedMealsScreen.tsx` (neu),
  `src/presentation/navigation/AppNavigator.tsx` (neuer Bottom-Tab "Vorlagen"/`SavedMeals`,
  Icon `bookmark`/`bookmark-outline`). Erste UI-Oberfläche für die zuvor komplett
  unerreichbare Saved-Meals-Domäne (Vorlage aus heutigen Einträgen erstellen, loggen,
  umbenennen, löschen).
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (94 Suites
  / 768 Tests, inkl. neuer `savedMealsDisplay.test.ts` für die reine Anzeigelogik
  `templateTotalCalories`). Die komplette Anwendungslogik dahinter (Create/Log/List/Delete/
  Rename-Use-Cases, DI-Wiring in `container.ts`) ist unit-getestet; nur das tatsächliche
  Rendering/die Interaktion in der App ist ungetestet, da diese Umgebung headless ist (kein
  Expo/Simulator, keine React-Native-Testing-Library im Projekt vorhanden).
- **Nicht verifiziert (visuell):** Tab-Icon/-Reihenfolge in der Bottom-Navigation, Layout der
  Template-Zeilen (Name/Zutatenzahl/Kalorien-Schätzung + drei Aktionen "Loggen"/Stift/
  Papierkorb) auf schmalen Bildschirmen, Rename-Modal (gleiches Muster wie `JournalScreen`s
  Edit-Modal), Keyboard-Verhalten bei den beiden Texteingaben (Vorlagenname), Verhalten bei
  sehr vielen Vorlagen (kein Paging/Virtualisierung implementiert — bewusste MVP-Grenze).
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 2 (Layout & Rendering) und
  3 (Interaktion & Eingabe). Konkret: im Journal-Tab etwas loggen, zum "Vorlagen"-Tab
  wechseln, Vorlage aus heutigen Einträgen mit Namen erstellen, "Loggen" tippen und im
  Journal-Tab prüfen, dass ein neuer Eintrag mit demselben Namen/derselben Menge erscheint;
  Stift-Icon → umbenennen → Speichern; Papierkorb-Icon → Vorlage verschwindet aus der Liste.
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Vorlage-aus-heutigen-Einträgen-Erstellung, Umbenennen (Stift →
  Modal → Speichern) und Löschen (Papierkorb) funktionieren alle einwandfrei — Modal öffnet
  sauber, Liste aktualisiert sich korrekt nach jeder Aktion. Null Browser-Konsolenfehler.
- **Defekt gefunden (reproduzierbar, dokumentiert unter `DI-009` in `ROADMAP.md`):** Das
  "Loggen"-Kriterium schlägt fehl, wenn der Protokoll-Tab bereits zuvor besucht wurde: nach
  Antippen von "Loggen" bestätigt die Vorlagen-Seite selbst korrekt
  ("TESTFRUEHSTUECK" ZUM HEUTIGEN TAG HINZUGEFÜGT"), aber der **bereits gemountete
  Protokoll-Tab zeigt beim Zurückwechseln weiterhin nur den alten Eintrag** (keine
  Verdopplung sichtbar, aber auch kein neuer Eintrag) — bis ein voller Seiten-Reload erfolgt,
  danach zeigt der Protokoll-Tab korrekt beide Einträge (264 kcal statt 132 kcal). Persistenz
  ist also nicht das Problem, nur die Anzeige im bereits gemounteten Tab. Root Cause: fehlender
  Fokus-basierter Reload in `JournalScreen.tsx` — siehe `DI-009` für Details und
  Akzeptanzkriterien.
- **Update 2026-07-15 — behoben durch `DI-009` und real re-verifiziert:** `JournalScreen.tsx`
  lädt jetzt per `useFocusEffect` bei jedem Tab-Fokus neu (statt nur beim ersten Mount). Erneut
  per Headless-Playwright/Chromium gegen `expo start --web` geprüft: Vorlage aus Journal-Eintrag
  erstellt, über "Loggen" auf Vorlagen-Tab zum Tag hinzugefügt, danach zurück zu Protokoll
  **ohne Reload** — zeigt jetzt korrekt beide Einträge (264 kcal statt weiterhin 132 kcal).
  Zusätzlich mit fünf schnellen Tab-Wechseln in Folge stresstestet — keine doppelten Einträge,
  keine Race-Condition-Artefakte. Null Browser-Konsolenfehler. Vollständige Evidenz in
  `ROADMAP.md`'s `DI-009`-Eintrag (Implementation notes / Verification results).

### 2026-07-10 — J-005: Auto-Merge-Undo-Notification in JournalScreen

- **Status:** ✅ geprüft
- **Branch/PR:** `claude/continuation-g7eyp1`
- **Betroffene Bereiche:** `src/presentation/features/journal/JournalScreen.tsx` (neuer
  `autoMergeNotice`-Banner mit "Rückgängig"-Button, sichtbar wenn
  `LogFoodFromRawInputUseCase.execute()` einen stillen Same-Food-Merge durchgeführt hat)
- **Verifiziert durch Agent:** `npm run typecheck`, `npm run lint`, `npm run test` (740/740,
  inkl. neuer Tests für `UndoAutoMergeUseCase` und das enger gefasste 2-Minuten-Merge-Fenster
  in `LogFoodFromRawInputUseCase.test.ts`; `JournalScreen.submitGuard.test.ts` weiterhin grün).
  Die Anwendungslogik (Merge-Erkennung, Undo-Restaurierung, Correction-Log-Eintrag) ist damit
  vollständig unit-getestet.
- **Nicht verifiziert (visuell):** Ob der Banner in Expo/Simulator korrekt erscheint/verschwindet,
  Layout/Spacing neben `InputArea`/`InlineStatus`, Touch-Target-Größe des "Rückgängig"-Buttons
  (wiederverwendet `PrimaryButton`, aber in einer neuen, kompakteren Inline-Anordnung),
  Verhalten bei mehreren gleichzeitig geloggten Items (nur der erste Merge wird angezeigt —
  bewusste MVP-Einschränkung, aber ungetestet ob das UI dabei komisch wirkt).
- **Zu testen:** siehe Checkliste unten, Abschnitte 1 (Smoke-Test), 2 (Layout & Rendering) und
  3 (Interaktion & Eingabe). Konkret: "toast" loggen, innerhalb von 2 Minuten "300g toast"
  loggen, Banner "Mit vorherigem Eintrag zusammengeführt" + "Rückgängig" sollte erscheinen;
  Tippen auf "Rückgängig" sollte den Eintrag auf die Werte vor dem Merge zurücksetzen und den
  Banner ausblenden.
- **Verifiziert (visuell, 2026-07-15, Manual-Testing-Sweep, per Headless-Playwright/Chromium
  gegen `expo start --web`):** Exakt wie im "Zu testen"-Feld beschrieben durchgespielt: "toast"
  dann innerhalb des 2-Minuten-Fensters "300g toast" geloggt — Eintrag mergte korrekt zu einem
  einzigen 300g/783kcal-Eintrag (keine Duplizierung), Banner mit Touch-Target-großem
  "Rückgängig"-Button erschien sauber und gut lesbar. Klick auf "Rückgängig" stellte exakt die
  Werte vor dem Merge wieder her (35g/91.35kcal) und blendete den Banner korrekt aus. Kleine,
  nicht DoD-relevante Randbeobachtung: der separate "Erkannte Einträge"-Bereich (transiente
  Zusammenfassung der letzten Eingabe) zeigt nach einem Undo weiterhin die Vor-Undo-Werte, bis
  die nächste Eingabe submittet wird — kosmetisch, betrifft nicht den eigentlichen Journal-
  Eintrag/die Summary-Bar, kein eigener Task angelegt. Null Browser-Konsolenfehler.

### 2026-07-09 — Expo Testing Docs Setup + Governance-Bindung

- **Status:** ✅ geprüft (keine Code-/UI-Änderung — reine Dokumentation + Governance-Regeln)
- **Betroffene Bereiche:** `docs/MANUAL_TESTING_GAPS.md` (neu), `AGENTS.md`, `VERIFY.md` (Governance-Ergänzung)
- **Verifiziert durch Agent:** —
- **Nicht verifiziert:** —
- **Zu testen:** n/a

<!--
Vorlage für neue Einträge (Agents: bitte oben einfügen, neueste zuerst):

### YYYY-MM-DD — Kurzbeschreibung der Änderung

- **Status:** ⏳ offen
- **Branch/PR:** <link oder branch-name>
- **Betroffene Bereiche:** z. B. `src/features/nutrition/presentation/...`
- **Verifiziert durch Agent:** typecheck, lint, jest (welche Testdateien?)
- **Nicht verifiziert (visuell):** Layout, Touch-Targets, Keyboard-Verhalten, ...
- **Zu testen:** siehe Checkliste unten, Abschnitt "..."
-->

---

## Manuelle Test-Checkliste

Nutze diese Checkliste, wenn ein Log-Eintrag oben auf dich verweist. Häkchen sind als
Gedächtnisstütze gedacht, nicht als persistenter Status (kein Tracking-Tool).

### 1. Grundlegender Smoke-Test (immer, nach jedem UI-relevanten Merge)

- [ ] `npx expo start --dev-client` startet ohne Fehler
- [ ] App lädt auf Android (Dev Client) und/oder iOS (Simulator) ohne Crash
- [ ] Navigation zwischen den Haupt-Tabs funktioniert
- [ ] Keine roten Error-Overlays / unbehandelten Promise-Rejections in der Konsole

### 2. Layout & Rendering

- [ ] Betroffene Screens sehen auf Android **und** iOS korrekt aus (kein Plattform-Rendering-Unterschied übersehen)
- [ ] Safe-Area-Insets korrekt (Notch, Home-Indicator, Status-Bar)
- [ ] Verhalten bei verschiedenen Schriftgrößen (Dynamic Type / Font Scaling) geprüft
- [ ] Dark Mode / Warm-Neutral-Theme (`src/ui/theme.ts`) konsistent angewendet
- [ ] Lange Texte / Übersetzungen (DE) brechen das Layout nicht (Overflow, Clipping)

### 3. Interaktion & Eingabe

- [ ] Touch-Targets ausreichend groß und erreichbar
- [ ] Keyboard erscheint/verschwindet korrekt, verdeckt keine Eingabefelder
- [ ] Natural-Language-Food-Input: Eingabe, Autocomplete/Vorschläge, Fehlerzustände manuell geprüft
- [ ] Scroll-Verhalten (z. B. FlatList/ScrollView) bei langen Listen (Food-Log, Suchergebnisse)
- [ ] Pull-to-Refresh / Loading-Spinner sichtbar und nicht dauerhaft hängend

### 4. Navigation & State

- [ ] Deep-Links / Tab-Wechsel behalten erwarteten State
- [ ] Zurück-Navigation (Android Back-Button, iOS Swipe-back) funktioniert wie erwartet
- [ ] App-Neustart / Backgrounding erhält Session/Auth-State korrekt (AsyncStorage/Supabase)

### 5. Netzwerk & Backend-Integration (Supabase Edge Functions)

- [ ] Echte Requests gegen `food-off-search` / `food-usda-search` im Gerät/Simulator getestet
      (nicht nur gemockt in Jest)
- [ ] Fehlerzustände bei fehlender Internetverbindung sichtbar und verständlich
- [ ] Ladezeiten/Latenz im echten Netzwerk gefühlt akzeptabel

### 6. Plattform-spezifisches Verhalten

- [ ] Permissions-Dialoge (falls betroffen) erscheinen korrekt und mit sinnvollem Text
- [ ] Haptics/Sound-Feedback (falls implementiert) funktioniert auf echtem Gerät
- [ ] Verhalten bei Low-End-Gerät / langsamer CPU nicht ruckelig (falls Animationen betroffen)

### 7. Regressionscheck angrenzender Features

- [ ] Mindestens 1-2 benachbarte, nicht direkt geänderte Screens stichprobenartig gegengeprüft
      (typische Stelle für unbeabsichtigte Nebenwirkungen bei Shared Components/Theme)

---

## Bekannte strukturelle Grenzen der Agent-Verifikation

Diese Punkte sind grundsätzlicher Natur und gelten für **jede** Agent-Session in dieser Umgebung,
nicht nur für einzelne Log-Einträge:

- Jest-Tests in diesem Projekt prüfen primär Domain-/Application-Logik (Parsing, Nutrition-Pipeline,
  Resolver) — nicht das tatsächliche Rendering von React-Native-Komponenten mit realem Layout-Engine.
- `npm run verify` und `npm run typecheck` fangen Typfehler und Logikregressionen ab, aber keine
  visuellen Regressionen, keine Accessibility-Probleme und kein Timing-/Animationsverhalten.
- Für Supabase Edge Functions existieren Smoke-Tests (`npm run verify:edge`), die echte Requests
  ausführen — das deckt Backend-Erreichbarkeit ab, aber nicht die UI-seitige Darstellung der Antworten.

**Faustregel:** Wenn eine Änderung `src/**/presentation/**` oder sonstige `*.tsx`-Screens/Components
betrifft, sollte vor dem finalen "Done"-Status mindestens der Smoke-Test (Abschnitt 1) manuell
durchgeführt werden, auch wenn Typecheck/Lint/Tests grün sind.
