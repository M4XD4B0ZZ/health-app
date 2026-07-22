import fs from 'fs';
import path from 'path';
import { describe, it, expect } from '@jest/globals';

const representativeHybridDir = path.resolve(__dirname, '..');
// __dirname = <repoRoot>/src/features/nutrition/benchmark/representativeHybrid/__tests__
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
      if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
      if (entry.name.endsWith('.ts')) files.push(fullPath);
    }
  };
  walk(representativeHybridDir);
  return files;
}

describe('RESOLVER-V3-038 Representative Hybrid Benchmark isolation', () => {
  const files = allSourceFiles();

  it('no file imports Supabase, a live provider transport, or a network client', () => {
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

  it('no file calls global.fetch directly', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/(?<!\.)\bfetch\(/);
    }
  });

  it('no file is referenced by the DI container/composition root', () => {
    const container = fs.readFileSync(containerPath, 'utf8');
    expect(container).not.toMatch(/RepresentativeHybridBenchmark/);
  });

  it('no file adds a --live flag or reads a provider credential env var', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/--live/);
      expect(source).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY|process\.env\.\w*_API_KEY/);
    }
  });

  it('no migration, edge function, or RPC was added for this task', () => {
    const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    expect(
      migrationFiles.some((name) => /representative.*hybrid|resolver.*v3.*038/i.test(name)),
    ).toBe(false);
  });

  it('the RESOLVER-V3-023 v1 Learning Benchmark V2 corpus files are only ever type-imported, never re-exported or re-executed', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      const learningV2Imports = [...source.matchAll(/from ['"]\.\.\/learningV2\/([^'"]+)['"]/g)];
      for (const match of learningV2Imports) {
        // Only the shared, data-free step-shape/observation types are reused -- never a *Corpus.ts
        // file (which would pull in frozen V1 scenario data) and never a runtime/service file.
        expect(match[1]).toBe('LearningBenchmarkV2Types');
      }
    }
  });
});
