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
): Promise<T> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const url = `${supabaseUrl}/rest/v1/${path}?${query.toString()}`;

  const response = await fetch(url, {
    method: "GET",
    headers: baseHeaders(serviceRoleKey),
  });

  if (!response.ok) {
    await response.text();
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
): Promise<T> {
  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const params = new URLSearchParams({
    on_conflict: onConflict,
    select: "*",
  });
  const url = `${supabaseUrl}/rest/v1/${path}?${params.toString()}`;

  const response = await fetch(url, {
    method: "POST",
    headers: {
      ...baseHeaders(serviceRoleKey),
      Prefer: "return=representation,resolution=merge-duplicates",
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    await response.text();
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
): Promise<CacheRow | null> {
  const query = new URLSearchParams({
    select: "*",
    normalized_query: `eq.${normalizedQuery}`,
    locale: `eq.${locale}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });

  const rows = await supabaseGet<CacheRow[]>("food_query_cache", query);
  return rows[0] ?? null;
}

export async function loadItemsByIds(ids: string[]): Promise<CanonicalFoodItem[]> {
  if (ids.length === 0) {
    return [];
  }

  const escapedIds = ids.map((id) => `"${id}"`).join(",");
  const query = new URLSearchParams({
    select: "*",
    id: `in.(${escapedIds})`,
  });

  const rows = await supabaseGet<CanonicalFoodItem[]>("food_catalog_items", query);
  const byId = new Map(rows.map((row) => [row.id, row]));
  return ids.map((id) => byId.get(id)).filter(Boolean) as CanonicalFoodItem[];
}

export async function upsertCatalogItems(
  items: CanonicalFoodItem[],
): Promise<CanonicalFoodItem[]> {
  if (items.length === 0) {
    return [];
  }

  return await supabaseUpsert<CanonicalFoodItem[]>(
    "food_catalog_items",
    items,
    "source,external_id",
  );
}

export async function upsertQueryCache(row: CacheRow): Promise<void> {
  await supabaseUpsert<CacheRow[]>("food_query_cache", row, "normalized_query,locale");
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
