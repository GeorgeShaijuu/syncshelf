/**
 * In-memory sliding-window rate limiter for public endpoints.
 * Provides basic abuse prevention and DDoS protection without requiring paid infrastructure.
 */

interface RateLimitRecord {
  timestamps: number[];
}

const rateLimitStore = new Map<string, RateLimitRecord>();

// Clean up expired entries every 5 minutes to prevent memory leaks
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    const windowMs = 60 * 1000;
    for (const [key, record] of rateLimitStore.entries()) {
      record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);
      if (record.timestamps.length === 0) {
        rateLimitStore.delete(key);
      }
    }
  }, 5 * 60 * 1000);
}

export interface RateLimitOptions {
  limit?: number; // max allowed requests within windowMs, default 60
  windowMs?: number; // window size in milliseconds, default 60000 (1 min)
}

export interface RateLimitResult {
  success: boolean;
  limit: number;
  remaining: number;
  resetMs: number;
}

/**
 * Checks and increments rate limit for a given identifier (e.g., client IP or composite key).
 */
export function checkRateLimit(
  identifier: string,
  options: RateLimitOptions = {}
): RateLimitResult {
  const limit = options.limit ?? 60;
  const windowMs = options.windowMs ?? 60 * 1000;
  const now = Date.now();

  let record = rateLimitStore.get(identifier);
  if (!record) {
    record = { timestamps: [] };
    rateLimitStore.set(identifier, record);
  }

  // Filter timestamps outside current sliding window
  record.timestamps = record.timestamps.filter((ts) => now - ts < windowMs);

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0];
    const resetMs = Math.max(0, oldest + windowMs - now);
    return {
      success: false,
      limit,
      remaining: 0,
      resetMs,
    };
  }

  record.timestamps.push(now);
  const remaining = Math.max(0, limit - record.timestamps.length);
  const resetMs = windowMs;

  return {
    success: true,
    limit,
    remaining,
    resetMs,
  };
}

/**
 * Extracts a client IP address from request headers (x-forwarded-for, x-real-ip, or fallback).
 */
export function getClientIp(reqHeaders: Headers): string {
  const forwarded = reqHeaders.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = reqHeaders.get("x-real-ip");
  if (realIp) {
    return realIp.trim();
  }
  return "127.0.0.1";
}
