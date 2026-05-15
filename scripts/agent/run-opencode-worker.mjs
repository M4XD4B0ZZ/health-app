import { spawn, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Check if running in debug mode
const isDebugMode = process.argv.includes('--debug');
const isMatrixMode = process.argv.includes('--matrix');

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
    inactivityTimeoutMs: 90000, // 90 seconds default
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

// Windows-compatible command resolution with debug info
function resolveOpenCodeCommand() {
  const platform = process.platform;
  let whereOpencode = null;
  let whereOpencodeCmd = null;
  let resolvedCommand = null;

  if (platform === 'win32') {
    // Windows: Use where.exe to find absolute path to opencode.cmd
    try {
      // First try: where.exe opencode.cmd
      whereOpencodeCmd = execSync('where.exe opencode.cmd', {
        encoding: 'utf8',
        stdio: 'pipe',
      }).trim();

      if (whereOpencodeCmd) {
        const lines = whereOpencodeCmd
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line);
        if (lines.length > 0) {
          resolvedCommand = lines[0]; // First line is the resolved command
          return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
        }
      }
    } catch (e) {
      // Fallback: where.exe opencode
      try {
        whereOpencode = execSync('where.exe opencode', {
          encoding: 'utf8',
          stdio: 'pipe',
        }).trim();

        if (whereOpencode) {
          const lines = whereOpencode
            .split('\n')
            .map((line) => line.trim())
            .filter((line) => line);
          // Look for .cmd line
          const cmdLine = lines.find((line) => line.endsWith('.cmd'));
          if (cmdLine) {
            resolvedCommand = cmdLine;
            return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
          }
          // If no .cmd found, use first line
          if (lines.length > 0) {
            resolvedCommand = lines[0];
            return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
          }
        }
      } catch (e2) {
        // Final fallback
        resolvedCommand = 'opencode.cmd';
        return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
      }
    }

    // Final fallback if nothing found
    resolvedCommand = 'opencode.cmd';
    return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
  }

  resolvedCommand = 'opencode';
  return { command: resolvedCommand, whereOpencode, whereOpencodeCmd };
}

// Check if git has changes
function hasGitChanges(repoRoot) {
  try {
    const { execSync } = require('child_process');
    const result = execSync('git status --short', {
      cwd: repoRoot,
      encoding: 'utf8',
      stdio: 'pipe',
    });
    return result.trim().length > 0;
  } catch (e) {
    return false;
  }
}

// Context-aware Error Pattern Detection
function detectErrorPatterns(stdout, stderr) {
  const combinedOutput = stdout + '\n' + stderr;
  const combinedLower = combinedOutput.toLowerCase();

  // Check if npm run verify was successful - if so, ignore test-related errors
  const verifySuccessDetected =
    combinedLower.includes('npm run verify ✅') ||
    combinedLower.includes('npm run typecheck ✅') ||
    combinedLower.includes('npm run lint ✅');

  // Fatal error patterns - these are always errors
  const fatalErrorPatterns = [
    'Error: Not Found: Application not found',
    'application not found',
    'model not found',
    'provider error',
    'authentication failed',
    'unauthorized',
    'rate limit exceeded',
    'spawn ',
    'ENOENT',
    'EINVAL',
    'permission denied',
    'access denied',
  ];

  // Non-fatal patterns that can be ignored in certain contexts
  const contextualErrorPatterns = [
    'error:',
    'not found',
    'network error',
    'failed to',
    'cannot find',
    'invalid',
    'timeout',
    'connection refused',
  ];

  const detectedFatalPatterns = [];
  const detectedContextualPatterns = [];
  const ignoredNonFatalPatterns = [];

  // Check for fatal patterns (always errors)
  for (const pattern of fatalErrorPatterns) {
    if (combinedLower.includes(pattern.toLowerCase())) {
      detectedFatalPatterns.push(pattern);
    }
  }

  // Check for contextual patterns (may be ignored)
  for (const pattern of contextualErrorPatterns) {
    if (combinedLower.includes(pattern.toLowerCase())) {
      // If verify was successful, these are likely from test logs and can be ignored
      if (verifySuccessDetected) {
        ignoredNonFatalPatterns.push(pattern);
      } else {
        detectedContextualPatterns.push(pattern);
      }
    }
  }

  return {
    fatal: detectedFatalPatterns,
    contextual: detectedContextualPatterns,
    ignored: ignoredNonFatalPatterns,
    verifySuccessDetected,
  };
}

// Success Evidence Detection
function detectSuccessEvidence(repoRoot, stdout, stderr) {
  const combinedOutput = stdout + '\n' + stderr;

  // Check for sentinel file
  const sentinelPath = path.join(repoRoot, '.agent', 'out', 'opencode-worker-done.json');
  const hasSentinel = fs.existsSync(sentinelPath);

  // Check for git changes
  const hasGitDiff = hasGitChanges(repoRoot);

  // Check for completion messages in output
  const completionPatterns = [
    'done',
    'summary',
    'changed files',
    'completed',
    'finished',
    'success',
    'implemented',
    'modified',
    'created',
    'updated',
  ];

  const hasCompletionMessage = completionPatterns.some((pattern) =>
    combinedOutput.toLowerCase().includes(pattern),
  );

  return {
    sentinel: hasSentinel,
    gitDiff: hasGitDiff,
    completionMessage: hasCompletionMessage,
  };
}

// Determine final verdict based on exit code, error patterns, and success evidence
function determineFinalVerdict(
  exitCode,
  errorPatterns,
  successEvidence,
  requiresForcedExit = false,
) {
  const sentinelValid = successEvidence.sentinel;
  const hasCompletionEvidence = successEvidence.gitDiff || successEvidence.completionMessage;
  const fatalErrorsDetected = errorPatterns.fatal && errorPatterns.fatal.length > 0;
  const contextualErrorsDetected = errorPatterns.contextual && errorPatterns.contextual.length > 0;

  // Special handling for forced exit scenarios
  const forcedExitExpected = requiresForcedExit && sentinelValid;
  const isNullExitCode = exitCode === null || exitCode === undefined;

  // If we have a valid sentinel and completion evidence, and no fatal errors:
  // This is success, even with null exit code (forced exit scenario)
  if (sentinelValid && hasCompletionEvidence && !fatalErrorsDetected) {
    return {
      success: true,
      verdict: 'success',
      failureReason: null,
      forcedExitExpected,
      sentinelValid,
      verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
      fatalErrorPatterns: errorPatterns.fatal || [],
      ignoredNonFatalPatterns: errorPatterns.ignored || [],
    };
  }

  // Fatal errors always cause failure
  if (fatalErrorsDetected) {
    return {
      success: false,
      verdict: 'failed',
      failureReason: 'fatal_error_patterns',
      forcedExitExpected,
      sentinelValid,
      verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
      fatalErrorPatterns: errorPatterns.fatal || [],
      ignoredNonFatalPatterns: errorPatterns.ignored || [],
    };
  }

  // Non-zero exit code (but not null) is failure
  if (exitCode !== 0 && exitCode !== null && exitCode !== undefined) {
    return {
      success: false,
      verdict: 'failed',
      failureReason: `process_exit_code_${exitCode}`,
      forcedExitExpected,
      sentinelValid,
      verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
      fatalErrorPatterns: errorPatterns.fatal || [],
      ignoredNonFatalPatterns: errorPatterns.ignored || [],
    };
  }

  // Contextual errors without verify success are concerning
  if (contextualErrorsDetected && !errorPatterns.verifySuccessDetected) {
    return {
      success: false,
      verdict: 'failed',
      failureReason: 'contextual_error_patterns',
      forcedExitExpected,
      sentinelValid,
      verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
      fatalErrorPatterns: errorPatterns.fatal || [],
      ignoredNonFatalPatterns: errorPatterns.ignored || [],
    };
  }

  // Check for any success evidence
  const hasAnySuccessEvidence =
    sentinelValid || successEvidence.gitDiff || successEvidence.completionMessage;

  if (hasAnySuccessEvidence) {
    return {
      success: true,
      verdict: 'success',
      failureReason: null,
      forcedExitExpected,
      sentinelValid,
      verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
      fatalErrorPatterns: errorPatterns.fatal || [],
      ignoredNonFatalPatterns: errorPatterns.ignored || [],
    };
  }

  // No success evidence
  return {
    success: false,
    verdict: 'failed',
    failureReason: 'no_success_evidence',
    forcedExitExpected,
    sentinelValid,
    verifySuccessDetected: errorPatterns.verifySuccessDetected || false,
    fatalErrorPatterns: errorPatterns.fatal || [],
    ignoredNonFatalPatterns: errorPatterns.ignored || [],
  };
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
    command: data.command || null,
    argsPreview: data.argsPreview || null,
    shell: data.shell || null,
    inactivityTimeoutMs: data.inactivityTimeoutMs || null,
    lastOutputAt: data.lastOutputAt || null,
    reportPath: '.agent/out/opencode-report.md',
    liveLogPath: '.agent/out/opencode-live.log',
    // Enhanced status fields
    detectedErrorPatterns: data.detectedErrorPatterns || [],
    successEvidence: data.successEvidence || null,
    finalVerdict: data.finalVerdict || null,
    failureReason: data.failureReason || null,
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

// Debug mode: run deterministic 90-second smoke test
async function runDebugTest(repoRoot, openCodeConfig) {
  console.log('🔍 Debug-Modus: Deterministischer 90-Sekunden-Smoke-Test');

  const debugReportPath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-debug.md');
  const testFilePath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-test.txt');
  const expectedContent = 'hello-from-opencode';

  // Clean up test file if exists
  if (fs.existsSync(testFilePath)) {
    fs.unlinkSync(testFilePath);
  }

  const debugPrompt = `Create a file .agent/out/opencode-spawn-test.txt with exact content: ${expectedContent}`;
  const commandResolution = resolveOpenCodeCommand();
  const command = commandResolution.command;
  const args = ['run', debugPrompt, '--model', openCodeConfig.model];

  console.log(`🔧 Platform: ${process.platform}`);
  console.log(`🔧 whereOpencode: ${commandResolution.whereOpencode || 'null'}`);
  console.log(`🔧 whereOpencodeCmd: ${commandResolution.whereOpencodeCmd || 'null'}`);
  console.log(`🔧 resolvedCommand: ${command}`);
  console.log(`🔧 Command: ${command}`);
  console.log(`🔧 Args: ${JSON.stringify(args)}`);
  const shellMode = process.platform === 'win32' && command.endsWith('.cmd');
  console.log(`🔧 Shell: ${shellMode} (${shellMode ? 'Windows .cmd mode' : 'args array mode'})`);
  console.log(`🔧 CWD: ${repoRoot}`);
  console.log(`⏰ Hard Timeout: 90 Sekunden`);
  console.log(`🎯 Erwarteter Inhalt: "${expectedContent}"`);

  const startTime = Date.now();
  const HARD_TIMEOUT_MS = 90000; // 90 seconds

  return new Promise((resolve) => {
    // Windows .cmd files need shell: true or cmd.exe wrapper
    const spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'], // Fix: ignore stdin to prevent hanging
      cwd: repoRoot,
    };

    if (process.platform === 'win32' && command.endsWith('.cmd')) {
      spawnOptions.shell = true;
    } else {
      spawnOptions.shell = false;
    }

    const opencode = spawn(command, args, spawnOptions);

    let stdout = '';
    let stderr = '';
    let isResolved = false;

    // File monitoring interval - check every 1 second for file creation
    const fileMonitorInterval = setInterval(() => {
      if (isResolved) {
        clearInterval(fileMonitorInterval);
        return;
      }

      const testFileExists = fs.existsSync(testFilePath);
      if (testFileExists) {
        try {
          const actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
          const contentMatches = actualContent === expectedContent;

          if (contentMatches) {
            // Success detected! Force exit the process
            isResolved = true;
            clearInterval(fileMonitorInterval);
            clearTimeout(hardTimeout);

            console.log(`🎯 DEBUG-TEST: Datei mit korrektem Inhalt erstellt - Forced Exit`);

            if (opencode && !opencode.killed) {
              opencode.kill('SIGTERM');
              setTimeout(() => {
                if (opencode && !opencode.killed) {
                  opencode.kill('SIGKILL');
                }
              }, 2000);
            }

            const elapsedMs = Date.now() - startTime;

            const debugReport = generateDebugReport({
              startTime: new Date(startTime).toISOString(),
              platform: process.platform,
              whereOpencode: commandResolution.whereOpencode,
              whereOpencodeCmd: commandResolution.whereOpencodeCmd,
              resolvedCommand: command,
              command,
              args,
              exitCode: 'FORCED_EXIT',
              elapsedMs,
              testFileExists: true,
              expectedContent,
              actualContent,
              contentMatches: true,
              stdout,
              stderr,
              result: 'PASS_WITH_FORCED_EXIT',
              reason: 'Datei korrekt erstellt, Prozess mit Forced Exit beendet',
            });

            fs.writeFileSync(debugReportPath, debugReport);

            console.log(`\n🎯 DEBUG-TEST PASS_WITH_FORCED_EXIT`);
            console.log(`📄 Report: ${debugReportPath}`);
            console.log(`⏱️  Laufzeit: ${formatElapsed(elapsedMs)}`);
            console.log(`🎯 Ergebnis: PASS_WITH_FORCED_EXIT - Datei korrekt erstellt`);

            resolve({
              success: true,
              code: 'FORCED_EXIT',
              elapsedMs,
              reason: 'forced_exit_success',
            });
            return;
          }
        } catch (e) {
          // File exists but can't read - continue monitoring
        }
      }
    }, 1000);

    // Hard timeout - kill process after 90 seconds
    const hardTimeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(fileMonitorInterval);
        console.log('\n⏰ HARD TIMEOUT: 90 Sekunden erreicht - Process wird beendet');

        if (opencode && !opencode.killed) {
          opencode.kill('SIGTERM');
          setTimeout(() => {
            if (opencode && !opencode.killed) {
              opencode.kill('SIGKILL');
            }
          }, 2000);
        }

        const elapsedMs = Date.now() - startTime;
        const testFileExists = fs.existsSync(testFilePath);
        let actualContent = '';
        let contentMatches = false;

        if (testFileExists) {
          try {
            actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
            contentMatches = actualContent === expectedContent;
          } catch (e) {
            actualContent = `ERROR: ${e.message}`;
          }
        }

        // Check if file was created with correct content despite timeout
        const result = testFileExists && contentMatches ? 'PASS_WITH_FORCED_EXIT' : 'TIMEOUT';

        const debugReport = generateDebugReport({
          startTime: new Date(startTime).toISOString(),
          platform: process.platform,
          whereOpencode: commandResolution.whereOpencode,
          whereOpencodeCmd: commandResolution.whereOpencodeCmd,
          resolvedCommand: command,
          command,
          args,
          exitCode: 'TIMEOUT',
          elapsedMs,
          testFileExists,
          expectedContent,
          actualContent,
          contentMatches,
          stdout,
          stderr,
          result,
          reason:
            result === 'PASS_WITH_FORCED_EXIT'
              ? 'Datei korrekt erstellt trotz Timeout'
              : 'Hard timeout nach 90 Sekunden erreicht',
        });

        fs.writeFileSync(debugReportPath, debugReport);

        const success = result === 'PASS_WITH_FORCED_EXIT';
        console.log(`\n${success ? '🎯' : '❌'} DEBUG-TEST ${result}`);
        console.log(`📄 Report: ${debugReportPath}`);
        console.log(`⏱️  Laufzeit: ${formatElapsed(elapsedMs)}`);
        console.log(`🎯 Ergebnis: ${result}`);

        resolve({
          success,
          code: 'TIMEOUT',
          elapsedMs,
          reason: success ? 'timeout_but_success' : 'timeout',
        });
      }
    }, HARD_TIMEOUT_MS);

    opencode.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('STDOUT:', data.toString());
    });

    opencode.stderr.on('data', (data) => {
      stderr += data.toString();
      console.log('STDERR:', data.toString());
    });

    opencode.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(hardTimeout);

        const elapsedMs = Date.now() - startTime;
        const testFileExists = fs.existsSync(testFilePath);
        let actualContent = '';
        let contentMatches = false;

        if (testFileExists) {
          try {
            actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
            contentMatches = actualContent === expectedContent;
          } catch (e) {
            actualContent = `ERROR: ${e.message}`;
          }
        }

        // Determine success: file exists, content matches, exit code 0, under 90s
        const success =
          testFileExists && contentMatches && code === 0 && elapsedMs < HARD_TIMEOUT_MS;
        const result = success ? 'PASS' : 'FAIL';

        let reason = '';
        if (!testFileExists) reason = 'Datei nicht erstellt';
        else if (!contentMatches)
          reason = `Inhalt falsch: "${actualContent}" != "${expectedContent}"`;
        else if (code !== 0) reason = `Exit Code: ${code}`;
        else if (elapsedMs >= HARD_TIMEOUT_MS) reason = 'Timeout überschritten';
        else reason = 'Alle Kriterien erfüllt';

        const debugReport = generateDebugReport({
          startTime: new Date(startTime).toISOString(),
          platform: process.platform,
          whereOpencode: commandResolution.whereOpencode,
          whereOpencodeCmd: commandResolution.whereOpencodeCmd,
          resolvedCommand: command,
          command,
          args,
          exitCode: code,
          elapsedMs,
          testFileExists,
          expectedContent,
          actualContent,
          contentMatches,
          stdout,
          stderr,
          result,
          reason,
        });

        fs.writeFileSync(debugReportPath, debugReport);

        console.log(`\n${success ? '✅' : '❌'} DEBUG-TEST ${result}`);
        console.log(`📄 Report: ${debugReportPath}`);
        console.log(`📁 Test-Datei: ${testFileExists ? '✅ Erstellt' : '❌ Nicht erstellt'}`);
        console.log(`📝 Inhalt korrekt: ${contentMatches ? '✅ JA' : '❌ NEIN'}`);
        console.log(`⏱️  Laufzeit: ${formatElapsed(elapsedMs)}`);
        console.log(`🚪 Exit Code: ${code}`);
        console.log(`🎯 Ergebnis: ${result} - ${reason}`);

        resolve({ success, code, elapsedMs, reason });
      }
    });

    opencode.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        clearTimeout(hardTimeout);

        console.error('❌ Debug-Test Spawn-Fehler:', err.message);

        const debugReport = generateDebugReport({
          startTime: new Date(startTime).toISOString(),
          platform: process.platform,
          whereOpencode: commandResolution.whereOpencode,
          whereOpencodeCmd: commandResolution.whereOpencodeCmd,
          resolvedCommand: command,
          command,
          args,
          exitCode: 'SPAWN_ERROR',
          elapsedMs: Date.now() - startTime,
          testFileExists: false,
          expectedContent,
          actualContent: '',
          contentMatches: false,
          stdout,
          stderr,
          result: 'FAIL',
          reason: `Spawn Error: ${err.message}`,
        });

        fs.writeFileSync(debugReportPath, debugReport);

        console.log(`\n❌ DEBUG-TEST FAIL (SPAWN ERROR)`);
        console.log(`📄 Report: ${debugReportPath}`);
        console.log(`🎯 Ergebnis: FAIL - ${err.message}`);

        resolve({ success: false, error: err.message, reason: 'spawn_error' });
      }
    });
  });
}

// Load spawn strategy from JSON
function loadSpawnStrategy(repoRoot) {
  const strategyPath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-strategy.json');

  if (fs.existsSync(strategyPath)) {
    try {
      const strategyContent = fs.readFileSync(strategyPath, 'utf-8');
      return JSON.parse(strategyContent);
    } catch (e) {
      console.warn(`Warnung: Fehler beim Lesen von opencode-spawn-strategy.json: ${e.message}`);
    }
  }

  return null;
}

// Write spawn strategy to JSON
function writeSpawnStrategy(repoRoot, strategy) {
  const strategyPath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-strategy.json');

  try {
    // Ensure output directory exists
    const outputDir = path.dirname(strategyPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    fs.writeFileSync(strategyPath, JSON.stringify(strategy, null, 2));
    console.log(`✅ Spawn-Strategie gespeichert: ${strategyPath}`);
  } catch (e) {
    console.warn(`Warnung: Fehler beim Schreiben von opencode-spawn-strategy.json: ${e.message}`);
  }
}

// Clean up old matrix test files
function cleanupMatrixTestFiles(repoRoot) {
  const strategies = [
    'cmd-shim-shell-false',
    'cmd-shim-shell-true',
    'plain-opencode-shell-true',
    'powershell-command',
    'cmd-exe-call',
  ];

  strategies.forEach((strategy) => {
    const testFilePath = path.join(repoRoot, '.agent', 'out', `opencode-matrix-${strategy}.txt`);
    if (fs.existsSync(testFilePath)) {
      try {
        fs.unlinkSync(testFilePath);
        console.log(`🧹 Alte Test-Datei gelöscht: opencode-matrix-${strategy}.txt`);
      } catch (e) {
        console.warn(`Warnung: Fehler beim Löschen von ${testFilePath}: ${e.message}`);
      }
    }
  });
}

// Test a single spawn strategy
async function testSpawnStrategy(repoRoot, strategyName, strategyConfig, model) {
  const testFilePath = path.join(repoRoot, '.agent', 'out', `opencode-matrix-${strategyName}.txt`);
  const expectedContent = 'matrix-ok';
  const prompt = `Create or overwrite .agent/out/opencode-matrix-${strategyName}.txt with exactly: matrix-ok. Then exit.`;

  console.log(`\n🧪 Teste Strategie: ${strategyName}`);
  console.log(`🔧 Command: ${strategyConfig.command}`);
  console.log(`🔧 Args: ${JSON.stringify(strategyConfig.args)}`);
  console.log(`🔧 Shell: ${strategyConfig.shell}`);

  const startTime = Date.now();
  const STRATEGY_TIMEOUT_MS = 45000; // 45 seconds

  return new Promise((resolve) => {
    let isResolved = false;

    const opencode = spawn(strategyConfig.command, strategyConfig.args, {
      stdio: ['ignore', 'pipe', 'pipe'], // Fix: ignore stdin to prevent hanging
      cwd: repoRoot,
      shell: strategyConfig.shell,
    });

    let stdout = '';
    let stderr = '';

    // File monitoring interval - check every 1 second for file creation
    const fileMonitorInterval = setInterval(() => {
      if (isResolved) {
        clearInterval(fileMonitorInterval);
        return;
      }

      const testFileExists = fs.existsSync(testFilePath);
      if (testFileExists) {
        try {
          const actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
          const contentMatches = actualContent === expectedContent;

          if (contentMatches) {
            // Success detected! Force exit the process
            isResolved = true;
            clearInterval(fileMonitorInterval);
            clearTimeout(strategyTimeout);

            console.log(`🎯 ${strategyName}: Datei mit korrektem Inhalt erstellt - Forced Exit`);

            if (opencode && !opencode.killed) {
              opencode.kill('SIGTERM');
              setTimeout(() => {
                if (opencode && !opencode.killed) {
                  opencode.kill('SIGKILL');
                }
              }, 2000);
            }

            const elapsedMs = Date.now() - startTime;

            resolve({
              strategy: strategyName,
              command: strategyConfig.command,
              argsPreview: strategyConfig.args.slice(0, 3).join(' ') + '...',
              shell: strategyConfig.shell,
              exitCode: 'FORCED_EXIT',
              timedOut: false,
              fileCreated: true,
              contentMatched: true,
              stdout: stdout.substring(0, 500),
              stderr: stderr.substring(0, 500),
              elapsedMs,
              verdict: 'PASS_WITH_FORCED_EXIT',
              requiresForcedExit: true,
            });
            return;
          }
        } catch (e) {
          // File exists but can't read - continue monitoring
        }
      }
    }, 1000);

    // Strategy timeout - kill process after 45 seconds
    const strategyTimeout = setTimeout(() => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(fileMonitorInterval);
        console.log(`⏰ TIMEOUT: ${strategyName} - 45 Sekunden erreicht`);

        if (opencode && !opencode.killed) {
          opencode.kill('SIGTERM');
          setTimeout(() => {
            if (opencode && !opencode.killed) {
              opencode.kill('SIGKILL');
            }
          }, 2000);
        }

        const elapsedMs = Date.now() - startTime;
        const testFileExists = fs.existsSync(testFilePath);
        let actualContent = '';
        let contentMatches = false;

        if (testFileExists) {
          try {
            actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
            contentMatches = actualContent === expectedContent;
          } catch (e) {
            actualContent = `ERROR: ${e.message}`;
          }
        }

        // Check if file was created with correct content despite timeout
        const verdict = testFileExists && contentMatches ? 'PASS_WITH_FORCED_EXIT' : 'FAIL';

        resolve({
          strategy: strategyName,
          command: strategyConfig.command,
          argsPreview: strategyConfig.args.slice(0, 3).join(' ') + '...',
          shell: strategyConfig.shell,
          exitCode: 'TIMEOUT',
          timedOut: true,
          fileCreated: testFileExists,
          contentMatched: contentMatches,
          stdout: stdout.substring(0, 500),
          stderr: stderr.substring(0, 500),
          elapsedMs,
          verdict,
          requiresForcedExit: testFileExists && contentMatches,
        });
      }
    }, STRATEGY_TIMEOUT_MS);

    opencode.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    opencode.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    opencode.on('close', (code) => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(fileMonitorInterval);
        clearTimeout(strategyTimeout);

        const elapsedMs = Date.now() - startTime;
        const testFileExists = fs.existsSync(testFilePath);
        let actualContent = '';
        let contentMatches = false;

        if (testFileExists) {
          try {
            actualContent = fs.readFileSync(testFilePath, 'utf-8').trim();
            contentMatches = actualContent === expectedContent;
          } catch (e) {
            actualContent = `ERROR: ${e.message}`;
          }
        }

        // Determine success: file exists, content matches, exit code 0, under 45s
        const success =
          testFileExists && contentMatches && code === 0 && elapsedMs < STRATEGY_TIMEOUT_MS;
        const verdict = success
          ? 'PASS'
          : testFileExists && contentMatches
            ? 'PASS_WITH_FORCED_EXIT'
            : 'FAIL';

        console.log(
          `${success ? '✅' : verdict === 'PASS_WITH_FORCED_EXIT' ? '🎯' : '❌'} ${strategyName}: ${verdict} (${formatElapsed(elapsedMs)})`,
        );

        resolve({
          strategy: strategyName,
          command: strategyConfig.command,
          argsPreview: strategyConfig.args.slice(0, 3).join(' ') + '...',
          shell: strategyConfig.shell,
          exitCode: code,
          timedOut: false,
          fileCreated: testFileExists,
          contentMatched: contentMatches,
          stdout: stdout.substring(0, 500),
          stderr: stderr.substring(0, 500),
          elapsedMs,
          verdict,
          requiresForcedExit: verdict === 'PASS_WITH_FORCED_EXIT',
        });
      }
    });

    opencode.on('error', (err) => {
      if (!isResolved) {
        isResolved = true;
        clearInterval(fileMonitorInterval);
        clearTimeout(strategyTimeout);

        console.log(`❌ ${strategyName}: SPAWN ERROR - ${err.message}`);

        resolve({
          strategy: strategyName,
          command: strategyConfig.command,
          argsPreview: strategyConfig.args.slice(0, 3).join(' ') + '...',
          shell: strategyConfig.shell,
          exitCode: 'SPAWN_ERROR',
          errorCode: err.code || 'SPAWN_ERROR',
          errorMessage: err.message,
          timedOut: false,
          fileCreated: false,
          contentMatched: false,
          stdout,
          stderr: err.message,
          elapsedMs: Date.now() - startTime,
          verdict: 'FAIL',
          requiresForcedExit: false,
        });
      }
    });
  });
}

// Matrix mode: test multiple spawn strategies
async function runMatrixTest(repoRoot, openCodeConfig) {
  try {
    console.log('🔬 Matrix-Modus: Teste verschiedene Spawn-Strategien');

    // Clean up old test files
    cleanupMatrixTestFiles(repoRoot);

    const commandResolution = resolveOpenCodeCommand();
    const absoluteOpencodeCmd = commandResolution.command;
    const model = openCodeConfig.model;

    // Define strategies to test
    const strategies = [
      {
        name: 'cmd-shim-shell-false',
        config: {
          command: absoluteOpencodeCmd,
          args: ['run', '', '--model', model],
          shell: false,
        },
      },
      {
        name: 'cmd-shim-shell-true',
        config: {
          command: absoluteOpencodeCmd,
          args: ['run', '', '--model', model],
          shell: true,
        },
      },
      {
        name: 'plain-opencode-shell-true',
        config: {
          command: 'opencode',
          args: ['run', '', '--model', model],
          shell: true,
        },
      },
      {
        name: 'powershell-command',
        config: {
          command: 'powershell.exe',
          args: [
            '-NoProfile',
            '-ExecutionPolicy',
            'Bypass',
            '-Command',
            `& '${absoluteOpencodeCmd}' run '<PROMPT>' --model '${model}'`,
          ],
          shell: false,
        },
      },
      {
        name: 'cmd-exe-call',
        config: {
          command: 'cmd.exe',
          args: ['/d', '/s', '/c', `"${absoluteOpencodeCmd}" run "<PROMPT>" --model "${model}"`],
          shell: false,
        },
      },
    ];

    console.log(`🎯 Teste ${strategies.length} Strategien mit Modell: ${model}`);
    console.log(`📍 Absoluter OpenCode Pfad: ${absoluteOpencodeCmd}`);
    console.log(`⏰ Timeout pro Strategie: 45 Sekunden\n`);

    const results = [];

    for (const strategy of strategies) {
      try {
        // Prepare prompt for this strategy
        const prompt = `Create or overwrite .agent/out/opencode-matrix-${strategy.name}.txt with exactly: matrix-ok. Then exit.`;

        // Set prompt in args
        if (strategy.name === 'powershell-command') {
          // Replace <PROMPT> placeholder in PowerShell command
          strategy.config.args[4] = strategy.config.args[4].replace(
            '<PROMPT>',
            prompt.replace(/'/g, "''"),
          );
        } else if (strategy.name === 'cmd-exe-call') {
          // Replace <PROMPT> placeholder in cmd.exe command
          strategy.config.args[3] = strategy.config.args[3].replace('<PROMPT>', prompt);
        } else {
          // Standard args array
          strategy.config.args[1] = prompt;
        }

        const result = await testSpawnStrategy(repoRoot, strategy.name, strategy.config, model);
        results.push(result);
      } catch (error) {
        // Catch any unexpected errors during strategy testing
        console.log(`❌ ${strategy.name}: UNEXPECTED ERROR - ${error.message}`);

        const errorResult = {
          strategy: strategy.name,
          command: strategy.config.command,
          argsPreview: strategy.config.args.slice(0, 3).join(' ') + '...',
          shell: strategy.config.shell,
          exitCode: 'ERROR',
          errorCode: error.code || 'UNKNOWN',
          errorMessage: error.message,
          timedOut: false,
          fileCreated: false,
          contentMatched: false,
          stdout: '',
          stderr: error.message,
          elapsedMs: 0,
          verdict: 'FAIL',
        };

        results.push(errorResult);
      }
    }

    // Generate matrix report
    const matrixReportPath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-matrix.md');
    const matrixReport = generateMatrixReport(results, model, absoluteOpencodeCmd);
    fs.writeFileSync(matrixReportPath, matrixReport);

    // Find successful strategy - prioritize clean PASS over PASS_WITH_FORCED_EXIT
    const cleanPassStrategy = results.find((r) => r.verdict === 'PASS');
    const forcedExitStrategy = results.find((r) => r.verdict === 'PASS_WITH_FORCED_EXIT');
    const passStrategy = cleanPassStrategy || forcedExitStrategy;

    if (passStrategy) {
      const strategyType =
        passStrategy.verdict === 'PASS' ? 'sauberer PASS' : 'PASS_WITH_FORCED_EXIT';
      console.log(
        `\n🎉 ERFOLGREICHE STRATEGIE GEFUNDEN: ${passStrategy.strategy} (${strategyType})`,
      );

      // Write strategy JSON
      const strategyData = {
        strategy: passStrategy.strategy,
        command: passStrategy.command,
        shell: passStrategy.shell,
        requiresForcedExit: passStrategy.requiresForcedExit || false,
        successDetection: passStrategy.requiresForcedExit ? 'expected-file' : 'exit-code',
        notes: `Matrix-Test erfolgreich am ${new Date().toISOString()} - ${strategyType}`,
      };

      writeSpawnStrategy(repoRoot, strategyData);

      console.log(`\n📄 Matrix-Report: ${matrixReportPath}`);
      console.log(`🎯 Ergebnis: ${strategyType} gefunden`);
      if (passStrategy.requiresForcedExit) {
        console.log(`⚠️  Hinweis: Strategie benötigt Forced Exit bei Dateierstellung`);
      }

      return { success: true, results, passStrategy };
    } else {
      console.log(`\n❌ KEINE ERFOLGREICHE STRATEGIE GEFUNDEN`);
      console.log('Alle Strategien sind fehlgeschlagen.');
      console.log('No working OpenCode spawn strategy found.');

      console.log(`\n📄 Matrix-Report: ${matrixReportPath}`);
      console.log(`🎯 Ergebnis: Keine PASS-Strategie`);

      return { success: false, results, passStrategy: null };
    }
  } catch (globalError) {
    // Catch any global errors that might crash the entire matrix test
    console.error(`❌ MATRIX-TEST GLOBAL ERROR: ${globalError.message}`);
    console.error('Matrix-Test konnte nicht vollständig ausgeführt werden.');

    // Try to write an error report
    try {
      const matrixReportPath = path.join(repoRoot, '.agent', 'out', 'opencode-spawn-matrix.md');
      const errorReport = `# OpenCode Spawn Strategy Matrix Report - ERROR

**Generiert:** ${new Date().toISOString()}
**Status:** GLOBAL ERROR

## Fehler

Der Matrix-Test konnte nicht vollständig ausgeführt werden:

**Error:** ${globalError.message}
**Stack:** ${globalError.stack || 'N/A'}

## Empfehlung

1. Prüfe OpenCode Installation: \`opencode --version\`
2. Prüfe Node.js und npm Installation
3. Führe Matrix-Test erneut aus: \`npm run agent:worker:matrix\`
`;

      fs.writeFileSync(matrixReportPath, errorReport);
      console.log(`📄 Error-Report: ${matrixReportPath}`);
    } catch (reportError) {
      console.error(`Fehler beim Schreiben des Error-Reports: ${reportError.message}`);
    }

    return { success: false, results: [], passStrategy: null, globalError: globalError.message };
  }
}

// Generate matrix report
function generateMatrixReport(results, model, absoluteOpencodeCmd) {
  const timestamp = new Date().toISOString();

  let report = `# OpenCode Spawn Strategy Matrix Report

**Generiert:** ${timestamp}
**Modell:** ${model}
**Platform:** ${process.platform}
**Absoluter OpenCode Pfad:** ${absoluteOpencodeCmd}

## Zusammenfassung

`;

  const passCount = results.filter((r) => r.verdict === 'PASS').length;
  const forcedExitCount = results.filter((r) => r.verdict === 'PASS_WITH_FORCED_EXIT').length;
  const failCount = results.filter((r) => r.verdict === 'FAIL').length;

  report += `**Getestete Strategien:** ${results.length}
**PASS:** ${passCount}
**PASS_WITH_FORCED_EXIT:** ${forcedExitCount}
**FAIL:** ${failCount}

`;

  const cleanPassStrategy = results.find((r) => r.verdict === 'PASS');
  const forcedExitStrategy = results.find((r) => r.verdict === 'PASS_WITH_FORCED_EXIT');
  const successStrategy = cleanPassStrategy || forcedExitStrategy;

  if (successStrategy) {
    const strategyType =
      successStrategy.verdict === 'PASS' ? 'Sauberer PASS' : 'PASS mit Forced Exit';
    report += `## ✅ Erfolgreiche Strategie

**${successStrategy.strategy}** ist die empfohlene Spawn-Strategie (${strategyType}).

`;
    if (successStrategy.verdict === 'PASS_WITH_FORCED_EXIT') {
      report += `⚠️ **Hinweis:** Diese Strategie benötigt Forced Exit, da der Prozess nach erfolgreicher Dateierstellung hängt.

`;
    }
  } else {
    report += `## ❌ Keine erfolgreiche Strategie

Alle getesteten Strategien sind fehlgeschlagen. Prüfe OpenCode Installation und Modell-Verfügbarkeit.

`;
  }

  report += `## Detaillierte Ergebnisse

`;

  results.forEach((result) => {
    const icon = result.verdict === 'PASS' ? '✅' : '❌';

    report += `### ${icon} ${result.strategy}

**Command:** \`${result.command}\`
**Args Preview:** \`${result.argsPreview}\`
**Shell:** ${result.shell}
**Exit Code:** ${result.exitCode}`;

    // Add error details if present
    if (result.errorCode) {
      report += `
**Error Code:** ${result.errorCode}
**Error Message:** ${result.errorMessage}`;
    }

    report += `
**Timed Out:** ${result.timedOut ? 'JA' : 'NEIN'}
**File Created:** ${result.fileCreated ? 'JA' : 'NEIN'}
**Content Matched:** ${result.contentMatched ? 'JA' : 'NEIN'}
**Elapsed:** ${formatElapsed(result.elapsedMs)}
**Verdict:** **${result.verdict}**

**STDOUT (first 500 chars):**
\`\`\`
${result.stdout}
\`\`\`

**STDERR (first 500 chars):**
\`\`\`
${result.stderr}
\`\`\`

`;
  });

  report += `## Erfolgskriterien

Für jede Strategie:
- [x] Exit Code 0
- [x] Erwartete Datei erstellt
- [x] Inhalt exakt "matrix-ok"
- [x] Laufzeit < 45 Sekunden

## Nächste Schritte

`;

  if (passCount > 0) {
    report += `✅ **Strategie gefunden:** Verwende \`npm run agent:worker\` mit der gespeicherten Strategie.

Die erfolgreiche Strategie wurde in \`.agent/out/opencode-spawn-strategy.json\` gespeichert.
`;
  } else {
    report += `❌ **Keine Strategie erfolgreich:**

1. Prüfe OpenCode Installation: \`opencode --version\`
2. Prüfe Modell-Verfügbarkeit: \`${model}\`
3. Teste manuell: \`opencode run "Create a file test.txt with content hello" --model ${model}\`
4. Prüfe Windows PATH und npm global packages
`;
  }

  return report;
}

// Generate debug report
function generateDebugReport(data) {
  return `# OpenCode Spawn Debug Report

**Generiert:** ${new Date().toISOString()}
**Test gestartet:** ${data.startTime}
**Platform:** ${data.platform}

## Command Resolution (Windows)

**whereOpencode:** ${data.whereOpencode || 'null'}
**whereOpencodeCmd:** ${data.whereOpencodeCmd || 'null'}
**resolvedCommand:** ${data.resolvedCommand || data.command}

## Spawn Configuration

**Command:** ${data.command}
**Args:** ${JSON.stringify(data.args)}
**Shell Mode:** false (args array)

## Test-Kriterien

**Erwartete Datei:** .agent/out/opencode-spawn-test.txt
**Erwarteter Inhalt:** "${data.expectedContent}"
**Max. Laufzeit:** 90 Sekunden
**Erwarteter Exit Code:** 0

## Ergebnis: ${data.result}

**Exit Code:** ${data.exitCode}
**Laufzeit:** ${formatElapsed(data.elapsedMs)} ${data.elapsedMs >= 90000 ? '⚠️ TIMEOUT' : '✅ OK'}
**Test-Datei erstellt:** ${data.testFileExists ? '✅ JA' : '❌ NEIN'}
**Inhalt korrekt:** ${data.contentMatches ? '✅ JA' : '❌ NEIN'}
**Tatsächlicher Inhalt:** "${data.actualContent}"

## Grund

${data.reason}

## STDOUT
\`\`\`
${data.stdout}
\`\`\`

## STDERR
\`\`\`
${data.stderr}
\`\`\`

## Diagnose

${
  data.result === 'PASS'
    ? '✅ **ERFOLG:** OpenCode funktioniert korrekt mit deterministischen Kriterien'
    : '❌ **FEHLER:** OpenCode erfüllt nicht alle Erfolgskriterien'
}

## Erfolgskriterien

- [${data.testFileExists ? 'x' : ' '}] Datei .agent/out/opencode-spawn-test.txt erstellt
- [${data.contentMatches ? 'x' : ' '}] Exakter Inhalt "${data.expectedContent}"
- [${data.exitCode === 0 ? 'x' : ' '}] Exit Code 0
- [${data.elapsedMs < 90000 ? 'x' : ' '}] Unter 90 Sekunden Laufzeit

## Nächste Schritte

${
  data.result === 'PASS'
    ? '✅ Debug erfolgreich - Worker kann mit harten Kriterien verwendet werden'
    : '❌ Debug fehlgeschlagen - prüfe OpenCode Installation, Modell-Verfügbarkeit und Timeout-Handling'
}
`;
}

async function main() {
  const startTime = Date.now();
  let heartbeatInterval = null;
  let timeoutId = null;
  let inactivityTimeoutId = null;
  let opencode = null;
  let lastOutputAt = startTime;

  try {
    // Robust repo root detection
    const repoRoot = path.resolve(__dirname, '../../');

    // Load OpenCode configuration
    const openCodeConfig = loadOpenCodeConfig(repoRoot);

    // Debug mode
    if (isDebugMode) {
      const debugResult = await runDebugTest(repoRoot, openCodeConfig);
      process.exit(debugResult.success ? 0 : 1);
    }

    // Matrix mode
    if (isMatrixMode) {
      const matrixResult = await runMatrixTest(repoRoot, openCodeConfig);
      process.exit(matrixResult.success ? 0 : 1);
    }

    // Check for optional prompt file argument (skip --debug and --matrix)
    // process.argv[0] = node, process.argv[1] = script path, real args start at process.argv[2]
    const userArgs = process.argv.slice(2);
    const customPromptFile = userArgs.find(
      (arg) => arg !== '--debug' && arg !== '--matrix' && !arg.startsWith('--'),
    );
    let promptPath;

    if (customPromptFile) {
      // Use custom prompt file (e.g., fix-prompt.md)
      promptPath = path.isAbsolute(customPromptFile)
        ? customPromptFile
        : path.join(repoRoot, customPromptFile);
    } else {
      // Use default worker-prompt.md, fallback to next-prompt.md
      const workerPromptPath = path.join(repoRoot, '.agent', 'out', 'worker-prompt.md');
      const nextPromptPath = path.join(repoRoot, '.agent', 'out', 'next-prompt.md');

      if (fs.existsSync(workerPromptPath)) {
        promptPath = workerPromptPath;
      } else if (fs.existsSync(nextPromptPath)) {
        promptPath = nextPromptPath;
        console.log('⚠️  worker-prompt.md nicht gefunden, verwende next-prompt.md als Fallback');
      } else {
        promptPath = workerPromptPath; // Wird später als nicht gefunden behandelt
      }
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

    // Resolve OpenCode command first (needed for both saved strategy and fallback)
    const commandResolution = resolveOpenCodeCommand();

    // Check for saved spawn strategy
    const savedStrategy = loadSpawnStrategy(repoRoot);
    let command, useShell;

    if (savedStrategy) {
      console.log(`🎯 Verwende gespeicherte Spawn-Strategie: ${savedStrategy.strategy}`);
      command = savedStrategy.command;
      useShell = savedStrategy.shell;
    } else {
      console.log('⚠️  Keine gespeicherte Spawn-Strategie gefunden.');
      console.log(
        '💡 Führe zuerst "npm run agent:worker:matrix" aus, um eine funktionierende Strategie zu finden.',
      );
      console.log('🔄 Verwende Fallback-Strategie...');

      // Use resolved command from above
      command = commandResolution.command;
      useShell = process.platform === 'win32' && command.endsWith('.cmd');
    }

    // Initialize worker status
    writeWorkerStatus(workerStatusPath, 'running', {
      startedAt: new Date().toISOString(),
      model: openCodeConfig.model,
      agent: openCodeConfig.agent,
      promptFile: customPromptFile || path.basename(promptPath),
      command: command,
      shell: useShell,
      inactivityTimeoutMs: openCodeConfig.inactivityTimeoutMs,
      lastOutputAt: new Date().toISOString(),
    });

    // Check if prompt file exists
    if (!fs.existsSync(promptPath)) {
      const expectedFile = customPromptFile || path.basename(promptPath);
      const suggestion = customPromptFile
        ? 'Prüfe Pfad zur Prompt-Datei.'
        : 'Führe \`npm run agent:worker-prompt\` aus oder verwende \`npm run agent:run\`.';
      console.error(`Fehler: ${expectedFile} nicht gefunden. ${suggestion}`);

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

    // Runtime prompt file path
    const runtimePromptFile = path.join(repoRoot, '.agent', 'out', 'worker-task.md');

    // Safety header
    const safetyHeader = [
      'You are running as an automated OpenCode worker.',
      'Implement only the selected task.',
      'Do not commit or push.',
      'Do not edit .env or secrets.',
      'Do not install dependencies.',
      'After editing, summarize changed files and required verification.',
      '',
      'IMPORTANT: When task is complete, create .agent/out/opencode-worker-done.json with:',
      '{"status": "done", "taskId": "task-id", "summary": "brief summary of changes"}',
      '',
    ].join('\n');

    const fullPrompt = safetyHeader + '\n' + promptContent;

    // Add sentinel expectation to the task content
    const taskContentWithSentinel =
      fullPrompt +
      '\n\n' +
      [
        'After successful implementation, create .agent/out/opencode-worker-done.json with:',
        '{ "status": "done", "taskId": "...", "summary": "..." }',
      ].join('\n');

    // Write runtime prompt file
    fs.writeFileSync(runtimePromptFile, taskContentWithSentinel);

    // Short message for OpenCode CLI
    const shortMessage =
      'Read .agent/out/worker-task.md and execute it. When done, write .agent/out/opencode-worker-done.json with status done, taskId and summary.';

    // Prepare args array with short message
    const args = ['run', shortMessage, '--model', openCodeConfig.model];

    // Add agent parameter if configured
    if (openCodeConfig.agent) {
      args.push('--agent', openCodeConfig.agent);
    }

    // Create args preview for logging (show short message)
    const argsPreview = ['run', `"${shortMessage}"`, '--model', openCodeConfig.model];
    if (openCodeConfig.agent) {
      argsPreview.push('--agent', openCodeConfig.agent);
    }

    // Terminal output with configuration info
    console.log('🚀 OpenCode Worker gestartet');
    console.log(`📋 Prompt-Datei: ${customPromptFile || path.basename(promptPath)}`);
    console.log(`📄 Runtime Prompt File: ${runtimePromptFile}`);
    console.log(`💬 Short Message: ${shortMessage}`);
    console.log(`🤖 Modell: ${openCodeConfig.model}`);
    console.log(`👤 Agent: ${openCodeConfig.agent || 'null'}`);
    console.log(`⏱️  Timeout: ${Math.floor(openCodeConfig.workerTimeoutMs / 60000)} Minuten`);
    console.log(
      `⏰ Inactivity Timeout: ${Math.floor(openCodeConfig.inactivityTimeoutMs / 1000)} Sekunden`,
    );
    console.log(`🔧 Platform: ${process.platform}`);
    console.log(`🔧 whereOpencode: ${commandResolution.whereOpencode || 'null'}`);
    console.log(`🔧 whereOpencodeCmd: ${commandResolution.whereOpencodeCmd || 'null'}`);
    console.log(`🔧 resolvedCommand: ${command}`);
    console.log(`🔧 Command: ${command}`);
    console.log(`🔧 Final Args Preview: ${JSON.stringify(argsPreview)}`);
    console.log(
      `🔧 Shell: ${useShell} ${savedStrategy ? `(${savedStrategy.strategy})` : '(fallback)'}`,
    );
    console.log(`📝 Live-Log: ${liveLogPath}`);
    console.log('');

    // Log command configuration to live log
    const liveLogStream = fs.createWriteStream(liveLogPath, { flags: 'a' });
    liveLogStream.write(`[${new Date().toISOString()}] COMMAND CONFIG:\n`);
    liveLogStream.write(`Platform: ${process.platform}\n`);
    liveLogStream.write(`Command: ${command}\n`);
    liveLogStream.write(`Runtime Prompt File: ${runtimePromptFile}\n`);
    liveLogStream.write(`Short Message: ${shortMessage}\n`);
    liveLogStream.write(`Args: ${JSON.stringify(argsPreview)}\n`);
    liveLogStream.write(`Shell: ${useShell}\n`);
    liveLogStream.write(`Strategy: ${savedStrategy ? savedStrategy.strategy : 'fallback'}\n`);
    liveLogStream.write(`CWD: ${repoRoot}\n`);
    liveLogStream.write(`Inactivity Timeout: ${openCodeConfig.inactivityTimeoutMs}ms\n\n`);

    // Spawn OpenCode process with Windows .cmd support
    const spawnOptions = {
      stdio: ['ignore', 'pipe', 'pipe'], // Fix: ignore stdin to prevent hanging
      cwd: repoRoot,
    };

    // Use shell setting from saved strategy or fallback logic
    spawnOptions.shell = useShell;

    opencode = spawn(command, args, spawnOptions);

    // Sentinel file monitoring for worker completion
    const sentinelFilePath = path.join(repoRoot, '.agent', 'out', 'opencode-worker-done.json');
    let sentinelMonitorInterval = null;

    // Check if strategy requires forced exit monitoring
    const requiresForcedExit = savedStrategy && savedStrategy.requiresForcedExit;

    if (requiresForcedExit) {
      console.log('🎯 Strategie benötigt Forced Exit - aktiviere Sentinel-Überwachung');

      sentinelMonitorInterval = setInterval(() => {
        if (fs.existsSync(sentinelFilePath)) {
          try {
            const sentinelContent = fs.readFileSync(sentinelFilePath, 'utf-8');
            const sentinelData = JSON.parse(sentinelContent);

            if (sentinelData.status === 'done') {
              console.log('\n🎯 Sentinel-Datei erkannt - Worker-Task abgeschlossen');
              console.log(`📋 Task: ${sentinelData.taskId || 'unknown'}`);
              console.log(`📝 Summary: ${sentinelData.summary || 'keine Zusammenfassung'}`);

              // Clear monitoring
              if (sentinelMonitorInterval) {
                clearInterval(sentinelMonitorInterval);
                sentinelMonitorInterval = null;
              }

              // Force exit the process since task is done
              if (opencode && !opencode.killed) {
                console.log('🔄 Beende OpenCode-Prozess kontrolliert...');
                opencode.kill('SIGTERM');
                setTimeout(() => {
                  if (opencode && !opencode.killed) {
                    opencode.kill('SIGKILL');
                  }
                }, 3000);
              }
            }
          } catch (e) {
            // Invalid sentinel file - ignore and continue monitoring
          }
        }
      }, 2000); // Check every 2 seconds
    }

    // Update worker status with command details
    writeWorkerStatus(workerStatusPath, 'running', {
      startedAt: new Date().toISOString(),
      model: openCodeConfig.model,
      agent: openCodeConfig.agent,
      promptFile: customPromptFile || path.basename(promptPath),
      command: command,
      argsPreview: argsPreview.join(' '),
      shell: useShell,
      inactivityTimeoutMs: openCodeConfig.inactivityTimeoutMs,
      lastOutputAt: new Date().toISOString(),
    });

    // Setup main timeout
    timeoutId = setTimeout(() => {
      console.log('\n⏰ Timeout erreicht - OpenCode Worker wird beendet');

      // Clear sentinel monitoring
      if (sentinelMonitorInterval) {
        clearInterval(sentinelMonitorInterval);
        sentinelMonitorInterval = null;
      }

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
        promptFile: customPromptFile || path.basename(promptPath),
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

    // Setup inactivity timeout
    const resetInactivityTimeout = () => {
      if (inactivityTimeoutId) {
        clearTimeout(inactivityTimeoutId);
      }

      lastOutputAt = Date.now();

      inactivityTimeoutId = setTimeout(() => {
        const gitHasChanges = hasGitChanges(repoRoot);

        if (!gitHasChanges) {
          console.log(
            '\n⏰ Inactivity Timeout erreicht - OpenCode produced no output and no file changes for 90s',
          );

          if (opencode && !opencode.killed) {
            opencode.kill('SIGTERM');

            setTimeout(() => {
              if (opencode && !opencode.killed) {
                opencode.kill('SIGKILL');
              }
            }, 5000);
          }

          const elapsedMs = Date.now() - startTime;
          writeWorkerStatus(workerStatusPath, 'inactive_timeout', {
            startedAt: new Date(startTime).toISOString(),
            finishedAt: new Date().toISOString(),
            elapsedMs,
            model: openCodeConfig.model,
            agent: openCodeConfig.agent,
            promptFile: customPromptFile || path.basename(promptPath),
            exitCode: 1,
          });

          process.exit(1);
        } else {
          // Git has changes, but check if we're running too long
          const totalElapsed = Date.now() - startTime;
          const maxReasonableTime = 20 * 60 * 1000; // 20 minutes max for any task

          if (totalElapsed > maxReasonableTime) {
            console.log(
              '\n⏰ Maximum reasonable time exceeded (20 minutes) - even with Git changes, this is likely a hang',
            );

            if (opencode && !opencode.killed) {
              opencode.kill('SIGTERM');

              setTimeout(() => {
                if (opencode && !opencode.killed) {
                  opencode.kill('SIGKILL');
                }
              }, 5000);
            }

            const elapsedMs = Date.now() - startTime;
            writeWorkerStatus(workerStatusPath, 'hang_timeout', {
              startedAt: new Date(startTime).toISOString(),
              finishedAt: new Date().toISOString(),
              elapsedMs,
              model: openCodeConfig.model,
              agent: openCodeConfig.agent,
              promptFile: customPromptFile || path.basename(promptPath),
              exitCode: 1,
            });

            process.exit(1);
          } else {
            // Git has changes and still within reasonable time, reset timeout
            resetInactivityTimeout();
          }
        }
      }, openCodeConfig.inactivityTimeoutMs);
    };

    resetInactivityTimeout();

    // Setup heartbeat (every 30 seconds)
    heartbeatInterval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const secondsSinceLastOutput = Math.floor((Date.now() - lastOutputAt) / 1000);
      const gitHasChanges = hasGitChanges(repoRoot);

      const heartbeatMsg = `OpenCode worker still running... elapsed: ${formatElapsed(elapsed)}, secondsSinceLastOutput: ${secondsSinceLastOutput}, gitHasChanges: ${gitHasChanges}\n`;

      console.log(`💓 ${heartbeatMsg.trim()}`);

      // Write heartbeat to live log
      liveLogStream.write(`[${new Date().toISOString()}] HEARTBEAT: ${heartbeatMsg}`);
    }, 30000);

    // Create report stream
    const reportStream = fs.createWriteStream(reportPath, { flags: 'w' });

    // Write report header
    reportStream.write(`# OpenCode Worker Report\n\n`);
    reportStream.write(`Started: ${new Date().toISOString()}\n\n`);
    reportStream.write(`## Configuration\n`);
    reportStream.write(`Model: ${openCodeConfig.model}\n`);
    reportStream.write(`Agent: ${openCodeConfig.agent || 'null'}\n`);
    reportStream.write(`Command: ${command}\n`);
    reportStream.write(`Shell: ${useShell}\n`);
    reportStream.write(`Strategy: ${savedStrategy ? savedStrategy.strategy : 'fallback'}\n`);
    reportStream.write(`Platform: ${process.platform}\n`);
    reportStream.write(`Timeout: ${Math.floor(openCodeConfig.workerTimeoutMs / 60000)} minutes\n`);
    reportStream.write(
      `Inactivity Timeout: ${Math.floor(openCodeConfig.inactivityTimeoutMs / 1000)} seconds\n\n`,
    );
    reportStream.write(`## Command\n\`${command} ${argsPreview.join(' ')}\`\n\n`);
    reportStream.write(`## Output\n\n`);

    // Collect stdout/stderr for error pattern detection
    let collectedStdout = '';
    let collectedStderr = '';

    // Handle stdout - live stream to terminal and write to both logs
    opencode.stdout.on('data', (data) => {
      const dataStr = data.toString();
      resetInactivityTimeout(); // Reset timeout on output

      // Collect for error detection
      collectedStdout += dataStr;

      // Live stream to terminal
      process.stdout.write(dataStr);

      // Write to both log files
      liveLogStream.write(dataStr);
      reportStream.write(dataStr);
    });

    // Handle stderr - live stream to terminal and write to both logs
    opencode.stderr.on('data', (data) => {
      const dataStr = data.toString();
      resetInactivityTimeout(); // Reset timeout on output

      // Collect for error detection
      collectedStderr += dataStr;

      // Live stream to terminal
      process.stderr.write(dataStr);

      // Write to both log files
      liveLogStream.write(dataStr);
      reportStream.write(dataStr);
    });

    opencode.on('close', (code) => {
      const endTime = Date.now();
      const elapsedMs = endTime - startTime;

      // Clear timeouts and heartbeat
      if (timeoutId) clearTimeout(timeoutId);
      if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      if (sentinelMonitorInterval) clearInterval(sentinelMonitorInterval);

      // Perform error pattern detection and success evidence analysis
      const detectedErrorPatterns = detectErrorPatterns(collectedStdout, collectedStderr);
      const successEvidence = detectSuccessEvidence(repoRoot, collectedStdout, collectedStderr);
      const finalVerdict = determineFinalVerdict(
        code,
        detectedErrorPatterns,
        successEvidence,
        requiresForcedExit,
      );

      // Enhanced report with error analysis
      reportStream.write(`\n\n## Exit Code\n${code}\n`);
      reportStream.write(`\nCompleted: ${new Date().toISOString()}\n`);
      reportStream.write(`\nElapsed: ${formatElapsed(elapsedMs)}\n`);

      // Add enhanced error analysis to report
      reportStream.write(`\n## Enhanced Error Analysis\n`);
      reportStream.write(
        `**Fatal Error Patterns:** ${finalVerdict.fatalErrorPatterns.length > 0 ? finalVerdict.fatalErrorPatterns.join(', ') : 'None'}\n`,
      );
      reportStream.write(
        `**Contextual Error Patterns:** ${detectedErrorPatterns.contextual ? detectedErrorPatterns.contextual.join(', ') : 'None'}\n`,
      );
      reportStream.write(
        `**Ignored Non-Fatal Patterns:** ${finalVerdict.ignoredNonFatalPatterns.length > 0 ? finalVerdict.ignoredNonFatalPatterns.join(', ') : 'None'}\n`,
      );
      reportStream.write(
        `**Verify Success Detected:** ${finalVerdict.verifySuccessDetected ? '✅' : '❌'}\n`,
      );
      reportStream.write(
        `**Forced Exit Expected:** ${finalVerdict.forcedExitExpected ? '✅' : '❌'}\n`,
      );
      reportStream.write(`**Success Evidence:**\n`);
      reportStream.write(`- Sentinel File: ${successEvidence.sentinel ? '✅' : '❌'}\n`);
      reportStream.write(`- Git Changes: ${successEvidence.gitDiff ? '✅' : '❌'}\n`);
      reportStream.write(
        `- Completion Message: ${successEvidence.completionMessage ? '✅' : '❌'}\n`,
      );
      reportStream.write(`**Final Verdict:** ${finalVerdict.verdict.toUpperCase()}\n`);
      if (finalVerdict.failureReason) {
        reportStream.write(`**Failure Reason:** ${finalVerdict.failureReason}\n`);
      }

      // Close streams after writing analysis
      liveLogStream.end();
      reportStream.end();

      // Determine actual worker status based on final verdict
      const workerStatus = finalVerdict.success ? 'completed' : 'failed';
      const actualExitCode = finalVerdict.success ? 0 : 1;

      // Update worker status with enhanced information
      writeWorkerStatus(workerStatusPath, workerStatus, {
        startedAt: new Date(startTime).toISOString(),
        finishedAt: new Date().toISOString(),
        elapsedMs,
        model: openCodeConfig.model,
        agent: openCodeConfig.agent,
        promptFile: customPromptFile || path.basename(promptPath),
        command: command,
        argsPreview: argsPreview.join(' '),
        shell: useShell,
        exitCode: code,
        detectedErrorPatterns,
        successEvidence,
        finalVerdict: finalVerdict.verdict,
        failureReason: finalVerdict.failureReason,
        forcedExitExpected: finalVerdict.forcedExitExpected,
        sentinelValid: finalVerdict.sentinelValid,
        verifySuccessDetected: finalVerdict.verifySuccessDetected,
        fatalErrorPatterns: finalVerdict.fatalErrorPatterns,
        ignoredNonFatalPatterns: finalVerdict.ignoredNonFatalPatterns,
      });

      // Enhanced terminal output
      const statusIcon = finalVerdict.success ? '✅' : '❌';
      const statusText = finalVerdict.success ? 'ERFOLGREICH' : 'FEHLGESCHLAGEN';

      console.log(`\n${statusIcon} OpenCode Worker ${statusText}`);
      console.log(`🚪 Prozess Exit-Code: ${code}`);
      console.log(`🎯 Finale Bewertung: ${finalVerdict.verdict.toUpperCase()}`);

      if (finalVerdict.forcedExitExpected) {
        console.log(`🎯 Forced Exit erwartet: ✅ (Sentinel-basierte Beendigung)`);
      }

      if (finalVerdict.verifySuccessDetected) {
        console.log(`✅ Verify Success erkannt: npm run verify/typecheck/lint erfolgreich`);
      }

      if (finalVerdict.fatalErrorPatterns.length > 0) {
        console.log(`❌ Fatale Fehler-Pattern: ${finalVerdict.fatalErrorPatterns.join(', ')}`);
      }

      if (detectedErrorPatterns.contextual && detectedErrorPatterns.contextual.length > 0) {
        console.log(
          `⚠️  Kontextuelle Fehler-Pattern: ${detectedErrorPatterns.contextual.join(', ')}`,
        );
      }

      if (finalVerdict.ignoredNonFatalPatterns.length > 0) {
        console.log(
          `🔇 Ignorierte Non-Fatal Pattern: ${finalVerdict.ignoredNonFatalPatterns.join(', ')}`,
        );
      }

      console.log(`📊 Success Evidence:`);
      console.log(`   - Sentinel: ${successEvidence.sentinel ? '✅' : '❌'}`);
      console.log(`   - Git Diff: ${successEvidence.gitDiff ? '✅' : '❌'}`);
      console.log(`   - Completion: ${successEvidence.completionMessage ? '✅' : '❌'}`);

      if (finalVerdict.failureReason) {
        console.log(`❌ Grund: ${finalVerdict.failureReason}`);
      }

      console.log(`⏱️  Laufzeit: ${formatElapsed(elapsedMs)}`);
      console.log(`📄 Report: ${reportPath}`);
      console.log(`📝 Live-Log: ${liveLogPath}`);

      if (finalVerdict.success) {
        console.log('🔄 Nächster Schritt: npm run agent:verify');
      } else {
        console.log('🔄 Nächster Schritt: Review opencode-report.md und behebe Fehler');
      }

      // Update state based on final verdict
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

      state.status = finalVerdict.success ? 'worker_completed' : 'worker_failed';
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

      // Exit with actual exit code based on final verdict
      process.exit(actualExitCode);
    });

    opencode.on('error', (err) => {
      const elapsedMs = Date.now() - startTime;

      // Clear timeouts and heartbeat
      if (timeoutId) clearTimeout(timeoutId);
      if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
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

    // Clear timeouts and heartbeat
    if (timeoutId) clearTimeout(timeoutId);
    if (inactivityTimeoutId) clearTimeout(inactivityTimeoutId);
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
