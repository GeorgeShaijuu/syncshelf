import { S3Client } from "@aws-sdk/client-s3";
import { getServerEnv, hasR2Config } from "@/lib/env";

let _r2Client: S3Client | null = null;

/**
 * Returns a configured S3Client instance targeting Cloudflare R2.
 * Strictly server-side only. Throws if R2 credentials are missing or when called on client.
 */
export function getR2Client(): S3Client {
  if (typeof window !== "undefined") {
    throw new Error("getR2Client() must only be called from server runtime.");
  }

  if (_r2Client) {
    return _r2Client;
  }

  if (!hasR2Config()) {
    throw new Error(
      "Cloudflare R2 is not configured. Please ensure R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, and R2_BUCKET_NAME are set."
    );
  }

  const env = getServerEnv();

  const endpoint =
    env.R2_ENDPOINT ||
    `https://${env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;

  _r2Client = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId: env.R2_ACCESS_KEY_ID!,
      secretAccessKey: env.R2_SECRET_ACCESS_KEY!,
    },
  });

  return _r2Client;
}

/**
 * Retrieves the configured R2 bucket name.
 */
export function getR2BucketName(): string {
  if (typeof window !== "undefined") {
    throw new Error("getR2BucketName() must only be called from server runtime.");
  }
  const env = getServerEnv();
  if (!env.R2_BUCKET_NAME) {
    throw new Error("R2_BUCKET_NAME is not set in environment.");
  }
  return env.R2_BUCKET_NAME;
}

/**
 * Helper to check if R2 is configured on the server.
 */
export function isR2Configured(): boolean {
  return hasR2Config();
}
