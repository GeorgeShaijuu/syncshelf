# SyncShelf Security Audit & Threat Assessment

## 1. Threat Model & Security Posture

SyncShelf is a multi-tenant clipboard and asset management platform where users store sensitive code, credentials, architecture notes, and documents. The core security objective is to guarantee **strict workspace isolation, zero unauthorized data exposure, and protection against malicious mutations**.

### Trust Boundaries
```
[Untrusted Visitor / Browser]
       │
       ▼ (HTTPS / TLS 1.3)
[Next.js API Gateway (Edge / Serverless)] ◄── Strict Token & Role Verification
       │
       ├────► [Cloud Firestore (Admin SDK)] ◄── Client Direct Writes Banned
       │
       ├────► [Cloudflare R2 (Private S3)] ◄── Presigned SigV4 + Signed Intent
       │
       └────► [Upstash Redis REST API] ◄── Rate Limiting & Abuse Prevention
```

---

## 2. Multi-Layer Defense-in-Depth

### Layer 1: Zero Client Write Trust (Cloud Firestore)
- In traditional Firebase architectures, client SDKs write directly to Firestore subject to rules. In SyncShelf, **all client write access is completely blocked**:
  ```cel
  match /{document=**} {
    allow write: if false;
  }
  ```
- **Security Impact**: No compromised client, browser extension, or malicious script can directly execute `setDoc`, `updateDoc`, or `deleteDoc`. Every mutation is processed through server-side API routes that validate identity, workspace membership, input schema, and business rules.

### Layer 2: Server-Side Identity & Authorization Guard
- Every private endpoint calls `verifyAuthToken(authHeader)`:
  - Validates the Firebase ID token signature using Google's public certificates.
  - Derives the caller identity strictly from `decodedToken.uid`. Never trusts client query parameters or body payloads for caller identity.
- Every workspace route executes `getWorkspaceMemberRole(adminDb, workspaceId, callerUid)`:
  - Fetches the verified member document from `workspaces/{workspaceId}/members/{callerUid}`.
  - Asserts that status is `active`.
  - Enforces minimum role hierarchy: `owner` (3) > `editor` (2) > `viewer` (1).

### Layer 3: High-Entropy Cryptographic Sharing
- Public share URLs use structured tokens: `shr_<shareId32hex>_<tokenSecret64hex>`.
- **Entropy**: 16 bytes (share ID) + 32 bytes (secret) = 48 bytes (384 bits of entropy).
- **Storage**: Raw secret is never saved in Firestore or logs. Only `tokenHash = SHA256(tokenSecret)` is stored.
- **Timing Defense**: Comparison between incoming secrets and stored hashes uses `crypto.timingSafeEqual`:
  ```typescript
  export function verifyShareSecret(providedSecret: string, storedHash: string): boolean {
    const computedHash = hashShareSecret(providedSecret);
    return crypto.timingSafeEqual(Buffer.from(computedHash, "utf8"), Buffer.from(storedHash, "utf8"));
  }
  ```

### Layer 4: Storage Protection (Cloudflare R2)
- Private S3 bucket with public access disabled.
- Direct uploads use a two-phase signed intent pattern:
  1. Server issues a 15-minute presigned PUT URL and an HMAC-SHA256 `uploadIntentToken`.
  2. Browser uploads directly to R2 with enforced `Content-Type` and `Content-Length`.
  3. Client calls `/finalize` with the token.
  4. Server verifies HMAC signature with timing-safe comparison, verifies the object in R2 via `HeadObjectCommand`, and writes item metadata to Firestore.
- File downloads use 15-minute presigned GET URLs generated only after verifying workspace membership.

### Layer 5: Rate Limiting & Abuse Prevention
- Endpoints susceptible to brute-force or denial-of-service (invitation redemption, share token lookups, file upload intent signing) are wrapped with `limitRequest`:
  - 10 requests / 60 seconds for sensitive token operations.
  - 100 requests / 60 seconds for standard read queries.
  - Powered by Upstash Redis with atomic pipeline operations, falling back automatically to sliding-window in-memory tracking.

---

## 3. Role & Permission Matrix

| Operation | Owner | Editor | Viewer | Public Visitor (Shared Link) | Unauthenticated |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Workspace Settings & Deletion** | :white_check_mark: | :x: | :x: | :x: | :x: |
| **Manage Members & Invites** | :white_check_mark: | :x: | :x: | :x: | :x: |
| **Create Share Links** | :white_check_mark: | :x: | :x: | :x: | :x: |
| **Revoke Share Links** | :white_check_mark: | :x: | :x: | :x: | :x: |
| **Create / Upload Items** | :white_check_mark: | :white_check_mark: | :x: | Optional (Editor permission) | :x: |
| **Edit / Delete Items** | :white_check_mark: | :white_check_mark: | :x: | Optional (Editor permission) | :x: |
| **View Board & Items** | :white_check_mark: | :white_check_mark: | :white_check_mark: | Scoped items only | :x: |
| **View Calendar** | :white_check_mark: | :white_check_mark: | :white_check_mark: | Scoped items only | :x: |
| **Download Files (Presigned GET)** | :white_check_mark: | :white_check_mark: | :white_check_mark: | Scoped items only | :x: |

---

## 4. Threat Matrix & Mitigations

| Threat Category | Potential Impact | Implemented Mitigation |
| :--- | :--- | :--- |
| **Insecure Direct Object Reference (IDOR)** | Attacker accesses or modifies another workspace's data by guessing IDs. | Server-side Firestore queries strictly filter by `workspaceId` and verify `getWorkspaceMemberRole` before returning records. |
| **Cross-Site Scripting (XSS)** | Malicious JavaScript injected via markdown, links, or code snippets. | React auto-escaping, strict Content Security Policy (`script-src 'self' ...`, `object-src 'none'`), and Shiki syntax highlighting. |
| **Clickjacking** | Application embedded in an iframe on an attacker's domain. | `X-Frame-Options: DENY` and CSP `frame-ancestors 'none'`. |
| **MIME Sniffing** | Browser executes malicious script disguised as an image or text file. | `X-Content-Type-Options: nosniff` and presigned S3 headers enforcing explicit MIME types. |
| **Token Brute-Force & Enumeration** | Attacker iterates share or invite tokens to discover private content. | 384-bit token entropy, rate limiting on lookup endpoints, and constant-time verification. |
| **Secret Leakage via Client Bundle** | API secrets or Admin private keys bundled into browser JavaScript. | Strict separation in `src/lib/env.ts`; `serverExternalPackages: ["firebase-admin"]` in `next.config.ts`; Next.js forbids non-`NEXT_PUBLIC_` variables in client builds. |
| **Accidental Git Exposure** | Committing `.env` or credential files to GitHub. | `.gitignore` comprehensively excludes all `.env*`, `*.pem`, `*.key`, and `*adminsdk*.json` files. |

---

## 5. Security Scan & Static Analysis Results

- **Secrets in Working Tree**: Verified clean. Only `.env.example` (with documented placeholder strings) is tracked.
- **TypeScript Security & Type Safety**: 0 errors (`npm run typecheck`).
- **ESLint Security Rules**: 0 warnings, 0 errors (`npm run lint`).
- **Unit & Integration Security Suites**: All permission, crypto, token hashing, and authorization tests passing (185/185).
