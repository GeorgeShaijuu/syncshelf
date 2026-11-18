/**
 * In-memory client-side cache with Time-To-Live (TTL) support.
 * Used for instant client-side route transitions (Stale-While-Revalidate)
 * across Members, Shared links, and Settings views.
 */

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

export function getClientCachedData<T>(key: string, maxAgeMs = 60000): T | null {
  const entry = memoryCache.get(key);
  if (!entry) return null;
  const isFresh = Date.now() - entry.timestamp < maxAgeMs;
  if (!isFresh) {
    // Stale, but can still be returned for instant render while revalidating
    return entry.data;
  }
  return entry.data;
}

export function isClientCacheFresh(key: string, maxAgeMs = 60000): boolean {
  const entry = memoryCache.get(key);
  if (!entry) return false;
  return Date.now() - entry.timestamp < maxAgeMs;
}

export function setClientCachedData<T>(key: string, data: T): void {
  memoryCache.set(key, {
    data,
    timestamp: Date.now(),
  });
}

export function invalidateClientCache(prefix: string): void {
  for (const key of memoryCache.keys()) {
    if (key.startsWith(prefix)) {
      memoryCache.delete(key);
    }
  }
}
