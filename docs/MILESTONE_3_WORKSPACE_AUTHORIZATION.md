# Milestone 3 — Workspace & Authorization Report

**Application:** SyncShelf  
**Firebase Project ID:** `syncshelf-514903`  
**Project Number:** `948887708910`  
**Firestore Database Location:** `asia-south1` (Mumbai, India)  
**Database Mode:** Cloud Firestore Native Mode (`FIRESTORE_NATIVE`)  
**Status:** Live Integration Verification Complete (100% Passed)  

---

## 1. Cloud Firestore Infrastructure & Setup

- **API Activation:** Cloud Firestore API (`firestore.googleapis.com`) enabled via Service Usage API.
- **Database Created:** Native mode Cloud Firestore database `(default)` in location **`asia-south1`** (Mumbai, India).
- **Admin SDK Authentication:** Integrated Google Application Default Credentials (ADC) fallback in [src/lib/firebase/admin.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/lib/firebase/admin.ts), enabling local privileged writes and transactions without exposing private keys.

---

## 2. Firestore Data Model Structure

```text
workspaces/{workspaceId}                         # Workspace document (ID == ownerUid)
  ├── name: string
  ├── ownerUid: string
  ├── createdAt: Timestamp
  ├── updatedAt: Timestamp
  ├── memberCount: number (1 on creation)
  └── settings: { allowWorkspaceShareLinks: false, defaultMemberRole: "viewer" }

workspaces/{workspaceId}/members/{uid}           # Canonical membership document
  ├── uid: string
  ├── role: "owner" | "editor" | "viewer"
  ├── status: "active" | "pending" | "suspended"
  ├── joinedAt: Timestamp
  └── invitedBy: string

users/{uid}/workspaceMemberships/{workspaceId}   # Fast index of workspaces user belongs to
  ├── workspaceId: string
  ├── workspaceName: string
  ├── role: "owner" | "editor" | "viewer"
  ├── ownerUid: string
  └── joinedAt: Timestamp
```

---

## 3. Centralized Authorization Architecture

- **[src/lib/authz/permissions.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/lib/authz/permissions.ts):**
  - Roles: `owner` (full administration), `editor` (create/edit/delete clipboard items), `viewer` (read-only).
  - Role hierarchy: `owner > editor > viewer`.
  - Permission checks: `hasWorkspaceRole()`, `canViewWorkspace()`, `canCreateItem()`, `canEditItem()`, `canDeleteItem()`, `canManageMembers()`, `canManageWorkspace()`.
  - Canonical server membership lookup: `getWorkspaceMemberRole()`. Never trusts client-claimed roles.
- **[src/lib/auth/verify-id-token.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/lib/auth/verify-id-token.ts):**
  - Server-side helper verifying `Authorization: Bearer <token>` via `adminAuth.verifyIdToken()`.
  - Derives identity and UID strictly from the cryptographically verified token.
- **[src/lib/validation/workspace.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/lib/validation/workspace.ts):**
  - Zod validation schema for workspace creation (name trimmed, 2-50 characters).

---

## 4. End-to-End Live Integration Verification Results

All tests were executed against the live Cloud Firestore database in `syncshelf-514903` (`asia-south1`).

| Test # | Test Scenario | Expected Outcome | Actual HTTP Status | Live Firestore Verification | Verdict |
|---|---|---|---|---|---|
| **Test 1** | **Live Firestore Connection** | Connect to `syncshelf-514903` in `asia-south1` via Admin SDK | N/A (Admin API: 200) | Location: `asia-south1`, Mode: `FIRESTORE_NATIVE` | **PASS** |
| **Test 2** | **Workspace Creation** | Deterministic ID `workspaces/{uid}`, member document, user membership index | **HTTP 201 Created** | `workspaces/{uid}` exists, `members/{uid}` has `role: owner`, `users/{uid}/workspaceMemberships/{uid}` indexed | **PASS** |
| **Test 3** | **Duplicate Workspace Rejection** | Prevent second owned workspace per account | **HTTP 409 Conflict** | Transaction aborted. No duplicate workspace document or index created. | **PASS** |
| **Test 4.1**| **Missing Authorization Header** | Reject unauthenticated requests | **HTTP 401 Unauthorized** | Request halted before database execution | **PASS** |
| **Test 4.2**| **Invalid Bearer Token** | Reject malformed or invalid JWTs | **HTTP 401 Unauthorized** | Token decoding rejected | **PASS** |
| **Test 4.3**| **Malformed Workspace Name** | Reject names with length < 2 or > 50 | **HTTP 400 Bad Request** | Zod validation rejected invalid schema | **PASS** |
| **Test 5.1**| **User Isolation (Initial)** | User 2 cannot see User 1's private workspace | **HTTP 200 OK** (`workspaces: []`) | User 2 membership index returns 0 records | **PASS** |
| **Test 5.2**| **User Isolation (Multi-User)** | User 2 creates own workspace; listings remain strictly isolated | **HTTP 201 Created** | User 1 sees only User 1's workspace; User 2 sees only User 2's workspace | **PASS** |
| **Test 6** | **Regression & Code Quality** | `npm test`, `npm run typecheck`, `npm run lint` (Prod build skipped per user request) | All exit code 0 | **24 / 24 unit tests passed (100%)**; 0 TypeScript errors; 0 ESLint warnings; Prod build: **NOT TESTED** | **PASS** |
| **Test 7** | **Billing & Cost Review** | Confirm no paid Firestore features enabled (PITR, backups, TTL) | Billing API: 200 | Standard native Firestore mode active without paid feature addons | **PASS** |

---

## 5. Summary & Sign-off

Milestone 3 has achieved 100% verification against both the automated test harness and the actual live Google Cloud Firestore project `syncshelf-514903`.

- **One-owner constraint:** Fully enforced via Firestore transactions and deterministic document IDs.
- **Central authorization:** Fully centralized in [src/lib/authz/permissions.ts](file:///c:/Users/georg/Downloads/SycnShelf/src/lib/authz/permissions.ts).
- **User isolation:** Verified with multiple genuine user accounts.
- **Ready for Milestone 4 (Firestore Security Rules & Emulator Verification).**
