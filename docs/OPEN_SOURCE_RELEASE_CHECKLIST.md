# SyncShelf Open-Source Release Checklist

Use this checklist before publishing the SyncShelf repository publicly on GitHub or deploying to production.

---

## 1. Secrets & Sensitive Data Audit

- [x] **Verify `.gitignore` Configuration**:
  Ensure `.gitignore` contains rules blocking all sensitive credential files:
  ```gitignore
  .env
  .env.*
  .env.local
  .env.development
  .env.test
  .env.production
  .env.preview
  !.env.example
  *-adminsdk-*.json
  *firebase-adminsdk*.json
  service-account*.json
  credentials.json
  *.pem
  *.key
  .vercel/
  ```
- [x] **Audit `.env.example`**:
  Confirm that `.env.example` contains exclusively dummy placeholder values (e.g., `YOUR_FIREBASE_WEB_API_KEY`, `your-project-id`) and never contains live production secrets or internal hostnames.
- [x] **Personal Information (PII) Check**:
  Confirm that no personal email addresses, phone numbers, or internal developer credentials are hardcoded in config files (e.g. `firebase.json` sanitized to `support@syncshelf.dev`).
- [x] **Localhost Remediation**:
  Verify that all production invite and share URL generators use `getAppBaseUrl(req)` instead of hardcoded `http://localhost:3000`.

---

## 2. Code Quality & Test Verification

Run each command locally from the project root and confirm clean execution:

```bash
# 1. Strict TypeScript compilation
npm run typecheck
# Expected: Exit code 0, 0 errors

# 2. Code linting
npm run lint
# Expected: "✔ No ESLint warnings or errors"

# 3. Unit and integration test suites
npx vitest run
# Expected: All suites passing
```

---

## 3. Community Health & Repository Documentation

- [x] **`README.md`**: Up to date with architecture diagrams, feature list, claymorphism design overview, tech stack, installation steps, configuration table, and testing instructions.
- [x] **`SECURITY.md`**: Contains vulnerability disclosure instructions, private reporting email, and response SLAs.
- [x] **`CONTRIBUTING.md`**: Explains development workflow, code conventions, PR submission guidelines, and testing requirements.
- [x] **`docs/VERCEL_DEPLOYMENT_GUIDE.md`**: Production deployment walkthrough including Firebase authorized domains, R2 CORS policy, and environment variables.
- [x] **`docs/SECURITY_AUDIT.md`**: Threat modeling, zero client write trust rationale, permission matrix, and cryptographic token verification.
- [x] **`docs/PRODUCTION_READINESS_AUDIT.md`**: Inventory of environment variables, localhost audit, and production verification status.

---

## 4. Recommended GitHub Repository Settings

Once the repository is initialized and pushed to GitHub:

### A. Security & Analysis
Navigate to **Settings** -> **Code security and analysis**:
1. **Dependency graph**: Enable.
2. **Dependabot alerts**: Enable.
3. **Dependabot security updates**: Enable.
4. **Secret scanning**: Enable.
5. **Push protection**: Enable (blocks accidental commits containing recognized API keys or private keys).
6. **Private vulnerability reporting**: Enable (allows researchers to submit advisories privately).

### B. Branch Protection Rules (`main`)
Navigate to **Settings** -> **Branches** -> **Add branch protection rule**:
- Branch name pattern: `main`
- [x] **Require a pull request before merging** (at least 1 approving review).
- [x] **Require status checks to pass before merging**:
  - `typecheck`
  - `lint`
  - `test`
- [x] **Require linear history**.
- [x] **Do not allow bypassing the above settings**.

---

## 5. Vercel Production Release Checklist

- [x] Project imported into Vercel with Next.js framework preset.
- [x] All client and server environment variables configured in Vercel Project Settings.
- [x] Firebase Authorized Domains updated with Vercel production domain and custom domain.
- [x] Cloudflare R2 CORS configured for the production domain.
- [x] Smoke tests verified on the production deployment (login, board, calendar, sharing, file uploads).
