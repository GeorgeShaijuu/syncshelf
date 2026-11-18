import crypto from "crypto";

export interface GeneratedInviteToken {
  /**
   * The complete composite token string handed to the client:
   * Format: `<workspaceId>_<secretToken>`
   * Allows O(1) direct workspace lookup without exposing internal IDs insecurely.
   */
  shareableToken: string;
  /**
   * High-entropy 32-byte cryptographically secure random string.
   */
  secretToken: string;
  /**
   * SHA-256 hash of secretToken. ONLY this hash is stored in Firestore.
   */
  tokenHash: string;
}

export interface ParsedInviteToken {
  workspaceId: string | null;
  secretToken: string;
  tokenHash: string;
}

/**
 * Computes SHA-256 hash of an invitation token.
 */
export function hashInviteToken(secretToken: string): string {
  return crypto.createHash("sha256").update(secretToken).digest("hex");
}

/**
 * Generates a high-entropy 32-byte invitation token and its SHA-256 hash.
 * Never stores or logs the raw secret.
 */
export function generateInviteToken(workspaceId: string): GeneratedInviteToken {
  // 32 cryptographically secure random bytes = 256 bits of entropy (64 hex characters)
  const secretToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = hashInviteToken(secretToken);
  const shareableToken = `${workspaceId}_${secretToken}`;

  return {
    shareableToken,
    secretToken,
    tokenHash,
  };
}

/**
 * Parses a shareable invitation token.
 * Extracts the workspaceId prefix and computes the SHA-256 hash of the secret.
 */
export function parseInviteToken(rawInput: string): ParsedInviteToken {
  const trimmed = (rawInput || "").trim();
  if (!trimmed) {
    throw new Error("Invitation token cannot be empty");
  }

  // The composite token format is `${workspaceId}_${secretToken}`
  // Since secretToken is hex, the last underscore separates workspaceId from secretToken.
  const lastUnderscore = trimmed.lastIndexOf("_");
  if (lastUnderscore > 0) {
    const workspaceId = trimmed.substring(0, lastUnderscore);
    const secretToken = trimmed.substring(lastUnderscore + 1);
    return {
      workspaceId,
      secretToken,
      tokenHash: hashInviteToken(secretToken),
    };
  }

  // Fallback for standalone secret tokens
  return {
    workspaceId: null,
    secretToken: trimmed,
    tokenHash: hashInviteToken(trimmed),
  };
}
