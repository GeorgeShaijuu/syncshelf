import { getAdminAuth } from "@/lib/firebase/admin";
import type { DecodedIdToken } from "firebase-admin/auth";

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  displayName?: string;
  decodedToken: DecodedIdToken;
}

/**
 * Extracts and verifies the Firebase ID token from the Authorization header.
 * Header format: `Authorization: Bearer <token>`
 * 
 * Never accepts client-claimed UID or roles. Derive identity strictly from the verified token.
 */
export async function verifyAuthToken(authHeader: string | null | undefined): Promise<AuthenticatedUser | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  const token = authHeader.substring("Bearer ".length).trim();
  if (!token) {
    return null;
  }

  try {
    const adminAuth = getAdminAuth();
    const decodedToken = await adminAuth.verifyIdToken(token);
    return {
      uid: decodedToken.uid,
      email: decodedToken.email,
      displayName: decodedToken.name,
      decodedToken,
    };
  } catch (error) {
    console.error("[SyncShelf Auth] Token verification failed:", error);
    return null;
  }
}
