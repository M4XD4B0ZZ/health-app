#!/usr/bin/env node
/** Explicit, shared-gate RESOLVER-V3-013 B/C live-evidence entry point. */
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

if (!process.argv.slice(2).includes('--live')) {
  console.error('Error: this paid runner requires explicit --live; no fixture fallback exists.');
  process.exit(1);
}

const required = ['ANTHROPIC_API_KEY', 'ANTHROPIC_VARIANT_B_MODEL', 'ANTHROPIC_VARIANT_C_MODEL'];
const missing = required.filter((key) => !process.env[key]);
if (missing.length > 0) {
  console.error(`Error: controlled live run requires ${missing.join(', ')}; no request was made.`);
  process.exit(1);
}

const result = spawnSync(
  'npx',
  [
    'jest',
    '--config',
    'jest.config.js',
    '--testMatch=**/runResolverV3LiveEvidence.harness.ts',
    '--runInBand',
  ],
  { cwd: repoRoot, stdio: 'inherit', shell: process.platform === 'win32', env: process.env },
);

if (result.error)
  console.error(`Failed to launch controlled live harness: ${result.error.message}`);
process.exit(result.status ?? 1);
