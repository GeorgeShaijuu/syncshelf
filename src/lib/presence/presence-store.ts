import { getRedisClient } from "@/lib/redis/client";
import { CollaboratorPresence } from "@/features/presence/presence-types";

// In-memory fallback store when Redis is unavailable or in development/test
const inMemoryPresenceMap = new Map<string, Map<string, CollaboratorPresence>>();

const PRESENCE_TTL_MS = 35 * 1000; // 35 seconds active window
const REDIS_KEY_TTL_SECONDS = 120; // 2 minutes auto-expiry for Redis Hash

/**
 * Updates a collaborator's ephemeral presence in a workspace or share session,
 * prunes stale collaborators, and returns all currently active collaborators.
 */
export async function updateAndGetPresence(
  spaceId: string,
  collaborator: CollaboratorPresence
): Promise<CollaboratorPresence[]> {
  const redis = getRedisClient();
  const now = Date.now();

  collaborator.lastActiveAt = collaborator.lastActiveAt || now;

  if (redis) {
    try {
      const hashKey = `presence:${spaceId}`;

      // Update collaborator entry in Redis Hash
      await redis.hset(hashKey, {
        [collaborator.userId]: JSON.stringify(collaborator),
      });
      await redis.expire(hashKey, REDIS_KEY_TTL_SECONDS);

      // Fetch all entries in this presence hash
      const allEntries = await redis.hgetall(hashKey);
      if (!allEntries) {
        return [collaborator];
      }

      const activeCollaborators: CollaboratorPresence[] = [];
      const expiredUserIds: string[] = [];

      for (const [uid, rawVal] of Object.entries(allEntries)) {
        try {
          const parsed: CollaboratorPresence =
            typeof rawVal === "string" ? JSON.parse(rawVal) : (rawVal as CollaboratorPresence);

          if (now - parsed.lastActiveAt <= PRESENCE_TTL_MS) {
            activeCollaborators.push(parsed);
          } else {
            expiredUserIds.push(uid);
          }
        } catch {
          expiredUserIds.push(uid);
        }
      }

      // Asynchronously prune expired entries from Redis Hash
      if (expiredUserIds.length > 0) {
        redis.hdel(hashKey, ...expiredUserIds).catch(() => {});
      }

      return activeCollaborators.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } catch (err) {
      console.warn("[Presence Store] Redis presence update fallback notice:", err);
      // Fall through to in-memory store
    }
  }

  // Fallback: In-memory store
  if (!inMemoryPresenceMap.has(spaceId)) {
    inMemoryPresenceMap.set(spaceId, new Map());
  }

  const spaceMap = inMemoryPresenceMap.get(spaceId)!;
  spaceMap.set(collaborator.userId, collaborator);

  const active: CollaboratorPresence[] = [];
  for (const [uid, record] of Array.from(spaceMap.entries())) {
    if (now - record.lastActiveAt <= PRESENCE_TTL_MS) {
      active.push(record);
    } else {
      spaceMap.delete(uid);
    }
  }

  return active.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}

/**
 * Retrieves the currently active collaborators without updating presence.
 */
export async function getActivePresence(spaceId: string): Promise<CollaboratorPresence[]> {
  const redis = getRedisClient();
  const now = Date.now();

  if (redis) {
    try {
      const hashKey = `presence:${spaceId}`;
      const allEntries = await redis.hgetall(hashKey);
      if (!allEntries) return [];

      const active: CollaboratorPresence[] = [];
      for (const rawVal of Object.values(allEntries)) {
        try {
          const parsed: CollaboratorPresence =
            typeof rawVal === "string" ? JSON.parse(rawVal) : (rawVal as CollaboratorPresence);
          if (now - parsed.lastActiveAt <= PRESENCE_TTL_MS) {
            active.push(parsed);
          }
        } catch {}
      }
      return active.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
    } catch {
      // Fall through to memory
    }
  }

  const spaceMap = inMemoryPresenceMap.get(spaceId);
  if (!spaceMap) return [];

  const active: CollaboratorPresence[] = [];
  for (const [uid, record] of Array.from(spaceMap.entries())) {
    if (now - record.lastActiveAt <= PRESENCE_TTL_MS) {
      active.push(record);
    } else {
      spaceMap.delete(uid);
    }
  }

  return active.sort((a, b) => b.lastActiveAt - a.lastActiveAt);
}
