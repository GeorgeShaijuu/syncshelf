"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { WorkspaceSettingsView } from "@/features/settings/workspace-settings-view";

export default function SettingsPage() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <WorkspaceSettingsView workspace={activeWorkspace} />
    </div>
  );
}
