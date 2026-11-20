"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/features/auth/auth-context";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";
import { PublicLandingPage } from "@/features/landing/public-landing-page";

export default function RootHomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!loading && user) {
      router.replace("/spaces");
    }
  }, [user, loading, router]);

  // While resolving Firebase session or when authenticated visitor is being redirected,
  // show the seamless clay loading screen to eliminate any flash or auth flicker.
  if (loading || user) {
    return <AppLoadingScreen />;
  }

  // Anonymous / Signed-out visitor: render the public marketing landing page
  return <PublicLandingPage />;
}
