#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';
import { checkSelectedTaskStale, logStaleCheckResult } from './stale-detection.mjs';

/**
 * Agent Orchestrator - Agent Loop Runner (Phase B)
 *
 * Implementiert einen einfachen, sicheren Workflow-State für das bestehende Agent-Script-System.
 * Führt KEINE autonome Code-Implementierung durch. VS Code + Roo bleiben Hauptworkflow.
 * Das System bereitet vor, prüft, berichtet und setzt klare Gates.
 */

const STATE_PATH = '.agent/state.json';
const SELECTED_TASK_PATH = '.agent/out/selected-task.json';
const NEXT_PROMPT_PATH = '.agent/out/next-prompt.md';
const VERIFY_REPORT_PATH = '.agent/out/verify-report.md';
const FIX_PROMPT_PATH = '.agent/out/fix-prompt.md';

// State-Management Funktionen
function ensureStateFile() {
  const stateDir = '.agent';
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  if (!existsSync(STATE_PATH)) {
    const initialState = {
      currentTaskId: null,
      currentTaskTitle: null,
      status: 'idle',
      lastStep: null,
      iteration: 0,
      verifyPassed: false,
      lastUpdated: new Date().toISOString(),
    };
    writeFileSync(STATE_PATH, JSON.stringify(initialState, null, 2));
    console.log('🔧 State-Datei initialisiert:', STATE_PATH);
  }
}

function loadState() {
  ensureStateFile();
  const stateContent = readFileSync(STATE_PATH, 'utf-8');
  return JSON.parse(stateContent);
}

function updateState(updates) {
  const currentState = loadState();
  const newState = {
    ...currentState,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };
  writeFileSync(STATE_PATH, JSON.stringify(newState, null, 2));
  return newState;
}

// Hilfsfunktionen für Script-Ausführung
function runScript(scriptPath, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Ausführung: node ${scriptPath} ${args.join(' ')}`);

    const process = spawn('node', [scriptPath, ...args], {
      stdio: 'inherit',
      shell: true,
    });

    process.on('close', (code) => {
      resolve({
        exitCode: code,
        success: code === 0,
      });
    });

    process.on('error', (error) => {
      reject({
        error: error.message,
        success: false,
      });
    });
  });
}

// Verify-Report Analyse
function analyzeVerifyReport() {
  if (!existsSync(VERIFY_REPORT_PATH)) {
    return { exists: false, passed: false, hasErrors: false };
  }

  const reportContent = readFileSync(VERIFY_REPORT_PATH, 'utf-8');

  // Einfache Heuristik: Suche nach Status-Indikatoren
  const hasSuccessStatus = reportContent.includes('✅ ERFOLGREICH');
  const hasFailureStatus = reportContent.includes('❌ FEHLGESCHLAGEN');
  const hasErrors = reportContent.includes('❌') || reportContent.includes('FEHLER');

  return {
    exists: true,
    passed: hasSuccessStatus && !hasFailureStatus,
    hasErrors: hasErrors,
    content: reportContent,
  };
}

// Fix-Prompt Generator
function generateFixPrompt(verifyReport) {
  const timestamp = new Date().toISOString();

  return `# Roo Fix Prompt - Verify Fehler beheben

**Generiert:** ${timestamp}

## Aufgabe

Die Verification ist fehlgeschlagen. Behebe die Fehler minimal und führe danach erneut die Verification aus.

## Verify-Report

\`\`\`
${verifyReport.content}
\`\`\`

## Anweisungen für Roo

1. **Lies den Verify-Report** sorgfältig durch
2. **Identifiziere die Fehlerursachen** (TypeScript-Fehler, Lint-Fehler, Test-Fehler)
3. **Behebe nur die relevanten Fehler** - keine zusätzlichen Refactors
4. **Ändere nur die notwendigen Dateien** - keine breiten Änderungen
5. **Führe nach den Fixes aus:** \`npm run agent:verify\`

## Sicherheitsgrenzen (STRIKT EINHALTEN)

### ❌ VERBOTEN
- **Keine .env-Dateien** lesen oder verändern
- **Keine Secrets** oder API-Keys in Code schreiben
- **Keine Dependencies** installieren ohne explizite Genehmigung
- **Keine bestehenden App-Features** verändern
- **Kein automatischer Push** zu Remote-Repository

### ✅ ERLAUBT
- TypeScript-Fehler beheben
- ESLint-Fehler beheben
- Prettier-Format-Fehler beheben
- Test-Fehler beheben
- Minimale Code-Korrekturen

## Nach dem Fix

Führe aus: \`npm run agent:verify\`

Wenn erfolgreich, führe aus: \`npm run agent:run\`

---

*Automatisch generiert von run-agent-loop.mjs*
`;
}

// Hauptlogik
async function main() {
  try {
    console.log('🚀 Agent Loop gestartet\n');

    // Prüfe AGENT_NO_TASK_RESELECT Environment Variable
    const noTaskReselect = process.env.AGENT_NO_TASK_RESELECT === '1';
    if (noTaskReselect) {
      console.log('🚫 AGENT_NO_TASK_RESELECT=1 - Task-Neuauswahl deaktiviert');
    }

    // State laden/initialisieren
    let state = loadState();
    console.log(`📊 Aktueller Status: ${state.status}`);
    console.log(`🔄 Iteration: ${state.iteration}`);

    if (state.currentTaskId) {
      console.log(`📋 Aktueller Task: ${state.currentTaskId} - ${state.currentTaskTitle}`);
    }

    // STALE DETECTION: Nur in bestimmten States und wenn nicht deaktiviert
    const allowStaleDetection =
      !noTaskReselect &&
      ![
        'worker_completed',
        'ready_for_human_review',
        'verify_failed',
        'auto_failed_needs_human',
      ].includes(state.status);

    if (allowStaleDetection) {
      console.log('\n🔍 Stale Detection: Prüfe selected-task.json...');
      const staleCheck = checkSelectedTaskStale();
      logStaleCheckResult(staleCheck);

      if (staleCheck.isStale && staleCheck.shouldReselect) {
        console.log('\n🔄 selected-task.json ist veraltet - führe Neuauswahl durch');

        // State auf task_selection_required setzen
        state = updateState({
          status: 'task_selection_required',
          lastStep: 'stale_detection_triggered',
          iteration: state.iteration + 1,
        });

        // Führe select-next-task.mjs aus
        const result = await runScript('scripts/agent/select-next-task.mjs');

        if (result.success) {
          // Task-Informationen aus JSON laden
          const taskData = JSON.parse(readFileSync(SELECTED_TASK_PATH, 'utf-8'));
          const selectedTask = taskData.result.selected;

          state = updateState({
            currentTaskId: selectedTask ? selectedTask.id : null,
            currentTaskTitle: selectedTask ? selectedTask.title : null,
            status: 'task_selected',
            lastStep: 'select_next_task_after_stale',
            iteration: state.iteration + 1,
          });

          console.log(`✅ Neuer Task ausgewählt: ${state.currentTaskId}`);
          return;
        } else {
          console.error('❌ Task-Neuauswahl fehlgeschlagen');
          process.exit(1);
        }
      }
    } else {
      console.log(
        `\n🚫 Stale Detection übersprungen (Status: ${state.status}, NoReselect: ${noTaskReselect})`,
      );
    }

    // A) Task-Auswahl und State-Update
    if (!existsSync(SELECTED_TASK_PATH)) {
      console.log('\n🎯 Phase A: Task-Auswahl');
      console.log('Kein ausgewählter Task gefunden. Führe select-next-task.mjs aus...');

      const result = await runScript('scripts/agent/select-next-task.mjs');

      if (result.success) {
        // Task-Informationen aus JSON laden
        const taskData = JSON.parse(readFileSync(SELECTED_TASK_PATH, 'utf-8'));
        const selectedTask = taskData.result.selected;

        state = updateState({
          currentTaskId: selectedTask ? selectedTask.id : null,
          currentTaskTitle: selectedTask ? selectedTask.title : null,
          status: 'task_selected',
          lastStep: 'select_next_task',
          iteration: state.iteration + 1,
        });

        console.log(`✅ Task ausgewählt: ${state.currentTaskId}`);
        return;
      } else {
        console.error('❌ Task-Auswahl fehlgeschlagen');
        process.exit(1);
      }
    } else {
      // selected-task.json existiert - prüfe ob State aktualisiert werden muss
      const taskData = JSON.parse(readFileSync(SELECTED_TASK_PATH, 'utf-8'));
      const selectedTask = taskData.result.selected;

      if (selectedTask && state.currentTaskId !== selectedTask.id) {
        console.log('\n🎯 Phase A: State-Update');
        console.log(`Task ${selectedTask.id} gefunden, aktualisiere State...`);

        state = updateState({
          currentTaskId: selectedTask.id,
          currentTaskTitle: selectedTask.title,
          status: 'task_selected',
          lastStep: 'select_next_task',
          iteration: state.iteration + 1,
        });

        console.log(`✅ State aktualisiert: ${state.currentTaskId} - ${state.currentTaskTitle}`);
        return;
      }
    }

    // B) Wenn selected-task.json existiert, aber next-prompt.md fehlt
    if (existsSync(SELECTED_TASK_PATH) && !existsSync(NEXT_PROMPT_PATH)) {
      console.log('\n🎯 Phase B: Prompt-Generierung');
      console.log('Task ausgewählt, aber Prompt fehlt. Führe build-roo-prompt.mjs aus...');

      const result = await runScript('scripts/agent/build-roo-prompt.mjs');

      if (result.success) {
        // Zusätzlich worker-prompt.md erzeugen
        console.log('🔄 Erzeuge zusätzlich worker-prompt.md...');
        const workerPromptResult = await runScript('scripts/agent/build-worker-prompt.mjs');

        if (workerPromptResult.success) {
          console.log('✅ Worker-Prompt erstellt');
        } else {
          console.warn(
            '⚠️  Worker-Prompt-Erstellung fehlgeschlagen, aber Roo-Prompt ist verfügbar',
          );
        }

        state = updateState({
          currentTaskId: state.currentTaskId,
          currentTaskTitle: state.currentTaskTitle,
          status: 'prompt_ready',
          lastStep: 'build_roo_prompt',
        });

        console.log('✅ Roo-Prompt erstellt');
        return;
      } else {
        console.error('❌ Prompt-Generierung fehlgeschlagen');
        process.exit(1);
      }
    }

    // C) Wenn Prompt existiert, aber kein Verify-Report existiert
    if (existsSync(NEXT_PROMPT_PATH) && !existsSync(VERIFY_REPORT_PATH)) {
      console.log('\n🎯 Phase C: Warten auf Roo-Implementierung');
      console.log('\n🚪 GATE: Manuelle Roo-Implementierung erforderlich');
      console.log('');
      console.log('📄 Nächste Schritte:');
      console.log('1. Öffne .agent/out/next-prompt.md');
      console.log('2. Kopiere den Prompt in Roo');
      console.log('3. Lasse Roo den Task implementieren');
      console.log('4. Führe danach aus: npm run agent:verify');
      console.log('5. Oder führe erneut aus: npm run agent:run');

      state = updateState({
        status: 'waiting_for_roo_implementation',
        lastStep: 'manual_roo_gate',
      });

      process.exit(0);
    }

    // D) Wenn Verify-Report existiert
    if (existsSync(VERIFY_REPORT_PATH)) {
      console.log('\n🎯 Phase D: Verify-Report-Analyse');

      const verifyReport = analyzeVerifyReport();

      if (verifyReport.passed) {
        console.log('✅ Verification erfolgreich - erstelle Handoff-Template');

        const result = await runScript('scripts/agent/write-handoff-template.mjs');

        if (result.success) {
          state = updateState({
            status: 'ready_for_human_review',
            verifyPassed: true,
            lastStep: 'handoff_ready',
          });

          console.log('\n🎉 Task bereit für Human Review');
          console.log('');
          console.log('🚪 GATE: Manuelle Review erforderlich');
          console.log('📄 Nächste Schritte:');
          console.log('1. Prüfe git diff');
          console.log('2. Prüfe Verify-Report (.agent/out/verify-report.md)');
          console.log('3. Prüfe Handoff-Template (.agent/out/handoff-template.md)');
          console.log('4. Committe manuell, wenn akzeptabel');

          process.exit(0);
        } else {
          console.error('❌ Handoff-Template-Erstellung fehlgeschlagen');
          process.exit(1);
        }
      } else {
        console.log('❌ Verification fehlgeschlagen - erstelle Fix-Prompt');

        // Fix-Prompt erstellen
        const fixPrompt = generateFixPrompt(verifyReport);
        writeFileSync(FIX_PROMPT_PATH, fixPrompt);

        state = updateState({
          status: 'verify_failed',
          verifyPassed: false,
          lastStep: 'verify_failed',
        });

        console.log('\n🔧 Fix-Prompt erstellt');
        console.log('');
        console.log('🚪 GATE: Fehler-Behebung erforderlich');
        console.log('📄 Nächste Schritte:');
        console.log('1. Öffne .agent/out/fix-prompt.md');
        console.log('2. Kopiere den Fix-Prompt in Roo');
        console.log('3. Lasse Roo die Fehler beheben');
        console.log('4. Führe danach aus: npm run agent:verify');
        console.log('5. Oder führe erneut aus: npm run agent:run');

        process.exit(1);
      }
    }

    // Fallback: Unerwarteter Zustand
    console.log('\n⚠️  Unerwarteter Zustand erreicht');
    console.log('State:', JSON.stringify(state, null, 2));
    process.exit(1);
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error.message);

    // Fehler-State setzen
    updateState({
      status: 'error',
      lastStep: 'error',
      error: error.message,
    });

    process.exit(1);
  }
}

main();
