import fs from 'fs';
import path from 'path';

const migration = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260720120000_create_resolver_observations.sql',
  ),
  'utf8',
);
describe('RESOLVER-V3-015A observation storage migration', () => {
  it('creates only the dedicated private V1 table with required identity and payload boundaries', () => {
    expect(migration).toMatch(/create table public\.resolver_observations/i);
    for (const field of [
      'owner_id uuid not null',
      'observation_id text not null',
      'resolver_run_id text not null',
      'contract_version text not null',
      'occurred_at timestamptz not null',
      'observation_payload jsonb not null',
      'created_at timestamptz not null',
    ])
      expect(migration).toContain(field);
    expect(migration).toMatch(/unique \(owner_id, observation_id\)/);
    expect(migration).toMatch(/contract_version = 'resolver-observation-v1'/);
  });
  it('enables owner-only RLS without update or unrestricted policy paths', () => {
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/grant select, insert, delete .* authenticated/i);
    expect(migration).not.toMatch(/grant .*update.*resolver_observations/i);
    expect(migration).not.toMatch(/for update/i);
    expect(migration).not.toMatch(/using \(true\)|with check \(true\)/i);
    expect((migration.match(/auth\.uid\(\)\) = owner_id/g) ?? []).length).toBe(3);
  });
  it('does not alter legacy telemetry or cache tables', () => {
    expect(migration).not.toMatch(/food_resolver_runs|food_query_cache_results/i);
  });
});
