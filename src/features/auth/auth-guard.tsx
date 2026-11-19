"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { getReturnUrlFromSearchParams } from "@/features/auth/auth-helpers";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";

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
      const currentPath =
        typeof window !== "undefined"
          ? window.location.pathname + window.location.search
          : "/spaces";
      const loginUrl =
        currentPath &&
        currentPath !== "/" &&
        currentPath !== "/spaces" &&
        currentPath !== "/login" &&
        currentPath !== "/register"
          ? `/login?returnTo=${encodeURIComponent(currentPath)}`
          : "/login";
      router.replace(loginUrl);
    } else if (!requireAuth && user) {
      // Determine where the user was trying to go
      const searchParams =
        typeof window !== "undefined"
          ? new URLSearchParams(window.location.search)
          : null;
      const targetUrl = getReturnUrlFromSearchParams(searchParams, "/spaces");
      router.replace(targetUrl);
    }
  }, [user, loading, requireAuth, router]);

  if (loading) {
    return <AppLoadingScreen />;
  }

  // If redirecting, prevent flicker
  if (requireAuth && !user) return null;
  if (!requireAuth && user) return null;

  return <>{children}</>;
}
