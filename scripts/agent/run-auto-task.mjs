#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Agent Orchestrator - Auto Task Runner (Phase D)
 *
 * Implementiert agent:auto für genau einen Task mit maximal einem Fix-Versuch.
 * Automatisiert den vollständigen Task-Zyklus:
 * 1. Task/Prompt vorbereiten
 * 2. OpenCode Worker ausführen
 * 3. Verify ausführen
 * 4. Bei Verify-Fail genau einen Fix-Prompt erzeugen und optional noch einmal OpenCode ausführen
 * 5. Danach IMMER am Human Review Gate stoppen
 *
 * Wichtige Grenzen:
 * - Kein Commit/Push
 * - Keine .env-Dateien lesen oder ändern
 * - Keine Secrets anfassen
 * - Keine Dependencies installieren
 * - Keine ROADMAP-Tasks automatisch auf done setzen
 * - Kein Multi-Task-Loop
 * - Maximal 1 Fix-Versuch
 * - Nach Erfolg oder finalem Fehler immer stoppen
 */

const STATE_PATH = '.agent/state.json';
const SELECTED_TASK_PATH = '.agent/out/selected-task.json';
const NEXT_PROMPT_PATH = '.agent/out/next-prompt.md';
const VERIFY_REPORT_PATH = '.agent/out/verify-report.md';
const FIX_PROMPT_PATH = '.agent/out/fix-prompt.md';
const AUTO_REPORT_PATH = '.agent/out/auto-report.md';

// State-Management Funktionen
function ensureStateFile() {
  const stateDir = '.agent';
  if (!existsSync(stateDir)) {
    mkdirSync(stateDir, { recursive: true });
  }

  const outDir = '.agent/out';
  if (!existsSync(outDir)) {
    mkdirSync(outDir, { recursive: true });
  }

  if (!existsSync(STATE_PATH)) {
    const initialState = {
      currentTaskId: null,
      currentTaskTitle: null,
      status: 'idle',
      lastStep: null,
      iteration: 0,
      verifyPassed: false,
      autoMode: false,
      fixAttempts: 0,
      maxFixAttempts: 1,
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

function runNpmScript(scriptName) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Ausführung: npm run ${scriptName}`);

    const process = spawn('npm', ['run', scriptName], {
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

// OpenCode Worker mit optionaler Prompt-Datei
function runOpenCodeWorker(promptFile = null) {
  return new Promise((resolve, reject) => {
    const args = promptFile ? [promptFile] : [];
    console.log(`🔄 Ausführung: node scripts/agent/run-opencode-worker.mjs ${args.join(' ')}`);

    const process = spawn('node', ['scripts/agent/run-opencode-worker.mjs', ...args], {
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

// Model Selection laden
function loadModelSelection() {
  const modelSelectionPath = '.agent/out/model-selection.json';

  if (!existsSync(modelSelectionPath)) {
    return null;
  }

  try {
    const selectionContent = readFileSync(modelSelectionPath, 'utf-8');
    return JSON.parse(selectionContent);
  } catch (e) {
    console.warn(`⚠️  Fehler beim Lesen von model-selection.json: ${e.message}`);
    return null;
  }
}

// Auto-Report Generator
function generateAutoReport(
  taskId,
  taskTitle,
  workerExitCode,
  verifyResult,
  fixAttempted,
  finalStatus,
  nextAction,
  modelSelection = null,
) {
  const timestamp = new Date().toISOString();

  const modelInfo = modelSelection
    ? `
## Model Selection

**Gewähltes Modell:** ${modelSelection.model}
**Cost Tier:** ${modelSelection.cost || 'N/A'}
**Risk Level:** ${modelSelection.risk}
**Grund:** ${modelSelection.reason}
**Quelle:** ${modelSelection.source}

---`
    : '';

  return `# Auto Task Report

**Generiert:** ${timestamp}
**Task-ID:** ${taskId || 'N/A'}
**Task-Titel:** ${taskTitle || 'N/A'}
${modelInfo}

## Ausführung

### Worker Exit Code
${workerExitCode !== null ? `Exit Code: ${workerExitCode}` : 'Worker nicht ausgeführt'}

### Verify Ergebnis
${verifyResult.exists ? (verifyResult.passed ? '✅ ERFOLGREICH' : '❌ FEHLGESCHLAGEN') : 'Verify nicht ausgeführt'}

### Fix-Versuch
${fixAttempted ? '✅ Fix-Versuch durchgeführt' : '❌ Kein Fix-Versuch'}

---

## Finaler Status
**Status:** ${finalStatus}

## Nächste manuelle Aktion
${nextAction}

---

## Verify-Report Details
${verifyResult.exists ? `\`\`\`\n${verifyResult.content}\n\`\`\`` : 'Kein Verify-Report verfügbar'}

---

*Automatisch generiert von run-auto-task.mjs*
`;
}

// Hauptlogik
async function main() {
  try {
    console.log('🚀 Auto Task Runner gestartet (Phase D)\n');

    // State laden/initialisieren
    let state = loadState();

    // Auto-Mode aktivieren
    state = updateState({
      autoMode: true,
      fixAttempts: 0,
      maxFixAttempts: 1,
    });

    console.log(`📊 Aktueller Status: ${state.status}`);
    console.log(`🔄 Iteration: ${state.iteration}`);

    if (state.currentTaskId) {
      console.log(`📋 Aktueller Task: ${state.currentTaskId} - ${state.currentTaskTitle}`);
    }

    // 1. Sicherstellen, dass ein Prompt existiert
    if (!existsSync(NEXT_PROMPT_PATH)) {
      console.log('\n🎯 Phase 1: Prompt vorbereiten');
      console.log('Kein Prompt gefunden. Führe agent:run aus...');

      const result = await runNpmScript('agent:run');

      if (!result.success) {
        console.error('❌ agent:run fehlgeschlagen');
        const autoReport = generateAutoReport(
          state.currentTaskId,
          state.currentTaskTitle,
          null,
          { exists: false, passed: false },
          false,
          'auto_failed_prompt_preparation',
          'Prüfe agent:run Ausgabe und führe manuell aus.',
        );
        writeFileSync(AUTO_REPORT_PATH, autoReport);
        process.exit(1);
      }

      // Prüfe erneut, ob Prompt jetzt existiert
      if (!existsSync(NEXT_PROMPT_PATH)) {
        console.error('❌ Prompt konnte nicht erstellt werden');
        const autoReport = generateAutoReport(
          state.currentTaskId,
          state.currentTaskTitle,
          null,
          { exists: false, passed: false },
          false,
          'auto_failed_no_prompt',
          'Prüfe ROADMAP.md auf verfügbare Tasks oder führe agent:run manuell aus.',
        );
        writeFileSync(AUTO_REPORT_PATH, autoReport);
        process.exit(1);
      }

      console.log('✅ Prompt erfolgreich vorbereitet');
    }

    // State nach Prompt-Vorbereitung aktualisieren
    state = loadState();

    // 1.5. Model Selection durchführen
    console.log('\n🎯 Phase 1.5: Model Selection');
    const modelResult = await runScript('scripts/agent/select-model.mjs');

    if (!modelResult.success) {
      console.warn('⚠️  Model Selection fehlgeschlagen, Worker verwendet Fallback');
    } else {
      console.log('✅ Model Selection erfolgreich');
    }

    // 1.6. Worker-Prompt sicherstellen
    console.log('\n🎯 Phase 1.6: Worker-Prompt sicherstellen');
    const workerPromptResult = await runNpmScript('agent:worker-prompt');

    if (!workerPromptResult.success) {
      console.warn('⚠️  Worker-Prompt-Erstellung fehlgeschlagen, Worker verwendet Fallback');
    } else {
      console.log('✅ Worker-Prompt erfolgreich erstellt');
    }

    // 2. OpenCode Worker ausführen
    console.log('\n🎯 Phase 2: OpenCode Worker ausführen');
    const workerResult = await runNpmScript('agent:worker');

    console.log(`Worker Exit Code: ${workerResult.exitCode}`);

    // Check if worker failed - if so, skip verify and exit
    if (!workerResult.success) {
      console.log('\n❌ Worker fehlgeschlagen - überspringe Verify');

      // Model Selection für Report laden
      const modelSelection = loadModelSelection();

      const autoReport = generateAutoReport(
        state.currentTaskId,
        state.currentTaskTitle,
        workerResult.exitCode,
        { exists: false, passed: false },
        false,
        'worker_failed',
        'Worker failed, review opencode-report.md',
        modelSelection,
      );
      writeFileSync(AUTO_REPORT_PATH, autoReport);

      console.log('\n🚪 Gate: Worker failed, review opencode-report.md');
      process.exit(1);
    }

    // 3. Verify ausführen (nur wenn Worker erfolgreich)
    console.log('\n🎯 Phase 3: Verify ausführen');
    const verifyResult = await runNpmScript('agent:verify');

    console.log(`Verify Exit Code: ${verifyResult.exitCode}`);

    // 4. agent:run ausführen, damit State/Handoff/Fix-Prompt aktualisiert wird
    console.log('\n🎯 Phase 4: State aktualisieren');
    await runNpmScript('agent:run');

    // Verify-Report analysieren
    const verifyReport = analyzeVerifyReport();

    // Model Selection für Report laden
    const modelSelection = loadModelSelection();

    if (verifyReport.passed) {
      // Erfolg: Handoff-Template sollte bereits erstellt sein
      console.log('\n✅ Verification erfolgreich');

      state = updateState({
        status: 'ready_for_human_review',
        lastStep: 'auto_task_completed',
        verifyPassed: true,
      });

      const autoReport = generateAutoReport(
        state.currentTaskId,
        state.currentTaskTitle,
        workerResult.exitCode,
        verifyReport,
        false,
        'ready_for_human_review',
        'Review git diff, verify report, opencode report and handoff. Commit manually if acceptable.',
        modelSelection,
      );
      writeFileSync(AUTO_REPORT_PATH, autoReport);

      console.log(
        '\n🚪 Gate: Review git diff, verify report, opencode report and handoff. Commit manually if acceptable.',
      );
      process.exit(0);
    } else {
      // Verify fehlgeschlagen: Fix-Versuch
      console.log('\n❌ Verification fehlgeschlagen');

      if (existsSync(FIX_PROMPT_PATH) && state.fixAttempts < state.maxFixAttempts) {
        console.log('\n🎯 Phase 5: Fix-Versuch');
        console.log('Fix-Prompt gefunden, führe Fix-Versuch durch...');

        // Fix-Versuch mit fix-prompt.md
        const fixResult = await runOpenCodeWorker(FIX_PROMPT_PATH);
        console.log(`Fix Worker Exit Code: ${fixResult.exitCode}`);

        // Erneut Verify ausführen
        console.log('\n🎯 Phase 6: Erneute Verification nach Fix');
        const fixVerifyResult = await runNpmScript('agent:verify');
        console.log(`Fix Verify Exit Code: ${fixVerifyResult.exitCode}`);

        // agent:run erneut ausführen
        await runNpmScript('agent:run');

        // Erneute Verify-Report Analyse
        const fixVerifyReport = analyzeVerifyReport();

        state = updateState({
          fixAttempts: state.fixAttempts + 1,
        });

        if (fixVerifyReport.passed) {
          // Fix erfolgreich
          console.log('\n✅ Fix erfolgreich - Verification bestanden');

          state = updateState({
            status: 'ready_for_human_review',
            lastStep: 'auto_fix_completed',
            verifyPassed: true,
          });

          const autoReport = generateAutoReport(
            state.currentTaskId,
            state.currentTaskTitle,
            workerResult.exitCode,
            fixVerifyReport,
            true,
            'ready_for_human_review',
            'Review git diff, verify report, opencode report and handoff. Commit manually if acceptable.',
            modelSelection,
          );
          writeFileSync(AUTO_REPORT_PATH, autoReport);

          console.log(
            '\n🚪 Gate: Review git diff, verify report, opencode report and handoff. Commit manually if acceptable.',
          );
          process.exit(0);
        } else {
          // Fix fehlgeschlagen
          console.log('\n❌ Fix fehlgeschlagen - Verification immer noch nicht bestanden');

          state = updateState({
            status: 'auto_failed_needs_human',
            lastStep: 'auto_fix_failed',
            verifyPassed: false,
          });

          const autoReport = generateAutoReport(
            state.currentTaskId,
            state.currentTaskTitle,
            workerResult.exitCode,
            fixVerifyReport,
            true,
            'auto_failed_needs_human',
            'Auto fix failed. Review verify-report.md, fix-prompt.md and opencode-report.md manually.',
            modelSelection,
          );
          writeFileSync(AUTO_REPORT_PATH, autoReport);

          console.log(
            '\n🚪 Gate: Auto fix failed. Review verify-report.md, fix-prompt.md and opencode-report.md manually.',
          );
          process.exit(1);
        }
      } else {
        // Kein Fix-Prompt oder maximale Fix-Versuche erreicht
        console.log('\n❌ Kein Fix-Prompt verfügbar oder maximale Fix-Versuche erreicht');

        state = updateState({
          status: 'auto_failed_needs_human',
          lastStep: 'auto_verify_failed_no_fix',
          verifyPassed: false,
        });

        const autoReport = generateAutoReport(
          state.currentTaskId,
          state.currentTaskTitle,
          workerResult.exitCode,
          verifyReport,
          false,
          'auto_failed_needs_human',
          'Verification failed and no fix available. Review verify-report.md and opencode-report.md manually.',
          modelSelection,
        );
        writeFileSync(AUTO_REPORT_PATH, autoReport);

        console.log(
          '\n🚪 Gate: Verification failed and no fix available. Review verify-report.md and opencode-report.md manually.',
        );
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error.message);

    // Fehler-State setzen
    const state = updateState({
      status: 'error',
      lastStep: 'auto_error',
      error: error.message,
    });

    const modelSelection = loadModelSelection();
    const autoReport = generateAutoReport(
      state.currentTaskId,
      state.currentTaskTitle,
      null,
      { exists: false, passed: false },
      false,
      'error',
      `Unerwarteter Fehler: ${error.message}`,
      modelSelection,
    );
    writeFileSync(AUTO_REPORT_PATH, autoReport);

    process.exit(1);
  }
}

main();
