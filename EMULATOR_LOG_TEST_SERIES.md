# Kurz-Anleitung: Wiederholende Tests mit Logs in einem Fenster

Diese Anleitung unterstützt die feste Debug-Testserie für `P0-007 Proof-of-Call Tracing`.

## 1. Debug-Skript starten

Die neue Standard-Vorgehensweise zum Erfassen der Logs ist das Skript `scripts/debug-run.ps1`.

Wenn du ein Terminal außerhalb des Projekts geöffnet hast:

```powershell
cd D:\Workspaces_VSCode\HealthApp; powershell -ExecutionPolicy Bypass -File .\scripts\debug-run.ps1
```

Alternativ direkt aus dem Projekt-Root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\debug-run.ps1
```

Wenn du bereits im Projekt-Root `D:\Workspaces_VSCode\HealthApp` bist, geht auch:

```powershell
.\scripts\debug-run.ps1
```

Das Skript übernimmt:

- ADB-Start
- Emulator-Start falls noch kein Gerät läuft
- Warten bis der Emulator als `device` erkannt wird
- Löschen der alten `expo_logs.txt`
- Start von Expo mit Umleitung aller Logs nach `expo_logs.txt`

## 2. Genau definierte Testserie ausführen

Für saubere Vergleiche immer dieselbe Reihenfolge verwenden:

1. `ei`
2. direkt nochmal `ei`
3. `eier`
4. `quark`
5. `200g quark`
6. `toast`
7. `buttertoast`
8. `200g rührei`

## 3. Nach der Serie `Ctrl + C`

Danach ist `expo_logs.txt` vollständig geschrieben.

## 4. Logdatei gezielt durchsuchen

```powershell
Select-String -Path .\expo_logs.txt -Pattern "PROOF_USECASE_ENTERED|DUPLICATE|OFF|USDA|RESOLVER_DEBUG|ERROR|BLOCKED"
```

## Wichtig für Debug-Runs

Immer nur eine kurze, feste Testserie pro Logfile verwenden.

Nicht ewig weiter testen, sonst wird die Auswertung unübersichtlich.
