# Milestone 4 — Firestore Security Rules & Read-Only Enforcement Report

**Application:** SyncShelf  
**Firebase Project ID:** `syncshelf-514903`  
**Database Location:** `asia-south1` (Mumbai, India)  
**Security Model:** Read-Only Client with Centralized Server Mutations (Zero Client Write Trust)  
**Status:** Completed & Deployed to Production (100% Passed)  

---

## 1. Security Architecture & Threat Model

SyncShelf enforces a strict, defense-in-depth security model:

```text
┌────────────────────────────────────────────────────────┐
│                   CLIENT (Browser)                     │
│  - Reads: Direct from Cloud Firestore (Read-Only)      │
│  - Mutations: POST/PUT/DELETE to Next.js API Routes    │
└──────────────┬──────────────────────────▲──────────────┘
               │ (Mutations via API)      │ (Realtime Reads & Listeners)
               ▼                          │
┌───────────────────────────────┐         │ [Enforced by firestore.rules]
│    Next.js Server API         │         │ - Member verification (exists check)
│  - Token Verification (JWT)   │         │ - Strict tenant isolation
│  - RBAC (Server Permissions)  │         │ - Zero client writes allowed
│  - Atomic Business Logic      │         │
└──────────────┬────────────────┘         │
               │ (Privileged Admin SDK)   │
               ▼                          │
┌─────────────────────────────────────────┴──────────────┐
│            Cloud Firestore (Native Mode)               │
│               Project: syncshelf-514903                │
└────────────────────────────────────────────────────────┘
```

### Key Security Principles:
1. **Zero Client Write Trust (`allow write: if false;`):**
   - Direct client mutations (create, update, delete) are completely rejected at the database level across **all** collections for **all** roles (including workspace owners).
   - All mutations must pass through authenticated Next.js API route handlers using the server-side Firebase Admin SDK.
2. **Server-Side Authorization Independence:**
   - Because Firebase Admin SDK bypasses Firestore Security Rules, the server maintains its own independent cryptographic verification (`verifyAuthToken()`) and role lookup (`getWorkspaceMemberRole()`).
3. **Workspace Isolation & Minimal Read Scope:**
   - A client can only read documents within a workspace if they have an active record in `workspaces/{workspaceId}/members/{uid}`.
   - Non-members, unauthenticated visitors, and anonymous users are completely blocked from reading any workspace documents, members, or items.
4. **User Privacy & Enumeration Protection:**
   - Collection listing on `/users` and `/workspaces` is strictly forbidden (`allow list: if false;`).
   - Users can only read their own user profile document (`/users/{uid}`) and their own membership index (`/users/{uid}/workspaceMemberships/{workspaceId}`).

---

## 2. Production Security Rules (`firestore.rules`)

The deployed rules specification:

```rules
rules_version = '2';

service cloud.firestore {
  match /databases/{database}/documents {

    // Helper functions
    function isAuthenticated() {
      return request.auth != null && request.auth.uid != null;
    }

    function isUser(userId) {
      return isAuthenticated() && request.auth.uid == userId;
    }

    function isWorkspaceMember(workspaceId) {
      return isAuthenticated() &&
        exists(/databases/$(database)/documents/workspaces/$(workspaceId)/members/$(request.auth.uid));
    }

    // User profiles and membership index
    match /users/{userId} {
      allow get: if isUser(userId);
      allow list: if false;
      allow write: if false;

      match /workspaceMemberships/{workspaceId} {
        allow read: if isUser(userId);
        allow write: if false;
      }
    }

    // Workspaces and subcollections
    match /workspaces/{workspaceId} {
      // Direct get allowed only for authenticated members
      allow get: if isWorkspaceMember(workspaceId);
      // Deny root collection listing; users discover workspaces via their membership index
      allow list: if false;
      // All client writes are strictly denied (mutations must go through Next.js API / Admin SDK)
      allow write: if false;

      // Workspace members subcollection
      match /members/{memberUid} {
        allow read: if isWorkspaceMember(workspaceId);
        allow write: if false;
      }

      // Workspace items (clipboard entries)
      match /items/{itemId} {
        allow read: if isWorkspaceMember(workspaceId);
        allow write: if false;
      }
    }

    // Sensitive collections managed strictly server-side by Admin SDK
    match /invites/{inviteId} {
      allow read, write: if false;
    }

    match /shares/{shareId} {
      allow read, write: if false;
    }

    match /auditLogs/{logId} {
      allow read, write: if false;
    }

    // Default catch-all: deny all reads and writes
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

---

## 3. Firebase Emulator Configuration

Configured in [firebase.json](file:///c:/Users/georg/Downloads/SycnShelf/firebase.json):
- **Firestore Emulator:** Port `8080` on `127.0.0.1`
- **Auth Emulator:** Port `9099` on `127.0.0.1`
- **Automated Runner Script:** [scripts/run-rules-tests.mjs](file:///c:/Users/georg/Downloads/SycnShelf/scripts/run-rules-tests.mjs)
  - Spawns the local Firestore emulator binary.
  - Automatically verifies readiness via HTTP health polling.
  - Sets `FIRESTORE_EMULATOR_HOST=127.0.0.1:8080`.
  - Runs Vitest rules test suites with clean teardown.

---

## 4. Emulator Security Rules Test Results

Automated unit tests were executed against the Firestore Emulator using `@firebase/rules-unit-testing`.

**Total Security Rules Tests:** 30  
**Passed:** 30 (100%)  
**Failed:** 0  

### Test Suite Breakdown:

#### A. Read & Isolation Enforcement ([tests/firestore-rules-reads.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/firestore-rules-reads.test.ts)) — 18 Tests

| Category | Test Case | Expected Result | Status |
|---|---|---|---|
| **Anonymous Visitors** | Deny unauthenticated read to workspace metadata | Permission Denied | **PASS** |
| | Deny unauthenticated read to workspace member records | Permission Denied | **PASS** |
| | Deny unauthenticated read to workspace clipboard items | Permission Denied | **PASS** |
| | Deny unauthenticated read to user profile & membership index | Permission Denied | **PASS** |
| **Workspace Isolation** | Non-member (Bob) cannot read Workspace A metadata | Permission Denied | **PASS** |
| | Non-member (Bob) cannot read Workspace A member roster | Permission Denied | **PASS** |
| | Non-member (Bob) cannot read Workspace A clipboard items | Permission Denied | **PASS** |
| | Deny root collection listing on `/workspaces` (prevent enumeration) | Permission Denied | **PASS** |
| **User Privacy** | User (Alice) can read own user profile | Granted | **PASS** |
| | User (Alice) can read own workspace membership index | Granted | **PASS** |
| | User (Alice) cannot read Bob's user profile | Permission Denied | **PASS** |
| | User (Alice) cannot read Bob's workspace membership index | Permission Denied | **PASS** |
| | Deny root collection listing on `/users` (prevent user harvesting) | Permission Denied | **PASS** |
| **Member Reads** | Workspace **Owner** (Alice) can read workspace, members, and items | Granted | **PASS** |
| | Workspace **Editor** (Charlie) can read workspace, members, and items | Granted | **PASS** |
| | Workspace **Viewer** (Dave) can read workspace, members, and items | Granted | **PASS** |
| **Server Collections** | Deny client reads to `/invites` | Permission Denied | **PASS** |
| | Deny client reads to `/shares` and `/auditLogs` | Permission Denied | **PASS** |

#### B. Zero Client Write Trust ([tests/firestore-rules-writes.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/firestore-rules-writes.test.ts)) — 12 Tests

| Category | Test Case | Expected Result | Status |
|---|---|---|---|
| **Anonymous Writes** | Deny unauthenticated write attempts across all collections | Permission Denied | **PASS** |
| **User Data Writes** | Deny client-side writes to `/users/{userId}` | Permission Denied | **PASS** |
| | Deny client-side writes to `/users/{userId}/workspaceMemberships/{ws}` | Permission Denied | **PASS** |
| **Owner Client Writes** | Deny **Owner** direct client update to workspace document | Permission Denied | **PASS** |
| | Deny **Owner** direct client write to member subcollection | Permission Denied | **PASS** |
| | Deny **Owner** direct client write to items subcollection | Permission Denied | **PASS** |
| **Editor Client Writes** | Deny **Editor** direct client write to items subcollection | Permission Denied | **PASS** |
| **Viewer Client Writes** | Deny **Viewer** direct client write to items subcollection | Permission Denied | **PASS** |
| **Sensitive Collections**| Deny client writes to `/invites` | Permission Denied | **PASS** |
| | Deny client writes to `/shares` | Permission Denied | **PASS** |
| | Deny client writes to `/auditLogs` | Permission Denied | **PASS** |
| **Fallback Catch-All** | Deny writes to arbitrary unknown collections (`/billing`, `/secrets`) | Permission Denied | **PASS** |

---

## 5. Production Cloud Deployment (Reported Separately)

After 100% verification against the emulator suite, the rules were released to the live Google Cloud Firestore project:

```text
Command: firebase deploy --only firestore:rules --project=syncshelf-514903

=== Deploying to 'syncshelf-514903'...

i  deploying firestore
i  firestore: ensuring required API firestore.googleapis.com is enabled...
+  firestore: required API firestore.googleapis.com is enabled
i  cloud.firestore: checking firestore.rules for compilation errors...
+  cloud.firestore: rules file firestore.rules compiled successfully
i  firestore: uploading rules firestore.rules...
+  firestore: released rules firestore.rules to cloud.firestore

+  Deploy complete!

Project Console: https://console.firebase.google.com/project/syncshelf-514903/overview
```

- **Deployment Status:** `SUCCESS` (Exit code 0)
- **Active Rule Version:** Rules Version 2
- **Production Scope:** Cloud Firestore `(default)` in `asia-south1`

---

## 6. Full Regression & Quality Status

All test suites and static checks pass without warnings or errors:

- **Core Unit / Integration Tests (`npm test`):** 24 / 24 passed
  - [tests/permissions.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/permissions.test.ts) (13 tests)
  - [tests/token-verification.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/token-verification.test.ts) (4 tests)
  - [tests/workspace-rules.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/workspace-rules.test.ts) (7 tests)
- **Firestore Security Rules Tests (`npm run test:rules`):** 30 / 30 passed
  - [tests/firestore-rules-reads.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/firestore-rules-reads.test.ts) (18 tests)
  - [tests/firestore-rules-writes.test.ts](file:///c:/Users/georg/Downloads/SycnShelf/tests/firestore-rules-writes.test.ts) (12 tests)
- **TypeScript Typecheck (`npm run typecheck`):** 0 errors
- **Lint Check (`npm run lint`):** 0 errors, 0 warnings
- **Total Automated Tests:** 54 passing tests across the application.

---

## 7. Sign-off & Milestone 5 Readiness

Milestone 4 is complete. The application database is locked down with zero-trust client rules in production, and client reads are strictly scoped to authenticated workspace members.

Standing by for user review before proceeding to Milestone 5.
