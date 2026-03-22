export type CacheType = "positive" | "negative";
export type SourceType = "off" | "usda";

export interface CanonicalFoodItem {
  id?: string;
  canonical_name: string;
  brand: string | null;
  source: SourceType;
  external_id: string;
  locale: string;
  macros_per_100g: Record<string, number>;
  micros_per_100g?: Record<string, number> | null;
  confidence: number;
  last_verified_at: string;
}

export interface CacheRow {
  normalized_query: string;
  locale: string;
  source: string;
  cache_type: CacheType;
  winner_source: string | null;
  winner_confidence: number | null;
  result_item_ids: string[] | null;
  expires_at: string;
}

export class AppError extends Error {
  code: string;
  status: number;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

export function getTraceId(req: Request): string {
  return req.headers.get("x-trace-id")?.trim() || crypto.randomUUID();
}

export function corsHeaders(): Record<string, string> {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-trace-id",
  };
}

export function jsonResponse(
  body: unknown,
  status = 200,
  traceId?: string,
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders(),
      "Content-Type": "application/json",
      ...(traceId ? { "x-trace-id": traceId } : {}),
    },
  });
}

export function errorResponse(
  error: AppError,
  traceId: string,
  details?: unknown,
): Response {
  const payload: Record<string, unknown> = {
    error: {
      code: error.code,
      message: error.message,
    },
    traceId,
  };

  if (details !== undefined) {
    payload.errorDetails = details;
  }

  return jsonResponse(payload, error.status, traceId);
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) {
    throw new AppError("MISSING_ENV", `Missing required env var ${name}`, 500);
  }
  return value;
}

function baseHeaders(serviceRoleKey: string): HeadersInit {
  return {
    apikey: serviceRoleKey,
    Authorization: `Bearer ${serviceRoleKey}`,
    "Content-Type": "application/json",
  };
}

async function parseJson<T>(response: Response): Promise<T> {
  try {
    return await response.json() as T;
  } catch {
    throw new AppError(
      "SUPABASE_BAD_RESPONSE",
      "Failed to parse Supabase response",
      500,
    );
  }
}

async function supabaseGet<T>(
  path: string,
  query: URLSearchParams,
  traceId?: string,
): Promise<T> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isAnon = !serviceRoleKey;
  const keyToUse = serviceRoleKey || requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

  const endpoint = `/rest/v1/${path}`;
  const url = `${supabaseUrl}${endpoint}?${query.toString()}`;

  console.log(JSON.stringify({
    traceId,
    action: "SUPABASE_GET_START",
    table: path,
    endpoint,
    keyType: isAnon ? "anon" : "service",
  }));

  const response = await fetch(url, {
    method: "GET",
    headers: baseHeaders(keyToUse),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    console.error(JSON.stringify({
      traceId,
      action: "SUPABASE_GET_ERROR",
      table: path,
      endpoint,
      status: response.status,
      bodySnippet: errorBody.substring(0, 200),
    }));
    throw new AppError(
      "SUPABASE_GET_FAILED",
      `Supabase GET failed: ${response.status}`,
      500,
    );
  }

  return await parseJson<T>(response);
}

async function supabaseUpsert<T>(
  path: string,
  body: unknown,
  onConflict: string,
  traceId?: string,
): Promise<T> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const isAnon = !serviceRoleKey;
  const keyToUse = serviceRoleKey || requiredEnv("EXPO_PUBLIC_SUPABASE_ANON_KEY");

  const params = new URLSearchParams({
    on_conflict: onConflict,
    select: "*",
  });
  const endpoint = `/rest/v1/${path}`;
  const url = `${supabaseUrl}${endpoint}?${params.toString()}`;

  console.log(JSON.stringify({
    traceId,
    action: "SUPABASE_UPSERT_START",
    table: path,
    endpoint,
    keyType: isAnon ? "anon" : "service",
  }));

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...baseHeaders(keyToUse),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let payloadKeys: string[] = [];
    try {
      const parsedBody = body as any;
      if (Array.isArray(parsedBody) && parsedBody.length > 0) {
        payloadKeys = Object.keys(parsedBody[0]);
      } else if (!Array.isArray(parsedBody) && parsedBody) {
        payloadKeys = Object.keys(parsedBody);
      }
    } catch (e) {
      payloadKeys = ["unknown"];
    }

    console.error(JSON.stringify({
      traceId,
      action: "SUPABASE_UPSERT_ERROR",
      table: path,
      endpoint,
      status: response.status,
      bodySnippet: errorBody.substring(0, 300),
      payloadKeys,
      conflictTarget: onConflict,
    }));
    throw new AppError(
      "SUPABASE_UPSERT_FAILED",
      `Supabase UPSERT failed: ${response.status}`,
      500,
    );
  }

  return await parseJson<T>(response);
}

export async function loadValidCache(
  normalizedQuery: string,
  locale: string,
  source: string,
  traceId?: string,
): Promise<CacheRow | null> {
  const query = new URLSearchParams({
    select: "*",
    normalized_query: `eq.${normalizedQuery}`,
    locale: `eq.${locale}`,
    source: `eq.${source}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });

  const rows = await supabaseGet<CacheRow[]>("food_query_cache", query, traceId);
  return rows[0] ?? null;
}

export async function loadItemsByIds(ids: string[], traceId?: string): Promise<CanonicalFoodItem[]> {
  if (ids.length === 0) {
    return [];
  }

  const escapedIds = ids.map((id) => `"${id}"`).join(",");
  const query = new URLSearchParams({
    select: "*",
    id: `in.(${escapedIds})`,
  });

  const rows = await supabaseGet<CanonicalFoodItem[]>("food_catalog_items", query, traceId);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as CanonicalFoodItem[];
}

export async function upsertCatalogItems(
  items: CanonicalFoodItem[],
  traceId?: string,
): Promise<CanonicalFoodItem[]> {
  if (items.length === 0) {
    return [];
  }

  return await supabaseUpsert<CanonicalFoodItem[]>(
    "food_catalog_items",
    items,
    "source,external_id",
    traceId,
  );
}

export async function upsertQueryCache(row: CacheRow, traceId?: string): Promise<void> {
  await supabaseUpsert<CacheRow[]>("food_query_cache", row, "normalized_query,locale,source", traceId);
}

export function determineWinner(items: CanonicalFoodItem[]): CanonicalFoodItem | null {
  if (items.length === 0) {
    return null;
  }

  const sourceWeight: Record<SourceType, number> = {
    off: 1.0,
    usda: 1.05,
  };

  return items.reduce((best, current) => {
    const bestScore = best.confidence * sourceWeight[best.source];
    const currentScore = current.confidence * sourceWeight[current.source];
    return currentScore > bestScore ? current : best;
  });
}

export function computeExpiresAt(ttlSeconds: number): string {
  return new Date(Date.now() + ttlSeconds * 1000).toISOString();
}
