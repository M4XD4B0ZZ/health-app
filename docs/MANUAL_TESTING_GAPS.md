# Manual Testing Gaps (Headless-Agent-Einschränkungen)

Dieses Dokument protokolliert Fälle, in denen ein Agent (Claude Code o.ä.) eine Änderung
**nicht visuell** in einem Browser/Simulator/Gerät testen konnte, weil die Ausführungsumgebung
headless ist (kein React Native/Expo-Runtime, kein Android Emulator, kein iOS Simulator).

Ziel: Du siehst auf einen Blick, welche Änderungen nur durch Typecheck/Lint/Unit-Tests
verifiziert wurden und wo noch ein **manueller App-Test in Expo** aussteht.

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

### 2026-07-09 — Expo Testing Docs Setup

- **Betroffene Bereiche:** (initialer Eintrag, keine Code-Änderung — Dokumentation only)
- **Verifiziert durch Agent:** —
- **Nicht verifiziert:** —
- **Zu testen:** n/a (Dieses Dokument selbst wurde nur als Doku angelegt)

<!--
Vorlage für neue Einträge:

### YYYY-MM-DD — Kurzbeschreibung der Änderung

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
