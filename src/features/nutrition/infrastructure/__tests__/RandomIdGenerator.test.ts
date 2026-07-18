import { RandomIdGenerator, TestIdGenerator } from '../RandomIdGenerator';
import { isUuidV4 } from '../../../../infrastructure/ids/isUuidV4';

describe('RandomIdGenerator (nutrition) — ACC-003', () => {
  it('produces a canonical UUIDv4 via the central generation boundary', () => {
    const generator = new RandomIdGenerator();
    expect(isUuidV4(generator.newId())).toBe(true);
  });

  it('produces distinct ids on rapid consecutive calls, without any clock dependence', () => {
    const generator = new RandomIdGenerator();
    const ids = new Set(Array.from({ length: 200 }, () => generator.newId()));
    expect(ids.size).toBe(200);
  });
});

describe('TestIdGenerator (nutrition) — deterministic injection for tests', () => {
  it('produces predictable, incrementing ids', () => {
    const generator = new TestIdGenerator();
    expect(generator.newId()).toBe('test-id-0');
    expect(generator.newId()).toBe('test-id-1');
  });

  it('resets deterministically', () => {
    const generator = new TestIdGenerator();
    generator.newId();
    generator.newId();
    generator.reset();
    expect(generator.newId()).toBe('test-id-0');
  });
});
