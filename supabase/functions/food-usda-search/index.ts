import {
  AppError,
  computeExpiresAt,
  corsHeaders,
  determineWinner,
  errorResponse,
  getTraceId,
  jsonResponse,
  loadItemsByIds,
  loadValidCache,
  type CanonicalFoodItem,
  upsertCatalogItems,
  upsertQueryCache,
} from "../_shared/food-cache.ts";
import { normalizeQuery } from "../_shared/normalize.ts";
import { validateQuery, checkRateLimit, logAbuse } from "../_shared/guardrails.ts";

const POSITIVE_TTL_SECONDS = 60 * 60 * 24;
const NEGATIVE_TTL_SECONDS = 60 * 15;
const USDA_SOURCE = "usda" as const;
const USDA_PAGE_SIZE = 10;

interface SearchRequest {
  mode?: "health" | string;
  query?: string;
  locale?: string;
}

interface UsdaNutrient {
  nutrientNumber?: string;
  nutrientName?: string;
  value?: number;
}

interface UsdaFood {
  fdcId?: number;
  description?: string;
  brandOwner?: string;
  foodNutrients?: UsdaNutrient[];
}

interface UsdaSearchResponse {
  foods?: UsdaFood[];
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function localeFromBody(body: SearchRequest): string {
  const locale = body.locale?.trim().toLowerCase();
  return locale && locale.length > 0 ? locale : "en";
}

function parseBody(body: SearchRequest): { query: string; locale: string } {
  const query = body.query?.trim() ?? "";
  if (!query) {
    throw new AppError("INVALID_QUERY", "query must be a non-empty string", 400);
  }
  return { query, locale: localeFromBody(body) };
}

function nutrientValueByNumber(
  nutrients: UsdaNutrient[] | undefined,
  nutrientNumber: string,
): number | null {
  if (!nutrients) {
    return null;
  }
  const found = nutrients.find((n) => n.nutrientNumber === nutrientNumber);
  if (!found || typeof found.value !== "number" || !Number.isFinite(found.value)) {
    return null;
  }
  return found.value;
}

function mapUsdaToCanonical(
  foods: UsdaFood[],
  normalizedQuery: string,
  locale: string,
): CanonicalFoodItem[] {
  const nowIso = new Date().toISOString();
  const mapped: CanonicalFoodItem[] = [];

  for (const food of foods) {
    if (!food.fdcId || !food.description) {
      continue;
    }

    const name = food.description.trim();
    if (!name) {
      continue;
    }

    const nameNormalized = normalizeQuery(name);
    const exact = nameNormalized === normalizedQuery;
    const contains = nameNormalized.includes(normalizedQuery);
    const starts = nameNormalized.startsWith(normalizedQuery);
    const confidence = clamp01(
      0.58 + (exact ? 0.34 : 0) + (starts ? 0.08 : 0) + (contains ? 0.03 : 0),
    );

    const macros = {
      kcal: nutrientValueByNumber(food.foodNutrients, "208") ?? 0,
      protein: nutrientValueByNumber(food.foodNutrients, "203") ?? 0,
      carbs: nutrientValueByNumber(food.foodNutrients, "205") ?? 0,
      fat: nutrientValueByNumber(food.foodNutrients, "204") ?? 0,
    };

    const micros: Record<string, number> = {};
    const fiber = nutrientValueByNumber(food.foodNutrients, "291");
    const sugars = nutrientValueByNumber(food.foodNutrients, "269");
    const sodium = nutrientValueByNumber(food.foodNutrients, "307");
    if (fiber !== null) micros.fiber = fiber;
    if (sugars !== null) micros.sugars = sugars;
    if (sodium !== null) micros.sodium = sodium;

    mapped.push({
      canonical_name: name,
      brand: food.brandOwner?.trim() || null,
      source: USDA_SOURCE,
      external_id: String(food.fdcId),
      locale,
      macros_per_100g: macros,
      micros_per_100g: Object.keys(micros).length > 0 ? micros : null,
      confidence,
      last_verified_at: nowIso,
    });
  }

  return mapped;
}

async function fetchFromUsda(
  query: string,
  locale: string,
  normalizedQuery: string,
): Promise<CanonicalFoodItem[]> {
  const apiKey = Deno.env.get("USDA_API_KEY");
  if (!apiKey) {
    throw new AppError("MISSING_ENV", "Missing required env var USDA_API_KEY", 500);
  }

  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query,
        pageSize: USDA_PAGE_SIZE,
      }),
    },
  );

  if (!response.ok) {
    throw new AppError("USDA_FETCH_FAILED", `USDA returned ${response.status}`, 500);
  }

  const payload = await response.json() as UsdaSearchResponse;
  const foods = payload.foods ?? [];
  return mapUsdaToCanonical(foods, normalizedQuery, locale);
}

async function validateUsdaKey(apiKey: string): Promise<boolean> {
  const response = await fetch(
    `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        query: "apple",
        pageSize: 1,
      }),
      signal: AbortSignal.timeout(1200),
    },
  );

  return response.ok;
}

Deno.serve(async (req: Request) => {
  const traceId = getTraceId(req);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders() });
  }

  try {
    if (req.method !== "POST") {
      throw new AppError("METHOD_NOT_ALLOWED", "Only POST is supported", 405);
    }

    const t0 = performance.now();
    const rateLimit = await checkRateLimit(req);
    if (!rateLimit.allowed) {
      logAbuse({
        traceId,
        clientKey: rateLimit.clientKey,
        queryLength: 0,
        functionName: "food-usda-search",
        reason: "Rate limit exceeded",
        latencyMs: performance.now() - t0,
        action: "DENY_RATE_LIMIT",
      });
      return new Response(JSON.stringify({ error: "RATE_LIMITED", retryAfterSec: rateLimit.retryAfterSec }), {
        status: 429,
        headers: {
          ...corsHeaders(),
          "Content-Type": "application/json",
          "Retry-After": String(rateLimit.retryAfterSec),
        },
      });
    }

    let body: SearchRequest;
    try {
      body = await req.json() as SearchRequest;
    } catch {
      throw new AppError("INVALID_JSON", "Request body must be valid JSON", 400);
    }

    if (body.mode === "health") {
      const apiKey = Deno.env.get("USDA_API_KEY");
      if (!apiKey) {
        return jsonResponse(
          {
            ok: false,
            error: "USDA_API_KEY_MISSING",
            traceId,
          },
          200,
          traceId,
        );
      }

      try {
        const valid = await validateUsdaKey(apiKey);
        if (!valid) {
          return jsonResponse(
            {
              ok: false,
              error: "USDA_KEY_INVALID_OR_UPSTREAM_ERROR",
              traceId,
            },
            200,
            traceId,
          );
        }

        return jsonResponse(
          {
            ok: true,
            keyPresent: true,
            traceId,
          },
          200,
          traceId,
        );
      } catch {
        return jsonResponse(
          {
            ok: false,
            error: "USDA_KEY_INVALID_OR_UPSTREAM_ERROR",
            traceId,
          },
          200,
          traceId,
        );
      }
    }

    const { query, locale } = parseBody(body);

    const guard = validateQuery(query);
    if (!guard.isValid) {
      logAbuse({
        traceId,
        clientKey: rateLimit.clientKey,
        queryLength: query.length,
        functionName: "food-usda-search",
        reason: guard.errorReason || "Bad query",
        latencyMs: performance.now() - t0,
        action: "DENY_BAD_QUERY",
      });
      return new Response(JSON.stringify({ error: "BAD_QUERY", message: guard.errorReason }), {
        status: 400,
        headers: { ...corsHeaders(), "Content-Type": "application/json" },
      });
    }

    const normalizedQuery = normalizeQuery(guard.normalizedQuery);
    if (!normalizedQuery) {
      throw new AppError("INVALID_QUERY", "query becomes empty after normalization", 400);
    }

    const cached = await loadValidCache(normalizedQuery, locale, USDA_SOURCE, traceId);
    if (cached) {
      if (cached.cache_type === "negative") {
        return jsonResponse(
          {
            type: "cache",
            cacheType: "negative",
            results: [],
            normalizedQuery,
            locale,
            traceId,
          },
          200,
          traceId,
        );
      }

      const ids = cached.result_item_ids ?? [];
      const items = await loadItemsByIds(ids, traceId);
      return jsonResponse(
        {
          type: "cache",
          cacheType: "positive",
          items,
          normalizedQuery,
          locale,
          traceId,
        },
        200,
        traceId,
      );
    }

    const externalItems = await fetchFromUsda(query, locale, normalizedQuery);
    const upsertedItems = await upsertCatalogItems(externalItems, traceId);
    const winner = determineWinner(upsertedItems);
    const cacheType = upsertedItems.length > 0 ? "positive" : "negative";

    await upsertQueryCache({
      normalized_query: normalizedQuery,
      locale,
      source: USDA_SOURCE,
      cache_type: cacheType,
      winner_source: winner?.source ?? null,
      winner_confidence: winner?.confidence ?? null,
      result_item_ids: upsertedItems.map((item) => item.id!).filter(Boolean),
      expires_at: computeExpiresAt(
        cacheType === "positive" ? POSITIVE_TTL_SECONDS : NEGATIVE_TTL_SECONDS,
      ),
    }, traceId);

    return jsonResponse(
      {
        type: "fresh",
        items: upsertedItems,
        winner: winner
          ? {
            itemId: winner.id ?? null,
            source: winner.source,
            confidence: winner.confidence,
          }
          : null,
        normalizedQuery,
        locale,
        traceId,
      },
      200,
      traceId,
    );
  } catch (error) {
    const handledError = error instanceof AppError
      ? error
      : new AppError("INTERNAL_ERROR", "Unexpected internal error", 500);

    console.error("[food-usda-search]", {
      traceId,
      code: handledError.code,
      message: handledError.message,
    });

    return errorResponse(handledError, traceId);
  }
});
