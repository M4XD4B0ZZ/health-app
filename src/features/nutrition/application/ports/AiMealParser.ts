import { AiParsedMeal } from '../../domain/models/AiMealTypes';

/**
 * Application Port: AI Meal Parser
 *
 * LLM-agnostische Schnittstelle für AI-basiertes Parsing von komplexen Mahlzeiten.
 * Implementierungen können verschiedene LLM-Backends nutzen (OpenAI, Claude, Ollama, etc.)
 */
export interface AiMealParser {
  parseMeal(rawInput: string): Promise<AiParsedMeal>;
}
