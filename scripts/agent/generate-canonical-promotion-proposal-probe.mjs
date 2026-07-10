#!/usr/bin/env node

import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  TARGET_PATH,
  formatSandboxPromotionProposalWriterProbeSummary,
  parseProposalJson,
  readProposalInputFileSync,
  runSandboxPromotionProposalWriterProbe,
} from './lib/sandbox-promotion-proposal-writer-probe.mjs';

const __filename = fileURLToPath(import.meta.url);

const FORBIDDEN_FLAG_PATTERNS = [
  /^--(?:out|output|path|target|target-path|payload|content|append|truncate|delete|rename|move|stage|commit|push|deploy)(?:$|=)/,
  /^-(?:o|p)$/,
];

export function parseArgs(argv) {
  const options = {
    execute: false,
    pretty: false,
    help: false,
    proposalJson: null,
    proposalFile: null,
  };
  const args = argv.slice(2);
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--execute-canonical-promotion-proposal-probe') options.execute = true;
    else if (arg === '--pretty') options.pretty = true;
    else if (arg === '--help' || arg === '-h') options.help = true;
    else if (arg === '--proposal-json') options.proposalJson = args[++index];
    else if (arg === '--proposal-file') options.proposalFile = args[++index];
    else if (FORBIDDEN_FLAG_PATTERNS.some((pattern) => pattern.test(arg)))
      throw new Error(`Forbidden argument refused: ${arg}`);
    else if (arg.startsWith('-')) throw new Error(`Unknown argument refused: ${arg}`);
    else throw new Error(`Positional output paths/content are refused: ${arg}`);
  }
  return options;
}

export function usage() {
  return `RALPH-044B Minimal Canonical Promotion Proposal Writer Probe

USAGE:
  node scripts/agent/generate-canonical-promotion-proposal-probe.mjs --proposal-json <json> [--pretty] [--execute-canonical-promotion-proposal-probe]
  node scripts/agent/generate-canonical-promotion-proposal-probe.mjs --proposal-file <path.json> [--pretty] [--execute-canonical-promotion-proposal-probe]

SAFETY:
  - Dry-run is the default and writes no files
  - Writes require explicit --execute-canonical-promotion-proposal-probe
  - Only creates ${TARGET_PATH}
  - Refuses overwrite, append, delete, rename, move, alternate paths, traversal, absolute paths, drive-qualified paths, symlink escapes, arbitrary payload/content, and output/path flags
  - Does not authorize canonical promotion, queue admission, queue execution, worker execution, task execution, lifecycle execution, runtime authority, evidence authority, review authority, validation authority, task completion authority, or commit readiness`;
}

function readProposal(options) {
  const supplied = [options.proposalJson, options.proposalFile].filter(
    (value) => value !== null && value !== undefined,
  );
  if (supplied.length !== 1)
    throw new Error('Specify exactly one of --proposal-json or --proposal-file');
  if (options.proposalJson) return parseProposalJson(options.proposalJson);
  return readProposalInputFileSync(options.proposalFile);
}

async function main() {
  let options;
  try {
    options = parseArgs(process.argv);
    if (options.help) {
      console.log(usage());
      process.exit(0);
    }
    const proposal = readProposal(options);
    const result = await runSandboxPromotionProposalWriterProbe({
      execute: options.execute,
      proposal,
    });
    if (options.pretty) console.log(formatSandboxPromotionProposalWriterProbeSummary(result));
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'blocked' && options.execute ? 1 : 0);
  } catch (error) {
    console.error(JSON.stringify({ status: 'blocked', error: error.message }, null, 2));
    process.exit(1);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  main();
}
