import { z } from "zod";

/**
 * Public client environment variables schema.
 * Client variables must be prefixed with NEXT_PUBLIC_.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_APP_URL: z
    .string()
    .url("NEXT_PUBLIC_APP_URL must be a valid absolute URL (e.g. https://your-domain.com)")
    .optional(),
  NEXT_PUBLIC_FIREBASE_API_KEY: z.string().min(1, "Firebase API Key is required").optional(),
  NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_PROJECT_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_APP_ID: z.string().min(1).optional(),
  NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: z.string().optional(),
  NEXT_PUBLIC_FIREBASE_DATABASE_URL: z.string().url().optional(),
});

/**
 * Server-only environment variables schema.
 * All secrets must remain strictly server-side.
 */
const serverEnvSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  // Firebase Admin SDK
  FIREBASE_ADMIN_PROJECT_ID: z.string().min(1).optional(),
  FIREBASE_ADMIN_CLIENT_EMAIL: z.string().email().optional(),
  FIREBASE_ADMIN_PRIVATE_KEY: z.string().min(1).optional(),
  // Cloudflare R2 (Optional until file uploads are enabled)
  R2_ACCOUNT_ID: z.string().min(1).optional(),
  R2_ACCESS_KEY_ID: z.string().min(1).optional(),
  R2_SECRET_ACCESS_KEY: z.string().min(1).optional(),
  R2_BUCKET_NAME: z.string().min(1).optional(),
  R2_ENDPOINT: z.string().url().optional(),
  MAX_UPLOAD_SIZE_BYTES: z.coerce.number().positive().default(26214400), // 25 MB default
  // Upstash Redis (Optional cache/rate limiter; falls back to sliding-window in-memory)
  UPSTASH_REDIS_REST_URL: z.string().url().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().min(1).optional(),
});

export type ClientEnv = z.infer<typeof clientEnvSchema>;
export type ServerEnv = z.infer<typeof serverEnvSchema>;

let _clientEnv: ClientEnv | null = null;
let _serverEnv: ServerEnv | null = null;

/**
 * Sanitizes and normalizes PEM private keys from environment variables.
 * Handles escaped newlines (`\n`), literal newlines, and surrounding quotes.
 */
export function sanitizePrivateKey(rawKey?: string): string | undefined {
  if (!rawKey) return undefined;
  let key = rawKey.trim();
  // Strip surrounding quotes if present
  if ((key.startsWith('"') && key.endsWith('"')) || (key.startsWith("'") && key.endsWith("'"))) {
    key = key.slice(1, -1);
  }
  // Convert literal `\n` character sequences to real linebreaks
  return key.replace(/\\n/g, "\n");
}

/**
 * Retrieves validated client environment variables.
 * Staged so missing optional variables in dev/test do not crash the app.
 */
export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv;

  const raw = {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_FIREBASE_API_KEY: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    NEXT_PUBLIC_FIREBASE_APP_ID: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
    NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    NEXT_PUBLIC_FIREBASE_DATABASE_URL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };

  const parsed = clientEnvSchema.safeParse(raw);
  if (!parsed.success) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[SyncShelf Config] Client environment validation failed:",
        parsed.error.flatten().fieldErrors
      );
    } else {
      console.warn(
        "[SyncShelf Config] Client environment validation warnings:",
        parsed.error.flatten().fieldErrors
      );
    }
    _clientEnv = raw as unknown as ClientEnv;
    return _clientEnv;
  }

  _clientEnv = parsed.data;
  return _clientEnv;
}

/**
 * Retrieves validated server environment variables.
 * Never accessible in browser bundles.
 */
export function getServerEnv(): ServerEnv {
  if (typeof window !== "undefined") {
    throw new Error("getServerEnv() must only be called from server runtime.");
  }

  if (_serverEnv) return _serverEnv;

  const parsed = serverEnvSchema.safeParse(process.env);
  if (!parsed.success) {
    if (process.env.NODE_ENV === "production") {
      console.error(
        "[SyncShelf Config] Server environment validation failed:",
        parsed.error.flatten().fieldErrors
      );
    } else {
      console.warn(
        "[SyncShelf Config] Server environment validation warnings:",
        parsed.error.flatten().fieldErrors
      );
    }
    _serverEnv = process.env as unknown as ServerEnv;
    return _serverEnv;
  }

  _serverEnv = parsed.data;
  return _serverEnv;
}

/**
 * Resolves the trusted base URL of the application.
 * In production:
 *   1. Prioritizes NEXT_PUBLIC_APP_URL if configured.
 *   2. Inspects trusted request proxy headers (x-forwarded-host, x-forwarded-proto).
 *   3. Checks Vercel system deployment URL (VERCEL_URL).
 *   4. Falls back to request origin.
 * In development / test:
 *   Falls back to http://localhost:3000 if no explicit host is provided.
 */
export function getAppBaseUrl(req?: { nextUrl?: { origin?: string }; headers?: Headers }): string {
  // 1. Explicit configured application URL
  const configuredUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (configuredUrl) {
    return configuredUrl.replace(/\/$/, "");
  }

  // 2. Derive dynamically from request headers if available (Vercel / Cloudflare edge proxies)
  if (req && "headers" in req && req.headers) {
    const forwardedHost = req.headers.get("x-forwarded-host");
    const forwardedProto = req.headers.get("x-forwarded-proto") || "https";
    if (forwardedHost) {
      return `${forwardedProto}://${forwardedHost}`.replace(/\/$/, "");
    }
  }

  // 3. Fallback to Next.js request origin if available
  if (req && "nextUrl" in req && req.nextUrl?.origin) {
    const origin = req.nextUrl.origin;
    if (origin && !origin.includes("0.0.0.0")) {
      return origin.replace(/\/$/, "");
    }
  }

  // 4. Vercel deployment URL injected by Vercel platform
  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`.replace(/\/$/, "");
  }

  // 5. Development / testing default fallback
  return "http://localhost:3000";
}

/**
 * Feature-detection helpers for staged initialization.
 */
export function hasFirebaseClientConfig(): boolean {
  const env = getClientEnv();
  return Boolean(
    env.NEXT_PUBLIC_FIREBASE_API_KEY &&
    !env.NEXT_PUBLIC_FIREBASE_API_KEY.startsWith("YOUR_") &&
    env.NEXT_PUBLIC_FIREBASE_PROJECT_ID &&
    !env.NEXT_PUBLIC_FIREBASE_PROJECT_ID.startsWith("your-")
  );
}

export function hasFirebaseAdminConfig(): boolean {
  if (typeof window !== "undefined") return false;
  const env = getServerEnv();
  return Boolean(
    env.FIREBASE_ADMIN_PROJECT_ID &&
    !env.FIREBASE_ADMIN_PROJECT_ID.startsWith("your-") &&
    env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    !env.FIREBASE_ADMIN_CLIENT_EMAIL.startsWith("firebase-adminsdk-xxxxx") &&
    env.FIREBASE_ADMIN_PRIVATE_KEY &&
    !env.FIREBASE_ADMIN_PRIVATE_KEY.includes("YOUR_KEY")
  );
}

export function hasR2Config(): boolean {
  if (typeof window !== "undefined") return false;
  const env = getServerEnv();
  return Boolean(
    env.R2_ACCOUNT_ID &&
    !env.R2_ACCOUNT_ID.startsWith("YOUR_") &&
    env.R2_ACCESS_KEY_ID &&
    !env.R2_ACCESS_KEY_ID.startsWith("YOUR_") &&
    env.R2_SECRET_ACCESS_KEY &&
    env.R2_BUCKET_NAME
  );
}

export function hasRedisConfig(): boolean {
  if (typeof window !== "undefined") return false;
  const env = getServerEnv();
  return Boolean(
    env.UPSTASH_REDIS_REST_URL &&
    !env.UPSTASH_REDIS_REST_URL.includes("your-redis") &&
    env.UPSTASH_REDIS_REST_TOKEN &&
    !env.UPSTASH_REDIS_REST_TOKEN.startsWith("YOUR_")
  );
}
