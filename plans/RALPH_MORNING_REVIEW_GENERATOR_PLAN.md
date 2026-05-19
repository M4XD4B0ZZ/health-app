# Ralph Morning Review Generator Plan

**Task ID:** RALPH-007A  
**Created:** 2026-05-19T15:14:00Z  
**Status:** Planning Phase  
**Risk Level:** Safe Autonomous  

---

## 1. Purpose

Der Morning Review Generator ist die zweite ausführbare Ralph-Loop-Komponente, die nach manuellen oder unbeaufsichtigten Runs einen menschenlesbaren Bericht aus dem Ralph Runtime State erstellt. Er aggregiert Task-Status, Run-Historie, Validierungsergebnisse und Handoffs zu einem strukturierten Überblick für die tägliche menschliche Review.

### Kernfunktion
- **Report-Aggregation:** Sammelt Daten aus allen Ralph Runtime State Dateien
- **Human-Readable Output:** Erstellt strukturierte Markdown-Berichte für menschliche Review
- **Status-Übersicht:** Bietet klaren Überblick über abgeschlossene, laufende und blockierte Tasks
- **Handlungsempfehlungen:** Schlägt konkrete nächste Schritte vor

### Abgrenzung zu anderen Komponenten
- **Task Selector:** Wählt Tasks aus, Morning Review berichtet über Ergebnisse
- **Validation System:** Führt Validierung durch, Morning Review aggregiert Ergebnisse
- **Handoff System:** Erstellt Handoffs, Morning Review fasst sie zusammen

---

## 2. Non-Goals

Diese Planungsaufgabe umfasst explizit **NICHT**:

- ❌ **Agent-Invokation:** Keine Ausführung von Agenten oder Tools
- ❌ **Task-Ausführung:** Keine Implementierung von Tasks
- ❌ **Validation-Ausführung:** Keine Durchführung von Validierungsschritten
- ❌ **Status-Mutation:** Keine Änderungen an Task-State oder ROADMAP.md
- ❌ **package.json-Änderungen:** Keine Script-Modifikationen in dieser Planungsphase
- ❌ **Cline-Installation/Konfiguration:** Keine Tool-Installation oder -Setup
- ❌ **Produktcode-Analyse:** Keine Analyse von src/ Verzeichnis über Dateilisten hinaus

---

## 3. Proposed Script Path

**Empfohlener Pfad:**
```
scripts/agent/generate-morning-review.mjs
```

**Begründung:**
- Konsistent mit bestehender Agent-Script-Struktur in [`scripts/agent/`](../scripts/agent/)
- Klare Abgrenzung zu [`select-next-ralph-task.mjs`](../scripts/agent/select-next-ralph-task.mjs)
- Beschreibender Name für Report-Generierung
- Folgt etablierter Namenskonvention

---

## 4. Proposed Future Command

**Empfohlener package.json Script-Name:**
```json
{
  "scripts": {
    "agent:ralph:review": "node scripts/agent/generate-morning-review.mjs"
  }
}
```

**Alternative Namen (falls besser begründet):**
- `ralph:morning:review`
- `ralph:report:generate`
- `agent:review:morning`

**Begründung für `agent:ralph:review`:**
- Konsistent mit bestehender `agent:*` Namenskonvention
- Klare Ralph-Loop-Zuordnung
- Kurz und prägnant
- Unterscheidet sich von anderen Review-Kommandos

---

## 5. Inputs

Der Script soll folgende Dateien lesen (in dieser Reihenfolge):

### Governance-Dateien (Required)
1. **[`.governance/SYSTEM.md`](../.governance/SYSTEM.md)** - Ralph-Loop-Governance-System
2. **[`.governance/RULES.md`](../.governance/RULES.md)** - Operative Regeln
3. **[`.governance/SAFETY.md`](../.governance/SAFETY.md)** - Sicherheitsrichtlinien
4. **[`.governance/REVIEW_POLICY.md`](../.governance/REVIEW_POLICY.md)** - Review-Richtlinien

### Runtime-State-Dateien (Required)
5. **[`tasks/task-state.json`](../tasks/task-state.json)** - Aktueller Task-State
6. **[`tasks/task-history.jsonl`](../tasks/task-history.jsonl)** - Task-Verlauf
7. **[`runs/current-run.json`](../runs/current-run.json)** - Aktueller Run (falls vorhanden)
8. **[`runs/run-history.jsonl`](../runs/run-history.jsonl)** - Run-Historie
9. **[`validation/validation-results.jsonl`](../validation/validation-results.jsonl)** - Validierungsergebnisse
10. **[`handoffs/latest-handoff.md`](../handoffs/latest-handoff.md)** - Letzter Handoff

### Configuration-Dateien (Required)
11. **[`.agent/config/loop-config.json`](../.agent/config/loop-config.json)** - Loop-Konfiguration

### Optional/Conditional
12. **[`ROADMAP.md`](../ROADMAP.md)** - Für Task-Referenzen (read-only)

---

## 6. Outputs

### Console Output (Dry-run Mode - Default)
```markdown
# Morning Review Report Preview

**Generated At:** 2026-05-19T15:14:00Z
**Review Period:** Last 24 hours
**Ralph-Loop Version:** 0.1.0-alpha

## Executive Summary
✓ 6 tasks completed successfully
⚠ 1 task in progress (RALPH-007A)
✓ No blocked or failed tasks
✓ All validation checks passed

## Completed Tasks (Last 24h)
- RALPH-001A: Agent-neutral governance foundation ✓
- RALPH-002A: Runtime state and handoff foundation ✓
- RALPH-003A: Agent prompt and adapter contracts ✓
- RALPH-004A: Root governance transition notes ✓
- RALPH-005A: Dry-run task selector plan ✓
- RALPH-006A: Dry-run task selector implementation ✓

## Tasks In Progress
- RALPH-007A: Morning review generator plan (Planning)

## Recommended Next Action
Continue with RALPH-007A completion, then proceed to RALPH-008A.

Run with --write to update reports/morning-review.md.
```

### JSON Output (--json Flag)
```json
{
  "generated_at": "2026-05-19T15:14:00Z",
  "review_period": {
    "start": "2026-05-18T15:14:00Z",
    "end": "2026-05-19T15:14:00Z"
  },
  "executive_summary": {
    "completed_tasks": 6,
    "in_progress_tasks": 1,
    "blocked_tasks": 0,
    "failed_tasks": 0,
    "validation_status": "all_passed"
  },
  "completed_tasks": [
    {
      "id": "RALPH-001A",
      "title": "Agent-neutral governance foundation",
      "completed_at": "2026-05-19T08:20:00Z",
      "validation_status": "passed"
    }
  ],
  "in_progress_tasks": [
    {
      "id": "RALPH-007A",
      "title": "Morning review generator plan",
      "status": "in_progress",
      "started_at": "2026-05-19T15:14:00Z"
    }
  ],
  "recommended_actions": [
    "Complete RALPH-007A planning",
    "Proceed to RALPH-008A implementation"
  ]
}
```

### File Output (--write Flag)
- **Nur [`reports/morning-review.md`](../reports/morning-review.md)** wird geschrieben
- **Keine Task-State-Mutation**
- **Keine ROADMAP.md-Mutation**

---

## 7. CLI Interface

### Proposed Flags
```bash
# Dry-run (default behavior)
node scripts/agent/generate-morning-review.mjs
node scripts/agent/generate-morning-review.mjs --dry-run

# Write report to reports/morning-review.md
node scripts/agent/generate-morning-review.mjs --write

# JSON output for machine processing
node scripts/agent/generate-morning-review.mjs --json
node scripts/agent/generate-morning-review.mjs --json --write

# Time filtering
node scripts/agent/generate-morning-review.mjs --since="2026-05-19T00:00:00Z"
node scripts/agent/generate-morning-review.mjs --since="24h"

# Path overrides (optional)
node scripts/agent/generate-morning-review.mjs --task-state=custom/path/task-state.json
node scripts/agent/generate-morning-review.mjs --run-history=custom/path/run-history.jsonl
node scripts/agent/generate-morning-review.mjs --validation-results=custom/path/validation-results.jsonl
node scripts/agent/generate-morning-review.mjs --handoff=custom/path/latest-handoff.md
node scripts/agent/generate-morning-review.mjs --output=custom/path/report.md

# Help
node scripts/agent/generate-morning-review.mjs --help
```

### Flag Definitions
- **`--dry-run`** (default: true) - Nur Analyse, keine Dateischreibung
- **`--write`** - Schreibt [`reports/morning-review.md`](../reports/morning-review.md)
- **`--json`** - Maschinenlesbare JSON-Ausgabe statt Markdown
- **`--since <timestamp>`** - Filtert Events nach Zeitstempel (ISO 8601 oder relative Zeit wie "24h", "7d")
- **`--task-state <path>`** - Pfad-Override für Task-State-Datei
- **`--run-history <path>`** - Pfad-Override für Run-History-Datei
- **`--validation-results <path>`** - Pfad-Override für Validation-Results-Datei
- **`--handoff <path>`** - Pfad-Override für Handoff-Datei
- **`--output <path>`** - Pfad-Override für Report-Ausgabe (muss unter reports/ bleiben)
- **`--help`** - Zeigt Hilfe und verfügbare Optionen

---

## 8. Report Structure

### Exakte Markdown-Struktur für reports/morning-review.md

```markdown
# Ralph-Loop Morning Review

**Date:** YYYY-MM-DD
**Review Period:** [start] to [end]
**Generated At:** [ISO 8601 timestamp]
**Ralph-Loop Version:** [version]

---

## Executive Summary

**Overall Status:** [Green/Yellow/Red]
**Tasks Completed:** [X] of [Y] planned tasks
**Critical Issues:** [None/List]
**System Health:** [Operational/Degraded/Failed]

**Key Highlights:**
- [Bullet point summary of major accomplishments]
- [Bullet point summary of issues or blockers]
- [Bullet point summary of next priorities]

---

## Completed Tasks

### Successfully Completed Tasks
| Task ID | Title | Completion Date | Validation Status | Notes |
|---------|-------|----------------|-------------------|-------|
| [ID] | [Title] | [Date] | [Status] | [Notes] |

**Total Completed:** [X] tasks
**Completion Rate:** [X]% of planned tasks

### Quality Metrics
- **Verification Pass Rate:** [X]% ([Y]/[Z] tasks passed validation)
- **First-Attempt Success Rate:** [X]% ([Y]/[Z] tasks completed without retries)
- **Average Task Duration:** [X] hours per task

---

## Tasks In Progress

### Currently Active Tasks
| Task ID | Title | Status | Started At | Progress | Next Action |
|---------|-------|--------|------------|----------|-------------|
| [ID] | [Title] | [Status] | [Date] | [Progress] | [Action] |

### Progress Details
- **[Task ID]:** [Detailed progress description]
- **[Task ID]:** [Detailed progress description]

---

## Tasks Needing Review

### Pending Human Review
| Task ID | Title | Status | Review Required For | Priority |
|---------|-------|--------|-------------------|----------|
| [ID] | [Title] | [Status] | [Review Type] | [Priority] |

### Review Actions Required
- [ ] **[Task ID]:** [Specific review action needed]
- [ ] **[Task ID]:** [Specific review action needed]

---

## Blocked Tasks

### Currently Blocked
| Task ID | Title | Blocking Reason | Resolution Required | ETA |
|---------|-------|----------------|-------------------|-----|
| [ID] | [Title] | [Reason] | [Resolution] | [ETA] |

### Blocking Resolution Actions
- [ ] **[Blocker]:** [Action needed to resolve]
- [ ] **[Blocker]:** [Action needed to resolve]

---

## Failed Tasks

### Tasks Requiring Attention
| Task ID | Title | Failure Reason | Retry Strategy | Next Steps |
|---------|-------|---------------|----------------|------------|
| [ID] | [Title] | [Reason] | [Strategy] | [Steps] |

### Failure Analysis
- **Common Failure Patterns:** [Analysis]
- **Root Cause Analysis:** [Analysis]
- **Prevention Measures:** [Measures]

---

## Validation Results

### Verification Pipeline Status
- **npm run verify:** [Status] ([X]/[Y] tasks)
- **Type Checking:** [Status] ([X] errors)
- **Linting:** [Status] ([X] warnings, [Y] errors)
- **Tests:** [Status] ([X]/[Y] test suites)

### Edge Function Validation
- **Edge Functions Modified:** [X] functions
- **Edge Verification Status:** [Status]
- **Deployment Status:** [Status]

### Resolver-Specific Validation
- **Resolver Changes:** [Yes/No]
- **Multi-Source Fusion Tests:** [Status]
- **Performance Benchmarks:** [Status]

---

## Files Changed

### New Files Created
- **Total New Files:** [X]
- **File Categories:**
  - Documentation: [X] files
  - Configuration: [X] files
  - Source Code: [X] files
  - Tests: [X] files

### Modified Files
- **Total Modified Files:** [X]
- **High-Impact Changes:** [List]
- **Architecture Changes:** [List]

### Deleted Files
- **Total Deleted Files:** [X]
- **Cleanup Actions:** [List]

---

## Safety Warnings

### High-Risk Items
- **[Risk Category]:** [Description and impact]
- **[Risk Category]:** [Description and impact]

### Medium-Risk Items
- **[Risk Category]:** [Description and mitigation]

### Security Concerns
- **Security Issues:** [List]
- **Compliance Status:** [Status]

---

## Handoff Summary

### Latest Handoff Status
- **Last Handoff Date:** [Date]
- **Handoff Quality:** [Assessment]
- **Key Findings:** [Summary]
- **Outstanding Issues:** [List]

### Handoff Trends
- **Handoff Frequency:** [Analysis]
- **Common Issues:** [Patterns]
- **Quality Improvements:** [Trends]

---

## Recommended Human Actions

### Immediate Actions Required (Today)
- [ ] **[Priority 1]:** [Specific action with clear deliverable]
- [ ] **[Priority 1]:** [Specific action with clear deliverable]

### Short-term Actions (This Week)
- [ ] **[Action]:** [Description and expected outcome]
- [ ] **[Action]:** [Description and expected outcome]

### Strategic Actions (This Month)
- [ ] **[Strategic Item]:** [Long-term action with business impact]
- [ ] **[Strategic Item]:** [Long-term action with business impact]

---

## Suggested Next Run

### Recommended Next Task
**Task ID:** [ID]
**Task Title:** [Title]
**Rationale:** [Why this task should be next]
**Risk Assessment:** [Risk level and justification]
**Expected Duration:** [Time estimate]

### Pre-Run Checklist
- [ ] Repository state is clean
- [ ] All blockers for next task are resolved
- [ ] Required dependencies are available
- [ ] Safety systems are operational
- [ ] Previous task completed and reviewed

### Run Configuration
- **Suggested Tool:** [Tool recommendation]
- **Suggested Mode:** [Mode recommendation]
- **Safety Level:** [Safety level]
- **Stop Conditions:** [When to stop for review]

---

## Raw Data References

### Data Sources Used
- **Task State:** [Path and last modified]
- **Task History:** [Path and event count]
- **Run History:** [Path and run count]
- **Validation Results:** [Path and result count]
- **Latest Handoff:** [Path and date]

### Data Quality
- **JSON Parse Status:** [All files parsed successfully]
- **JSONL Parse Status:** [All files parsed successfully]
- **Data Consistency:** [Cross-reference validation status]
- **Missing Data:** [Any missing or incomplete data]

---

**Report Generated By:** scripts/agent/generate-morning-review.mjs v[version]
**Generation Time:** [ISO 8601 timestamp]
**Next Review Scheduled:** [Date]

---

*This morning review is part of the Ralph-Loop governance system. It aggregates runtime state from multiple sources to provide a comprehensive overview of system status and recommended actions.*
```

---

## 9. Aggregation Rules

### Deterministische Aggregationslogik

#### Completed Tasks Aggregation
```javascript
// Aus task-state.json
const completedTasks = tasks.filter(task => task.status === 'done');

// Aus task-history.jsonl
const completionEvents = history.filter(event => 
  event.event_type === 'task_completed' && 
  event.to_status === 'done'
);

// Cross-reference für Vollständigkeit
const aggregatedCompleted = completedTasks.map(task => ({
  ...task,
  completion_event: completionEvents.find(event => event.task_id === task.id)
}));
```

#### In-Progress Tasks Aggregation
```javascript
// Aus task-state.json
const inProgressTasks = tasks.filter(task => 
  ['in_progress', 'needs_validation', 'needs_review'].includes(task.status)
);

// Aus runs/current-run.json
const activeRun = currentRun?.status === 'running' ? currentRun : null;

// Kombiniere für vollständiges Bild
const aggregatedInProgress = inProgressTasks.map(task => ({
  ...task,
  active_run: activeRun?.selected_task_id === task.id ? activeRun : null
}));
```

#### Needs Review Tasks Aggregation
```javascript
// Aus task-state.json
const needsReviewTasks = tasks.filter(task => 
  task.status === 'needs_review' || 
  task.requires_human_review === true
);

// Aus validation-results.jsonl
const latestValidationResults = validationResults
  .filter(result => needsReviewTasks.some(task => task.id === result.task_id))
  .reduce((acc, result) => {
    if (!acc[result.task_id] || result.timestamp > acc[result.task_id].timestamp) {
      acc[result.task_id] = result;
    }
    return acc;
  }, {});
```

#### Blocked/Failed Tasks Aggregation
```javascript
// Aus task-state.json
const blockedTasks = tasks.filter(task => 
  ['blocked', 'failed'].includes(task.status)
);

// Aus task-history.jsonl für Blocking-Grund
const blockingEvents = history.filter(event => 
  event.event_type === 'task_blocked' || 
  event.event_type === 'task_failed'
);
```

#### Validation Summary Aggregation
```javascript
// Aus validation-results.jsonl
const recentValidations = validationResults.filter(result => 
  new Date(result.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
);

const validationSummary = {
  total_validations: recentValidations.length,
  passed: recentValidations.filter(r => r.overall_result === 'passed').length,
  failed: recentValidations.filter(r => r.overall_result === 'failed').length,
  npm_verify_executed: recentValidations.filter(r => r.npm_verify_executed).length
};
```

#### Latest Run Status Aggregation
```javascript
// Aus runs/current-run.json
const currentRunStatus = currentRun ? {
  run_id: currentRun.run_id,
  status: currentRun.status,
  task_id: currentRun.selected_task_id,
  created_at: currentRun.created_at
} : null;

// Aus runs/run-history.jsonl
const recentRuns = runHistory
  .filter(run => new Date(run.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000))
  .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
```

#### Handoff Summary Aggregation
```javascript
// Aus handoffs/latest-handoff.md
const handoffSummary = {
  last_handoff_date: extractDateFromHandoff(latestHandoff),
  task_id: extractTaskIdFromHandoff(latestHandoff),
  status: extractStatusFromHandoff(latestHandoff),
  key_findings: extractKeyFindingsFromHandoff(latestHandoff)
};
```

---

## 10. Human Review Logic

### Review-Required Detection

#### Needs Review Tasks Prominently Displayed
```javascript
// Jeder Task mit status === 'needs_review' erscheint prominent
const prominentReviewTasks = tasks.filter(task => 
  task.status === 'needs_review' ||
  (task.requires_human_review && task.status === 'in_progress')
);

// Anzeige in separater Sektion mit hoher Priorität
if (prominentReviewTasks.length > 0) {
  report.sections.unshift({
    title: "🚨 URGENT: Tasks Needing Human Review",
    priority: "critical",
    tasks: prominentReviewTasks
  });
}
```

#### Failed Validation als Blocking
```javascript
// Jede fehlgeschlagene Validierung erscheint als blockierend
const failedValidations = validationResults.filter(result => 
  result.overall_result === 'failed' &&
  new Date(result.timestamp) > new Date(Date.now() - 24 * 60 * 60 * 1000)
);

if (failedValidations.length > 0) {
  report.blocking_issues.push({
    type: "validation_failure",
    count: failedValidations.length,
    details: failedValidations,
    action_required: "Fix validation errors before proceeding"
  });
}
```

#### Protected File oder Safety Warning als Blocking
```javascript
// Jede Safety-Verletzung erscheint als blockierend
const safetyViolations = validationResults.filter(result => 
  result.checks_performed?.protected_files_check?.status === 'failed' ||
  result.checks_performed?.safety_violation_detected === true
);

if (safetyViolations.length > 0) {
  report.blocking_issues.push({
    type: "safety_violation",
    severity: "critical",
    details: safetyViolations,
    action_required: "Immediate human intervention required"
  });
}
```

#### Stale Active Run als Action Required
```javascript
// Veralteter aktiver Run erscheint als Handlungsbedarf
const staleRunThreshold = 4 * 60 * 60 * 1000; // 4 Stunden
if (currentRun && 
    new Date() - new Date(currentRun.created_at) > staleRunThreshold &&
    currentRun.status === 'running') {
  
  report.action_required.push({
    type: "stale_active_run",
    priority: "high",
    run_id: currentRun.run_id,
    age_hours: Math.floor((new Date() - new Date(currentRun.created_at)) / (60 * 60 * 1000)),
    action: "Clear or complete stale run"
  });
}
```

#### Task Done ohne Validation Evidence als Warning
```javascript
// Task als 'done' markiert ohne Validierungsnachweis
const tasksWithoutValidation = tasks
  .filter(task => task.status === 'done')
  .filter(task => {
    const validation = validationResults.find(v => v.task_id === task.id);
    return !validation || validation.overall_result !== 'passed';
  });

if (tasksWithoutValidation.length > 0) {
  report.warnings.push({
    type: "done_without_validation",
    severity: "medium",
    tasks: tasksWithoutValidation,
    action: "Verify these tasks were properly validated"
  });
}
```

#### Mismatch zwischen Task-State und Latest-Handoff als Warning
```javascript
// Inkonsistenz zwischen Task-State und Handoff
const handoffTaskId = extractTaskIdFromHandoff(latestHandoff);
const handoffStatus = extractStatusFromHandoff(latestHandoff);
const taskStateEntry = tasks.find(task => task.id === handoffTaskId);

if (taskStateEntry && taskStateEntry.status !== handoffStatus) {
  report.warnings.push({
    type: "state_handoff_mismatch",
    severity: "medium",
    task_id: handoffTaskId,
    task_state_status: taskStateEntry.status,
    handoff_status: handoffStatus,
    action: "Reconcile task state with handoff status"
  });
}
```

---

## 11. Safety Rules

### File-System-Safety
- **Script darf niemals Task-State mutieren** - Nur Lesen von [`tasks/task-state.json`](../tasks/task-state.json)
- **Script darf niemals ROADMAP.md mutieren** - Nur Lesen für Referenzen
- **Script darf niemals Validation-Results mutieren** - Nur Lesen von [`validation/validation-results.jsonl`](../validation/validation-results.jsonl)
- **Script darf niemals Agenten aufrufen** - Nur Report-Generierung
- **Script darf niemals npm-Kommandos ausführen** - Keine Build/Test-Ausführung
- **Script schreibt nur [`reports/morning-review.md`](../reports/morning-review.md)** wenn `--write` übergeben wird

### Network-Safety
- **Script darf keine Netzwerk-Requests machen** - Offline-Operation
- **Script darf keine externen APIs aufrufen** - Lokale Dateien nur
- **Script darf keine Secrets lesen** - Keine `.env`-Dateien

### Process-Safety
- **Script darf keine Agenten aufrufen** - Nur Report-Generierung
- **Script darf keine Subprozesse starten** - Keine Tool-Invokation
- **Script darf keine Git-Operationen durchführen** - Keine Repository-Änderungen

### State-Safety
- **Dry-run-Modus ist Standard** - Explizites `--write` erforderlich
- **Nur [`reports/morning-review.md`](../reports/morning-review.md) schreibbar** mit `--write`
- **Keine Task-State-Mutation** - Runtime-State bleibt unverändert
- **Keine ROADMAP.md-Mutation** - Master-Roadmap bleibt unberührt
- **Keine Validation-Results-Mutation** - Validierungsergebnisse bleiben unverändert

### Node.js Built-in Modules Only
```javascript
// Nur Node.js built-in Module verwenden
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// KEINE externen Dependencies
// KEINE npm packages außer Node.js built-ins
```

---

## 12. Error Handling

### Exit Codes
- **0** - Erfolgreiche Report-Generierung oder Dry-run
- **1** - Ungültige Eingabe/Konfiguration
- **2** - Sicherheitsverletzung erkannt
- **3** - Fehlende erforderliche Eingabedatei
- **4** - Inkonsistenter Runtime-State
- **5** - Unerwarteter Fehler

### Error-Message-Format
```
ERROR [Code]: [Category] - [Description]

Details:
- [Specific issue]
- [Suggested resolution]

Files checked:
- [List of files that were attempted to read]

Data sources:
- [List of successfully read data sources]
- [List of failed data sources]

Next steps:
- [Recommended action]
```

### Beispiel-Error-Messages
```
ERROR 3: Missing Required Input - tasks/task-state.json not found

Details:
- Task state file is required for report generation
- File path: tasks/task-state.json
- This file should be created by RALPH-002A

Files checked:
- tasks/task-state.json (NOT FOUND)
- runs/current-run.json (OK)
- validation/validation-results.jsonl (OK)

Next steps:
- Verify RALPH-002A was completed successfully
- Check if task-state.json was created in correct location
- Run task state initialization if needed
```

### Error-Recovery-Strategien
1. **Graceful Degradation** - Generiere Report mit verfügbaren Daten
2. **Clear Error Messages** - Präzise Fehlerbeschreibungen mit Lösungsvorschlägen
3. **File-Path-Validation** - Prüfe Dateipfade vor dem Lesen
4. **JSON/JSONL-Parse-Validation** - Validiere Syntax vor der Verarbeitung
5. **Partial Report Generation** - Erstelle Teilbericht wenn einige Daten fehlen

### Partial Data Handling
```javascript
// Wenn einige Dateien fehlen, generiere Teilbericht
const availableData = {
  taskState: taskStateAvailable ? taskState : null,
  runHistory: runHistoryAvailable ? runHistory : [],
  validationResults: validationResultsAvailable ? validationResults : [],
  handoff: handoffAvailable ? handoff : null
};

// Markiere fehlende Daten im Report
if (!taskStateAvailable) {
  report.warnings.push({
    type: "missing_data",
    severity: "high",
    missing: "task-state.json",
    impact: "Task status information unavailable"
  });
}
```

---

## 13. Validation Requirements

### JSON-Parse-Validierung
```javascript
// Alle JSON-Dateien müssen erfolgreich geparst werden
const requiredJsonFiles = [
  'tasks/task-state.json',
  'runs/current-run.json',
  '.agent/config/loop-config.json'
];

for (const filePath of requiredJsonFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in ${filePath}: ${error.message}`);
  }
}
```

### JSONL-Parse-Validierung
```javascript
// Alle JSONL-Dateien müssen gültige line-delimited JSON sein
const requiredJsonlFiles = [
  'tasks/task-history.jsonl',
  'runs/run-history.jsonl',
  'validation/validation-results.jsonl'
];

for (const filePath of requiredJsonlFiles) {
  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const lines = content.trim().split('\n').filter(line => line.trim());
    for (const line of lines) {
      JSON.parse(line);
    }
  } catch (error) {
    throw new Error(`Invalid JSONL in ${filePath}: ${error.message}`);
  }
}
```

### Required-File-Existence-Checks
```javascript
// Erforderliche Dateien müssen existieren
const requiredFiles = [
  'tasks/task-state.json',
  '.agent/config/loop-config.json',
  '.governance/SYSTEM.md',
  '.governance/RULES.md',
  '.governance/SAFETY.md',
  '.governance/REVIEW_POLICY.md'
];

for (const filePath of requiredFiles) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`Required file not found: ${filePath}`);
  }
}
```

### Required-Handoff-Section-Checks
```javascript
// Handoff muss erforderliche Sektionen enthalten
const requiredHandoffSections = [
  'Run Summary',
  'Current Task',
  'Completed Work',
  'Changed Files',
  'Validation Status',
  'Known Issues',
  'Next Recommended Action',
  'Human Review Needed',
  'Risks / Assumptions'
];

if (handoffContent) {
  for (const section of requiredHandoffSections) {
    if (!handoffContent.includes(`## ${section}`)) {
      warnings.push(`Missing handoff section: ${section}`);
    }
  }
}
```

### Output-Path-Validation
```javascript
// Output-Pfad muss unter reports/ bleiben
function validateOutputPath(outputPath) {
  const resolvedPath = path.resolve(outputPath);
  const reportsDir = path.resolve('reports');
  
  if (!resolvedPath.startsWith(reportsDir)) {
    throw new Error(`Output path must be under reports/ directory: ${outputPath}`);
  }
  
  return resolvedPath;
}
```

### Report-Section-Presence-Checks
```javascript
// Generierter Report muss alle erforderlichen Sektionen enthalten
const requiredReportSections = [
  'Executive Summary',
  'Completed Tasks',
  'Tasks In Progress',
  'Tasks Needing Review',
  'Blocked Tasks',
  'Failed Tasks',
  'Validation Results',
  'Files Changed',
  'Safety Warnings',
  'Handoff Summary',
  'Recommended Human Actions',
  'Suggested Next Run',
  'Raw Data References'
];

function validateReportStructure(reportContent) {
  for (const section of requiredReportSections) {
    if (!reportContent.includes(`## ${section}`)) {
      throw new Error(`Generated report missing required section: ${section}`);
    }
  }
}
```

### No-Forbidden-File-Modification
```javascript
// Script darf keine verbotenen Dateien ändern
const forbiddenModifications = [
  'tasks/task-state.json',
  'ROADMAP.md',
  'validation/validation-results.jsonl',
  'runs/current-run.json',
  'package.json'
];

// Nur reports/morning-review.md darf geschrieben werden
function validateFileModifications(writeMode, outputPath) {
  if (writeMode) {
    const allowedOutputPath = path.resolve('reports/morning-review.md');
    const actualOutputPath = path.resolve(outputPath);
    
    if (actualOutputPath !== allowedOutputPath) {
      throw new Error(`Write mode only allows writing to reports/morning-review.md, not ${outputPath}`);
    }
  }
}
```

---

## 14. Test/Verify Plan für zukünftige Implementierung

### Manuelle Kommandos für zukünftige Implementierung

#### Basis-Funktionalität
```bash
# Dry-run mit Standard-Ausgabe
node scripts/agent/generate-morning-review.mjs --dry-run

# JSON-Ausgabe für Automatisierung
node scripts/agent/generate-morning-review.mjs --dry-run --json

# Schreibmodus (nur reports/morning-review.md)
node scripts/agent/generate-morning-review.mjs --write

# Zeit-gefilterte Ausgabe
node scripts/agent/generate-morning-review.mjs --since="24h"
node scripts/agent/generate-morning-review.mjs --since="2026-05-19T00:00:00Z"
```

#### Validierungstests
```bash
# JSON-Parse-Checks
node -e "JSON.parse(require('fs').readFileSync('tasks/task-state.json'))"
node -e "JSON.parse(require('fs').readFileSync('.agent/config/loop-config.json'))"

# JSONL-Parse-Checks
node -e "require('fs').readFileSync('tasks/task-history.jsonl', 'utf8').trim().split('\n').forEach(line => JSON.parse(line))"
node -e "require('fs').readFileSync('validation/validation-results.jsonl', 'utf8').trim().split('\n').forEach(line => JSON.parse(line))"

# Git-Status-Check (nur erlaubte Schreibvorgänge)
git status --porcelain
# Sollte nur reports/morning-review.md zeigen nach --write

# Hilfe-Ausgabe
node scripts/agent/generate-morning-review.mjs --help
```

#### Error-Handling-Tests
```bash
# Test mit fehlender task-state.json
mv tasks/task-state.json tasks/task-state.json.backup
node scripts/agent/generate-morning-review.mjs
# Sollte Exit Code 3 zurückgeben
mv tasks/task-state.json.backup tasks/task-state.json

# Test mit ungültiger JSON
echo "invalid json" > test-invalid.json
node scripts/agent/generate-morning-review.mjs --task-state=test-invalid.json
# Sollte Exit Code 1 zurückgeben
rm test-invalid.json

# Test mit ungültigem Output-Pfad
node scripts/agent/generate-morning-review.mjs --write --output="../outside-reports.md"
# Sollte Exit Code 2 zurückgeben
```

#### Sicherheitstests
```bash
# Verify kein Task-State-Zugriff zum Schreiben
strace -e trace=openat node scripts/agent/generate-morning-review.mjs --write 2>&1 | grep -E "(task-state|ROADMAP)" | grep -v "O_RDONLY"
# Sollte keine Schreibzugriffe auf Task-State oder ROADMAP zeigen

# Verify keine Netzwerk-Requests
strace -e trace=network node scripts/agent/generate-morning-review.mjs 2>&1
# Sollte keine Netzwerk-Aktivität zeigen

# Verify nur reports/morning-review.md geschrieben
node scripts/agent/generate-morning-review.mjs --write
git status --porcelain
# Sollte nur "M reports/morning-review.md" zeigen
```

#### Report-Qualitätstests
```bash
# Test Report-Struktur
node scripts/agent/generate-morning-review.mjs --dry-run | grep -E "^## " | wc -l
# Sollte mindestens 13 Sektionen zeigen

# Test JSON-Ausgabe-Validität
node scripts/agent/generate-morning-review.mjs --json | jq .
# Sollte gültiges JSON parsen

# Test Zeit-Filterung
node scripts/agent/generate-morning-review.mjs --since="1h" --json | jq '.completed_tasks | length'
# Sollte numerischen Wert zurückgeben
```

---

## 15. Definition of Done für zukünftige Implementierung

### Script-Existenz und Funktionalität
- [ ] **Script existiert** unter `scripts/agent/generate-morning-review.mjs`
- [ ] **Dry-run funktioniert** - Standard-Modus ohne Dateischreibung
- [ ] **JSON-Ausgabe funktioniert** - `--json` Flag produziert gültiges JSON
- [ ] **Write-Modus funktioniert** - `--write` aktualisiert nur `reports/morning-review.md`
- [ ] **Zeit-Filterung funktioniert** - `--since` Flag filtert Events korrekt

### Report-Struktur und Inhalt
- [ ] **Alle erforderlichen Sektionen** - Report enthält alle 13 definierten Sektionen
- [ ] **Korrekte Aggregation** - Daten aus allen Quellen werden korrekt zusammengefasst
- [ ] **Human-Review-Logic** - Review-erforderliche Items werden prominent angezeigt
- [ ] **Handlungsempfehlungen** - Konkrete nächste Schritte werden vorgeschlagen

### Safety und Compliance
- [ ] **Keine Task-State-Mutation** - `tasks/task-state.json` bleibt unverändert
- [ ] **Keine ROADMAP-Mutation** - `ROADMAP.md` bleibt unverändert
- [ ] **Keine Validation-Results-Mutation** - `validation/validation-results.jsonl` bleibt unverändert
- [ ] **Ungültiges JSON schlägt sicher fehl** - Graceful Error-Handling
- [ ] **Fehlende Dateien werden behandelt** - Partial Report Generation

### File-System-Safety
- [ ] **Kein Produktcode berührt** - `src/` Verzeichnis unberührt
- [ ] **Keine Supabase-Änderungen** - `supabase/` Verzeichnis unberührt
- [ ] **Keine Script-Änderungen** - Andere Scripts unverändert
- [ ] **Keine .env-Zugriffe** - Keine Umgebungsvariablen gelesen
- [ ] **Nur Node.js built-ins** - Keine externen Dependencies

### Validation und Testing
- [ ] **JSON-Parse-Validation** - Alle JSON-Dateien werden validiert
- [ ] **JSONL-Parse-Validation** - Alle JSONL-Dateien werden validiert
- [ ] **Required-File-Validation** - Pflichtdateien werden geprüft
- [ ] **Exit-Code-Handling** - Korrekte Exit-Codes für alle Szenarien
- [ ] **Error-Message-Quality** - Klare, hilfreiche Fehlermeldungen

### Output-Qualität
- [ ] **Markdown-Struktur** - Korrekte Markdown-Formatierung
- [ ] **JSON-Struktur** - Gültiges JSON mit allen erforderlichen Feldern
- [ ] **Zeit-Filterung** - Korrekte Filterung nach Zeitstempel
- [ ] **Data-Consistency** - Konsistente Daten zwischen verschiedenen Quellen

---

## 16. Risks

### Technische Risiken

#### 1. Misleading Report bei inkonsistenten State-Dateien
**Risiko:** Report könnte irreführende Informationen enthalten wenn State-Dateien inkonsistent sind.

**Mitigation:**
- Cross-Reference-Validierung zwischen Task-State und Task-History
- Warnings für Inkonsistenzen zwischen verschiedenen Datenquellen
- Klare Markierung von fehlenden oder unvollständigen Daten
- Timestamp-basierte Konsistenzprüfungen

#### 2. Stale current-run.json
**Risiko:** Veraltete Run-Informationen könnten falsche Empfehlungen verursachen.

**Mitigation:**
- Stale-Run-Detection basierend auf Timestamps
- Prominente Warnung bei veralteten aktiven Runs
- Empfehlung zur Bereinigung veralteter Runs
- Timeout-basierte Stale-Detection (4+ Stunden)

#### 3. Done Task ohne Validation Evidence
**Risiko:** Tasks als 'done' markiert ohne entsprechende Validierungsnachweise.

**Mitigation:**
- Cross-Reference zwischen Task-State und Validation-Results
- Prominente Warnung für Tasks ohne Validierungsnachweis
- Empfehlung zur Nachvalidierung
- Qualitätsmetriken für Validation-Coverage

#### 4. Excessive Report Verbosity
**Risiko:** Report könnte zu ausführlich werden und wichtige Informationen verbergen.

**Mitigation:**
- Strukturierte Prioritätsebenen (Critical, High, Medium, Low)
- Executive Summary mit den wichtigsten Punkten
- Collapsible Sektionen für Details
- Fokus auf handlungsrelevante Informationen

#### 5. Future Mismatch mit ROADMAP.md
**Risiko:** Task-State könnte von ROADMAP.md abweichen wenn beide parallel gepflegt werden.

**Mitigation:**
- ROADMAP.md bleibt Single Source of Truth für Task-Definitionen
- Task-State ist Runtime-Queue, nicht strategische Planung
- Regelmäßige Synchronisation zwischen beiden Systemen
- Klare Dokumentation der Zuständigkeiten

### Operational Risks

#### 6. Performance bei großen Datenmengen
**Risiko:** Script könnte langsam werden bei vielen Tasks und Events.

**Mitigation:**
- Zeit-basierte Filterung für große Datasets
- Streaming-basierte JSONL-Verarbeitung
- Lazy Loading für optionale Daten
- Performance-Monitoring und Optimierung

#### 7. Memory Usage bei großen JSONL-Dateien
**Risiko:** Speicherverbrauch könnte bei großen History-Dateien problematisch werden.

**Mitigation:**
- Stream-basierte JSONL-Verarbeitung
- Chunked Reading für große Dateien
- Memory-efficient Aggregation
- Configurable Memory Limits

### Data Quality Risks

#### 8. Incomplete Handoff Information
**Risiko:** Handoff-Dateien könnten unvollständig oder inkonsistent sein.

**Mitigation:**
- Handoff-Section-Validation
- Graceful Degradation bei fehlenden Handoff-Daten
- Warnings für unvollständige Handoffs
- Fallback auf andere Datenquellen

#### 9. JSON/JSONL Corruption
**Risiko:** Korrupte JSON/JSONL-Dateien könnten Script zum Absturz bringen.

**Mitigation:**
- Robuste JSON/JSONL-Parsing mit Error-Handling
- Partial Data Recovery bei korrupten Dateien
- Clear Error Messages mit Recovery-Anweisungen
- Backup-Strategien für kritische State-Dateien

---

## 17. Recommendation

### Kleinste nächste Implementierungsaufgabe

**RALPH-008A — Morning Review Generator Implementation**

**Begründung:**
- **Direkte Umsetzung dieses Plans** - Alle Spezifikationen sind implementierungsbereit
- **Geringes Risiko** - Nur Lese-Operationen und optionale Schreibung einer Report-Datei
- **Klare Abgrenzung** - Keine Agent-Invokation, keine Task-Ausführung, keine State-Mutation
- **Testbare Ergebnisse** - Deterministisch validierbare Report-Ausgaben
- **Hoher Nutzen** - Ermöglicht strukturierte tägliche Reviews des Ralph-Loop-Systems

**Konkrete nächste Schritte für RALPH-008A:**
1. **Erstelle `scripts/agent/generate-morning-review.mjs`** basierend auf diesem Plan
2. **Implementiere JSON/JSONL-Parsing und Validierung** für alle Input-Dateien
3. **Implementiere Aggregation-Logic** gemäß den definierten Regeln
4. **Implementiere CLI-Interface** mit allen geplanten Flags
5. **Implementiere Report-Struktur** mit allen 13 erforderlichen Sektionen
6. **Implementiere Safety-Checks** und Error-Handling
7. **Implementiere Human-Review-Logic** für prominente Anzeige kritischer Items
8. **Teste alle Szenarien** gemäß Test/Verify-Plan
9. **Dokumentiere Ergebnisse** in Handoff-Report

**Nach RALPH-008A:**
- **RALPH-009A** - Cline Worker Adapter Preparation
- **RALPH-010A** - First Cline Dry Run
- **RALPH-011A** - First Controlled Single-Task Loop
- **Daily Morning Reviews** - Regelmäßige Nutzung des Morning Review Generators

**Integration mit bestehenden Komponenten:**
- **Task Selector:** Morning Review berichtet über Selector-Ergebnisse
- **Validation System:** Morning Review aggregiert Validation-Results
- **Handoff System:** Morning Review fasst Handoffs zusammen
- **Runtime State:** Morning Review liest alle State-Dateien

**Quality Assurance für RALPH-008A:**
- Alle CLI-Kommandos funktionieren korrekt
- JSON und Markdown Output sind wohlgeformt
- Alle Safety-Rules werden eingehalten
- Error-Handling ist robust und hilfreich
- Report-Struktur ist vollständig und konsistent
- Zeit-Filterung funktioniert korrekt
- Cross-Reference-Validierung funktioniert

---

## Content Style Guidelines

### Konkret und Implementierungsbereit
- **Spezifische Code-Beispiele** für alle Aggregation-Rules
- **Exakte CLI-Interface-Definition** mit allen Flags und Optionen
- **Detaillierte Error-Handling-Spezifikation** mit Exit-Codes und Messages
- **Vollständige Report-Struktur** mit allen erforderlichen Sektionen

### Keine ausführbaren Code-Blöcke erforderlich
- **Pseudocode und Algorithmus-Beschreibungen** statt vollständiger Implementierung
- **Interface-Definitionen** statt funktionsfähiger Code
- **Strukturelle Spezifikationen** statt ausführbare Scripts

### Keine breite Theorie
- **Fokus auf konkrete Implementierung** des Morning Review Generators
- **Spezifische Ralph-Loop-Integration** statt allgemeine Report-Theorie
- **Praktische Safety-Rules** statt theoretische Sicherheitskonzepte

### Direkt nutzbar als Implementierungs-Spezifikation
- **Alle erforderlichen Details** für RALPH-008A Implementation
- **Klare Acceptance-Criteria** für Definition of Done
- **Vollständige Test-Spezifikation** für Validierung
- **Detaillierte Risk-Assessment** mit Mitigation-Strategien

---

**End of Plan**

---

*Dieser Plan definiert die vollständige Spezifikation für den Ralph Morning Review Generator. Er ist implementierungsbereit und enthält alle erforderlichen Details für die erfolgreiche Umsetzung in RALPH-008A.*