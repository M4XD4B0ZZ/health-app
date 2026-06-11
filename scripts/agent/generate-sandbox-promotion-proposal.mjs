#!/usr/bin/env node

import {
  buildSandboxPromotionProposal,
  buildSandboxPromotionProposalFromArtifact,
  formatSandboxPromotionProposalMarkdown,
  parsePromotionJson,
  readPromotionInputFile
} from './lib/sandbox-promotion-proposal-generator.mjs';

export function parseArgs(argv) {
  const args = { eligibilityJson: null, eligibilityFile: null, artifactJson: null, artifactFile: null, format: 'json', unknownFlags: [], positionalArgs: [] };
  for (let index = 2; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--eligibility-json') args.eligibilityJson = argv[++index];
    else if (arg === '--eligibility-file') args.eligibilityFile = argv[++index];
    else if (arg === '--artifact-json') args.artifactJson = argv[++index];
    else if (arg === '--artifact-file') args.artifactFile = argv[++index];
    else if (arg === '--format') args.format = argv[++index];
    else if (arg.startsWith('--')) args.unknownFlags.push(arg);
    else args.positionalArgs.push(arg);
  }
  if (args.format !== 'json' && args.format !== 'markdown') throw new Error(`Invalid format: ${args.format}. Must be json or markdown`);
  return args;
}

async function readSource(args) {
  const supplied = [args.eligibilityJson, args.eligibilityFile, args.artifactJson, args.artifactFile].filter((value) => value !== null && value !== undefined);
  if (supplied.length !== 1) throw new Error('Specify exactly one of --eligibility-json, --eligibility-file, --artifact-json, or --artifact-file');
  if (args.eligibilityJson) return { kind: 'eligibility', value: parsePromotionJson(args.eligibilityJson) };
  if (args.eligibilityFile) return { kind: 'eligibility', value: await readPromotionInputFile(args.eligibilityFile) };
  if (args.artifactJson) return { kind: 'artifact', value: parsePromotionJson(args.artifactJson) };
  return { kind: 'artifact', value: await readPromotionInputFile(args.artifactFile) };
}

async function main() {
  try {
    const args = parseArgs(process.argv);
    if (args.unknownFlags.length > 0) throw new Error(`Unknown flags: ${args.unknownFlags.join(', ')}`);
    if (args.positionalArgs.length > 0) throw new Error(`Unexpected positional arguments: ${args.positionalArgs.join(', ')}`);
    const source = await readSource(args);
    const proposal = source.kind === 'artifact' ? buildSandboxPromotionProposalFromArtifact(source.value) : buildSandboxPromotionProposal(source.value);
    const output = args.format === 'markdown' ? formatSandboxPromotionProposalMarkdown(proposal) : JSON.stringify(proposal, null, 2);
    console.log(output);
    process.exit(proposal.proposal_created ? 0 : 2);
  } catch (error) {
    console.error(`Error: ${error.message}`);
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}` || process.argv[1]?.endsWith('generate-sandbox-promotion-proposal.mjs')) {
  main();
}