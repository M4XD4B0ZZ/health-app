#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Agent Orchestrator - Roo Prompt Builder
 *
 * Liest .agent/out/selected-task.json und erstellt einen Roo-kompatiblen Prompt
 * mit allen relevanten Governance-Informationen und Sicherheitsgrenzen.
 */

const SELECTED_TASK_PATH = '.agent/out/selected-task.json';
const OUTPUT_PATH = '.agent/out/next-prompt.md';

function buildRooPrompt(taskData) {
  const task = taskData.result.selected;

  if (!task) {
    return `# Kein Task verfügbar

${taskData.result.reason}

## Nächste Schritte

Prüfe ROADMAP.md auf verfügbare Tasks oder warte auf neue Aufgaben.
`;
  }

  return `# Roo Agent Prompt - Task ${task.id}

## Task Information

**ID:** ${task.id}
**Titel:** ${task.title}
**Status:** ${task.status}

${
  task.description
    ? `**Beschreibung:**
${task.description}`
    : ''
}

${
  task.dod
    ? `**Definition of Done:**
${task.dod}`
    : ''
}

---

## Governance-Dateien (PFLICHT LESEN)

Vor Beginn der Arbeit MÜSSEN folgende Dateien gelesen werden:

1. **ROADMAP.md** - Single Source of Knowledge für alle Tasks und Prioritäten
2. **AGENTS.md** - Agent-Governance und Arbeitsregeln
3. **VERIFY.md** - Verification-Anforderungen und Definition of Done
4. **SSOK.md** - Übergeordnete Governance-Struktur

---

## Sicherheitsgrenzen (STRIKT EINHALTEN)

### ❌ VERBOTEN

- **Keine .env-Dateien** lesen oder verändern
- **Keine Secrets** oder API-Keys in Code schreiben
- **Keine Dependencies** installieren ohne explizite Genehmigung
- **Kein automatischer Push** zu Remote-Repository
- **Keine breiten Refactors** außerhalb des Task-Scope

### ✅ ERLAUBT

- Lesen aller Governance-Dateien
- Dokumentation erstellen
- **Bestehende App-Features dürfen geändert werden**, wenn der ROADMAP-Task das erfordert
- **Nur task-relevante Dateien ändern**
- Minimale, fokussierte Änderungen

---

## Architektur-Grenzen

Respektiere die bestehende Clean Architecture:

- **Domain Layer:** Geschäftslogik, framework-unabhängig
- **Application Layer:** Use Cases, Orchestrierung
- **Infrastructure Layer:** Externe Services, Datenbank
- **Presentation Layer:** UI, React Native Components

**Regel:** Keine Vermischung der Layer-Grenzen.

---

## Verify-Erwartung

Nach Abschluss der Arbeit MUSS ausgeführt werden:

\`\`\`bash
npm run typecheck
npm run lint
npm run verify
\`\`\`

**Alle Checks müssen erfolgreich sein** bevor der Task als erledigt markiert wird.

---

## Handoff-Erwartung

Am Ende der Arbeit wird ein strukturierter Handoff erwartet:

### Handoff-Template

\`\`\`markdown
## Task: ${task.id}

### Was wurde geändert?
- [Liste der geänderten Dateien]

### Warum?
- [Begründung der Änderungen]

### Dateien
- [Detaillierte Auflistung]

### Checks
- [ ] npm run typecheck
- [ ] npm run lint  
- [ ] npm run verify

### Ergebnis
- [Zusammenfassung des Ergebnisses]

### Risiken
- [Bekannte Risiken oder Einschränkungen]

### Follow-ups
- [Nächste Schritte oder offene Punkte]
\`\`\`

---

## Arbeitsweise

1. **Planung:** Lies alle Governance-Dateien und verstehe den Task
2. **Implementierung:** Arbeite in kleinen, fokussierten Schritten
3. **Verification:** Führe alle relevanten Checks aus
4. **Handoff:** Dokumentiere Änderungen und Ergebnisse strukturiert

---

## Zusätzliche Hinweise

- **Deterministic-First:** Bevorzuge deterministische Lösungen vor AI/LLM
- **Minimal Changes:** Mache nur die notwendigen Änderungen
- **Existing Patterns:** Folge bestehenden Code-Patterns im Projekt
- **PowerShell Compatible:** Verwende PowerShell-kompatible Commands (`;
  ` statt ` &&
    `)

---

*Generiert am: ${new Date().toISOString()}*
*Basis: ${SELECTED_TASK_PATH}*
`;
}

function main() {
  try {
    // Selected task JSON prüfen
    if (!existsSync(SELECTED_TASK_PATH)) {
      console.error(`❌ ${SELECTED_TASK_PATH} nicht gefunden`);
      console.log('💡 Führe zuerst "npm run agent:next" aus');
      process.exit(1);
    }

    // Task-Daten lesen
    const taskDataRaw = readFileSync(SELECTED_TASK_PATH, 'utf-8');
    const taskData = JSON.parse(taskDataRaw);
    console.log('📖 Task-Daten gelesen');

    // Prompt erstellen
    const prompt = buildRooPrompt(taskData);
    console.log('🔨 Roo-Prompt erstellt');

    // Prompt speichern
    writeFileSync(OUTPUT_PATH, prompt);
    console.log(`💾 Prompt gespeichert: ${OUTPUT_PATH}`);

    // Zusammenfassung ausgeben
    if (taskData.result.selected) {
      console.log(`\n✅ Prompt für Task ${taskData.result.selected.id} bereit`);
      console.log(`📝 Titel: ${taskData.result.selected.title}`);
      console.log(`📄 Datei: ${OUTPUT_PATH}`);
    } else {
      console.log(`\n⚠️  Kein Task verfügbar - Warteprompt erstellt`);
    }
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    process.exit(1);
  }
}

main();
