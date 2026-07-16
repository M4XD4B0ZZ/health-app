# NATIVE-001 — Android Standalone Build Crashes on Cold Start: Diagnose

**Datum:** 2026-07-16
**Branch:** `claude/app-testing-evaluation-yogpjt` (PR #45)
**Schweregrad:** Blocker — blockiert UT-001 Phase B (Dogfooding) und jeden weiteren nativen Test
**ROADMAP-Task:** `NATIVE-001` (Status `in_progress` — Code-Fix gelandet, Geräte-Verifikation ausstehend)

---

## 1. Beobachtetes Verhalten (Evidenz vom Gerät)

- Der installierte Android-Standalone-Build (Stand **vor** PR #45 — GE-009/SM-007/J-007 sind
  nicht Teil dieses Binaries) schließt sich bei **jedem** Start sofort.
- Samsung-Systemdialog: „Zera geschlossen, da diese App einen Fehler enthält. Versuche, zuerst
  den Cache der App zu leeren…" (Screenshot vom 2026-07-16, 19:58).
- Cache-Leeren ändert nichts.
- Die App erreicht **keinen ersten Frame** — kein Splash-übergang, kein UI.
- Ein `adb logcat` liegt noch nicht vor (Erfassungsanleitung: Abschnitt 6).

## 2. Root Cause

### 2.1 Mechanismus — **bewiesen** (Code-Inspektion + Live-Reproduktion)

`src/infrastructure/supabase/supabaseClient.ts` warf (vor dem Fix) auf **Modulebene**:

```ts
const url = process.env.EXPO_PUBLIC_SUPABASE_URL?.trim();
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY?.trim();
if (!url) throw new Error('Missing EXPO_PUBLIC_SUPABASE_URL'); // Zeile 6
if (!anonKey) throw new Error('Missing EXPO_PUBLIC_SUPABASE_ANON_KEY');
```

Dieses Modul liegt auf dem **unbedingten Boot-Pfad**:

```
index.ts → App.tsx → src/presentation/App.tsx
                        └─ import container (../infrastructure/di/container)
                              └─ container.ts:58  import { supabase } from '../supabase/supabaseClient'
                              └─ container.ts:615 const container = new Container()  ← Modulebene
```

Ein Repo-weiter Grep bestätigt: Die drei Zeilen in `supabaseClient.ts` sind die **einzigen**
Modul-Scope-Throws im gesamten `src/`. Fehlen die Variablen zur Bundle-Zeit, ersetzt Metro
`process.env.EXPO_PUBLIC_*` durch `undefined` → der Throw feuert bei **jeder**
Bundle-Auswertung, bevor React irgendetwas rendert. Im Release-Build gibt es kein Dev-Overlay:
Die unbehandelte JS-Exception beendet den Prozess — exakt das beobachtete Sofort-Schließen.
Cache-Leeren kann prinzipiell nicht helfen, weil die Werte zur **Buildzeit** eingebettet werden;
zur Laufzeit ist nichts reparierbar.

**Live-Reproduktion (dieser Container, 2026-07-16):** `expo start --web` **ohne** `.env`
gestartet, Seite per Headless-Chromium geladen:

```
BODY_TEXT: ""                      ← null gerenderte Elemente
APP_RENDERED_TABBAR: false
ERROR_COUNT: 1
ERR: PAGEERROR: Missing EXPO_PUBLIC_SUPABASE_URL
```

Derselbe Codepfad, dasselbe Symptom (kein erster Frame) — auf Web als leere Seite mit
unbehandelter Exception, nativ als Prozessabbruch.

### 2.2 Auslöser — **sehr wahrscheinlich** (Indizienkette; finale Bestätigung per Gerät)

**H1 (dominant): Der Build wurde ohne die `EXPO_PUBLIC_SUPABASE_*`-Variablen erzeugt.**

- `.env` ist gitignored (`.gitignore` Z. 36–38) — sie ist **nie** Teil des Uploads eines
  Remote-EAS-Builds.
- Das Repo enthält **kein `eas.json`** und keinen `env`-/`extra`-Block in `app.json` — nirgends
  im Repo ist eine Build-Env-Quelle für diese Variablen definiert.
- Der A0-Bericht dokumentiert dasselbe Verhalten unabhängig: Auch der Web-Boot brauchte eine
  lokale `.env`, sonst warf `supabaseClient` beim Start.
- Jest maskiert den Pfad vollständig (`src/test-setup.ts` setzt beide Variablen und mockt
  `@supabase/supabase-js`) — deshalb sind 862 Tests grün, obwohl der Fehlerpfad nie geprüft war.

**H2 (nachrangig): Natives Init-Problem** (z. B. New Architecture/`newArchEnabled: true`,
Bibliotheks-Inkompatibilität). Unwahrscheinlich: Alle Dependencies sind Standard-Expo-SDK-54-
Bibliotheken (`react-navigation`, `async-storage`, `safe-area-context`, `screens`,
`vector-icons`), keine Custom-Native-Module. Nicht per Code-Inspektion ausschließbar — aber in
einem Schritt von H1 unterscheidbar (siehe 2.3).

**H3 (vernachlässigbar):** `new URL()`-Polyfill-Eigenheit auf Hermes trotz gesetzter Variablen —
absolute `https://`-URLs werden vom RN-URL-Polyfill unterstützt.

### 2.3 Entscheidendes Unterscheidungskriterium

Eine einzige Logcat-Zeile entscheidet H1 vs. H2 endgültig:

- `Missing EXPO_PUBLIC_SUPABASE_URL` (bzw. `..._ANON_KEY`) in
  `FATAL EXCEPTION`/`AndroidRuntime`/`ReactNativeJS` → **H1 bestätigt**.
- Ein nativer Stack **ohne** diese Meldung → H2 wieder öffnen (dann bitte Logcat anhängen).

Alternativ bestätigt auch der erfolgreiche Kaltstart des **neuen** Builds mit gesetzten
Variablen H1 rückwirkend.

## 3. Fix (kleinste sichere Änderung — auf diesem Branch gelandet)

Zwei Ebenen, beide nötig:

### 3.1 Konfiguration (die eigentliche Ursache — nur vom Maintainer lösbar)

`EXPO_PUBLIC_SUPABASE_URL` und `EXPO_PUBLIC_SUPABASE_ANON_KEY` müssen zur **Buildzeit** in der
Umgebung des tatsächlich genutzten Build-Profils vorhanden sein:

- **EAS (empfohlen):** expo.dev → Projekt → _Environment variables_ → beide Variablen für das
  genutzte Environment (`development`/`preview`/`production`) anlegen; oder per CLI
  `eas env:create`. Alternativ im lokalen `eas.json` als `env`-Block des Build-Profils.
- **Lokaler Build** (`npx expo run:android --variant release`): lokale `.env` genügt.
- Keine Werte in diesen Report oder andere committete Dateien kopieren (Repo-Regel; der
  Anon-Key ist zwar „publishable", bleibt aber besser außerhalb des Repos).

### 3.2 Code-Härtung (damit Fehlkonfiguration nie wieder ein stummer Prozess-Tod ist)

- **`src/infrastructure/supabase/supabaseClient.ts`:** Modul-Scope-Throw entfernt. Validierung
  in pure Funktion `validateSupabaseConfig()` extrahiert; Export `supabaseConfigError:
string | null`. Bei fehlender Konfiguration wird der Client mit syntaktisch validem
  Platzhalter erzeugt (Modul-Auswertung und DI-Container-Konstruktion bleiben crash-frei); er
  ist in diesem Zustand unerreichbar, weil —
- **`src/presentation/App.tsx`** vor dem Navigator `supabaseConfigError` prüft und stattdessen
  einen blockierenden „Konfigurationsfehler"-Screen rendert (Titel, Erklärung, Name der
  fehlenden Variable; Warm-Neutral-Tokens).
- **Neu: `src/infrastructure/supabase/__tests__/validateSupabaseConfig.test.ts`** (6 Tests:
  valide Konfig, fehlende URL, Whitespace-URL, fehlender Key, ungültige URL, Rückgabetyp).
- **Umgeschrieben: `src/infrastructure/supabase/__tests__/supabaseClient.test.ts`** — die
  bestehende P2-001-Suite assertete, dass der Modul-_Import wirft_ (also exakt den
  Crash-Mechanismus, den dieser Task entfernt). Sie prüft jetzt die neue Invariante: Import
  wirft nie; `supabaseConfigError` benennt die fehlende Variable; valide Konfig → `null`.
- **P2-001-Hinweis:** P2-001 („App throws fatal error on boot if variables are missing") bleibt
  im Intent erhalten — strikte Prüfung beim Boot, App bei Fehlkonfiguration vollständig
  unbenutzbar. Geändert ist nur der Mechanismus: sichtbarer Fatal-Screen statt Prozessabbruch
  vor dem ersten Frame. Bewusste, dokumentierte Anpassung (kein stilles Reversal).

### 3.3 Verifikation des Fixes (diese Umgebung)

| Prüfung                  | Vorher                                                               | Nachher                                                                                 |
| ------------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| Web-Boot **ohne** `.env` | Leere Seite, `PAGEERROR: Missing EXPO_PUBLIC_SUPABASE_URL`, 0 Frames | „Konfigurationsfehler"-Screen mit Variablenname, **0** unbehandelte Fehler (Screenshot) |
| Web-Boot **mit** `.env`  | normal                                                               | unverändert normal (4 Tabs, 0 Page-Errors)                                              |
| `npm run verify`         | grün                                                                 | grün (inkl. 6 neuer Tests)                                                              |

Natives Rendering des neuen Screens: offen, in `docs/MANUAL_TESTING_GAPS.md` protokolliert —
wird implizit durch den Kaltstart-Check des neuen Builds mit **korrekten** Variablen gar nicht
sichtbar (dann bootet die App normal); explizit prüfbar nur mit einem absichtlich
fehlkonfigurierten Build.

## 4. Ist ein neuer EAS-Build erforderlich?

**Ja, zwingend — unabhängig vom Code-Fix.** Das installierte Binary hat die fehlenden Werte
(als `undefined`) fest im Bundle. Reihenfolge:

1. Env-Variablen für das Build-Profil setzen (3.1).
2. Diesen Branch mergen (oder vom Branch bauen), damit GE-009/SM-007/J-007/NATIVE-001 im Build sind.
3. Neuen Build erzeugen, **alte App vollständig deinstallieren**, neuen Build installieren.
4. **Nur Kaltstart prüfen.** Erst wenn die App den Protokoll-Tab erreicht, native Testliste fortsetzen.

## 5. Build-Metadaten des gecrashten Builds (vom Maintainer zu notieren)

Für die Akte, bevor der alte Build ersetzt wird: Build-ID/-Seite, gebauter Commit-SHA,
Build-Profil, zugeordnetes EAS-Environment, Build-Zeitpunkt. (Bestätigt zusammen mit 2.3 die
Diagnose endgültig; für den Fix nicht blockierend.)

## 6. Logcat-Erfassung (falls der neue Build wider Erwarten wieder crasht)

Mit USB-Debugging (Windows PowerShell):

```powershell
adb devices
adb logcat -c
adb logcat -v time > zera-crash-log.txt
# → Zera öffnen, Crash abwarten, Strg+C
Select-String -Path .\zera-crash-log.txt -Pattern 'FATAL EXCEPTION|AndroidRuntime|ReactNativeJS|Caused by|Supabase|Expo'
```

Erwartete H1-Signatur: eine `FATAL EXCEPTION`-/`AndroidRuntime`-Sektion mit
`Missing EXPO_PUBLIC_SUPABASE_URL` (oder `..._ANON_KEY`). Keine Schlüsselwerte in öffentliche
Reports kopieren — Variablennamen genügen.

## 7. Geänderte Dateien / Checks (Handoff)

- `src/infrastructure/supabase/supabaseClient.ts` (Härtung)
- `src/presentation/App.tsx` (Fatal-Config-Screen)
- `src/infrastructure/supabase/__tests__/validateSupabaseConfig.test.ts` (neu, 6 Tests)
- `ROADMAP.md` (NATIVE-001, Blocker, `in_progress`)
- `docs/MANUAL_TESTING_GAPS.md` (Eintrag: nativer Check des Fatal-Screens offen)
- dieser Report
- Checks: `npm run verify` grün (Kategorie 4, Product/runtime code); Live-Web-Verifikation
  beider Boot-Pfade wie in 3.3; keine Dependency-Änderungen. Kein unrelated Cleanup.
