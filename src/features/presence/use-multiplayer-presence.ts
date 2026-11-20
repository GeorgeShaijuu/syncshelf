"use client";

import * as React from "react";
import { useAuth } from "@/features/auth/auth-context";
import { getAuthHeaders } from "@/features/auth/auth-helpers";
import { CollaboratorPresence } from "./presence-types";

interface UseMultiplayerPresenceOptions {
  workspaceId?: string | null;
  shareToken?: string | null;
  view?: "board" | "calendar";
  activeLane?: string | null;
}

export function useMultiplayerPresence({
  workspaceId,
  shareToken,
  view = "board",
  activeLane,
}: UseMultiplayerPresenceOptions) {
  const { user } = useAuth();
  const [collaborators, setCollaborators] = React.useState<CollaboratorPresence[]>([]);

  // Stable anonymous client ID for capability-link viewers without accounts
  const anonIdRef = React.useRef<string>("");
  React.useEffect(() => {
    if (typeof window !== "undefined") {
      let stored = sessionStorage.getItem("syncshelf_anon_visitor_id");
      if (!stored) {
        stored = `anon_${Math.random().toString(36).substring(2, 10)}`;
        sessionStorage.setItem("syncshelf_anon_visitor_id", stored);
      }
      anonIdRef.current = stored;
    }
  }, []);

  const sendPing = React.useCallback(async () => {
    if (!workspaceId && !shareToken) return;

    try {
      const authHeaders = await getAuthHeaders();
      const endpoint = workspaceId
        ? `/api/workspaces/${encodeURIComponent(workspaceId)}/presence`
        : `/api/public/shares/${encodeURIComponent(shareToken!)}/presence`;

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          ...authHeaders,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          view,
          activeLane: activeLane || null,
          anonId: anonIdRef.current,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data.collaborators)) {
          setCollaborators(data.collaborators);
        }
      }
    } catch {
      // Quietly ignore heartbeat errors
    }
  }, [workspaceId, shareToken, view, activeLane]);

  // Initial and periodic presence heartbeat (every 18 seconds)
  React.useEffect(() => {
    if (!workspaceId && !shareToken) return;

    let timer: NodeJS.Timeout | null = null;
    let isMounted = true;

    const runPing = async () => {
      if (document.visibilityState === "visible") {
        await sendPing();
      }
      if (isMounted) {
        timer = setTimeout(runPing, 18000);
      }
    };

    runPing();

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        sendPing();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      isMounted = false;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [workspaceId, shareToken, sendPing]);

  // Filter out self so the avatar stack showcases other active collaborators
  const otherCollaborators = React.useMemo(() => {
    const currentUid = user?.uid || anonIdRef.current;
    return collaborators.filter((c) => c.userId !== currentUid);
  }, [collaborators, user?.uid]);

  return {
    allCollaborators: collaborators,
    otherCollaborators,
    refreshPresence: sendPing,
  };
}
