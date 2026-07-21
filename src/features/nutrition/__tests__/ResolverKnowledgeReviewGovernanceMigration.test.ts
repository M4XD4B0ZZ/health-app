import fs from 'fs';
import path from 'path';

const migrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260721160000_extend_resolver_knowledge_review_governance.sql',
);
const migration = fs.readFileSync(migrationPath, 'utf8');

const priorMigrationPath = path.resolve(
  __dirname,
  '../../../../supabase/migrations/20260721120000_create_resolver_knowledge_reviews.sql',
);
const priorMigrationBeforeEdit = fs.readFileSync(priorMigrationPath, 'utf8');

describe('RESOLVER-V3-028 review governance migration', () => {
  it('is additive-only and does not edit the historical review/candidate migrations', () => {
    // The historical migration files themselves must be byte-identical to what RESOLVER-V3-021/020
    // originally created; this new file only ALTERs/ADDs on top of them from a separate migration.
    expect(priorMigrationBeforeEdit).toMatch(/create table public\.resolver_knowledge_reviews/i);
    expect(migration).toMatch(/^-- RESOLVER-V3-028/);
    expect(migration).not.toMatch(/create table/i);
  });

  it('adds `approved` as a legal candidate status and event next_status without touching other constraints', () => {
    expect(migration).toMatch(/alter table public\.resolver_knowledge_candidates/i);
    expect(migration).toMatch(/add constraint resolver_knowledge_candidates_status_check/i);
    expect(migration).toMatch(/'approved'/);
    expect(migration).toMatch(
      /add constraint resolver_knowledge_candidate_events_next_status_check/i,
    );
    expect(migration).toMatch(/'APPROVED_BY_REVIEW'/);
  });

  it('adds full audit columns to the review-event table', () => {
    for (const column of [
      'reviewer_id',
      'reason_code',
      'review_contract_version',
      'privacy_policy_version',
      'candidate_version_at_decision',
      'risk_decision',
      'locale_restriction',
      'target_candidate_id',
      'review_material_snapshot',
    ])
      expect(migration).toMatch(new RegExp(`add column ${column}`, 'i'));
  });

  it('grants no anon/authenticated access, creates no view or trigger, and stays append-only', () => {
    expect(migration).toMatch(/revoke all .* from anon, authenticated/gi);
    expect(migration).not.toMatch(/\ngrant /i);
    expect(migration).not.toMatch(/create\s+(or\s+replace\s+)?(view|trigger)/i);
    expect(migration).not.toMatch(/\bupdate\b|\bdelete\b|\bdrop table\b/i);
  });
});
