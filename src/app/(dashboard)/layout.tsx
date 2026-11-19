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
import { Loader2 } from "lucide-react";

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
        <div className="flex h-screen w-full items-center justify-center bg-background text-foreground">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Loading workspaces...</span>
          </div>
        </div>
      ) : (
        <WorkspaceItemsProvider>
          <DashboardAppShellWrapper>{children}</DashboardAppShellWrapper>
        </WorkspaceItemsProvider>
      )}
    </AuthGuard>
  );
}
