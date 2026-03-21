---
description: Führt ein strukturiertes Code Review durch
argument-hint: <datei oder bereich>
mode: architect
---

Führe ein strukturiertes Code Review durch.

Ziel:

- Qualität sichern
- Risiken erkennen
- Architekturverletzungen finden

Vorgehen:

1. Wenn keine Argumente angegeben sind, analysiere nur die aktuellen Git-Änderungen (staged + unstaged diff).
2. Wenn ein Pfad (Datei oder Verzeichnis) angegeben ist, analysiere diesen Bereich.
3. Wenn explizit "repo" oder "full" angegeben wird, analysiere das gesamte Repository.

4. Lies relevante Dateien im Kontext.
5. Prüfe folgende Aspekte:
6. Lies relevante Dateien im Kontext.
7. Prüfe folgende Aspekte:

Codequalität

- Lesbarkeit
- Struktur
- Komplexität

Architektur

- Einhaltung der Modulgrenzen
- Abhängigkeiten
- Layer-Trennung

Fehlerquellen

- Edge Cases
- mögliche Bugs
- Performanceprobleme

Verbesserungen

- konkrete Verbesserungsvorschläge
- kleine Refactors

Antwortstruktur:

1. Überblick
2. Gefundene Probleme
3. Verbesserungsvorschläge
4. Architekturhinweise
