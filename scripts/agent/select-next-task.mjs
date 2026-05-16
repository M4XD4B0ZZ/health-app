#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync, statSync } from 'fs';
import { join } from 'path';
import { parseRoadmapTasks, selectNextTask } from './roadmap-parser.mjs';

/**
 * Agent Orchestrator - Task Selection
 *
 * Liest ROADMAP.md und wählt den nächsten sinnvollen Task aus:
 * 1. Bevorzugt ersten Task mit Status `in_progress`
 * 2. Falls kein `in_progress`, ersten Task mit Status `todo`
 * 3. Schreibt Ergebnis als JSON nach .agent/out/selected-task.json
 *
 * WICHTIG: Überschreibt IMMER die selected-task.json, auch wenn sie existiert.
 * Parst IMMER aus der aktuellen ROADMAP.md, ignoriert vorherige Auswahl.
 *
 * Nutzt robusten Parser aus roadmap-parser.mjs für alle Task-ID-Formate.
 */

const ROADMAP_PATH = 'ROADMAP.md';
const OUTPUT_PATH = '.agent/out/selected-task.json';

function main() {
  try {
    // Debug-Modus prüfen
    const debugMode = process.argv.includes('--debug');

    // ROADMAP.md prüfen
    if (!existsSync(ROADMAP_PATH)) {
      console.error('❌ ROADMAP.md nicht gefunden');
      process.exit(1);
    }

    // ROADMAP.md lesen
    const roadmapContent = readFileSync(ROADMAP_PATH, 'utf-8');
    console.log('📖 ROADMAP.md gelesen');

    // Tasks parsen mit neuem robusten Parser
    const tasks = parseRoadmapTasks(roadmapContent, { debug: debugMode });
    console.log(`📋 ${tasks.length} Tasks gefunden`);

    if (tasks.length === 0) {
      console.error('❌ Keine Tasks in ROADMAP.md gefunden');
      process.exit(1);
    }

    // Debug-Ausgabe aller Tasks
    if (debugMode) {
      console.log('\n🔍 Alle gefundenen Tasks:');
      tasks.forEach((task) => {
        console.log(`   ${task.id}: ${task.title} (${task.status}, Zeile: ${task.lineNumber})`);
      });
    }

    // Nächsten Task auswählen
    const result = selectNextTask(tasks, { debug: debugMode });

    // Ergebnis ausgeben
    if (result.selected) {
      console.log(`\n✅ Task ausgewählt: ${result.selected.id}`);
      console.log(`📝 Titel: ${result.selected.title}`);
      console.log(`🔄 Status: ${result.selected.status}`);
      console.log(`📍 Zeile: ${result.selected.lineNumber}`);
      console.log(`💡 Grund: ${result.reason}`);

      if (result.selected.dod) {
        console.log(`🎯 DoD: ${result.selected.dod}`);
      }
    } else {
      console.log(`\n⚠️  Kein Task verfügbar`);
      console.log(`💡 Grund: ${result.reason}`);
    }

    // Output-Verzeichnis sicherstellen
    const outputDir = '.agent/out';
    if (!existsSync(outputDir)) {
      mkdirSync(outputDir, { recursive: true });
    }

    // JSON-Output schreiben (IMMER überschreiben)
    const validTasks = tasks.filter((t) => t.status !== 'invalid');
    const outputData = {
      timestamp: new Date().toISOString(),
      totalTasks: tasks.length,
      validTasks: validTasks.length,
      invalidTasks: tasks.length - validTasks.length,
      availableTasks: validTasks.filter((t) => t.status === 'todo' || t.status === 'in_progress')
        .length,
      result: result,
      roadmapModified: existsSync(ROADMAP_PATH) ? statSync(ROADMAP_PATH).mtime.toISOString() : null,
      parserVersion: '2.0-robust',
    };

    writeFileSync(OUTPUT_PATH, JSON.stringify(outputData, null, 2));
    console.log(`\n💾 Ergebnis gespeichert: ${OUTPUT_PATH} (überschrieben)`);

    // Exit-Code setzen
    process.exit(result.selected ? 0 : 1);
  } catch (error) {
    console.error('❌ Fehler:', error.message);
    if (process.argv.includes('--debug')) {
      console.error('Stack Trace:', error.stack);
    }
    process.exit(1);
  }
}

main();
