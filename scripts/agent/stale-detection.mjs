#!/usr/bin/env node

import { readFileSync, existsSync, statSync } from 'fs';
import { getTaskStatusFromRoadmap } from './roadmap-parser.mjs';

/**
 * Stale Detection Utilities
 *
 * Hilfsfunktionen zur Erkennung veralteter selected-task.json Dateien
 * basierend auf ROADMAP.md Änderungen und Task-Status.
 *
 * Nutzt robusten Parser aus roadmap-parser.mjs für konsistente Task-Erkennung.
 */

const ROADMAP_PATH = 'ROADMAP.md';
const SELECTED_TASK_PATH = '.agent/out/selected-task.json';

/**
 * Prüft ob selected-task.json veraltet ist
 * @returns {Object} Stale detection result
 */
export function checkSelectedTaskStale() {
  // 1. Prüfe ob beide Dateien existieren
  if (!existsSync(ROADMAP_PATH)) {
    return {
      isStale: true,
      reason: 'ROADMAP.md nicht gefunden',
      shouldReselect: true,
      error: 'ROADMAP.md missing',
    };
  }

  if (!existsSync(SELECTED_TASK_PATH)) {
    return {
      isStale: true,
      reason: 'selected-task.json nicht gefunden',
      shouldReselect: true,
      error: 'selected-task.json missing',
    };
  }

  try {
    // 2. Prüfe Modified Times
    const roadmapStat = statSync(ROADMAP_PATH);
    const selectedTaskStat = statSync(SELECTED_TASK_PATH);

    const roadmapModified = roadmapStat.mtime;
    const selectedTaskModified = selectedTaskStat.mtime;

    // 3. Lade selected-task.json
    const selectedTaskContent = readFileSync(SELECTED_TASK_PATH, 'utf-8');
    const selectedTaskData = JSON.parse(selectedTaskContent);

    if (!selectedTaskData.result || !selectedTaskData.result.selected) {
      return {
        isStale: true,
        reason: 'selected-task.json enthält keinen ausgewählten Task',
        shouldReselect: true,
        error: 'no selected task in json',
      };
    }

    const selectedTask = selectedTaskData.result.selected;

    // 4. Prüfe ob ROADMAP.md neuer ist als selected-task.json
    if (roadmapModified > selectedTaskModified) {
      return {
        isStale: true,
        reason: `ROADMAP.md ist neuer (${roadmapModified.toISOString()}) als selected-task.json (${selectedTaskModified.toISOString()})`,
        shouldReselect: true,
        roadmapModified: roadmapModified.toISOString(),
        selectedTaskModified: selectedTaskModified.toISOString(),
        selectedTaskId: selectedTask.id,
      };
    }

    // 5. Lade ROADMAP.md und prüfe Task-Status
    const roadmapContent = readFileSync(ROADMAP_PATH, 'utf-8');
    const currentTaskStatus = getTaskStatusFromRoadmap(roadmapContent, selectedTask.id, {
      debug: false,
    });

    if (!currentTaskStatus) {
      return {
        isStale: true,
        reason: `Task ${selectedTask.id} nicht mehr in ROADMAP.md gefunden`,
        shouldReselect: true,
        selectedTaskId: selectedTask.id,
      };
    }

    // 6. Prüfe ob Task inzwischen done oder blocked ist
    if (currentTaskStatus === 'done' || currentTaskStatus === 'blocked') {
      return {
        isStale: true,
        reason: `Task ${selectedTask.id} hat Status '${currentTaskStatus}' in ROADMAP.md`,
        shouldReselect: true,
        selectedTaskId: selectedTask.id,
        currentStatus: currentTaskStatus,
        selectedStatus: selectedTask.status,
      };
    }

    // 7. Prüfe ob Status sich geändert hat
    if (currentTaskStatus !== selectedTask.status) {
      return {
        isStale: true,
        reason: `Task ${selectedTask.id} Status geändert: '${selectedTask.status}' -> '${currentTaskStatus}'`,
        shouldReselect: true,
        selectedTaskId: selectedTask.id,
        currentStatus: currentTaskStatus,
        selectedStatus: selectedTask.status,
      };
    }

    // 8. Alles OK - nicht stale
    return {
      isStale: false,
      reason: 'selected-task.json ist aktuell',
      shouldReselect: false,
      selectedTaskId: selectedTask.id,
      currentStatus: currentTaskStatus,
      roadmapModified: roadmapModified.toISOString(),
      selectedTaskModified: selectedTaskModified.toISOString(),
    };
  } catch (error) {
    return {
      isStale: true,
      reason: `Fehler beim Stale-Check: ${error.message}`,
      shouldReselect: true,
      error: error.message,
    };
  }
}

/**
 * Hilfsfunktion für CLI-Scripts: Prüft Stale und beendet mit Fehlermeldung
 * @param {string} scriptName - Name des aufrufenden Scripts
 */
export function checkStaleAndExit(scriptName) {
  const staleCheck = checkSelectedTaskStale();

  if (staleCheck.isStale) {
    console.error(`❌ ${scriptName}: selected-task.json ist veraltet`);
    console.error(`💡 Grund: ${staleCheck.reason}`);
    console.error('🔄 Führe aus: npm run agent:next');
    process.exit(1);
  }

  return staleCheck;
}

/**
 * Hilfsfunktion: Gibt Stale-Check Informationen aus
 * @param {Object} staleCheck - Ergebnis von checkSelectedTaskStale()
 */
export function logStaleCheckResult(staleCheck) {
  if (staleCheck.isStale) {
    console.log(`⚠️  Stale Detection: ${staleCheck.reason}`);
    if (staleCheck.selectedTaskId) {
      console.log(`📋 Betroffener Task: ${staleCheck.selectedTaskId}`);
    }
    if (staleCheck.currentStatus && staleCheck.selectedStatus) {
      console.log(`🔄 Status: ${staleCheck.selectedStatus} -> ${staleCheck.currentStatus}`);
    }
  } else {
    console.log(`✅ Stale Detection: ${staleCheck.reason}`);
    if (staleCheck.selectedTaskId) {
      console.log(`📋 Aktueller Task: ${staleCheck.selectedTaskId} (${staleCheck.currentStatus})`);
    }
  }
}
