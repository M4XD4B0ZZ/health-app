#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { checkStaleAndExit } from './stale-detection.mjs';

/**
 * Agent Orchestrator - Worker Prompt Builder
 *
 * Erstellt einen kompakten, execution-orientierten Prompt für OpenCode Worker.
 * Trennt sich vom ausführlichen Roo-Prompt und fokussiert auf minimale,
 * task-spezifische Anweisungen ohne lange Governance-Abschnitte.
 */

const SELECTED_TASK_PATH = '.agent/out/selected-task.json';
const OUTPUT_PATH = '.agent/out/worker-prompt.md';

function buildWorkerPrompt(taskData) {
  const task = taskData.result.selected;

  if (!task) {
    return `# OpenCode Worker - Kein Task verfügbar

${taskData.result.reason}

Führe \`npm run agent:next\` aus um einen Task auszuwählen.
`;
  }

  return `# OpenCode Worker - Task ${task.id}

## Task
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

## Arbeitsauftrag

Du bist ein automatisierter OpenCode Worker. Implementiere nur den ausgewählten Task.

### Vorgehen
1. **Relevante Dateien selbst suchen** - analysiere das Projekt und finde die richtigen Dateien
2. **Minimal implementieren** - mache nur die notwendigen Änderungen für den Task
3. **Tests ergänzen/anpassen** - stelle sicher, dass Tests weiterhin funktionieren
4. **Handoff in Antwort** - fasse am Ende zusammen was geändert wurde

### Governance-Referenzen
Bei Bedarf lies diese Dateien, aber kopiere sie NICHT in den Prompt:
- ROADMAP.md - Task-Kontext und Prioritäten
- AGENTS.md - Agent-Governance und Arbeitsregeln  
- VERIFY.md - Verification-Anforderungen

---

## Harte Grenzen (STRIKT EINHALTEN)

### ❌ VERBOTEN
- **Kein commit/push** - niemals automatisch committen oder pushen
- **Keine .env/secrets** - niemals .env-Dateien lesen oder Secrets verwenden
- **Keine dependencies** - keine neuen Abhängigkeiten installieren
- **Nur task-relevante Dateien** - keine breiten Refactors außerhalb des Task-Scope
- **Minimaler Diff** - nur die notwendigen Änderungen

### ✅ ERLAUBT
- Bestehende App-Features ändern wenn der Task das erfordert
- TypeScript/JavaScript Code schreiben und ändern
- Tests schreiben und anpassen
- Dokumentation aktualisieren
- Kleine Code-Verbesserungen im geänderten Bereich

---

## Verify Commands

Nach der Implementierung müssen diese Commands erfolgreich sein:
\`\`\`bash
npm run typecheck
npm run lint
npm run verify
\`\`\`

---

## Handoff-Erwartung

Fasse am Ende deiner Antwort zusammen:
- **Geänderte Dateien:** Liste aller modifizierten Dateien
- **Implementierung:** Kurze Beschreibung was implementiert wurde
- **Tests:** Welche Tests wurden angepasst/hinzugefügt
- **Verify:** Hinweis auf erforderliche Verification

---

*Generiert am: ${new Date().toISOString()}*
*Basis: ${SELECTED_TASK_PATH}*
`;
}

function main() {
  try {
    // STALE DETECTION: Prüfe ob selected-task.json veraltet ist
    checkStaleAndExit('build-worker-prompt.mjs');

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

    // Worker-Prompt erstellen
    const prompt = buildWorkerPrompt(taskData);
    console.log('🔨 Worker-Prompt erstellt');

    // Prompt speichern
    writeFileSync(OUTPUT_PATH, prompt);
    console.log(`💾 Worker-Prompt gespeichert: ${OUTPUT_PATH}`);

    // Zusammenfassung ausgeben
    if (taskData.result.selected) {
      console.log(`\n✅ Worker-Prompt für Task ${taskData.result.selected.id} bereit`);
      console.log(`📝 Titel: ${taskData.result.selected.title}`);
      console.log(`📄 Datei: ${OUTPUT_PATH}`);

      // Größe des Prompts anzeigen
      const promptSize = prompt.length;
      const wordCount = prompt.split(/\s+/).length;
      console.log(`📊 Größe: ${promptSize} Zeichen, ~${wordCount} Wörter`);
    } else {
      console.log(`\n⚠️  Kein Task verfügbar - Warteprompt erstellt`);
    }
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    process.exit(1);
  }
}

main();
