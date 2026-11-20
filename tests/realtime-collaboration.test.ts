import { describe, it, expect, beforeEach } from "vitest";
import { updateAndGetPresence, getActivePresence } from "@/lib/presence/presence-store";
import { CollaboratorPresence } from "@/features/presence/presence-types";
import {
  mergeItemPools,
  parseTimestampToISO,
  docToClipboardItem,
} from "@/features/clipboard/use-workspace-items";
import { ClipboardItem } from "@/lib/validation/item";

describe("Realtime Collaboration Engine & Presence Store", () => {
  const mockSpaceId = "ws_test_collaboration_space";

  it("updates collaborator presence and lists all currently active collaborators", async () => {
    const userA: CollaboratorPresence = {
      userId: "user_a",
      displayName: "Alice",
      avatarUrl: "https://example.com/alice.jpg",
      view: "board",
      activeLane: "text",
      role: "owner",
      lastActiveAt: Date.now(),
    };

    const userB: CollaboratorPresence = {
      userId: "user_b",
      displayName: "Bob",
      avatarUrl: null,
      view: "calendar",
      activeLane: null,
      role: "editor",
      lastActiveAt: Date.now(),
    };

    const afterA = await updateAndGetPresence(mockSpaceId, userA);
    expect(afterA.some((c) => c.userId === "user_a")).toBe(true);

    const afterB = await updateAndGetPresence(mockSpaceId, userB);
    expect(afterB.length).toBeGreaterThanOrEqual(2);
    expect(afterB.some((c) => c.userId === "user_a")).toBe(true);
    expect(afterB.some((c) => c.userId === "user_b")).toBe(true);
  });

  it("prunes expired collaborators when TTL (35s) elapses", async () => {
    const testSpace = "ws_ttl_test_space";
    const now = Date.now();

    const staleUser: CollaboratorPresence = {
      userId: "stale_user",
      displayName: "Ghost",
      avatarUrl: null,
      view: "board",
      role: "viewer",
      lastActiveAt: now - 40000, // 40 seconds ago (expired)
    };

    const activeUser: CollaboratorPresence = {
      userId: "active_user",
      displayName: "Active Collaborator",
      avatarUrl: null,
      view: "calendar",
      role: "editor",
      lastActiveAt: now,
    };

    // Stale user was registered earlier
    await updateAndGetPresence(testSpace, staleUser);
    // Active user pings now
    const collaborators = await updateAndGetPresence(testSpace, activeUser);

    expect(collaborators.some((c) => c.userId === "active_user")).toBe(true);
    expect(collaborators.some((c) => c.userId === "stale_user")).toBe(false);
  });

  it("reconciles calendarDate and pin state across Board and Calendar items", () => {
    const rawData = {
      type: "image",
      title: "Design Mockup",
      content: "",
      objectKey: "workspaces/ws_1/items/img_1/mockup.png",
      calendarDate: "2026-11-25",
      isPinned: true,
      createdBy: "user_designer",
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:05:00.000Z",
    };

    const item = docToClipboardItem("img_1", rawData, "ws_1");
    expect(item.id).toBe("img_1");
    expect(item.calendarDate).toBe("2026-11-25");
    expect(item.isPinned).toBe(true);
    expect(item.objectKey).toBe("workspaces/ws_1/items/img_1/mockup.png");

    // Test updating calendarDate
    const updatedRaw = {
      ...rawData,
      calendarDate: "2026-11-28",
      isPinned: false,
    };
    const updatedItem = docToClipboardItem("img_1", updatedRaw, "ws_1");
    expect(updatedItem.calendarDate).toBe("2026-11-28");
    expect(updatedItem.isPinned).toBe(false);
  });

  it("correctly merges realtime items without duplicating or dropping items", () => {
    const realtimeMap = new Map<string, ClipboardItem>();
    const paginatedMap = new Map<string, ClipboardItem>();

    const item1: ClipboardItem = {
      id: "clip_1",
      workspaceId: "ws_1",
      type: "text",
      title: "First Clip",
      content: "Hello World",
      createdBy: "u1",
      createdAt: "2026-11-20T10:00:00.000Z",
      updatedAt: "2026-11-20T10:00:00.000Z",
      isPinned: false,
      tags: [],
      contentLength: 11,
    };

    const item2: ClipboardItem = {
      id: "clip_2",
      workspaceId: "ws_1",
      type: "code",
      title: "Python Snippet",
      content: "print(42)",
      language: "python",
      createdBy: "u2",
      createdAt: "2026-11-20T11:00:00.000Z",
      updatedAt: "2026-11-20T11:00:00.000Z",
      isPinned: true,
      tags: [],
      contentLength: 9,
    };

    // item1 is in paginated older pool, item2 is in newest realtime pool
    paginatedMap.set(item1.id, item1);
    realtimeMap.set(item2.id, item2);

    const merged = mergeItemPools(realtimeMap, paginatedMap);
    expect(merged.length).toBe(2);
    // Newest first
    expect(merged[0].id).toBe("clip_2");
    expect(merged[1].id).toBe("clip_1");

    // If item1 receives a realtime update (e.g. pinned), it overrides paginated entry cleanly
    const updatedItem1: ClipboardItem = { ...item1, isPinned: true, title: "First Clip (Pinned)" };
    realtimeMap.set(item1.id, updatedItem1);

    const mergedAfterUpdate = mergeItemPools(realtimeMap, paginatedMap);
    expect(mergedAfterUpdate.length).toBe(2);
    const found = mergedAfterUpdate.find((it) => it.id === "clip_1");
    expect(found?.isPinned).toBe(true);
    expect(found?.title).toBe("First Clip (Pinned)");
  });
});
