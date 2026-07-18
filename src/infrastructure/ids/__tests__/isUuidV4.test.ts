import { isUuidV4 } from '../isUuidV4';

describe('isUuidV4', () => {
  it('accepts canonical UUIDv4 strings', () => {
    expect(isUuidV4('11111111-1111-4111-8111-111111111111')).toBe(true);
    expect(isUuidV4('550e8400-e29b-41d4-a716-446655440000')).toBe(true);
    // variant nibble may be 8/9/a/b
    expect(isUuidV4('11111111-1111-4111-9111-111111111111')).toBe(true);
    expect(isUuidV4('11111111-1111-4111-a111-111111111111')).toBe(true);
    expect(isUuidV4('11111111-1111-4111-b111-111111111111')).toBe(true);
  });

  it('is case-insensitive', () => {
    expect(isUuidV4('550E8400-E29B-41D4-A716-446655440000')).toBe(true);
  });

  it('rejects legacy timestamp+random ids', () => {
    expect(isUuidV4('lz3k9f2a-8h2j3k1l9')).toBe(false);
    expect(isUuidV4('entry-1')).toBe(false);
    expect(isUuidV4('test-id-0')).toBe(false);
  });

  it('rejects a wrong UUID version (e.g. v1)', () => {
    expect(isUuidV4('11111111-1111-1111-8111-111111111111')).toBe(false);
  });

  it('rejects a wrong variant nibble', () => {
    expect(isUuidV4('11111111-1111-4111-c111-111111111111')).toBe(false);
    expect(isUuidV4('11111111-1111-4111-0111-111111111111')).toBe(false);
  });

  it('rejects malformed lengths/separators', () => {
    expect(isUuidV4('11111111-1111-4111-8111-11111111111')).toBe(false); // one char short
    expect(isUuidV4('111111111111411181111111111111111')).toBe(false); // no dashes
    expect(isUuidV4('')).toBe(false);
  });
});
