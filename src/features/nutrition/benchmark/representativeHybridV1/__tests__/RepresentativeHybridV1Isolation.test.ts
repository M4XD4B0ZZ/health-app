import fs from 'fs';
import path from 'path';

const rhDir = path.resolve(__dirname, '..');
const repoRoot = path.resolve(__dirname, '..', '..', '..', '..', '..', '..');
const containerPath = path.join(repoRoot, 'src', 'infrastructure', 'di', 'container.ts');

function allSourceFiles(): string[] {
  const files: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        // RESOLVER-V3-039 added a deliberately separate, explicitly live-authorized subtree here
        // (`representativeHybridV1/live/**`) that legitimately imports the live transport/budget
        // gate and reads ANTHROPIC_API_KEY's presence -- that is its entire purpose, and it is
        // never wired into this fixture-only harness (`runRepresentativeHybridV1.ts`/
        // `.harness.ts` never import it). Its own isolation properties (no production DI import,
        // no fixture fallback, secret-free errors) are proven by its own
        // `live/__tests__/RepresentativeHybridV1LiveIsolation.test.ts`. This scan's purpose is the
        // FIXTURE-ONLY tree (RESOLVER-V3-038); excluding the live subtree keeps that purpose
        // intact rather than making this assertion vacuously fail on out-of-scope files.
        if (entry.name === 'live') continue;
        walk(fullPath);
        continue;
      }
      if (fullPath.includes(`${path.sep}__tests__${path.sep}`)) continue;
      if (entry.name.endsWith('.ts')) files.push(fullPath);
    }
  };
  walk(rhDir);
  return files;
}

describe('RESOLVER-V3-038 isolation (zero-network, no production wiring)', () => {
  const files = allSourceFiles();

  it('no file imports the live Anthropic transport, live provider adapters, or a network client', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(
        /AnthropicBenchmarkTransport|LiveProviderBudgetGate|VariantCLiveInterpretationProvider|VariantBLiveProvider/,
      );
      expect(source).not.toMatch(/@supabase\/supabase-js/);
      expect(source).not.toMatch(/from ['"].*Supabase[A-Za-z]*['"]/);
      expect(source).not.toMatch(/\bnode-fetch\b|\bXMLHttpRequest\b/);
    }
  });

  it('no file calls global.fetch directly', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/(?<!\.)\bfetch\(/);
    }
  });

  it('no file reads a provider API key environment variable', () => {
    for (const file of files) {
      const source = fs.readFileSync(file, 'utf8');
      expect(source).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY|process\.env\.\w*_API_KEY/);
    }
  });

  it('no file is referenced by the DI container/composition root', () => {
    const container = fs.readFileSync(containerPath, 'utf8');
    expect(container).not.toMatch(/RepresentativeHybridV1/);
  });

  it('no migration, edge function, or RPC references this benchmark', () => {
    const migrationsDir = path.join(repoRoot, 'supabase', 'migrations');
    const migrationFiles = fs.readdirSync(migrationsDir);
    expect(migrationFiles.some((name) => /representative.*hybrid/i.test(name))).toBe(false);
    for (const migrationFile of migrationFiles) {
      if (!migrationFile.endsWith('.sql')) continue;
      const sql = fs.readFileSync(path.join(migrationsDir, migrationFile), 'utf8');
      expect(sql).not.toMatch(/representative.*hybrid/i);
    }
  });

  it('the CLI implements no --live flag branch and reads no provider credential', () => {
    const cliPath = path.join(
      repoRoot,
      'scripts',
      'benchmark-resolver-v3-representative-hybrid.mjs',
    );
    const source = fs.readFileSync(cliPath, 'utf8');
    expect(source).not.toMatch(/args\.includes\(['"]--live['"]\)/);
    expect(source).not.toMatch(/ANTHROPIC_API_KEY|OPENAI_API_KEY/);
  });

  it('no package.json/lockfile change was made for this task', () => {
    const pkg = fs.readFileSync(path.join(repoRoot, 'package.json'), 'utf8');
    expect(pkg).not.toMatch(/representative-hybrid/i);
  });

  it('no feature-flag file references this benchmark', () => {
    const featureFlagFiles = [
      'src/infrastructure/config/FeatureFlags.ts',
      'src/config/FeatureFlags.ts',
    ];
    for (const relPath of featureFlagFiles) {
      const fullPath = path.join(repoRoot, relPath);
      if (!fs.existsSync(fullPath)) continue;
      const source = fs.readFileSync(fullPath, 'utf8');
      expect(source).not.toMatch(/RepresentativeHybridV1/);
    }
  });
});
