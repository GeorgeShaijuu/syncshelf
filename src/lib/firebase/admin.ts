import { initializeApp, getApps, cert, type App } from "firebase-admin/app";
import { getAuth, type Auth } from "firebase-admin/auth";
import { getFirestore, type Firestore } from "firebase-admin/firestore";
import { getServerEnv, hasFirebaseAdminConfig, getClientEnv, sanitizePrivateKey } from "@/lib/env";

if (typeof window !== "undefined") {
  throw new Error("Firebase Admin SDK can only be executed in server runtime.");
}

let adminApp: App | null = null;

export function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0]!;
  }

  const serverEnv = getServerEnv();
  const clientEnv = getClientEnv();
  const projectId =
    serverEnv.FIREBASE_ADMIN_PROJECT_ID ||
    clientEnv.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  if (!projectId) {
    if (serverEnv.NODE_ENV === "production") {
      throw new Error(
        "[SyncShelf] Firebase Admin initialization failed: Missing Project ID. Set FIREBASE_ADMIN_PROJECT_ID or NEXT_PUBLIC_FIREBASE_PROJECT_ID."
      );
    }
  }

  const resolvedProjectId = projectId || "syncshelf-dev";

  // Case 1: Service Account Credentials provided in env
  if (hasFirebaseAdminConfig() && serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL && serverEnv.FIREBASE_ADMIN_PRIVATE_KEY) {
    const privateKey = sanitizePrivateKey(serverEnv.FIREBASE_ADMIN_PRIVATE_KEY);
    if (!privateKey) {
      throw new Error("[SyncShelf] FIREBASE_ADMIN_PRIVATE_KEY could not be parsed.");
    }

    adminApp = initializeApp({
      credential: cert({
        projectId: resolvedProjectId,
        clientEmail: serverEnv.FIREBASE_ADMIN_CLIENT_EMAIL,
        privateKey,
      }),
    });
    return adminApp;
  }

  // Case 2: Application Default Credentials (ADC) from gcloud / Google environment
  try {
    adminApp = initializeApp({
      projectId: resolvedProjectId,
    });
    return adminApp;
  } catch (error) {
    console.error("[SyncShelf] Firebase Admin initialization failed:", error);
    throw new Error(
      "[SyncShelf] Firebase Admin credentials are missing. Please provide service account credentials in environment variables or authenticate via Google Application Default Credentials."
    );
  }
}

export function getAdminAuth(): Auth {
  return getAuth(getAdminApp());
}

export function getAdminDb(): Firestore {
  return getFirestore(getAdminApp());
}
