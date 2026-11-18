# SyncShelf — Milestone 9: Anonymous Public Sharing

**Milestone Status:** COMPLETED  
**Implementation Date:** November 17, 2026  
**Google Cloud / Firebase Project:** `syncshelf-514903`  
**Database Location:** Cloud Firestore (`asia-south1`)  
**Storage Provider:** Cloudflare R2 (`syncshelf-media`)

---

## 1. Executive Summary & Objective

Milestone 9 implements **Anonymous Public Sharing** for SyncShelf, providing workspace owners the ability to share single or multi-item clipboard selections via secure, bearer-token URLs. Anonymous recipients can view, read, preview, and download shared clipboard entries without authenticating or creating an account, while maintaining strict, zero-trust security boundaries:

- **Strict Zero-Write / Zero-Mutation Enforcement:** Anonymous visitors cannot edit, delete, create, pin, or alter any clipboard entries.
- **Strict Isolation & Privacy:** Private workspace metadata, workspace owner UIDs, internal membership rosters, and audit records are never exposed.
- **High-Entropy Cryptographic Tokens:** 384-bit total entropy bearer tokens (`shr_<32-hex-shareId>_<64-hex-tokenSecret>`) using SHA-256 token hashing and constant-time validation (`crypto.timingSafeEqual`).
- **No Secret Storage:** Raw token secrets are never stored in Firestore and never logged.
- **O(1) Direct Lookup Without Identity Leaks:** Point-reads via `publicSharePointers/{shareId}` decouple workspace identifiers from public URLs.
- **Time-Limited Cloudflare R2 Presigned URLs:** Binary attachments (images, audio, PDF, documents) resolve to 5-minute time-bound presigned GET URLs generated strictly through verified server endpoints.
- **Denial by Default in Firestore Rules:** Zero direct client access to `workspaces/{workspaceId}/shares` and `/publicSharePointers`.

---

## 2. Architecture & Data Model

### 2.1 Cryptographic Token Architecture

SyncShelf uses high-entropy, structured bearer tokens to enable unguessable, performant public sharing:

$$\text{Public Token} = \mathtt{shr\_} + \mathtt{shareId} \ (32 \text{ hex chars}) + \mathtt{\_} + \mathtt{tokenSecret} \ (64 \text{ hex chars})$$

- **Entropy:**
  - `shareId`: 16 random bytes (128 bits entropy) generated via `crypto.randomBytes(16)`.
  - `tokenSecret`: 32 random bytes (256 bits entropy) generated via `crypto.randomBytes(32)`.
  - **Total Token Entropy:** 384 bits.
- **Hash Algorithm:** SHA-256 (`crypto.createHash("sha256")`).
- **Validation:** Timing-safe buffer comparison (`crypto.timingSafeEqual(inputBuffer, storedBuffer)`) to prevent timing side-channel attacks.
- **Zero-Storage Guarantee:** Only `hashShareSecret(tokenSecret)` is stored in Firestore. The raw token secret is only returned once upon creation and is never retained on the server.

### 2.2 Firestore Schema

#### Canonical Share Document (`workspaces/{workspaceId}/shares/{shareId}`)
Stored under the workspace to ensure clear ownership and auditability:
```typescript
interface StoredShareDocument {
  shareId: string;
  workspaceId: string;
  createdByUid: string;
  createdAt: Timestamp;
  expiresAt: Timestamp | null;
  status: "active" | "revoked" | "expired";
  tokenHash: string; // SHA-256 hash of tokenSecret
  itemIds: string[]; // 1 to 25 clipboard item IDs
  itemCount: number;
  viewCount: number;
  lastViewedAt: Timestamp | null;
}
```

#### Lookup Pointer Document (`publicSharePointers/{shareId}`)
A flat, root-level pointer collection that maps the public `shareId` to its parent `workspaceId`:
```typescript
interface PublicSharePointer {
  shareId: string;
  workspaceId: string;
}
```
**Benefits:**
- Enables $O(1)$ point-reads without scanning or querying collections.
- Avoids exposing `workspaceId` (which equals `ownerUid`) in public URLs or client-accessible payloads.
- Enables atomic creation and revocation using Firestore batch writes.

---

## 3. API Endpoints & Access Control

### 3.1 Owner Share Management Endpoints

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `POST` | `/api/workspaces/[workspaceId]/shares` | Workspace Owner Only | Validates selected item IDs (1–25), computes expiration (`1h`, `24h`, `7d`, `30d`, `never`), writes canonical share + pointer in a batch, logs `SHARE_CREATED` audit event, and returns the one-time full URL. |
| `GET` | `/api/workspaces/[workspaceId]/shares` | Workspace Owner Only | Lists active, expired, and revoked shares. Never exposes `tokenHash` or internal secret data. |
| `DELETE` | `/api/workspaces/[workspaceId]/shares/[shareId]` | Workspace Owner Only | Revokes share atomically (`status: "revoked"`), deletes pointer, logs `SHARE_REVOKED` audit event. Idempotent. |

### 3.2 Unauthenticated Public Resolution

| Method | Endpoint | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/public/shares/[token]` | Public (Unauthenticated) | Resolves share with 60 req/min/IP sliding-window rate limiting, timing-safe cryptographic secret comparison, expiration evaluation, and dynamic 300s Cloudflare R2 presigned GET URLs for binary items. |

#### Security Headers on Public Responses
All responses from `/api/public/shares/[token]` and `/s/[token]` emit:
```http
Cache-Control: no-store, no-cache, must-revalidate, proxy-revalidate
Pragma: no-cache
Expires: 0
Surrogate-Control: no-store
Referrer-Policy: no-referrer
X-Robots-Tag: noindex, nofollow, noarchive
```

---

## 4. Cloudflare R2 Presigned Media URLs for Public Access

When a shared item contains binary attachments (images, audio, PDFs, documents):
1. The server checks that the media object key strictly adheres to:
   $$\mathtt{workspaces/\{workspaceId\}/items/\{itemId\}/*}$$
2. The server generates an S3 `GetObject` presigned URL with an expiry of **300 seconds (5 minutes)**.
3. Presigned URLs are refreshed dynamically on each public page load.
4. The R2 bucket `syncshelf-media` remains strictly private—no direct public bucket access is permitted.

---

## 5. User Interface & Experience

### 5.1 Public Presentation View (`/s/[token]`)
- **Route:** `src/app/s/[token]/page.tsx` & `src/app/s/[token]/public-share-client-view.tsx`
- **Features:**
  - Standalone, unauthenticated responsive view with SyncShelf branding and clean read-only interface.
  - Multi-item clipboard list support (rendered in item order).
  - Text item display with one-click copy button and toast notifications.
  - Code item display with syntax formatting, monospaced typography, and copy action.
  - Link item display with safe external navigation (`rel="noopener noreferrer"`).
  - Media item preview: inline image rendering, HTML5 audio player, and secure direct download links.
  - Distinct friendly error cards for `not_found`, `revoked`, `expired`, and `rate_limited` states.

### 5.2 Workspace Shares Dashboard (`/shared`)
- **Route:** `src/app/(dashboard)/shared/page.tsx` & `src/features/shares/shares-dashboard-view.tsx`
- **Features:**
  - Owner dashboard listing active shares, expiration timers, item counts, and total views.
  - "Create Share Link" button opening `CreateShareModal` (`src/features/shares/create-share-modal.tsx`).
  - Item selector checklist with quick search, multi-selection (up to 25 items), and preset expiration dropdown (`1 hour`, `24 hours`, `7 days`, `30 days`, `Never`).
  - One-time copyable link banner with clear bearer token security warnings.
  - One-click immediate share revocation with real-time UI status update.
  - Informative guard card for non-owner members (Editors/Viewers) explaining that public link management is restricted to workspace owners.

---

## 6. Firestore Security Rules Enforcement

The following rules were deployed to production project `syncshelf-514903` and verified in the emulator:

```javascript
// Shares subcollection - strictly server-side Admin SDK operations
match /shares/{shareId} {
  allow read, write: if false;
}

// Flat public share pointers - strictly server-side Admin SDK operations
match /publicSharePointers/{pointerId} {
  allow read, write: if false;
}
```

---

## 7. Automated Verification & Test Results

### 7.1 Unit & Integration Tests (`npm test`)
- **Test Suites:** 8 passed (8 total)
- **Tests:** 121 passed (121 total)
- **Coverage:**
  - `tests/anonymous-sharing.test.ts`: 26 tests covering token generation, SHA-256 hashing, timingSafeEqual, owner share creation RBAC, item validation, listing sanitization, revocation idempotency, public resolution, expiration handling, view counts, and R2 presigned URLs.
  - `tests/team-invitations.test.ts`: 30 tests covering invitation flows and RBAC.
  - `tests/r2-uploads.test.ts`: 15 tests covering presigned PUT/GET URLs and MIME validation.
  - `tests/workspace-rules.test.ts`: 14 tests covering workspace ownership and audit logging.
  - `tests/items-api.test.ts`: 14 tests covering clipboard CRUD operations.
  - `tests/permissions.test.ts`: 13 tests covering RBAC permissions.
  - `tests/realtime-hook.test.ts`: 5 tests covering client sync hook state transitions.
  - `tests/token-verification.test.ts`: 4 tests covering Firebase ID token verification.

### 7.2 Firestore Security Rules Tests (`npm run test:rules`)
- **Emulator Tests:** 44 passed (44 total)
- Confirms zero client-side read or write access to `/shares` and `/publicSharePointers`.
- Confirms zero client-side write access across all workspace items, audit logs, and member profiles.

### 7.3 Real Cloudflare R2 Browser Upload & CORS Verification
- **Test:** `tests/r2-cors-integration.test.ts`
- **Result:** PASSED in 1.43s.
- Performed direct HTTP PUT upload with `Origin: http://localhost:3000` to bucket `syncshelf-media`.
- Verified object via S3 HEAD API (`exists: true`, `valid: true`, matched size and MIME type).
- Successfully deleted object and verified cleanup via S3 HEAD.

### 7.4 TypeScript, Lint & Production Build
- `npm run typecheck`: PASSED (0 errors).
- `npm run lint`: PASSED (0 warnings, 0 errors).
- `npm run build`: Production build completed successfully, compiling `/s/[token]`, `/shared`, and all API route handlers.
