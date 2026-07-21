import fs from 'fs';
import path from 'path';
const migration = fs.readFileSync(
  path.join(
    __dirname,
    '../../../../supabase/migrations/20260721110000_add_personal_resolution_memory_invalidation.sql',
  ),
  'utf8',
);
describe('RESOLVER-V3-018 invalidation migration', () => {
  it('keeps dependencies owner-scoped, cascaded and inaccessible to anon', () => {
    expect(migration).toMatch(/references auth\.users\(id\) on delete cascade/i);
    expect(migration).toMatch(/enable row level security/i);
    expect(migration).toMatch(/revoke all .* from anon/i);
    expect(migration).toMatch(/auth\.uid\(\)\) = owner_id/i);
    expect(migration).not.toMatch(/to public|service_role/i);
  });
  it('adds direct edges and a closed invalidation event category only', () => {
    expect(migration).toMatch(/personal_resolution_memory_dependencies/i);
    expect(migration).toMatch(/unique\(owner_id, memory_id, depends_on_memory_id\)/i);
    expect(migration).toMatch(/'invalidation'/);
  });
});
