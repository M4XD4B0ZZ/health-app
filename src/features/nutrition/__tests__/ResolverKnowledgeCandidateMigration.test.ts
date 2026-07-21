import fs from 'fs';
import path from 'path';
const migration = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260720130000_create_resolver_knowledge_candidates.sql',
  ),
  'utf8',
);
describe('RESOLVER-V3-020 candidate migration', () => {
  it('creates only inactive candidate and append-only event tables without app grants, views, or activation', () => {
    expect(migration).toMatch(/create table public\.resolver_knowledge_candidates/i);
    expect(migration).toMatch(/create table public\.resolver_knowledge_candidate_events/i);
    expect(migration).toMatch(/fingerprint text not null unique/i);
    expect(migration).toMatch(/enable row level security/gi);
    expect(migration).toMatch(/revoke all .* from anon, authenticated/gi);
    expect(migration).not.toMatch(/\ngrant /i);
    expect(migration).not.toMatch(
      /create .*view|\n.*trigger|approved|resolver_observations|food_resolver_runs/i,
    );
  });
});
