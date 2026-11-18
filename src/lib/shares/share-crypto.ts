import crypto from "crypto";

export interface GeneratedShareToken {
  shareId: string;
  tokenSecret: string;
  token: string;
  tokenHash: string;
}

export interface ParsedShareToken {
  shareId: string;
  tokenSecret: string;
}

/**
 * Token format: shr_<shareId32hex>_<tokenSecret64hex>
 * Total length: 4 + 32 + 1 + 64 = 101 characters.
 * Total cryptographic entropy: 16 bytes (shareId) + 32 bytes (tokenSecret) = 48 bytes (384 bits).
 */
const TOKEN_PREFIX = "shr_";
const SHARE_ID_HEX_LENGTH = 32; // 16 bytes in hex
const TOKEN_SECRET_HEX_LENGTH = 64; // 32 bytes in hex

/**
 * Generates a high-entropy public share bearer token and its SHA-256 hash.
 * Only the SHA-256 hash and shareId should ever be stored in Firestore.
 */
export function generateShareToken(customShareId?: string): GeneratedShareToken {
  const shareId = customShareId || crypto.randomBytes(16).toString("hex");
  const tokenSecret = crypto.randomBytes(32).toString("hex");
  const token = `${TOKEN_PREFIX}${shareId}_${tokenSecret}`;
  const tokenHash = hashShareSecret(tokenSecret);

  return {
    shareId,
    tokenSecret,
    token,
    tokenHash,
  };
}

/**
 * Parses and validates the structural format of a public share token.
 * Returns null if the token does not strictly adhere to the expected format.
 */
export function parseShareToken(token: string): ParsedShareToken | null {
  if (typeof token !== "string" || !token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const remainder = token.slice(TOKEN_PREFIX.length);
  const parts = remainder.split("_");

  if (parts.length !== 2) {
    return null;
  }

  const [shareId, tokenSecret] = parts;

  // Validate hex characters and lengths
  const hexRegex = /^[0-9a-f]+$/i;
  if (
    shareId.length !== SHARE_ID_HEX_LENGTH ||
    tokenSecret.length !== TOKEN_SECRET_HEX_LENGTH ||
    !hexRegex.test(shareId) ||
    !hexRegex.test(tokenSecret)
  ) {
    return null;
  }

  return {
    shareId: shareId.toLowerCase(),
    tokenSecret: tokenSecret.toLowerCase(),
  };
}

/**
 * Computes the SHA-256 hash of the token secret.
 */
export function hashShareSecret(tokenSecret: string): string {
  return crypto.createHash("sha256").update(tokenSecret).digest("hex");
}

/**
 * Constant-time comparison between the provided token secret and the stored token hash.
 * Mitigates timing-attack side channels.
 */
export function verifyShareSecret(providedSecret: string, storedHash: string): boolean {
  if (typeof providedSecret !== "string" || typeof storedHash !== "string") {
    return false;
  }

  const computedHash = hashShareSecret(providedSecret);

  const computedBuf = Buffer.from(computedHash, "utf8");
  const storedBuf = Buffer.from(storedHash, "utf8");

  if (computedBuf.length !== storedBuf.length) {
    return false;
  }

  return crypto.timingSafeEqual(computedBuf, storedBuf);
}
