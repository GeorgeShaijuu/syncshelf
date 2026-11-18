"use client";

import * as React from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";

export interface Workspace {
  id: string;
  name: string;
  ownerUid: string;
  role: "owner" | "editor" | "viewer";
  memberCount: number;
  isOwner: boolean;
  createdAt?: string | null;
}

interface WorkspaceContextType {
  workspaces: Workspace[];
  activeWorkspace: Workspace | null;
  loading: boolean;
  createWorkspace: (name: string) => Promise<Workspace>;
  selectWorkspace: (workspaceId: string) => void;
  updateWorkspaceInState: (workspaceId: string, updates: Partial<Workspace>) => void;
  refreshWorkspaces: () => Promise<void>;
}

const WorkspaceContext = React.createContext<WorkspaceContextType | undefined>(undefined);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [workspaces, setWorkspaces] = React.useState<Workspace[]>([]);
  const [activeWorkspace, setActiveWorkspace] = React.useState<Workspace | null>(null);
  const [loading, setLoading] = React.useState(true);

  const fetchWorkspaces = React.useCallback(async () => {
    if (!user) {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/workspaces", { headers });
      if (res.ok) {
        const data = await res.json();
        const list: Workspace[] = data.workspaces || [];
        setWorkspaces(list);

        // Maintain or set active workspace
        setActiveWorkspace((prev) => {
          if (prev && list.some((w) => w.id === prev.id)) {
            return list.find((w) => w.id === prev.id) || null;
          }
          return list.length > 0 ? list[0] : null;
        });
      }
    } catch (err) {
      console.error("[SyncShelf] Failed fetching workspaces:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  React.useEffect(() => {
    if (isAuthenticated) {
      fetchWorkspaces();
    } else {
      setWorkspaces([]);
      setActiveWorkspace(null);
      setLoading(false);
    }
  }, [isAuthenticated, fetchWorkspaces]);

  const createWorkspace = React.useCallback(
    async (name: string): Promise<Workspace> => {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: {
          ...headers,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ name }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create workspace.");
      }

      const created: Workspace = {
        ...data,
        isOwner: true,
      };

      setWorkspaces((prev) => [...prev, created]);
      setActiveWorkspace(created);
      return created;
    },
    []
  );

  const selectWorkspace = React.useCallback(
    (workspaceId: string) => {
      const found = workspaces.find((w) => w.id === workspaceId);
      if (found) {
        setActiveWorkspace(found);
      }
    },
    [workspaces]
  );

  const updateWorkspaceInState = React.useCallback(
    (workspaceId: string, updates: Partial<Workspace>) => {
      setWorkspaces((prev) =>
        prev.map((w) => (w.id === workspaceId ? { ...w, ...updates } : w))
      );
      setActiveWorkspace((prev) =>
        prev && prev.id === workspaceId ? { ...prev, ...updates } : prev
      );
    },
    []
  );

  const value = React.useMemo<WorkspaceContextType>(
    () => ({
      workspaces,
      activeWorkspace,
      loading,
      createWorkspace,
      selectWorkspace,
      updateWorkspaceInState,
      refreshWorkspaces: fetchWorkspaces,
    }),
    [workspaces, activeWorkspace, loading, createWorkspace, selectWorkspace, updateWorkspaceInState, fetchWorkspaces]
  );

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextType {
  const context = React.useContext(WorkspaceContext);
  if (!context) {
    throw new Error("useWorkspace must be used within a WorkspaceProvider");
  }
  return context;
}
