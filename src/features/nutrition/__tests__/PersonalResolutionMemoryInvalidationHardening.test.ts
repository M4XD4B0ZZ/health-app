import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(__dirname, '../../../../supabase/migrations');
const migrationPath = path.join(
  migrationsDir,
  '20260721140000_harden_personal_resolution_memory_invalidation.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const priorMigrationPath = path.join(
  migrationsDir,
  '20260721110000_add_personal_resolution_memory_invalidation.sql',
);
const priorMigration = fs.readFileSync(priorMigrationPath, 'utf8');

describe('RESOLVER-V3-027 invalidation hardening migration', () => {
  it('uses the reserved RESOLVER-V3-027 timestamp prefix and a unique migration version', () => {
    expect(path.basename(migrationPath)).toMatch(/^20260721140000_/);
    const versions = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => file.split('_')[0]);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('adds a composite foreign key from both dependency sides to personal_resolution_memories', () => {
    expect(migration).toMatch(
      /foreign key \(owner_id, memory_id\)\s+references public\.personal_resolution_memories \(owner_id, memory_id\)/i,
    );
    expect(migration).toMatch(
      /foreign key \(owner_id, depends_on_memory_id\)\s+references public\.personal_resolution_memories \(owner_id, memory_id\)/i,
    );
  });

  it('cascades both foreign keys on delete, preserving account/memory cascade', () => {
    const cascadeCount = (migration.match(/on delete cascade/gi) ?? []).length;
    expect(cascadeCount).toBe(2);
  });

  it('does not grant anon access or introduce a global view/activation', () => {
    expect(migration).not.toMatch(/\banon\b/i);
    expect(migration).not.toMatch(/create (or replace )?view/i);
    expect(migration).not.toMatch(/grant/i);
    expect(migration).not.toMatch(/create policy/i);
  });

  it('does not touch RLS directly (already enabled by the prior migration) or add new authenticated grants', () => {
    expect(migration).not.toMatch(/enable row level security/i);
    expect(migration).not.toMatch(/\bauthenticated\b/i);
  });

  it('is additive-only: no drop, truncate, or delete statement', () => {
    expect(migration).not.toMatch(/\bdrop\b/i);
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete from\b/i);
  });

  it('leaves the historical RESOLVER-V3-018 migration file completely unchanged', () => {
    expect(priorMigration).toMatch(/personal_resolution_memory_dependencies/i);
    expect(priorMigration).not.toMatch(/references public\.personal_resolution_memories/i);
  });
});
