# Agent Orchestrator Scripts

Dieses Verzeichnis enthält Scripts für die sichere Agent-Orchestrator-Foundation des HealthApp-Projekts.

## Zweck

Die Agent-Scripts bereiten Arbeitsaufträge für VS Code + Roo vor, ohne autonome Codeänderungen durchzuführen. Sie analysieren die Governance-Dateien und erstellen strukturierte Prompts und Reports.

## Verfügbare Scripts

### 1. select-next-task.mjs

**Zweck:** Wählt den nächsten sinnvollen Task aus ROADMAP.md aus.

**Verhalten:**

- Liest ROADMAP.md und parst alle Tasks
- Bevorzugt ersten Task mit Status `in_progress`
- Falls kein `in_progress`, ersten Task mit Status `todo`
- Schreibt Ergebnis als JSON nach `.agent/out/selected-task.json`

**Verwendung:**

```bash
npm run agent:next
```

**Output:** `.agent/out/selected-task.json`

### 2. build-roo-prompt.mjs

**Zweck:** Erstellt einen Roo-kompatiblen Prompt mit allen relevanten Governance-Informationen.

**Verhalten:**

- Liest `.agent/out/selected-task.json`
- Erstellt strukturierten Prompt mit:
  - Task-Informationen
  - Governance-Dateien (PFLICHT LESEN)
  - Sicherheitsgrenzen
  - Architektur-Grenzen
  - Verify-Erwartungen
  - Handoff-Template

**Verwendung:**

```bash
npm run agent:prompt
```

**Voraussetzung:** `npm run agent:next` muss zuerst ausgeführt werden.

**Output:** `.agent/out/next-prompt.md`

### 3. run-verify.mjs

**Zweck:** Führt die Standard-Verification-Pipeline aus und erstellt einen Report.

**Verhalten:**

- Führt sequenziell aus:
  - `npm run typecheck`
  - `npm run lint`
  - `npm run format:check`
  - `npm run test`
- Sammelt alle Ergebnisse
- Erstellt strukturierten Report
- Setzt korrekten Exit-Code

**Verwendung:**

```bash
npm run agent:verify
```

**Output:** `.agent/out/verify-report.md`

**Hinweis:** `verify:edge` wird NICHT automatisch ausgeführt (benötigt .env-Datei).

### 4. write-handoff-template.mjs

**Zweck:** Erstellt ein strukturiertes Handoff-Template für die Dokumentation abgeschlossener Arbeiten.

**Verhalten:**

- Generiert vollständiges Handoff-Template
- Enthält alle erforderlichen Abschnitte:
  - Task-Informationen
  - Änderungen (neue/geänderte/gelöschte Dateien)
  - Begründung
  - Verification-Checks
  - Ergebnisse
  - Risiken
  - Follow-ups

**Verwendung:**

```bash
npm run agent:handoff
```

**Output:** `.agent/out/handoff-template.md`

### 5. run-agent-loop.mjs (Phase B)

**Zweck:** Implementiert einen einfachen, sicheren Workflow-State für das bestehende Agent-Script-System.

**Verhalten:**

- Verwaltet Agent-State in `.agent/state.json`
- Führt automatisch die richtige Phase basierend auf vorhandenen Dateien aus:
  - **Phase A:** Task-Auswahl (wenn kein selected-task.json)
  - **Phase B:** Prompt-Generierung (wenn Task ausgewählt, aber kein Prompt)
  - **Phase C:** Warten auf Roo-Implementierung (Gate für manuelle Arbeit)
  - **Phase D:** Verify-Report-Analyse und Handoff oder Fix-Prompt
- Setzt klare Gates für manuelle Intervention
- Erstellt Fix-Prompts bei Verify-Fehlern

**Verwendung:**

```bash
npm run agent:run
```

**State-Datei:** `.agent/state.json`

**Zusätzliche Outputs:**

- `.agent/out/fix-prompt.md` - Fix-Prompt bei Verify-Fehlern

**Wichtige Gates:**

- **Roo-Gate:** Stoppt für manuelle Code-Implementierung
- **Review-Gate:** Stoppt für manuelle Review und Commit
- **Fix-Gate:** Stoppt für manuelle Fehler-Behebung

## Empfohlener Ablauf

### Neuer Workflow (Phase B) - Empfohlen

```bash
npm run agent:run
```

Führt automatisch die richtige Phase aus und stoppt an Gates für manuelle Intervention.

### Manueller Workflow (Phase A) - Weiterhin verfügbar

### 1. Task-Auswahl

```bash
npm run agent:next
```

Zeigt verfügbaren Task und schreibt JSON-Output.

### 2. Prompt-Generierung

```bash
npm run agent:prompt
```

Erstellt Roo-kompatiblen Prompt mit allen Governance-Informationen.

### 3. Manuelle Arbeit

- Öffne `.agent/out/next-prompt.md`
- Kopiere Prompt in Roo/VS Code
- Arbeite entsprechend den Governance-Regeln

### 4. Verification

```bash
npm run agent:verify
```

Führt alle Standard-Checks aus und erstellt Report.

### 5. Handoff-Dokumentation

```bash
npm run agent:handoff
```

Erstellt Template für strukturierte Dokumentation der Arbeit.

## Phase B - Agent State + agent:run Loop

### State-Management

**State-Datei:** `.agent/state.json`

Die State-Datei wird automatisch initialisiert und enthält:

```json
{
  "currentTaskId": null,
  "currentTaskTitle": null,
  "status": "idle",
  "lastStep": null,
  "iteration": 0,
  "verifyPassed": false,
  "lastUpdated": "2026-04-26T10:43:00.000Z"
}
```

### Status-Werte

| Status                           | Bedeutung                                        |
| -------------------------------- | ------------------------------------------------ |
| `idle`                           | Kein aktiver Task                                |
| `task_selected`                  | Task ausgewählt                                  |
| `prompt_ready`                   | Roo-Prompt erstellt                              |
| `waiting_for_roo_implementation` | Gate: Warten auf manuelle Roo-Arbeit             |
| `verify_failed`                  | Verification fehlgeschlagen, Fix-Prompt erstellt |
| `ready_for_human_review`         | Gate: Bereit für manuelle Review                 |
| `error`                          | Unerwarteter Fehler                              |

### Gates (Manuelle Intervention erforderlich)

#### 1. Roo-Implementation Gate

- **Trigger:** Prompt erstellt, aber noch keine Implementierung
- **Aktion:** Kopiere `.agent/out/next-prompt.md` in Roo
- **Weiter:** `npm run agent:verify` nach Implementierung

#### 2. Fix Gate

- **Trigger:** Verification fehlgeschlagen
- **Aktion:** Kopiere `.agent/out/fix-prompt.md` in Roo
- **Weiter:** `npm run agent:verify` nach Fix

#### 3. Review Gate

- **Trigger:** Verification erfolgreich
- **Aktion:** Review git diff, verify report, handoff template
- **Weiter:** Manueller Commit wenn akzeptabel

### Workflow-Phasen

#### Phase A: Task-Auswahl

- Führt `select-next-task.mjs` aus
- Aktualisiert State mit Task-Informationen
- Erhöht Iteration-Counter

#### Phase B: Prompt-Generierung

- Führt `build-roo-prompt.mjs` aus
- Erstellt Roo-kompatiblen Prompt
- Setzt Status auf `prompt_ready`

#### Phase C: Roo-Implementation Gate

- **STOPPT** für manuelle Arbeit
- Zeigt klare Anweisungen für nächste Schritte
- Kein automatischer Code-Ausführung

#### Phase D: Verify-Analyse

- Analysiert Verify-Report
- **Bei Erfolg:** Erstellt Handoff-Template → Review Gate
- **Bei Fehler:** Erstellt Fix-Prompt → Fix Gate

## Sicherheitsgrenzen

### ✅ Was die Scripts TUN

- Lesen von Governance-Dateien (ROADMAP.md, AGENTS.md, VERIFY.md, SSOK.md)
- Parsen und Analysieren von Task-Informationen
- Erstellen von strukturierten Prompts und Templates
- Ausführen von Verification-Commands
- Schreiben von Reports nach `.agent/out/`

### ❌ Was die Scripts NICHT TUN

- **Keine .env-Dateien** lesen oder verändern
- **Keine Secrets** oder API-Keys verarbeiten
- **Keine Codeänderungen** durchführen
- **Keine Dependencies** installieren
- **Keine automatischen Commits** oder Pushes
- **Keine OpenCode-Ausführung** (nur Vorbereitung)

## Output-Verzeichnis

Alle Script-Outputs werden in `.agent/out/` gespeichert:

- `selected-task.json` - Ausgewählter Task (von select-next-task.mjs)
- `next-prompt.md` - Roo-Prompt (von build-roo-prompt.mjs)
- `verify-report.md` - Verification-Report (von run-verify.mjs)
- `handoff-template.md` - Handoff-Template (von write-handoff-template.mjs)

## Governance-Integration

Die Scripts respektieren die bestehende SSOK-Hierarchie:

### Strategische Projekt-SSOK (Root-Dateien)

- `README.md` - Projektkontext und Setup
- `ROADMAP.md` - **Single Source of Knowledge** für Tasks
- `AGENTS.md` - Agent-Governance und Arbeitsregeln
- `VERIFY.md` - Verification-Anforderungen
- `SSOK.md` - Übergeordnete Governance-Struktur

### Operative Roo-SSOK

- `.roomodes` - Rollen/Modi/Agentenlogik
- `.roo/rules/*.md` - Operative Verhaltensregeln
- `.roo/commands/*.md` - Standardisierte Arbeitsabläufe

## PowerShell-Kompatibilität

Alle Scripts sind für Windows PowerShell optimiert:

- Verwenden `;` statt `&&` für Command-Chaining
- Nutzen `spawn` mit `shell: true` für Cross-Platform-Kompatibilität
- Berücksichtigen Windows-spezifische Pfad-Behandlung

## OpenCode-Vorbereitung

Diese Scripts sind als **Vorbereitung** für zukünftige OpenCode-Integration gedacht:

- **Aktuell:** Nur lokale Script-Ausführung und Prompt-Generierung
- **Zukünftig:** Mögliche Integration in automatisierte Agent-Workflows
- **Sicherheit:** Alle Sicherheitsgrenzen bleiben bestehen

## Troubleshooting

### Script läuft nicht

```bash
# Prüfe Node.js-Version (>=20 erforderlich)
node --version

# Prüfe Script-Berechtigung
ls -la scripts/agent/
```

### Kein Task gefunden

```bash
# Prüfe ROADMAP.md auf verfügbare Tasks
npm run agent:next
# Schaue in .agent/out/selected-task.json für Details
```

### Verification fehlgeschlagen

```bash
# Schaue in Verify-Report für Details
npm run agent:verify
# Öffne .agent/out/verify-report.md
```

### Output-Verzeichnis fehlt

```bash
# Erstelle Output-Verzeichnis manuell
mkdir -p .agent/out
```

## Entwicklung

### Neue Scripts hinzufügen

1. Script in `scripts/agent/` erstellen
2. Entsprechenden npm-Script in `package.json` hinzufügen
3. Dokumentation in dieser README aktualisieren
4. Sicherheitsgrenzen respektieren

### Script-Konventionen

- Verwende `.mjs` für ES-Module
- Beginne mit `#!/usr/bin/env node`
- Implementiere strukturierte Fehlerbehandlung
- Schreibe Outputs nach `.agent/out/`
- Verwende PowerShell-kompatible Commands
- Dokumentiere Zweck und Verhalten im Header

## Phase C: OpenCode CLI Worker Integration

### 6. run-opencode-worker.mjs

**Zweck:** OpenCode als optionaler CLI-Worker nutzen, ohne VS Code + Roo zu ersetzen.

**Verhalten:**

- Robust Repo-Root ermitteln
- Prüfen auf `.agent/out/next-prompt.md`, Fehlermeldung falls nicht vorhanden
- Safety-Header vor Prompt setzen:
  - "You are running as an automated OpenCode worker."
  - "Implement only the selected task."
  - "Do not commit or push."
  - "Do not edit .env or secrets."
  - "Do not install dependencies."
  - "After editing, summarize changed files and required verification."
- OpenCode non-interactive starten (spawn, PowerShell-kompatibel)
- Ausgabe vollständig in `.agent/out/opencode-report.md` schreiben
- State in `.agent/state.json` aktualisieren
- Fehlerbehandlung bei fehlendem OpenCode oder non-zero Exit-Code

**Verwendung:**

```bash
npm run agent:worker
```

**Output:** `.agent/out/opencode-report.md`, aktualisierte `.agent/state.json`

### Workflow Phase C

**Nutzungsschritte:**

1. `npm run agent:run` - Prompt vorbereiten
2. `npm run agent:worker` - OpenCode Worker ausführen
3. `npm run agent:verify` - Verifikation durchführen
4. `npm run agent:run` - Nächsten Zyklus starten

**Wichtige Hinweise:**

- VS Code + Roo bleiben das Cockpit
- OpenCode ist optionaler Worker
- Kein Multi-Task-Loop in Phase C
- Kein automatisches Commit/Push
- OpenCode wird nur über vorhandenen `next-prompt.md` gestartet

**OpenCode-Befehle:**

Primär: `opencode run "<prompt>"`
Fallback: `opencode -p "<prompt>" -q` (umstellbar im Code)

---

_Diese Scripts sind Teil der HealthApp Agent-Orchestrator-Foundation und folgen der SSOK-Definition in `SSOK.md`._
