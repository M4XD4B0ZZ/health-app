---
description: Prüft Änderungen, erzeugt eine sinnvolle Commit-Message und pusht den aktuellen Branch
argument-hint: <kurzer fokus oder leer>
mode: code
---

Führe einen kontrollierten Git-Commit-und-Push-Workflow aus.

Ziele:

- Prüfe zuerst den aktuellen Git-Status.
- Lies nur die minimal relevanten geänderten Dateien oder Diffs.
- Formuliere auf Basis der tatsächlichen Änderungen eine präzise Commit-Message.
- Stage die relevanten Änderungen.
- Erstelle einen Commit.
- Ermittle den aktuellen Branch.
- Push den aktuellen Branch zum zugehörigen Remote.

Regeln für die Commit-Message:

- Format: `type(scope): summary`
- Erlaubte Types: `feat`, `fix`, `refactor`, `docs`, `test`, `chore`, `perf`, `build`, `ci`
- Summary klein geschrieben, konkret, ohne unnötige Füllwörter
- Maximal etwa 72 Zeichen in der ersten Zeile
- Scope nur verwenden, wenn klar erkennbar

Pflichtschritte:

1. `git status --short`
2. Bei Bedarf `git diff --staged` und/oder `git diff`
3. Kurz erklären, warum die gewählte Commit-Message passt
4. Relevante Änderungen stagen
5. Commit erstellen
6. Aktuellen Branch ermitteln
7. Push des aktuellen Branches ausführen
8. Nach dem Push: `git fetch origin <default-branch>` ausführen. Prüfen, ob der
   Basis-Branch seit dem Start des aktuellen Branches neue Commits erhalten hat
   (`git log <branch>..origin/<default-branch> --oneline`). Falls ja, das explizit
   melden statt still weiterzuarbeiten — siehe AGENTS.md, "Git Branch Sync After Push".
9. Am Ende Commit-Hash, Branch und Push-Ziel knapp ausgeben (inkl. Hinweis, falls der
   Basis-Branch inzwischen abweicht)

Wichtige Sicherheitsregeln:

- Nicht blind `git add .` verwenden, wenn irrelevante oder sensible Dateien sichtbar sind.
- Keine `.env`, Secrets, Exporte, Backups oder Datenbankdateien committen.
- Wenn kein Upstream existiert, setze den Push passend für den aktuellen Branch.
- Wenn der Arbeitsbaum leer ist, brich sauber ab.
- Wenn die Änderungen offensichtlich mehrere Themen mischen, stoppe und schlage getrennte Commits vor statt eines Sammel-Commits.
