import { applyIdMap } from '../applyIdMap';

interface Fixture {
  id: string;
  label: string;
}

describe('applyIdMap (ACC-003: deterministic id-map application)', () => {
  it('rewrites the id of every record present in the map', () => {
    const records: Fixture[] = [
      { id: 'old-1', label: 'a' },
      { id: 'old-2', label: 'b' },
    ];
    const idMap = { 'old-1': 'new-1', 'old-2': 'new-2' };

    const result = applyIdMap(records, idMap);

    expect(result[0]).toEqual({ id: 'new-1', label: 'a' });
    expect(result[1]).toEqual({ id: 'new-2', label: 'b' });
  });

  it('leaves a record unchanged (same reference) when its id is not a key in the map', () => {
    const untouched: Fixture = { id: 'already-migrated', label: 'x' };
    const result = applyIdMap([untouched], { 'old-1': 'new-1' });

    expect(result[0]).toBe(untouched);
  });

  it('never generates a new id — it is purely a deterministic lookup', () => {
    const records: Fixture[] = [{ id: 'old-1', label: 'a' }];
    const first = applyIdMap(records, { 'old-1': 'new-1' });
    const second = applyIdMap(records, { 'old-1': 'new-1' });

    expect(first).toEqual(second);
  });

  it('handles an empty records array', () => {
    expect(applyIdMap([], { a: 'b' })).toEqual([]);
  });

  it('handles an empty map (no-op for every record)', () => {
    const records: Fixture[] = [{ id: 'old-1', label: 'a' }];
    expect(applyIdMap(records, {})).toEqual(records);
  });
});
