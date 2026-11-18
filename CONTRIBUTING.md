# Contributing to SyncShelf

Thank you for your interest in contributing to SyncShelf! As an open-source collaborative clipboard and workspace platform, we welcome contributions from the community.

Please take a few moments to review these guidelines before submitting issues or pull requests.

---

## Code of Conduct

SyncShelf is dedicated to providing a welcoming, respectful, and harassment-free experience for everyone. Please be considerate, collaborative, and professional in all interactions.

---

## Development Setup

### Prerequisites

- **Node.js**: v18.18.0 or later (Node.js 20+ LTS recommended)
- **Package Manager**: `npm` (v9+) or `pnpm`
- **Firebase Account**: Free Spark plan or Firebase Local Emulator Suite
- **Git**

### 1. Clone the Repository

```bash
git clone https://github.com/your-username/syncshelf.git
cd syncshelf
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Configure Local Environment

Copy the example environment configuration:

```bash
cp .env.example .env.local
```

Open `.env.local` and populate your development credentials. For local preview testing without cloud services, the application runs gracefully with default test fixtures.

> **CRITICAL**: Never commit `.env.local` or any files containing private keys, API secrets, or service account credentials.

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Testing & Quality Assurance

Before submitting any Pull Request, ensure that all automated checks pass locally:

### Type Checking

```bash
npm run typecheck
```
Ensures strict TypeScript compliance with zero errors.

### Code Linting

```bash
npm run lint
```
Checks for ESLint rule violations and stylistic consistency.

### Unit & Integration Tests

```bash
npm test
# or run specifically with vitest:
npx vitest run
```
Runs unit test suites including permission boundaries, paste interactions, calendar calculations, content detection, and cryptographic sharing validation.

---

## Pull Request Guidelines

1. **Create a Feature Branch**:
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```
2. **Follow Architectural Conventions**:
   - **Zero Client Write Trust**: Never perform direct client-side Firestore writes. All writes must go through validated Next.js API routes (`src/app/api/...`).
   - **Security First**: Validate all input payloads with Zod schemas in `src/lib/validation/`.
   - **Environment Variables**: Access environment variables through `@/lib/env`. Never call `process.env` directly in application components.
   - **Design Language**: Follow SyncShelf's Playful Claymorphism design system (tactile surfaces, warm ivory `#FAF7F0`, rounded curves, subtle layered drop shadows).
3. **Commit Messages**:
   Use clear, conventional commit messages:
   - `feat: add live collaborator presence indicator`
   - `fix: resolve scrollbar containment in mobile focus view`
   - `docs: update deployment guide for custom domains`
   - `test: add regression test for share expiration calculations`
4. **Submit Your PR**:
   - Provide a clear summary of changes and reference any related GitHub issues.
   - Include before/after screenshots or recordings for UI modifications.
   - Confirm that `npm run typecheck`, `npm run lint`, and `npm test` all pass cleanly.

---

## Reporting Bugs & Suggesting Features

- **Bug Reports**: Open an issue on GitHub describing the behavior, steps to reproduce, and environment details.
- **Feature Requests**: Open an issue with the "feature request" tag detailing the user problem and proposed solution.
- **Security Vulnerabilities**: Follow the disclosure instructions in [SECURITY.md](./SECURITY.md) instead of creating a public issue.
