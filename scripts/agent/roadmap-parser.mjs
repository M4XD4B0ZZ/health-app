#!/usr/bin/env node

/**
 * ROADMAP Parser - Gemeinsame Parser-Funktionen
 *
 * Robuster Parser für ROADMAP.md Tasks mit:
 * - Unterstützung aller Task-ID-Formate (P0-001, P2-001, RESOLVER-V2-001, etc.)
 * - Blockweise Status-Parsing
 * - Debug-Ausgabe und Line-Number-Tracking
 * - Einheitliche Parser-Logik für alle Agent-Scripts
 */

/**
 * Erkenne Task-Header mit verschiedenen Formaten
 * @param {string} line - Zeile zum Prüfen
 * @returns {Object|null} Task-Info oder null
 */
function parseTaskHeader(line) {
  const trimmed = line.trim();

  // Format 1: ## P0-001 Title
  const p0p1Match = trimmed.match(/^##\s+(P\d+-\d+)\s+(.+)$/);
  if (p0p1Match) {
    return {
      id: p0p1Match[1],
      title: p0p1Match[2],
      level: 2,
      format: 'P0/P1',
    };
  }

  // Format 2: ### P2-001 Title
  const p2Match = trimmed.match(/^###\s+(P2-\d+)\s+(.+)$/);
  if (p2Match) {
    return {
      id: p2Match[1],
      title: p2Match[2],
      level: 3,
      format: 'P2',
    };
  }

  // Format 3: #### RESOLVER-V2-001: Title
  const resolverMatch = trimmed.match(/^####\s+(RESOLVER-V2-\d+):\s*(.+)$/);
  if (resolverMatch) {
    return {
      id: resolverMatch[1],
      title: resolverMatch[2],
      level: 4,
      format: 'RESOLVER-V2',
    };
  }

  return null;
}

/**
 * Erkenne Status-Zeile
 * @param {string} line - Zeile zum Prüfen
 * @returns {string|null} Status oder null
 */
function parseStatusLine(line) {
  const trimmed = line.trim();
  const statusMatch = trimmed.match(/^Status:\s*`(.+)`$/);
  if (statusMatch) {
    const status = statusMatch[1];
    // Validiere Status
    const validStatuses = ['todo', 'in_progress', 'done', 'blocked'];
    if (validStatuses.includes(status)) {
      return status;
    }
  }
  return null;
}

/**
 * Erkenne DoD-Zeile
 * @param {string} line - Zeile zum Prüfen
 * @returns {string|null} DoD oder null
 */
function parseDoDLine(line) {
  const trimmed = line.trim();
  if (trimmed.startsWith('**DoD:**')) {
    return trimmed.replace('**DoD:**', '').trim();
  }
  return null;
}

/**
 * Prüfe ob Zeile ein Section-Ende markiert
 * @param {string} line - Zeile zum Prüfen
 * @param {number} currentTaskLevel - Level des aktuellen Tasks
 * @returns {boolean} True wenn Section-Ende
 */
function isSectionEnd(line, currentTaskLevel) {
  const trimmed = line.trim();

  // Leere Zeilen sind kein Section-Ende
  if (!trimmed) {
    return false;
  }

  // Prüfe auf Header gleicher oder höherer Ebene
  const headerMatch = trimmed.match(/^(#{1,6})\s+/);
  if (headerMatch) {
    const headerLevel = headerMatch[1].length;
    // Section endet bei Header gleicher oder höherer Ebene (niedrigere Zahl)
    return headerLevel <= currentTaskLevel;
  }

  return false;
}

/**
 * Parse ROADMAP.md und extrahiere alle Tasks
 * @param {string} content - ROADMAP.md Inhalt
 * @param {Object} options - Parser-Optionen
 * @returns {Array} Array von Task-Objekten
 */
export function parseRoadmapTasks(content, options = {}) {
  const { debug = false } = options;
  const tasks = [];
  const lines = content.split('\n');

  let currentTask = null;
  let inTaskSection = false;
  let lineNumber = 0;

  if (debug) {
    console.log('🔍 ROADMAP Parser Debug Mode aktiviert');
    console.log(`📄 Parsing ${lines.length} Zeilen`);
  }

  for (let i = 0; i < lines.length; i++) {
    lineNumber = i + 1;
    const line = lines[i];
    const trimmed = line.trim();

    // Task-Header erkennen
    const taskHeader = parseTaskHeader(line);
    if (taskHeader) {
      // Vorherigen Task speichern
      if (currentTask) {
        if (debug) {
          console.log(
            `✅ Task abgeschlossen: ${currentTask.id} (Status: ${currentTask.status}, Zeile: ${currentTask.lineNumber})`,
          );
        }
        tasks.push(currentTask);
      }

      // Neuen Task starten
      currentTask = {
        id: taskHeader.id,
        title: taskHeader.title,
        status: 'invalid', // Default: invalid bis Status gefunden
        description: '',
        dod: '',
        lineNumber: lineNumber,
        level: taskHeader.level,
        format: taskHeader.format,
        statusLineNumber: null,
        dodLineNumber: null,
      };
      inTaskSection = true;

      if (debug) {
        console.log(
          `🎯 Task gefunden: ${taskHeader.id} (${taskHeader.format}, Zeile: ${lineNumber})`,
        );
      }
      continue;
    }

    // Wenn wir in einem Task-Block sind
    if (inTaskSection && currentTask) {
      // Status erkennen
      const status = parseStatusLine(line);
      if (status) {
        currentTask.status = status;
        currentTask.statusLineNumber = lineNumber;
        if (debug) {
          console.log(`📊 Status gefunden: ${currentTask.id} -> ${status} (Zeile: ${lineNumber})`);
        }
        continue;
      }

      // DoD erkennen
      const dod = parseDoDLine(line);
      if (dod) {
        currentTask.dod = dod;
        currentTask.dodLineNumber = lineNumber;
        if (debug) {
          console.log(`🎯 DoD gefunden: ${currentTask.id} (Zeile: ${lineNumber})`);
        }
        continue;
      }

      // Section-Ende prüfen
      if (isSectionEnd(line, currentTask.level)) {
        if (debug) {
          console.log(`🔚 Section-Ende erkannt für ${currentTask.id} bei Zeile: ${lineNumber}`);
        }
        inTaskSection = false;
        continue;
      }

      // Beschreibung sammeln (nur nicht-leere Zeilen, die keine speziellen Marker sind)
      if (
        trimmed &&
        !trimmed.startsWith('Status:') &&
        !trimmed.startsWith('**DoD:**') &&
        !trimmed.startsWith('**Verify:**') &&
        !trimmed.startsWith('---')
      ) {
        if (currentTask.description) {
          currentTask.description += '\n' + trimmed;
        } else {
          currentTask.description = trimmed;
        }
      }
    }
  }

  // Letzten Task speichern
  if (currentTask) {
    if (debug) {
      console.log(
        `✅ Letzter Task abgeschlossen: ${currentTask.id} (Status: ${currentTask.status}, Zeile: ${currentTask.lineNumber})`,
      );
    }
    tasks.push(currentTask);
  }

  // Validierung und Warnungen
  const invalidTasks = tasks.filter((task) => task.status === 'invalid');
  if (invalidTasks.length > 0) {
    console.warn(`⚠️  ${invalidTasks.length} Tasks ohne gültigen Status gefunden:`);
    invalidTasks.forEach((task) => {
      console.warn(`   - ${task.id}: Kein Status gefunden (Zeile: ${task.lineNumber})`);
    });
  }

  if (debug) {
    console.log(`\n📋 Parser-Zusammenfassung:`);
    console.log(`   Gesamt Tasks: ${tasks.length}`);
    console.log(`   P0/P1 Tasks: ${tasks.filter((t) => t.format === 'P0/P1').length}`);
    console.log(`   P2 Tasks: ${tasks.filter((t) => t.format === 'P2').length}`);
    console.log(`   RESOLVER-V2 Tasks: ${tasks.filter((t) => t.format === 'RESOLVER-V2').length}`);
    console.log(`   Invalid Tasks: ${invalidTasks.length}`);
    console.log(`   Status Verteilung:`);
    ['todo', 'in_progress', 'done', 'blocked', 'invalid'].forEach((status) => {
      const count = tasks.filter((t) => t.status === status).length;
      if (count > 0) {
        console.log(`     ${status}: ${count}`);
      }
    });
  }

  return tasks;
}

/**
 * Finde Task-Status für spezifische Task-ID
 * @param {string} content - ROADMAP.md Inhalt
 * @param {string} taskId - Task ID (z.B. "P1-002")
 * @param {Object} options - Parser-Optionen
 * @returns {string|null} Task status oder null wenn nicht gefunden
 */
export function getTaskStatusFromRoadmap(content, taskId, options = {}) {
  const { debug = false } = options;
  const tasks = parseRoadmapTasks(content, { debug });

  const task = tasks.find((t) => t.id === taskId);
  if (!task) {
    if (debug) {
      console.log(`❌ Task ${taskId} nicht gefunden`);
    }
    return null;
  }

  if (debug) {
    console.log(`✅ Task ${taskId} gefunden: Status=${task.status}, Zeile=${task.lineNumber}`);
  }

  return task.status === 'invalid' ? null : task.status;
}

/**
 * Wähle nächsten verfügbaren Task aus
 * @param {Array} tasks - Array von Task-Objekten
 * @param {Object} options - Auswahl-Optionen
 * @returns {Object} Auswahl-Ergebnis
 */
export function selectNextTask(tasks, options = {}) {
  const { debug = false } = options;

  // Filtere nur gültige Tasks
  const validTasks = tasks.filter((task) => task.status !== 'invalid');

  if (debug) {
    console.log(`🔍 Task-Auswahl aus ${validTasks.length} gültigen Tasks`);
  }

  // 1. Suche ersten Task mit Status `in_progress`
  const inProgressTask = validTasks.find((task) => task.status === 'in_progress');
  if (inProgressTask) {
    if (debug) {
      console.log(`✅ In-Progress Task gefunden: ${inProgressTask.id}`);
    }
    return {
      selected: inProgressTask,
      reason: 'Task bereits in Bearbeitung',
    };
  }

  // 2. Suche ersten Task mit Status `todo`
  const todoTask = validTasks.find((task) => task.status === 'todo');
  if (todoTask) {
    if (debug) {
      console.log(`✅ Todo Task gefunden: ${todoTask.id}`);
    }
    return {
      selected: todoTask,
      reason: 'Nächster verfügbarer Task',
    };
  }

  if (debug) {
    console.log(`❌ Keine verfügbaren Tasks gefunden`);
    console.log(`   Status-Verteilung:`);
    ['todo', 'in_progress', 'done', 'blocked'].forEach((status) => {
      const count = validTasks.filter((t) => t.status === status).length;
      console.log(`     ${status}: ${count}`);
    });
  }

  return {
    selected: null,
    reason: 'Keine verfügbaren Tasks gefunden (nur done/blocked/invalid)',
  };
}
