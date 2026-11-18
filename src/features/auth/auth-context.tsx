"use client";

import * as React from "react";
import {
  type User,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { getFirebaseAuth } from "@/lib/firebase/client";

interface AuthContextType {
  user: User | null;
  loading: boolean;
  isAuthenticated: boolean;
  signUp: (email: string, password: string, displayName?: string) => Promise<User>;
  signIn: (email: string, password: string) => Promise<User>;
  signInWithGoogle: () => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    const auth = getFirebaseAuth();
    if (!auth) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const signUp = React.useCallback(
    async (email: string, password: string, displayName?: string): Promise<User> => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase Authentication is not configured.");

      const cred = await createUserWithEmailAndPassword(auth, email, password);
      if (displayName && cred.user) {
        await updateProfile(cred.user, { displayName });
      }
      return cred.user;
    },
    []
  );

  const signIn = React.useCallback(
    async (email: string, password: string): Promise<User> => {
      const auth = getFirebaseAuth();
      if (!auth) throw new Error("Firebase Authentication is not configured.");

      const cred = await signInWithEmailAndPassword(auth, email, password);
      return cred.user;
    },
    []
  );

  const signInWithGoogle = React.useCallback(async (): Promise<User> => {
    const auth = getFirebaseAuth();
    if (!auth) throw new Error("Firebase Authentication is not configured.");

    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const cred = await signInWithPopup(auth, provider);
    return cred.user;
  }, []);

  const signOut = React.useCallback(async (): Promise<void> => {
    const auth = getFirebaseAuth();
    if (!auth) return;
    await firebaseSignOut(auth);
    setUser(null);
  }, []);

  const value = React.useMemo<AuthContextType>(
    () => ({
      user,
      loading,
      isAuthenticated: Boolean(user),
      signUp,
      signIn,
      signInWithGoogle,
      signOut,
    }),
    [user, loading, signUp, signIn, signInWithGoogle, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextType {
  const context = React.useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
