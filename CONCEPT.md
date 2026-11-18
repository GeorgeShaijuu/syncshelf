# SyncShelf — Product Concept

## 1. One-line idea

**Your team's clipboard. One searchable shelf.**

SyncShelf turns copied content into a personal and team library. Save a snippet once, find it later, and make it available across your devices or to the teammates the workspace owner approves.

## 2. The mental model

Think of SyncShelf as three things:

- **A clipboard:** save text, code, images, audio, links, and other files.
- **A searchable shelf:** view everything in one timeline/index, then search and filter it.
- **A team space:** the owner controls who can view, edit, and share content.

It is not intended to replace a full cloud drive. Its core unit is a reusable clipboard item with searchable metadata and an optional file attachment.

## 3. Experience direction

The application should feel like a fast command centre, not a complicated file manager.

### Main layout

- **Left sidebar:** workspace switcher, All items, Pinned, Shared links, Members, Settings.
- **Top bar:** global search, type filters, quick capture, profile menu.
- **Main index:** newest-first feed or compact grid with type icon, preview, creator, timestamp, tags, and pin state.
- **Quick capture:** Paste, New text, New code, Upload file.
- **Detail panel:** full text/code, image/audio/file preview, copy/download, and role-aware actions.

### Item cards

Keep cards compact. Text/code displays a short preview. Images show a thumbnail. Audio shows a simple player. Files show filename, type, size, and download. Never download every media file just to render the index.

### Permission-aware interface

- **Viewer:** browse, search, copy, and download accessible content.
- **Editor:** also add, edit, pin, and delete workspace items.
- **Owner/Admin:** additionally manage members, roles, workspace settings, invitations, and share links.
- **Anonymous visitor:** sees only the shared page and its permitted content, without the workspace dashboard or mutation controls.

The UI is not the security boundary. All actions are checked on the server and by Firestore Security Rules.

## 4. Capture experience

The web MVP supports explicit capture:

- Click Paste or use the supported keyboard shortcut while the app is focused.
- Create a text or code item manually.
- Drag and drop or choose an image, audio, or other file.
- Paste a URL to save a link item.
- Copy saved text back to the local clipboard.

A browser tab cannot silently observe every copy made in other applications. For automatic capture across the operating system, add a browser extension or desktop companion later. Make capture opt-in, show capture status, and provide pause/excluded-app controls.

## 5. Workspace and sharing model

A user can own exactly one workspace. They may also join other workspaces as a member. The creator is the Owner/Admin. New members default to Viewer; the owner can explicitly promote selected people to Editor.

Anonymous access is separate: an owner-generated link can expose one item or a deliberately enabled workspace read-only scope. Links can expire and be revoked. No share link ever grants editing rights.

## 6. Technology concept

- Firebase Authentication provides account identity.
- Cloud Firestore stores workspace data and item metadata.
- Firestore realtime listeners keep open clients in sync.
- Cloudflare R2 stores binary attachments in a private bucket.
- Upstash Redis provides optional caching and rate limiting.
- Next.js handles the UI and server-side authorization/API routes.

Firebase Storage is not used in the free-first path because Firebase's current docs require Blaze for Cloud Storage buckets. R2 is the file store while Firebase remains on Spark where possible.

## 7. Roadmap

### Phase 1 — Shared clipboard web app

Auth, one owned workspace, role-based access, text/code capture, file uploads, searchable index, Firestore live updates, anonymous read-only links, and audit history.

### Phase 2 — Capture and presence

Browser extension, desktop companion, OS clipboard monitoring with explicit consent, global shortcuts, pause controls, and optional Firebase Realtime Database presence.

### Phase 3 — Collaboration and intelligence

Optional Liveblocks for collaborative editing cursors and shared rich-text editing; version history; improved search; OCR/transcription only with user consent and a cost/privacy review.

## 8. Positioning

A place to keep anything you copy, with team permissions built in. Less searching through chats, notes, and downloads; more reusing what matters.
