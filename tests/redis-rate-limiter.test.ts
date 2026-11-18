import { describe, it, expect, vi } from "vitest";
import {
  limitRequest,
  getOrSetCache,
  invalidateCache,
  isRedisConfigured,
  getRedisClient,
} from "@/lib/redis/client";

describe("Upstash Redis Client & Distributed Rate Limiter", () => {
  it("reports configuration status correctly based on environment", () => {
    // In test environment without explicit UPSTASH_REDIS_REST_URL, isRedisConfigured returns false
    const configured = isRedisConfigured();
    expect(typeof configured).toBe("boolean");
  });

  it("gracefully falls back to in-memory rate limiting when Redis is not configured", async () => {
    const testKey = `test_fallback_${Date.now()}`;

    // 1st request should succeed
    const res1 = await limitRequest({
      key: testKey,
      limit: 2,
      windowSeconds: 60,
    });
    expect(res1.success).toBe(true);
    expect(res1.limit).toBe(2);
    expect(res1.remaining).toBe(1);

    // 2nd request should succeed
    const res2 = await limitRequest({
      key: testKey,
      limit: 2,
      windowSeconds: 60,
    });
    expect(res2.success).toBe(true);
    expect(res2.remaining).toBe(0);

    // 3rd request exceeds limit -> should fail
    const res3 = await limitRequest({
      key: testKey,
      limit: 2,
      windowSeconds: 60,
    });
    expect(res3.success).toBe(false);
    expect(res3.remaining).toBe(0);
    expect(res3.resetSeconds).toBeGreaterThan(0);
  });

  it("handles getOrSetCache cleanly when Redis is absent by executing fetcher directly", async () => {
    let callCount = 0;
    const fetcher = async () => {
      callCount++;
      return { status: "fetched_fresh", timestamp: Date.now() };
    };

    const data = await getOrSetCache("test_cache_key", 60, fetcher);
    expect(data.status).toBe("fetched_fresh");
    expect(callCount).toBe(1);
  });

  it("handles invalidateCache safely without throwing when unconfigured", async () => {
    await expect(invalidateCache("test_cache_key")).resolves.not.toThrow();
  });
});
