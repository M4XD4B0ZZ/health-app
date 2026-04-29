import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load Model Selection from Registry
function loadModelSelection(repoRoot) {
  const modelSelectionPath = path.join(repoRoot, '.agent', 'out', 'model-selection.json');

  if (fs.existsSync(modelSelectionPath)) {
    try {
      const selectionContent = fs.readFileSync(modelSelectionPath, 'utf-8');
      const selection = JSON.parse(selectionContent);
      return selection.model;
    } catch (e) {
      console.warn(`Warnung: Fehler beim Lesen von model-selection.json: ${e.message}`);
    }
  }

  return null;
}

// Load OpenCode configuration
function loadOpenCodeConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.agent', 'config.json');

  // Default configuration
  const defaultConfig = {
    model: 'openai/gpt-5.3-codex', // Updated default to codex
    agent: null,
    command: 'opencode',
    maxFixAttempts: 1,
    workerTimeoutMs: 900000, // 15 minutes default
  };

  // 1. Priorität: Model Selection aus Registry
  const selectedModel = loadModelSelection(repoRoot);
  if (selectedModel) {
    console.log(`🎯 Verwende Modell aus Registry: ${selectedModel}`);
    defaultConfig.model = selectedModel;
  }

  // 2. Priorität: Explizite Konfiguration
  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      const mergedConfig = { ...defaultConfig, ...config.opencode };

      // Registry-Modell hat Vorrang vor config.json, außer bei explizitem Override
      if (selectedModel && !config.opencode?.model) {
        mergedConfig.model = selectedModel;
      }

      return mergedConfig;
    } catch (e) {
      console.warn(`Warnung: Fehler beim Lesen von .agent/config.json: ${e.message}`);
      console.warn('Verwende Default-Konfiguration mit Registry-Modell.');
      return defaultConfig;
    }
  }

  return defaultConfig;
}

// Worker Status Management
function writeWorkerStatus(statusPath, status, data = {}) {
  const statusData = {
    status,
    startedAt: data.startedAt || null,
    finishedAt: data.finishedAt || null,
    elapsedMs: data.elapsedMs || null,
    model: data.model || null,
    agent: data.agent || null,
    promptFile: data.promptFile || null,
    exitCode: data.exitCode || null,
    reportPath: '.agent/out/opencode-report.md',
    liveLogPath: '.agent/out/opencode-live.log',
    ...data,
  };

  try {
    fs.writeFileSync(statusPath, JSON.stringify(statusData, null, 2));
  } catch (e) {
    console.warn(`Warnung: Fehler beim Schreiben von worker-status.json: ${e.message}`);
  }
}

// Format elapsed time
function formatElapsed(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

async function main() {
  const startTime = Date.now();
  let heartbeatInterval = null;
  let timeoutId = null;
  let opencode = null;

  try {
    // Robust repo root detection
    const repoRoot = path.resolve(__dirname, '../../');

    // Load OpenCode configuration
    const openCodeConfig = loadOpenCodeConfig(repoRoot);

    // Check for optional prompt file argument
    const customPromptFile = process.argv[2];
    let promptPath;

    if (customPromptFile) {
      // Use custom prompt file (e.g., fix-prompt.md)
      promptPath = path.isAbsolute(customPromptFile)
        ? customPromptFile
        : path.join(repoRoot, customPromptFile);
    } else {
      // Use default next-prompt.md
      promptPath = path.join(repoRoot, '.agent', 'out', 'next-prompt.md');
    }

    const reportPath = path.join(repoRoot, '.agent', 'out', 'opencode-report.md');
    const liveLogPath = path.join(repoRoot, '.agent', 'out', 'opencode-live.log');
    const workerStatusPath = path.join(repoRoot, '.agent', 'out', 'worker-status.json');
    const statePath = path.join(repoRoot, '.agent', 'state.json');

    // Ensure output directory exists
    const outputDir = path.dirname(reportPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Initialize live log (clear previous content)
    fs.writeFileSync(liveLogPath, '');

    // Initialize worker status
    writeWorkerStatus(workerStatusPath, 'running', {
      startedAt: new Date().toISOString(),
      model: openCodeConfig.model,
      agent: openCodeConfig.agent,
      promptFile: customPromptFile || '.agent/out/next-prompt.md',
    });

    // Check if prompt file exists
    if (!fs.existsSync(promptPath)) {
      const expectedFile = customPromptFile || '.agent/out/next-prompt.md';
      console.error(
        `Fehler: ${expectedFile} nicht gefunden. ${customPromptFile ? 'Prüfe Pfad zur Prompt-Datei.' : 'Bitte zuerst \`npm run agent:run\` ausführen.'}`,
      );

      writeWorkerStatus(workerStatusPath, 'failed', {
        startedAt: new Date().toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs: Date.now() - startTime,
        exitCode: 1,
      });

      process.exit(1);
    }

    // Read prompt file
    const promptContent = fs.readFileSync(promptPath, 'utf-8');

    // Safety header
    const safetyHeader = [
      'You are running as an automated OpenCode worker.',
      'Implement only the selected task.',
      'Do not commit or push.',
      'Do not edit .env or secrets.',
      'Do not install dependencies.',
      'After editing, summarize changed files and required verification.',
      '',
    ].join('\n');

    const fullPrompt = safetyHeader + '\n' + promptContent;

    // Terminal output with configuration info
    console.log('🚀 OpenCode Worker gestartet');
    console.log(`📋 Prompt-Datei: ${customPromptFile || '.agent/out/next-prompt.md'}`);
    console.log(`🤖 Modell: ${openCodeConfig.model}`);
    console.log(`👤 Agent: ${openCodeConfig.agent || 'null'}`);
    console.log(`⏱️  Timeout: ${Math.floor(openCodeConfig.workerTimeoutMs / 60000)} Minuten`);
    console.log(`📝 Live-Log: ${liveLogPath}`);
    console.log('');

    // Spawn OpenCode process with explicit model configuration
    const args = ['run', fullPrompt, '--model', openCodeConfig.model];

    // Add agent parameter if configured
    if (openCodeConfig.agent) {
      args.push('--agent', openCodeConfig.agent);
    }

    opencode = spawn(openCodeConfig.command, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Setup timeout
    timeoutId = setTimeout(() => {
      console.log('\n⏰ Timeout erreicht - OpenCode Worker wird beendet');

      if (opencode && !opencode.killed) {
        opencode.kill('SIGTERM');

        // Force kill after 5 seconds
        setTimeout(() => {
          if (opencode && !opencode.killed) {
            opencode.kill('SIGKILL');
          }
        }, 5000);
      }

      const elapsedMs = Date.now() - startTime;
      writeWorkerStatus(workerStatusPath, 'timeout', {
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        model: openCodeConfig.model,
        agent: openCodeConfig.agent,
        promptFile: customPromptFile || '.agent/out/next-prompt.md',
        exitCode: 1,
      });

      // Update state for timeout
      let state = {};
      if (fs.existsSync(statePath)) {
        try {
          const raw = fs.readFileSync(statePath, 'utf-8');
          state = JSON.parse(raw);
        } catch (e) {
          console.error(
            'Warnung: state.json konnte nicht gelesen werden, neuer State wird angelegt.',
          );
          state = {};
        }
      }

      state.status = 'worker_timeout';
      state.lastStep = 'opencode_worker_timeout';
      state.lastUpdated = new Date().toISOString();
      state.verifyPassed = false;

      try {
        const agentDir = path.dirname(statePath);
        if (!fs.existsSync(agentDir)) {
          fs.mkdirSync(agentDir, { recursive: true });
        }
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
      } catch (e) {
        console.error('Fehler beim Schreiben von state.json:', e);
      }

      process.exit(1);
    }, openCodeConfig.workerTimeoutMs);

    // Setup heartbeat (every 30 seconds)
    heartbeatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const heartbeatMsg = `OpenCode worker still running... elapsed: ${formatElapsed(elapsed)}\n`;

      console.log(`💓 ${heartbeatMsg.trim()}`);

      // Write heartbeat to live log
      fs.appendFileSync(liveLogPath, `[${new Date().toISOString()}] HEARTBEAT: ${heartbeatMsg}`);
    }, 30000);

    // Create live log and report streams
    const liveLogStream = fs.createWriteStream(liveLogPath, { flags: 'a' });
    const reportStream = fs.createWriteStream(reportPath, { flags: 'w' });

    // Write report header
    reportStream.write(`# OpenCode Worker Report\n\n`);
    reportStream.write(`Started: ${new Date().toISOString()}\n\n`);
    reportStream.write(`## Configuration\n`);
    reportStream.write(`Model: ${openCodeConfig.model}\n`);
    reportStream.write(`Agent: ${openCodeConfig.agent || 'null'}\n`);
    reportStream.write(`Command: ${openCodeConfig.command}\n`);
    reportStream.write(
      `Timeout: ${Math.floor(openCodeConfig.workerTimeoutMs / 60000)} minutes\n\n`,
    );
    reportStream.write(`## Command\n\`${openCodeConfig.command} ${args.join(' ')}\`\n\n`);
    reportStream.write(`## Output\n\n`);

    // Handle stdout - live stream to terminal and write to both logs
    opencode.stdout.on('data', (data) => {
      const dataStr = data.toString();

      // Live stream to terminal
      process.stdout.write(dataStr);

      // Write to both log files
      liveLogStream.write(dataStr);
      reportStream.write(dataStr);
    });

    // Handle stderr - live stream to terminal and write to both logs
    opencode.stderr.on('data', (data) => {
      const dataStr = data.toString();

      // Live stream to terminal
      process.stderr.write(dataStr);

      // Write to both log files
      liveLogStream.write(dataStr);
      reportStream.write(dataStr);
    });

    opencode.on('close', (code) => {
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;

      // Clear timeout and heartbeat
      if (timeoutId) clearTimeout(timeoutId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      // Close streams
      liveLogStream.end();

      // Finalize report
      reportStream.write(`\n\n## Exit Code\n${code}\n`);
      reportStream.write(`\nCompleted: ${new Date().toISOString()}\n`);
      reportStream.write(`\nElapsed: ${formatElapsed(elapsedMs)}\n`);
      reportStream.end();

      // Update worker status
      writeWorkerStatus(workerStatusPath, code === 0 ? 'completed' : 'failed', {
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        model: openCodeConfig.model,
        agent: openCodeConfig.agent,
        promptFile: customPromptFile || '.agent/out/next-prompt.md',
        exitCode: code,
      });

      // Terminal output
      console.log(`\n✅ OpenCode Worker beendet mit Exit-Code: ${code}`);
      console.log(`⏱️  Laufzeit: ${formatElapsed(elapsedMs)}`);
      console.log(`📄 Report: ${reportPath}`);
      console.log(`📝 Live-Log: ${liveLogPath}`);
      console.log('🔄 Nächster Schritt: npm run agent:verify');

      // Update state
      let state = {};
      if (fs.existsSync(statePath)) {
        try {
          const raw = fs.readFileSync(statePath, 'utf-8');
          state = JSON.parse(raw);
        } catch (e) {
          console.error(
            'Warnung: state.json konnte nicht gelesen werden, neuer State wird angelegt.',
          );
          state = {};
        }
      }

      state.status = code === 0 ? 'worker_completed' : 'worker_failed';
      state.lastStep = 'opencode_worker';
      state.lastUpdated = new Date().toISOString();
      state.verifyPassed = false;
      // currentTaskId and currentTaskTitle bleiben erhalten

      try {
        // Ensure .agent directory exists
        const agentDir = path.dirname(statePath);
        if (!fs.existsSync(agentDir)) {
          fs.mkdirSync(agentDir, { recursive: true });
        }
        fs.writeFileSync(statePath, JSON.stringify(state, null, 2), 'utf-8');
      } catch (e) {
        console.error('Fehler beim Schreiben von state.json:', e);
      }

      if (code !== 0) {
        process.exit(1);
      } else {
        process.exit(0);
      }
    });

    opencode.on('error', (err) => {
      const elapsedMs = Date.now() - startTime;

      // Clear timeout and heartbeat
      if (timeoutId) clearTimeout(timeoutId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);

      console.error('❌ Fehler: OpenCode ist nicht installiert oder nicht im PATH.');
      console.error('Details:', err.message);

      // Update worker status
      writeWorkerStatus(workerStatusPath, 'failed', {
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        exitCode: 1,
      });

      // Write error to report
      const reportStream = fs.createWriteStream(reportPath, { flags: 'w' });
      reportStream.write(`# OpenCode Worker Report\n\n`);
      reportStream.write(`Started: ${new Date().toISOString()}\n\n`);
      reportStream.write(`## Error\nOpenCode ist nicht installiert oder nicht im PATH.\n`);
      reportStream.write(`Details: ${err.message}\n`);
      reportStream.end();

      process.exit(1);
    });
  } catch (err) {
    const elapsedMs = Date.now() - startTime;

    // Clear timeout and heartbeat
    if (timeoutId) clearTimeout(timeoutId);
    if (heartbeatInterval) clearInterval(heartbeatInterval);

    console.error('❌ Unbekannter Fehler:', err);

    // Try to update worker status
    try {
      const repoRoot = path.resolve(__dirname, '../../');
      const workerStatusPath = path.join(repoRoot, '.agent', 'out', 'worker-status.json');
      writeWorkerStatus(workerStatusPath, 'failed', {
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        exitCode: 1,
      });
    } catch (e) {
      // Ignore errors in error handling
    }

    process.exit(1);
  }
}

main();
