#!/usr/bin/env node

import {
  evaluateSandboxLifecycleEligibility,
  parseEligibilityJson,
  readEligibilityInputFile,
  ELIGIBILITY_DECISIONS,
} from './lib/sandbox-lifecycle-eligibility-evaluator.mjs';

function parseArgs(argv) {
  const args = {
    inputJson: null,
    inputFile: null,
    format: 'json',
    unknownFlags: [],
    positionalArgs: [],
  };

  for (let i = 2; i < argv.length; i++) {
    const arg = argv[i];

    if (arg === '--input-json') {
      if (i + 1 >= argv.length) {
        throw new Error('--input-json requires a value');
      }
      args.inputJson = argv[++i];
    } else if (arg === '--input-file') {
      if (i + 1 >= argv.length) {
        throw new Error('--input-file requires a value');
      }
      args.inputFile = argv[++i];
    } else if (arg === '--format') {
      if (i + 1 >= argv.length) {
        throw new Error('--format requires a value');
      }
      const format = argv[++i];
      if (format !== 'json' && format !== 'markdown') {
        throw new Error(`Invalid format: ${format}. Must be json or markdown`);
      }
      args.format = format;
    } else if (arg.startsWith('--')) {
      args.unknownFlags.push(arg);
    } else {
      args.positionalArgs.push(arg);
    }
  }

  return args;
}

function formatMarkdown(result) {
  const lines = [];

  lines.push('# Sandbox Lifecycle Eligibility Evaluation');
  lines.push('');
  lines.push(`**Evaluator:** ${result.evaluator}`);
  lines.push(`**Mode:** ${result.mode}`);
  lines.push(`**Schema Version:** ${result.schema_version}`);
  lines.push('');

  lines.push('## Decision');
  lines.push('');
  lines.push(`**Decision:** \`${result.decision}\``);
  lines.push(
    `**Eligible for Human Consideration:** ${result.eligible_for_human_consideration ? '✅ Yes' : '❌ No'}`,
  );
  lines.push(`**Blocked:** ${result.blocked ? '⚠️ Yes' : '✅ No'}`);
  lines.push('');

  if (result.reason_codes.length > 0) {
    lines.push('## Reason Codes');
    lines.push('');
    for (const code of result.reason_codes) {
      lines.push(`- \`${code}\``);
    }
    lines.push('');
  }

  if (result.findings.length > 0) {
    lines.push('## Findings');
    lines.push('');
    for (const finding of result.findings) {
      lines.push(`### ${finding.severity.toUpperCase()}: ${finding.code}`);
      lines.push('');
      lines.push(finding.message);
      if (Object.keys(finding.details).length > 0) {
        lines.push('');
        lines.push('**Details:**');
        lines.push('```json');
        lines.push(JSON.stringify(finding.details, null, 2));
        lines.push('```');
      }
      lines.push('');
    }
  }

  lines.push('## Artifact Summary');
  lines.push('');
  lines.push(`- **Sandbox:** ${result.artifact_summary.sandbox}`);
  lines.push(`- **Non-Authoritative:** ${result.artifact_summary.non_authoritative}`);
  lines.push(`- **Task ID:** ${result.artifact_summary.task_id || 'N/A'}`);
  lines.push(`- **Queue Entry ID:** ${result.artifact_summary.queue_entry_id || 'N/A'}`);
  lines.push(`- **Evidence Bundled:** ${result.artifact_summary.evidence_bundled}`);
  lines.push('');

  lines.push('## Lifecycle Summary');
  lines.push('');
  lines.push(`- **State:** ${result.lifecycle_summary.state || 'N/A'}`);
  lines.push(`- **Next State:** ${result.lifecycle_summary.next_state || 'N/A'}`);
  lines.push(`- **Timestamp:** ${result.lifecycle_summary.timestamp || 'N/A'}`);
  lines.push('');

  lines.push('## Authority Flags');
  lines.push('');
  lines.push('All authority flags are **false** (read-only, non-authoritative evaluation):');
  lines.push('');
  for (const [key, value] of Object.entries(result.authority_flags)) {
    lines.push(`- **${key}:** ${value}`);
  }
  lines.push('');

  lines.push('## Metadata');
  lines.push('');
  lines.push(`- **Writes Performed:** ${result.writes_performed}`);
  lines.push(`- **Stdout Only:** ${result.stdout_only}`);
  lines.push('');

  lines.push('## Non-Authoritative Statement');
  lines.push('');
  lines.push(`> ${result.non_authoritative_statement}`);
  lines.push('');

  lines.push('## Non-Authorization Statement');
  lines.push('');
  lines.push(`> ${result.non_authorization_statement}`);
  lines.push('');

  return lines.join('\n');
}

async function main() {
  try {
    const args = parseArgs(process.argv);

    if (args.unknownFlags.length > 0) {
      console.error(`Error: Unknown flags: ${args.unknownFlags.join(', ')}`);
      process.exit(1);
    }

    if (args.positionalArgs.length > 0) {
      console.error(`Error: Unexpected positional arguments: ${args.positionalArgs.join(', ')}`);
      process.exit(1);
    }

    if (!args.inputJson && !args.inputFile) {
      console.error('Error: Either --input-json or --input-file must be provided');
      process.exit(1);
    }

    if (args.inputJson && args.inputFile) {
      console.error('Error: Cannot specify both --input-json and --input-file');
      process.exit(1);
    }

    let input;
    if (args.inputJson) {
      input = parseEligibilityJson(args.inputJson);
    } else {
      input = await readEligibilityInputFile(args.inputFile);
    }

    const result = evaluateSandboxLifecycleEligibility(input);

    if (args.format === 'json') {
      console.log(JSON.stringify(result, null, 2));
    } else {
      console.log(formatMarkdown(result));
    }

    // Exit with 0 regardless of eligibility decision (only input/parse errors cause non-zero exit)
    process.exit(0);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

main();
