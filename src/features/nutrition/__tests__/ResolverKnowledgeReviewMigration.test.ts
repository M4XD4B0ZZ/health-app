import fs from 'fs';
import path from 'path';
const migration = fs.readFileSync(
  path.resolve(
    __dirname,
    '../../../../supabase/migrations/20260721120000_create_resolver_knowledge_reviews.sql',
  ),
  'utf8',
);
describe('RESOLVER-V3-021 review migration', () => {
  it('uses the reserved timestamp and isolates server-only append-only curated review state', () => {
    expect(migration).toMatch(
      /resolver_knowledge_reviews|approved_resolver_knowledge|resolver_knowledge_review_events/i,
    );
    expect(migration).toMatch(/enable row level security/gi);
    expect(migration).toMatch(/revoke all .* from anon, authenticated/gi);
    expect(migration).not.toMatch(
      /\ngrant |\btrigger\b|\bview\b|food_resolver_runs|resolver_observations/i,
    );
  });
});
