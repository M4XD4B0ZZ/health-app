#!/usr/bin/env node

import { spawn } from 'child_process';
import { writeFileSync } from 'fs';

/**
 * Agent Orchestrator - Verification Runner
 *
 * Führt die Standard-Verification-Pipeline aus und erstellt einen Report.
 * Verwendet PowerShell-kompatible Command-Chaining.
 */

const OUTPUT_PATH = '.agent/out/verify-report.md';

function runCommand(command, args = []) {
  return new Promise((resolve, reject) => {
    console.log(`🔄 Ausführung: ${command} ${args.join(' ')}`);

    const process = spawn(command, args, {
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
      resolve({
        command: `${command} ${args.join(' ')}`,
        exitCode: code,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        success: code === 0,
      });
    });

    process.on('error', (error) => {
      reject({
        command: `${command} ${args.join(' ')}`,
        error: error.message,
        success: false,
      });
    });
  });
}

function generateReport(results) {
  const timestamp = new Date().toISOString();
  const overallSuccess = results.every((r) => r.success);

  let report = `# Verification Report

**Generiert:** ${timestamp}
**Status:** ${overallSuccess ? '✅ ERFOLGREICH' : '❌ FEHLGESCHLAGEN'}

---

## Ausgeführte Checks

`;

  results.forEach((result, index) => {
    const status = result.success ? '✅' : '❌';
    const exitInfo = result.exitCode !== undefined ? ` (Exit: ${result.exitCode})` : '';

    report += `### ${index + 1}. ${result.command}

**Status:** ${status}${exitInfo}

`;

    if (result.stdout) {
      report += `**Output:**
\`\`\`
${result.stdout}
\`\`\`

`;
    }

    if (result.stderr) {
      report += `**Errors:**
\`\`\`
${result.stderr}
\`\`\`

`;
    }

    if (result.error) {
      report += `**Error:**
\`\`\`
${result.error}
\`\`\`

`;
    }

    report += '---\n\n';
  });

  report += `## Zusammenfassung

- **Gesamt:** ${results.length} Checks
- **Erfolgreich:** ${results.filter((r) => r.success).length}
- **Fehlgeschlagen:** ${results.filter((r) => !r.success).length}

`;

  if (!overallSuccess) {
    report += `## ⚠️ Nächste Schritte

Die Verification ist fehlgeschlagen. Behebe die Fehler und führe die Checks erneut aus:

\`\`\`bash
npm run verify
\`\`\`

`;
  }

  report += `## Edge Functions Hinweis

**verify:edge** wurde NICHT automatisch ausgeführt. 

Falls Edge Functions geändert wurden, führe manuell aus:

\`\`\`bash
npm run verify:edge
\`\`\`

**Voraussetzung:** Gültige .env-Datei mit Supabase-Credentials.

---

*Automatisch generiert von run-verify.mjs*
`;

  return report;
}

async function main() {
  const results = [];

  try {
    console.log('🚀 Starte Verification Pipeline\n');

    // 1. TypeScript Check
    try {
      const typecheckResult = await runCommand('npm', ['run', 'typecheck']);
      results.push(typecheckResult);
    } catch (error) {
      results.push(error);
    }

    // 2. ESLint
    try {
      const lintResult = await runCommand('npm', ['run', 'lint']);
      results.push(lintResult);
    } catch (error) {
      results.push(error);
    }

    // 3. Prettier Format Check
    try {
      const formatResult = await runCommand('npm', ['run', 'format:check']);
      results.push(formatResult);
    } catch (error) {
      results.push(error);
    }

    // 4. Jest Tests
    try {
      const testResult = await runCommand('npm', ['run', 'test']);
      results.push(testResult);
    } catch (error) {
      results.push(error);
    }

    // Report generieren
    const report = generateReport(results);
    writeFileSync(OUTPUT_PATH, report);

    // Zusammenfassung ausgeben
    const overallSuccess = results.every((r) => r.success);
    const successCount = results.filter((r) => r.success).length;

    console.log(`\n📊 Verification abgeschlossen`);
    console.log(`✅ Erfolgreich: ${successCount}/${results.length}`);
    console.log(`📄 Report: ${OUTPUT_PATH}`);

    if (overallSuccess) {
      console.log('\n🎉 Alle Checks erfolgreich!');
    } else {
      console.log('\n⚠️  Einige Checks fehlgeschlagen - siehe Report für Details');
    }

    // Exit-Code setzen
    process.exit(overallSuccess ? 0 : 1);
  } catch (error) {
    console.error('❌ Unerwarteter Fehler:', error.message);

    // Fehler-Report schreiben
    const errorReport = `# Verification Report - FEHLER

**Generiert:** ${new Date().toISOString()}
**Status:** ❌ KRITISCHER FEHLER

## Fehler

\`\`\`
${error.message}
\`\`\`

## Bisherige Ergebnisse

${results.length > 0 ? results.map((r) => `- ${r.command}: ${r.success ? '✅' : '❌'}`).join('\n') : 'Keine Checks abgeschlossen'}

---

*Automatisch generiert von run-verify.mjs*
`;

    writeFileSync(OUTPUT_PATH, errorReport);
    process.exit(1);
  }
}

main();
