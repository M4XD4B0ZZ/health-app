---
description: Prüft Git-Status, fasst Änderungen zusammen und erstellt einen sauberen Commit
argument-hint: <kurzer fokus oder leer>
mode: code
---

Führe einen sicheren Git-Commit-Workflow aus.

Ziele:

- Prüfe zuerst den aktuellen Git-Status.
- Lies nur die minimal relevanten geänderten Dateien oder Diffs.
- Erstelle eine kurze Zusammenfassung dessen, was tatsächlich geändert wurde.
- Formuliere daraus eine präzise, sinnvolle Commit-Message im Conventional-Commit-Stil.
- Stage die relevanten Änderungen.
- Erstelle den Commit.
- Push **nicht** automatisch.

Regeln für die Commit-Message:

- Format: `type(scope): summary`
- Erlaubte Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`
- Summary klein geschrieben, konkret, ohne unnötige Füllwörter
- Maximal etwa 72 Zeichen in der ersten Zeile
- Scope nur verwenden, wenn klar erkennbar

Pflichtschritte:

1. `git status --short`
2. Bei Bedarf `git diff --staged` und/oder `git diff`
3. Kurz begründen, welche Commit-Message gewählt wird
4. Relevante Änderungen stagen
5. Commit erstellen
6. Abschließend den finalen Commit-Namen ausgeben

Wenn der Arbeitsbaum leer ist, brich sauber ab.
Wenn untracked oder offensichtlich irrelevante Dateien vorhanden sind, stage nicht blind alles.
Wenn die Änderungen gemischt oder unklar sind, schlage vor, sie logisch zu trennen statt einen schlechten Sammel-Commit zu machen.
