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

Wenn eine Session/PR mit einem Hinweis wie *"Ich konnte die UI nicht visuell testen"* endet,
trage einen neuen Eintrag unten ein (neueste zuerst) und fülle die Checkliste aus dem passenden
Abschnitt in [Manuelle Test-Checkliste](#manuelle-test-checkliste) entsprechend.

---

## Log

### 2026-07-10 — DI-005: Dashboard-Tab entfernt (AppNavigator/DashboardScreen)

- **Status:** ⏳ offen
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

### 2026-07-10 — GE-007: Toter Progress-Call in JournalScreen entfernt

- **Status:** ⏳ offen
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

### 2026-07-10 — DI-002: Neuer Auswertungs-Tab (EvaluationSummaryScreen)

- **Status:** ⏳ offen
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

### 2026-07-10 — SM-005: Neuer Saved-Meals-Tab (SavedMealsScreen)

- **Status:** ⏳ offen
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

### 2026-07-10 — J-005: Auto-Merge-Undo-Notification in JournalScreen

- **Status:** ⏳ offen
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
