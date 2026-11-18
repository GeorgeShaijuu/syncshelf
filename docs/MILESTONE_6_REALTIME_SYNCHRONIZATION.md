# Milestone 6 — Realtime Synchronization Report

**Application:** SyncShelf  
**Firebase Project ID:** `syncshelf-514903`  
**Database Location:** `asia-south1` (Mumbai, India)  
**Synchronization Model:** Hybrid Firestore `onSnapshot` Realtime Stream + Server-Side Cursor Pagination  
**Security Model:** Read-Only Client Listener with Centralized Server Mutations (Zero Client Write Trust)  
**Status:** Completed & Validated (100% Tests Passing)  

---

## 1. Architecture Overview

Milestone 6 introduces collaborative, real-time clipboard synchronization across team members viewing the same workspace. Cloud Firestore serves as the single source of truth without requiring auxiliary WebSocket servers, Redis, or external third-party subscriptions.

```text
┌────────────────────────────────────────────────────────────────────────┐
│                   CLIENT APPLICATION (Browser)                         │
│  - useWorkspaceItems hook                                              │
│  - Realtime state machine (Connecting, Live, Reconnecting, Offline)   │
│  - Hybrid pool merger (realtime window + paginated history)            │
│  - Optimistic mutation coordination                                    │
└───────────────┬──────────────────────────────────────▲─────────────────┘
                │ (Server Mutations)                   │ (onSnapshot Listener)
                │ POST / PATCH / DELETE                │ Bounded window (limit 20)
                ▼                                      │
┌───────────────────────────────────┐                  │
│       NEXT.JS API ROUTES          │                  │
│  - Token Verification (JWT)       │                  │
│  - Server RBAC (Admin SDK)        │                  │
│  - Timestamp & Content Length     │                  │
└───────────────┬───────────────────┘                  │
                │ (Admin SDK Privileged Write)         │
                ▼                                      │
┌──────────────────────────────────────────────────────┴─────────────────┐
│                     CLOUD FIRESTORE (Native Mode)                      │
│      Subcollection: workspaces/{workspaceId}/items                     │
│      Rules: allow read: if isWorkspaceMember(workspaceId);             │
│             allow write: if false;                                     │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Realtime Hook Implementation (`useWorkspaceItems`)

Location: [src/features/clipboard/use-workspace-items.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/features/clipboard/use-workspace-items.ts)

### Core Capabilities:
1. **Bounded Realtime Window:**
   - Listens to `workspaces/{workspaceId}/items` ordered by `createdAt desc` with a strict limit (`limit(20)`).
   - Keeps client memory and Firestore read costs strictly bounded.
2. **Context Validation & Security:**
   - Enforces that the requested `workspaceId` strictly matches the active authenticated workspace context (`activeWorkspace.id`).
   - Rejects unverified client-supplied workspace subscriptions.
3. **Connection Lifecycle State Machine:**
   - `connecting`: Initial state while connecting to Firestore stream.
   - `live`: Active stream confirmed via first successful snapshot.
   - `reconnecting`: Network connectivity restored or backend reconnection in progress.
   - `offline`: Browser network offline (`window.addEventListener("offline")`).
   - `error`: Security permission rejection or listener failure.
4. **Subscription Cleanup & Strict Mode Protection:**
   - React 19 / Strict Mode double-mount resilience using `isMounted` guard and clean `unsubscribe()` execution.
   - Unsubscribes immediately when a user changes workspace, signs out, or navigates away.

---

## 3. Hybrid Pagination & Pool Merging

To reconcile the cost-effective bounded realtime window with the need to browse arbitrarily old clipboard history, SyncShelf employs a deterministic hybrid merge algorithm:

```text
Realtime Window (Top 20 Items)          Older Paginated Items
   [ Item 1 (12:00) ]                      [ Item 21 (08:30) ]
   [ Item 2 (11:45) ]                      [ Item 22 (08:00) ]
         ...                                      ...
   [ Item 20 (09:00) ]                     [ Item 40 (06:00) ]
         │                                        │
         └─────────────────┬──────────────────────┘
                           ▼
              Deduplicated ID Map
                           ▼
          Newest-First Array (createdAt desc)
```

### Horizon Cutoff Algorithm
When a new item is created, the bounded query pushes the 20th item below the query horizon ($T_{cutoff}$). To prevent that item from erroneously disappearing or being duplicated:
- If $|snapshot| \ge 20$, any previous realtime item whose timestamp $\le T_{cutoff}$ is automatically migrated to the `paginatedItems` cache.
- If an item was newer than $T_{cutoff}$ and is missing from the snapshot, it is recognized as deleted on the server and purged from all local state.
- Realtime snapshots always take precedence over paginated cache entries for items sharing the same document ID.

---

## 4. User Interface & Connection Indicators

Location: [src/features/clipboard/clipboard-feed.tsx](file:///c:/Users/georg/Downloads/SycnShelf/src/features/clipboard/clipboard-feed.tsx)

- **Live Sync Badge:** Renders a glowing green badge with pulsating radar wave when the stream is active, displaying last synced time on hover.
- **Connecting / Reconnecting Badges:** Clear amber/orange indicators during initialization or network reconnection.
- **Offline Indicator:** Muted status pill indicating offline state when network disconnects.
- **Search Transparency:** Honest search scope notice informing the user whether the search is filtering the loaded realtime window or performing a full-workspace query via the API.
- **Optimistic Pinning & Mutations:** Toggling pins updates the UI instantly, calls `PATCH /api/workspaces/...`, and seamlessly absorbs the server confirmation snapshot without duplicate items.

---

## 5. Automated Verification Results

### 5.1 Realtime Emulator Integration Suite (`tests/realtime-sync.test.ts`)
Run against live local Cloud Firestore emulator (`127.0.0.1:8080`):

| Test Case | Objective | Result |
| :--- | :--- | :---: |
| **1. Initial Snapshot** | Initial snapshot returns authorized workspace items to an active member | **PASS** |
| **2. Realtime Creation** | New item created on server appears in active listener without browser refresh | **PASS** |
| **3. Realtime Update** | Item edit updates across active listeners in real time | **PASS** |
| **4. Realtime Deletion** | Deleted item disappears from active listener in real time | **PASS** |
| **5. Realtime Pin Change** | Pin toggle is reflected in real time across listening members | **PASS** |
| **6. Workspace Switching** | Workspace switching cleanly unsubscribes from the previous workspace listener | **PASS** |
| **7. Sign-Out Cleanup** | Sign-out cleans up active subscriptions | **PASS** |
| **8. Viewer Read-Only** | Viewer receives realtime snapshot data but direct client writes are rejected (`403`) | **PASS** |
| **9. Non-Member Isolation** | Non-members cannot subscribe to another workspace (`PERMISSION_DENIED`) | **PASS** |
| **10. Zero Client Writes** | Direct client writes remain completely rejected for Owner, Editor, and Viewer | **PASS** |

### 5.2 Unit & Hook Tests (`npm test`)
**Summary: 43 / 43 Passing (5 Test Suites)**
- `tests/permissions.test.ts` (13 tests) — RBAC matrix
- `tests/token-verification.test.ts` (4 tests) — Cryptographic JWT verification
- `tests/workspace-rules.test.ts` (7 tests) — Workspace ownership & membership rules
- `tests/items-api.test.ts` (14 tests) — Milestone 5 CRUD endpoints & security
- `tests/realtime-hook.test.ts` (5 tests) — Timestamp normalization, document parsing, deduplication, and newest-first sorting

### 5.3 Security Rules & Realtime Suites (`npm run test:rules`)
**Summary: 40 / 40 Passing (3 Test Suites)**
- `tests/firestore-rules-reads.test.ts` (18 tests) — Read isolation & member access
- `tests/firestore-rules-writes.test.ts` (12 tests) — Zero client write trust
- `tests/realtime-sync.test.ts` (10 tests) — Realtime emulator listener integration

### 5.4 Static Analysis & Build
- **TypeScript (`npm run typecheck`):** 0 errors.
- **ESLint (`npm run lint`):** 0 warnings, 0 errors.
- **Production Build (`npm run build`):** Compiled successfully (Exit code 0).

---

## 6. Firestore Read Costs & Performance Guidelines

- **Bounded Cost:** Subscribing to `limit(20)` generates at most 20 initial document reads per active member session, plus 1 read per modified/added document.
- **Zero Polling:** Firestore snapshot listeners push deltas over persistent streaming connections, eliminating HTTP polling overhead.
- **Indexes:** Created `firestore.indexes.json` with composite indexes for `type + createdAt` and `isPinned + createdAt` to ensure high-performance filtered querying.
- **No Unbounded Listeners:** Deep workspace history is loaded strictly on-demand via cursor pagination to keep Firestore billing minimal.
