# SyncShelf — UI Redesign & Implementation Reference

## 1. Executive Summary

The user interface of SyncShelf has been redesigned to faithfully match the exact visual reference specification. The new interface transitions SyncShelf into an editorial, desktop-first creative workspace characterized by:
- A warm ivory canvas (`#F8F6EF`) and white card containers (`#FFFEFB`).
- Fluid, organic abstract artwork in golden yellow, orange, coral, and soft peach positioned in the upper-right and lower-left viewports.
- An aligned horizontal top navigation bar following the exact sequence:
  **`syncshelf` logo → Search bar → Hand tool → Select tool → Bookmark → Sync indicator → Workspace selector**
- A floating vertical toolbar on the left with rounded corners, subtle drop shadow, quick actions (Add, Upload, Canvas, Team, Sharing, Settings), and user profile avatar.
- A 7-lane horizontal board with independent vertical scrolling:
  **Text → Codes → Links → Images → Audio → Video → Files**
- Content-specific card designs with inline audio waveforms, video duration badges, link domain previews, syntax highlighting, and file-type badges.
- Bottom horizontal scrollbar track with a smooth position indicator.
- Universal Clipboard interaction (**COPY → PASTE → DONE** via Ctrl+V / ⌘+V) and multi-file drag-and-drop.

---

## 2. Color System & Typography

### Palette Tokens
| Token | Hex / HSL | Usage |
|---|---|---|
| Canvas Background | `#F8F6EF` | Viewport & main workspace canvas |
| Card Background | `#FFFEFB` | Content cards & floating surfaces |
| Lane Container | `#F3EFE8` | Content column background (75% opacity) |
| Primary Text | `#151515` | Headings, card titles, wordmark |
| Secondary Text | `#77736D` | Timestamps, metadata, labels, placeholders |
| Border / Separators | `#EEEAE2` | Subtle borders, dividers, card outlines |
| Orange Accent | `#F28A32` | Primary active accent, wave artwork |
| Coral Accent | `#E84B35` | Audio waveform, video, wave artwork |
| Yellow Accent | `#FFC84B` | Bookmark active, artwork layer |
| Soft Peach | `#FFE0C9` | Hand tool active, Add button background |
| Lavender / Purple | `#EEE4F5` / `#8A56AC` | Codes lane icon badge & syntax |
| Muted Blue | `#DDEBF0` / `#3B82F6` | Links & DOC file badges |

### Typography
- **Font Family**: Plus Jakarta Sans, with fallback to system geometric sans-serif.
- **Wordmark**: `syncshelf` in lowercase, bold weight (`font-bold text-xl tracking-tight text-[#151515]`).
- **Headings**: Semibold / Bold 12px for lane headers and card titles.
- **Body & Metadata**: Regular 11px and 10px for snippets, relative timestamps (`3m ago`, `1h ago`), and file sizes.

---

## 3. Component Architecture & Implementation

### 3.1 Background Artwork (`src/components/ui/organic-background-artwork.tsx`)
- Fixed, non-interactive (`pointer-events-none`) SVG illustrations rendering layered, paper-cut organic curves.
- **Upper-Right**: Yellow (`#FFC84B`), Orange (`#F28A32`), and Coral (`#E84B35`) flowing waves.
- **Lower-Left**: Golden Yellow (`#FFC84B`), Warm Peach (`#FFE0C9`), and Orange (`#F28A32`) flowing waves.

### 3.2 Top Navigation (`src/components/layout/board-top-nav.tsx`)
1. **Logo**: `syncshelf` lowercase bold wordmark at far left.
2. **Search Bar**: Rounded pill (`rounded-full bg-[#EAE6DE]/70`), search icon, placeholder `Search anything...`, with `Ctrl+K` / `⌘+K` focus shortcut.
3. **Hand Tool**: Soft peach circular button (`bg-[#FFE0C9] text-[#151515]`), toggles board pan mode (`H` shortcut).
4. **Select Tool**: Viewfinder / scan icon (`Scan`), toggles card multi-selection mode (`V` shortcut).
5. **Bookmark**: Outline bookmark icon, toggles pinned/bookmarked items filter across all lanes (`B` shortcut).
6. **Sync**: Minimal circular synchronization icon (`RotateCw`), displaying live/syncing status.
7. **Workspace Selector**: Rounded white pill with workspace icon (`Layers`), active name (`My Workspace`), and dropdown menu to switch workspaces.

### 3.3 Left Floating Toolbar (`src/components/layout/floating-toolbar.tsx`)
- Fixed dock at `left-4 top-24` in `w-12 py-2.5 rounded-2xl bg-[#FFFEFB] border border-[#EEEAE2] shadow-md`.
- **Add / Quick Capture**: Soft peach rounded square with `+` (`bg-[#FFE0C9] text-[#151515]`).
- **Upload Action**: Direct multi-file picker trigger (`Upload`).
- **Workspace Navigation**:
  - Board Canvas (`/`)
  - Team Members (`/members`)
  - Shared Links (`/shared`)
  - Settings (`/settings`)
- **Divider & User Profile**: Circular avatar displaying user initials with gradient background and popover sign-out menu.

### 3.4 Board Canvas & Content Lanes (`src/features/clipboard/board/`)
- **`BoardCanvas`**: Full-screen horizontal board with:
  - Click-and-drag panning when Hand Tool is active (`cursor-grab` / `cursor-grabbing`).
  - Horizontal trackpad and Shift + mouse wheel scrolling.
  - Bottom horizontal slider track with synchronized slider thumb indicating scroll position.
- **`BoardLane`**: Seven fixed-width vertical lanes (`Text`, `Codes`, `Links`, `Images`, `Audio`, `Video`, `Files`) with independent vertical scrolling (`overflow-y-auto`).
  - Circular content-type badge with distinct pastel backgrounds.
  - Lane title and item count (`X items`).
  - Context menu (`MoreHorizontal`).
- **`BoardCardRenderers`**:
  - **Text**: Title snippet, body text, relative timestamp, copy button.
  - **Codes**: Syntax-highlighted dark container (`#1E1E24`), monospace typography, relative timestamp, copy button.
  - **Links**: Favicon / brand mark (GitHub, YouTube, etc.), domain, page description, warm wave graphic banner, external link action.
  - **Images**: Full rounded thumbnail preview with aspect-ratio preservation, open modal action, relative timestamp.
  - **Audio**: Circular play/pause toggle button (`#FFE5E0` / `#E84B35`), 24-bar audio waveform visualization, `0:00 / 2:34` time display, relative timestamp.
  - **Video**: Video thumbnail, center play button overlay, duration badge (`4:21`), relative timestamp, external action.
  - **Files**: Color-coded file badge (`PDF` red, `DOC` blue, `XLS` green), filename, file size, relative timestamp, direct download action.

### 3.5 Selection Toolbar (`src/features/clipboard/board/selection-toolbar.tsx`)
- Floating pill at bottom center when in Select Mode and items are checked.
- Actions: Selected count, Select All, Batch Pin, Create Public Share link, Batch Delete, and Clear Selection.

### 3.6 Central Capture Engine (`src/features/clipboard/capture/`)
- `code-detector.ts`: Heuristic syntax detection distinguishing programming languages (JS/TS, Python, SQL, HTML, JSON, Bash, Rust, Go) from plain prose.
- `file-classifier.ts`: Extension and MIME-based classifier for image, audio, video, and general files.
- `content-classifier.ts`: URL parser and link title/domain generator.
- `content-detector.ts`: Orchestrator classifying raw text into link, code, or text.
- `clipboard-capture.ts`: Event listener for clipboard events and drag-and-drop.
- `paste-handler.ts`: Global Ctrl+V / ⌘+V handler that respects active input/textarea elements.

---

## 4. Verification & Automated Test Results

- **Automated Unit & Integration Tests**: **152 / 152 passed** across 12 test suites:
  - `tests/content-detection.test.ts` (16 tests) — ALL PASSED
  - `tests/paste-interaction.test.ts` (10 tests) — ALL PASSED
  - `tests/permissions.test.ts` (13 tests) — ALL PASSED
  - `tests/token-verification.test.ts` (4 tests) — ALL PASSED
  - `tests/workspace-rules.test.ts` (14 tests) — ALL PASSED
  - `tests/items-api.test.ts` (14 tests) — ALL PASSED
  - `tests/realtime-hook.test.ts` (5 tests) — ALL PASSED
  - `tests/r2-uploads.test.ts` (15 tests) — ALL PASSED
  - `tests/team-invitations.test.ts` (30 tests) — ALL PASSED
  - `tests/anonymous-sharing.test.ts` (26 tests) — ALL PASSED
  - `tests/redis-rate-limiter.test.ts` (4 tests) — ALL PASSED
  - `tests/e2e-multi-user.test.ts` (1 test) — ALL PASSED
- **TypeScript Typecheck (`npm run typecheck`)**: Passed with 0 errors.
- **ESLint (`npm run lint`)**: Passed with 0 warnings or errors.
