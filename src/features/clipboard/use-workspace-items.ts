"use client";

import * as React from "react";
import {
  collection,
  query,
  orderBy,
  limit,
  where,
  onSnapshot,
  QueryConstraint,
  type Unsubscribe,
} from "firebase/firestore";
import { getFirestoreDb } from "@/lib/firebase/client";
import { useAuth } from "@/features/auth/auth-context";
import { useWorkspace, Workspace } from "@/features/workspaces/workspace-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { ClipboardItem, ClipboardItemType } from "@/lib/validation/item";

export type ConnectionState = "connecting" | "live" | "reconnecting" | "offline" | "error";
export type FilterType =
  | "all"
  | "text"
  | "code"
  | "link"
  | "image"
  | "audio"
  | "video"
  | "file"
  | "pinned";

export interface UseWorkspaceItemsOptions {
  workspaceId: string;
  filterType?: FilterType;
  searchQuery?: string;
  pageSize?: number;
}

export interface UseWorkspaceItemsResult {
  items: ClipboardItem[];
  loading: boolean;
  connectionState: ConnectionState;
  error: string | null;
  hasMore: boolean;
  isLoadingMore: boolean;
  lastSyncedAt: Date | null;
  loadMore: () => Promise<void>;
  refresh: () => Promise<void>;
  optimisticPinToggle: (item: ClipboardItem) => Promise<void>;
  optimisticItemCreated: (newItem: ClipboardItem) => void;
  optimisticItemUpdated: (updatedItem: ClipboardItem) => void;
  optimisticItemDeleted: (deletedId: string) => void;
}

/**
 * Safely normalizes Firestore Timestamp, ISO string, or Date into an ISO string.
 */
export function parseTimestampToISO(val: any): string {
  if (!val) return new Date().toISOString();
  if (typeof val === "string") return val;
  if (typeof val.toDate === "function") {
    try {
      return val.toDate().toISOString();
    } catch {
      return new Date().toISOString();
    }
  }
  if (typeof val.seconds === "number") {
    return new Date(val.seconds * 1000).toISOString();
  }
  if (val instanceof Date) return val.toISOString();
  return new Date().toISOString();
}

/**
 * Transforms a Firestore document snapshot into a type-safe ClipboardItem.
 */
export function docToClipboardItem(docId: string, data: any, workspaceId: string): ClipboardItem {
  return {
    id: docId,
    workspaceId: data.workspaceId || workspaceId,
    type: (data.type as ClipboardItemType) || "text",
    title: data.title || "Untitled",
    content: data.content || "",
    language: data.language || undefined,
    calendarDate: data.calendarDate || undefined,
    originalFileName: data.originalFileName || undefined,
    objectKey: data.objectKey || undefined,
    mimeType: data.mimeType || undefined,
    sizeBytes: typeof data.sizeBytes === "number" ? data.sizeBytes : undefined,
    createdBy: data.createdBy || "",
    createdAt: parseTimestampToISO(data.createdAt),
    updatedAt: parseTimestampToISO(data.updatedAt),
    isPinned: Boolean(data.isPinned),
    tags: Array.isArray(data.tags) ? data.tags : [],
    contentLength:
      typeof data.contentLength === "number"
        ? data.contentLength
        : (data.content?.length || 0),
  };
}

/**
 * Merges realtime and paginated item pools, deduplicates by ID,
 * and maintains newest-first (createdAt desc) ordering.
 */
export function mergeItemPools(
  realtimeItems: Map<string, ClipboardItem>,
  paginatedItems: Map<string, ClipboardItem>
): ClipboardItem[] {
  const mergedMap = new Map<string, ClipboardItem>();

  // Add paginated older items
  for (const [id, item] of paginatedItems) {
    mergedMap.set(id, item);
  }

  // Overwrite/update with realtime items (latest source of truth)
  for (const [id, item] of realtimeItems) {
    mergedMap.set(id, item);
  }

  // Sort newest first
  return Array.from(mergedMap.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export function useWorkspaceItems({
  workspaceId,
  filterType = "all",
  searchQuery = "",
  pageSize = 20,
}: UseWorkspaceItemsOptions): UseWorkspaceItemsResult {
  const { user, isAuthenticated } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const activeWorkspaceId = activeWorkspace?.id;

  // Internal item storage
  const [realtimeMap, setRealtimeMap] = React.useState<Map<string, ClipboardItem>>(
    new Map()
  );
  const [paginatedMap, setPaginatedMap] = React.useState<Map<string, ClipboardItem>>(
    new Map()
  );

  // Connection & lifecycle states
  const [loading, setLoading] = React.useState(true);
  const [connectionState, setConnectionState] = React.useState<ConnectionState>("connecting");
  const [error, setError] = React.useState<string | null>(null);
  const [lastSyncedAt, setLastSyncedAt] = React.useState<Date | null>(null);

  // Pagination states
  const [hasMore, setHasMore] = React.useState(true);
  const [isLoadingMore, setIsLoadingMore] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);

  // Keep ref of maps for stable access in callbacks
  const realtimeMapRef = React.useRef(realtimeMap);
  realtimeMapRef.current = realtimeMap;
  const paginatedMapRef = React.useRef(paginatedMap);
  paginatedMapRef.current = paginatedMap;

  // Clear paginated items and reset cursor when filterType changes
  React.useEffect(() => {
    setPaginatedMap(new Map());
    setNextCursor(null);
    setHasMore(true);
  }, [filterType, workspaceId]);

  // Online / Offline network status listeners
  React.useEffect(() => {
    const handleOnline = () => {
      setConnectionState((prev) => (prev === "offline" ? "reconnecting" : prev));
    };
    const handleOffline = () => {
      setConnectionState("offline");
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    if (!navigator.onLine) {
      setConnectionState("offline");
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Primary Firestore Realtime Listener
  React.useEffect(() => {
    let isMounted = true;
    let unsubscribe: Unsubscribe | null = null;

    // Security & Context Validation:
    // Only subscribe if user is authenticated and workspace matches active context
    if (!isAuthenticated || !user) {
      setConnectionState("offline");
      setLoading(false);
      setRealtimeMap(new Map());
      return;
    }

    if (!workspaceId || (activeWorkspaceId && activeWorkspaceId !== workspaceId)) {
      setConnectionState("error");
      setError("Active workspace context mismatch");
      setLoading(false);
      return;
    }

    const db = getFirestoreDb();
    if (!db) {
      // Running in environment without Firebase client config (mock/preview)
      setConnectionState("offline");
      setLoading(false);
      return;
    }

    setConnectionState(navigator.onLine ? "connecting" : "offline");
    setError(null);

    const itemsCol = collection(db, "workspaces", workspaceId, "items");
    const constraints: QueryConstraint[] = [];

    // Filter constraints where supported
    if (filterType !== "all" && filterType !== "pinned") {
      constraints.push(where("type", "==", filterType));
    } else if (filterType === "pinned") {
      constraints.push(where("isPinned", "==", true));
    }

    // Newest first ordering and bounded limit
    constraints.push(orderBy("createdAt", "desc"));
    constraints.push(limit(pageSize));

    const q = query(itemsCol, ...constraints);

    unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!isMounted) return;

        const currentRealtimeMap = new Map<string, ClipboardItem>();
        const incomingDocs = snapshot.docs;

        for (const doc of incomingDocs) {
          currentRealtimeMap.set(
            doc.id,
            docToClipboardItem(doc.id, doc.data(), workspaceId)
          );
        }

        // Horizon Cutoff Calculation:
        // Distinguish between items truly deleted vs pushed out of top-N window
        const previousRealtime = realtimeMapRef.current;
        if (previousRealtime.size > 0 && incomingDocs.length > 0) {
          const oldestInSnapshot = incomingDocs[incomingDocs.length - 1].data();
          const cutoffTime = oldestInSnapshot.createdAt
            ? new Date(parseTimestampToISO(oldestInSnapshot.createdAt)).getTime()
            : 0;

          // Check previous realtime items that are no longer in incoming snapshot
          for (const [prevId, prevItem] of previousRealtime) {
            if (!currentRealtimeMap.has(prevId)) {
              const itemTime = new Date(prevItem.createdAt).getTime();
              if (incomingDocs.length >= pageSize && itemTime <= cutoffTime) {
                // Item dropped below the limit window into older items
                setPaginatedMap((prev) => {
                  const updated = new Map(prev);
                  updated.set(prevId, prevItem);
                  return updated;
                });
              } else {
                // Item was deleted or no longer matches filter query: remove everywhere
                setPaginatedMap((prev) => {
                  if (prev.has(prevId)) {
                    const updated = new Map(prev);
                    updated.delete(prevId);
                    return updated;
                  }
                  return prev;
                });
              }
            }
          }
        }

        // Handle explicit removals in docChanges
        snapshot.docChanges().forEach((change) => {
          if (change.type === "removed") {
            const removedId = change.doc.id;
            if (!currentRealtimeMap.has(removedId)) {
              // Confirm if this was not pushed past cutoff
              if (incomingDocs.length < pageSize) {
                setPaginatedMap((prev) => {
                  if (prev.has(removedId)) {
                    const updated = new Map(prev);
                    updated.delete(removedId);
                    return updated;
                  }
                  return prev;
                });
              }
            }
          }
        });

        setRealtimeMap(currentRealtimeMap);
        setLoading(false);
        setConnectionState("live");
        setLastSyncedAt(new Date());

        // Update cursor for pagination based on the oldest document in the realtime window
        if (incomingDocs.length > 0) {
          const oldestDoc = incomingDocs[incomingDocs.length - 1];
          setNextCursor((prev) => (prev ? prev : oldestDoc.id));
        }
        if (incomingDocs.length < pageSize) {
          setHasMore(false);
        }
      },
      (snapshotError: any) => {
        if (!isMounted) return;
        console.error("[SyncShelf Realtime] onSnapshot error:", snapshotError);

        if (!navigator.onLine) {
          setConnectionState("offline");
        } else if (snapshotError.code === "unavailable") {
          setConnectionState("reconnecting");
        } else {
          setConnectionState("error");
          setError(snapshotError.message || "Realtime listener error");
        }
        setLoading(false);
      }
    );

    return () => {
      isMounted = false;
      if (unsubscribe) {
        unsubscribe();
        unsubscribe = null;
      }
    };
  }, [workspaceId, activeWorkspaceId, isAuthenticated, user, filterType, pageSize]);

  // Merge realtime and paginated older items
  const mergedItems = React.useMemo(() => {
    return mergeItemPools(realtimeMap, paginatedMap);
  }, [realtimeMap, paginatedMap]);

  // In-memory search filtering over the merged items pool
  const filteredItems = React.useMemo(() => {
    if (!searchQuery.trim()) return mergedItems;
    const queryLower = searchQuery.toLowerCase().trim();

    return mergedItems.filter((item) => {
      const matchTitle = item.title.toLowerCase().includes(queryLower);
      const matchContent = item.content.toLowerCase().includes(queryLower);
      const matchTag = item.tags.some((tag) => tag.toLowerCase().includes(queryLower));
      return matchTitle || matchContent || matchTag;
    });
  }, [mergedItems, searchQuery]);

  // Cursor-based Pagination for older items
  const loadMore = React.useCallback(async () => {
    if (isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);

    try {
      // The cursor is the oldest item currently known
      const allLoaded = mergedItems;
      const oldestItem = allLoaded[allLoaded.length - 1];
      const cursorId = oldestItem ? oldestItem.id : nextCursor;

      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (cursorId) {
        params.set("cursor", cursorId);
      }
      if (filterType !== "all" && filterType !== "pinned") {
        params.set("type", filterType);
      } else if (filterType === "pinned") {
        params.set("pinned", "true");
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(
        `/api/workspaces/${workspaceId}/items?${params.toString()}`,
        { headers }
      );
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to load older items");
      }

      const newItems: ClipboardItem[] = data.items || [];
      if (newItems.length > 0) {
        setPaginatedMap((prev) => {
          const updated = new Map(prev);
          for (const item of newItems) {
            // Avoid inserting duplicates if already in realtimeMap
            if (!realtimeMapRef.current.has(item.id)) {
              updated.set(item.id, item);
            }
          }
          return updated;
        });
      }

      setNextCursor(data.nextCursor || null);
      setHasMore(Boolean(data.hasMore));
    } catch (err: any) {
      console.error("[SyncShelf Realtime] loadMore error:", err);
      setError(err.message || "Failed to load older items");
    } finally {
      setIsLoadingMore(false);
    }
  }, [isLoadingMore, hasMore, mergedItems, nextCursor, pageSize, filterType, searchQuery, workspaceId]);

  // Full Refresh Trigger
  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const headers = await getAuthHeaders();
      const params = new URLSearchParams();
      params.set("limit", String(pageSize));
      if (filterType !== "all" && filterType !== "pinned") {
        params.set("type", filterType);
      } else if (filterType === "pinned") {
        params.set("pinned", "true");
      }
      if (searchQuery.trim()) {
        params.set("search", searchQuery.trim());
      }

      const res = await fetch(
        `/api/workspaces/${workspaceId}/items?${params.toString()}`,
        { headers }
      );
      const data = await res.json();
      if (res.ok && data.items) {
        const freshMap = new Map<string, ClipboardItem>();
        for (const item of data.items) {
          freshMap.set(item.id, item);
        }
        setRealtimeMap(freshMap);
        setPaginatedMap(new Map());
        setNextCursor(data.nextCursor || null);
        setHasMore(Boolean(data.hasMore));
      }
    } catch (err: any) {
      setError(err.message || "Failed to refresh items");
    } finally {
      setLoading(false);
    }
  }, [workspaceId, pageSize, filterType, searchQuery]);

  // Optimistic Pin Toggle
  const optimisticPinToggle = React.useCallback(
    async (item: ClipboardItem) => {
      const newPinned = !item.isPinned;
      const updatedItem = { ...item, isPinned: newPinned };

      // Apply optimistic update locally
      setRealtimeMap((prev) => {
        if (prev.has(item.id)) {
          const next = new Map(prev);
          next.set(item.id, updatedItem);
          return next;
        }
        return prev;
      });
      setPaginatedMap((prev) => {
        if (prev.has(item.id)) {
          const next = new Map(prev);
          next.set(item.id, updatedItem);
          return next;
        }
        return prev;
      });

      try {
        const headers = await getAuthHeaders();
        const res = await fetch(
          `/api/workspaces/${workspaceId}/items/${item.id}`,
          {
            method: "PATCH",
            headers: {
              ...headers,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ isPinned: newPinned }),
          }
        );

        if (!res.ok) {
          // Rollback on server rejection
          setRealtimeMap((prev) => {
            if (prev.has(item.id)) {
              const next = new Map(prev);
              next.set(item.id, item);
              return next;
            }
            return prev;
          });
          setPaginatedMap((prev) => {
            if (prev.has(item.id)) {
              const next = new Map(prev);
              next.set(item.id, item);
              return next;
            }
            return prev;
          });
        }
      } catch {
        // Rollback on network failure
        setRealtimeMap((prev) => {
          if (prev.has(item.id)) {
            const next = new Map(prev);
            next.set(item.id, item);
            return next;
          }
          return prev;
        });
        setPaginatedMap((prev) => {
          if (prev.has(item.id)) {
            const next = new Map(prev);
            next.set(item.id, item);
            return next;
          }
          return prev;
        });
      }
    },
    [workspaceId]
  );

  // Optimistic Item Created
  const optimisticItemCreated = React.useCallback((rawItem: any) => {
    const newItem: ClipboardItem = rawItem?.item || rawItem;
    if (!newItem || !newItem.id) return;
    setRealtimeMap((prev) => {
      const next = new Map(prev);
      next.set(newItem.id, newItem);
      return next;
    });
  }, []);

  // Optimistic Item Updated
  const optimisticItemUpdated = React.useCallback((updatedItem: ClipboardItem) => {
    setRealtimeMap((prev) => {
      if (prev.has(updatedItem.id)) {
        const next = new Map(prev);
        next.set(updatedItem.id, updatedItem);
        return next;
      }
      return prev;
    });
    setPaginatedMap((prev) => {
      if (prev.has(updatedItem.id)) {
        const next = new Map(prev);
        next.set(updatedItem.id, updatedItem);
        return next;
      }
      return prev;
    });
  }, []);

  // Optimistic Item Deleted
  const optimisticItemDeleted = React.useCallback((deletedId: string) => {
    setRealtimeMap((prev) => {
      if (prev.has(deletedId)) {
        const next = new Map(prev);
        next.delete(deletedId);
        return next;
      }
      return prev;
    });
    setPaginatedMap((prev) => {
      if (prev.has(deletedId)) {
        const next = new Map(prev);
        next.delete(deletedId);
        return next;
      }
      return prev;
    });
  }, []);

  return {
    items: filteredItems,
    loading,
    connectionState,
    error,
    hasMore,
    isLoadingMore,
    lastSyncedAt,
    loadMore,
    refresh,
    optimisticPinToggle,
    optimisticItemCreated,
    optimisticItemUpdated,
    optimisticItemDeleted,
  };
}
