# Ralph Dry-Run Task Selector Plan

**Task ID:** RALPH-005A  
**Created:** 2026-05-19T09:15:00Z  
**Status:** Planning Phase  
**Risk Level:** Safe Autonomous  

---

## 1. Purpose

Der Dry-run Task Selector ist die erste ausführbare Ralph-Loop-Komponente, die deterministisch den nächsten geeigneten Task aus dem Task-State auswählt. Er operiert ausschließlich im Dry-run-Modus und führt keine Task-Implementierung oder automatische Status-Übergänge durch.

### Kernfunktion
- **Task-Auswahl:** Deterministisch den nächsten geeigneten Task identifizieren
- **Dry-run-Modus:** Nur Analyse und Ausgabe, keine State-Mutation
- **Safety-First:** Umfassende Sicherheitsprüfungen vor jeder Auswahl
- **Human-Gate:** Explizite menschliche Genehmigung für alle Aktionen

---

## 2. Non-Goals

Diese Planungsaufgabe umfasst explizit **NICHT**:

- ❌ **Agent-Invokation:** Keine Ausführung von Agenten oder Tools
- ❌ **Code-Implementierung:** Keine Änderungen an Produktcode
- ❌ **Task-Ausführung:** Keine Implementierung von Tasks
- ❌ **Automatische Status-Übergänge:** Keine Markierung von Tasks als `done`
- ❌ **ROADMAP.md-Modifikation:** Keine Änderungen an der Master-Roadmap
- ❌ **package.json-Änderungen:** Keine Script-Modifikationen in dieser Planungsphase
- ❌ **Cline-Installation/Konfiguration:** Keine Tool-Installation oder -Setup

---

## 3. Proposed Script Path

**Empfohlener Pfad:**
```
scripts/agent/select-next-ralph-task.mjs
```

**Begründung:**
- Konsistent mit bestehender Agent-Script-Struktur in [`scripts/agent/`](../scripts/agent/)
- Klare Abgrenzung zu bestehendem [`select-next-task.mjs`](../scripts/agent/select-next-task.mjs)
- Ralph-spezifische Namensgebung für zukünftige Tool-Neutralität

---

## 4. Proposed Future Command

**Empfohlener package.json Script-Name:**
```json
{
  "scripts": {
    "agent:ralph:select": "node scripts/agent/select-next-ralph-task.mjs"
  }
}
```

**Alternative Namen (falls besser begründet):**
- `ralph:task:select`
- `ralph:coordinator`
- `agent:select:ralph`

**Begründung für `agent:ralph:select`:**
- Konsistent mit bestehender `agent:*` Namenskonvention
- Klare Ralph-Loop-Zuordnung
- Kurz und prägnant

---

## 5. Inputs

Der Script soll folgende Dateien lesen (in dieser Reihenfolge):

### Governance-Dateien (Required)
1. **[`.governance/SYSTEM.md`](../.governance/SYSTEM.md)** - Ralph-Loop-Governance-System
2. **[`.governance/RULES.md`](../.governance/RULES.md)** - Operative Regeln
3. **[`.governance/SAFETY.md`](../.governance/SAFETY.md)** - Sicherheitsrichtlinien

### Runtime-State-Dateien (Required)
4. **[`tasks/task-state.json`](../tasks/task-state.json)** - Aktueller Task-State (primäre Quelle)
5. **[`.agent/config/loop-config.json`](../.agent/config/loop-config.json)** - Loop-Konfiguration
6. **[`.agent/config/protected-files.json`](../.agent/config/protected-files.json)** - Geschützte Dateien
7. **[`handoffs/latest-handoff.md`](../handoffs/latest-handoff.md)** - Letzter Ausführungskontext

### Optional/Conditional
8. **[`runs/current-run.json`](../runs/current-run.json)** - Aktueller Run (falls vorhanden)

### Nicht erforderlich in der ersten Dry-run-Version
- **[`ROADMAP.md`](../ROADMAP.md)** bleibt SSOK, aber Task-State ist die Runtime-Queue
- Parsing von ROADMAP.md wird in späteren Versionen hinzugefügt

---

## 6. Outputs

### Console Output (Dry-run Mode - Default)
```
# Task Selection Result

**Selected Task:** RALPH-006A
**Task Title:** Dry-run task selector implementation
**Risk Level:** review_required
**Priority:** medium
**Rationale:** Next logical step after planning phase completion

## Eligibility Verification
✓ Status is eligible (not_started)
✓ Dependencies satisfied (RALPH-005A completed)
✓ Risk level appropriate (review_required with human approval)
✓ Attempt count within limits (0/3)
✓ Files within allowed scope
✓ No blocking conditions

## Next Action Required
Human approval required for implementation task. Run with --write to update runs/current-run.json.
```

### JSON Output (--json Flag)
```json
{
  "selected_task": {
    "id": "RALPH-006A",
    "title": "Dry-run task selector implementation",
    "status": "not_started",
    "priority": "medium",
    "risk_level": "review_required"
  },
  "selection_reason": "Next logical step after planning phase completion",
  "eligibility_checks": {
    "status_eligible": true,
    "dependencies_satisfied": true,
    "risk_level_appropriate": true,
    "attempt_count_valid": true,
    "files_in_scope": true,
    "no_blocking_conditions": true
  },
  "next_action": "human_approval_required"
}
```

### File Output (--write Flag)
- **Nur [`runs/current-run.json`](../runs/current-run.json)** wird geschrieben
- **Keine Task-State-Mutation** im Dry-run
- **Keine ROADMAP.md-Mutation**

---

## 7. CLI Interface

### Proposed Flags
```bash
# Dry-run (default behavior)
node scripts/agent/select-next-ralph-task.mjs
node scripts/agent/select-next-ralph-task.mjs --dry-run

# Write selected task to runs/current-run.json
node scripts/agent/select-next-ralph-task.mjs --write

# JSON output for machine processing
node scripts/agent/select-next-ralph-task.mjs --json
node scripts/agent/select-next-ralph-task.mjs --json --write

# Path overrides (optional)
node scripts/agent/select-next-ralph-task.mjs --task-state=custom/path/task-state.json
node scripts/agent/select-next-ralph-task.mjs --config=custom/path/loop-config.json

# Help
node scripts/agent/select-next-ralph-task.mjs --help
```

### Flag Definitions
- **`--dry-run`** (default: true) - Nur Analyse, keine Dateischreibung
- **`--write`** - Schreibt [`runs/current-run.json`](../runs/current-run.json) mit ausgewähltem Task
- **`--json`** - Maschinenlesbare JSON-Ausgabe statt Markdown
- **`--task-state`** - Pfad-Override für Task-State-Datei
- **`--config`** - Pfad-Override für Loop-Config-Datei
- **`--help`** - Zeigt Hilfe und verfügbare Optionen

---

## 8. Task Eligibility Rules

### Deterministische Auswahllogik

#### Ausschlusskriterien (Task wird NICHT ausgewählt)
1. **Status-Ausschluss:**
   - `done` - Task bereits abgeschlossen
   - `blocked` - Task kann nicht fortgesetzt werden
   - `failed` - Task fehlgeschlagen (außer Retry-Policy erlaubt es)
   - `skipped` - Task absichtlich übersprungen
   - `cancelled` - Task aufgrund geänderter Anforderungen abgebrochen

2. **Attempt-Limit-Ausschluss:**
   - `attempt_count >= max_attempts` - Maximale Versuche erreicht

3. **Human-Review-Ausschluss:**
   - `human_required` - Erfordert menschliche Intervention
   - `review_required` (außer Config erlaubt explizit Review-Required-Auswahl)

4. **Dependency-Ausschluss:**
   - Abhängigkeiten nicht erfüllt (basierend auf Task-Reihenfolge)

#### Einschlusskriterien (Task wird berücksichtigt)
1. **Status-Einschluss:**
   - `not_started` - Bevorzugt
   - `in_progress` - Kann fortgesetzt werden

2. **Risk-Level-Präferenz:**
   - `safe_autonomous` - Bevorzugt für autonome Ausführung
   - `review_required` - Nur wenn menschliche Review verfügbar

3. **Scope-Validierung:**
   - `allowed_files` innerhalb erlaubter Bereiche
   - Keine `forbidden_files` erforderlich

### Prioritätsreihenfolge
1. **Hohe Priorität** + `safe_autonomous`
2. **Hohe Priorität** + `review_required` (wenn Review verfügbar)
3. **Mittlere Priorität** + `safe_autonomous`
4. **Mittlere Priorität** + `review_required` (wenn Review verfügbar)
5. **Niedrige Priorität** (nur wenn keine höheren verfügbar)

### Tie-Breaking-Regeln
1. **Priority** (ascending: high → medium → low)
2. **Created_at** (ascending: ältere Tasks zuerst)
3. **Task ID** (ascending: alphabetisch)

---

## 9. Stop Conditions

### Normale Stop-Bedingungen
1. **Kein geeigneter Task gefunden**
   - Alle Tasks sind `done`, `blocked`, `failed`, `skipped`, oder `cancelled`
   - Alle verfügbaren Tasks erfordern menschliche Genehmigung

2. **Erfolgreiche Auswahl**
   - Ein geeigneter Task wurde identifiziert
   - Auswahlkriterien erfüllt

### Fehler-Stop-Bedingungen
1. **Konfigurationsfehler:**
   - [`tasks/task-state.json`](../tasks/task-state.json) fehlt oder ungültig
   - [`.agent/config/loop-config.json`](../.agent/config/loop-config.json) fehlt oder ungültig
   - [`.agent/config/protected-files.json`](../.agent/config/protected-files.json) fehlt

2. **JSON-Parsing-Fehler:**
   - Ungültiges JSON in einer der Eingabedateien
   - Fehlende erforderliche Felder

3. **Sicherheitsverletzungen:**
   - Ausgewählter Task erfordert Änderung geschützter Dateien
   - Task-Scope überschreitet erlaubte Grenzen

### Human-Intervention-Required
1. **Mehrdeutige Situationen:**
   - Mehrere gleichwertige Task-Kandidaten
   - Widersprüchliche Task-Anforderungen
   - Unklare Task-Abhängigkeiten

2. **Review-Required-Tasks:**
   - Task mit `review_required` Risk-Level
   - Große oder komplexe Tasks
   - Architekturänderungen erforderlich

### No-op-Detection
1. **Wiederholte Auswahl:**
   - Derselbe Task bereits in [`runs/current-run.json`](../runs/current-run.json) aktiv
   - Kein Fortschritt seit letzter Auswahl

2. **Stale-State-Detection:**
   - [`runs/current-run.json`](../runs/current-run.json) zeigt veralteten aktiven Run
   - Task-State und Run-State inkonsistent

---

## 10. Validation Requirements

### JSON-Parse-Validierung
```javascript
// Alle JSON-Dateien müssen erfolgreich geparst werden
const taskState = JSON.parse(fs.readFileSync('tasks/task-state.json'));
const loopConfig = JSON.parse(fs.readFileSync('.agent/config/loop-config.json'));
const protectedFiles = JSON.parse(fs.readFileSync('.agent/config/protected-files.json'));
```

### Required-Field-Validierung
```javascript
// Jeder Task muss diese Felder haben
const requiredTaskFields = [
  'id', 'title', 'status', 'priority', 'risk_level',
  'created_at', 'updated_at', 'attempt_count', 'max_attempts',
  'allowed_files', 'forbidden_files'
];
```

### Status-Validierung
```javascript
// Nur gültige Status-Werte erlaubt
const validStatuses = [
  'not_started', 'in_progress', 'needs_validation', 'needs_review',
  'blocked', 'failed', 'done', 'skipped', 'cancelled'
];
```

### Risk-Level-Validierung
```javascript
// Nur gültige Risk-Level erlaubt
const validRiskLevels = [
  'safe_autonomous', 'review_required', 'human_required'
];
```

### Max-Attempts-Validierung
```javascript
// attempt_count darf max_attempts nicht überschreiten
if (task.attempt_count >= task.max_attempts) {
  // Task ausschließen
}
```

### Output-Path-Validierung
```javascript
// Bei --write: runs/current-run.json muss schreibbar sein
if (writeMode && !fs.accessSync('runs/current-run.json', fs.constants.W_OK)) {
  throw new Error('Cannot write to runs/current-run.json');
}
```

### Protected-File-Pattern-Sanity-Check
```javascript
// Protected-File-Patterns müssen gültig sein
protectedFiles.protected_patterns.absolute_protection.patterns.forEach(pattern => {
  // Validiere Glob-Pattern-Syntax
});
```

---

## 11. Safety Rules

### File-System-Safety
- **Script darf niemals [`src/`](../src/) berühren** - Produktcode ist tabu
- **Script darf niemals [`supabase/`](../supabase/) berühren** - Datenbank/Edge-Functions sind tabu
- **Script darf niemals Task-State im Dry-run mutieren** - Nur Lesen erlaubt
- **Script darf niemals Tasks als `done` markieren** - Keine Status-Übergänge
- **Script darf niemals npm-Kommandos ausführen** - Keine Build/Test-Ausführung

### Network-Safety
- **Script darf keine Netzwerk-Requests machen** - Offline-Operation
- **Script darf keine externen APIs aufrufen** - Lokale Dateien nur
- **Script darf keine Secrets lesen** - Keine `.env`-Dateien

### Process-Safety
- **Script darf keine Agenten aufrufen** - Nur Task-Auswahl
- **Script darf keine Subprozesse starten** - Keine Tool-Invokation
- **Script darf keine Git-Operationen durchführen** - Keine Repository-Änderungen

### State-Safety
- **Dry-run-Modus ist Standard** - Explizites `--write` erforderlich
- **Nur [`runs/current-run.json`](../runs/current-run.json) schreibbar** mit `--write`
- **Keine ROADMAP.md-Mutation** - Master-Roadmap bleibt unberührt
- **Keine Task-State-Mutation** - Runtime-State bleibt unverändert

---

## 12. runs/current-run.json Shape

### Exakte JSON-Struktur für zukünftigen --write-Modus

```json
{
  "run_id": "run_2026-05-19_ralph-006a",
  "created_at": "2026-05-19T09:30:00Z",
  "selected_task_id": "RALPH-006A",
  "selected_task_title": "Dry-run task selector implementation",
  "mode": "coordinator",
  "status": "task_selected",
  "selection_reason": "Next logical step after planning phase completion",
  "blocked_reason": null,
  "stop_reason": null,
  "allowed_files": [
    "scripts/agent/select-next-ralph-task.mjs",
    "package.json"
  ],
  "forbidden_files": [
    "src/**/*",
    ".env*",
    "supabase/**/*"
  ],
  "expected_outputs": [
    "scripts/agent/select-next-ralph-task.mjs"
  ],
  "validation_requirements": {
    "type": "standard",
    "required_checks": [
      "npm_run_verify"
    ]
  },
  "safety_checks": {
    "protected_files_check": "passed",
    "scope_boundary_check": "passed",
    "forbidden_operations_check": "passed"
  },
  "metadata": {
    "ralph_loop_version": "0.1.0-alpha",
    "selector_version": "1.0.0",
    "governance_version": "1.0.0",
    "selection_algorithm": "priority_risk_created_at",
    "human_approval_required": true,
    "notes": "Task selected by dry-run selector. Human approval required before implementation."
  }
}
```

### Feld-Definitionen
- **`run_id`** - Eindeutige Run-Identifikation
- **`created_at`** - ISO 8601 Timestamp der Auswahl
- **`selected_task_id`** - ID des ausgewählten Tasks
- **`selected_task_title`** - Titel des ausgewählten Tasks
- **`mode`** - Immer "coordinator" für Task-Auswahl
- **`status`** - "task_selected" für erfolgreiche Auswahl
- **`selection_reason`** - Begründung für die Auswahl
- **`blocked_reason`** - Grund für Blockierung (null wenn nicht blockiert)
- **`stop_reason`** - Grund für Stop (null wenn erfolgreich)
- **`allowed_files`** - Dateien, die der Task ändern darf
- **`forbidden_files`** - Dateien, die der Task nicht ändern darf
- **`expected_outputs`** - Erwartete Ausgabedateien
- **`validation_requirements`** - Erforderliche Validierungsschritte
- **`safety_checks`** - Ergebnisse der Sicherheitsprüfungen
- **`metadata`** - Zusätzliche Metadaten und Versionsinformationen

---

## 13. Error Handling

### Exit Codes
- **0** - Erfolgreiche Task-Auswahl oder No-op Dry-run
- **1** - Ungültige Eingabe/Konfiguration
- **2** - Sicherheitsverletzung
- **3** - Kein geeigneter Task gefunden
- **4** - Veralteter aktiver Run
- **5** - Unerwarteter Fehler

### Error-Message-Format
```
ERROR [Code]: [Category] - [Description]

Details:
- [Specific issue]
- [Suggested resolution]

Files checked:
- [List of files that were read]

Next steps:
- [Recommended action]
```

### Beispiel-Error-Messages
```
ERROR 1: Invalid Configuration - tasks/task-state.json contains invalid JSON

Details:
- JSON parsing failed at line 42, column 15
- Missing closing bracket in task RALPH-005A

Files checked:
- tasks/task-state.json (FAILED)
- .agent/config/loop-config.json (OK)

Next steps:
- Fix JSON syntax in tasks/task-state.json
- Run JSON validator to verify syntax
```

### Error-Recovery-Strategien
1. **Graceful Degradation** - Versuche mit verfügbaren Daten fortzufahren
2. **Clear Error Messages** - Präzise Fehlerbeschreibungen mit Lösungsvorschlägen
3. **File-Path-Validation** - Prüfe Dateipfade vor dem Lesen
4. **JSON-Schema-Validation** - Validiere JSON-Struktur vor der Verarbeitung

---

## 14. Test/Verify Plan

### Manuelle Kommandos für zukünftige Implementierung

#### Basis-Funktionalität
```bash
# Dry-run mit Standard-Ausgabe
node scripts/agent/select-next-ralph-task.mjs --dry-run

# JSON-Ausgabe für Automatisierung
node scripts/agent/select-next-ralph-task.mjs --dry-run --json

# Schreibmodus (nur runs/current-run.json)
node scripts/agent/select-next-ralph-task.mjs --write
```

#### Validierungstests
```bash
# JSON-Parse-Checks
node -e "JSON.parse(require('fs').readFileSync('tasks/task-state.json'))"
node -e "JSON.parse(require('fs').readFileSync('.agent/config/loop-config.json'))"

# Git-Status-Check (nur erlaubte Schreibvorgänge)
git status --porcelain
# Sollte nur runs/current-run.json zeigen nach --write

# Hilfe-Ausgabe
node scripts/agent/select-next-ralph-task.mjs --help
```

#### Error-Handling-Tests
```bash
# Test mit ungültiger task-state.json
mv tasks/task-state.json tasks/task-state.json.backup
echo "invalid json" > tasks/task-state.json
node scripts/agent/select-next-ralph-task.mjs
# Sollte Exit Code 1 zurückgeben
mv tasks/task-state.json.backup tasks/task-state.json

# Test mit fehlender Konfiguration
mv .agent/config/loop-config.json .agent/config/loop-config.json.backup
node scripts/agent/select-next-ralph-task.mjs
# Sollte Exit Code 1 zurückgeben
mv .agent/config/loop-config.json.backup .agent/config/loop-config.json
```

#### Sicherheitstests
```bash
# Verify kein src/ Zugriff
strace -e trace=openat node scripts/agent/select-next-ralph-task.mjs 2>&1 | grep src/
# Sollte keine src/ Zugriffe zeigen

# Verify keine Netzwerk-Requests
strace -e trace=network node scripts/agent/select-next-ralph-task.mjs 2>&1
# Sollte keine Netzwerk-Aktivität zeigen
```

---

## 15. Definition of Done für zukünftige Implementierung

### Script-Existenz und Funktionalität
- [ ] **Script existiert** unter `scripts/agent/select-next-ralph-task.mjs`
- [ ] **Dry-run funktioniert** - Standard-Modus ohne Dateischreibung
- [ ] **JSON-Ausgabe funktioniert** - `--json` Flag produziert gültiges JSON
- [ ] **Write-Modus funktioniert** - `--write` aktualisiert nur `runs/current-run.json`

### Safety und Compliance
- [ ] **Keine Task-State-Mutation** - `tasks/task-state.json` bleibt unverändert
- [ ] **Keine ROADMAP-Mutation** - `ROADMAP.md` bleibt unverändert
- [ ] **Ungültiges JSON schlägt sicher fehl** - Graceful Error-Handling
- [ ] **Kein geeigneter Task meldet stop_reason** - Klare Kommunikation

### File-System-Safety
- [ ] **Kein Produktcode berührt** - `src/` Verzeichnis unberührt
- [ ] **Keine Supabase-Änderungen** - `supabase/` Verzeichnis unberührt
- [ ] **Keine Script-Änderungen** - Andere Scripts unverändert
- [ ] **Keine .env-Zugriffe** - Keine Umgebungsvariablen gelesen

### Validation und Testing
- [ ] **JSON-Parse-Validation** - Alle JSON-Dateien werden validiert
- [ ] **Required-Field-Validation** - Pflichtfelder werden geprüft
- [ ] **Exit-Code-Handling** - Korrekte Exit-Codes für alle Szenarien
- [ ] **Error-Message-Quality** - Klare, hilfreiche Fehlermeldungen

---

## 16. Risks

### Technische Risiken

#### 1. Divergenz zwischen ROADMAP.md und task-state.json
**Risiko:** Task-State und Master-Roadmap könnten inkonsistent werden.

**Mitigation:**
- Task-State ist Runtime-Queue, ROADMAP.md bleibt strategische SSOK
- Regelmäßige Synchronisation zwischen beiden Systemen
- Klare Dokumentation der Zuständigkeiten

#### 2. Stale current-run.json
**Risiko:** Veraltete Run-Informationen könnten falsche Entscheidungen verursachen.

**Mitigation:**
- Timestamp-basierte Stale-Detection
- Automatische Bereinigung veralteter Runs
- Human-Review-Gate vor jeder Task-Ausführung

#### 3. Accidental State Mutation
**Risiko:** Script könnte versehentlich Task-State oder andere kritische Dateien ändern.

**Mitigation:**
- Read-only-Modus als Standard
- Explizites `--write` Flag erforderlich
- Umfassende File-System-Safety-Checks
- Protected-File-Enforcement

### Governance-Risiken

#### 4. Over-selecting review-required Tasks
**Risiko:** Script könnte Tasks auswählen, die menschliche Review erfordern, ohne verfügbare Review-Kapazität.

**Mitigation:**
- Konfigurierbare Review-Policy in loop-config.json
- Explizite Human-Approval-Flags
- Clear Stop-Conditions für Review-Required-Tasks

#### 5. Future package.json Script Change
**Risiko:** Hinzufügung des Scripts zu package.json könnte bestehende Workflows beeinträchtigen.

**Mitigation:**
- Namespace-Trennung mit `agent:ralph:*` Präfix
- Keine Überschreibung bestehender Scripts
- Dokumentierte Upgrade-Pfade

### Operational Risks

#### 6. Task-Dependency-Resolution
**Risiko:** Komplexe Task-Abhängigkeiten könnten falsch aufgelöst werden.

**Mitigation:**
- Einfache sequenzielle Abhängigkeitslogik zunächst
- Explizite Dependency-Definition in Task-State
- Human-Escalation bei Ambiguität

---

## 17. Recommendation

### Kleinste nächste Implementierungsaufgabe

**RALPH-006A — Dry-run Selector Implementation**

**Begründung:**
- **Direkte Umsetzung dieses Plans** - Alle Spezifikationen sind implementierungsbereit
- **Geringes Risiko** - Nur Lese-Operationen und optionale Schreibung einer Datei
- **Klare Abgrenzung** - Keine Agent-Invokation, keine Task-Ausführung
- **Testbare Ergebnisse** - Deterministisch validierbare Ausgaben

**Konkrete nächste Schritte für RALPH-006A:**
1. **Erstelle `scripts/agent/select-next-ralph-task.mjs`** basierend auf diesem Plan
2. **Implementiere JSON-Parsing und Validierung** für alle Input-Dateien
3. **Implementiere Task-Eligibility-Logic** gemäß den definierten Regeln
4. **Implementiere CLI-Interface** mit allen geplanten Flags
5. **Implementiere Safety-Checks** und Error-Handling
6. **Teste alle Szenarien** gemäß Test/Verify-Plan
7. **Dokumentiere Ergebnisse** in Handoff-Report

**Nach RALPH-006A:**
- **RALPH-007A** - Morning Review Generator Plan
- **RALPH-008A** - Cline Worker Adapter Preparation
- **RALPH-009A** - First Cline Dry Run
- **RALPH-010A** - First Controlled Single-Task Loop

---

## Implementation Notes

### Code-Struktur-Empfehlungen
```javascript
// scripts/agent/select-next-ralph-task.mjs
import fs from 'fs';
import path from 'path';

class RalphTaskSelector {
  constructor(options = {}) {
    this.dryRun = options.dryRun ?? true;
    this.jsonOutput = options.jsonOutput ?? false;
    this.writeMode = options.writeMode ?? false;
    this.taskStatePath = options.taskStatePath ?? 'tasks/task-state.json';
    this.configPath = options.configPath ?? '.agent/config/loop-config.json';
  }

  async selectNextTask() {
    // 1. Read and validate all input files
    // 2. Apply eligibility rules
    // 3. Apply priority and tie-breaking
    // 4. Perform safety checks
    // 5. Generate output
    // 6. Optionally write runs/current-run.json
  }
}
```

### Error-Handling-Pattern
```javascript
try {
  const result = await selector.selectNextTask();
  console.log(formatOutput(result));
  process.exit(0);
} catch (error) {
  if (error.code === 'INVALID_CONFIG') {
    console.error(`ERROR 1: ${error.message}`);
    process.exit(1);
  } else if (error.code === 'SAFETY_VIOLATION') {
    console.error(`ERROR 2: ${error.message}`);
    process.exit(2);
  }
  // ... weitere Error-Codes
}
```

### Testing-Approach
```javascript
// Separate test file: scripts/agent/test-select-next-ralph-task.mjs
import { RalphTaskSelector } from './select-next-ralph-task.mjs';

// Unit tests für alle Eligibility-Rules
// Integration tests für alle CLI-Flags
// Error-Handling tests für alle Failure-Modes
// Safety tests für alle Protected-File-Scenarios
```

---

**End of Plan**