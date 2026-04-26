import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load OpenCode configuration
function loadOpenCodeConfig(repoRoot) {
  const configPath = path.join(repoRoot, '.agent', 'config.json');

  // Default configuration
  const defaultConfig = {
    model: 'openai/gpt-4.1',
    agent: null,
    command: 'opencode',
    maxFixAttempts: 1,
  };

  if (fs.existsSync(configPath)) {
    try {
      const configContent = fs.readFileSync(configPath, 'utf-8');
      const config = JSON.parse(configContent);
      return { ...defaultConfig, ...config.opencode };
    } catch (e) {
      console.warn(`Warnung: Fehler beim Lesen von .agent/config.json: ${e.message}`);
      console.warn('Verwende Default-Konfiguration.');
      return defaultConfig;
    }
  }

  return defaultConfig;
}

async function main() {
  try {
    // Robust repo root detection
    const repoRoot = path.resolve(__dirname, '../../');

    // Load OpenCode configuration
    const openCodeConfig = loadOpenCodeConfig(repoRoot);
    console.log(
      `OpenCode Konfiguration: model=${openCodeConfig.model}, agent=${openCodeConfig.agent || 'null'}`,
    );

    // Check for optional prompt file argument
    const customPromptFile = process.argv[2];
    let promptPath;

    if (customPromptFile) {
      // Use custom prompt file (e.g., fix-prompt.md)
      promptPath = path.isAbsolute(customPromptFile)
        ? customPromptFile
        : path.join(repoRoot, customPromptFile);
      console.log(`Verwende benutzerdefinierte Prompt-Datei: ${promptPath}`);
    } else {
      // Use default next-prompt.md
      promptPath = path.join(repoRoot, '.agent', 'out', 'next-prompt.md');
    }

    const reportPath = path.join(repoRoot, '.agent', 'out', 'opencode-report.md');
    const statePath = path.join(repoRoot, '.agent', 'state.json');

    // Check if prompt file exists
    if (!fs.existsSync(promptPath)) {
      const expectedFile = customPromptFile || '.agent/out/next-prompt.md';
      console.error(
        `Fehler: ${expectedFile} nicht gefunden. ${customPromptFile ? 'Prüfe Pfad zur Prompt-Datei.' : 'Bitte zuerst `npm run agent:run` ausführen.'}`,
      );
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

    console.log('OpenCode Worker gestartet...');

    // Spawn OpenCode process with explicit model configuration
    // Primary command: opencode run "<prompt>" --model <model>
    // Fallback command (commented): opencode -p "<prompt>" -q --model <model>
    const args = ['run', fullPrompt, '--model', openCodeConfig.model];

    // Add agent parameter if configured
    if (openCodeConfig.agent) {
      args.push('--agent', openCodeConfig.agent);
    }

    // To switch to fallback, comment above and uncomment below:
    // const args = ['-p', fullPrompt, '-q', '--model', openCodeConfig.model];
    // if (openCodeConfig.agent) {
    //   args.push('--agent', openCodeConfig.agent);
    // }

    const opencode = spawn(openCodeConfig.command, args, {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    // Ensure output directory exists
    const outputDir = path.dirname(reportPath);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Write output streams to report file
    const reportStream = fs.createWriteStream(reportPath, { flags: 'w' });

    reportStream.write(`# OpenCode Worker Report\n\n`);
    reportStream.write(`Started: ${new Date().toISOString()}\n\n`);
    reportStream.write(`## Configuration\n`);
    reportStream.write(`Model: ${openCodeConfig.model}\n`);
    reportStream.write(`Agent: ${openCodeConfig.agent || 'null'}\n`);
    reportStream.write(`Command: ${openCodeConfig.command}\n\n`);
    reportStream.write(`## Command\n\`${openCodeConfig.command} ${args.join(' ')}\`\n\n`);
    reportStream.write(`## Output\n\n`);

    opencode.stdout.on('data', (data) => {
      reportStream.write(data);
    });

    opencode.stderr.on('data', (data) => {
      reportStream.write(data);
    });

    opencode.on('close', (code) => {
      reportStream.write(`\n\n## Exit Code\n${code}\n`);
      reportStream.write(`\nCompleted: ${new Date().toISOString()}\n`);
      reportStream.end();

      console.log(`OpenCode Worker beendet mit Exit-Code: ${code}`);
      console.log(`Report geschrieben nach: ${reportPath}`);
      console.log('Nächster Schritt: npm run agent:verify');

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
      console.error('Fehler: OpenCode ist nicht installiert oder nicht im PATH.');
      console.error('Details:', err.message);

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
    console.error('Unbekannter Fehler:', err);
    process.exit(1);
  }
}

main();
