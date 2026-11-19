import { getFirebaseAuth } from "@/lib/firebase/client";

/**
 * Reusable helper for obtaining the current user's Firebase ID token.
 * Never stores tokens in localStorage; relies on Firebase client SDK memory cache and auto-refresh.
 */
export async function getBearerToken(forceRefresh = false): Promise<string | null> {
  const auth = getFirebaseAuth();
  if (!auth || !auth.currentUser) return null;
  return auth.currentUser.getIdToken(forceRefresh);
}

/**
 * Returns an HTTP header object with `Authorization: Bearer <token>`.
 */
export async function getAuthHeaders(forceRefresh = false): Promise<Record<string, string>> {
  const token = await getBearerToken(forceRefresh);
  if (!token) return {};
  return {
    Authorization: `Bearer ${token}`,
  };
}

/**
 * Translates Firebase Auth error codes into human-readable messages.
 */
export function formatAuthError(error: unknown): string {
  if (!error || typeof error !== "object") {
    return "An unexpected error occurred. Please try again.";
  }

  const code = (error as { code?: string }).code;
  switch (code) {
    case "auth/email-already-in-use":
      return "This email address is already registered. Please sign in instead.";
    case "auth/invalid-email":
      return "Please enter a valid email address.";
    case "auth/weak-password":
      return "Password should be at least 6 characters.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential":
      return "Invalid email or password. Please verify your credentials.";
    case "auth/user-disabled":
      return "This account has been disabled. Please contact support.";
    case "auth/popup-closed-by-user":
      return "Sign-in cancelled. The popup was closed before completing.";
    case "auth/popup-blocked":
      return "Popup was blocked by your browser. Please allow popups for this site.";
    case "auth/network-request-failed":
      return "Network connection issue. Please check your internet connection.";
    case "auth/too-many-requests":
      return "Access temporarily blocked due to too many failed attempts. Try again later.";
    default:
      return (error as { message?: string }).message || "Authentication failed. Please try again.";
  }
}

/**
 * Strictly sanitizes and validates relative return paths to prevent open-redirect vulnerabilities.
 */
export function sanitizeReturnUrl(url: string | null | undefined, fallback = "/spaces"): string {
  if (!url) return fallback;
  const trimmed = url.trim();
  // Strictly enforce relative path starting with a single '/'
  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return trimmed;
  }
  return fallback;
}

/**
 * Extracts return destination from URL search params checking returnTo, returnUrl, next, continue.
 */
export function getReturnUrlFromSearchParams(
  searchParams: URLSearchParams | null | undefined,
  fallback = "/spaces"
): string {
  if (!searchParams) return fallback;
  const raw =
    searchParams.get("returnTo") ||
    searchParams.get("returnUrl") ||
    searchParams.get("next") ||
    searchParams.get("continue");
  return sanitizeReturnUrl(raw, fallback);
}
