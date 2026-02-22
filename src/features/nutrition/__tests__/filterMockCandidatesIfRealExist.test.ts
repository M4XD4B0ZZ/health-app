import { filterMockCandidatesIfRealExist } from '../application/services/resolver/filterMockCandidatesIfRealExist';
import {
  ResolverSourceLabel,
  RESOLVER_SOURCE_LABELS,
} from '../application/services/ResolverSourceLabel';

type Candidate = {
  id: string;
  source: ResolverSourceLabel;
};

describe('filterMockCandidatesIfRealExist', () => {
  it('[OFF, MOCK_OFF] keeps only OFF', () => {
    const candidates: Candidate[] = [
      { id: '1', source: RESOLVER_SOURCE_LABELS.OFF },
      { id: '2', source: RESOLVER_SOURCE_LABELS.MOCK_OFF },
    ];

    const filtered = filterMockCandidatesIfRealExist(candidates);
    expect(filtered).toEqual([{ id: '1', source: RESOLVER_SOURCE_LABELS.OFF }]);
  });

  it('[USDA, MOCK_USDA] keeps only USDA', () => {
    const candidates: Candidate[] = [
      { id: '1', source: RESOLVER_SOURCE_LABELS.USDA },
      { id: '2', source: RESOLVER_SOURCE_LABELS.MOCK_USDA },
    ];

    const filtered = filterMockCandidatesIfRealExist(candidates);
    expect(filtered).toEqual([{ id: '1', source: RESOLVER_SOURCE_LABELS.USDA }]);
  });

  it('[MOCK_OFF, MOCK_USDA] remains unchanged', () => {
    const candidates: Candidate[] = [
      { id: '1', source: RESOLVER_SOURCE_LABELS.MOCK_OFF },
      { id: '2', source: RESOLVER_SOURCE_LABELS.MOCK_USDA },
    ];

    const filtered = filterMockCandidatesIfRealExist(candidates);
    expect(filtered).toEqual(candidates);
  });

  it('[] returns []', () => {
    expect(filterMockCandidatesIfRealExist([])).toEqual([]);
  });
});
