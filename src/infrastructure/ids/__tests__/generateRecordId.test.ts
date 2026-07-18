import { generateRecordId } from '../generateRecordId';
import { isUuidV4 } from '../isUuidV4';

describe('generateRecordId (ACC-003: central UUIDv4 generation boundary)', () => {
  it('produces canonical UUIDv4 values', () => {
    const id = generateRecordId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
  });

  it('produces version 4 and valid variant bits', () => {
    const id = generateRecordId();
    expect(isUuidV4(id)).toBe(true);

    // Explicit, independent check of the version/variant nibbles (not just re-running the
    // same regex isUuidV4 uses internally).
    const [, , versionGroup, variantGroup] = id.split('-');
    expect(versionGroup[0]).toBe('4');
    expect(['8', '9', 'a', 'b']).toContain(variantGroup[0].toLowerCase());
  });

  it('produces distinct ids on rapid consecutive calls, without any clock/timing dependence', () => {
    const ids = new Set(Array.from({ length: 500 }, () => generateRecordId()));
    expect(ids.size).toBe(500);
  });

  it('does not encode ordering or creation time in the id', () => {
    // Two ids generated back-to-back must not be lexicographically or numerically ordered by
    // generation time — RFC4122 v4 is fully random beyond its version/variant bits, unlike a
    // ULID or a timestamp-prefixed id.
    const first = generateRecordId();
    const second = generateRecordId();
    expect(first).not.toBe(second);
    // No shared prefix that would suggest a monotonic/timestamp-based scheme.
    expect(first.slice(0, 8)).not.toBe(second.slice(0, 8));
  });
});
