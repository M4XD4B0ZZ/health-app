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
const OFF_SOURCE = "off" as const;
const OFF_PAGE_SIZE = 10;

interface SearchRequest {
  query?: string;
  locale?: string;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_en?: string;
  product_name_de?: string;
  brands?: string;
  nutriments?: Record<string, unknown>;
}

interface OffResponse {
  products?: OffProduct[];
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
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

function pickName(product: OffProduct, locale: string): string {
  if (locale === "de") {
    return product.product_name_de || product.product_name || product.product_name_en || "";
  }
  return product.product_name_en || product.product_name || product.product_name_de || "";
}

function mapOffToCanonical(
  products: OffProduct[],
  normalizedQuery: string,
  locale: string,
): CanonicalFoodItem[] {
  const nowIso = new Date().toISOString();
  const mapped: CanonicalFoodItem[] = [];

  for (const product of products) {
    if (!product.code) {
      continue;
    }

    const name = pickName(product, locale).trim();
    if (!name) {
      continue;
    }

    const nameNormalized = normalizeQuery(name);
    const nutriments = product.nutriments ?? {};

    const macros = {
      kcal: toNumber(nutriments["energy-kcal_100g"]) ?? 0,
      protein: toNumber(nutriments["proteins_100g"]) ?? 0,
      carbs: toNumber(nutriments["carbohydrates_100g"]) ?? 0,
      fat: toNumber(nutriments["fat_100g"]) ?? 0,
    };

    const micros: Record<string, number> = {};
    const fiber = toNumber(nutriments["fiber_100g"]);
    const sugars = toNumber(nutriments["sugars_100g"]);
    const sodium = toNumber(nutriments["sodium_100g"]);
    const salt = toNumber(nutriments["salt_100g"]);
    if (fiber !== null) micros.fiber = fiber;
    if (sugars !== null) micros.sugars = sugars;
    if (sodium !== null) micros.sodium = sodium;
    if (salt !== null) micros.salt = salt;

    const exact = nameNormalized === normalizedQuery;
    const contains = nameNormalized.includes(normalizedQuery);
    const starts = nameNormalized.startsWith(normalizedQuery);
    
    // Penalty for branded/processed products when searching for generic canonicals
    const isGenericCanonical = ['egg', 'rice', 'apple', 'butter', 'milk', 'bread'].includes(normalizedQuery);
    const isBrandedProduct = (product.brands && product.brands.trim().length > 0) ||
                            nameNormalized.includes('brand') ||
                            nameNormalized.includes('®') ||
                            nameNormalized.includes('™');
    const brandPenalty = isGenericCanonical && isBrandedProduct ? -0.15 : 0;
    
    const confidence = clamp01(
      0.55 + (exact ? 0.35 : 0) + (starts ? 0.08 : 0) + (contains ? 0.04 : 0) + brandPenalty,
    );

    mapped.push({
      canonical_name: name,
      brand: product.brands?.trim() || null,
      source: OFF_SOURCE,
      external_id: product.code,
      locale,
      macros_per_100g: macros,
      micros_per_100g: Object.keys(micros).length > 0 ? micros : null,
      confidence,
      last_verified_at: nowIso,
    });
  }

  return mapped;
}

async function fetchFromOff(
  query: string,
  locale: string,
  normalizedQuery: string,
): Promise<CanonicalFoodItem[]> {
  const params = new URLSearchParams({
    search_terms: query,
    search_simple: "1",
    action: "process",
    json: "1",
    page_size: String(OFF_PAGE_SIZE),
    fields:
      "code,product_name,product_name_en,product_name_de,brands,nutriments",
  });

  const response = await fetch(
    `https://world.openfoodfacts.org/cgi/search.pl?${params.toString()}`,
    { method: "GET" },
  );

  if (!response.ok) {
    throw new AppError("OFF_FETCH_FAILED", `OFF returned ${response.status}`, 500);
  }

  const payload = await response.json() as OffResponse;
  const products = payload.products ?? [];
  return mapOffToCanonical(products, normalizedQuery, locale);
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
        functionName: "food-off-search",
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

    const { query, locale } = parseBody(body);

    const guard = validateQuery(query);
    if (!guard.isValid) {
      logAbuse({
        traceId,
        clientKey: rateLimit.clientKey,
        queryLength: query.length,
        functionName: "food-off-search",
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

    const cached = await loadValidCache(normalizedQuery, locale, OFF_SOURCE, traceId);
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

    const externalItems = await fetchFromOff(query, locale, normalizedQuery);
    const upsertedItems = await upsertCatalogItems(externalItems, traceId);
    const winner = determineWinner(upsertedItems);
    const cacheType = upsertedItems.length > 0 ? "positive" : "negative";

    await upsertQueryCache({
      normalized_query: normalizedQuery,
      locale,
      source: OFF_SOURCE,
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

    console.error("[food-off-search]", {
      traceId,
      code: handledError.code,
      message: handledError.message,
    });

    return errorResponse(handledError, traceId);
  }
});
