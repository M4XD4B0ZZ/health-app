#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, unlinkSync, statSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Agent Orchestrator - Milestone Runner (Phase E)
 *
 * Implementiert agent:milestone für kontrollierte Multi-Task-Automation.
 * Automatisiert mehrere ROADMAP-Tasks nacheinander innerhalb strenger Sicherheitsgrenzen.
 *
 * Wichtige Grenzen:
 * - Kein Commit/Push
 * - Keine .env/Secrets
 * - Keine Dependencies installieren
 * - Kein automatisches ROADMAP-done ohne Verify
 * - Nach jedem Task muss Verify laufen
 * - Stoppt immer bei Gate/Risiko
 * - Initial: Stoppt nach jedem Task für Human Review
 */

const STATE_PATH = '.agent/state.json';
const CONFIG_PATH = '.agent/config.json';
const MILESTONE_REPORT_PATH = '.agent/out/milestone-report.md';
const MODEL_SELECTION_PATH = '.agent/out/model-selection.json';
const VERIFY_REPORT_PATH = '.agent/out/verify-report.md';

// Default-Konfiguration
const DEFAULT_CONFIG = {
  milestone: {
    maxTasks: 2,
    maxFixAttemptsPerTask: 1,
    stopOnHighRisk: true,
    stopOnVerifyFail: true,
    stopOnWorkerFail: true,
    stopOnLargeDiff: true,
    maxChangedFiles: 8,
    maxDiffLines: 500,
    requireHumanReviewAfterRun: true,
  },
};

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
      milestoneMode: false,
      milestoneTaskCount: 0,
      lastMilestoneStatus: null,
      lastGateReason: null,
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

// Konfiguration laden
function loadConfig() {
  if (!existsSync(CONFIG_PATH)) {
    return DEFAULT_CONFIG;
  }

  try {
    const configContent = readFileSync(CONFIG_PATH, 'utf-8');
    const config = JSON.parse(configContent);

    // Merge mit Defaults
    return {
      milestone: {
        ...DEFAULT_CONFIG.milestone,
        ...(config.milestone || {}),
      },
    };
  } catch (e) {
    console.warn(`⚠️  Fehler beim Lesen von config.json: ${e.message}`);
    return DEFAULT_CONFIG;
  }
}

// Git Status prüfen
function checkGitStatus() {
  return new Promise((resolve, reject) => {
    const process = spawn('git', ['status', '--porcelain'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Git status failed: ${stderr}`));
        return;
      }

      const lines = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      // Ignoriere .agent/out Dateien
      const relevantChanges = lines.filter((line) => {
        const file = line.substring(3); // Remove status prefix
        return !file.startsWith('.agent/out/');
      });

      resolve({
        hasChanges: relevantChanges.length > 0,
        changes: relevantChanges,
        allChanges: lines,
      });
    });

    process.on('error', (error) => {
      reject(new Error(`Git command failed: ${error.message}`));
    });
  });
}

// Diff Guard - prüft Größe der Änderungen
function checkDiffGuard(config) {
  return new Promise((resolve, reject) => {
    const process = spawn('git', ['diff', '--stat'], {
      stdio: ['inherit', 'pipe', 'pipe'],
      shell: true,
    });

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(`Git diff failed: ${stderr}`));
        return;
      }

      // Parse git diff --stat output
      const lines = stdout
        .trim()
        .split('\n')
        .filter((line) => line.trim());

      if (lines.length === 0) {
        resolve({
          changedFiles: 0,
          diffLines: 0,
          exceedsLimits: false,
          summary: 'Keine Änderungen',
        });
        return;
      }

      // Letzte Zeile enthält Zusammenfassung: "X files changed, Y insertions(+), Z deletions(-)"
      const summaryLine = lines[lines.length - 1];
      const fileCount = lines.length - 1; // Alle Zeilen außer Zusammenfassung

      // Extrahiere Zeilen-Änderungen aus Zusammenfassung
      const insertionsMatch = summaryLine.match(/(\d+) insertions?\(\+\)/);
      const deletionsMatch = summaryLine.match(/(\d+) deletions?\(-\)/);

      const insertions = insertionsMatch ? parseInt(insertionsMatch[1]) : 0;
      const deletions = deletionsMatch ? parseInt(deletionsMatch[1]) : 0;
      const totalLines = insertions + deletions;

      const exceedsFiles = fileCount > config.milestone.maxChangedFiles;
      const exceedsLines = totalLines > config.milestone.maxDiffLines;

      resolve({
        changedFiles: fileCount,
        diffLines: totalLines,
        exceedsLimits: exceedsFiles || exceedsLines,
        summary: summaryLine,
        details: {
          insertions,
          deletions,
          exceedsFiles,
          exceedsLines,
          maxFiles: config.milestone.maxChangedFiles,
          maxLines: config.milestone.maxDiffLines,
        },
      });
    });

    process.on('error', (error) => {
      reject(new Error(`Git diff command failed: ${error.message}`));
    });
  });
}

// Script-Ausführung
function runNpmScript(scriptName, env = {}) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Ausführung: npm run ${scriptName}`);

    const process = spawn('npm', ['run', scriptName], {
      stdio: 'inherit',
      shell: true,
      env: {
        ...process.env,
        ...env,
      },
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

// Task Artifacts löschen/invalidieren
function cleanTaskArtifacts() {
  const artifactPaths = [
    '.agent/out/selected-task.json',
    '.agent/out/next-prompt.md',
    '.agent/out/worker-prompt.md',
    '.agent/out/model-selection.json',
    '.agent/out/opencode-worker-done.json',
    '.agent/out/verify-report.md',
    '.agent/out/fix-prompt.md',
  ];

  let deletedCount = 0;

  artifactPaths.forEach((path) => {
    if (existsSync(path)) {
      try {
        unlinkSync(path);
        deletedCount++;
        console.log(`🗑️  Gelöscht: ${path}`);
      } catch (error) {
        console.warn(`⚠️  Fehler beim Löschen von ${path}: ${error.message}`);
      }
    }
  });

  console.log(`✅ ${deletedCount} Task artifacts gelöscht/invalidiert`);
  return deletedCount;
}

// Model Selection laden
function loadModelSelection() {
  if (!existsSync(MODEL_SELECTION_PATH)) {
    return null;
  }

  try {
    const selectionContent = readFileSync(MODEL_SELECTION_PATH, 'utf-8');
    return JSON.parse(selectionContent);
  } catch (e) {
    console.warn(`⚠️  Fehler beim Lesen von model-selection.json: ${e.message}`);
    return null;
  }
}

// Verify-Report Analyse
function analyzeVerifyReport() {
  if (!existsSync(VERIFY_REPORT_PATH)) {
    return { exists: false, passed: false, hasErrors: false };
  }

  const reportContent = readFileSync(VERIFY_REPORT_PATH, 'utf-8');

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

// Milestone Report Generator
function generateMilestoneReport(startTime, config, tasks, finalStatus) {
  const timestamp = new Date().toISOString();
  const duration = Date.now() - startTime;
  const durationMinutes = Math.round((duration / 60000) * 10) / 10;

  // ROADMAP.md und selected-task.json Timestamps
  let roadmapModified = 'N/A';
  let selectedTaskTimestamp = 'N/A';

  try {
    if (existsSync('ROADMAP.md')) {
      const roadmapStat = statSync('ROADMAP.md');
      roadmapModified = roadmapStat.mtime.toISOString();
    }
  } catch (e) {
    roadmapModified = `Error: ${e.message}`;
  }

  try {
    if (existsSync('.agent/out/selected-task.json')) {
      const selectedTaskContent = readFileSync('.agent/out/selected-task.json', 'utf-8');
      const selectedTaskData = JSON.parse(selectedTaskContent);
      selectedTaskTimestamp = selectedTaskData.timestamp || 'N/A';
    }
  } catch (e) {
    selectedTaskTimestamp = `Error: ${e.message}`;
  }

  let report = `# Milestone Report

**Generiert:** ${timestamp}
**Gestartet:** ${new Date(startTime).toISOString()}
**Dauer:** ${durationMinutes} Minuten
**Status:** ${finalStatus}

---

## Timestamps

**ROADMAP.md Modified:** ${roadmapModified}
**Selected Task Timestamp:** ${selectedTaskTimestamp}
**Stale Detection:** ${
    roadmapModified !== 'N/A' && selectedTaskTimestamp !== 'N/A'
      ? new Date(roadmapModified) > new Date(selectedTaskTimestamp)
        ? '⚠️ ROADMAP.md ist neuer'
        : '✅ OK'
      : 'N/A'
  }

---

## Konfiguration

- **Max Tasks:** ${config.milestone.maxTasks}
- **Max Fix-Versuche pro Task:** ${config.milestone.maxFixAttemptsPerTask}
- **Stop bei High Risk:** ${config.milestone.stopOnHighRisk}
- **Stop bei Verify Fail:** ${config.milestone.stopOnVerifyFail}
- **Stop bei Worker Fail:** ${config.milestone.stopOnWorkerFail}
- **Stop bei Large Diff:** ${config.milestone.stopOnLargeDiff}
- **Max Changed Files:** ${config.milestone.maxChangedFiles}
- **Max Diff Lines:** ${config.milestone.maxDiffLines}
- **Human Review nach Run:** ${config.milestone.requireHumanReviewAfterRun}

---

## Tasks

`;

  tasks.forEach((task, index) => {
    const status = task.completed ? '✅' : task.failed ? '❌' : '⏸️';

    report += `### ${index + 1}. ${task.taskId || 'N/A'} - ${task.taskTitle || 'N/A'}

**Status:** ${status}

`;

    if (task.model) {
      report += `**Model:** ${task.model.model} (${task.model.risk} risk)
**Model Grund:** ${task.model.reason}

`;
    }

    if (task.workerResult) {
      report += `**Worker Exit Code:** ${task.workerResult.exitCode}
**Worker Erfolg:** ${task.workerResult.success ? '✅' : '❌'}

`;
    }

    if (task.verifyResult) {
      report += `**Verify Erfolg:** ${task.verifyResult.passed ? '✅' : '❌'}

`;
    }

    if (task.diffGuard) {
      report += `**Geänderte Dateien:** ${task.diffGuard.changedFiles}
**Diff Zeilen:** ${task.diffGuard.diffLines}
**Diff Summary:** ${task.diffGuard.summary}

`;
    }

    if (task.gateReason) {
      report += `**Gate Grund:** ${task.gateReason}

`;
    }

    report += '---\n\n';
  });

  report += `## Final Status

**Status:** ${finalStatus}

`;

  if (finalStatus === 'stopped_for_review') {
    report += `## 🚪 Human Review Gate

Der Milestone wurde nach Task-Completion gestoppt für manuelle Review.

**Nächste Schritte:**
1. Prüfe git diff
2. Prüfe Verify-Reports
3. Prüfe OpenCode-Reports
4. Committe manuell wenn akzeptabel
5. Oder führe weitere Fixes durch

`;
  } else if (finalStatus === 'failed') {
    report += `## ❌ Milestone Failed

Der Milestone wurde aufgrund eines Fehlers oder Gates gestoppt.

**Nächste Schritte:**
1. Prüfe die Task-Details oben
2. Prüfe entsprechende Reports
3. Behebe Probleme manuell
4. Führe agent:milestone erneut aus

`;
  } else if (finalStatus === 'completed') {
    report += `## ✅ Milestone Completed

Alle Tasks wurden erfolgreich abgeschlossen.

**Nächste Schritte:**
1. Final Review aller Änderungen
2. Commit wenn akzeptabel

`;
  }

  report += `---

*Automatisch generiert von run-milestone.mjs*
`;

  return report;
}

// Hauptlogik
async function main() {
  const startTime = Date.now();
  const config = loadConfig();
  const tasks = [];
  let finalStatus = 'unknown';

  try {
    console.log('🚀 Milestone Runner gestartet (Phase E)\n');

    // Konfiguration anzeigen
    console.log('📋 Konfiguration:');
    console.log(`   Max Tasks: ${config.milestone.maxTasks}`);
    console.log(`   Max Fix-Versuche: ${config.milestone.maxFixAttemptsPerTask}`);
    console.log(`   Stop bei High Risk: ${config.milestone.stopOnHighRisk}`);
    console.log(`   Max Changed Files: ${config.milestone.maxChangedFiles}`);
    console.log(`   Max Diff Lines: ${config.milestone.maxDiffLines}`);
    console.log(`   Human Review nach Run: ${config.milestone.requireHumanReviewAfterRun}\n`);

    // 1. Git Status prüfen
    console.log('🔍 Prüfe Git Status...');
    const gitStatus = await checkGitStatus();

    if (gitStatus.hasChanges) {
      console.error('❌ Working tree is not clean. Commit or stash before agent:milestone.');
      console.log('\nÄnderungen gefunden:');
      gitStatus.changes.forEach((change) => console.log(`   ${change}`));

      finalStatus = 'failed';
      const report = generateMilestoneReport(startTime, config, tasks, finalStatus);
      writeFileSync(MILESTONE_REPORT_PATH, report);
      process.exit(1);
    }

    console.log('✅ Working tree ist sauber\n');

    // State initialisieren
    let state = updateState({
      milestoneMode: true,
      milestoneTaskCount: 0,
      lastMilestoneStatus: 'running',
      lastGateReason: null,
    });

    // 2. Task-Loop
    for (let taskIndex = 0; taskIndex < config.milestone.maxTasks; taskIndex++) {
      console.log(`\n🎯 === Task ${taskIndex + 1}/${config.milestone.maxTasks} ===\n`);

      const currentTask = {
        index: taskIndex,
        taskId: null,
        taskTitle: null,
        model: null,
        workerResult: null,
        verifyResult: null,
        diffGuard: null,
        gateReason: null,
        completed: false,
        failed: false,
      };

      // 2.0. Task artifacts löschen/invalidieren
      console.log('🧹 Phase 0: Task artifacts löschen');
      cleanTaskArtifacts();

      // 2.1. Task vorbereiten
      console.log('\n📋 Phase 1: Task vorbereiten');
      const runResult = await runNpmScript('agent:run');

      if (!runResult.success) {
        console.error('❌ agent:run fehlgeschlagen');
        currentTask.failed = true;
        currentTask.gateReason = 'agent:run failed';
        tasks.push(currentTask);
        finalStatus = 'failed';
        break;
      }

      // State nach agent:run laden
      state = loadState();
      currentTask.taskId = state.currentTaskId;
      currentTask.taskTitle = state.currentTaskTitle;

      console.log(`✅ Task vorbereitet: ${currentTask.taskId} - ${currentTask.taskTitle}`);

      // 2.2. Model Selection
      console.log('\n🤖 Phase 2: Model Selection');
      const modelResult = await runNpmScript('agent:model');

      if (!modelResult.success) {
        console.warn('⚠️  Model Selection fehlgeschlagen, Worker verwendet Fallback');
      } else {
        console.log('✅ Model Selection erfolgreich');
      }

      // Model Selection laden
      const modelSelection = loadModelSelection();
      currentTask.model = modelSelection;

      // 2.3. High Risk Check
      if (modelSelection && modelSelection.risk === 'high' && config.milestone.stopOnHighRisk) {
        console.log('\n🚪 Gate: High Risk Model detected');
        console.log(`Model: ${modelSelection.model} (${modelSelection.risk} risk)`);
        console.log(`Grund: ${modelSelection.reason}`);

        currentTask.gateReason = `High risk model: ${modelSelection.model}`;
        tasks.push(currentTask);
        finalStatus = 'stopped_for_review';
        break;
      }

      // 2.4. Worker-Prompt sicherstellen
      console.log('\n📝 Phase 3: Worker-Prompt sicherstellen');
      const workerPromptResult = await runNpmScript('agent:worker-prompt');

      if (!workerPromptResult.success) {
        console.warn('⚠️  Worker-Prompt-Erstellung fehlgeschlagen, Worker verwendet Fallback');
      } else {
        console.log('✅ Worker-Prompt erfolgreich erstellt');
      }

      // 2.5. OpenCode Worker ausführen
      console.log('\n🔧 Phase 4: OpenCode Worker ausführen');
      const workerResult = await runNpmScript('agent:worker');
      currentTask.workerResult = workerResult;

      console.log(`Worker Exit Code: ${workerResult.exitCode}`);

      if (!workerResult.success && config.milestone.stopOnWorkerFail) {
        console.log('\n🚪 Gate: Worker failed');
        currentTask.failed = true;
        currentTask.gateReason = `Worker failed with exit code ${workerResult.exitCode}`;
        tasks.push(currentTask);
        finalStatus = 'failed';
        break;
      }

      // 2.6. Verify ausführen
      console.log('\n✅ Phase 5: Verify ausführen');
      const verifyResult = await runNpmScript('agent:verify');
      console.log(`Verify Exit Code: ${verifyResult.exitCode}`);

      // 2.7. State aktualisieren (ohne Task-Neuauswahl)
      console.log('\n🔄 Phase 6: State aktualisieren');
      await runNpmScript('agent:run', { AGENT_NO_TASK_RESELECT: '1' });

      // Verify-Report analysieren
      const verifyReport = analyzeVerifyReport();
      currentTask.verifyResult = verifyReport;

      if (!verifyReport.passed && config.milestone.stopOnVerifyFail) {
        console.log('\n🚪 Gate: Verify failed');
        currentTask.failed = true;
        currentTask.gateReason = 'Verify failed';
        tasks.push(currentTask);
        finalStatus = 'failed';
        break;
      }

      // 2.8. Diff Guard prüfen
      console.log('\n📊 Phase 7: Diff Guard prüfen');
      const diffGuard = await checkDiffGuard(config);
      currentTask.diffGuard = diffGuard;

      console.log(
        `Geänderte Dateien: ${diffGuard.changedFiles}/${config.milestone.maxChangedFiles}`,
      );
      console.log(`Diff Zeilen: ${diffGuard.diffLines}/${config.milestone.maxDiffLines}`);

      if (diffGuard.exceedsLimits && config.milestone.stopOnLargeDiff) {
        console.log('\n🚪 Gate: Large Diff detected');
        console.log(`Diff Summary: ${diffGuard.summary}`);

        currentTask.gateReason = `Large diff: ${diffGuard.changedFiles} files, ${diffGuard.diffLines} lines`;
        tasks.push(currentTask);
        finalStatus = 'stopped_for_review';
        break;
      }

      // 2.9. Task erfolgreich abgeschlossen
      console.log('\n✅ Task erfolgreich abgeschlossen');
      currentTask.completed = true;
      tasks.push(currentTask);

      // State aktualisieren
      state = updateState({
        milestoneTaskCount: taskIndex + 1,
      });

      // 2.10. Human Review Gate (initial immer nach jedem Task)
      if (config.milestone.requireHumanReviewAfterRun) {
        console.log('\n🚪 Gate: Human Review nach Task erforderlich');
        finalStatus = 'stopped_for_review';
        break;
      }
    }

    // 3. Final Status setzen
    if (finalStatus === 'unknown') {
      if (tasks.length === config.milestone.maxTasks && tasks.every((t) => t.completed)) {
        finalStatus = 'completed';
      } else {
        finalStatus = 'stopped_for_review';
      }
    }

    // 4. State aktualisieren
    updateState({
      lastMilestoneStatus: finalStatus,
      milestoneMode: false,
    });

    // 5. Report schreiben
    const report = generateMilestoneReport(startTime, config, tasks, finalStatus);
    writeFileSync(MILESTONE_REPORT_PATH, report);

    // 6. Zusammenfassung ausgeben
    console.log(`\n📊 Milestone abgeschlossen`);
    console.log(
      `✅ Tasks abgeschlossen: ${tasks.filter((t) => t.completed).length}/${tasks.length}`,
    );
    console.log(`📄 Report: ${MILESTONE_REPORT_PATH}`);
    console.log(`🔄 Final Status: ${finalStatus}`);

    if (finalStatus === 'stopped_for_review') {
      console.log('\n🚪 Gate: Human Review erforderlich');
      console.log('📄 Nächste Schritte:');
      console.log('1. Prüfe git diff');
      console.log('2. Prüfe milestone-report.md');
      console.log('3. Prüfe verify-report.md');
      console.log('4. Committe manuell wenn akzeptabel');
      process.exit(0);
    } else if (finalStatus === 'failed') {
      console.log('\n❌ Milestone fehlgeschlagen - siehe Report für Details');
      process.exit(1);
    } else {
      console.log('\n🎉 Milestone erfolgreich abgeschlossen!');
      process.exit(0);
    }
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error.message);

    // Fehler-State setzen
    updateState({
      lastMilestoneStatus: 'error',
      milestoneMode: false,
      lastGateReason: error.message,
    });

    finalStatus = 'failed';
    const report = generateMilestoneReport(startTime, config, tasks, finalStatus);
    writeFileSync(MILESTONE_REPORT_PATH, report);

    process.exit(1);
  }
}

main();
