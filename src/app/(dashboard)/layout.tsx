"use client";

import * as React from "react";
import { AppShell } from "@/components/layout/app-shell";
import { AuthGuard } from "@/features/auth/auth-guard";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { WorkspaceOnboarding } from "@/features/workspaces/workspace-onboarding";
import {
  WorkspaceItemsProvider,
  useWorkspaceItemsContext,
} from "@/features/clipboard/workspace-items-context";
import { AppLoadingScreen } from "@/components/ui/app-loading-screen";

function DashboardAppShellWrapper({ children }: { children: React.ReactNode }) {
  const { connectionState, lastSyncedAt } = useWorkspaceItemsContext();
  const syncState =
    connectionState === "live"
      ? "live"
      : connectionState === "connecting" || connectionState === "reconnecting"
      ? "syncing"
      : connectionState === "offline"
      ? "offline"
      : "error";

  return (
    <AppShell syncState={syncState} lastSyncedAt={lastSyncedAt}>
      {children}
    </AppShell>
  );
}

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [quickCaptureOpen, setQuickCaptureOpen] = React.useState(false);
  const { workspaces, activeWorkspace, loading: workspaceLoading } = useWorkspace();

  return (
    <AuthGuard requireAuth={true}>
      {workspaceLoading ? (
        <AppLoadingScreen />
      ) : (
        <WorkspaceItemsProvider>
          <DashboardAppShellWrapper>{children}</DashboardAppShellWrapper>
        </WorkspaceItemsProvider>
      )}
    </AuthGuard>
  );
}
