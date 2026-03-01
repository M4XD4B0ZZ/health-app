export interface GuardrailResult {
    isValid: boolean;
    normalizedQuery: string;
    errorReason?: string;
}

export function validateQuery(rawQuery: string | undefined | null): GuardrailResult {
    if (!rawQuery) {
        return { isValid: false, normalizedQuery: "", errorReason: "Query is empty" };
    }
    const trimmed = rawQuery.trim();
    if (trimmed.length < 2) {
        return { isValid: false, normalizedQuery: trimmed, errorReason: "Query too short (min 2)" };
    }
    if (trimmed.length > 64) {
        return { isValid: false, normalizedQuery: trimmed, errorReason: "Query too long (max 64)" };
    }

    // Check if only punctuation/whitespace
    const punctuationRegex = /^[\s\p{P}]+$/u;
    if (punctuationRegex.test(trimmed)) {
        return { isValid: false, normalizedQuery: trimmed, errorReason: "Query contains only punctuation/whitespace" };
    }

    // Check > 3 consecutive identical characters
    if (/(.)\1{3,}/.test(trimmed)) {
        return { isValid: false, normalizedQuery: trimmed, errorReason: "Query contains >3 consecutive identical characters" };
    }

    return { isValid: true, normalizedQuery: trimmed };
}

// ----------------------------------------------------
// Hash & Client Identification
// ----------------------------------------------------
async function hash(data: string): Promise<string> {
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(data);
    const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

export async function getClientKey(req: Request): Promise<string> {
    const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip");
    if (ip) {
        const firstIp = ip.split(',')[0].trim();
        return await hash(firstIp);
    }
    const ua = req.headers.get("user-agent") || "unknown-ua";
    const lang = req.headers.get("accept-language") || "unknown-lang";
    return await hash(`${ua}|${lang}`);
}

// ----------------------------------------------------
// Rate Limiting
// ----------------------------------------------------
export interface RateLimitResponse {
    allowed: boolean;
    retryAfterSec: number;
    clientKey: string;
}

const DEV_RATE_LIMIT_MAP = new Map<string, { count: number; resetAt: number }>();
const LIMIT = 30; // requests per minute
const WINDOW_SEC = 60;

export async function checkRateLimit(req: Request): Promise<RateLimitResponse> {
    const clientKey = await getClientKey(req);
    const upstashUrl = Deno.env.get("UPSTASH_REDIS_REST_URL");
    const upstashToken = Deno.env.get("UPSTASH_REDIS_REST_TOKEN");

    const now = Math.floor(Date.now() / 1000);

    if (upstashUrl && upstashToken) {
        try {
            const key = `ratelimit:anon:${clientKey}`;
            const headers = { Authorization: `Bearer ${upstashToken}` };

            // We use pipeline to INCR and set EXPIRE if new
            // Upstash REST API accepts arrays of arrays for pipelines
            const res = await fetch(`${upstashUrl}/pipeline`, {
                method: "POST",
                headers,
                body: JSON.stringify([
                    ["INCR", key],
                    ["EXPIRE", key, WINDOW_SEC, "NX"]
                ]),
            });

            if (res.ok) {
                const data = await res.json();
                // data[0] is the result of INCR
                const count = data[0].error ? 1 : (parseInt(data[0].result) || 1);

                return {
                    allowed: count <= LIMIT,
                    retryAfterSec: count <= LIMIT ? 0 : WINDOW_SEC, // rough estimate
                    clientKey,
                };
            }
        } catch (e) {
            console.error("[RateLimit] Upstash Redis error", e);
            // Fallthrough to in-memory on error
        }
    }

    // --- Fallback in-memory map (Dev / No Upstash) ---
    const entry = DEV_RATE_LIMIT_MAP.get(clientKey);
    if (!entry || entry.resetAt <= now) {
        DEV_RATE_LIMIT_MAP.set(clientKey, { count: 1, resetAt: now + WINDOW_SEC });
        return { allowed: true, retryAfterSec: 0, clientKey };
    }

    entry.count += 1;
    DEV_RATE_LIMIT_MAP.set(clientKey, entry);

    if (entry.count > LIMIT) {
        return { allowed: false, retryAfterSec: entry.resetAt - now, clientKey };
    }

    return { allowed: true, retryAfterSec: 0, clientKey };
}

// ----------------------------------------------------
// Abuse Logging
// ----------------------------------------------------
export function logAbuse(params: {
    traceId: string;
    clientKey: string;
    queryLength: number;
    functionName: string;
    reason: string;
    latencyMs: number;
    action: "DENY_BAD_QUERY" | "DENY_RATE_LIMIT";
}) {
    console.warn(
        JSON.stringify({
            event: "ABUSE_DETECTED",
            traceId: params.traceId,
            clientKey: params.clientKey.substring(0, 12), // log prefix only
            queryLength: params.queryLength,
            functionName: params.functionName,
            action: params.action,
            reason: params.reason,
            latencyMs: Math.round(params.latencyMs),
        })
    );
}

export function generateTraceId(): string {
    return crypto.randomUUID();
}
