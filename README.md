# SyncShelf

<p align="center">
  <strong>Your team's collaborative clipboard. One searchable, beautiful shelf.</strong>
</p>

<p align="center">
  <a href="#features">Features</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#quick-start">Quick Start</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#deployment">Deployment</a> •
  <a href="#security">Security</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## Overview

SyncShelf is a modern, real-time collaborative workspace and clipboard manager built with Next.js App Router, Cloud Firestore, and Cloudflare R2. It enables individuals and teams to capture, organize, search, and share text snippets, source code, web links, images, audio clips, video recordings, and documents in a unified, tactile interface.

Crafted with a distinctive **Playful Claymorphism** design language, SyncShelf balances soft, dimensional tactile surfaces with high-performance productivity tools.

---

## Features

- **7 Dedicated Content Lanes**:
  - **Text**: Formatted notes, meeting summaries, drafts, and quick thoughts.
  - **Codes**: Syntax-highlighted snippets across dozens of programming languages.
  - **Links**: Interactive web bookmarks with auto-detected metadata and domain icons.
  - **Images**: High-resolution image previews with lightbox and fast download.
  - **Audio**: Inline audio player with waveform visualization.
  - **Video**: Embedded video player with responsive controls.
  - **Files**: Secure document and attachment storage for PDFs, spreadsheets, and archives.
- **Universal Intelligent Paste**:
  - Automatically identifies whether pasted clipboard content is code, URL, image, or text and routes it to the appropriate lane instantly.
- **Focus & Maximise Mode**:
  - Maximise any lane into a high-density, full-screen editing workspace with a quick-access lane switcher and search filter.
- **Calendar View**:
  - Date-based visual shelf organizing clips and captures across months, weeks, and days, with item density badges and instant time filtering.
- **Workspace Sharing 2.0**:
  - **4 Sharing Scopes**: Share individual clips, the entire Board Canvas, the Calendar, or the complete Workspace.
  - **3 Audience Modes**: Public link access, Authenticated-only, or Restricted to specific invited email addresses.
  - **Granular Permissions**: Read-only Viewer or full Collaborative Editor.
  - **Real-Time Collaboration**: Live Server-Sent Events (SSE) stream reflecting remote edits, additions, and deletions with zero page reloads.
  - **Recently Viewed**: Central dashboard tracking accessed public shelves and collaborative workspaces.
- **Tactile Claymorphism UI**:
  - Custom clay design tokens, warm ivory `#FAF7F0` surfaces, organic curves, and responsive animations.

---

## Architecture & Security Model

SyncShelf is engineered with a **Zero Client Write Trust** security philosophy:

```
┌─────────────────────────────────────────────────────────────┐
│                       Browser Client                        │
│   (Next.js App Router + React + Tailwind + Claymorphism)     │
└───────────────┬─────────────────────────────▲───────────────┘
                │ Client Actions              │ Realtime Sync
                │ (REST / JSON / SSE)         │ (onSnapshot / SSE)
                ▼                             │
┌───────────────────────────────┐             │
│    Next.js Server API         │             │
│  - Firebase ID Token Verify   │             │
│  - Zod Input Validation       │             │
│  - Role-Based Access Control  │             │
│  - Upstash Rate Limiting      │             │
│  - Audit Logging              │             │
└───────┬───────────────┬───────┘             │
        │ Admin SDK     │ Presigned SigV4     │
        ▼               ▼                     │
┌───────────────┐ ┌───────────────────┐       │
│Cloud Firestore│ │  Cloudflare R2    │       │
│(Rules: Deny   │ │(Private S3 Bucket,│       │
│ Direct Writes)│ │ 15-min Signed URLs│       │
└───────────────┘ └───────────────────┘       │
        ▲                                     │
        └─────────────────────────────────────┘
```

1. **Zero Direct Client Writes**:
   - `firestore.rules` strictly prohibits all client-side write operations (`allow write: if false`).
   - Every mutation is validated by Zod schemas and executed server-side via the Firebase Admin SDK.
2. **Cryptographic Bearer Tokens**:
   - Public share tokens contain 384 bits of entropy (`shr_<shareId32hex>_<tokenSecret64hex>`).
   - Only SHA-256 hashes are persisted in the database; secrets are never stored or logged.
   - Verification uses constant-time comparison (`crypto.timingSafeEqual`) to mitigate timing attacks.
3. **Private Object Storage**:
   - Uploads to Cloudflare R2 bypass the app server directly to R2 using short-lived S3 SigV4 presigned URLs and cryptographically signed HMAC intent tokens.
4. **Hardened HTTP Headers**:
   - Production deployments enforce strict Content Security Policy (CSP), HSTS, `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, and restricted Permissions Policies.

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Framework** | Next.js 15 (App Router), React 19, TypeScript |
| **Styling** | Tailwind CSS, Custom Claymorphism System, Lucide Icons |
| **Authentication** | Firebase Authentication (Email/Password, Google OAuth) |
| **Database** | Google Cloud Firestore (Native Mode) |
| **Admin Backend** | Firebase Admin SDK |
| **File Storage** | Cloudflare R2 (S3-compatible, private bucket) |
| **Cache & Rate Limiting**| Upstash Redis (REST API) with graceful in-memory fallback |
| **Validation** | Zod (strict client and server schemas) |
| **Testing** | Vitest, Firebase Rules Unit Testing, Playwright |

---

## Quick Start

### 1. Prerequisites

- Node.js 18.18+ or 20+ LTS
- A free Firebase project (Spark Plan)
- A Cloudflare account with an R2 bucket (optional for file uploads)
- Upstash Redis database (optional for distributed rate limiting)

### 2. Installation

```bash
git clone https://github.com/your-username/syncshelf.git
cd syncshelf
npm install
```

### 3. Environment Configuration

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Populate `.env.local` with your development credentials. For reference on all configuration parameters, see the [Configuration Guide](#configuration).

### 4. Run Development Server

```bash
npm run dev
```

Visit [http://localhost:3000](http://localhost:3000) to access your shelf.

---

## Configuration

SyncShelf separates environment configuration into public client variables and strictly guarded server secrets.

### Client Variables (`NEXT_PUBLIC_*`)

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | Application root URL | `http://localhost:3000` or `https://syncshelf.app` |
| `NEXT_PUBLIC_FIREBASE_API_KEY` | Firebase Web API Key | `AIzaSy...` |
| `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN` | Firebase Auth domain | `your-project.firebaseapp.com` |
| `NEXT_PUBLIC_FIREBASE_PROJECT_ID` | Firebase Project ID | `your-project` |
| `NEXT_PUBLIC_FIREBASE_APP_ID` | Firebase Web App ID | `1:123456789:web:abcdef` |

### Server Variables (Server Only)

| Variable | Description |
|---|---|
| `FIREBASE_ADMIN_PROJECT_ID` | Firebase Project ID for Admin SDK |
| `FIREBASE_ADMIN_CLIENT_EMAIL` | Service Account client email |
| `FIREBASE_ADMIN_PRIVATE_KEY` | Service Account PEM private key with `\n` linebreaks |
| `R2_ACCOUNT_ID` | Cloudflare account identifier |
| `R2_ACCESS_KEY_ID` | Scoped Cloudflare R2 API access key |
| `R2_SECRET_ACCESS_KEY` | Scoped Cloudflare R2 API secret key |
| `R2_BUCKET_NAME` | Name of the private R2 bucket (e.g. `syncshelf-media`) |
| `R2_ENDPOINT` | R2 S3 endpoint URL (`https://<ACCOUNT_ID>.r2.cloudflarestorage.com`) |
| `MAX_UPLOAD_SIZE_BYTES` | Maximum upload size limit in bytes (default: `26214400` = 25 MB) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL (optional) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST Token (optional) |

---

## Testing & Quality Assurance

Run the test suites:

```bash
# Run all unit and integration tests
npx vitest run

# Run TypeScript compilation check
npm run typecheck

# Run ESLint linter
npm run lint
```

---

## Deployment

SyncShelf is optimized for zero-configuration deployment to [Vercel](https://vercel.com).

For detailed production deployment instructions, authorized domain configuration, R2 CORS setup, and environment variables checklist, consult:

👉 **[Vercel Deployment Guide](./docs/VERCEL_DEPLOYMENT_GUIDE.md)**

---

## Documentation Directory

| Document | Purpose |
|---|---|
| [docs/VERCEL_DEPLOYMENT_GUIDE.md](./docs/VERCEL_DEPLOYMENT_GUIDE.md) | Comprehensive step-by-step production deployment manual |
| [docs/SECURITY_AUDIT.md](./docs/SECURITY_AUDIT.md) | Complete threat modeling, authorization matrix, and audit report |
| [docs/PRODUCTION_READINESS_AUDIT.md](./docs/PRODUCTION_READINESS_AUDIT.md) | Technical audit of environment, protocols, and APIs |
| [docs/OPEN_SOURCE_RELEASE_CHECKLIST.md](./docs/OPEN_SOURCE_RELEASE_CHECKLIST.md) | Pre-publication verification, secrets scan, and licensing |
| [SECURITY.md](./SECURITY.md) | Vulnerability disclosure and reporting policies |
| [CONTRIBUTING.md](./CONTRIBUTING.md) | Developer guidelines, code standards, and PR workflows |

---

## License

SyncShelf is open-source software licensed under the [MIT License](./LICENSE).
