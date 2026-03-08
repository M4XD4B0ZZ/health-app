import { normalizeQueryForSources } from '../application/services/resolver/deEnAliases';

describe('deEnAliases', () => {
    it('maps "ei" to "egg" for USDA with DE locale', () => {
        const result = normalizeQueryForSources({
            query: 'ei',
            locale: 'de-DE',
            sourceName: 'usda',
            traceId: 'test-trace',
        });
        expect(result).toBe('egg');
    });

    it('does NOT map "ei" for OFF with DE locale', () => {
        const result = normalizeQueryForSources({
            query: 'ei',
            locale: 'de-DE',
            sourceName: 'off',
            traceId: 'test-trace',
        });
        expect(result).toBe('ei');
    });

    it('keeps original query if no alias matches for USDA with DE locale', () => {
        const result = normalizeQueryForSources({
            query: 'hackbraten',
            locale: 'de',
            sourceName: 'usda',
        });
        expect(result).toBe('hackbraten');
    });

    it('does NOT map if locale is EN', () => {
        const result = normalizeQueryForSources({
            query: 'ei',
            locale: 'en-US',
            sourceName: 'usda',
        });
        expect(result).toBe('ei');
    });

    it('maps "hähnchen" to "chicken breast" for USDA with DE locale', () => {
        const result = normalizeQueryForSources({
            query: 'hähnchen',
            locale: 'de_AT',
            sourceName: 'usda',
        });
        expect(result).toBe('chicken breast');
    });
});
