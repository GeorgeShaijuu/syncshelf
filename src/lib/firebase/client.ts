import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";
import { getFirestore, type Firestore } from "firebase/firestore";
import { getClientEnv, hasFirebaseClientConfig } from "@/lib/env";

let firebaseApp: FirebaseApp | null = null;
let firebaseAuth: Auth | null = null;
let firestoreDb: Firestore | null = null;

export function getFirebaseClientApp(): FirebaseApp | null {
  if (typeof window === "undefined") {
    return null;
  }

  if (getApps().length > 0) {
    return getApp();
  }

  if (!hasFirebaseClientConfig()) {
    console.info(
      "[SyncShelf] Firebase Web SDK: configured with placeholders or incomplete config. Running in preview/setup mode."
    );
    return null;
  }

  const env = getClientEnv();
  const firebaseConfig = {
    apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    appId: env.NEXT_PUBLIC_FIREBASE_APP_ID,
    messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    databaseURL: env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
  };

  firebaseApp = initializeApp(firebaseConfig);
  return firebaseApp;
}

export function getFirebaseAuth(): Auth | null {
  if (firebaseAuth) return firebaseAuth;
  const app = getFirebaseClientApp();
  if (!app) return null;
  firebaseAuth = getAuth(app);
  return firebaseAuth;
}

export function getFirestoreDb(): Firestore | null {
  if (firestoreDb) return firestoreDb;
  const app = getFirebaseClientApp();
  if (!app) return null;
  firestoreDb = getFirestore(app);
  return firestoreDb;
}
