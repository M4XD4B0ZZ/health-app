import { isDebugLoggingEnabled } from '../../../../../infrastructure/config/appEnv';

const DE_EN_ALIASES: Record<string, string> = {
    'ei': 'egg',
    'eier': 'egg',
    'apfel': 'apple',
    'äpfel': 'apple',
    'banane': 'banana',
    'bananen': 'banana',
    'milch': 'milk',
    'hähnchen': 'chicken breast',
    'haehnchen': 'chicken breast',
    'hähnchenbrust': 'chicken breast',
    'reis': 'rice',
    'kartoffel': 'potato',
    'kartoffeln': 'potato',
    'brot': 'bread',
    'brötchen': 'bread roll',
    'quark': 'curd',
    'joghurt': 'yogurt',
    'tomate': 'tomato',
    'tomaten': 'tomato',
    'gurke': 'cucumber',
    'käse': 'cheese',
    'kaese': 'cheese',
    'schweinefleisch': 'pork',
    'rindfleisch': 'beef',
    'butter': 'butter',
    'haferflocken': 'oats',
    'nudeln': 'pasta',
    'erdbeere': 'strawberry',
    'erdbeeren': 'strawberry',
};

export interface NormalizeQueryArgs {
    query: string;
    locale: string;
    sourceName: string;
    traceId?: string;
}

export function normalizeQueryForSources({
    query,
    locale,
    sourceName,
    traceId,
}: NormalizeQueryArgs): string {
    if (!locale.toLowerCase().startsWith('de')) {
        return query;
    }

    // Only translate for USDA, OFF handles localized names well
    if (sourceName !== 'usda') {
        return query;
    }

    const alias = DE_EN_ALIASES[query.toLowerCase()];

    if (alias) {
        if (isDebugLoggingEnabled() && traceId) {
            console.log(`[${traceId}] ALIAS_MAP source=usda locale=${locale} original="${query}" mapped="${alias}"`);
        }
        return alias;
    }

    return query;
}
