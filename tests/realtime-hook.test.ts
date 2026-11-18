import { describe, it, expect } from "vitest";
import {
  mergeItemPools,
  parseTimestampToISO,
  docToClipboardItem,
} from "@/features/clipboard/use-workspace-items";
import { ClipboardItem } from "@/lib/validation/item";

describe("Realtime Hook Logic — Merging, Deduplication & Normalization", () => {
  it("normalizes various timestamp representations into valid ISO strings", () => {
    const isoString = "2026-11-16T12:00:00.000Z";
    expect(parseTimestampToISO(isoString)).toBe(isoString);

    const dateObj = new Date("2026-11-16T15:30:00.000Z");
    expect(parseTimestampToISO(dateObj)).toBe("2026-11-16T15:30:00.000Z");

    const firestoreTimestampLike = {
      seconds: 1731758400,
      nanoseconds: 0,
      toDate: () => new Date("2024-11-16T12:00:00.000Z"),
    };
    expect(parseTimestampToISO(firestoreTimestampLike)).toBe("2024-11-16T12:00:00.000Z");

    const secondsOnly = { seconds: 1700000000 };
    expect(parseTimestampToISO(secondsOnly)).toBe(new Date(1700000000 * 1000).toISOString());

    expect(typeof parseTimestampToISO(null)).toBe("string");
  });

  it("transforms raw Firestore document data into a type-safe ClipboardItem", () => {
    const rawData = {
      type: "code",
      title: "Bash Script",
      content: "echo 'hello'",
      language: "bash",
      createdBy: "user_123",
      createdAt: "2026-11-16T10:00:00.000Z",
      updatedAt: "2026-11-16T10:05:00.000Z",
      isPinned: true,
      tags: ["shell", "automation"],
      contentLength: 12,
    };

    const item = docToClipboardItem("doc_abc", rawData, "ws_1");
    expect(item.id).toBe("doc_abc");
    expect(item.workspaceId).toBe("ws_1");
    expect(item.type).toBe("code");
    expect(item.title).toBe("Bash Script");
    expect(item.content).toBe("echo 'hello'");
    expect(item.language).toBe("bash");
    expect(item.createdBy).toBe("user_123");
    expect(item.isPinned).toBe(true);
    expect(item.tags).toEqual(["shell", "automation"]);
    expect(item.contentLength).toBe(12);
  });

  it("handles missing optional fields in docToClipboardItem gracefully", () => {
    const rawData = {};
    const item = docToClipboardItem("doc_minimal", rawData, "ws_test");

    expect(item.id).toBe("doc_minimal");
    expect(item.workspaceId).toBe("ws_test");
    expect(item.type).toBe("text");
    expect(item.title).toBe("Untitled");
    expect(item.content).toBe("");
    expect(item.language).toBeUndefined();
    expect(item.isPinned).toBe(false);
    expect(item.tags).toEqual([]);
    expect(item.contentLength).toBe(0);
  });

  it("merges realtime items and paginated older items with complete deduplication", () => {
    const realtimeMap = new Map<string, ClipboardItem>();
    const paginatedMap = new Map<string, ClipboardItem>();

    const item1: ClipboardItem = {
      id: "item_1",
      workspaceId: "ws_1",
      type: "text",
      title: "Item 1 (Realtime)",
      content: "Latest version from realtime stream",
      createdBy: "u1",
      createdAt: "2026-11-16T14:00:00.000Z",
      updatedAt: "2026-11-16T14:00:00.000Z",
      isPinned: false,
      tags: [],
      contentLength: 35,
    };

    const item2: ClipboardItem = {
      id: "item_2",
      workspaceId: "ws_1",
      type: "link",
      title: "Item 2 (Realtime)",
      content: "https://example.com",
      createdBy: "u1",
      createdAt: "2026-11-16T13:00:00.000Z",
      updatedAt: "2026-11-16T13:00:00.000Z",
      isPinned: false,
      tags: [],
      contentLength: 19,
    };

    const item3: ClipboardItem = {
      id: "item_3",
      workspaceId: "ws_1",
      type: "code",
      title: "Item 3 (Older Paginated)",
      content: "console.log(1)",
      createdBy: "u1",
      createdAt: "2026-11-16T10:00:00.000Z",
      updatedAt: "2026-11-16T10:00:00.000Z",
      isPinned: false,
      tags: [],
      contentLength: 14,
    };

    // Stale version of item 2 in paginated set
    const staleItem2: ClipboardItem = {
      ...item2,
      title: "Item 2 (Old cached version)",
      content: "old",
    };

    realtimeMap.set(item1.id, item1);
    realtimeMap.set(item2.id, item2);

    paginatedMap.set(staleItem2.id, staleItem2);
    paginatedMap.set(item3.id, item3);

    const merged = mergeItemPools(realtimeMap, paginatedMap);

    // Exactly 3 unique items
    expect(merged.length).toBe(3);
    expect(merged.map((i) => i.id)).toEqual(["item_1", "item_2", "item_3"]);

    // Realtime item2 overwrote the stale paginated version
    const mergedItem2 = merged.find((i) => i.id === "item_2");
    expect(mergedItem2?.title).toBe("Item 2 (Realtime)");
  });

  it("maintains strict newest-first sorting across mixed timestamp sources", () => {
    const realtimeMap = new Map<string, ClipboardItem>();
    const paginatedMap = new Map<string, ClipboardItem>();

    const makeItem = (id: string, time: string): ClipboardItem => ({
      id,
      workspaceId: "ws_1",
      type: "text",
      title: `Item ${id}`,
      content: "content",
      createdBy: "u1",
      createdAt: time,
      updatedAt: time,
      isPinned: false,
      tags: [],
      contentLength: 7,
    });

    realtimeMap.set("a", makeItem("a", "2026-11-16T12:00:00.000Z"));
    realtimeMap.set("c", makeItem("c", "2026-11-16T10:00:00.000Z"));
    paginatedMap.set("b", makeItem("b", "2026-11-16T11:00:00.000Z"));
    paginatedMap.set("d", makeItem("d", "2026-11-16T09:00:00.000Z"));

    const merged = mergeItemPools(realtimeMap, paginatedMap);
    expect(merged.map((i) => i.id)).toEqual(["a", "b", "c", "d"]);
  });
});
