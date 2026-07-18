import { assignMissingUuids } from '../assignMissingUuids';
import { isUuidV4 } from '../isUuidV4';

interface Fixture {
  id: string;
  label: string;
}

describe('assignMissingUuids (ACC-003: pure migration core)', () => {
  it('assigns a fresh UUIDv4 to every record with a legacy (non-UUID) id', () => {
    const records: Fixture[] = [
      { id: 'legacy-1', label: 'a' },
      { id: 'legacy-2', label: 'b' },
    ];

    const result = assignMissingUuids(records);

    expect(result.changed).toBe(true);
    expect(result.records).toHaveLength(2);
    expect(isUuidV4(result.records[0].id)).toBe(true);
    expect(isUuidV4(result.records[1].id)).toBe(true);
    expect(result.records[0].id).not.toBe(result.records[1].id);
    // Non-id fields are preserved unchanged.
    expect(result.records[0].label).toBe('a');
    expect(result.records[1].label).toBe('b');
  });

  it('leaves a record with an already-valid UUIDv4 completely untouched', () => {
    const alreadyMigrated: Fixture = {
      id: '11111111-1111-4111-8111-111111111111',
      label: 'unchanged',
    };
    const records: Fixture[] = [alreadyMigrated, { id: 'legacy-1', label: 'to-migrate' }];

    const result = assignMissingUuids(records);

    expect(result.records[0]).toBe(alreadyMigrated); // same reference, not even a copy
    expect(result.records[0].id).toBe('11111111-1111-4111-8111-111111111111');
    expect(isUuidV4(result.records[1].id)).toBe(true);
  });

  it('reports changed:false and an empty idMap when every record already has a valid UUIDv4', () => {
    const records: Fixture[] = [
      { id: '11111111-1111-4111-8111-111111111111', label: 'a' },
      { id: '22222222-2222-4222-8222-222222222222', label: 'b' },
    ];

    const result = assignMissingUuids(records);

    expect(result.changed).toBe(false);
    expect(result.idMap).toEqual({});
    expect(result.duplicateLegacyIds).toEqual([]);
    expect(result.records).toEqual(records);
  });

  it('builds an old-id -> new-id map usable to rewrite external references', () => {
    const records: Fixture[] = [{ id: 'legacy-1', label: 'a' }];

    const result = assignMissingUuids(records);

    expect(Object.keys(result.idMap)).toEqual(['legacy-1']);
    expect(result.idMap['legacy-1']).toBe(result.records[0].id);
  });

  it('handles an empty input without error', () => {
    const result = assignMissingUuids([]);
    expect(result.records).toEqual([]);
    expect(result.idMap).toEqual({});
    expect(result.duplicateLegacyIds).toEqual([]);
    expect(result.changed).toBe(false);
  });

  it('gives every record its own independent UUIDv4 even if several share the same legacy id (duplicate handling)', () => {
    const records: Fixture[] = [
      { id: 'dup', label: 'first' },
      { id: 'dup', label: 'second' },
    ];

    const result = assignMissingUuids(records);

    expect(result.records[0].id).not.toBe(result.records[1].id); // no post-migration duplicate
    expect(isUuidV4(result.records[0].id)).toBe(true);
    expect(isUuidV4(result.records[1].id)).toBe(true);
    expect(result.duplicateLegacyIds).toEqual(['dup']);
    // idMap keeps only the first occurrence's mapping — documented, intentional.
    expect(result.idMap['dup']).toBe(result.records[0].id);
  });

  it('is deterministic in the sense that re-running on the (now-migrated) output is a no-op', () => {
    const first = assignMissingUuids([{ id: 'legacy-1', label: 'a' }]);
    const second = assignMissingUuids(first.records);

    expect(second.changed).toBe(false);
    expect(second.records).toEqual(first.records);
  });
});
