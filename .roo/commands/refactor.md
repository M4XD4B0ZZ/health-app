---
description: Führt ein kontrolliertes Refactoring durch
argument-hint: <datei oder modul>
mode: code
---

Führe ein kontrolliertes Refactoring für folgenden Bereich aus:

$ARGUMENTS

Ziele:
- Code verbessern ohne Verhalten zu ändern
- Lesbarkeit erhöhen
- Komplexität reduzieren
- Architektur respektieren

Vorgehen:
1. Analysiere die angegebene Datei oder den Modulbereich.
2. Lies die minimal relevanten Dateien im Kontext.
3. Identifiziere mögliche Verbesserungen.

Typische Refactorings:
- lange Funktionen aufteilen
- bessere Variablennamen
- unnötige Verschachtelung reduzieren
- kleine Duplikationen entfernen
- klare Struktur herstellen

Regeln:
- Verhalten darf sich nicht ändern.
- Keine neuen Dependencies einführen.
- Keine großen Architekturänderungen durchführen.
- Änderungen möglichst klein halten.

Antwortstruktur:
1. Kurz erklären, was verbessert werden kann
2. Refactoring durchführen
3. Geänderte Dateien anzeigen
4. Kurz zusammenfassen, was verbessert wurde