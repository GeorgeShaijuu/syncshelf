"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { Layers } from "lucide-react";

interface AuthGuardProps {
  children: React.ReactNode;
  requireAuth?: boolean;
}

export function AuthGuard({ children, requireAuth = true }: AuthGuardProps) {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (loading) return;

    if (requireAuth && !user) {
      router.replace("/login");
    } else if (!requireAuth && user) {
      router.replace("/");
    }
  }, [user, loading, requireAuth, router]);

  if (loading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background text-foreground">
        <div className="flex flex-col items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg shadow-primary/20 animate-pulse">
            <Layers className="h-6 w-6" />
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="h-1.5 w-1.5 rounded-full bg-primary animate-ping" />
            <span>Connecting to SyncShelf...</span>
          </div>
        </div>
      </div>
    );
  }

  // If redirecting, prevent flicker
  if (requireAuth && !user) return null;
  if (!requireAuth && user) return null;

  return <>{children}</>;
}
