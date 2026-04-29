#!/usr/bin/env node

import { readFileSync, existsSync } from 'fs';
import { join, resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

/**
 * Agent Watch Dashboard (Phase D.8)
 *
 * Komfortables Live-Dashboard für Agent-/Worker-Überwachung.
 * Zeigt aktuellen Agent-Status, Worker-Status, Logs und Reports live im Terminal an.
 *
 * Verhalten:
 * - Repo-Root robust ermitteln
 * - Alle relevanten Agent-Dateien lesen (falls vorhanden)
 * - Terminal alle 2 Sekunden aktualisieren
 * - Zeigt strukturierte Übersicht mit allen wichtigen Informationen
 * - Exit-Verhalten: Standard läuft weiter bis Ctrl+C, optional --exit-on-complete
 *
 * Wichtige Grenzen:
 * - Keine .env-Dateien lesen
 * - Keine Secrets anfassen
 * - Nur lesender Zugriff auf Agent-Dateien
 * - Keine Änderungen an Dateien
 */

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// CLI-Argumente parsen
const args = process.argv.slice(2);
const exitOnComplete = args.includes('--exit-on-complete');

// Repo-Root robust ermitteln
const repoRoot = resolve(__dirname, '../../');

// Agent-Dateipfade
const AGENT_PATHS = {
  state: join(repoRoot, '.agent', 'state.json'),
  workerStatus: join(repoRoot, '.agent', 'out', 'worker-status.json'),
  modelSelection: join(repoRoot, '.agent', 'out', 'model-selection.json'),
  selectedTask: join(repoRoot, '.agent', 'out', 'selected-task.json'),
  liveLog: join(repoRoot, '.agent', 'out', 'opencode-live.log'),
  autoReport: join(repoRoot, '.agent', 'out', 'auto-report.md'),
  verifyReport: join(repoRoot, '.agent', 'out', 'verify-report.md'),
};

// Hilfsfunktionen
function safeReadJson(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    const content = readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch (e) {
    return { error: `Parse error: ${e.message}` };
  }
}

function safeReadText(filePath) {
  if (!existsSync(filePath)) {
    return null;
  }

  try {
    return readFileSync(filePath, 'utf-8');
  } catch (e) {
    return `Read error: ${e.message}`;
  }
}

function formatElapsed(ms) {
  if (!ms || ms < 0) return 'N/A';

  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);

  if (hours > 0) {
    return `${hours}h ${minutes % 60}m ${seconds % 60}s`;
  } else if (minutes > 0) {
    return `${minutes}m ${seconds % 60}s`;
  } else {
    return `${seconds}s`;
  }
}

function formatTimestamp(isoString) {
  if (!isoString) return 'N/A';

  try {
    const date = new Date(isoString);
    return date.toLocaleString('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch (e) {
    return isoString;
  }
}

function getLastLogLines(logContent, maxLines = 20) {
  if (!logContent) return [];

  const lines = logContent.split('\n').filter((line) => line.trim());
  return lines.slice(-maxLines);
}

function getStatusIcon(status) {
  switch (status) {
    case 'running':
    case 'in_progress':
      return '🔄';
    case 'completed':
    case 'ready_for_human_review':
      return '✅';
    case 'failed':
    case 'auto_failed_needs_human':
      return '❌';
    case 'timeout':
    case 'worker_timeout':
      return '⏰';
    case 'idle':
      return '💤';
    default:
      return '❓';
  }
}

function shouldExitOnComplete(workerStatus, agentState) {
  if (!exitOnComplete) return false;

  // Exit wenn Worker completed/failed/timeout ist
  if (workerStatus && ['completed', 'failed', 'timeout'].includes(workerStatus.status)) {
    return true;
  }

  // Exit wenn Agent in finalem State ist
  if (
    agentState &&
    ['ready_for_human_review', 'auto_failed_needs_human', 'error'].includes(agentState.status)
  ) {
    return true;
  }

  return false;
}

function renderDashboard() {
  // Alle Daten laden
  const agentState = safeReadJson(AGENT_PATHS.state);
  const workerStatus = safeReadJson(AGENT_PATHS.workerStatus);
  const modelSelection = safeReadJson(AGENT_PATHS.modelSelection);
  const selectedTask = safeReadJson(AGENT_PATHS.selectedTask);
  const liveLogContent = safeReadText(AGENT_PATHS.liveLog);
  const autoReportExists = existsSync(AGENT_PATHS.autoReport);
  const verifyReportExists = existsSync(AGENT_PATHS.verifyReport);

  // Terminal löschen
  console.clear();

  // Header
  console.log('🤖 Agent Watch Dashboard (Phase D.8)');
  console.log('═'.repeat(60));
  console.log(`📅 ${new Date().toLocaleString('de-DE', { timeZone: 'Europe/Berlin' })}`);
  console.log('');

  // Prüfe ob Agent-Daten vorhanden sind
  if (!agentState && !workerStatus && !selectedTask) {
    console.log('❌ No active agent run found.');
    console.log('');
    console.log('💡 Start with: npm run agent:auto');
    console.log('');
    console.log('Press Ctrl+C to exit');
    return false;
  }

  // Task-Informationen
  console.log('📋 TASK INFORMATION');
  console.log('─'.repeat(30));
  if (selectedTask && selectedTask.result && selectedTask.result.selected) {
    const task = selectedTask.result.selected;
    console.log(`Task ID: ${task.id || 'N/A'}`);
    console.log(`Title: ${task.title || 'N/A'}`);
    console.log(`Status: ${task.status || 'N/A'}`);
  } else if (agentState) {
    console.log(`Task ID: ${agentState.currentTaskId || 'N/A'}`);
    console.log(`Title: ${agentState.currentTaskTitle || 'N/A'}`);
  } else {
    console.log('Task: N/A');
  }
  console.log('');

  // Agent State
  console.log('🔧 AGENT STATE');
  console.log('─'.repeat(30));
  if (agentState) {
    console.log(`Status: ${getStatusIcon(agentState.status)} ${agentState.status || 'N/A'}`);
    console.log(`Last Step: ${agentState.lastStep || 'N/A'}`);
    console.log(`Iteration: ${agentState.iteration || 0}`);
    console.log(`Verify Passed: ${agentState.verifyPassed ? '✅' : '❌'}`);
    console.log(`Auto Mode: ${agentState.autoMode ? '✅' : '❌'}`);
    console.log(`Last Updated: ${formatTimestamp(agentState.lastUpdated)}`);
  } else {
    console.log('No agent state found');
  }
  console.log('');

  // Worker Status
  console.log('⚙️  WORKER STATUS');
  console.log('─'.repeat(30));
  if (workerStatus) {
    console.log(`Status: ${getStatusIcon(workerStatus.status)} ${workerStatus.status || 'N/A'}`);
    console.log(`Model: ${workerStatus.model || 'N/A'}`);
    console.log(`Agent: ${workerStatus.agent || 'null'}`);
    console.log(`Prompt File: ${workerStatus.promptFile || 'N/A'}`);
    console.log(`Started: ${formatTimestamp(workerStatus.startedAt)}`);

    if (workerStatus.finishedAt) {
      console.log(`Finished: ${formatTimestamp(workerStatus.finishedAt)}`);
      console.log(`Runtime: ${formatElapsed(workerStatus.elapsedMs)}`);
      console.log(`Exit Code: ${workerStatus.exitCode !== null ? workerStatus.exitCode : 'N/A'}`);
    } else if (workerStatus.startedAt) {
      const elapsed = Date.now() - new Date(workerStatus.startedAt).getTime();
      console.log(`Runtime: ${formatElapsed(elapsed)} (running)`);
    }
  } else {
    console.log('No worker status found');
  }
  console.log('');

  // Model Selection
  console.log('🎯 MODEL SELECTION');
  console.log('─'.repeat(30));
  if (modelSelection) {
    console.log(`Model: ${modelSelection.model || 'N/A'}`);
    console.log(`Risk: ${modelSelection.risk || 'N/A'}`);
    console.log(`Cost: ${modelSelection.cost || 'N/A'}`);
    console.log(`Reason: ${modelSelection.reason || 'N/A'}`);
    console.log(`Source: ${modelSelection.source || 'N/A'}`);
  } else {
    console.log('No model selection found');
  }
  console.log('');

  // Reports
  console.log('📄 REPORTS');
  console.log('─'.repeat(30));
  console.log(`Auto Report: ${autoReportExists ? '✅ Available' : '❌ Not found'}`);
  console.log(`Verify Report: ${verifyReportExists ? '✅ Available' : '❌ Not found'}`);
  if (workerStatus) {
    console.log(`OpenCode Report: ${workerStatus.reportPath || 'N/A'}`);
    console.log(`Live Log: ${workerStatus.liveLogPath || 'N/A'}`);
  }
  console.log('');

  // Live Log (letzte 20 Zeilen)
  console.log('📝 LIVE LOG (Last 20 lines)');
  console.log('─'.repeat(30));
  const logLines = getLastLogLines(liveLogContent, 20);
  if (logLines.length > 0) {
    logLines.forEach((line) => {
      // Kürze sehr lange Zeilen
      const displayLine = line.length > 100 ? line.substring(0, 97) + '...' : line;
      console.log(displayLine);
    });
  } else {
    console.log('No log entries found');
  }
  console.log('');

  // Footer
  console.log('─'.repeat(60));
  if (exitOnComplete) {
    console.log('🔄 Auto-exit enabled (--exit-on-complete)');
  } else {
    console.log('🔄 Press Ctrl+C to exit');
  }

  // Prüfe Exit-Bedingung
  return shouldExitOnComplete(workerStatus, agentState);
}

// Hauptlogik
async function main() {
  console.log('🚀 Agent Watch Dashboard gestartet');

  if (exitOnComplete) {
    console.log('⚙️  Auto-exit aktiviert (--exit-on-complete)');
  }

  console.log('📂 Repo Root:', repoRoot);
  console.log('');

  // Erste Anzeige
  const shouldExit = renderDashboard();

  if (shouldExit) {
    console.log('');
    console.log('✅ Agent/Worker completed - exiting');
    process.exit(0);
  }

  // Watch-Loop alle 2 Sekunden
  const interval = setInterval(() => {
    const shouldExit = renderDashboard();

    if (shouldExit) {
      console.log('');
      console.log('✅ Agent/Worker completed - exiting');
      clearInterval(interval);
      process.exit(0);
    }
  }, 2000);

  // Graceful shutdown bei Ctrl+C
  process.on('SIGINT', () => {
    console.log('');
    console.log('👋 Agent Watch Dashboard beendet');
    clearInterval(interval);
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    clearInterval(interval);
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Agent Watch Dashboard Fehler:', error.message);
  process.exit(1);
});
