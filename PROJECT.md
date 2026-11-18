# SyncShelf — Project Requirements

**Working product name:** SyncShelf  
**Tagline:** Your team's clipboard. One searchable shelf.  
**Document status:** Product brief / implementation source of truth  
**Architecture direction:** Next.js + Firebase + Cloudflare R2 + Upstash Redis

## 1. Product summary

SyncShelf is a cross-device, team-shared clipboard library. A signed-in user can save text, code, images, audio, links, and other files into one searchable workspace. The workspace owner controls membership and decides which signed-in members can edit. A share link can expose selected content as read-only to anyone who has the link, without requiring an account.

The web application is the first release. A normal browser tab cannot continuously monitor every copy action made elsewhere on the operating system. The web MVP therefore supports explicit paste, capture, text entry, and file upload. A browser extension or desktop companion can add OS-level clipboard monitoring later, with clear user permission and privacy controls.

## 2. Product goals

- One searchable index for all saved and shared clipboard items.
- Keep the same workspace content synchronised across signed-in devices.
- Support text, code, images, audio, links, and arbitrary file attachments.
- Let one owner/admin create and manage one workspace.
- Let the owner invite/remove members and assign Viewer or Editor access.
- Make anonymous sharing strictly read-only and scope-limited.
- Keep the first version within published free quotas where practical.
- Keep the architecture small: managed services, one Next.js application, and no separately operated server fleet.

## 3. Explicit product rules

1. **One owned workspace per account.** A user can create only one workspace they own. They may still join other users' workspaces as a member.
2. **One owner/admin per workspace in the MVP.** The workspace creator is the owner/admin. Multi-admin support is not required initially.
3. **Membership requires sign-in.** A person must authenticate before accessing a workspace as a member.
4. **Anonymous access is share-link only.** An anonymous visitor can view only the item or workspace scope explicitly shared by a valid link.
5. **Anonymous visitors cannot edit.** A share token is a read credential, never a write credential.
6. **Editor access is explicitly granted.** The owner chooses which signed-in members receive the Editor role.
7. **Viewer is read-only.** Viewers may browse, search, copy, and download permitted content, but cannot create, edit, delete, or manage members.
8. **Owner controls membership and sharing.** Only the owner can invite/remove members, change roles, change workspace settings, and create/revoke share links.
9. **Authorization is enforced by the backend and Firestore Security Rules.** Hiding buttons in the interface is not security.
10. **Binary files are not stored in Firestore or Redis.** Firestore stores metadata and small text/code snippets. R2 stores file bytes.

## 4. Roles and permissions

| Capability | Anonymous share visitor | Viewer | Editor | Owner/Admin |
|---|---:|---:|---:|---:|
| Open a valid public share | Yes | Yes | Yes | Yes |
| Browse private workspace | No | Yes | Yes | Yes |
| Search workspace items | No | Yes | Yes | Yes |
| Copy/download accessible item | Yes, within link scope | Yes | Yes | Yes |
| Create item | No | No | Yes | Yes |
| Edit item | No | No | Yes | Yes |
| Delete item | No | No | Yes | Yes |
| Pin/unpin items | No | No | Yes | Yes |
| Invite/remove members | No | No | No | Yes |
| Change roles | No | No | No | Yes |
| Create/revoke share links | No | No | No | Yes |
| Change workspace settings | No | No | No | Yes |

Editors can manage shared workspace content, not workspace membership or owner settings. The owner can downgrade/remove any editor.

## 5. Main user journeys

### 5.1 Account and workspace creation

1. User signs up using email/password or Google sign-in.
2. User verifies their email when email/password registration is used.
3. User creates a workspace and becomes its Owner/Admin.
4. The server atomically creates the workspace using the authenticated UID as the deterministic workspace ID. If that workspace already exists, creation is rejected.
5. The owner can copy an invitation link or invite a member by email.

### 5.2 Join a team

1. A signed-in user opens an invitation link.
2. The server validates the invite token, expiry, intended email (if restricted), and remaining uses.
3. The user is added as Viewer by default unless the owner explicitly selected Editor.
4. The membership role is stored in Firestore and used for all authorization checks.

### 5.3 Capture an item

- **Text/code:** paste into the app or type into a capture modal.
- **Image/audio/file:** choose a file or drag it into the upload area.
- **Link:** paste a URL; save it as a link item with an optional title/note.
- **Clipboard paste:** explicit click or keyboard shortcut while the app is focused, subject to browser clipboard permissions.

### 5.4 Browse and search

- Main index shows newest items first.
- Filters: All, Text, Code, Images, Audio, Links, Files, Pinned, Created by me.
- Search supports title, text/code content where indexed, filename, and tags.
- Large results are paginated; do not load every attachment at once.
- Detail view shows a safe preview, metadata, creator, time, tags, and permitted actions.

### 5.5 Share anonymously

1. Owner selects one item or explicitly selects workspace read-only sharing.
2. Owner sets optional expiry and optional password only if password protection is implemented securely.
3. Server generates a high-entropy token and stores only its SHA-256 hash.
4. Anyone with the raw URL can view the permitted scope without signing in.
5. The share page has no edit controls and exposes only the minimum metadata/content required.
6. Owner can revoke the link at any time.

Workspace-wide public sharing should be off by default and show a confirmation warning before activation.

## 6. Item model and file types

Each clipboard item has metadata such as:

- `id`, `workspaceId`, `type`, `title`, `textContent` (small text/code only)
- `objectKey` for an R2 attachment, never a public permanent URL
- `fileName`, `mimeType`, `sizeBytes`, optional `thumbnailObjectKey`
- `language` for code, `url` for links, optional `tags[]`
- `createdBy`, `createdAt`, `updatedAt`, `isPinned`, `deletedAt`

Supported types: `text`, `code`, `image`, `audio`, `link`, `file`.

Use a configurable upload cap for the MVP (suggested starting point: 25 MB per file). Do not promise unlimited file size. Keep small text/code in Firestore and move large text bodies into R2 as text files. Validate MIME type and extension on the server; never trust only the browser-provided MIME type.

## 7. High-level technology decisions

| Layer | Choice | Responsibility |
|---|---|---|
| Web application | Next.js App Router, React, TypeScript | UI, route handlers, server-side business logic |
| Identity | Firebase Authentication | Email/password and Google sign-in |
| Main database | Cloud Firestore | Workspaces, roles, item metadata, small text/code, invites, share records |
| Live sync | Firestore realtime listeners (`onSnapshot`) | Update the index across open devices/tabs |
| Optional realtime presence | Firebase Realtime Database | Later: WebSocket-backed online/presence signals only |
| File bytes | Private Cloudflare R2 bucket | Images, audio, and arbitrary file attachments |
| Cache and rate limiting | Upstash Redis | Short-lived cache, share-link throttling, abuse controls |
| UI | Tailwind CSS, shadcn/ui, Lucide | Responsive component system |
| Validation | Zod | Runtime validation for every API/input boundary |

**Firebase Storage is intentionally not the default file store.** Firebase's current documentation says Cloud Storage for Firebase requires the Blaze plan; Spark projects cannot access Storage buckets. R2 lets the application keep Firebase on Spark for Auth/Firestore while storing binary files separately. Confirm current quotas before launch.

## 8. Scope and phases

### Phase 1 — Web MVP

- Firebase Auth registration/login/logout.
- One owned workspace per account.
- Owner, Editor, Viewer roles and member management.
- Text/code capture and CRUD.
- Image/audio/file upload through private R2 signed URLs.
- Unified index, filters, search, pagination, pinning.
- Firestore realtime listener updates across devices.
- Anonymous, read-only, revocable share links.
- Security Rules and server authorization tests.
- Audit events for membership and share-link changes.

### Phase 2 — Better capture and presence

- Browser extension with explicit clipboard permissions.
- Desktop companion for OS-wide clipboard capture, global shortcuts, and pause/excluded-app controls.
- Firebase Realtime Database presence/online indicators if users need it.
- Optional Liveblocks only for true collaborative editing features such as cursors or multi-user rich-text editing.

### Phase 3 — Power features

- Item version history and restore.
- More advanced full-text search.
- Audio transcription and image OCR only after privacy, consent, and cost review.
- Duplicate detection, retention policies, and per-workspace storage quotas.

## 9. Non-goals for the MVP

- No guaranteed zero latency; network conditions and provider quotas affect sync time.
- No silent operating-system-wide clipboard monitoring from the web app.
- No public bucket or permanent public file URLs.
- No anonymous editing.
- No unlimited storage or unlimited file sizes.
- No custom WebSocket server unless a measurable requirement cannot be met by Firebase realtime listeners.
- No Liveblocks dependency for basic item-feed synchronization.
- No Redis as a primary database or permanent storage layer.

## 10. Acceptance criteria

- A UID can create exactly one owned workspace; second creation attempt fails.
- A user without a membership record cannot read workspace items.
- Viewer cannot write any item even by calling the API directly or using the Firebase SDK manually.
- Editor can create/update/delete items but cannot alter member roles or share settings.
- Owner can manage members, roles, workspace settings, and share links.
- A valid anonymous share URL reads only its declared scope; invalid, expired, or revoked links fail.
- R2 objects remain private; downloads require a short-lived signed URL issued after access validation.
- File bytes never pass through Firestore or Redis.
- Item changes appear in another open workspace client through Firestore realtime listeners.
- Redis failure does not break core CRUD or access control.
- The web UI clearly distinguishes explicit capture from future background clipboard capture.
