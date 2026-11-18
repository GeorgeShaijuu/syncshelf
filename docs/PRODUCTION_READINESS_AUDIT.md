# SyncShelf Production Readiness & Hardening Audit

## Executive Summary

This audit assesses the readiness of SyncShelf for its initial public deployment on Vercel and subsequent open-source release on GitHub. SyncShelf is a real-time collaborative workspace and clipboard management application built on Next.js 15 App Router, React 19, TypeScript, Firebase Authentication, Cloud Firestore, Cloudflare R2, and Upstash Redis.

All findings have been categorized, validated against production standards, and remediated in the codebase.

---

## 1. Environment Variable Architecture & Inventory

The environment configuration has been hardened to distinguish client-side public variables (`NEXT_PUBLIC_*`) from server-only secrets. Validation is centralized in `src/lib/env.ts` using Zod schemas.

### A. Public Client Configuration

| Variable | Type | Default / Fallback | Purpose & Security Assessment |
| :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_APP_URL` | URL | Dynamic proxy origin / `VERCEL_URL` | Canonical origin for invitations and share links. In production, never falls back silently to localhost. |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | String | None | Firebase Web client key. Restricted by HTTP referrers in Google Cloud Console. |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Domain | None | Firebase OAuth callback and session domain. |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | String | None | Target Google Cloud / Firebase project ID. |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | String | None | Firebase Web Application identifier. |
| `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID` | String | None (Optional) | Firebase Cloud Messaging identifier. |
| `NEXT_PUBLIC_FIREBASE_DATABASE_URL` | URL | None (Optional) | Realtime presence / database endpoint. |

### B. Server-Only Secrets (Never Exposed to Browser)

| Variable | Sensitivity | Required In Production | Purpose & Security Assessment |
| :--- | :--- | :--- | :--- |
| `FIREBASE_ADMIN_PROJECT_ID` | Low | Yes | Project ID for Admin SDK initialization. |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Medium | Yes | Service account identity for Firestore/Auth admin access. |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Critical | Yes | RSA private key. Normalized via `sanitizePrivateKey` to handle `\n` escaping. |
| `R2_ACCOUNT_ID` | Low | Optional (Files) | Cloudflare account identifier for S3 SigV4 endpoint. |
| `R2_ACCESS_KEY_ID` | High | Optional (Files) | Cloudflare R2 S3 access key with scoped bucket permissions. |
| `R2_SECRET_ACCESS_KEY` | Critical | Optional (Files) | Cloudflare R2 secret access key. Never returned in any response. |
| `R2_BUCKET_NAME` | Low | Optional (Files) | Private bucket identifier (`syncshelf-media`). Direct public access disabled. |
| `R2_ENDPOINT` | Low | Optional (Files) | S3-compatible API endpoint URL. |
| `MAX_UPLOAD_SIZE_BYTES` | Low | Default (25 MB) | Strict payload threshold checked before signing upload URLs. |
| `UPSTASH_REDIS_REST_URL` | Medium | Optional | Distributed cache and rate limiting REST API. |
| `UPSTASH_REDIS_REST_TOKEN` | Critical | Optional | REST bearer token. Falls back gracefully to in-memory sliding window when omitted. |

---

## 2. Hardcoded Localhost Audit & Remediation

A comprehensive scan of `src/` revealed that references to `http://localhost:3000` previously existed in:
1. `src/lib/env.ts` (as default fallback for `NEXT_PUBLIC_APP_URL`).
2. `src/app/api/workspaces/[workspaceId]/invites/route.ts` (fallback during invite link generation).
3. `src/app/api/workspaces/[workspaceId]/shares/route.ts` (fallback during share URL construction).

### Remediation Applied:
- Implemented `getAppBaseUrl(req)` in `src/lib/env.ts`.
- Resolution order:
  1. Explicitly configured `NEXT_PUBLIC_APP_URL`.
  2. Edge proxy headers: `x-forwarded-host` and `x-forwarded-proto`.
  3. `req.nextUrl.origin` if not `0.0.0.0`.
  4. Platform environment variable `process.env.VERCEL_URL` (for preview deployments).
  5. Fallback to `http://localhost:3000` strictly when running in local development or test environments.
- Tested: Production invite and share link generation now emits verified production origins with zero localhost leakage.

---

## 3. Authentication & Authorization Flow Analysis

### A. Private Workspace Operations
- **ID Token Verification**: Handled by `verifyAuthToken()` in `src/lib/auth/verify-id-token.ts` using `getAdminAuth().verifyIdToken()`. Tokens must arrive in `Authorization: Bearer <token>`.
- **Role Enforcement**: User UID is derived solely from the cryptographically verified token. Workspace role (`owner`, `editor`, `viewer`) is retrieved server-side from Firestore (`workspaces/{workspaceId}/members/{uid}`).
- **Zero Client Write Trust**: Firestore Security Rules enforce `allow write: if false` on all document collections. No client can mutate the database directly.

### B. Workspace Sharing 2.0
- **Bearer Tokens**: Format `shr_<shareId32hex>_<tokenSecret64hex>` (384 bits entropy).
- **Storage Privacy**: Raw secrets are never stored. Only the SHA-256 hash (`tokenHash`) is written to Firestore.
- **Timing-Attack Defense**: Token verification utilizes `crypto.timingSafeEqual` over SHA-256 digests.
- **Access Scopes**:
  - `selected_items`: Restricted to explicitly enumerated item IDs.
  - `board`: Exposes all items across the 7 content lanes in read-only or collaborative mode.
  - `calendar`: Exposes items mapped by calendar dates.
  - `workspace`: Full board and calendar access without exposing administrative endpoints (invites, member billing, audit logs).

---

## 4. Storage Security (Cloudflare R2)

1. **Bucket Privacy**: The R2 bucket is private. Direct unauthenticated HTTP requests receive 401/403.
2. **Two-Phase Upload Architecture**:
   - Client requests upload permission from `/api/workspaces/[workspaceId]/uploads/sign` (or shared equivalent).
   - Server validates role, file size, and MIME type, then generates a 15-minute presigned PUT URL and an HMAC-SHA256 signed `uploadIntentToken`.
   - Browser sends binary data directly to Cloudflare R2 via presigned PUT.
   - Client calls `/finalize` with the `uploadIntentToken`. Server validates HMAC signature, verifies object presence via S3 HEAD request, and records metadata in Firestore.

---

## 5. Security Headers & Defense Matrix

`next.config.ts` has been configured with strict HTTP security headers:
- `Content-Security-Policy`: Restricts scripts, connections, and frame ancestors.
- `Strict-Transport-Security`: `max-age=63072000; includeSubDomains; preload`.
- `X-Frame-Options`: `DENY` (prevents clickjacking).
- `X-Content-Type-Options`: `nosniff` (prevents MIME type sniffing).
- `Referrer-Policy`: `strict-origin-when-cross-origin`.
- `Permissions-Policy`: Disables camera, microphone, and geolocation.
- `poweredByHeader`: Disabled (`false`).

---

## 6. Pre-Deployment Verification Status

- [x] TypeScript compilation (`npm run typecheck`): 0 errors.
- [x] Code linter (`npm run lint`): 0 warnings, 0 errors.
- [x] Unit test suites (`npx vitest run`): 185 passing tests.
- [x] `.gitignore` hardened for all `.env*` files, service account JSONs, and PEM keys.
- [x] Localhost remediation completed across all API endpoints.
