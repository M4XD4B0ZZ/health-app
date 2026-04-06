# Plans Directory Rules

## Plan Creation Location

Alle Planungsdokumente müssen im `plans/` Ordner erstellt werden.

### Regel

- **NIEMALS** Plan-Dateien im Projekt-Root erstellen
- **IMMER** Plan-Dateien in `plans/` erstellen
- Plan-Dateien erkennt man an Dateinamen mit `PLAN` im Namen

### Beispiele

Korrekt:
```
plans/USER_AUTH_IMPLEMENTATION_PLAN.md
plans/DATABASE_MIGRATION_PLAN.md
plans/API_REFACTOR_PLAN.md
```

Falsch:
```
USER_AUTH_IMPLEMENTATION_PLAN.md (im Root)
DATABASE_MIGRATION_PLAN.md (im Root)
```

### Namenskonvention

- `[FEATURE]_[TYPE]_PLAN.md` für Feature-spezifische Pläne
- `[COMPONENT]_IMPLEMENTATION_PLAN.md` für Implementierungspläne
- `[AREA]_TEST_PLAN.md` für Testpläne

### Automatische Erkennung

Wenn ein Agent eine Datei mit `PLAN` im Namen erstellen möchte:
1. Prüfe, ob der Pfad mit `plans/` beginnt
2. Falls nicht, korrigiere den Pfad automatisch zu `plans/[filename]`
3. Informiere den Benutzer über die Korrektur

### Referenzierung

Bei Referenzen auf Plan-Dateien immer den vollständigen Pfad verwenden:
- `plans/BLS_DACH_GENERIC_SOURCE_IMPLEMENTATION_PLAN.md`
- Nicht: `BLS_DACH_GENERIC_SOURCE_IMPLEMENTATION_PLAN.md`