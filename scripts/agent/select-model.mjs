#!/usr/bin/env node

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { spawn } from 'child_process';
import { join } from 'path';

/**
 * Model Selection Agent (Phase D.6)
 *
 * Implementiert automatisierte, kontrollierte Modellwahl über Model Registry.
 * Nutzt LLM Router für intelligente Modellselektion basierend auf Task-Eigenschaften.
 *
 * Workflow:
 * 1. Lade Model Registry (.agent/models.json oder fallback zu example)
 * 2. Lade aktuellen Task aus selected-task.json
 * 3. Router Prompt an OpenCode für Modellwahl
 * 4. Validiere gewähltes Modell gegen Registry
 * 5. Schreibe model-selection.json
 *
 * Wichtige Grenzen:
 * - Keine freie Modellwahl außerhalb der Registry
 * - Keine Heuristik, nur LLM-basierte Entscheidung
 * - Fallback zu gpt-5.3-codex bei Fehlern
 */

const MODELS_PATH = '.agent/models.json';
const MODELS_EXAMPLE_PATH = '.agent/models.example.json';
const SELECTED_TASK_PATH = '.agent/out/selected-task.json';
const MODEL_SELECTION_PATH = '.agent/out/model-selection.json';

// Model Registry laden
function loadModelRegistry() {
  let registryPath = MODELS_PATH;

  // Fallback zu example wenn models.json nicht existiert
  if (!existsSync(MODELS_PATH)) {
    console.log('⚠️  .agent/models.json nicht gefunden, verwende models.example.json');
    registryPath = MODELS_EXAMPLE_PATH;
  }

  if (!existsSync(registryPath)) {
    throw new Error(`Model Registry nicht gefunden: ${registryPath}`);
  }

  const registryContent = readFileSync(registryPath, 'utf-8');
  const registry = JSON.parse(registryContent);

  if (!registry.models || !Array.isArray(registry.models)) {
    throw new Error('Ungültige Model Registry: models Array fehlt');
  }

  console.log(`📋 Model Registry geladen: ${registry.models.length} Modelle verfügbar`);
  return registry;
}

// Task laden
function loadSelectedTask() {
  if (!existsSync(SELECTED_TASK_PATH)) {
    throw new Error(`Selected Task nicht gefunden: ${SELECTED_TASK_PATH}`);
  }

  const taskContent = readFileSync(SELECTED_TASK_PATH, 'utf-8');
  const taskData = JSON.parse(taskContent);

  if (!taskData.result || !taskData.result.selected) {
    throw new Error('Ungültige Task-Daten: selected Task fehlt');
  }

  return taskData.result.selected;
}

// Router Prompt erstellen
function createRouterPrompt(task, models) {
  const modelList = models
    .map(
      (model) =>
        `- ${model.id} (tier: ${model.tier}, strengths: ${model.strengths.join(', ')}, cost: ${model.cost}, risk: ${model.risk})`,
    )
    .join('\n');

  return `You are a model selection agent. Choose the BEST model for this task.

Task: ${task.id} - ${task.title}
Description: ${task.description}
Definition of Done: ${task.dod}

Available models:
${modelList}

Rules:
- Choose the cheapest model that can safely solve the task
- Prefer codex models for code changes/editing/fixes
- Prefer strong models for complex reasoning, architecture, multi-file changes
- Never choose cheap models if uncertain about task complexity
- Consider task risk vs model capability

Respond with ONLY this JSON format:
{"model":"selected_model_id","risk":"low|medium|high","reason":"brief explanation"}`;
}

// Codex CLI für Router ausführen
function runModelRouter(prompt) {
  return new Promise((resolve, reject) => {
    console.log('🤖 Führe Codex Model Router aus...');

    // Verwende exec ohne Prompt-Argument, sende Prompt über stdin
    const args = ['exec'];

    const codex = spawn('codex', args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';
    let timeoutId;

    // 90 Sekunden Timeout
    timeoutId = setTimeout(() => {
      console.warn('⏰ Codex Timeout nach 90 Sekunden');
      codex.kill('SIGTERM');
      reject(new Error('Codex Timeout nach 90 Sekunden'));
    }, 90000);

    // Sende Prompt über stdin
    codex.stdin.write(prompt);
    codex.stdin.end();

    codex.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    codex.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    codex.on('close', (code) => {
      clearTimeout(timeoutId);

      if (code !== 0) {
        reject(new Error(`Codex Router fehlgeschlagen (${code}): ${stderr}`));
        return;
      }

      // Extrahiere JSON aus der Antwort
      try {
        // Suche nach JSON in verschiedenen Formaten
        let jsonText = null;

        // 1. Suche nach JSON in Code-Blöcken (```json ... ```)
        const codeBlockMatch = stdout.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/);
        if (codeBlockMatch) {
          jsonText = codeBlockMatch[1];
        } else {
          // 2. Suche nach direktem JSON Block - letztes JSON im Output
          const directMatches = stdout.match(/\{[\s\S]*?\}/g);
          if (directMatches && directMatches.length > 0) {
            // Nimm das letzte JSON (nach allen Logs)
            jsonText = directMatches[directMatches.length - 1];
          }
        }

        if (!jsonText) {
          throw new Error('Keine JSON-Antwort gefunden');
        }

        const response = JSON.parse(jsonText.trim());

        // Validiere erforderliche Felder
        if (!response.model || !response.risk || !response.reason) {
          throw new Error(
            'Unvollständige Router-Antwort: model, risk und reason sind erforderlich',
          );
        }

        resolve(response);
      } catch (e) {
        reject(new Error(`Ungültige Router-Antwort: ${e.message}\nOutput: ${stdout}`));
      }
    });

    codex.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(new Error(`Codex nicht verfügbar: ${err.message}`));
    });
  });
}

// Modell validieren
function validateModelSelection(selectedModel, registry) {
  const model = registry.models.find((m) => m.id === selectedModel);
  if (!model) {
    console.warn(`⚠️  Gewähltes Modell nicht in Registry gefunden: ${selectedModel}`);
    return null;
  }
  return model;
}

// Fallback Modell
function getFallbackModel(registry) {
  // Suche nach gpt-5.3-codex als Default
  const defaultModel = registry.models.find((m) => m.id === 'openai/gpt-5.3-codex');
  if (defaultModel) {
    return {
      model: defaultModel.id,
      risk: defaultModel.risk,
      reason: 'Fallback: Router-Fehler oder ungültiges Modell',
      source: 'fallback_invalid_model',
    };
  }

  // Fallback zum ersten verfügbaren Modell
  const firstModel = registry.models[0];
  return {
    model: firstModel.id,
    risk: firstModel.risk,
    reason: 'Fallback: Erstes verfügbares Modell',
    source: 'fallback_first_available',
  };
}

// Model Selection schreiben
function writeModelSelection(selection) {
  // Ensure output directory exists
  const outputDir = '.agent/out';
  if (!existsSync(outputDir)) {
    mkdirSync(outputDir, { recursive: true });
  }

  const selectionData = {
    ...selection,
    timestamp: new Date().toISOString(),
    source: selection.source || 'llm_registry',
  };

  writeFileSync(MODEL_SELECTION_PATH, JSON.stringify(selectionData, null, 2));
  console.log(`✅ Model Selection geschrieben: ${MODEL_SELECTION_PATH}`);
  console.log(`📊 Gewähltes Modell: ${selectionData.model} (${selectionData.risk} risk)`);
  console.log(`💡 Grund: ${selectionData.reason}`);
}

// Hauptlogik
async function main() {
  try {
    console.log('🚀 Model Selection Agent gestartet (Phase D.6)\n');

    // 1. Model Registry laden
    const registry = loadModelRegistry();

    // 2. Task laden
    const task = loadSelectedTask();
    console.log(`📋 Task geladen: ${task.id} - ${task.title}`);

    // 3. Router Prompt erstellen
    const routerPrompt = createRouterPrompt(task, registry.models);

    try {
      // 4. Router ausführen
      const routerResponse = await runModelRouter(routerPrompt);
      console.log('🎯 Router-Antwort erhalten');

      // 5. Modell validieren
      const validatedModel = validateModelSelection(routerResponse.model, registry);

      if (validatedModel) {
        // Erfolgreiche Modellwahl
        const selection = {
          model: routerResponse.model,
          risk: routerResponse.risk,
          reason: routerResponse.reason,
        };

        writeModelSelection(selection);
      } else {
        // Ungültiges Modell - Fallback
        console.warn('⚠️  Ungültiges Modell gewählt, verwende Fallback');
        const fallbackSelection = getFallbackModel(registry);
        writeModelSelection(fallbackSelection);
      }
    } catch (routerError) {
      // Router-Fehler - Fallback mit detailliertem Logging
      console.warn(`⚠️  Router-Fehler: ${routerError.message}`);
      console.log('🔄 Verwende Fallback-Modell');

      // Detailliertes Error-Logging
      const errorLog = {
        timestamp: new Date().toISOString(),
        error: routerError.message,
        task: task,
        prompt: routerPrompt.substring(0, 500) + '...',
        stack: routerError.stack,
      };

      // Ensure error log directory exists
      const errorDir = '.agent/out';
      if (!existsSync(errorDir)) {
        mkdirSync(errorDir, { recursive: true });
      }

      // Write detailed error log
      writeFileSync('.agent/out/model-router-error.log', JSON.stringify(errorLog, null, 2));
      console.log('📝 Detaillierter Fehler geschrieben: .agent/out/model-router-error.log');

      const fallbackSelection = getFallbackModel(registry);
      fallbackSelection.source = 'fallback_error';
      fallbackSelection.error = routerError.message;
      writeModelSelection(fallbackSelection);
    }

    console.log('\n✅ Model Selection abgeschlossen');
    process.exit(0);
  } catch (error) {
    console.error('❌ Model Selection fehlgeschlagen:', error.message);
    process.exit(1);
  }
}

main();
