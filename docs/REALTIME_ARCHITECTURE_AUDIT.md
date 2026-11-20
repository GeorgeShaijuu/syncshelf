# SYNCSHELF — REALTIME COLLABORATION ARCHITECTURE AUDIT
**Date:** 2026-11-20  
**Status:** Audit Completed & Architectural Specification Defined  
**Scope:** Realtime synchronization, background tab recovery, shared workspace live updates, anonymous capability-link streaming, and multiplayer presence awareness.

---

## 1. EXECUTIVE SUMMARY & PROBLEM STATEMENT

SyncShelf is designed as an interactive, multi-user visual workspace for clipboard items, links, media, and calendar scheduling — analogous to Canva or Figma. Multiple collaborators (or public viewers) can open the same shared Board Canvas or Calendar and see each other's updates continuously without manual page refreshes.

### The Reported Defect
When a user opens a shared workspace in one browser tab and navigates away (leaving the tab inactive or backgrounded), changes made by other collaborators do not appear when the user returns. The user is forced to press F5 / manual browser refresh to see the latest content.

---

## 2. FORENSIC ROOT CAUSE ANALYSIS

An exhaustive audit of the codebase (`src/features/clipboard/use-workspace-items.ts`, `src/features/clipboard/workspace-items-context.tsx`, `src/app/s/[token]/public-share-client-view.tsx`, `src/app/api/public/shares/[token]/stream/route.ts`, and `firestore.rules`) revealed the exact structural causes across the 10 diagnostic points:

### Point 1: Shared pages only use a one-time HTTP/API fetch
- **Finding:** In `src/app/s/[token]/public-share-client-view.tsx`, the initial render fetches `/api/public/shares/[token]` via standard HTTP GET. Although an SSE stream is initiated to `/api/public/shares/[token]/stream`, the stream reader loop in `setupStream()` terminates completely whenever `reader.read()` resolves with `{ done: true }` or throws a network error.
- **Impact:** Once the serverless connection ends (due to Vercel/gateway timeout, sleep, or browser suspension), the component never reconnects. The page degrades silently into a static, one-time fetch view.

### Point 2: Firestore listeners are missing from shared views
- **Finding:** Client-side `onSnapshot()` listeners are absent from `public-share-client-view.tsx`. This is necessary for anonymous users due to `firestore.rules` denying non-members direct access to `/workspaces/{workspaceId}/items`.
- **Impact:** Shared views rely entirely on the SSE gateway. Because the SSE gateway had no client reconnect loop or visibility wake-up handler, anonymous viewers lose all live updates as soon as the initial stream closes.

### Point 3: Listeners are unsubscribed or frozen when the page becomes hidden
- **Finding:** Neither `useWorkspaceItems` nor `public-share-client-view.tsx` listened to `document.visibilityState` or the `visibilitychange` event.
- **Impact:** Modern browsers (Chromium, WebKit, Gecko) aggressively throttle background tabs, suspending timers, pausing event loops, and terminating idle WebSockets/HTTP connections. When the user returns to the tab, the connection is either dead or in a half-open "zombie" state. Without a visibility recovery handler, the UI remains permanently frozen with stale data.

### Point 4: Listeners are recreated incorrectly or experience dependency thrashing
- **Finding:** In `useWorkspaceItems.ts`, the effect dependencies include `[workspaceId, activeWorkspaceId, isAuthenticated, user, filterType, pageSize]`. If `activeWorkspaceId` is temporarily unaligned during workspace loading or switching, it trips:
  ```typescript
  if (activeWorkspaceId && activeWorkspaceId !== workspaceId) {
    setConnectionState("error");
    setError("Active workspace context mismatch");
    return;
  }
  ```
  Once set to `"error"`, the hook does not recover automatically. In `public-share-client-view.tsx`, `setupStream()` was inside an effect dependent only on `[shareMetadata, errorStatus, token, mapPublicToInternal]`. When the stream ended naturally, none of those dependencies changed, so `setupStream()` was never re-executed.

### Point 5: Components unmount during navigation
- **Finding:** Within the authenticated dashboard (`src/app/(dashboard)/layout.tsx`), `WorkspaceItemsProvider` wraps both Board Canvas (`/`) and Calendar (`/calendar`). Therefore, switching between Board and Calendar for the active workspace maintains the subscription. However, moving between `/s/[token]` and personal spaces creates independent lifecycle instances.

### Point 6: Firestore permissions prevent realtime listeners for external / anonymous users
- **Finding:** `firestore.rules` enforces:
  ```firestore
  match /workspaces/{workspaceId}/items/{itemId} {
    allow read: if isWorkspaceMember(workspaceId);
    allow write: if false;
  }
  ```
  Only authenticated users who exist in `/workspaces/{workspaceId}/members/{uid}` are authorized to read Firestore directly. Anonymous viewers and external collaborators who access via capability links (`/s/[token]`) cannot read `/workspaces/{workspaceId}/items` directly without triggering `permission-denied`.
- **Architectural Decision:** Do NOT weaken `firestore.rules` with `allow read: if true`. The server-managed SSE stream (`/api/public/shares/[token]/stream`) using Admin SDK is the correct, secure pattern for capability links, but it requires resilient auto-reconnection and visibility recovery.

### Point 7: Listeners receive cached data but never reconcile correctly with the server
- **Finding:** In `useWorkspaceItems.ts`, `onSnapshot` was called without `{ includeMetadataChanges: true }`.
- **Impact:** The client could not distinguish between a snapshot served from local IndexedDB/memory cache (`metadata.fromCache === true`) versus a server-confirmed sync. When returning from sleep, Firestore may fire a cached snapshot while the server connection is still establishing; without metadata tracking, the application cannot signal to the user that synchronization is catching up.

### Point 8: Background browser suspension interrupts the connection (PRIMARY ROOT CAUSE)
- **Finding:** When a laptop lid closes, a phone screen sleeps, or a tab sits in the background for >60 seconds, the browser closes or freezes TCP sockets.
- **In `useWorkspaceItems`:** Firestore client SDK attempts internal reconnection, but if the tab was suspended, internal timers may stall until an interaction or explicit network check occurs.
- **In `public-share-client-view.tsx`:** The SSE fetch stream aborts or closes immediately.
- **Impact:** Upon returning to the tab, the user sees outdated cards. Changes made by Collaborator B during those 2 minutes are invisible until manual refresh.

### Point 9: API mutations bypass the data source currently being listened to
- **Finding:** Mutations go through Next.js server APIs (`/api/workspaces/[id]/items` and `/api/public/shares/[token]/items`) which write to Firestore using Admin SDK. The Admin SDK writes trigger Firestore backend notifications.
- **Impact:** The mutation pipeline itself is sound; the failure to see updates was entirely due to the receiving client's dead or asleep subscription (Point 8).

### Point 10: Realtime events arrive but React state is not updated correctly
- **Finding:** In `useWorkspaceItems.ts`, a horizon cutoff calculation separated `realtimeMap` from `paginatedMap`. If an item was updated without changing its `createdAt` timestamp, or during rapid sequential writes, items could fail to update in `paginatedMap`. In `public-share-client-view.tsx`, `sync:init` replaced all items, discarding optimistic writes.

---

## 3. ARCHITECTURAL BLUEPRINT

```
┌──────────────────────────────────────────────────────────────────────────────────┐
│                             FIRESTORE (SOURCE OF TRUTH)                         │
└───────────────────────┬──────────────────────────────────┬───────────────────────┘
                        │                                  │
          ┌─────────────┴────────────┐       ┌─────────────┴────────────┐
          │ Authenticated Members    │       │ Admin SDK Engine         │
          │ (Security Rules Allowed) │       │ (Token-Scoped Gateway)   │
          └─────────────┬────────────┘       └─────────────┬────────────┘
                        │                                  │
         Firestore client onSnapshot               Server-Sent Events (SSE)
         with includeMetadataChanges               /api/public/shares/[token]/stream
                        │                                  │
          ┌─────────────▼────────────┐       ┌─────────────▼────────────┐
          │ Visibility & Lifecycle   │       │ Resilient SSE Client     │
          │ Recovery Engine          │       │ with Auto-Reconnect      │
          │ (visibilitychange/online)│       │ (Exponential Backoff)    │
          └─────────────┬────────────┘       └─────────────┬────────────┘
                        │                                  │
                        ▼                                  ▼
          ┌──────────────────────────┐       ┌──────────────────────────┐
          │ WorkspaceItemsContext    │       │ PublicShareClientView    │
          │ (Board Canvas + Calendar)│       │ (Shared Board + Calendar)│
          └──────────────────────────┘       └──────────────────────────┘
```

### Component Architecture & Enhancements

1. **Visibility-Aware Synchronization Engine (`src/features/clipboard/use-workspace-items.ts`):**
   - Configure `onSnapshot` with `{ includeMetadataChanges: true }`.
   - Listen to `document.addEventListener("visibilitychange")`.
   - When `document.visibilityState === "visible"`:
     - Check connection health and timestamp of last server-confirmed sync.
     - If the connection has been idle/hidden for >30 seconds or in reconnecting/error state, perform an immediate lightweight server check and refresh without unmounting UI or page reload.
   - Listen to `window.addEventListener("online")` and `"offline"` to transition state cleanly between `live`, `syncing`, and `offline`.
   - Ensure the subscription stays active while hidden (do not destroy it on tab blur/hide).

2. **Resilient SSE Reconnection Engine (`src/app/s/[token]/public-share-client-view.tsx`):**
   - Replace one-shot stream reader with an auto-reconnecting stream supervisor.
   - Implement bounded exponential backoff (1s, 2s, 4s, 8s, up to 10s max) on unexpected disconnects.
   - On `visibilitychange` to `"visible"`, if stream is disconnected or last heartbeat >40s ago, reconnect immediately.
   - On `share:revoked` or `share:expired` events, cancel all reconnection attempts permanently and transition to revoked/expired UI state.
   - Send periodic keep-alive heartbeats (`: heartbeat\n\n`) from the server every 20 seconds.

3. **Unified Live State Between Board and Calendar:**
   - Both Board Canvas (`src/app/(dashboard)/page.tsx`) and Calendar (`src/app/(dashboard)/calendar/page.tsx`) consume the shared `WorkspaceItemsContext`.
   - Items added, edited, pinned, or updated with `calendarDate` immediately reflect across both views.
   - Ensure `calendarDate` changes trigger updates in calendar date cells without duplicating card records.

4. **Ephemeral Multiplayer Presence Layer:**
   - Display a lightweight collaborator avatar stack in the top navigation and shared workspace header.
   - Track active users, active view (`board` vs `calendar`), and current role (`editor` vs `viewer`).
   - Use ephemeral presence updates (heartbeat pings with short TTL) to avoid persisting mouse movements or polluting the persistent items collection.

---

## 4. VERIFICATION PLAN

The architecture will be verified across all 8 mandatory end-to-end scenarios:
- **Test A:** Both tabs active (bidirectional real-time paste and code creation).
- **Test B:** Inactive tab recovery (>2 minutes background tab catches up on focus without refresh).
- **Test C:** Network disconnection and recovery (offline indicator -> automatic reconciliation).
- **Test D:** Calendar synchronization (Board addition appears on Calendar date; date update syncs).
- **Test E:** Anonymous viewer (real-time view-only updates via SSE with security boundary preserved).
- **Test F:** Authenticated external editor (real-time editing and collaborator identity).
- **Test G:** Share revocation (instant termination of client stream and transition to revoked state).
- **Test H:** Multiple workspaces (zero data leakage between separate spaces).
