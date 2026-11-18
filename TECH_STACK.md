# SyncShelf — Technology Stack (Firebase Edition)

**Decision:** Next.js + Firebase managed services + private Cloudflare R2 + Upstash Redis. Keep a single application repository and avoid a separate Express/WebSocket server for the MVP.

> Free-tier figures and billing requirements below were checked against the providers' published documentation on **16 November 2026**. Quotas and terms can change; re-check before deployment. “Free tier” is a limit, not unlimited free hosting.

## 1. Stack at a glance

| Layer | Technology | Purpose |
|---|---|---|
| Framework | Next.js App Router + React + TypeScript | UI, server components, API route handlers |
| Styling | Tailwind CSS + shadcn/ui + Lucide | Responsive UI and reusable components |
| Authentication | Firebase Authentication | Email/password and Google sign-in |
| Main database | Cloud Firestore | Workspace, member, item, invitation, share, and audit documents |
| Realtime feed | Firestore `onSnapshot` listeners | Live item-index changes across clients |
| Optional presence | Firebase Realtime Database | Later WebSocket-backed ephemeral presence only |
| Binary storage | Cloudflare R2, private bucket | Image/audio/file bytes and large text blobs |
| Cache / abuse protection | Upstash Redis | Short-lived server cache and rate limits |
| Server identity | Firebase Admin SDK | Verify ID tokens and perform privileged server operations |
| Object storage access | AWS SDK v3 S3 client + presigner | R2 signed upload/download URLs |
| Validation | Zod | Validate API requests and metadata |
| Data fetching | TanStack Query (optional) | Server API cache for non-live views; do not duplicate Firestore listener state unnecessarily |
| Code display | Shiki | Syntax-highlight saved code |
| Testing | Vitest, Playwright, Firebase Emulator Suite | Unit, browser, Firestore Rules, and Auth testing |

## 2. Firebase service choices

### Firebase Authentication

Use email/password and Google sign-in. Do not use phone-number sign-in in the free-first MVP because phone verification is separately billed. The browser Firebase SDK manages the user session; the app sends a Firebase ID token to Next.js API routes. The server verifies the token using Firebase Admin SDK before performing privileged work.

### Cloud Firestore — primary source of truth

Store structured application data and small text/code content. Use subcollections under each workspace so access checks and queries are scoped by workspace.

The published Firestore no-cost quota includes:

- 1 GiB stored data
- 50,000 document reads per day
- 20,000 document writes per day
- 20,000 document deletes per day
- 10 GiB outbound data transfer per month

This is one free Firestore database per Firebase project. Daily quotas reset around midnight Pacific time. Keep item documents small, paginate the index, avoid broad realtime listeners, and avoid unnecessary listener re-subscriptions.

### Firestore realtime listeners

Use `onSnapshot()` for the workspace item index and focused item detail. A listener lets the UI receive changes without polling or operating a custom socket server. It is a managed realtime subscription; do not describe it as a guaranteed zero-latency channel.

### Firebase Realtime Database — optional, not the item database

Do not duplicate the clipboard item feed in Realtime Database. Add RTDB later only if a distinct requirement appears, such as online presence, typing state, or short-lived collaboration signals. Its free Spark quota is limited (the pricing page currently lists 100 simultaneous connections, 1 GB stored, and 360 MB/day downloaded). If used, store ephemeral data only and write rules before exposing it.

### Important: Firebase Cloud Storage is excluded from the free-first path

Firebase's current Storage FAQ states that Cloud Storage for Firebase requires the **Blaze** pay-as-you-go plan. A Spark project cannot access Firebase Storage buckets, including default buckets. Some no-cost usage may remain on Blaze, but Blaze still requires a linked billing account and can incur charges.

For a no-cost-plan-oriented prototype, keep Firebase on Spark for Authentication/Firestore and use Cloudflare R2 for file bytes. This avoids making Firebase Storage a requirement.

## 3. File storage: Cloudflare R2

Use a **private Standard bucket**. The published R2 free tier currently includes 10 GB-month Standard storage, 1 million Class A operations/month, 10 million Class B operations/month, and free internet egress. Infrequent Access storage is not included in that free tier.

Implementation pattern:

1. Browser asks the Next.js API for an upload intent.
2. API verifies Firebase ID token, workspace membership, Editor/Owner role, file size, MIME allowlist, and rate limits.
3. API returns a short-lived signed PUT URL and random object key.
4. Browser uploads directly to R2.
5. Browser calls a finalize API; server checks the object exists and validates its metadata before creating the Firestore item document.
6. For download/preview, server re-checks access and returns a short-lived signed GET URL.

Never expose R2 credentials in `NEXT_PUBLIC_*` variables. Do not make the bucket public. Store object keys, not permanent public URLs, in Firestore.

## 4. Redis: Upstash

Use Upstash Redis through its REST SDK from server-side code only. The currently published Free Redis plan lists 256 MB data, 10 GB monthly bandwidth, and 500,000 monthly commands.

Recommended uses:

- Rate-limit share-token resolution and upload-intent endpoints.
- Cache workspace summary and non-sensitive index results briefly.
- Cache membership/role lookup for a very short TTL only if invalidation is implemented.
- Cache signed URL metadata only for a period shorter than the URL expiry, if useful.

Rules:

- Firestore is the source of truth.
- Never store item bodies or file bytes in Redis.
- Cache only data that can safely be re-fetched.
- Invalidate/update caches after every successful mutation.
- If Redis is unavailable or its quota is exhausted, core app functionality must continue without the cache.

## 5. Liveblocks and custom WebSockets

Do **not** add Liveblocks to the first build. Basic item synchronisation is already handled by Firestore realtime listeners. Adding another realtime provider for the same feed creates duplicate infrastructure and cost/permission paths.

For a later requirement:

- Use Firebase Realtime Database for ephemeral online presence or short-lived state.
- Evaluate Liveblocks only for true collaborative editing (shared editor, cursors, selections, concurrent document editing).
- Use a custom WebSocket service only if provider features cannot satisfy a measured requirement.

## 6. Deployment

Keep the first deployment target as a selectable adapter, not a hard-coded architecture dependency. Vercel Hobby can be convenient for a personal prototype, but review its current usage and commercial restrictions before using it for a business. Cloudflare Workers with the OpenNext adapter is another option, but validate the Next.js features and dependencies used by this app before deployment. Do not assume every Node package or server runtime behaves identically on every host.

## 7. Core dependencies

```bash
npm install firebase firebase-admin
npm install @aws-sdk/client-s3 @aws-sdk/s3-request-presigner
npm install @upstash/redis @upstash/ratelimit
npm install zod lucide-react
npm install shiki
npm install react-hook-form @hookform/resolvers
```

Optional client data helper:

```bash
npm install @tanstack/react-query
```

Initialize shadcn/ui after scaffolding:

```bash
npx shadcn@latest init
```

Testing tools:

```bash
npm install -D vitest @playwright/test
npm install -D @firebase/rules-unit-testing
```

Use Firebase Emulator Suite for local Auth/Firestore tests. Do not commit emulator data containing real user information.

## 8. Environment variables

See `README.md` for the full `.env.local` template. Public Firebase web configuration may use `NEXT_PUBLIC_` variables. Firebase Admin credentials, R2 keys, and Upstash tokens must stay server-only.

## 9. Free-first guardrails

| Service | Free usage design | Guardrail |
|---|---|---|
| Firebase Spark | Auth, Firestore, no-cost Firebase services | No phone auth; monitor Firestore read/write/storage quotas |
| Firestore | 1 GiB, 50K reads/day, 20K writes/day, 20K deletes/day, 10 GiB egress/month | Pagination, scoped listeners, small docs, deduplicate events |
| Realtime Database (optional) | 100 simultaneous connections, 1 GB stored, 360 MB/day downloads | Add only for presence; never mirror the item feed |
| Firebase Storage | Not available on Spark | Do not use as default; it requires Blaze |
| Cloudflare R2 | 10 GB-month, 1M Class A, 10M Class B, free egress | File-size caps, quotas, lifecycle cleanup, Standard tier |
| Upstash Redis | 256 MB, 500K commands/month, 10 GB bandwidth | Short TTLs, rate limits, cache only hot data |

No provider's free tier guarantees “unlimited” use. Set usage alerts where available and establish an application-level workspace storage cap.

## 10. Official references

- Firebase pricing: https://firebase.google.com/pricing/
- Firebase pricing plans: https://firebase.google.com/docs/projects/billing/firebase-pricing-plans
- Firestore quotas: https://firebase.google.com/docs/firestore/quotas
- Firestore pricing: https://firebase.google.com/docs/firestore/pricing
- Firebase Storage billing requirements: https://firebase.google.com/docs/storage/faqs-storage-changes-announced-sept-2024
- Realtime Database limits: https://firebase.google.com/docs/database/usage/limits
- Firebase App Check: https://firebase.google.com/docs/app-check
- Cloudflare R2 pricing: https://developers.cloudflare.com/r2/pricing/
- Upstash Redis pricing: https://upstash.com/pricing/redis
- Firebase Admin SDK: https://firebase.google.com/docs/admin/setup
- Firestore Security Rules: https://firebase.google.com/docs/firestore/security/get-started
