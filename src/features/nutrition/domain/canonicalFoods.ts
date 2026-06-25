export interface CanonicalFood {
  id: string;
  aliases: {
    de: string[];
    en: string[];
  };
  defaultPortion?: {
    unit: 'piece' | 'gram';
    grams?: number;
  };
  sourceQueries: {
    usda: string;
    off: string;
  };
}

export const CANONICAL_FOODS: CanonicalFood[] = [
  {
    id: 'egg',
    aliases: {
      de: ['ei', 'eier'],
      en: ['egg', 'eggs'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 60,
    },
    sourceQueries: {
      usda: 'egg',
      off: 'egg',
    },
  },
  {
    id: 'milk',
    aliases: {
      de: ['milch'],
      en: ['milk'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 244,
    },
    sourceQueries: {
      usda: 'milk',
      off: 'milk',
    },
  },
  {
    id: 'butter',
    aliases: {
      de: ['butter'],
      en: ['butter'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 14,
    },
    sourceQueries: {
      usda: 'butter',
      off: 'butter',
    },
  },
  {
    id: 'bread',
    aliases: {
      de: ['brot'],
      en: ['bread'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 30,
    },
    sourceQueries: {
      usda: 'bread',
      off: 'bread',
    },
  },
  {
    id: 'quark',
    aliases: {
      de: ['quark'],
      en: ['quark'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 100,
    },
    sourceQueries: {
      usda: 'quark',
      off: 'quark',
    },
  },
  {
    id: 'yogurt',
    aliases: {
      de: ['joghurt', 'yoghurt'],
      en: ['yogurt', 'yoghurt'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 150,
    },
    sourceQueries: {
      usda: 'yogurt',
      off: 'yogurt',
    },
  },
  {
    id: 'cheese',
    aliases: {
      de: ['käse'],
      en: ['cheese'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 30,
    },
    sourceQueries: {
      usda: 'cheese',
      off: 'cheese',
    },
  },
  {
    id: 'ham',
    aliases: {
      de: ['schinken'],
      en: ['ham'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 30,
    },
    sourceQueries: {
      usda: 'ham',
      off: 'ham',
    },
  },
  {
    id: 'chicken',
    aliases: {
      de: ['hähnchen', 'huhn'],
      en: ['chicken'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 120,
    },
    sourceQueries: {
      usda: 'chicken',
      off: 'chicken',
    },
  },
  {
    id: 'beef',
    aliases: {
      de: ['rindfleisch'],
      en: ['beef'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 120,
    },
    sourceQueries: {
      usda: 'beef',
      off: 'beef',
    },
  },
  {
    id: 'rice',
    aliases: {
      de: ['reis'],
      en: ['rice'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 150,
    },
    sourceQueries: {
      usda: 'rice',
      off: 'rice',
    },
  },
  {
    id: 'pasta',
    aliases: {
      de: ['nudeln'],
      en: ['pasta', 'noodles'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 140,
    },
    sourceQueries: {
      usda: 'pasta',
      off: 'pasta',
    },
  },
  {
    id: 'potato',
    aliases: {
      de: ['kartoffel', 'kartoffeln'],
      en: ['potato', 'potatoes'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 150,
    },
    sourceQueries: {
      usda: 'potato',
      off: 'potato',
    },
  },
  {
    id: 'apple',
    aliases: {
      de: ['apfel', 'äpfel'],
      en: ['apple', 'apples'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 150,
    },
    sourceQueries: {
      usda: 'apple',
      off: 'apple',
    },
  },
  {
    id: 'banana',
    aliases: {
      de: ['banane', 'bananen'],
      en: ['banana', 'bananas'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 120,
    },
    sourceQueries: {
      usda: 'banana',
      off: 'banana',
    },
  },
  {
    id: 'tomato',
    aliases: {
      de: ['tomate', 'tomaten'],
      en: ['tomato', 'tomatoes'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 100,
    },
    sourceQueries: {
      usda: 'tomato',
      off: 'tomato',
    },
  },
  {
    id: 'radish',
    aliases: {
      de: ['radieschen'],
      en: ['radish', 'radishes'],
    },
    sourceQueries: {
      usda: 'radish',
      off: 'radieschen',
    },
  },
  {
    id: 'onion',
    aliases: {
      de: ['zwiebel', 'zwiebeln'],
      en: ['onion', 'onions'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 70,
    },
    sourceQueries: {
      usda: 'onion',
      off: 'onion',
    },
  },
  {
    id: 'olive_oil',
    aliases: {
      de: ['olivenöl'],
      en: ['olive oil'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 13,
    },
    sourceQueries: {
      usda: 'olive oil',
      off: 'olive oil',
    },
  },
  {
    id: 'sugar',
    aliases: {
      de: ['zucker'],
      en: ['sugar'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 4,
    },
    sourceQueries: {
      usda: 'sugar',
      off: 'sugar',
    },
  },
  {
    id: 'salt',
    aliases: {
      de: ['salz'],
      en: ['salt'],
    },
    defaultPortion: {
      unit: 'gram',
      grams: 5,
    },
    sourceQueries: {
      usda: 'salt',
      off: 'salt',
    },
  },
  {
    id: 'toast',
    aliases: {
      de: ['toast'],
      en: ['toast', 'buttered toast'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 35,
    },
    sourceQueries: {
      usda: 'toast',
      off: 'toast',
    },
  },
  {
    id: 'buttertoast',
    aliases: {
      de: ['buttertoast'],
      en: ['buttered toast'],
    },
    defaultPortion: {
      unit: 'piece',
      grams: 40,
    },
    sourceQueries: {
      usda: 'buttered toast',
      off: 'buttertoast',
    },
  },
];
