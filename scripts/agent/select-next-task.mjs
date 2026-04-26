#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Agent Orchestrator - Task Selection
 *
 * Liest ROADMAP.md und wählt den nächsten sinnvollen Task aus:
 * 1. Bevorzugt ersten Task mit Status `in_progress`
 * 2. Falls kein `in_progress`, ersten Task mit Status `todo`
 * 3. Schreibt Ergebnis als JSON nach .agent/out/selected-task.json
 */

const ROADMAP_PATH = 'ROADMAP.md';
const OUTPUT_PATH = '.agent/out/selected-task.json';

function parseRoadmapTasks(content) {
  const tasks = [];
  const lines = content.split('\n');

  let currentTask = null;
  let inTaskSection = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Task-Header erkennen (## P0-001, ## P1-002, etc.)
    const taskMatch = line.match(/^##\s+(P\d+-\d+)\s+(.+)$/);
    if (taskMatch) {
      // Vorherigen Task speichern
      if (currentTask) {
        tasks.push(currentTask);
      }

      currentTask = {
        id: taskMatch[1],
        title: taskMatch[2],
        status: 'unknown',
        description: '',
        dod: '',
      };
      inTaskSection = true;
      continue;
    }

    // Status erkennen
    const statusMatch = line.match(/^Status:\s*`(.+)`$/);
    if (statusMatch && currentTask) {
      currentTask.status = statusMatch[1];
      continue;
    }

    // DoD erkennen
    if (line.startsWith('**DoD:**') && currentTask) {
      currentTask.dod = line.replace('**DoD:**', '').trim();
      continue;
    }

    // Beschreibung sammeln (bis zum nächsten Task oder Section)
    if (
      inTaskSection &&
      currentTask &&
      line &&
      !line.startsWith('#') &&
      !line.startsWith('Status:') &&
      !line.startsWith('**DoD:**')
    ) {
      if (currentTask.description) {
        currentTask.description += '\n' + line;
      } else {
        currentTask.description = line;
      }
    }

    // Section-Ende erkennen
    if (line.startsWith('#') && !line.startsWith('##') && inTaskSection) {
      inTaskSection = false;
    }
  }

  // Letzten Task speichern
  if (currentTask) {
    tasks.push(currentTask);
  }

  return tasks;
}

function selectNextTask(tasks) {
  // 1. Suche ersten Task mit Status `in_progress`
  const inProgressTask = tasks.find((task) => task.status === 'in_progress');
  if (inProgressTask) {
    return {
      selected: inProgressTask,
      reason: 'Task bereits in Bearbeitung',
    };
  }

  // 2. Suche ersten Task mit Status `todo`
  const todoTask = tasks.find((task) => task.status === 'todo');
  if (todoTask) {
    return {
      selected: todoTask,
      reason: 'Nächster verfügbarer Task',
    };
  }

  return {
    selected: null,
    reason: 'Keine verfügbaren Tasks gefunden (nur done/blocked)',
  };
}

function main() {
  try {
    // ROADMAP.md prüfen
    if (!existsSync(ROADMAP_PATH)) {
      console.error('❌ ROADMAP.md nicht gefunden');
      process.exit(1);
    }

    // ROADMAP.md lesen
    const roadmapContent = readFileSync(ROADMAP_PATH, 'utf-8');
    console.log('📖 ROADMAP.md gelesen');

    // Tasks parsen
    const tasks = parseRoadmapTasks(roadmapContent);
    console.log(`📋 ${tasks.length} Tasks gefunden`);

    if (tasks.length === 0) {
      console.error('❌ Keine Tasks in ROADMAP.md gefunden');
      process.exit(1);
    }

    // Nächsten Task auswählen
    const result = selectNextTask(tasks);

    // Ergebnis ausgeben
    if (result.selected) {
      console.log(`\n✅ Task ausgewählt: ${result.selected.id}`);
      console.log(`📝 Titel: ${result.selected.title}`);
      console.log(`🔄 Status: ${result.selected.status}`);
      console.log(`💡 Grund: ${result.reason}`);

      if (result.selected.dod) {
        console.log(`🎯 DoD: ${result.selected.dod}`);
      }
    } else {
      console.log(`\n⚠️  Kein Task verfügbar`);
      console.log(`💡 Grund: ${result.reason}`);
    }

    // JSON-Output schreiben
    const outputData = {
      timestamp: new Date().toISOString(),
      totalTasks: tasks.length,
      availableTasks: tasks.filter((t) => t.status === 'todo' || t.status === 'in_progress').length,
      result: result,
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 Ergebnis gespeichert: ${OUTPUT_PATH}`);

    // Exit-Code setzen
    process.exit(result.selected ? 0 : 1);
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    process.exit(1);
  }
}

main();
