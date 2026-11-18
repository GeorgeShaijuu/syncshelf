# SyncShelf Vercel Deployment Guide

A step-by-step operations guide for deploying SyncShelf to [Vercel](https://vercel.com) with Firebase, Cloudflare R2, and Upstash Redis.

---

## 1. Prerequisites

Before starting the deployment, ensure you have:
1. A **GitHub account** with the SyncShelf repository pushed.
2. A **Vercel account** connected to GitHub.
3. A **Firebase project** (Google Cloud / Firebase Console) on the Spark (free) plan or higher.
4. A **Cloudflare account** with an R2 bucket (free tier available).
5. An **Upstash account** for Redis (free tier available, optional).

---

## 2. Firebase Configuration

### A. Authentication & Authorized Domains
1. Navigate to the [Firebase Console](https://console.firebase.google.com/) -> Select your project -> **Authentication** -> **Sign-in method**.
2. Enable **Email/Password** and **Google** providers.
3. Switch to the **Settings** tab -> **Authorized domains**.
4. Add your production deployment domain:
   - `your-app.vercel.app`
   - `*.vercel.app` (optional, for preview branch deployments)
   - Your custom domain (e.g., `shelf.yourdomain.com`).

### B. Firestore Database & Security Rules
1. In Firebase Console, go to **Firestore Database** -> **Create database** in Native mode.
2. Deploy the hardened `firestore.rules` and `firestore.indexes.json` using the Firebase CLI:
   ```bash
   firebase login
   firebase deploy --only firestore:rules,firestore:indexes
   ```

### C. Service Account Credentials (Server Admin SDK)
1. Go to **Project Settings** -> **Service accounts**.
2. Click **Generate new private key** and download the JSON file.
3. Extract the following values:
   - `project_id` -> `FIREBASE_ADMIN_PROJECT_ID`
   - `client_email` -> `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `private_key` -> `FIREBASE_ADMIN_PRIVATE_KEY`

> **Note on Private Keys**: When pasting `FIREBASE_ADMIN_PRIVATE_KEY` into Vercel, enclose it in quotes or paste the raw multi-line key. SyncShelf automatically normalizes `\n` linebreaks at runtime.

---

## 3. Cloudflare R2 Storage Configuration

### A. Bucket Creation & Privacy
1. Go to the [Cloudflare Dashboard](https://dash.cloudflare.com/) -> **R2** -> **Create bucket**.
2. Name the bucket (e.g. `syncshelf-media`).
3. Ensure **Public Access** remains **Off / Disabled**. SyncShelf relies entirely on short-lived presigned S3 URLs.

### B. CORS Configuration
In your R2 bucket settings, scroll to **CORS Policy** and apply the following JSON configuration:

```json
[
  {
    "AllowedOrigins": [
      "https://your-app.vercel.app",
      "https://*.vercel.app",
      "http://localhost:3000"
    ],
    "AllowedMethods": ["GET", "PUT", "HEAD"],
    "AllowedHeaders": [
      "Content-Type",
      "Content-Disposition",
      "Content-Length",
      "x-amz-*"
    ],
    "ExposeHeaders": ["ETag"],
    "MaxAgeSeconds": 3600
  }
]
```

### C. Scoped API Token
1. In Cloudflare R2, click **Manage R2 API Tokens** -> **Create API Token**.
2. Permission: **Object Read & Write**.
3. Bucket restriction: Select only your SyncShelf bucket.
4. Copy the **Access Key ID** and **Secret Access Key**.
5. Set `R2_ENDPOINT` to `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`.

---

## 4. Upstash Redis Configuration (Optional)

1. Go to the [Upstash Console](https://console.upstash.com/) -> **Create Database**.
2. Select your preferred primary region (choose one close to your Vercel edge/serverless region).
3. Under the **REST API** tab, copy:
   - `UPSTASH_REDIS_REST_URL`
   - `UPSTASH_REDIS_REST_TOKEN`

*(If omitted, SyncShelf automatically falls back to local in-memory sliding-window rate limiting).*

---

## 5. Deploying to Vercel

### Step 1: Import Project
1. Log in to [Vercel](https://vercel.com).
2. Click **Add New** -> **Project**.
3. Select your `syncshelf` GitHub repository.
4. Framework Preset: **Next.js** (auto-detected).
5. Root Directory: `./`.

### Step 2: Configure Environment Variables
In the **Environment Variables** section, add the following key-value pairs:

#### Client Variables (Apply to Production, Preview, Development):
- `NEXT_PUBLIC_APP_URL`: `https://your-app.vercel.app` (or custom domain)
- `NEXT_PUBLIC_FIREBASE_API_KEY`: Your Firebase Web API Key
- `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`: `your-project.firebaseapp.com`
- `NEXT_PUBLIC_FIREBASE_PROJECT_ID`: `your-project`
- `NEXT_PUBLIC_FIREBASE_APP_ID`: `1:xxxx:web:yyyy`
- `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`: `xxxx`

#### Server Variables (Apply to Production, Preview):
- `FIREBASE_ADMIN_PROJECT_ID`: `your-project`
- `FIREBASE_ADMIN_CLIENT_EMAIL`: `firebase-adminsdk-xxxxx@your-project.iam.gserviceaccount.com`
- `FIREBASE_ADMIN_PRIVATE_KEY`: `"-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"`
- `R2_ACCOUNT_ID`: Your Cloudflare Account ID
- `R2_ACCESS_KEY_ID`: Scoped R2 Access Key
- `R2_SECRET_ACCESS_KEY`: Scoped R2 Secret Key
- `R2_BUCKET_NAME`: `syncshelf-media`
- `R2_ENDPOINT`: `https://<ACCOUNT_ID>.r2.cloudflarestorage.com`
- `MAX_UPLOAD_SIZE_BYTES`: `26214400`
- `UPSTASH_REDIS_REST_URL`: `https://your-db.upstash.io` (optional)
- `UPSTASH_REDIS_REST_TOKEN`: `your-token` (optional)

### Step 3: Deploy
Click **Deploy**. Vercel will run the build and publish your application.

---

## 6. Post-Deployment Smoke Test Checklist

Once the deployment finishes:
1. **Authentication**: Sign up with email/password and Google OAuth. Ensure session persists on refresh.
2. **Workspace Creation**: Confirm default workspace initializes properly.
3. **Clip Management**: Create a text clip, a code snippet, and a link. Verify items appear in lanes without page reloads.
4. **Intelligent Paste**: Paste raw code and verify auto-classification to the "Codes" lane.
5. **Focus Mode**: Click the maximise icon on any lane. Verify lane expands to full width and switches smoothly.
6. **Calendar View**: Navigate to `/calendar` and verify date badges and daily groupings render correctly.
7. **Workspace Sharing 2.0**:
   - Create a public share link with Board scope.
   - Open link in an Incognito window.
   - Verify view renders without authentication and reflects live changes.
8. **File Upload (R2)**:
   - Upload an image or PDF.
   - Verify presigned PUT succeeds, object is stored in R2, and item appears on the shelf.
