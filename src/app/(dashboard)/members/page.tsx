"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import { TeamManagementView } from "@/features/team/team-management-view";

export default function MembersPage() {
  const { activeWorkspace } = useWorkspace();

  if (!activeWorkspace) {
    return null;
  }

  return (
    <div className="space-y-6">
      <TeamManagementView workspace={activeWorkspace} />
    </div>
  );
}
