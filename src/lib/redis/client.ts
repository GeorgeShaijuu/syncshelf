import { Redis } from "@upstash/redis";
import { getServerEnv } from "@/lib/env";
import { checkRateLimit, RateLimitResult } from "@/lib/security/rate-limiter";

let _redisInstance: Redis | null = null;
let _hasLoggedRedisStatus = false;

/**
 * Checks whether valid Upstash Redis REST credentials are present on the server.
 */
export function isRedisConfigured(): boolean {
  if (typeof window !== "undefined") {
    return false;
  }

  try {
    const env = getServerEnv();
    return Boolean(
      env.UPSTASH_REDIS_REST_URL &&
      env.UPSTASH_REDIS_REST_TOKEN &&
      !env.UPSTASH_REDIS_REST_URL.includes("placeholder")
    );
  } catch {
    return false;
  }
}

/**
 * Returns a singleton instance of the Upstash Redis client.
 * Returns null if not configured or when running in the browser.
 */
export function getRedisClient(): Redis | null {
  if (typeof window !== "undefined") {
    return null;
  }

  if (_redisInstance) {
    return _redisInstance;
  }

  if (!isRedisConfigured()) {
    if (!_hasLoggedRedisStatus && process.env.NODE_ENV !== "test") {
      console.info(
        "[SyncShelf Redis] Upstash Redis credentials not configured. Using in-memory fallback for rate limiting and skipping distributed caching."
      );
      _hasLoggedRedisStatus = true;
    }
    return null;
  }

  try {
    const env = getServerEnv();
    _redisInstance = new Redis({
      url: env.UPSTASH_REDIS_REST_URL!,
      token: env.UPSTASH_REDIS_REST_TOKEN!,
    });
    return _redisInstance;
  } catch (err) {
    console.error("[SyncShelf Redis] Failed to initialize Upstash Redis client:", err);
    return null;
  }
}

export interface DistributedRateLimitOptions {
  key: string;
  limit: number;
  windowSeconds: number;
}

export interface DistributedRateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  source: "redis" | "memory";
}

/**
 * Distributed rate limiter with automatic graceful fallback to local in-memory storage.
 * Uses atomic fixed-window counter with automatic expiration.
 */
export async function limitRequest({
  key,
  limit,
  windowSeconds,
}: DistributedRateLimitOptions): Promise<DistributedRateLimitResult> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const now = Math.floor(Date.now() / 1000);
      const windowIndex = Math.floor(now / windowSeconds);
      const redisKey = `ratelimit:${key}:${windowIndex}`;

      // Pipeline INCR and EXPIRE to ensure atomic counter creation and TTL assignment
      const pipeline = redis.pipeline();
      pipeline.incr(redisKey);
      pipeline.expire(redisKey, windowSeconds * 2);
      const [countResult] = (await pipeline.exec()) as [number, unknown];

      const count = Number(countResult) || 1;
      const windowRemainingSeconds = (windowIndex + 1) * windowSeconds - now;
      const resetSeconds = Math.max(1, windowRemainingSeconds);

      if (count > limit) {
        return {
          success: false,
          limit,
          remaining: 0,
          resetSeconds,
          source: "redis",
        };
      }

      return {
        success: true,
        limit,
        remaining: Math.max(0, limit - count),
        resetSeconds,
        source: "redis",
      };
    } catch (redisError) {
      console.warn(
        `[SyncShelf Redis] Rate limit error for '${key}', falling back to in-memory:`,
        redisError
      );
    }
  }

  // Graceful Fallback: Local in-memory sliding window rate limiter
  const memResult: RateLimitResult = checkRateLimit(key, {
    limit,
    windowMs: windowSeconds * 1000,
  });

  return {
    success: memResult.success,
    limit: memResult.limit,
    remaining: memResult.remaining,
    resetSeconds: Math.ceil(memResult.resetMs / 1000),
    source: "memory",
  };
}

/**
 * Transparent short-lived cache wrapper for non-sensitive data.
 * If Redis is configured, checks cache first. Falls back to fetcher on cache miss or error.
 */
export async function getOrSetCache<T>(
  key: string,
  ttlSeconds: number,
  fetcher: () => Promise<T>
): Promise<T> {
  const redis = getRedisClient();

  if (redis) {
    try {
      const cached = await redis.get<T>(key);
      if (cached !== null && cached !== undefined) {
        return cached;
      }
    } catch (err) {
      console.warn(`[SyncShelf Redis] Cache read error for '${key}':`, err);
    }
  }

  // Execute canonical fetcher
  const freshData = await fetcher();

  // Populate cache asynchronously if data is valid and Redis is ready
  if (redis && freshData !== null && freshData !== undefined) {
    try {
      await redis.set(key, freshData, { ex: ttlSeconds });
    } catch (err) {
      console.warn(`[SyncShelf Redis] Cache write error for '${key}':`, err);
    }
  }

  return freshData;
}

/**
 * Removes one or more cached keys from Redis.
 */
export async function invalidateCache(...keys: string[]): Promise<void> {
  const redis = getRedisClient();
  if (!redis || keys.length === 0) return;

  try {
    await redis.del(...keys);
  } catch (err) {
    console.warn("[SyncShelf Redis] Cache invalidation error:", err);
  }
}
