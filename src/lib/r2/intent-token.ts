import crypto from "crypto";
import { getServerEnv } from "@/lib/env";
import { ClipboardItemType } from "@/lib/validation/item";

export interface UploadIntentPayload {
  workspaceId: string;
  itemId: string;
  objectKey: string;
  expectedSizeBytes: number;
  expectedMimeType: string;
  type: ClipboardItemType;
  title: string;
  tags: string[];
  calendarDate?: string;
  isPinned: boolean;
  originalFileName: string;
  userId: string;
  expiresAt: number; // Unix timestamp in ms
}

function getSigningKey(): string {
  const env = getServerEnv();
  // Derive a 32-byte key from Firebase Admin private key or R2 secret key
  const secretSource =
    env.FIREBASE_ADMIN_PRIVATE_KEY ||
    env.R2_SECRET_ACCESS_KEY;

  if (!secretSource) {
    if (env.NODE_ENV === "production") {
      throw new Error(
        "[SyncShelf Security] Missing server secret (FIREBASE_ADMIN_PRIVATE_KEY or R2_SECRET_ACCESS_KEY) required for signing upload intent tokens."
      );
    }
    return crypto.createHash("sha256").update("syncshelf-dev-internal-upload-secret-32b").digest("hex");
  }

  return crypto.createHash("sha256").update(secretSource).digest("hex");
}

/**
 * Creates a tamper-proof cryptographically signed intent token (HMAC-SHA256).
 */
export function createUploadIntentToken(
  payload: Omit<UploadIntentPayload, "expiresAt">,
  expiresInSeconds: number = 900 // 15 minutes default
): string {
  const expiresAt = Date.now() + expiresInSeconds * 1000;
  const fullPayload: UploadIntentPayload = {
    ...payload,
    expiresAt,
  };

  const payloadJson = JSON.stringify(fullPayload);
  const payloadB64 = Buffer.from(payloadJson, "utf8").toString("base64url");

  const hmac = crypto.createHmac("sha256", getSigningKey());
  hmac.update(payloadB64);
  const signature = hmac.digest("base64url");

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies and decodes an upload intent token.
 * Validates HMAC signature and timestamp expiration.
 * Throws an Error with a clear explanation if verification fails.
 */
export function verifyUploadIntentToken(token: string): UploadIntentPayload {
  if (!token || typeof token !== "string") {
    throw new Error("Invalid upload intent token format");
  }

  const parts = token.split(".");
  if (parts.length !== 2) {
    throw new Error("Malformed upload intent token structure");
  }

  const [payloadB64, signature] = parts;

  // Verify HMAC signature
  const hmac = crypto.createHmac("sha256", getSigningKey());
  hmac.update(payloadB64);
  const expectedSignature = hmac.digest("base64url");

  const sigBuffer = Buffer.from(signature);
  const expectedSigBuffer = Buffer.from(expectedSignature);

  if (
    sigBuffer.length !== expectedSigBuffer.length ||
    !crypto.timingSafeEqual(sigBuffer, expectedSigBuffer)
  ) {
    throw new Error("Invalid upload intent token signature (tampered)");
  }

  // Parse payload
  let payload: UploadIntentPayload;
  try {
    const jsonStr = Buffer.from(payloadB64, "base64url").toString("utf8");
    payload = JSON.parse(jsonStr);
  } catch {
    throw new Error("Failed to parse upload intent token payload");
  }

  // Check expiration
  if (Date.now() > payload.expiresAt) {
    throw new Error("Upload intent token has expired. Please initiate a new upload.");
  }

  return payload;
}
