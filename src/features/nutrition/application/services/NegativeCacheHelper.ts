/**
 * Helper für Negative Caching von leeren Food Catalog Ergebnissen
 *
 * Cached null-results für (normalizedQuery, locale) Kombinationen,
 * um wiederholte teure API-Aufrufe zu vermeiden.
 */

export interface NegativeCacheEntry {
  normalizedQuery: string;
  locale: string;
  cachedAt: number;
  ttlMs: number;
}

export class NegativeCacheHelper {
  private cache: Map<string, NegativeCacheEntry> = new Map();

  /**
   * Generiert Cache-Key aus Query und Locale
   */
  private getCacheKey(normalizedQuery: string, locale: string): string {
    return `${normalizedQuery}::${locale}`;
  }

  /**
   * Prüft ob ein negative cache entry existiert und noch gültig ist
   */
  has(normalizedQuery: string, locale: string): boolean {
    const key = this.getCacheKey(normalizedQuery, locale);
    const entry = this.cache.get(key);

    if (!entry) {
      return false;
    }

    const now = Date.now();
    const expired = now - entry.cachedAt > entry.ttlMs;

    if (expired) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * Setzt einen negative cache entry
   */
  set(normalizedQuery: string, locale: string, ttlMs: number): void {
    const key = this.getCacheKey(normalizedQuery, locale);
    this.cache.set(key, {
      normalizedQuery,
      locale,
      cachedAt: Date.now(),
      ttlMs,
    });
  }

  /**
   * Löscht alle Cache-Einträge (für Tests)
   */
  clear(): void {
    this.cache.clear();
  }

  /**
   * Gibt Anzahl Cache-Einträge zurück (für Observability)
   */
  size(): number {
    return this.cache.size;
  }
}
