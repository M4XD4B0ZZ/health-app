/**
 * AI Meal Parsing Types
 * 
 * LLM-agnostische Types für AI-basiertes Parsing von komplexen Multi-Item-Mahlzeiten.
 */

export type AiQuantityUnit = "g" | "ml" | "piece" | "portion";

export type AiSizeHint = "small" | "medium" | "large";

export interface AiParsedMealItem {
  name: string;
  quantity?: number;
  unit?: AiQuantityUnit;
  sizeHint?: AiSizeHint;
}

export interface AiParsedMeal {
  items: AiParsedMealItem[];
  confidence: number; // 0..1
  explanation: string;
}
