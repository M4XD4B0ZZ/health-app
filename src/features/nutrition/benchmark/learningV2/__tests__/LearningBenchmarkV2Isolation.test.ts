import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const learningV2Dir = path.resolve(__dirname, '..');
// __dirname = <repoRoot>/src/features/nutrition/benchmark/learningV2/__tests__
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const containerPath = path.join(repoRoot, 'src', 'infrastructure', 'di', 'container.ts');

function allSourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(fullPath);
        continue;
      }
      // Excludes __tests__ itself: this file's own source necessarily contains the literal
      // strings it scans for (e.g. its own `fetch(`-matching regex), mirroring the same
      // `__tests__`-path exclusion used by the RESOLVER-V3-031/032 isolation tests.
      if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
      if (entry.name.endsWith('.ts')) files.push(fullPath);
    }
  };
  walk(learningV2Dir);
  return files;
}

describe('RESOLVER-V3-023 Learning Benchmark V2 isolation', () => {
  const files = allSourceFiles();

  it('no Learning Benchmark V2 file imports Supabase, the live Anthropic transport, or a network client', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/@supabase\/supabase-js/);
      expect(source).not.toMatch(/from ['"].*Supabase[A-Za-z]*['"]/);
      expect(source).not.toMatch(
        /AnthropicBenchmarkTransport|LiveProviderBudgetGate|VariantCLiveInterpretationProvider|VariantBLiveProvider/,
      );
      expect(source).not.toMatch(/\bnode-fetch\b|\bXMLHttpRequest\b/);
    }
  });

  it('no Learning Benchmark V2 file calls global.fetch directly', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/(?<!\.)\bfetch\(/);
    }
  });

  it('no Learning Benchmark V2 file is referenced by the DI container/composition root', () => {
    const container = fs.readFileSync(containerPath, 'utf8');
    expect(container).not.toMatch(/LearningBenchmarkV2/);
  });

  it('no Learning Benchmark V2 file adds a --live flag or reads a provider credential env var', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/--live/);
      expect(source).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY|process\.env\.\w*_API_KEY/);
    }
  });

  it('no migration, edge function, or RPC was added for this task', () => {
    const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    expect(migrationFiles.some((name) => /learning.*benchmark|learning.*v2/i.test(name))).toBe(
      false,
    );
    for (const migrationFile of migrationFiles) {
      if (!migrationFile.endsWith('.sql')) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
      if (/learning.*benchmark/i.test(sql)) {
        expect(sql).not.toMatch(/create\s+(or\s+replace\s+)?function/i);
      }
    }
  });

  it('the CLI script implements no --live flag branch and reads no provider credential', () => {
    const cliPath = path.join(repoRoot, 'scripts', 'benchmark-resolver-v3-learning-v2.mjs');
    const source = fs.readFileSync(cliPath, 'utf8');
    // The script's own docstring explains, in prose, that no --live flag exists (mentioning the
    // literal text) -- what must be absent is an actual parsed flag/credential-handling branch.
    expect(source).not.toMatch(/args\.includes\(['"]--live['"]\)/);
    expect(source).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });
});
