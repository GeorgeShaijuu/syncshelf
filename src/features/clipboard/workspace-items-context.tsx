"use client";

import * as React from "react";
import { useWorkspace } from "@/features/workspaces/workspace-context";
import {
  useWorkspaceItems,
  UseWorkspaceItemsResult,
  ConnectionState,
} from "./use-workspace-items";
import { ClipboardItem } from "@/lib/validation/item";

const WorkspaceItemsContext = React.createContext<UseWorkspaceItemsResult | null>(null);

export function WorkspaceItemsProvider({ children }: { children: React.ReactNode }) {
  const { activeWorkspace } = useWorkspace();
  const workspaceId = activeWorkspace?.id || "";

  // Dedicated persistent Firestore realtime subscription scoped to active workspace
  const workspaceItems = useWorkspaceItems({
    workspaceId,
    filterType: "all",
    pageSize: 100,
  });

  return (
    <WorkspaceItemsContext.Provider value={workspaceItems}>
      {children}
    </WorkspaceItemsContext.Provider>
  );
}

export function useWorkspaceItemsContext(): UseWorkspaceItemsResult {
  const context = React.useContext(WorkspaceItemsContext);
  if (!context) {
    throw new Error("useWorkspaceItemsContext must be used within a WorkspaceItemsProvider");
  }
  return context;
}
