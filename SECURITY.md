# Security Policy

SyncShelf takes the security of its application, users, and infrastructure seriously. We welcome responsible security research and vulnerability disclosures.

## Supported Versions

Only the latest release running on the primary branch is actively supported with security updates.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x (main) | :white_check_mark: |
| < 0.1.0 | :x:                |

## Reporting a Vulnerability

If you discover a security vulnerability within SyncShelf, **please do not disclose it publicly** through GitHub Issues, Discussions, or social media.

Instead, please report security issues privately via one of the following methods:

1. **GitHub Private Vulnerability Reporting**: Submit a private advisory directly on GitHub via the **Security** tab -> **Report a vulnerability**.
2. **Email**: Send detailed disclosure information to `security@syncshelf.dev`.

### What to Include in Your Report

To help us triage and resolve the issue quickly, please provide:
- A clear, descriptive title and summary of the vulnerability.
- Affected endpoints, files, or components.
- Step-by-step reproduction instructions or a minimal Proof of Concept (PoC).
- Expected vs. actual behavior.
- An assessment of the impact, potential attack vectors, and proposed mitigation (if known).

### Response Timelines & SLAs

- **Initial Acknowledgment:** Within 48 hours of receipt.
- **Triage & Assessment:** Within 5 business days.
- **Fix & Public Advisory:** Target resolution within 14–30 business days depending on severity and complexity.

We will keep you informed of our progress throughout the remediation process.

---

## Core Security Architecture & Commitments

SyncShelf implements a multi-layered defense-in-depth model:

1. **Zero Client Write Trust**:
   - Cloud Firestore Security Rules strictly deny all client-side mutations (`allow write: if false`).
   - Every mutation, creation, edit, deletion, and permission check is verified server-side through Next.js API routes using the Firebase Admin SDK.
2. **Strict Identity Verification**:
   - All private API routes verify Firebase ID tokens cryptographically using the Firebase Admin SDK.
   - User identity is derived strictly from the verified token (`decodedToken.uid`), never from client query parameters or request bodies.
3. **High-Entropy Hashed Bearer Tokens**:
   - Public share tokens (`shr_<shareId32hex>_<tokenSecret64hex>`) contain 384 bits of entropy.
   - Raw secrets are never stored in Firestore or database logs; only cryptographic SHA-256 hashes are persisted.
   - Token comparisons utilize constant-time verification (`crypto.timingSafeEqual`) to prevent timing side-channel attacks.
4. **Private Storage Isolation**:
   - Files and media are stored in a private Cloudflare R2 bucket.
   - Direct public access to the bucket is prohibited. All uploads and downloads require short-lived (15-minute) presigned URLs signed with AWS SigV4.
   - Direct file uploads require tamper-proof cryptographically signed HMAC intent tokens.
5. **Rate Limiting & Abuse Prevention**:
   - Public and sensitive endpoints are protected by sliding-window rate limiting backed by Upstash Redis, with automatic graceful fallback to in-memory tracking.
6. **Hardened HTTP Security Headers**:
   - Configured with Content Security Policy (CSP), HTTP Strict Transport Security (HSTS), `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and `Permissions-Policy`.
