import fs from 'fs';
import path from 'path';

const migrationsDir = path.join(__dirname, '../../../../supabase/migrations');
const migrationPath = path.join(
  migrationsDir,
  '20260721150000_harden_personal_resolution_memory_audit_append_only.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');
const migrationSql = migration
  .split('\n')
  .filter((line) => !line.trim().startsWith('--'))
  .join('\n');
const priorMigrationPath = path.join(
  migrationsDir,
  '20260720130000_create_personal_resolution_memory.sql',
);
const priorMigration = fs.readFileSync(priorMigrationPath, 'utf8');

describe('RESOLVER-V3-026 audit append-only hardening migration', () => {
  it('uses a unique, reserved timestamp-prefixed migration version', () => {
    expect(path.basename(migrationPath)).toMatch(/^20260721150000_/);
    const versions = fs
      .readdirSync(migrationsDir)
      .filter((file) => file.endsWith('.sql'))
      .map((file) => file.split('_')[0]);
    expect(new Set(versions).size).toBe(versions.length);
  });

  it('revokes update and delete on the audit-event table only, from authenticated', () => {
    expect(migrationSql).toMatch(
      /revoke update, delete on public\.personal_resolution_memory_events from authenticated/i,
    );
    expect(migrationSql).not.toMatch(/personal_resolution_memories\b(?!_events)/);
  });

  it('does not touch RLS, policies, grants, or anon access', () => {
    expect(migrationSql).not.toMatch(/enable row level security/i);
    expect(migrationSql).not.toMatch(/create (or replace )?policy/i);
    expect(migrationSql).not.toMatch(/\bgrant\b/i);
    expect(migrationSql).not.toMatch(/\banon\b/i);
  });

  it('is additive-only: no drop, truncate, or delete-from statement', () => {
    expect(migrationSql).not.toMatch(/\bdrop\b/i);
    expect(migrationSql).not.toMatch(/\btruncate\b/i);
    expect(migrationSql).not.toMatch(/\bdelete from\b/i);
  });

  it('leaves the historical RESOLVER-V3-017 migration file completely unchanged', () => {
    expect(priorMigration).toMatch(
      /grant select,insert,update,delete on public\.personal_resolution_memories, public\.personal_resolution_memory_events to authenticated/i,
    );
  });
});
