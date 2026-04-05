# Kurz-Anleitung: Wiederholende Tests mit Logs in einem Fenster

Diese Anleitung unterstützt die feste Debug-Testserie für `P0-007 Proof-of-Call Tracing`.

## 1. Emulator vorher starten

Starte den Android-Emulator vor Expo.

Dann musst du in Expo nicht mehr `a` drücken.

## 2. Alte Logdatei löschen

```powershell
Remove-Item .\expo_logs.txt -ErrorAction SilentlyContinue
```

## 3. Expo direkt mit Android starten und in Datei loggen

```powershell
npx expo start --android > expo_logs.txt 2>&1
```

## 4. Genau definierte Testserie ausführen

Für saubere Vergleiche immer dieselbe Reihenfolge verwenden:

1. `ei`
2. direkt nochmal `ei`
3. `eier`
4. `quark`
5. `200g quark`
6. `toast`
7. `buttertoast`
8. `200g rührei`

## 5. Nach der Serie `Ctrl + C`

Danach ist `expo_logs.txt` vollständig geschrieben.

## 6. Logdatei gezielt durchsuchen

```powershell
Select-String -Path .\expo_logs.txt -Pattern "PROOF_USECASE_ENTERED|DUPLICATE|OFF|USDA|RESOLVER_DEBUG|ERROR|BLOCKED"
```

## Wichtig für Debug-Runs

Immer nur eine kurze, feste Testserie pro Logfile verwenden.

Nicht ewig weiter testen, sonst wird die Auswertung unübersichtlich.
