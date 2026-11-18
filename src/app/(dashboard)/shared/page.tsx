"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { SharesDashboardView } from "@/features/shares/shares-dashboard-view";

export default function SharedPage() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <SharesDashboardView workspace={activeWorkspace} />
    </div>
  );
}
